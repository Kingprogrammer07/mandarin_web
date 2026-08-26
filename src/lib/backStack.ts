/**
 * One place where "back" is resolved.
 *
 * The client side has four layers of navigation and only one of them lives in
 * `window.history`:
 *
 *   1. modals, sheets, lightboxes and the in-app camera — local `useState`
 *   2. in-page views that replace the screen (`UserHome.fullView`, `UserPage.view`)
 *   3. multi-step wizards (`DeliveryRequestPage.currentStep`, MakePaymentModal)
 *   4. the router in `App.tsx`, which is the only one `history.back()` can reach
 *
 * Telegram's system back button gives us a single press with no notion of any
 * of that, so every layer registers a handler here through `useBackHandler`
 * and a press walks them from the top down. The router is the floor: it is
 * consulted only after every registered handler has declined.
 *
 * Deliberately framework-free — no React import — so it can be unit-tested
 * without a renderer and so `TelegramBackBridge` is the only component that
 * ever touches the Telegram API.
 */

import { triggerSoftHaptic } from '@/utils/haptics';

/** `true` means "I handled this press"; `false` passes it to the next layer. */
export type BackHandler = () => boolean;

/**
 * Checked highest-first, so ordering never depends on the order React happens
 * to run effects in. Within one priority the most recently registered wins,
 * which is what you want for two modals of the same kind stacked on each other.
 */
export const BackPriority = {
  /** An in-page view that replaced the screen but is not a router page. */
  VIEW: 10,
  /** A modal, bottom sheet or drawer. */
  MODAL: 20,
  /** Something on top of a modal: a lightbox, a confirm, the camera. */
  OVERLAY: 30,
} as const;

export type BackPriorityValue = (typeof BackPriority)[keyof typeof BackPriority];

interface Entry {
  id: number;
  priority: number;
  /** Registration order, to break ties within a priority. */
  seq: number;
  handler: BackHandler;
}

let nextId = 1;
let nextSeq = 1;
let entries: Entry[] = [];
let routerDepth = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Register a handler. Returns the unregister function.
 *
 * Prefer the `useBackHandler` hook; this is the primitive it is built on and
 * the seam the tests use.
 */
export function pushBackHandler(
  handler: BackHandler,
  priority: number = BackPriority.MODAL,
): () => void {
  const entry: Entry = { id: nextId++, priority, seq: nextSeq++, handler };
  entries.push(entry);
  notify();

  return () => {
    const before = entries.length;
    entries = entries.filter((candidate) => candidate.id !== entry.id);
    if (entries.length !== before) notify();
  };
}

/** Highest priority first, then most recently registered. */
function ordered(): Entry[] {
  return [...entries].sort((a, b) =>
    a.priority !== b.priority ? b.priority - a.priority : b.seq - a.seq,
  );
}

/**
 * How deep the router is on top of the entry route.
 *
 * Published by `App.tsx` from its `pushDepthRef`, because a ref cannot notify
 * React and the Telegram back button has to appear and disappear with it.
 */
export function setRouterDepth(depth: number): void {
  const next = Math.max(0, depth);
  if (next === routerDepth) return;
  routerDepth = next;
  notify();
}

export function getRouterDepth(): number {
  return routerDepth;
}

/**
 * Is there anywhere to go back to?
 *
 * Drives `BackButton.show()` / `.hide()`. When this is false the button is
 * hidden and Telegram's own default applies — at the root of the app that
 * default is "close the Mini App", which is the correct behaviour there.
 */
export function canGoBack(): boolean {
  return entries.length > 0 || routerDepth > 0;
}

export function subscribeBackStack(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Resolve one back press.
 *
 * The haptic fires here and nowhere else, and only once the press has actually
 * been consumed. `App.tsx`'s popstate listener is the *consequence* of a back,
 * not an entry point — buzzing there too would make every router-level press
 * vibrate twice.
 *
 * Returns true when the press was consumed by the app (so a caller may need to
 * suppress a default), false when there was nothing to go back to.
 */
export function runBack(): boolean {
  for (const entry of ordered()) {
    if (entry.handler()) {
      triggerSoftHaptic();
      return true;
    }
  }

  if (routerDepth > 0) {
    triggerSoftHaptic();
    window.history.back();
    return true;
  }

  // Nothing to go back to. Stay silent: the one press that should feel like
  // nothing is the one at the root that lets Telegram close the Mini App.
  return false;
}

/** Test seam — resets module state between specs. */
export function __resetBackStack(): void {
  entries = [];
  routerDepth = 0;
  listeners.clear();
  nextId = 1;
  nextSeq = 1;
}
