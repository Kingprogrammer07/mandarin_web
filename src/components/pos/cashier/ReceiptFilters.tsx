/**
 * Filters for the receipt queue, carried over from the old console.
 *
 * The full set the endpoint supports, minus `source` — that is what the two
 * tabs above are, and a second control for it would let the cashier put the
 * filter and the tab into disagreement.
 *
 * `strict` is labelled "aniq moslik" because that is what it does: with it off
 * the backend matches the client code and flight with `LIKE %…%`, with it on
 * with `=` (pos_notification.py:119-127). Calling it anything vaguer would
 * leave the cashier guessing why "M26" stopped matching M265.
 *
 * Collapsed by default and marked with a dot when something is set, so a filter
 * left on from yesterday cannot quietly explain an empty queue.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';

import type { NotificationFilters } from '@/api/services/posNotificationService';
import { triggerSoftHaptic } from '@/utils/haptics';

const STATUS_OPTIONS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: 'Barchasi' },
  { value: 'pending', label: 'To‘lanmagan' },
  { value: 'partial', label: 'Qisman' },
  { value: 'paid', label: 'To‘langan' },
  { value: 'rejected', label: 'Rad etilgan' },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'created_desc', label: 'Avval yangilari' },
  { value: 'created_asc', label: 'Avval eskilari' },
  { value: 'status_asc', label: 'Holat bo‘yicha' },
  { value: 'amount_desc', label: 'Katta summadan' },
];

/* 16px on every control: below that iOS zooms the page on focus and does not
   zoom back, leaving the whole till magnified. */
const FIELD =
  'h-11 w-full rounded-mc-sm border border-mc-border bg-mc-surface px-2.5 text-[16px] font-semibold text-mc-text outline-none focus:border-mc-brand';
const LABEL =
  'mb-1 block text-[10px] font-bold uppercase tracking-[0.06em] text-mc-text-2';

/**
 * How many filters the cashier has actually CHANGED.
 *
 * Counted against the window the screen opened with, not against "empty". The
 * default range is yesterday-to-today, so counting a set date as active made
 * the badge read "2" before anyone had touched anything — and a badge that is
 * lit by default tells the cashier nothing when it lights for a real reason.
 */
function countActive(
  filters: NotificationFilters,
  defaults: NotificationFilters,
): number {
  const changed = (
    key: keyof NotificationFilters,
  ): boolean => (filters[key] ?? undefined) !== (defaults[key] ?? undefined);

  return (
    [
      'status',
      'flight',
      'client_code',
      'date_from',
      'date_to',
      'time_from',
      'time_to',
      'strict',
    ] as (keyof NotificationFilters)[]
  ).filter(changed).length;
}

export function ReceiptFilters({
  filters,
  defaultFilters,
  onChange,
  onReset,
}: {
  filters: NotificationFilters;
  /** What the screen opened with — the baseline "unfiltered" means. */
  defaultFilters: NotificationFilters;
  onChange: (next: NotificationFilters) => void;
  onReset: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = countActive(filters, defaultFilters);

  const set = (patch: Partial<NotificationFilters>) =>
    onChange({ ...filters, ...patch });

  /**
   * Trimmed, not just tested for emptiness.
   *
   * The old version guarded on `value.trim()` and then sent the RAW value, so a
   * code pasted out of Telegram with a trailing space became
   * `LIKE '%M265 %'` — which matches nothing, since stored codes carry no
   * space. With `strict` on the `=` fails the same way. The cashier sees an
   * empty queue and no reason for it.
   */
  const setText = (key: 'client_code' | 'flight', value: string) => {
    const trimmed = value.trim();
    set({ [key]: trimmed || undefined });
  };

  return (
    <div className="shrink-0 border-b border-mc-border">
      {/*
        The reset is a SIBLING of the toggle, never nested inside it: a <button>
        within a <button> is invalid HTML, and the browser's parser closes the
        outer one early — the two end up as siblings anyway, with the layout
        broken and a hydration error logged.
      */}
      <div className="flex items-center gap-1 px-3">
        <button
          type="button"
          onClick={() => {
            triggerSoftHaptic();
            setIsOpen((prev) => !prev);
          }}
          aria-expanded={isOpen}
          className="flex min-h-[44px] flex-1 items-center gap-2 text-left"
        >
          <SlidersHorizontal
            className="h-3.5 w-3.5 shrink-0 text-mc-text-2"
            strokeWidth={2.2}
            aria-hidden="true"
          />
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-mc-text-2">
            Filtr
          </span>
          {activeCount > 0 && (
            <span className="rounded-full bg-mc-brand px-1.5 text-[10px] font-extrabold tabular-nums text-mc-on-brand">
              {activeCount}
            </span>
          )}
          <ChevronDown
            className={`ml-auto h-4 w-4 shrink-0 text-mc-text-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            strokeWidth={2.2}
            aria-hidden="true"
          />
        </button>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => {
              triggerSoftHaptic();
              onReset();
            }}
            className="flex min-h-[44px] items-center gap-1 px-1.5 text-[11px] font-bold text-mc-brand active:scale-95"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
            Tozalash
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* No max-height and no scroll of its own: this panel now sits
                INSIDE the queue's single scroll region, so a second scroll
                context here would trap the wheel and hide its own overflow. */}
            <div className="space-y-2.5 px-3 pb-3">
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map(({ value, label }) => {
                  const isActive = (filters.status ?? undefined) === value;
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        triggerSoftHaptic();
                        set({ status: value });
                      }}
                      className={`h-9 rounded-full border px-2.5 text-[11px] font-bold transition-colors ${
                        isActive
                          ? 'border-mc-brand bg-mc-brand-soft text-mc-brand'
                          : 'border-mc-border bg-mc-surface text-mc-text-2'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className={LABEL}>Mijoz kodi</span>
                  <input
                    value={filters.client_code ?? ''}
                    onChange={(event) => setText('client_code', event.target.value)}
                    placeholder="M265"
                    autoComplete="off"
                    className={FIELD}
                  />
                </label>
                <label>
                  <span className={LABEL}>Reys</span>
                  <input
                    value={filters.flight ?? ''}
                    onChange={(event) => setText('flight', event.target.value)}
                    placeholder="MRX-118"
                    autoComplete="off"
                    className={FIELD}
                  />
                </label>
              </div>

              {/* One per row on a phone. A native date field has a fixed
                  intrinsic width (~139px) that no CSS shrinks, and half of this
                  panel at 320px is 116px — the field would render its own
                  dd.mm.yyyy clipped. Two columns again from `sm`, where the
                  queue is wide enough for them. */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label>
                  <span className={LABEL}>Sanadan</span>
                  <input
                    type="date"
                    value={filters.date_from ?? ''}
                    max={filters.date_to || undefined}
                    onChange={(event) =>
                      set({
                        date_from: event.target.value || undefined,
                        // The time bound is meaningless without its date, and a
                        // stale one would keep the "filters active" badge lit.
                        ...(event.target.value ? {} : { time_from: undefined }),
                      })
                    }
                    className={FIELD}
                  />
                </label>
                <label>
                  <span className={LABEL}>Sanagacha</span>
                  <input
                    type="date"
                    value={filters.date_to ?? ''}
                    min={filters.date_from || undefined}
                    onChange={(event) =>
                      set({
                        date_to: event.target.value || undefined,
                        ...(event.target.value ? {} : { time_to: undefined }),
                      })
                    }
                    className={FIELD}
                  />
                </label>
              </div>

              {/* Stacked with their dates on a phone, for the same reason: a
                  time field's intrinsic width depends on the browser locale
                  (a 12-hour one adds an AM/PM segment) and it too cannot be
                  shrunk below it. */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {/*
                  Disabled until the matching date is set, because that is what
                  the API actually does: the router reads `time_from` only
                  inside `if date_from:` and `time_to` only inside `if date_to:`
                  (pos_notifications.py:903). Left enabled, the cashier clears
                  the dates, sets 14:00, gets every record back unfiltered, and
                  has a filled-in field telling them otherwise.
                */}
                <label>
                  <span className={LABEL}>Vaqtdan</span>
                  <input
                    type="time"
                    value={filters.time_from ?? ''}
                    disabled={!filters.date_from}
                    title={
                      filters.date_from
                        ? undefined
                        : 'Avval “Sanadan” ni tanlang'
                    }
                    onChange={(event) =>
                      set({ time_from: event.target.value || undefined })
                    }
                    className={`${FIELD} disabled:opacity-40`}
                  />
                </label>
                <label>
                  <span className={LABEL}>Vaqtgacha</span>
                  <input
                    type="time"
                    value={filters.time_to ?? ''}
                    disabled={!filters.date_to}
                    title={
                      filters.date_to ? undefined : 'Avval “Sanagacha” ni tanlang'
                    }
                    onChange={(event) =>
                      set({ time_to: event.target.value || undefined })
                    }
                    className={`${FIELD} disabled:opacity-40`}
                  />
                </label>
              </div>

              <label>
                <span className={LABEL}>Tartib</span>
                <select
                  value={filters.sort ?? 'created_desc'}
                  onChange={(event) => set({ sort: event.target.value })}
                  className={FIELD}
                >
                  {SORT_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                role="switch"
                aria-checked={Boolean(filters.strict)}
                onClick={() => {
                  triggerSoftHaptic();
                  set({ strict: !filters.strict });
                }}
                className={`flex min-h-[44px] w-full items-center gap-2 rounded-mc-sm border px-2.5 text-left transition-colors ${
                  filters.strict
                    ? 'border-mc-brand/30 bg-mc-brand-soft'
                    : 'border-mc-border bg-mc-surface'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold text-mc-text">
                    Aniq moslik
                  </span>
                  <span className="block text-[10px] font-semibold text-mc-text-2">
                    Yoqilmasa “M26” — M265 ni ham topadi
                  </span>
                </span>
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    filters.strict ? 'bg-mc-brand' : 'bg-mc-border'
                  }`}
                  aria-hidden="true"
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#FFFFFF] shadow-sm transition-transform ${
                      filters.strict ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
