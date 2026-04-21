import { useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

export interface PosNotificationPayload {
  flightName: string;
  clientCode: string;
  /** Unpaid amount — optional, shown in the toast when available */
  amount?: number;
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

// ── Supabase client ────────────────────────────────────────────────────────────
// Configure in .env (and Vercel env vars):
//   VITE_SUPABASE_URL      — Project URL from supabase.com → Settings → API
//   VITE_SUPABASE_ANON_KEY — anon/public key from the same page
//
// If the vars are absent the hook falls back to same-device channels only.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        realtime: { params: { eventsPerSecond: 10 } },
      })
    : null;

// Supabase Broadcast channel name (arbitrary — just needs to match on all clients).
const REALTIME_CHANNEL = "pos_cashier_notifications";

// Same-device fallbacks
const BC_CHANNEL_NAME = "pos_notifications";
const STORAGE_KEY = "pos_notification_last";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Cross-device cashier notification hub.
 *
 * Three delivery layers, in priority order:
 *
 * 1. **Supabase Realtime Broadcast** — WebSocket pub/sub that works across
 *    different devices, browsers, and networks.  Free tier is generous enough
 *    for typical cashier workloads.  Requires `VITE_SUPABASE_URL` and
 *    `VITE_SUPABASE_ANON_KEY` to be set in the environment.
 *
 * 2. **BroadcastChannel API** — same browser, different tabs (no server
 *    needed).  Used as a same-device fallback when the user has both pages
 *    open in the same browser.
 *
 * 3. **localStorage `storage` event** — same browser, different tabs.
 *    Complementary to BroadcastChannel in environments where that API is
 *    restricted (some mobile WebViews).
 *
 * All three channels share deduplication via `_id` so a message received on
 * multiple channels is dispatched to the consumer exactly once.
 */
export function useBroadcastChannel(
  onMessage?: (msg: BroadcastMessage) => void,
): { sendMessage: (msg: BroadcastMessage) => void } {
  const realtimeRef = useRef<RealtimeChannel | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);

  // Always points to the latest callback without causing the effect to re-run.
  // Synced in useLayoutEffect (not during render) to satisfy the react-hooks/refs rule.
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
    // ── Layer 1: Supabase Realtime Broadcast (cross-device) ─────────────────
    if (supabase) {
      const channel = supabase.channel(REALTIME_CHANNEL, {
        config: {
          broadcast: {
            // ack: false  →  fire-and-forget (lower latency, fine for notifications)
            ack: false,
            // self: false →  the sender does NOT receive its own message via Supabase;
            //                same-device delivery is handled by BroadcastChannel below.
            self: false,
          },
        },
      });

      // Wildcard catches both "POS_NOTIFY" and "CASHIER_ACK" (and any future types).
      channel.on(
        "broadcast",
        { event: "*" },
        ({ payload }: { payload: WireMessage }) => {
          dispatch(payload);
        },
      );

      channel.subscribe((status) => {
        if (import.meta.env.DEV) {
          console.debug("[POS] Supabase Realtime status:", status);
        }
      });

      realtimeRef.current = channel;
    }

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
      if (supabase && realtimeRef.current) {
        void supabase.removeChannel(realtimeRef.current);
        realtimeRef.current = null;
      }
      bc?.close();
      bcRef.current = null;
      window.removeEventListener("storage", handleStorage);
    };
  }, [dispatch]);

  const sendMessage = useCallback((msg: BroadcastMessage) => {
    const wire: WireMessage = { ...msg, _id: makeId() };

    // ── Layer 1: Supabase (cross-device) ────────────────────────────────────
    // Use wire.type as the Supabase event name so the wildcard subscriber
    // can route "POS_NOTIFY" and "CASHIER_ACK" without extra filtering.
    void realtimeRef.current?.send({
      type: "broadcast",
      event: wire.type,
      payload: wire,
    });

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
