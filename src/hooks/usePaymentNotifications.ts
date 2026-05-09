import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  posNotificationService,
  type PosNotificationItem,
  type NotificationFilters,
} from "@/api/services/posNotificationService";
import {
  useBroadcastChannel,
  type BroadcastMessage,
} from "./useBroadcastChannel";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UsePaymentNotificationsReturn {
  /** Current page of notifications from PostgreSQL */
  notifications: PosNotificationItem[];
  /** Total items matching current filters */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Items per page */
  perPage: number;
  /** Number of unread items on current page */
  unreadCount: number;
  /** Active filter state */
  filters: NotificationFilters;
  /** Setters */
  setPage: (p: number) => void;
  setFilters: (f: NotificationFilters | ((prev: NotificationFilters) => NotificationFilters)) => void;
  resetFilters: () => void;
  /** UI actions */
  markAllRead: () => void;
  /** Read IDs set for per-item unread tracking */
  readIds: Set<number>;
  isLoading: boolean;
  isRefetching: boolean;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const READ_IDS_KEY = "pos_notification_read_ids_v2";

function loadReadIds(): Set<number> {
  try {
    const raw = localStorage.getItem(READ_IDS_KEY);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<number>) {
  try {
    localStorage.setItem(READ_IDS_KEY, JSON.stringify(Array.from(ids).slice(0, 500)));
  } catch {
    // ignore
  }
}

const DEFAULT_FILTERS: NotificationFilters = {
  sort: "created_desc",
};

function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(() => document.visibilityState === "visible");

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return isVisible;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePaymentNotifications(): UsePaymentNotificationsReturn {
  const queryClient = useQueryClient();
  const isVisible = usePageVisibility();
  const isOnPosRoute = window.location.pathname === "/pos";
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<NotificationFilters>(DEFAULT_FILTERS);
  const [readIds, setReadIds] = useState<Set<number>>(loadReadIds);
  const seenBroadcastIdsRef = useRef<Set<string>>(new Set());

  // ── Query: paginated list from PostgreSQL ─────────────────────────────────
  const {
    data,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["pos-notifications", page, filters],
    queryFn: () => posNotificationService.getNotifications(page, 20, filters),
    enabled: isOnPosRoute,
    staleTime: 20_000,
    refetchInterval: isVisible && isOnPosRoute ? 30_000 : false,
  });

  const notifications = data?.items ?? [];
  const total = data?.total ?? 0;

  // ── BroadcastChannel: real-time updates from other devices ─────────────────
  const handleBroadcast = useCallback((msg: BroadcastMessage) => {
    if (msg.type === "POS_NOTIFY") {
      const payload = msg.payload;
      if (seenBroadcastIdsRef.current.has(payload.id)) return;
      seenBroadcastIdsRef.current.add(payload.id);

      // Invalidate so the next poll picks it up
      queryClient.invalidateQueries({ queryKey: ["pos-notifications"] });

      // Show a toast for truly new pending notifications
      if (payload.paymentStatus === "pending") {
        toast.info(`${payload.clientName || payload.clientCode} — ${payload.flightName}`, {
          description: `To'lov kutilmoqda: ${payload.amountPaid.toLocaleString()} so'm`,
          duration: 8_000,
        });
      }
    } else if (msg.type === "CASHIER_ACK") {
      // Another cashier acted — just refresh the list
      queryClient.invalidateQueries({ queryKey: ["pos-notifications"] });
    }
  }, [queryClient]);

  useBroadcastChannel(handleBroadcast);

  // ── Persist read IDs ────────────────────────────────────────────────────────
  useEffect(() => {
    saveReadIds(readIds);
  }, [readIds]);

  // ── Derived: unread count (items on current page not yet marked read,
  // auto-counted as read when payment_status === "paid")
  const unreadCount = notifications.filter(
    (n) => !readIds.has(n.id) && n.payment_status !== "paid"
  ).length;

  // ── Actions ─────────────────────────────────────────────────────────────────
  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const n of notifications) {
        next.add(n.id);
      }
      saveReadIds(next);
      return next;
    });
  }, [notifications]);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  return {
    notifications,
    total,
    page,
    perPage: 20,
    unreadCount,
    filters,
    setPage,
    setFilters,
    resetFilters,
    markAllRead,
    readIds,
    isLoading,
    isRefetching: isFetching && !isLoading,
  };
}
