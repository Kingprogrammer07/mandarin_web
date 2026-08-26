/**
 * The two receipt queues.
 *
 * Kept out of the component file because a module exporting both components and
 * plain values breaks Fast Refresh — React cannot tell which half changed and
 * reloads the whole page, losing the cashier's place in the queue.
 *
 * "Zayavka", not "UzPost": the cashier log labels every delivery payment
 * `uzpost` even when the courier was BTS, Yandex or Mandarin, and 55% of
 * delivery requests are not UzPost. The database calls this `zayafka`
 * (`pos_notifications.source`) and so does the tab.
 */

export type ReceiptTab = 'flight' | 'zayafka';

export const RECEIPT_TABS: { key: ReceiptTab; label: string }[] = [
  { key: 'flight', label: 'Reys' },
  { key: 'zayafka', label: 'Zayavka' },
];

/**
 * Receipts per page.
 *
 * Three by default: each card carries a status chip, a receipt badge and two
 * decision buttons, so three fill the column without scrolling and the cashier
 * can act on all of them from one screen. The larger sizes are there for a busy
 * day, and the choice is remembered per browser.
 */
export const PER_PAGE_OPTIONS = [3, 5, 10, 20] as const;
export const DEFAULT_PER_PAGE = 3;
