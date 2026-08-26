import { useEffect, useSyncExternalStore } from 'react';

import {
  getPendingExternalOrders,
  prunePendingExternalOrders,
  subscribePendingNbuOrders,
  type NbuReturnKind,
  type PendingNbuOrder,
} from '@/utils/nbuReturnContext';

/**
 * NBU orders opened in Telegram's in-app browser and not yet settled.
 *
 * A pay button reads this to lock itself. The gateway no longer replaces the
 * Mini App, so the screen that started a payment is still mounted when the user
 * comes back from the bank — and a second tap minted a second full-amount
 * session for the same flight. The backend only rejects a duplicate once the
 * local row reads `paid`, and its sweeper waits 60s, so the whole window
 * between paying and settling was open. The surplus lands in the wallet rather
 * than being refunded.
 *
 * Lives apart from `NbuPaymentWatch` because a module exporting both a
 * component and a plain value opts out of React Fast Refresh.
 */

/**
 * `useSyncExternalStore` re-renders forever unless `getSnapshot` returns the
 * same reference between real changes, and the getter builds a fresh array on
 * every call — so it is cached and swapped only when the contents differ.
 */
let cachedOrders: PendingNbuOrder[] = [];

function pendingSnapshot(): PendingNbuOrder[] {
  const next = getPendingExternalOrders();
  const unchanged =
    next.length === cachedOrders.length &&
    next.every((entry, i) => entry.orderId === cachedOrders[i]?.orderId);
  if (!unchanged) cachedOrders = next;
  return cachedOrders;
}

/** Every unsettled gateway session, oldest first. */
export function usePendingNbuOrders(): PendingNbuOrder[] {
  const orders = useSyncExternalStore(
    subscribePendingNbuOrders,
    pendingSnapshot,
    () => cachedOrders,
  );

  // The getter is pure so it can be called during render; the writing half runs
  // here, where a resulting notify cannot re-enter the render it came from.
  useEffect(() => {
    prunePendingExternalOrders();
  }, [orders]);

  return orders;
}

/**
 * Is a session of this kind open?
 *
 * Scoped by kind on purpose: an abandoned zero-value CARD BINDING must not
 * block a client from paying a flight debt.
 */
export function useNbuSessionOpen(kind: NbuReturnKind): boolean {
  return usePendingNbuOrders().some((entry) => entry.kind === kind);
}
