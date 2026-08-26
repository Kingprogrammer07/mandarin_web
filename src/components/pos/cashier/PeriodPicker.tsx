/**
 * Period control for the cashier screen.
 *
 * Four shortcuts plus a custom range, and one selection drives both the cards
 * and their sparklines — the cashier should never be able to read a total for
 * one window next to a chart for another.
 *
 * Defaults to today, which the API resolves to hourly buckets.
 */

import { useId, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';

import { triggerSoftHaptic } from '@/utils/haptics';

import {
  describeRange,
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

  /**
   * Whether the explicit range is showing — a phone-only question.
   *
   * From `sm` up the pair is always inline and this state is never read: the
   * panel carries `sm:flex`, so a collapsed picker on a phone that is then
   * rotated (or a desktop window narrowed and widened again) still shows the
   * fields at the width where they fit.
   */
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const rangePanelId = useId();
  const isCustomRange = activeKey === 'custom';

  const setCustom = (from: string, to: string) => {
    // Kept in order whichever field the cashier edits: picking an end before
    // the start would otherwise send a range the API rejects with a 422, and
    // the screen would show an error for what is a normal way to use two date
    // fields.
    const [a, b] = from <= to ? [from, to] : [to, from];
    onChange('custom', rangeFromDays(a, b));
  };

  return (
    /*
      `w-full` on a phone, `w-auto` from `sm` up.

      The control is a flex item of the section's title row. Left at `auto` its
      base size is max-content — the two date fields' intrinsic width — so it
      demanded 342px inside a 264px card and everything above it was clipped;
      the page itself never scrolled sideways, because an ancestor cut it off.
      A definite `100%` is what lets the wrapping below actually happen.
    */
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      {/* One row of four on a phone: a wrapped flex row left "30 kun" stranded
          alone on a second line. From `sm` up it is the flex row it always was,
          with the padding it always had. */}
      <div className="grid w-full grid-cols-4 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
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
              className={`h-11 rounded-mc-sm border px-2 text-[12px] font-bold transition-colors sm:px-3.5 ${
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

      {/*
        On a phone the explicit range is secondary and opens on demand.

        Two native date inputs cannot share a 320px line: the platform fixes
        their intrinsic width at ~139px each, and the 16px floor (iOS zooms the
        page on focus below it and never zooms back) forbids shrinking the type
        to fit. So below `sm` they stack behind this disclosure, and the four
        presets — which cover the day-to-day — keep the row they had.

        The button is `sm:hidden`, and the panel is `sm:flex`, so from `sm` up
        the control is exactly what it was: one inline row, always visible.
      */}
      <button
        type="button"
        onClick={() => {
          triggerSoftHaptic();
          setIsRangeOpen((previous) => !previous);
        }}
        aria-expanded={isRangeOpen}
        aria-controls={rangePanelId}
        className={`flex h-11 w-full items-center justify-center gap-1.5 rounded-mc-sm border px-3 text-[12px] font-bold transition-colors sm:hidden ${
          isCustomRange
            ? 'border-mc-brand bg-mc-brand-soft text-mc-brand'
            : 'border-mc-border bg-mc-surface-2 text-mc-text-2'
        }`}
      >
        <CalendarDays className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        {/* The chosen range stays legible while collapsed — otherwise a custom
            window would be in force with nothing on the button saying which. */}
        <span className="truncate">
          {isCustomRange ? describeRange(range.from, range.to) : 'Boshqa sana'}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${isRangeOpen ? 'rotate-180' : ''}`}
          strokeWidth={2.2}
          aria-hidden="true"
        />
      </button>

      <span
        id={rangePanelId}
        className={`w-full flex-col gap-1 rounded-mc-sm border border-mc-border bg-mc-surface-2 px-2 py-1 sm:flex sm:w-auto sm:flex-row sm:items-center sm:gap-1.5 sm:py-0 ${
          isRangeOpen ? 'flex' : 'hidden'
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
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
        </span>

        <span className="hidden text-mc-text-3 sm:inline" aria-hidden="true">
          —
        </span>

        <span className="flex min-w-0 items-center gap-1.5">
          {/* Holds the second field on the same left edge as the first, under
              the icon, once the pair is stacked. */}
          <span
            className="w-4 shrink-0 text-center text-[13px] font-bold text-mc-text-3 sm:hidden"
            aria-hidden="true"
          >
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
      </span>
    </div>
  );
}
