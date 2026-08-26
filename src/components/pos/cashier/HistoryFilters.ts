/**
 * Filter vocabulary for the confirmed-payments history table.
 *
 * Kept out of the component file so the table can stay a component-only module:
 * a module that exports both a component and a plain value breaks Fast Refresh,
 * and the pre-push check rejects the branch that introduces one.
 */

import type { CashierLogProvider, CashierLogSource } from '@/api/pos';

/**
 * The provider chips, in the order the counter thinks about them.
 *
 * `online` is a real stored value distinct from `click`/`payme`/`card` — it is
 * what a Mini App payment is recorded as when the client did not say which
 * rail they used — so it gets its own chip rather than being folded in.
 *
 * `wallet` is here because the history table is a ledger and wallet
 * corrections are ledger rows. It is deliberately absent from the takings
 * cards above, where a signed correction would make the row disagree with the
 * day's cash.
 */
export const PROVIDER_FILTERS: {
  value: CashierLogProvider | 'all';
  label: string;
}[] = [
  { value: 'all', label: 'Barchasi' },
  { value: 'cash', label: 'Naqd' },
  { value: 'card', label: 'Karta' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'click', label: 'Click' },
  { value: 'payme', label: 'Payme' },
  { value: 'nbu', label: 'NBU' },
  { value: 'online', label: 'Onlayn' },
  { value: 'wallet', label: 'Hamyon' },
];

/** What the payment was for. `uzpost` covers every courier, not only UzPost. */
export const SOURCE_FILTERS: {
  value: CashierLogSource | 'all';
  label: string;
}[] = [
  { value: 'all', label: 'Barcha yo‘nalishlar' },
  { value: 'flight', label: 'Reys to‘lovi' },
  { value: 'uzpost', label: 'Yetkazib berish' },
];

/** Tint per provider, so a row is scannable without reading the word. */
export const PROVIDER_CHIP_TONE: Record<string, string> = {
  cash: 'border-mc-success/25 bg-mc-success/12 text-mc-success',
  card: 'border-mc-brand/25 bg-mc-brand-soft text-mc-brand',
  terminal: 'border-mc-brand/25 bg-mc-brand-soft text-mc-brand',
  click: 'border-mc-success/25 bg-mc-success/12 text-mc-success',
  payme: 'border-mc-brand/25 bg-mc-brand-soft text-mc-brand',
  nbu: 'border-mc-success/25 bg-mc-success/12 text-mc-success',
  online: 'border-mc-brand/25 bg-mc-brand-soft text-mc-brand',
  wallet: 'border-mc-warn/25 bg-mc-warn-soft text-mc-warn',
  uzpost: 'border-mc-border bg-mc-surface-2 text-mc-text-2',
};

export const PROVIDER_LABEL: Record<string, string> = {
  cash: 'NAQD',
  card: 'KARTA',
  terminal: 'TERMINAL',
  click: 'CLICK',
  payme: 'PAYME',
  nbu: 'NBU',
  online: 'ONLAYN',
  wallet: 'HAMYON',
  uzpost: 'YETKAZISH',
};

/**
 * Filter the loaded page by client code or cashier name.
 *
 * Deliberately client-side and deliberately scoped to the page on screen: the
 * API has no text-search parameter, and a box that silently searched only the
 * current twenty rows while looking like it searched everything would be worse
 * than no box. The label above it says which it is.
 */
export function matchesQuery(
  row: { client_code: string | null; cashier_name: string | null; flight: string | null },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.client_code, row.cashier_name, row.flight].some(
    (field) => field != null && field.toLowerCase().includes(needle),
  );
}

/**
 * Page numbers to render, with gaps collapsed.
 *
 * Always shows the first page, the last page and the neighbours of the current
 * one; everything else becomes a single ellipsis. A raw 1..N row is unusable
 * once the log has a few hundred pages, which it does — and it wraps onto three
 * lines long before that.
 */
export function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const wanted = new Set<number>([1, total, current, current - 1, current + 1]);
  const pages = [...wanted]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  const out: (number | 'gap')[] = [];
  let previous = 0;
  for (const page of pages) {
    // A gap of exactly one page would render "1 … 3" — wider than "1 2 3" and
    // one click poorer, so the missing page is emitted instead.
    if (previous && page - previous === 2) out.push(previous + 1);
    else if (previous && page - previous > 2) out.push('gap');
    out.push(page);
    previous = page;
  }
  return out;
}
