/**
 * Ctrl+K search over clients, flights and track codes.
 *
 * One backend call rather than a fan-out to three endpoints: three round trips
 * per keystroke, three pagination shapes, and — the deciding reason — the
 * client-side JWT decode must never be what picks which query runs. The server
 * echoes `granted_scopes`, so an empty group can be shown as "not permitted"
 * instead of implying the record does not exist.
 *
 * Results carry the fields worth reading inline (name, code, phone, flight), so
 * the common case — "what is this client's code" — is answered without leaving
 * the current screen. Selecting a row navigates to the screen that owns it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Package, Plane, Search, User, X } from 'lucide-react';

import { adminSearch, type SearchResults } from '@/api/services/adminDashboard';
import { triggerSoftHaptic } from '@/utils/haptics';

/** The server rejects anything shorter, and a one-character query matches half the table. */
const MIN_QUERY = 2;

/**
 * Long enough that typing a client code does not fire a query per character —
 * the search runs several ILIKE scans and admin traffic bypasses the IP rate
 * limiter, so an undebounced palette is an unthrottled scan generator.
 */
const DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface Row {
  key: string;
  group: string;
  icon: typeof User;
  title: string;
  meta: string;
  /** Where the row leads, with enough identity to open the record itself. */
  target: NavTarget;
}

export interface NavTarget {
  page: string;
  flightName?: string;
  clientId?: number;
}

function toRows(data: SearchResults | undefined): Row[] {
  if (!data) return [];
  return [
    ...data.clients.map((c) => ({
      key: `client-${c.id}`,
      group: 'Mijozlar',
      icon: User,
      title: c.full_name,
      meta: [c.client_code, c.phone].filter(Boolean).join(' · '),
      // The id, not just the page. Landing on a generic client list after
      // searching for one person by name is indistinguishable from the click
      // doing nothing, which is exactly how it was reported.
      target: { page: 'manager-page', clientId: c.id },
    })),
    ...data.flights.map((f) => ({
      key: `flight-${f.flight_name}`,
      group: 'Reyslar',
      icon: Plane,
      title: f.flight_name,
      meta: 'Reys yuklarini ochish',
      // `flights` would be a no-op when the search was opened from the Reyslar
      // page itself — the most likely place to search for a flight.
      target: { page: 'cargo-list', flightName: f.flight_name },
    })),
    ...data.tracks.map((t) => ({
      key: `track-${t.track_code}`,
      group: 'Trek kodlar',
      icon: Package,
      title: t.track_code,
      meta: [
        t.flight_name,
        t.client_code,
        t.source === 'expected' ? 'kutilmoqda' : 'kelgan',
      ]
        .filter(Boolean)
        .join(' · '),
      target:
        t.source === 'expected'
          ? { page: 'expected-cargo' }
          : { page: 'cargo-list', flightName: t.flight_name ?? undefined },
    })),
  ];
}

export function CommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (target: NavTarget) => void;
}) {
  const [term, setTerm] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounced = useDebouncedValue(term.trim(), DEBOUNCE_MS);

  // Render-time reset instead of an effect: opening the palette must start
  // clean, and an effect would paint the previous query for one frame.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTerm('');
      setCursor(0);
    }
  }

  const search = useQuery({
    queryKey: ['admin-search', debounced],
    queryFn: () => adminSearch(debounced),
    enabled: open && debounced.length >= MIN_QUERY,
    staleTime: 30_000,
  });

  const rows = useMemo(() => toRows(search.data), [search.data]);

  // A new query means a new list, so the highlight goes back to the top.
  // Adjusted during render rather than in an effect: an effect would paint one
  // frame with the highlight on a row from the previous search.
  const [lastQuery, setLastQuery] = useState(debounced);
  if (debounced !== lastQuery) {
    setLastQuery(debounced);
    setCursor(0);
  }

  // Results can shrink between renders, so never index past the end.
  const activeIndex = rows.length > 0 ? Math.min(cursor, rows.length - 1) : 0;
  const activeId = rows[activeIndex] ? `palette-row-${rows[activeIndex].key}` : undefined;

  // Arrow keys move a highlight that can sit below the fold; without this the
  // selection is invisible and Enter opens something the user cannot see.
  useEffect(() => {
    if (!activeId) return;
    listRef.current
      ?.querySelector(`#${CSS.escape(activeId)}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (rows.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((c) => (c + 1) % rows.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((c) => (c - 1 + rows.length) % rows.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const row = rows[Math.min(cursor, rows.length - 1)];
        if (row) {
          onNavigate(row.target);
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, rows, cursor, onClose, onNavigate]);

  if (!open) return null;

  const tooShort = debounced.length > 0 && debounced.length < MIN_QUERY;
  const scopes = search.data?.granted_scopes ?? [];
  let cursorOffset = -1;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10dvh]">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Qidiruv"
        className="relative flex max-h-[70dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-mc-lg border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]"
      >
        {/* The focus ring lives on this row, not on the input.
            `index.css` draws `*:focus-visible` as a 2px brand outline, which is
            right for a button and wrong for a borderless full-width field: it
            boxed the whole header cell. Moving the indicator to the row's
            bottom border keeps keyboard focus visible — the thing the global
            rule exists for — without the box. */}
        <div className="flex shrink-0 items-center gap-2.5 border-b-2 border-mc-border px-4 transition-colors focus-within:border-mc-brand">
          <Search className="h-4 w-4 shrink-0 text-mc-text-3" strokeWidth={2.2} />
          <input
            ref={inputRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Mijoz, reys, trek kod yoki telefon"
            // 16px floor: anything smaller makes iOS Safari zoom on focus and
            // it does not zoom back.
            role="combobox"
            aria-expanded
            aria-controls="palette-results"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            className="min-w-0 flex-1 bg-transparent py-4 text-[16px] font-medium text-mc-text outline-none placeholder:text-mc-text-3 focus-visible:outline-none"
          />
          {search.isFetching && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-mc-text-3" />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-3 transition-transform active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={listRef}
          id="palette-results"
          role="listbox"
          aria-label="Qidiruv natijalari"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
        >
          {debounced.length < MIN_QUERY ? (
            <p className="px-3 py-8 text-center text-[12px] font-medium text-mc-text-3">
              {tooShort
                ? `Kamida ${MIN_QUERY} ta belgi kiriting`
                : 'Mijoz kodi, ismi, telefoni, reys nomi yoki trek kodini yozing'}
            </p>
          ) : search.isError ? (
            <div className="px-3 py-8 text-center">
              <p className="text-[12px] font-semibold text-mc-text-3">Qidiruv ishlamadi</p>
              <button
                type="button"
                onClick={() => void search.refetch()}
                className="mt-1 text-[11px] font-bold text-mc-brand active:scale-95"
              >
                Qayta urinish
              </button>
            </div>
          ) : rows.length === 0 && !search.isLoading ? (
            <div className="px-3 py-8 text-center">
              <p className="text-[12px] font-medium text-mc-text-3">Hech narsa topilmadi</p>
              {scopes.length > 0 && scopes.length < 3 && (
                // Not every empty group means "no such record" — say which
                // domains were actually searched.
                <p className="mt-1 text-[11px] font-medium text-mc-text-3">
                  Faqat quyidagilar bo‘yicha qidirildi: {scopes.join(', ')}
                </p>
              )}
            </div>
          ) : (
            groupRows(rows).map(([group, items]) => (
              <div key={group} className="mb-2 last:mb-0">
                <p className="flex items-center gap-2 px-3 pb-1.5 pt-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-mc-text-3">
                  {group}
                  <span className="rounded-full bg-mc-surface-2 px-1.5 py-0.5 tabular-nums">
                    {items.length}
                  </span>
                  <span className="h-px flex-1 bg-mc-border" aria-hidden="true" />
                </p>
                {items.map((row) => {
                  cursorOffset += 1;
                  const isActive = cursorOffset === activeIndex;
                  const Icon = row.icon;
                  return (
                    <button
                      key={row.key}
                      id={`palette-row-${row.key}`}
                      role="option"
                      aria-selected={isActive}
                      type="button"
                      onMouseEnter={() => setCursor(rows.indexOf(row))}
                      onClick={() => {
                        triggerSoftHaptic();
                        onNavigate(row.target);
                        onClose();
                      }}
                      className={`relative flex min-h-[48px] w-full items-center gap-3 rounded-mc-md px-3 py-2 text-left transition-colors ${
                        isActive ? 'bg-mc-surface-2' : ''
                      }`}
                    >
                      {/* A rail rather than a wash: at a glance it says which
                          row Enter will open, without recolouring its text. */}
                      <span
                        className={`absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full transition-opacity ${
                          isActive ? 'bg-mc-brand opacity-100' : 'opacity-0'
                        }`}
                        aria-hidden="true"
                      />
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-mc-sm transition-colors ${
                          isActive ? 'bg-mc-brand-soft text-mc-brand' : 'bg-mc-surface-2 text-mc-text-3'
                        }`}
                        aria-hidden="true"
                      >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-[13px] font-bold ${
                            isActive ? 'text-mc-brand' : 'text-mc-text'
                          }`}
                        >
                          {row.title}
                        </span>
                        {row.meta && (
                          <span className="block truncate text-[11px] font-medium text-mc-text-3">
                            {row.meta}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-mc-border px-4 py-2 text-[10px] font-semibold text-mc-text-3">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-mc-border bg-mc-surface-2 px-1">↑</kbd>
            <kbd className="rounded border border-mc-border bg-mc-surface-2 px-1">↓</kbd>
            tanlash
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-mc-border bg-mc-surface-2 px-1">↵</kbd>
            ochish
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-mc-border bg-mc-surface-2 px-1">esc</kbd>
            yopish
          </span>
          {search.data?.truncated && (
            // Never a silent cut: a reader who does not find their record has
            // to know the list was shortened before concluding it is missing.
            <span className="ml-auto text-mc-warn">natijalar qisqartirildi</span>
          )}
        </div>
      </div>
    </div>
  );
}

function groupRows(rows: Row[]): [string, Row[]][] {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.group);
    if (bucket) bucket.push(row);
    else grouped.set(row.group, [row]);
  }
  return [...grouped.entries()];
}
