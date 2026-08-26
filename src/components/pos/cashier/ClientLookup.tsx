/**
 * "Mijozlarni qidirish" — the client the payment will be booked against.
 *
 * Laid out as the table from the mockup, with one row. The search endpoint
 * resolves a code or a phone number to exactly one client, so a list would
 * always be a list of one; the columns are what a cashier reads across —
 * balance and status against the person at the counter — and they are worth
 * keeping even for a single row.
 *
 * The placeholder says code or phone, not name. `/verification/search` matches
 * a client code, or a phone once the query holds seven or more digits
 * (verification_service.py:76). It does not match names, and promising that in
 * a placeholder would send the cashier typing a name into a 404.
 *
 * Errors are told apart. A bare catch used to report every failure as "client
 * not found", which sent the cashier back to re-type a code that was never the
 * problem; a dead backend and an unknown code look nothing alike from here.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';

import { logFrontendError } from '@/api/services/frontendErrors';
import {
  normalizeSearchResult,
  searchClients,
  type ClientSearchResult,
} from '@/api/verification';
import { formatCurrencySum } from '@/lib/format';
import {
  deleteRecentSearch,
  getRecentSearches,
  saveRecentSearch,
} from '@/pages/pos/components/utils';
import { triggerSoftHaptic } from '@/utils/haptics';

import { describeSearchFailure } from './apiErrors';

/**
 * Wording and colour for the three balance states the API reports.
 *
 * The status is carried by a word as well as a dot, so it is never colour
 * alone — and the debt figure itself turns red, which is the thing being read.
 */
const BALANCE_META: Record<
  ClientSearchResult['client_balance_status'],
  { label: string; dot: string; text: string }
> = {
  debt: { label: 'Qarzdor', dot: 'bg-mc-danger', text: 'text-mc-danger' },
  overpaid: { label: 'Haqdor', dot: 'bg-mc-success', text: 'text-mc-success' },
  balanced: { label: 'Faol', dot: 'bg-mc-success', text: 'text-mc-success' },
};

const HEAD_CELL =
  'pb-2 text-left text-[10px] font-bold uppercase tracking-[0.06em] text-mc-text-3';

export function ClientLookup({
  client,
  onFound,
  onCleared,
  onOpenProfile,
  focusToken,
}: {
  client: ClientSearchResult | null;
  onFound: (client: ClientSearchResult) => void;
  onCleared: () => void;
  /** Opens the client's full record — the mockup's "Hisobni tahrirlash". */
  onOpenProfile: () => void;
  /**
   * Bumped by the page to put the caret back in the search box.
   *
   * A counter rather than a callback ref, so the page can ask for focus at a
   * moment of its choosing (Escape) without holding a handle to this input.
   */
  focusToken: number;
}) {
  /**
   * Local box state, tagged with the client it belongs to.
   *
   * A client can arrive without being typed — the receipt scanner resolves a QR
   * and hands the code in — and when that happens the typed text and any
   * previous error are about somebody else. Tagging the state with the client
   * it was produced for makes both derived: when the tag stops matching the
   * client on screen, the state is stale and is simply not read. No effect
   * writes state on a prop change, and the failure this replaces was real —
   * a 404 from a mistyped code kept the red "not found" box on screen, hiding
   * the row and balance of the client the cashier had just scanned.
   */
  const [local, setLocal] = useState<{
    forCode: string | null;
    text: string;
    error: string | null;
  }>({ forCode: null, text: '', error: null });

  const currentCode = client?.client_code ?? null;
  const isStale = local.forCode !== currentCode;
  const input = isStale ? (currentCode ?? '') : local.text;
  const error = isStale ? null : local.error;

  const [isSearching, setIsSearching] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => getRecentSearches());
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // On mount, only when focus is nowhere: a till that steals the caret out of
    // a field someone is already typing in is worse than one that never grabs
    // it. On a bump from the page, take it unconditionally — that bump IS the
    // request.
    const isIdle =
      document.activeElement === null || document.activeElement === document.body;
    if (focusToken > 0 || isIdle) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [focusToken]);

  const runSearch = useCallback(
    async (override?: string) => {
      const query = (override ?? input).trim();
      if (!query) return;

      setIsSearching(true);
      setLocal({ forCode: null, text: query, error: null });
      onCleared();

      try {
        const response = await searchClients(query);
        const normalized = normalizeSearchResult(response.client);
        onFound(normalized);
        setLocal({
          forCode: normalized.client_code,
          text: normalized.client_code,
          error: null,
        });
        saveRecentSearch(normalized.client_code);
        setRecent(getRecentSearches());
      } catch (err) {
        // Tagged to no client, so the moment one arrives from elsewhere this
        // message stops being rendered instead of covering them.
        setLocal({
          forCode: null,
          text: query,
          error: describeSearchFailure(err, query),
        });
        const apiErr = err as { status?: number; message?: string };
        // A 404 is an ordinary "no such client". Anything else is a real
        // failure the cashier cannot diagnose from the counter.
        if (apiErr.status !== 404) {
          logFrontendError(
            apiErr.status ? 'api' : 'network',
            `Kassa client search failed: ${apiErr.message ?? 'unknown'}`,
            { status: apiErr.status ?? null, endpoint: '/verification/search' },
          );
        }
      } finally {
        setIsSearching(false);
      }
    },
    [input, onCleared, onFound],
  );

  const clear = () => {
    setLocal({ forCode: null, text: '', error: null });
    onCleared();
  };

  const removeRecent = (code: string) => {
    deleteRecentSearch(code);
    setRecent(getRecentSearches());
  };

  const meta = BALANCE_META[client?.client_balance_status ?? 'balanced'];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain rounded-mc-lg border border-mc-border bg-mc-surface p-3 shadow-[var(--mc-shadow-card)]">
      <h2 className="text-[15px] font-extrabold tracking-tight text-mc-text">
        Mijozlarni qidirish
      </h2>

      <form
        className="mt-3"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch();
        }}
      >
        <span className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-mc-text-3"
            strokeWidth={2}
            aria-hidden="true"
          />
          {/* 16px: below that iOS zooms on focus and never zooms back. */}
          <input
            ref={inputRef}
            value={input}
            onChange={(event) =>
              setLocal((prev) => ({
                forCode: null,
                text: event.target.value,
                error: prev.forCode === null ? prev.error : null,
              }))
            }
            placeholder="Mijoz kodi yoki telefon raqami"
            aria-label="Mijoz kodi yoki telefon raqami"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-mc-sm border border-mc-border bg-mc-surface-2 pl-9 pr-20 text-[16px] font-semibold text-mc-text outline-none placeholder:text-[13px] placeholder:font-medium placeholder:text-mc-text-3 focus:border-mc-brand"
          />
          <span className="absolute right-1.5 flex items-center gap-1">
            {input && (
              <button
                type="button"
                onClick={clear}
                aria-label="Tozalash"
                className="flex h-9 w-9 items-center justify-center rounded-full text-mc-text-2 active:scale-90"
              >
                <X className="h-4 w-4" strokeWidth={2.2} />
              </button>
            )}
            <button
              type="submit"
              disabled={isSearching || !input.trim()}
              aria-label="Qidirish"
              className="flex h-9 w-9 items-center justify-center rounded-mc-sm bg-mc-brand text-mc-on-brand transition-transform active:scale-90 disabled:opacity-40"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} />
              ) : (
                <Search className="h-4 w-4" strokeWidth={2.4} />
              )}
            </button>
          </span>
        </span>
      </form>

      {recent.length > 0 && !client && (
        /*
          Two separate 44px targets, 8px apart — not a chip with a 28px delete
          button welded to its right edge. Re-running a recent search is the
          frequent action; removing one is rare and unrecoverable
          (`deleteRecentSearch` writes straight through, with no undo), and a
          narrow destructive target under the right edge of the thing you are
          aiming at destroys the entry instead of searching it.
        */
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {recent.map((code) => (
            <li key={code} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  triggerSoftHaptic();
                  void runSearch(code);
                }}
                className="h-11 rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 text-[12px] font-bold text-mc-text-2 active:scale-95"
              >
                {code}
              </button>
              <button
                type="button"
                onClick={() => removeRecent(code)}
                aria-label={`${code} — ro‘yxatdan olib tashlash`}
                className="flex h-11 w-11 items-center justify-center rounded-mc-sm text-mc-text-3 active:scale-95"
              >
                <X className="h-4 w-4" strokeWidth={2.4} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2.5">
        {isSearching && !client ? (
          <div className="space-y-2" aria-busy="true">
            <div className="h-9 animate-pulse rounded-mc-sm bg-mc-surface-2" />
            <div className="h-12 animate-pulse rounded-mc-sm bg-mc-surface-2" />
          </div>
        ) : error ? (
          <p
            role="alert"
            className="rounded-mc-sm border border-mc-danger/25 bg-mc-danger-soft px-3 py-2.5 text-[12px] font-semibold text-mc-danger"
          >
            {error}
          </p>
        ) : !client ? (
          <p className="rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 py-5 text-center text-[12px] font-medium text-mc-text-2">
            Kod yoki telefon kiriting — mijoz shu yerda chiqadi
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse">
              <thead>
                <tr className="border-b border-mc-border">
                  <th className={HEAD_CELL}>Mijoz</th>
                  <th className={HEAD_CELL}>ID</th>
                  <th className={HEAD_CELL}>Telefon</th>
                  <th className={`${HEAD_CELL} whitespace-nowrap text-right`}>Hisob</th>
                  <th className={`${HEAD_CELL} text-right`}>Holat</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2.5 pr-2">
                    <span
                      className="block truncate text-[12px] font-bold text-mc-text"
                      title={client.full_name}
                    >
                      {client.full_name}
                    </span>
                  </td>
                  <td className="py-2.5 pr-2 text-[11px] font-semibold tabular-nums text-mc-text-2">
                    {client.client_code}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-2 text-[11px] font-medium tabular-nums text-mc-text-2">
                    {client.phone ?? '—'}
                  </td>
                  <td
                    className={`whitespace-nowrap py-2.5 pr-2 text-right text-[11px] font-extrabold tabular-nums ${
                      client.client_balance < 0 ? 'text-mc-danger' : 'text-mc-text'
                    }`}
                  >
                    {formatCurrencySum(client.client_balance)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${meta.text}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                        aria-hidden="true"
                      />
                      {meta.label}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="mt-2 text-[11px] font-medium text-mc-text-2">
              {client.stats.cargo_taken} ta yuk olingan ·{' '}
              {client.stats.total_payments} ta to‘lov
              <button
                type="button"
                onClick={() => {
                  triggerSoftHaptic();
                  onOpenProfile();
                }}
                className="ml-2 min-h-[32px] font-bold text-mc-brand active:scale-95"
              >
                To‘liq ma’lumot
              </button>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
