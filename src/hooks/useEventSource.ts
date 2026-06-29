import { useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { API_BASE_URL } from "@/config/config";

export interface PosNotificationPayload {
  id: string;
  timestamp: string;
  clientCode: string;
  clientName: string;
  flightName: string;
  amountPaid: number;
  totalAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  paymentType: string;
  receiptImageUrl?: string | null;
  telegramMessageId?: number | null;
  telegramChatId?: number | null;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  /** @deprecated Legacy alias used by warehouse → cashier notifications. */
  amount?: number;
  /** @deprecated Legacy alias used by warehouse → cashier notifications. */
  currency?: string;
}

export interface CashierAckPayload {
  /** Client code the cashier opened from the notification. */
  clientCode: string;
  /** Flight name from the original POS_NOTIFY message. */
  flightName: string;
}

export type BroadcastMessage =
  | { type: "POS_NOTIFY"; payload: PosNotificationPayload }
  | { type: "CASHIER_ACK"; payload: CashierAckPayload };

/** Wire format — adds a deduplication ID so the same message is not
 *  processed twice when multiple channels deliver it simultaneously. */
type WireMessage = BroadcastMessage & { _id: string };

// Same-device fallbacks
const BC_CHANNEL_NAME = "pos_notifications";
const STORAGE_KEY = "pos_notification_last";

// Cap reconnect attempts so a persistent server error (expired token, server
// down, network blip during a long shift) cannot wedge an open tab into a
// 30-second reconnect cycle forever.
const MAX_RECONNECT_ATTEMPTS = 10;

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getAdminToken(): string | null {
  try {
    return localStorage.getItem("access_token");
  } catch {
    return null;
  }
}

function buildSseUrl(): string | null {
  const token = getAdminToken();
  if (!token) return null;
  const base = API_BASE_URL.replace(/\/$/, "");
  return `${base}/api/v1/pos/notifications/stream?access_token=${encodeURIComponent(token)}`;
}

// ─── Shared, ref-counted connection ────────────────────────────────────────────
// A single browser tab opens exactly ONE EventSource + BroadcastChannel for the
// POS stream, regardless of how many components call useEventSource (POSDashboard
// + usePaymentNotifications previously opened two separate connections receiving
// identical pushes). All consumers register a subscriber; the shared connection
// fans each message out to every subscriber, deduplicated once by `_id`.

type Subscriber = (msg: BroadcastMessage) => void;

const subscribers = new Set<Subscriber>();
const seenIds = new Set<string>();
let sharedES: EventSource | null = null;
let sharedBC: BroadcastChannel | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let refCount = 0;
let storageHandler: ((e: StorageEvent) => void) | null = null;
let visibilityHandler: (() => void) | null = null;

function dispatchShared(wire: WireMessage): void {
  if (!wire || !wire._id || seenIds.has(wire._id)) return;
  seenIds.add(wire._id);
  // Prevent unbounded growth — keep only the 50 most recent IDs.
  if (seenIds.size > 50) {
    const [oldest] = seenIds;
    seenIds.delete(oldest);
  }
  const { _id, ...msg } = wire;
  void _id;
  // Snapshot so a subscriber unsubscribing mid-dispatch can't break iteration.
  for (const sub of Array.from(subscribers)) {
    try {
      sub(msg as BroadcastMessage);
    } catch {
      // One faulty consumer must not stop delivery to the others.
    }
  }
}

function connectShared(): void {
  const url = buildSseUrl();
  if (!url) {
    if (import.meta.env.DEV) {
      console.debug("[POS] SSE: no admin token, skipping connection");
    }
    return;
  }

  if (sharedES) sharedES.close();

  const es = new EventSource(url);
  sharedES = es;

  es.onopen = () => {
    reconnectAttempt = 0;
    if (import.meta.env.DEV) console.debug("[POS] SSE connected");
  };

  es.onmessage = (event) => {
    // Keep-alive messages start with ":"
    if (event.data.startsWith(":")) return;
    try {
      const payload = JSON.parse(event.data);
      if (payload._id) {
        dispatchShared(payload as WireMessage);
      } else {
        // Server may send payload without _id — wrap it.
        dispatchShared({ ...payload, _id: makeId() } as WireMessage);
      }
    } catch {
      // Ignore malformed SSE data.
    }
  };

  es.onerror = () => {
    es.close();
    sharedES = null;

    if (refCount === 0) return; // torn down — don't reconnect
    if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      if (import.meta.env.DEV) {
        console.debug("[POS] SSE: max reconnect attempts reached, giving up");
      }
      return;
    }
    // Skip reconnect while the tab is hidden — the visibility listener re-opens.
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    const delay = Math.min(1000 * 2 ** reconnectAttempt, 30_000);
    reconnectAttempt += 1;
    if (import.meta.env.DEV) {
      console.debug(`[POS] SSE error, reconnecting in ${delay}ms`);
    }
    reconnectTimer = setTimeout(connectShared, delay);
  };
}

function startShared(): void {
  connectShared();

  // ── Layer 2: BroadcastChannel (same browser, different tabs) ──────────────
  if (typeof BroadcastChannel !== "undefined" && !sharedBC) {
    sharedBC = new BroadcastChannel(BC_CHANNEL_NAME);
    sharedBC.onmessage = (event: MessageEvent<WireMessage>) =>
      dispatchShared(event.data);
  }

  // ── Layer 3: localStorage storage event (same-browser fallback) ───────────
  storageHandler = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      dispatchShared(JSON.parse(e.newValue) as WireMessage);
    } catch {
      // Ignore malformed JSON written by unrelated code.
    }
  };
  window.addEventListener("storage", storageHandler);

  // ── Re-open SSE when the tab becomes visible again ────────────────────────
  visibilityHandler = () => {
    if (document.visibilityState !== "visible") return;
    if (sharedES) return;
    reconnectAttempt = 0;
    connectShared();
  };
  document.addEventListener("visibilitychange", visibilityHandler);
}

function stopShared(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  sharedES?.close();
  sharedES = null;
  sharedBC?.close();
  sharedBC = null;
  if (storageHandler) {
    window.removeEventListener("storage", storageHandler);
    storageHandler = null;
  }
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
  reconnectAttempt = 0;
  seenIds.clear();
}

function sendShared(msg: BroadcastMessage): void {
  const wire: WireMessage = { ...msg, _id: makeId() };
  // ── Layer 2 & 3: same-device same-browser ─────────────────────────────────
  sharedBC?.postMessage(wire);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wire));
  } catch {
    // localStorage unavailable in strict private-browsing contexts.
  }
}

/**
 * Cross-device cashier notification hub.
 *
 * Three delivery layers, in priority order:
 *
 * 1. **SSE (Server-Sent Events)** — HTTP-based server→client stream that
 *    works across different devices, browsers, and networks. Connects to
 *    /api/v1/pos/notifications/stream and auto-reconnects on error.
 *
 * 2. **BroadcastChannel API** — same browser, different tabs (no server
 *    needed). Used as a same-device fallback when the user has both pages
 *    open in the same browser.
 *
 * 3. **localStorage `storage` event** — same browser, different tabs.
 *    Complementary to BroadcastChannel in environments where that API is
 *    restricted (some mobile WebViews).
 *
 * All three channels share deduplication via `_id` so a message received on
 * multiple channels is dispatched to each consumer exactly once. Multiple
 * callers in the same tab share ONE underlying connection (ref-counted).
 */
export function useEventSource(
  onMessage?: (msg: BroadcastMessage) => void,
): { sendMessage: (msg: BroadcastMessage) => void } {
  // Always points to the latest callback without re-subscribing.
  const onMessageRef = useRef(onMessage);
  useLayoutEffect(() => {
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    const subscriber: Subscriber = (msg) => onMessageRef.current?.(msg);
    subscribers.add(subscriber);
    refCount += 1;
    if (refCount === 1) startShared();

    return () => {
      subscribers.delete(subscriber);
      refCount -= 1;
      if (refCount <= 0) {
        refCount = 0;
        stopShared();
      }
    };
  }, []);

  const sendMessage = useCallback((msg: BroadcastMessage) => sendShared(msg), []);

  return { sendMessage };
}
