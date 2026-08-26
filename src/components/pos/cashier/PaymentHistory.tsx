/**
 * "So'nggi tasdiqlangan summalar tarixi" — the ledger of what was taken.
 *
 * Two things in the mockup are not built, because the data behind them does
 * not exist and inventing it would put wrong numbers in front of a cashier:
 *
 * - The status chips (Tasdiqlangan / Kutilmoqda / Rad etilgan). Every row in
 *   this endpoint is an already-posted payment event; there is no pending or
 *   rejected state to filter on. Pending and rejected receipts live in the
 *   "Onlayn to'lov cheklari" column, which is where those words belong. The
 *   chip row instead carries the provider filter, which is real and is what
 *   the current console filters by.
 * - A server-side search. `/payments/cashier-log` takes no text parameter, so
 *   the box filters the page on screen and says so above itself.
 *
 * There is no "my payments / all payments" switch, because there is nothing to
 * switch between: `/payments/cashier-log` is the SHARED log and already returns
 * every cashier's entries. That is the point of it — a cashier about to take
 * money has to be able to see that a colleague already took it
 * (payments_pos.py:360-368) — so the "Tasdiqladi" column is meaningful as it
 * stands, and a toggle would only imply the default was narrower than it is.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  exportCashierLog,
  getCashierLog,
  type CashierLogItem,
  type CashierLogProvider,
  type CashierLogSource,
} from '@/api/pos';
import { formatCurrencySum, formatTashkentDateTime } from '@/lib/format';
import { triggerSoftHaptic } from '@/utils/haptics';

import {
  PROVIDER_CHIP_TONE,
  PROVIDER_FILTERS,
  PROVIDER_LABEL,
  SOURCE_FILTERS,
  matchesQuery,
  pageWindow,
} from './HistoryFilters';
import type { PeriodRange } from './periods';

/** Ten rows a page — the table shares its column with the client lookup. */
const PAGE_SIZE = 10;

const HEAD_CELL =
  'whitespace-nowrap px-2 pb-2 text-left text-[10px] font-bold uppercase tracking-[0.06em] text-mc-text-3';
const CELL = 'whitespace-nowrap px-2 py-2.5 text-[11px] text-mc-text-2';
/* 16px on every control: below that iOS zooms the page on focus and does not
   zoom back, leaving the whole till magnified. */
const CONTROL =
  'h-10 rounded-mc-sm border border-mc-border bg-mc-surface-2 px-2.5 text-[16px] font-semibold text-mc-text outline-none focus:border-mc-brand';

function ProviderChip({ provider }: { provider: string }) {
  const tone = PROVIDER_CHIP_TONE[provider] ?? PROVIDER_CHIP_TONE.uzpost;
  return (
    <span
      className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-extrabold ${tone}`}
    >
      {PROVIDER_LABEL[provider] ?? provider.toUpperCase()}
    </span>
  );
}

/**
 * Whether this row can be traced back to a receipt.
 *
 * The edit endpoint keys on `notification_id`, which a ledger row does not
 * carry — it has to be resolved from the client and flight. Rows with neither,
 * and the automatic NBU/UzPost entries, have nothing to resolve from, so they
 * get no pencil rather than one that always fails.
 */
function isEditableRow(item: CashierLogItem): boolean {
  return (
    item.entry_kind === 'payment_event' &&
    Boolean(item.client_code) &&
    Boolean(item.flight)
  );
}

function Row({
  item,
  canEdit,
  isResolving,
  onEdit,
}: {
  item: CashierLogItem;
  canEdit: boolean;
  isResolving: boolean;
  onEdit: (item: CashierLogItem) => void;
}) {
  // A wallet correction can be negative; nothing else in this table can.
  const isNegative = item.paid_amount < 0;
  const editable = canEdit && isEditableRow(item);
  return (
    <tr className="border-t border-mc-border">
      <td className={`${CELL} tabular-nums`}>
        {formatTashkentDateTime(item.created_at)}
      </td>
      <td className={`${CELL} font-bold text-mc-text`}>
        {item.client_code ?? '—'}
      </td>
      <td className={`${CELL} max-w-[160px] truncate`} title={item.flight ?? ''}>
        {item.flight ?? '—'}
      </td>
      <td className={CELL}>
        <ProviderChip provider={item.payment_provider} />
      </td>
      <td
        className={`${CELL} text-right font-extrabold tabular-nums ${
          isNegative ? 'text-mc-warn' : 'text-mc-text'
        }`}
      >
        {formatCurrencySum(item.paid_amount)}
      </td>
      <td className={`${CELL} max-w-[140px] truncate`} title={item.cashier_name ?? ''}>
        {item.cashier_name ?? '—'}
      </td>
      <td className={`${CELL} text-right`}>
        {editable && (
          <button
            type="button"
            disabled={isResolving}
            onClick={() => onEdit(item)}
            aria-label={`${item.client_code} · ${item.flight} to‘lovini tahrirlash`}
            title="To‘lovni tahrirlash"
            className="inline-flex h-9 w-9 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text-2 transition-transform active:scale-95 disabled:opacity-40"
          >
            {isResolving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} />
            ) : (
              <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
            )}
          </button>
        )}
      </td>
    </tr>
  );
}

export function PaymentHistory({
  range,
  provider,
  onProviderChange,
  canEdit,
  resolvingRowId,
  onEditRow,
  isOpen,
  onToggleOpen,
}: {
  /** `pos:process` — the same permission the edit endpoint requires. */
  canEdit: boolean;
  /** Id of the row whose receipt is being looked up, so only it shows a spinner. */
  resolvingRowId: number | null;
  /**
   * Ask the page to resolve this ledger row back to a receipt and open the
   * edit modal. Resolution lives up there because it needs a request, and a
   * table row is not the place to own one.
   */
  onEditRow: (item: CashierLogItem) => void;
  /** The same window the takings cards are showing, so the two agree. */
  range: PeriodRange;
  /**
   * Controlled by the page, not owned here, so the provider cards above can
   * set it. Two sources of truth for one filter would let the highlighted card
   * and the filtered table disagree.
   */
  provider: CashierLogProvider | 'all';
  onProviderChange: (next: CashierLogProvider | 'all') => void;
  /** Collapsed by default — the counter's work is above, not in the ledger. */
  isOpen: boolean;
  onToggleOpen: () => void;
}) {
  /**
   * The page, tagged with every filter that is owned OUTSIDE this component.
   *
   * Page 7 of "last 30 days" is almost always past the end of "today", and the
   * backend does not clamp — it answers an out-of-range page with an empty
   * list, which reads as "no payments in this period" for a period that has
   * them. Deriving the page from the active filters resets it without an effect.
   *
   * `provider` is in the key as well as `range`. The in-component controls all
   * go through `applyFilter`, which resets the page; a provider card above the
   * table does not, so tapping NBU while on page 7 asked for page 7 of a
   * two-page result and drew "no matching records" over a footer reading
   * "34 total". A cashier who reads that as "no NBU payments" can re-take money
   * a colleague already took — the exact thing this shared log exists to stop.
   */
  const filterKey = `${range.from}|${range.to}|${provider}`;
  const [pageState, setPageState] = useState({ forFilter: filterKey, page: 1 });
  const page = pageState.forFilter === filterKey ? pageState.page : 1;
  const setPage = (next: number) =>
    setPageState({ forFilter: filterKey, page: next });
  const [source, setSource] = useState<CashierLogSource | 'all'>('all');
  const [query, setQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const params = useMemo(
    () => ({
      page,
      size: PAGE_SIZE,
      date_from: range.from,
      date_to: range.to,
      ...(provider === 'all' ? {} : { payment_provider: provider }),
      ...(source === 'all' ? {} : { payment_source: source }),
    }),
    [page, range.from, range.to, provider, source],
  );

  const log = useQuery({
    queryKey: ['cashier-log', params],
    queryFn: () => getCashierLog(params),
    staleTime: 30_000,
  });

  // Changing a filter must go back to page one: page 7 of the unfiltered log is
  // very often past the end of the filtered one, which reads as "no results".
  const applyFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  const rows = (log.data?.items ?? []).filter((item) => matchesQuery(item, query));
  const totalPages = log.data?.total_pages ?? 1;
  const safePage = Math.min(page, Math.max(1, totalPages));
  const isFiltered = provider !== 'all' || source !== 'all' || query.trim() !== '';

  const runExport = async () => {
    setIsExporting(true);
    try {
      const blob = await exportCashierLog({
        date_from: range.from,
        date_to: range.to,
        ...(provider === 'all' ? {} : { payment_provider: provider }),
        ...(source === 'all' ? {} : { payment_source: source }),
      });
      // The object URL is revoked on the next tick rather than left to the
      // page's lifetime; a cashier exports repeatedly through a shift and each
      // un-revoked blob is held in memory until the tab is closed.
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `kassa-${range.from.slice(0, 10)}_${range.to.slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Excel faylni yuklab bo‘lmadi');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    // `h-full` only while expanded: collapsed, the section is a header bar and
    // stretching it would put back the space the collapse just freed.
    <section
      className={`@container flex min-h-0 flex-col rounded-mc-lg border border-mc-border bg-mc-surface p-3 shadow-[var(--mc-shadow-card)] ${
        isOpen ? 'h-full' : ''
      }`}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        {/*
          The title is the collapse control. Collapsed is the default: a cashier
          serving someone needs the search and the payment form, and the ledger
          is what they open afterwards to check a figure.
        */}
        <button
          type="button"
          onClick={() => {
            triggerSoftHaptic();
            onToggleOpen();
          }}
          aria-expanded={isOpen}
          className="flex min-h-[44px] items-center gap-2 text-left"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-mc-text-2 transition-transform ${isOpen ? '' : '-rotate-90'}`}
            strokeWidth={2.4}
            aria-hidden="true"
          />
          <span className="text-[15px] font-extrabold tracking-tight text-mc-text">
            So‘nggi tasdiqlangan summalar tarixi
          </span>
          {!isOpen && log.data && (
            <span className="text-[11px] font-semibold tabular-nums text-mc-text-2">
              {log.data.total_count} ta
            </span>
          )}
        </button>

        <div className={`flex items-center gap-1.5 ${isOpen ? '' : 'hidden'}`}>
          <button
            type="button"
            onClick={() => void runExport()}
            disabled={isExporting}
            className="flex h-11 items-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 text-[12px] font-bold text-mc-text-2 transition-transform active:scale-95 disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} />
            ) : (
              <Download className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
            )}
            Excel
          </button>
        </div>
      </div>

      {isOpen && (
      <>
      <div className="mt-2.5 grid shrink-0 gap-2 @[38rem]:grid-cols-3">
        <label className="flex flex-col">
          <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-mc-text-3">
            To‘lov turi
          </span>
          <select
            value={provider}
            onChange={(event) =>
              applyFilter(() =>
                onProviderChange(event.target.value as CashierLogProvider | 'all'),
              )
            }
            className={CONTROL}
          >
            {PROVIDER_FILTERS.map(({ value, label }) => (
              <option key={value} value={value}>
                {value === 'all' ? 'Barcha to‘lov turlari' : label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-mc-text-3">
            Yo‘nalish
          </span>
          <select
            value={source}
            onChange={(event) =>
              applyFilter(() =>
                setSource(event.target.value as CashierLogSource | 'all'),
              )
            }
            className={CONTROL}
          >
            {SOURCE_FILTERS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-mc-text-3">
            Shu sahifada qidirish
          </span>
          <span className="relative flex items-center">
            <Search
              className="pointer-events-none absolute left-2.5 h-4 w-4 text-mc-text-3"
              strokeWidth={2}
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Mijoz, reys yoki kassir"
              className={`${CONTROL} w-full pl-8 placeholder:text-[13px] placeholder:font-medium placeholder:text-mc-text-3`}
            />
          </span>
        </label>
      </div>

      <div className="mt-2 flex shrink-0 flex-wrap items-center gap-1.5">
        {PROVIDER_FILTERS.map(({ value, label }) => {
          const isActive = provider === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                triggerSoftHaptic();
                applyFilter(() => onProviderChange(value));
              }}
              className={`h-8 rounded-full border px-2.5 text-[11px] font-bold transition-colors ${
                isActive
                  ? 'border-mc-brand bg-mc-brand-soft text-mc-brand'
                  : 'border-mc-border bg-mc-surface-2 text-mc-text-2'
              }`}
            >
              {label}
            </button>
          );
        })}

        {isFiltered && (
          <button
            type="button"
            onClick={() => {
              triggerSoftHaptic();
              applyFilter(() => {
                onProviderChange('all');
                setSource('all');
                setQuery('');
              });
            }}
            className="flex h-8 items-center gap-1 px-2 text-[11px] font-bold text-mc-brand active:scale-95"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
            Filtrlarni tozalash
          </button>
        )}
      </div>

      <div className="mt-2.5 min-h-0 flex-1 overflow-auto overscroll-contain">
        {log.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="h-10 animate-pulse rounded-mc-sm bg-mc-surface-2"
              />
            ))}
          </div>
        ) : log.isError ? (
          <div className="rounded-mc-sm border border-mc-danger/25 bg-mc-danger-soft px-3 py-6 text-center">
            <p className="text-[12px] font-semibold text-mc-danger">
              Tarix yuklanmadi
            </p>
            <button
              type="button"
              onClick={() => void log.refetch()}
              className="mt-1 min-h-[44px] text-[12px] font-bold text-mc-danger underline active:scale-95"
            >
              Qayta urinish
            </button>
          </div>
        ) : rows.length === 0 && page > totalPages ? (
          /*
            "No matching records" over a footer reading "34 total" is a lie the
            cashier can act on — re-taking money a colleague already took. This
            is the residual case: the filters reset the page, but a refetch can
            still shrink the result under a page the cashier is already on.
          */
          <div className="rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 py-8 text-center">
            <p className="text-[12px] font-medium text-mc-text-2">
              {page}-sahifa bo‘sh — bu ro‘yxatda {totalPages} ta sahifa bor
            </p>
            <button
              type="button"
              onClick={() => setPage(1)}
              className="mt-1 min-h-[44px] text-[12px] font-bold text-mc-brand active:scale-95"
            >
              Birinchi sahifaga qaytish
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 py-10 text-center text-[12px] font-medium text-mc-text-2">
            {isFiltered
              ? 'Bu filtrlarga mos yozuv topilmadi'
              : 'Bu davrda tasdiqlangan to‘lov yo‘q'}
          </p>
        ) : (
          <table className="w-full min-w-[620px] border-collapse">
            <thead>
              <tr>
                <th className={HEAD_CELL}>Sana</th>
                <th className={HEAD_CELL}>Mijoz</th>
                <th className={HEAD_CELL}>Reys</th>
                <th className={HEAD_CELL}>To‘lov turi</th>
                <th className={`${HEAD_CELL} text-right`}>Summa</th>
                <th className={HEAD_CELL}>Tasdiqladi</th>
                <th className={`${HEAD_CELL} text-right`}>
                  <span className="sr-only">Amallar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <Row
                  key={`${item.entry_kind}-${item.id}`}
                  item={item}
                  canEdit={canEdit}
                  isResolving={resolvingRowId === item.id}
                  onEdit={onEditRow}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-2.5 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-mc-text-3">
          Jami {log.data?.total_count ?? 0} ta yozuv
          {query.trim() && ` · shu sahifada ${rows.length} ta`}
        </span>

        {totalPages > 1 && (
          <nav className="flex items-center gap-1" aria-label="Sahifalar">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              aria-label="Oldingi sahifa"
              className="flex h-8 w-8 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text-2 active:scale-95 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
            </button>

            {pageWindow(safePage, totalPages).map((entry, index) =>
              entry === 'gap' ? (
                <span
                  key={`gap-${index}`}
                  className="px-1 text-[11px] font-bold text-mc-text-3"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  aria-current={entry === safePage ? 'page' : undefined}
                  onClick={() => setPage(entry)}
                  className={`h-8 min-w-8 rounded-mc-sm border px-1.5 text-[11px] font-bold tabular-nums transition-colors ${
                    entry === safePage
                      ? 'border-mc-brand bg-mc-brand-soft text-mc-brand'
                      : 'border-mc-border bg-mc-surface-2 text-mc-text-2'
                  }`}
                >
                  {entry}
                </button>
              ),
            )}

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              aria-label="Keyingi sahifa"
              className="flex h-8 w-8 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text-2 active:scale-95 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </nav>
        )}
      </div>
      </>
      )}
    </section>
  );
}
