/**
 * Period control for the cashier screen.
 *
 * Four shortcuts plus a custom range, and one selection drives both the cards
 * and their sparklines — the cashier should never be able to read a total for
 * one window next to a chart for another.
 *
 * Defaults to today, which the API resolves to hourly buckets.
 */

import { CalendarDays } from 'lucide-react';

import { triggerSoftHaptic } from '@/utils/haptics';

import {
  PERIOD_SHORTCUTS,
  rangeFromDays,
  resolvePeriod,
  type PeriodKey,
  type PeriodRange,
} from './periods';

export function PeriodPicker({
  activeKey,
  range,
  onChange,
}: {
  activeKey: PeriodKey;
  range: PeriodRange;
  onChange: (key: PeriodKey, range: PeriodRange) => void;
}) {
  const firstDay = range.from.slice(0, 10);
  const lastDay = range.to.slice(0, 10);

  const setCustom = (from: string, to: string) => {
    // Kept in order whichever field the cashier edits: picking an end before
    // the start would otherwise send a range the API rejects with a 422, and
    // the screen would show an error for what is a normal way to use two date
    // fields.
    const [a, b] = from <= to ? [from, to] : [to, from];
    onChange('custom', rangeFromDays(a, b));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {PERIOD_SHORTCUTS.map(({ key, label }) => {
          const isActive = activeKey === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                triggerSoftHaptic();
                onChange(key, resolvePeriod(key));
              }}
              className={`h-11 rounded-mc-sm border px-3.5 text-[12px] font-bold transition-colors ${
                isActive
                  ? 'border-mc-brand bg-mc-brand-soft text-mc-brand'
                  : 'border-mc-border bg-mc-surface-2 text-mc-text-2'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Full width on a phone, natural width from `sm` up — at 360px the two
          fixed-width date fields plus the icon and dash overflowed the viewport
          by 4px, which is a horizontal scrollbar across the whole till. Desktop
          is untouched: everything below only widens at `sm`. */}
      <span className="flex w-full items-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface-2 px-2 sm:w-auto">
        <CalendarDays
          className="h-4 w-4 shrink-0 text-mc-text-3"
          strokeWidth={2}
          aria-hidden="true"
        />
        {/* 16px: below that iOS zooms the page on focus and does not zoom back. */}
        <input
          type="date"
          value={firstDay}
          max={lastDay}
          aria-label="Boshlanish sanasi"
          onChange={(event) => setCustom(event.target.value, lastDay)}
          className="h-11 min-w-0 flex-1 bg-transparent text-[16px] font-medium text-mc-text outline-none sm:w-[150px] sm:flex-none"
        />
        <span className="text-mc-text-3" aria-hidden="true">
          —
        </span>
        <input
          type="date"
          value={lastDay}
          min={firstDay}
          aria-label="Tugash sanasi"
          onChange={(event) => setCustom(firstDay, event.target.value)}
          className="h-11 min-w-0 flex-1 bg-transparent text-[16px] font-medium text-mc-text outline-none sm:w-[150px] sm:flex-none"
        />
      </span>

    </div>
  );
}
