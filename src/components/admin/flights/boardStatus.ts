/**
 * Values shared by the Reyslar board's components.
 *
 * Kept out of the component files on purpose: a module that exports both
 * components and plain values breaks Fast Refresh — React cannot tell which
 * half changed and falls back to a full reload, losing the board's scroll and
 * filter state on every edit. ESLint reports it as an error and the repo's
 * pre-push ratchet blocks a push once the branch touches the file.
 */

import type { FlightDashboardItem } from '@/api/services/flightSchedule';
import { formatTashkentDateTime } from '@/lib/format';

export type BoardStatus = 'visible' | 'new' | 'archived';

/**
 * What the HOLAT column says.
 *
 * Switched on wins over everything else: it is the state the operator just
 * set, and showing a flight as "Yangi" while it is live on the board would
 * make the switch look broken.
 */
export function boardStatusOf(flight: FlightDashboardItem): BoardStatus {
  if (flight.is_visible) return 'visible';
  if (flight.status === 'new' || flight.is_new) return 'new';
  return 'archived';
}

export const BOARD_STATUS_FILTERS: { value: 'all' | BoardStatus; label: string }[] = [
  { value: 'all', label: 'Barcha holatlar' },
  { value: 'visible', label: 'Ko‘rinmoqda' },
  { value: 'new', label: 'Yangi' },
  { value: 'archived', label: 'Arxiv' },
];

/** "Oxirgi import: 24-avg 2026, 22:45", or a note that none has run. */
export function lastImportLabel(
  flight: FlightDashboardItem,
  language?: string,
): string {
  if (!flight.last_activity_at) return 'Import qilinmagan';
  return `Oxirgi import: ${formatTashkentDateTime(flight.last_activity_at, language)}`;
}

/**
 * Board order for the table.
 *
 * A flight that has never been placed sorts after every one that has, and keeps
 * the server's newest-first position among its own kind. `sort_order` is
 * nullable precisely so "never placed" and "placed first" stay distinguishable;
 * treating a missing value as 0 puts every untouched flight at the top.
 *
 * Without an explicit sort here the table re-rendered in the server's `newest`
 * order after each drag, so a dragged row snapped back and a save that had
 * actually succeeded looked like it had failed.
 */
export function compareBoardOrder(
  serverIndex: Map<string, number>,
): (a: FlightDashboardItem, b: FlightDashboardItem) => number {
  return (a, b) => {
    const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return (serverIndex.get(a.name) ?? 0) - (serverIndex.get(b.name) ?? 0);
  };
}
