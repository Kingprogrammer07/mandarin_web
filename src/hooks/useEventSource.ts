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
 * multiple channels is dispatched to the consumer exactly once.
 */
export function useEventSource(
  onMessage?: (msg: BroadcastMessage) => void,
): { sendMessage: (msg: BroadcastMessage) => void } {
  const bcRef = useRef<BroadcastChannel | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);

  // Always points to the latest callback without causing the effect to re-run.
  const onMessageRef = useRef(onMessage);
  useLayoutEffect(() => {
    onMessageRef.current = onMessage;
  });

  // Tracks processed IDs to prevent duplicate delivery across channels.
  const seenIdsRef = useRef<Set<string>>(new Set());

  const dispatch = useCallback((wire: WireMessage) => {
    if (seenIdsRef.current.has(wire._id)) return;
    seenIdsRef.current.add(wire._id);

    // Prevent unbounded growth — keep only the 50 most recent IDs.
    if (seenIdsRef.current.size > 50) {
      const [oldest] = seenIdsRef.current;
      seenIdsRef.current.delete(oldest);
    }

    // Strip internal transport field before handing to the consumer.
    const { _id, ...msg } = wire;
    void _id;
    onMessageRef.current?.(msg as BroadcastMessage);
  }, []);

  useEffect(() => {
    const connect = () => {
      const url = buildSseUrl();
      if (!url) {
        if (import.meta.env.DEV) {
          console.debug("[POS] SSE: no admin token, skipping connection");
        }
        return;
      }

      if (esRef.current) {
        esRef.current.close();
      }

      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        reconnectAttemptRef.current = 0;
        if (import.meta.env.DEV) {
          console.debug("[POS] SSE connected");
        }
      };

      es.onmessage = (event) => {
        // Keep-alive messages start with ":"
        if (event.data.startsWith(":")) return;

        try {
          const payload = JSON.parse(event.data);
          if (payload._id) {
            dispatch(payload as WireMessage);
          } else {
            // Server may send payload without _id — wrap it.
            dispatch({ ...payload, _id: makeId() } as WireMessage);
          }
        } catch {
          // Ignore malformed SSE data.
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;

        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 30_000);
        reconnectAttemptRef.current += 1;

        if (import.meta.env.DEV) {
          console.debug(`[POS] SSE error, reconnecting in ${delay}ms`);
        }

        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    };

    connect();

    // ── Layer 2: BroadcastChannel (same browser, different tabs) ────────────
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel(BC_CHANNEL_NAME);
      bcRef.current = bc;
      bc.onmessage = (event: MessageEvent<WireMessage>) => dispatch(event.data);
    }

    // ── Layer 3: localStorage storage event (same-browser fallback) ─────────
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        dispatch(JSON.parse(e.newValue) as WireMessage);
      } catch {
        // Ignore malformed JSON written by unrelated code.
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      esRef.current?.close();
      esRef.current = null;
      bc?.close();
      bcRef.current = null;
      window.removeEventListener("storage", handleStorage);
    };
  }, [dispatch]);

  const sendMessage = useCallback((msg: BroadcastMessage) => {
    const wire: WireMessage = { ...msg, _id: makeId() };

    // ── Layer 2 & 3: same-device same-browser ───────────────────────────────
    bcRef.current?.postMessage(wire);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wire));
    } catch {
      // localStorage unavailable in strict private-browsing contexts.
    }
  }, []);

  return { sendMessage };
}
