import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  posNotificationService,
  type PosNotificationItem,
  type NotificationFilters,
} from "@/api/services/posNotificationService";
import { buildDatePresets } from "@/lib/datePresets";
import { isPosPath } from "@/lib/posRoutes";
import {
  useEventSource,
  type BroadcastMessage,
} from "./useEventSource";

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
  /** The window this screen started with, for telling "changed" from "default". */
  defaultFilters: NotificationFilters;
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
  /**
   * A failed fetch used to be indistinguishable from an empty queue: the list
   * falls back to `[]`, so a 500 or an expired token read to the cashier as
   * "no receipts to confirm" while clients waited on payments already made.
   */
  isError: boolean;
  /** Refetch the current page — `setPage(1)` is a no-op when page is 1. */
  refetch: () => void;
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

/**
 * Opens on today's payments.
 *
 * Previously there was no date bound at all, so the panel loaded all 1 760
 * notifications — 88 pages, and every card visible on the first screen already
 * said "To'langan". The handful that still need a cashier were buried under
 * months of finished work.
 *
 * Both bounds come from the "Bugun" preset rather than being written by hand:
 * QuickDatePresets highlights a chip only when dateFrom *and* dateTo match one
 * exactly (QuickDatePresets.tsx:19). Setting only date_from would filter the
 * list while leaving every chip unlit — a cashier facing an empty panel with no
 * indication of why. With the preset, "Bugun" is visibly selected and widening
 * the range is one click.
 */
function todayFilterRange(): { date_from: string; date_to: string } {
  const today = buildDatePresets()[0]; // "Bugun"
  return { date_from: today.dateFrom, date_to: today.dateTo };
}

/**
 * Yesterday through today.
 *
 * A receipt sent at 23:50 is still waiting at 00:10, and a window that starts
 * at midnight drops it out of sight at exactly the moment nobody is watching.
 */
function sinceYesterdayRange(): { date_from: string; date_to: string } {
  const presets = buildDatePresets();
  const yesterday = presets[1]; // "Kecha"
  const today = presets[0];
  return { date_from: yesterday.dateFrom, date_to: today.dateTo };
}

const DEFAULT_FILTERS: NotificationFilters = {
  sort: "created_desc",
  source: "flight",
  ...todayFilterRange(),
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface PaymentNotificationOptions {
  /**
   * Rows per page. Defaults to 20 — what the old `/pos` console has always
   * used, and what it must keep using.
   */
  perPage?: number;
  /**
   * Start the window at yesterday rather than at midnight today. Off by
   * default, again so `/pos` is unchanged.
   */
  sinceYesterday?: boolean;
}

export function usePaymentNotifications(
  options: PaymentNotificationOptions = {},
): UsePaymentNotificationsReturn {
  const { perPage = 20, sinceYesterday = false } = options;
  const queryClient = useQueryClient();
  // Any cashier console, not the literal "/pos". An exact-match check here made
  // a console at any other path fetch nothing and render an empty list — a
  // silent failure that looks like "no notifications today".
  const isOnPosRoute = isPosPath(window.location.pathname);
  const [page, setPage] = useState(1);
  /**
   * Read once, at mount. The window is a starting point the cashier can change,
   * not something to recompute underneath them mid-shift.
   */
  const [defaultFilters] = useState<NotificationFilters>(() =>
    sinceYesterday
      ? { ...DEFAULT_FILTERS, ...sinceYesterdayRange() }
      : DEFAULT_FILTERS,
  );
  const [filters, setFilters] = useState<NotificationFilters>(defaultFilters);
  const [readIds, setReadIds] = useState<Set<number>>(loadReadIds);
  const seenBroadcastIdsRef = useRef<Set<string>>(new Set());

  // ── Query: paginated list from PostgreSQL ─────────────────────────────────
  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["pos-notifications", page, perPage, filters],
    queryFn: () => posNotificationService.getNotifications(page, perPage, filters),
    enabled: isOnPosRoute,
    staleTime: 20_000,
    // SSE (useEventSource) + the 5s broadcast debounce are the primary freshness
    // path; this poll is a visibility-gated safety net only. Using the callback
    // form (instead of a usePageVisibility state hook) avoids re-rendering the
    // whole dashboard on every tab focus/blur.
    refetchInterval: () =>
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      isPosPath(window.location.pathname)
        ? 90_000
        : false,
    refetchIntervalInBackground: false,
  });

  // `?? []` minted a new array every render, so `markAllRead` (which closes
  // over it) changed identity every render and re-rendered every consumer that
  // takes it as a prop.
  const notifications = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.total ?? 0;

  // ── BroadcastChannel: real-time updates from other devices ─────────────────
  // A single business event reaches every connected tablet at once. Each
  // delivery used to trigger an immediate refetch within 1 s, multiplying
  // load by the number of tablets. The 5 s debounce coalesces bursts and
  // the active-query guard avoids re-invalidating queries that are already
  // in flight.
  const BROADCAST_DEBOUNCE_MS = 5_000;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleInvalidate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      queryClient.invalidateQueries({
        queryKey: ["pos-notifications"],
        refetchType: 'active',
      });
    }, BROADCAST_DEBOUNCE_MS);
  }, [queryClient]);

  const handleBroadcast = useCallback((msg: BroadcastMessage) => {
    if (msg.type === "POS_NOTIFY") {
      const payload = msg.payload;
      if (seenBroadcastIdsRef.current.has(payload.id)) return;
      seenBroadcastIdsRef.current.add(payload.id);

      scheduleInvalidate();

      // Show a toast for truly new pending notifications
      if (payload.paymentStatus === "pending") {
        toast.info(`${payload.clientName || payload.clientCode} — ${payload.flightName}`, {
          description: `To'lov kutilmoqda: ${payload.amountPaid.toLocaleString()} so'm`,
          duration: 8_000,
        });
      }
    } else if (msg.type === "CASHIER_ACK") {
      // Another cashier acted — just refresh the list
      scheduleInvalidate();
    }
  }, [scheduleInvalidate]);

  useEventSource(handleBroadcast);

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
    // Back to the window this screen STARTED with, not the module default —
    // otherwise a reset on the cashier console silently narrows it to today.
    setFilters(defaultFilters);
    setPage(1);
  }, [defaultFilters]);

  return {
    notifications,
    total,
    page,
    perPage,
    unreadCount,
    filters,
    defaultFilters,
    setPage,
    setFilters,
    resetFilters,
    markAllRead,
    readIds,
    isLoading,
    isRefetching: isFetching && !isLoading,
    /**
     * A failed fetch used to be indistinguishable from an empty queue: `items`
     * falls back to `[]`, so a 500 or an expired token read to the cashier as
     * "no receipts to confirm" while clients waited on unconfirmed payments.
     */
    isError,
    refetch,
  };
}
