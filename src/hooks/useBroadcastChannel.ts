import { useEffect, useRef, useCallback } from "react";

export interface PosNotificationPayload {
  flightName: string;
  clientCode: string;
  /** Unpaid amount — optional, shown in the toast when available */
  amount?: number;
  currency?: string;
}

export interface BroadcastMessage {
  type: "POS_NOTIFY";
  payload: PosNotificationPayload;
}

const CHANNEL_NAME = "pos_notifications";

/**
 * Thin wrapper around the BroadcastChannel API.
 *
 * Both sender and receiver use the same channel name so messages flow between
 * any two tabs/pages of the same origin without a backend round-trip.
 *
 * WHY BroadcastChannel instead of a shared state store:
 * - The WarehousePage and POSDashboard may run in separate browser tabs.
 * - BroadcastChannel delivers messages even across tabs; Zustand/React state
 *   is isolated per tab.
 */
export function useBroadcastChannel(
  onMessage?: (msg: BroadcastMessage) => void,
): { sendMessage: (msg: BroadcastMessage) => void } {
  const channelRef = useRef<BroadcastChannel | null>(null);
  // Keep a stable ref to the latest onMessage callback so the effect does not
  // need to re-subscribe every time the callback identity changes.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      onMessageRef.current?.(event.data);
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  const sendMessage = useCallback((msg: BroadcastMessage) => {
    channelRef.current?.postMessage(msg);
  }, []);

  return { sendMessage };
}
