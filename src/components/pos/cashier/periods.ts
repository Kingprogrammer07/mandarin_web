/**
 * Period selection for the cashier screen.
 *
 * Every window is built from Tashkent calendar days, never from the browser's
 * clock: a cashier's "bugun" ends at midnight in Tashkent, and a counter PC
 * with a wrong system timezone would otherwise scope the day — and therefore
 * the till total — to the wrong hours.
 *
 * The default is today, which the API resolves to 24 hourly buckets. A day
 * drawn as a single bar is not a chart; what a cashier wants to know about
 * today is when in it the money arrived.
 */

export type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export interface PeriodRange {
  /** Inclusive UTC instants, which is what the API filters on. */
  from: string;
  to: string;
}

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Today's date in Tashkent, as `YYYY-MM-DD`. */
export function tashkentToday(now: Date = new Date()): string {
  return new Date(now.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Turn Tashkent calendar days into the UTC instants the API expects. */
export function rangeFromDays(firstDay: string, lastDay: string): PeriodRange {
  return {
    from: `${firstDay}T00:00:00+05:00`,
    to: `${lastDay}T23:59:59+05:00`,
  };
}

function shiftDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export const PERIOD_SHORTCUTS: { key: Exclude<PeriodKey, 'custom'>; label: string }[] = [
  { key: 'today', label: 'Bugun' },
  { key: 'yesterday', label: 'Kecha' },
  { key: 'week', label: '7 kun' },
  { key: 'month', label: '30 kun' },
];

/**
 * Resolve a shortcut into a concrete range.
 *
 * "7 kun" counts back six days and includes today — seven days of takings, not
 * eight. Off-by-one here is invisible on screen and wrong in the total.
 */
export function resolvePeriod(key: Exclude<PeriodKey, 'custom'>, now?: Date): PeriodRange {
  const today = tashkentToday(now);
  switch (key) {
    case 'today':
      return rangeFromDays(today, today);
    case 'yesterday': {
      const day = shiftDays(today, -1);
      return rangeFromDays(day, day);
    }
    case 'week':
      return rangeFromDays(shiftDays(today, -6), today);
    case 'month':
      return rangeFromDays(shiftDays(today, -29), today);
  }
}

/** Human label for the range currently in force. */
export function describeRange(from: string, to: string): string {
  const firstDay = from.slice(0, 10);
  const lastDay = to.slice(0, 10);
  const pretty = (day: string) => day.split('-').reverse().join('.');
  return firstDay === lastDay ? pretty(firstDay) : `${pretty(firstDay)} — ${pretty(lastDay)}`;
}
