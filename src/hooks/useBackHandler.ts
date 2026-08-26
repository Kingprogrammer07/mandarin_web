import { useEffect, useRef } from 'react';

import {
  BackPriority,
  pushBackHandler,
  type BackHandler,
} from '@/lib/backStack';

/**
 * Claim the back press while `enabled` is true.
 *
 * Register one call per dismissable layer — an open modal, an in-page view, a
 * wizard step — and return `true` from the handler when you consumed the press.
 * Returning `false` passes it down to the next layer, and eventually to the
 * router.
 *
 *   useBackHandler(isOpen, () => { onClose(); return true; }, BackPriority.MODAL);
 *
 * The handler is held in a ref, so it always runs the current closure while the
 * registration itself churns only when `enabled` or `priority` changes. That
 * matters: re-registering on every render would reshuffle the stack order
 * underneath any layer that opened on top of this one.
 */
export function useBackHandler(
  enabled: boolean,
  handler: BackHandler,
  priority: number = BackPriority.MODAL,
): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;
    return pushBackHandler(() => handlerRef.current(), priority);
  }, [enabled, priority]);
}
