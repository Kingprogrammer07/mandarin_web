import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  User,
  Wallet,
  CheckCheck,
  CheckCircle2,
  Phone,
  Loader2,
  AlertCircle,
  Package,
  X,
  ArrowLeft,
  Sun,
  Moon,
  Lock,
  UserCircle,
  LogOut,
  Volume2,
  VolumeX,
  Zap,
  Calculator,
  ChevronDown,
  MessageSquare,
  DollarSign,
  ScanLine,
} from "lucide-react";
import CalculatorModal from "@/components/modals/CalculatorModal";
import ReceiptScannerModal from "@/pages/pos/components/ReceiptScannerModal";

import { getAdminJwtClaims } from "@/api/services/adminManagement";
import { refreshAdminToken } from "@/api/services/adminAuth";
import { posNotificationService, type PosNotificationItem } from "@/api/services/posNotificationService";
import {
  getCashierLog,
  processBulkPayment,
  getPaymentCards,
  editPayment,
} from "@/api/pos";
import {
  useEventSource,
  type BroadcastMessage,
} from "@/hooks/useEventSource";
import { usePaymentNotifications } from "@/hooks/usePaymentNotifications";
import { PaymentNotificationDrawer } from "@/components/pos/PaymentNotificationDrawer";
import { formatDateTime } from "@/components/pos/PaymentNotificationDrawer";
import type {
  PaymentProvider,
  CashierLogProvider,
  EditPaymentRequest,
} from "@/api/pos";
import {
  searchClients,
  getUnpaidCargo,
  normalizeSearchResult,
} from "@/api/verification";
import type { ClientSearchResult, UnpaidCargoItem } from "@/api/verification";
import { formatCurrencySum } from "@/lib/format";
import { normalizeNumber } from "@/utils/numberFormat";
import { cn } from "@/lib/utils";
import {
  loadPendingNotifs,
  persistPendingNotifs,
  playNotificationChime,
  getRecentSearches,
  saveRecentSearch,
  deleteRecentSearch,
  waterfallDistribute,
  toIsoDateBound,
  PAYMENT_TYPES,
  SOUND_KEY,
  maskCard,
} from "./components/utils";
import type { PendingNotif } from "./components/utils";
import { CashierLogPanel } from "./components/CashierLogPanel";
import { ClientProfileDrawer } from "./components/ClientProfileDrawer";
import { ConfirmModal } from "./components/ConfirmModal";
import type { ConfirmPayload } from "./components/ConfirmModal";
import { RejectConfirmModal } from "./components/RejectConfirmModal";
import { ResizeHandle } from "./components/ResizeHandle";
import { WarehouseRequestCard } from "./components/WarehouseRequestCard";
import { PosPickupQueuePreviewCard } from "./components/PosPickupQueuePreviewCard";

// ─── Main Component ───────────────────────────────────────────────────────────

interface POSDashboardProps {
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export default function POSDashboard({ onNavigate, onLogout }: POSDashboardProps) {
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Resizable column widths (persisted in localStorage) ───────────────────
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem("pos_left_width");
    return saved ? Math.max(200, Math.min(480, parseInt(saved, 10))) : 288;
  });
  const [centerWidth, setCenterWidth] = useState(() => {
    const saved = localStorage.getItem("pos_center_width");
    return saved ? Math.max(320, Math.min(800, parseInt(saved, 10))) : 480;
  });

  useEffect(() => {
    localStorage.setItem("pos_left_width", String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    localStorage.setItem("pos_center_width", String(centerWidth));
  }, [centerWidth]);

  // ── Dark mode ─────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState<boolean>(() => {
    // Default to light mode; only dark if explicitly saved in localStorage
    const saved = localStorage.getItem("pos_theme");
    if (saved) return saved === "dark";
    return false;
  });

  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("pos_theme", next ? "dark" : "light");
      return next;
    });
  }, []);

  // ── Payment notifications (PostgreSQL-backed) ─────────────────────────────
  const {
    notifications: paymentNotifications,
    total: paymentTotal,
    page: paymentPage,
    perPage: paymentPerPage,
    unreadCount: paymentUnreadCount,
    filters: paymentFilters,
    setPage: setPaymentPage,
    setFilters: setPaymentFilters,
    markAllRead: markPaymentNotificationsRead,
    readIds: paymentReadIds,
    isLoading: paymentLoading,
  } = usePaymentNotifications();

  // ── Notification tabs (Reys / Zayafka) ────────────────────────────────────
  const [notifTab, setNotifTab] = useState<'flight' | 'zayafka'>('flight');

  const handleNotifTabChange = useCallback((tab: 'flight' | 'zayafka') => {
    setNotifTab(tab);
    setPaymentFilters(prev => ({ ...prev, source: tab }));
    setPaymentPage(1);
  }, [setPaymentFilters, setPaymentPage]);

  // Override resetFilters to keep the current tab's source after reset
  const handleResetNotifFilters = useCallback(() => {
    setPaymentFilters({ sort: "created_desc", source: notifTab });
    setPaymentPage(1);
  }, [setPaymentFilters, setPaymentPage, notifTab]);

  const refetchNotifications = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['pos-notifications'] });
  }, [queryClient]);

  const { data: tabCounts } = useQuery({
    queryKey: ['pos-tab-counts'],
    queryFn: () => posNotificationService.getTabCounts(),
    refetchInterval: () =>
      typeof document !== 'undefined' && document.visibilityState === 'visible'
        ? 60_000
        : false,
    refetchIntervalInBackground: false,
  });

  // ── Permissions ───────────────────────────────────────────────────────────
  // State (not memo) so the UI re-renders automatically after a silent token refresh.
  const [jwtClaims, setJwtClaims] = useState(() => getAdminJwtClaims());

  // On mount, silently refresh the JWT so any permission changes take effect
  // without requiring the admin to log out and back in.
  useEffect(() => {
    let cancelled = false;
    refreshAdminToken()
      .then((data) => {
        if (cancelled) return;
        localStorage.setItem("access_token", data.access_token);
        setJwtClaims(getAdminJwtClaims());
      })
      .catch(() => {
        // Refresh failure is non-fatal — we continue with the existing token.
        // A real expiry will be caught by the 401 interceptor in apiClient.
      });
    return () => { cancelled = true; };
  }, []);

  // Super-admins have no explicit permissions in their JWT — they bypass all checks.
  const hasPerm = useCallback(
    (slug: string) => jwtClaims.isSuperAdmin || jwtClaims.permissions.has(slug),
    [jwtClaims],
  );

  const canRead    = hasPerm("pos:read");
  const canProcess = hasPerm("pos:process");
  const canAdjust  = hasPerm("pos:adjust");
  const canUpdateStatus = hasPerm("pos:update_status");
  // Super-admins always have full access; others need at least one POS permission
  const hasPosAccess =
    jwtClaims.isSuperAdmin || canRead || canProcess || canAdjust || canUpdateStatus;

  // ── Calculator modal ──────────────────────────────────────────────────────
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // ── Receipt QR scanner ────────────────────────────────────────────────────
  // Opens via the toolbar button or a `?receipt=<order_id>` deep link (when a
  // cashier scans the QR with a device that navigates to /pos?receipt=...).
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerOrderId, setScannerOrderId] = useState<string | null>(null);
  useEffect(() => {
    const receipt = new URLSearchParams(window.location.search).get("receipt");
    if (receipt) {
      setScannerOrderId(receipt);
      setIsScannerOpen(true);
    }
  }, []);

  // ── Sound preference (persisted in localStorage) ─────────────────────────
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    () => localStorage.getItem(SOUND_KEY) !== "off",
  );
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      return next;
    });
  }, []);

  // ── Pending notifications (persisted — survive page refresh) ────────────
  // Notifications are stored in localStorage and re-shown on mount so the
  // cashier never misses a message even if they briefly leave the page.
  const [pendingNotifs, setPendingNotifs] = useState<PendingNotif[]>(loadPendingNotifs);
  const notifCount = pendingNotifs.length;

  // ── Stable refs for functions used inside toast action callbacks ──────────
  // Toast action `onClick` handlers close over these refs so they always call
  // the latest version without creating stale closures.
  const handleSearchRef = useRef<(code: string) => void>(() => {});
  const sendMessageRef  = useRef<(msg: BroadcastMessage) => void>(() => {});
  const removePendingNotifRef = useRef<(id: string) => void>(() => {});

  const removePendingNotif = useCallback((id: string) => {
    setPendingNotifs((prev) => {
      const next = prev.filter((n) => n.id !== id);
      persistPendingNotifs(next);
      return next;
    });
    toast.dismiss(id);
  }, []);
  // Keep the ref current on every render so toast callbacks always call the
  // latest version even though they were created at toast-show time.
  removePendingNotifRef.current = removePendingNotif;

  const handleDismissAllNotifs = useCallback(() => {
    setPendingNotifs([]);
    persistPendingNotifs([]);
    toast.dismiss();
  }, []);

  /** Creates (or re-creates after page refresh) the Sonner toast for one pending notification. */
  const showNotifToast = useCallback((notif: PendingNotif) => {
    const amountStr =
      notif.amount != null
        ? ` · ${new Intl.NumberFormat("uz-UZ").format(notif.amount)} ${notif.currency ?? "UZS"}`
        : "";

    toast.info(`${notif.clientCode}${amountStr}`, {
      // Stable ID lets Sonner de-duplicate if the same notif is shown twice
      // (e.g. mount effect runs while the toast is still visible).
      id: notif.id,
      description: `${notif.flightName} · To'lov tasdiqlansin`,
      duration: Infinity,
      action: {
        label: "Ochish",
        onClick: () => {
          handleSearchRef.current(notif.clientCode);
          removePendingNotifRef.current(notif.id);
          // Inform the warehouse operator that the cashier saw the notification.
          sendMessageRef.current({
            type: "CASHIER_ACK",
            payload: { clientCode: notif.clientCode, flightName: notif.flightName },
          });
        },
      },
      cancel: {
        label: "✕",
        onClick: () => removePendingNotifRef.current(notif.id),
      },
    });
  }, []); // all dependencies are refs — this callback is intentionally stable

  // On mount: re-show toasts for notifications that arrived while the cashier
  // was away (they are still in localStorage / pendingNotifs state).
  useEffect(() => {
    loadPendingNotifs().forEach((notif) => showNotifToast(notif));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  // ── Warehouse → Cashier notifications via BroadcastChannel ──────────────
  const { sendMessage } = useEventSource(
    useCallback(
      (msg: BroadcastMessage) => {
        if (msg.type !== "POS_NOTIFY") return;
        const { flightName, clientCode, amount, currency } = msg.payload;

        if (soundEnabled) playNotificationChime();

        const notif: PendingNotif = {
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          clientCode,
          flightName,
          amount,
          currency,
        };

        setPendingNotifs((prev) => {
          const next = [...prev, notif];
          persistPendingNotifs(next);
          return next;
        });

        showNotifToast(notif);
      },
      [soundEnabled, showNotifToast],
    ),
  );
  // Keep sendMessage ref current so toast action callbacks can send ACKs.
  sendMessageRef.current = sendMessage;

  // ── Search ────────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [clientInfo, setClientInfo] = useState<ClientSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [recentCodes, setRecentCodes] = useState<string[]>(getRecentSearches);
  const [logDateFrom, setLogDateFrom] = useState("");
  const [logDateTo, setLogDateTo] = useState("");
  const [logProvider, setLogProvider] = useState<CashierLogProvider | "all">("all");
  const [logPage, setLogPage] = useState(1);

  // ── Collapsible left column ───────────────────────────────────────────────
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem("pos_left_collapsed");
    return saved === "true";
  });

  const toggleLeftColumn = useCallback(() => {
    setLeftCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("pos_left_collapsed", String(next));
      return next;
    });
  }, []);

  // Live balance updated after successful balance adjustments without re-fetching client
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const displayBalance = liveBalance ?? clientInfo?.client_balance ?? 0;

  // ── Selection & payment ───────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [paymentType, setPaymentType] = useState<PaymentProvider>("cash");
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [receivedInput, setReceivedInput] = useState("");
  const [flightDropdownOpen, setFlightDropdownOpen] = useState(false);
  const [editNote, setEditNote] = useState("");

  // ── Notification-driven flight auto-select & info card ─────────────────────
  const pendingFlightRef = useRef<{ flight: string; clientCode: string; source: 'flight' | 'zayafka' } | null>(null);
  const [activeNotifData, setActiveNotifData] = useState<PosNotificationItem | null>(null);
  const activeNotifRef = useRef<PosNotificationItem | null>(null);
  useEffect(() => { activeNotifRef.current = activeNotifData; }, [activeNotifData]);

  // ── Notification reject state ──────────────────────────────────────────────
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectModalWithComment, setRejectModalWithComment] = useState(false);

  // ── Pickup queue state (now handled by WarehouseRequestCard) ───────────────

  // ── UI overlays ───────────────────────────────────────────────────────────
  const TYPE_LABEL: Record<string, string> = {
    wallet: "Hamyon", cash: "Naqd", online: "Online",
    click: "Click", payme: "Payme", card: "Karta",
  };

  const [showProfile, setShowProfile] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<ConfirmPayload | null>(
    null,
  );

  // ── Notification reject mutation ───────────────────────────────────────────
  const rejectMut = useMutation({
    mutationFn: async (comment: string | null) => {
      const notif = activeNotifRef.current;
      if (!notif) throw new Error("Bildirishnoma yo'q");
      if (notif.source === 'zayafka') {
        if (!notif.delivery_request_id) throw new Error("delivery_request_id yo'q");
        await posNotificationService.rejectZayafka({
          delivery_request_id: notif.delivery_request_id,
          comment: comment || null,
        });
      } else {
        await posNotificationService.rejectFlightNotification({
          client_code: notif.client_code,
          flight_name: notif.flight_name,
          comment: comment || null,
        });
      }
    },
    onSuccess: () => {
      toast.success("To'lov rad etildi");
      setRejectModalOpen(false);
      setRejectModalWithComment(false);
      setActiveNotifData(null);
      queryClient.invalidateQueries({ queryKey: ["pos-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["pos-notification-stats"] });
      queryClient.invalidateQueries({ queryKey: ["pos-notification-tab-counts"] });
      if (clientInfo) {
        void handleSearch(clientInfo.client_code);
      }
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message ?? "Rad etishda xatolik");
    },
  });

  // ── Edit payment mutation ─────────────────────────────────────────────────
  const editMut = useMutation({
    mutationFn: async (payload: EditPaymentRequest) => {
      return editPayment(payload);
    },
    onSuccess: (result) => {
      toast.success(result.message || "To'lov o'zgartirildi");
      queryClient.invalidateQueries({ queryKey: ["pos-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["pos-notification-stats"] });
      queryClient.invalidateQueries({ queryKey: ["pos-notification-tab-counts"] });
      queryClient.invalidateQueries({ queryKey: ["cashier-log"] });
      // Refresh active notification to show updated values
      if (clientInfo) {
        void handleSearch(clientInfo.client_code);
      }
    },
    onError: (err: unknown) => {
      type PosError = { message?: string; data?: { detail?: { error?: string } | string } };
      const apiErr = err as PosError;
      const detail = apiErr?.data?.detail;
      if (detail && typeof detail === "object" && detail.error) {
        toast.error(detail.error);
      } else {
        toast.error(apiErr.message ?? "O'zgartirishda xatolik yuz berdi");
      }
    },
  });

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Reset to page 1 whenever any cashier log filter changes
  useEffect(() => {
    setLogPage(1);
  }, [logDateFrom, logDateTo, logProvider]);

  const cashierLogParams = useMemo(
    () => ({
      page: logPage,
      size: 30,
      date_from: toIsoDateBound(logDateFrom, "start"),
      date_to: toIsoDateBound(logDateTo, "end"),
      payment_provider: logProvider === "all" ? undefined : logProvider,
    }),
    [logPage, logDateFrom, logDateTo, logProvider],
  );
  // ── Queries ───────────────────────────────────────────────────────────────
  const {
    data: logData,
    isLoading: logLoading,
    refetch: refetchLog,
  } = useQuery({
    queryKey: ["cashier-log", cashierLogParams],
    queryFn: () => getCashierLog(cashierLogParams),
    // Cashier log refreshes are also delivered live via SSE (see
    // useEventSource); polling exists only as a fallback. 30 s with a
    // visibility gate is a safe floor.
    staleTime: 30_000,
    refetchInterval: () =>
      typeof document !== 'undefined' && document.visibilityState === 'visible'
        ? 30_000
        : false,
    refetchIntervalInBackground: false,
    // Only fire if the admin actually has pos:read — prevents a 403 for adjust-only roles
    enabled: canRead,
  });

  const { data: cargoData, isLoading: cargoLoading } = useQuery({
    queryKey: ["pos-unpaid", clientInfo?.client_code],
    queryFn: () =>
      getUnpaidCargo({
        clientCode: clientInfo!.client_code,
        filterType: "all",
        sortOrder: "asc",
        limit: 100,
        offset: 0,
      }),
    // Cargo list is only meaningful when the admin can process payments
    enabled: canProcess && !!clientInfo,
    staleTime: 30_000,
  });

  const { data: cardsData } = useQuery({
    queryKey: ["payment-cards"],
    queryFn: getPaymentCards,
    enabled: canProcess,
    staleTime: 2 * 60_000,
  });
  const activeCards = useMemo(() => (cardsData ?? []).filter((c) => c.is_active), [cardsData]);
  const selectedCard = useMemo(
    () => activeCards.find((c) => c.id === selectedCardId) ?? null,
    [activeCards, selectedCardId],
  );

  const cargos: UnpaidCargoItem[] = useMemo(
    () => cargoData?.items ?? [],
    [cargoData?.items],
  );

  const flightGroups = useMemo(() => {
    const map = new Map<string, UnpaidCargoItem[]>();
    for (const cargo of cargos) {
      if (!map.has(cargo.flight_name)) map.set(cargo.flight_name, []);
      map.get(cargo.flight_name)!.push(cargo);
    }
    return Array.from(map.entries()).map(([flightName, items]) => ({
      flightName,
      items,
      totalWeight: items.reduce((s, c) => s + c.weight, 0),
      totalAmount: items.reduce((s, c) => s + c.total_payment, 0),
    }));
  }, [cargos]);
  // ── Bulk payment mutation ─────────────────────────────────────────────────
  const payMut = useMutation({
    mutationFn: processBulkPayment,
    onSuccess: async (result) => {
      const msg = `${result.processed_count} ta yuk to'lovi qabul qilindi! Jami: ${formatCurrencySum(result.total_paid)}`;
      toast.success(msg);
      setSelectedIds(new Set());
      setReceivedInput("");
      setConfirmPayload(null);

      // Restrict refetches to queries that are actually mounted on the
      // current screen — the previous five-key invalidation fan-out fired
      // refetches for off-screen queries as well, multiplying per-payment
      // request count.
      queryClient.invalidateQueries({ queryKey: ["pos-unpaid"], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ["cashier-log"], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ["pos-txn"], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ["client-info"], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ["pos-notifications"], refetchType: 'active' });
      // `handleSearch` was issued explicitly to refresh client wallet, but
      // the `client-info` invalidation above already triggers that refetch
      // when the panel is mounted. Drop the redundant call.

      // Refresh the active notification card to reflect the just-processed payment
      const currentNotif = activeNotifRef.current;
      if (currentNotif) {
        try {
          const synced = await posNotificationService.syncNotification(currentNotif.id);
          setActiveNotifData(synced);
        } catch {
          // non-critical: card will be stale until next Ko'rish click
        }
      }
    },
    onError: (err: unknown) => {
      type PosError = {
        status?: number;
        data?: {
          detail?: { error?: string; failed_cargo_id?: number; display_number?: number } | string;
        };
        message?: string;
      };
      const apiErr = err as PosError;
      if (apiErr.status === 409) {
        const detail = apiErr?.data?.detail;
        const displayNumber =
          detail && typeof detail === "object" ? detail.display_number : undefined;
        toast.error(
          displayNumber
            ? `Bu yuklar allaqachon navbatda (#${displayNumber})`
            : "Bu yuklar allaqachon navbatda",
          { duration: 6000 },
        );
      } else {
        const detail = apiErr?.data?.detail;
        if (detail && typeof detail === "object" && detail.error) {
          toast.error(
            `Xatolik (cargo #${detail.failed_cargo_id ?? "?"}): ${detail.error}`,
            { duration: 6000 },
          );
        } else {
          toast.error(apiErr.message ?? "To'lov qilishda xatolik yuz berdi");
        }
      }
      setConfirmPayload(null);
    },
  });

  // ── Derived payment totals ────────────────────────────────────────────────
  const { selectedCargos, totalOwed, totalSelectedWeight } = useMemo(() => {
    const selected = cargos.filter((c) => selectedIds.has(c.cargo_id));
    return {
      selectedCargos: selected,
      totalOwed: selected.reduce((s, c) => s + (c.total_payment ?? 0), 0),
      totalSelectedWeight: selected.reduce((s, c) => s + (c.weight ?? 0), 0),
    };
  }, [cargos, selectedIds]);

  const walletDeduction = useWallet ? Math.min(displayBalance, totalOwed) : 0;
  const netAfterWallet = totalOwed - walletDeduction;

  // Auto-fill received input when selection/wallet/notification changes
  const userEditedRef = useRef(false);
  const prevNetRef = useRef(0);
  useEffect(() => {
    const net = totalOwed - (useWallet ? Math.min(displayBalance, totalOwed) : 0);
    const notifFallback = activeNotifData?.remaining_amount ?? 0;
    const effective = net > 0 ? net : notifFallback;
    if (!userEditedRef.current || effective !== prevNetRef.current) {
      setReceivedInput(effective > 0 ? String(Math.round(effective)) : "");
      prevNetRef.current = effective;
    }
  }, [totalOwed, useWallet, displayBalance, activeNotifData]);

  const receivedAmount = parseFloat(receivedInput) || netAfterWallet;

  // ── Search ────────────────────────────────────────────────────────────────
  // Keep a ref to searchInput so handleSearch doesn't re-create on every keystroke.
  const searchInputRef = useRef(searchInput);
  useEffect(() => { searchInputRef.current = searchInput; }, [searchInput]);

  const handleSearch = useCallback(
    async (overrideCode?: string) => {
      const query = (overrideCode ?? searchInputRef.current).trim().toUpperCase();
      if (!query) return;

      setIsSearching(true);
      setClientInfo(null);
      setSearchError(null);
      setSelectedIds(new Set());
      setUseWallet(false);
      setLiveBalance(null);

      try {
        const res = await searchClients(query);
        const normalized = normalizeSearchResult(res.client);
        setClientInfo(normalized);
        if (overrideCode) setSearchInput(overrideCode);
        saveRecentSearch(normalized.client_code);
        setRecentCodes(getRecentSearches());
      } catch {
        setSearchError(`"${query}" kodli mijoz topilmadi`);
      } finally {
        setIsSearching(false);
      }
    },
    [], // stable: reads searchInput via ref
  );

  // Keep the ref in sync so the BroadcastChannel notification callback always
  // calls the latest version of handleSearch (avoids stale closure over searchInput).
  handleSearchRef.current = handleSearch;

  const handleRecentChipClick = useCallback(
    (code: string) => handleSearch(code),
    [handleSearch],
  );
  const handleCloseProfile = useCallback(() => setShowProfile(false), []);
  const handleBalanceUpdate = useCallback((newBalance: number) => setLiveBalance(newBalance), []);
  const handleRefreshClient = useCallback(
    () => handleSearch(clientInfo?.client_code),
    [handleSearch, clientInfo?.client_code],
  );

  const handleLeftResize = useCallback(
    (d: number) => setLeftWidth((w) => Math.max(200, Math.min(480, w + d))),
    [],
  );
  const handleCenterResize = useCallback(
    (d: number) => setCenterWidth((w) => Math.max(320, Math.min(800, w + d))),
    [],
  );

  const handleRemoveRecent = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteRecentSearch(code);
    setRecentCodes(getRecentSearches());
  };

  const handleClearClient = () => {
    setSearchInput("");
    setClientInfo(null);
    setSearchError(null);
    setSelectedIds(new Set());
    setUseWallet(false);
    setLiveBalance(null);
    setActiveNotifData(null);
    setEditNote("");
    pendingFlightRef.current = null;

    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const handleClientAndFlightClick = useCallback(
    async (code: string, flightName: string, notif: PosNotificationItem) => {
      pendingFlightRef.current = { flight: flightName, clientCode: code, source: notif.source };
      // Sync with actual transaction data before displaying — fixes stale amount_paid/total_amount
      let freshNotif = notif;
      try {
        freshNotif = await posNotificationService.syncNotification(notif.id);
      } catch {
        // Non-critical: fall back to cached notification data if sync fails
      }
      setActiveNotifData(freshNotif);
      const matchedType = PAYMENT_TYPES.find((t) => t.id === freshNotif.payment_type);
      // "online" (Telegram bot payments) has no POS equivalent — default to click
      setPaymentType(matchedType ? matchedType.id : "click");
      await handleSearch(code);
    },
    [handleSearch],
  );

  // ── Cargo selection ───────────────────────────────────────────────────────
  // Auto-select all cargos when data loads (unless a pending flight select is queued)
  useEffect(() => {
    if (pendingFlightRef.current) return;
    if (cargoData?.items && cargoData.items.length > 0) {
      setSelectedIds(new Set(cargoData.items.map((c) => c.cargo_id)));
    }
  }, [cargoData?.items]);

  // Auto-select specific flight cargos when triggered from notification "Ko'rish".
  // clientCode check removed: search may return primary_code while notification stores actual_code,
  // causing a mismatch that prevents selection. clientInfo dependency already guarantees correct client.
  useEffect(() => {
    if (!pendingFlightRef.current || !cargoData?.items || !clientInfo) return;
    const { flight, source } = pendingFlightRef.current;
    const flightItems = cargoData.items.filter(
      (c) => c.flight_name.toUpperCase() === flight.toUpperCase()
    );
    if (flightItems.length > 0) {
      setSelectedIds(new Set(flightItems.map((c) => c.cargo_id)));
    } else if (source === "flight") {
      // No unpaid cargo for this flight — check if we're in edit mode (paid notification)
      const currentNotif = activeNotifRef.current;
      if (currentNotif?.payment_status === "paid") {
        // Edit mode: keep the notification active, pre-fill inputs, clear selections
        setSelectedIds(new Set());
        setReceivedInput(String(Math.round(currentNotif.amount_paid || 0)));
        setEditNote("");
      } else {
        // No unpaid cargo for this flight despite a "pending" notification —
        // the notification is stale (cargo was already paid via a different code path).
        setActiveNotifData(null);
        toast.info("Bu to'lov allaqachon amalga oshirilgan ko'rinadi", { duration: 5000 });
      }
    }
    pendingFlightRef.current = null;
  }, [cargoData?.items, clientInfo]);

  const toggleFlight = useCallback((flightName: string) => {
    const flightItems = flightGroups.find(g => g.flightName === flightName)?.items ?? [];
    const allSelected = flightItems.every(c => selectedIds.has(c.cargo_id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const item of flightItems) {
        if (allSelected) next.delete(item.cargo_id);
        else next.add(item.cargo_id);
      }
      return next;
    });
  }, [flightGroups, selectedIds]);

  // ── Confirmation flow ─────────────────────────────────────────────────────
  const handleOpenConfirm = () => {
    if (!clientInfo || selectedCargos.length === 0 || payMut.isPending) return;
    if (paymentType === "card" && !selectedCardId) {
      toast.error("Karta tanlanmadi. Iltimos, bitta kartani tanlang.");
      return;
    }
    setConfirmPayload({
      cargos: selectedCargos,
      amounts: waterfallDistribute(selectedCargos, receivedAmount),
      paymentType,
      useWallet,
      received: receivedAmount,
      walletDeduction,
      selectedCard: paymentType === "card" ? selectedCard : null,
      clientCode: clientInfo.client_code,
    });
  };

  const handleConfirmPay = () => {
    if (!confirmPayload || !clientInfo) return;
    payMut.mutate({
      items: confirmPayload.cargos.map((cargo, i) => ({
        cargo_id: cargo.cargo_id,
        flight: cargo.flight_name,
        client_code: clientInfo.client_code,
        paid_amount: Number((confirmPayload.amounts[i] ?? 0.01).toFixed(2)),
        payment_type: confirmPayload.paymentType,
        use_balance: confirmPayload.useWallet,
        card_id: confirmPayload.selectedCard?.id ?? null,
      })),
      cashier_note: null,
      create_pickup_queue: undefined,
      pickup_method: null,
      pickup_priority: undefined,
      pickup_note: null,
      pickup_idempotency_key: null,
    });
  };

  const handleEditSave = () => {
    const notif = activeNotifRef.current;
    if (!notif || !clientInfo) return;
    if (!["cash", "click", "payme", "card"].includes(paymentType)) {
      toast.error("Noto'g'ri to'lov turi");
      return;
    }
    editMut.mutate({
      client_code: clientInfo.client_code,
      flight_name: notif.flight_name,
      payment_type: paymentType,
      note: editNote.trim() || null,
      notification_id: notif.id,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const showRecentChips =
    !searchInput &&
    !clientInfo &&
    !searchError &&
    !isSearching &&
    recentCodes.length > 0;

  // ── Zero-access fallback ──────────────────────────────────────────────────
  if (!hasPosAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
          <Lock className="w-8 h-8 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[16px] font-bold text-gray-700 dark:text-gray-300">
            Ruxsat yo'q
          </p>
          <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
            Sizda ushbu sahifani ko'rish uchun huquq yo'q.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-3 sm:px-4 pb-6 bg-[#f5f3ef] dark:bg-[#0c0c0c] min-h-screen">
        {/* Dashboard header */}
        <div className="flex items-center justify-between py-3 mb-1">
          <div className="flex items-center gap-2">
            {/* Back button */}
            <button
              onClick={() => onNavigate("verification-search")}
              title="Orqaga"
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-white/[0.06] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              POS Kassa
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Dismiss all active warehouse notifications */}
            {notifCount > 0 && (
              <button
                onClick={handleDismissAllNotifs}
                title="Barcha bildirishnomalarni yopish"
                className="relative p-2 rounded-xl text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/[0.08] transition-colors"
              >
                <Zap className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
            )}

            {/* Receipt QR scanner */}
            <button
              onClick={() => { setScannerOrderId(null); setIsScannerOpen(true); }}
              title="Chek skaneri"
              className="p-2 rounded-xl text-gray-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-500/[0.08] transition-colors"
            >
              <ScanLine className="w-4 h-4" />
            </button>

            {/* Calculator */}
            <button
              onClick={() => setIsCalculatorOpen(true)}
              title="Kalkulyator"
              className="p-2 rounded-xl text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/[0.08] transition-colors"
            >
              <Calculator className="w-4 h-4" />
            </button>

            {/* Sound toggle */}
            <button
              onClick={toggleSound}
              title={soundEnabled ? "Ovozni o'chirish" : "Ovozni yoqish"}
              className="p-2 rounded-xl text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/[0.08] transition-colors"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>

            {/* Payment notifications (mobile drawer) */}
            <div className="lg:hidden">
              <PaymentNotificationDrawer
                notifications={paymentNotifications}
                total={paymentTotal}
                page={paymentPage}
                perPage={paymentPerPage}
                unreadCount={paymentUnreadCount}
                filters={paymentFilters}
                setPage={setPaymentPage}
                setFilters={setPaymentFilters}
                resetFilters={handleResetNotifFilters}
                markAllRead={markPaymentNotificationsRead}
                readIds={paymentReadIds}
                onClientClick={handleSearch}
                isLoading={paymentLoading}
                activeTab={notifTab}
                onTabChange={handleNotifTabChange}
                tabCounts={tabCounts ?? { flight: 0, zayafka: 0 }}
                onRefresh={refetchNotifications}
                onClientAndFlightClick={handleClientAndFlightClick}
              />
            </div>

            <button
              onClick={() => onNavigate("admin-expenses")}
              title="Rasxodlar"
              className="p-2 rounded-xl text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/[0.08] transition-colors"
            >
              <DollarSign className="w-4 h-4" />
            </button>
            <button
              onClick={() => {onNavigate("admin-profile")}}
              title="Profil va Xavfsizlik"
              className="p-2 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/[0.08] transition-colors"
            >
              <UserCircle className="w-4 h-4" />
            </button>
            <button
              onClick={toggleDark}
              title={isDark ? "Kunduzgi rejim" : "Tungi rejim"}
              className="p-2 rounded-xl text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/[0.08] transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={onLogout}
              title="Tizimdan chiqish"
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          className="flex flex-col lg:flex-row gap-4 lg:gap-0"
          style={
            {
              "--pos-left-w": `${leftWidth}px`,
              "--pos-center-w": `${centerWidth}px`,
            } as React.CSSProperties
          }
        >
          {/* ── Left column: Cashier Log ───────────────────────────────────
               Collapsible on desktop. Content gated behind pos:read. */}
          {!leftCollapsed ? (
            <div className="shrink-0 flex flex-col gap-3 lg:px-1.5 lg:w-[var(--pos-left-w)] lg:h-[calc(100dvh-5rem)]">
              {canRead ? (
                <CashierLogPanel
                  logData={logData}
                  logLoading={logLoading}
                  onRefresh={() => refetchLog()}
                  onEntryClick={(code) => handleSearch(code)}
                  currentAdminId={jwtClaims.admin_id}
                  logDateFrom={logDateFrom}
                  setLogDateFrom={setLogDateFrom}
                  logDateTo={logDateTo}
                  setLogDateTo={setLogDateTo}
                  logProvider={logProvider}
                  setLogProvider={setLogProvider}
                  page={logPage}
                  onPageChange={setLogPage}
                />
              ) : (
                <div className="bg-white dark:bg-[#161616] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[160px]">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
                    <Lock className="w-5 h-5 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
                  </div>
                  <p className="text-[12px] text-gray-400 dark:text-gray-500 max-w-[180px]">
                    Sizda kassa tarixini ko'rish huquqi yo'q
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Collapsed strip — only visible on desktop */
            <div className="hidden lg:block" />
          )}

          <ResizeHandle
            onResize={handleLeftResize}
            showToggle
            isCollapsed={leftCollapsed}
            onToggle={toggleLeftColumn}
          />

          {/* ── Center column: Search & Payment ───────────────────────────── */}
          <div className="shrink-0 space-y-3 lg:px-1.5 lg:w-[var(--pos-center-w)]">
            {/* Search bar */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm p-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchInput}
                    onChange={(e) =>
                      setSearchInput(e.target.value.toUpperCase())
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Mijoz kodini kiriting (masalan: T123)"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] rounded-xl text-[14px] font-mono font-semibold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 placeholder:font-sans placeholder:font-normal uppercase"
                  />
                </div>
                <motion.button
                  onClick={() => handleSearch()}
                  disabled={!searchInput.trim() || isSearching}
                  whileTap={{ scale: 0.95 }}
                  className="px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-[13px] rounded-xl shadow-sm shadow-orange-500/20 transition-all disabled:opacity-50 shrink-0"
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Izlash"
                  )}
                </motion.button>
              </div>

              {/* Recent search chips */}
              <AnimatePresence>
                {showRecentChips && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-gray-50 dark:border-white/[0.04]"
                  >
                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider shrink-0">
                      Oxirgi:
                    </span>
                    {recentCodes.map((code) => (
                      <button
                        key={code}
                        onClick={() => handleRecentChipClick(code)}
                        className="group flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-gray-100 dark:bg-white/[0.06] hover:bg-orange-50 dark:hover:bg-orange-500/[0.1] border border-gray-200 dark:border-white/[0.08] hover:border-orange-300 dark:hover:border-orange-500/30 rounded-lg transition-all"
                      >
                        <span className="text-[11px] font-bold font-mono text-gray-700 dark:text-gray-300 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                          {code}
                        </span>
                        <span
                          onClick={(e) => handleRemoveRecent(code, e)}
                          className="ml-0.5 w-4 h-4 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <X className="w-2.5 h-2.5" />
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Search error */}
            <AnimatePresence>
              {searchError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/[0.08] rounded-2xl border border-red-200/60 dark:border-red-500/20 text-red-600 dark:text-red-400"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="text-[13px] font-medium">{searchError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Merged client + cargo + payment card */}
            <AnimatePresence>
              {clientInfo && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="bg-white dark:bg-[#161616] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm"
                >
                  {/* Client header */}
                  <div
                    onClick={() => setShowProfile(true)}
                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/[0.1] flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-orange-500" strokeWidth={1.8} />
                        </div>
                        <div className="flex items-center min-w-0">
                          <span className="text-[13px] font-bold font-mono text-gray-900 dark:text-white">
                            {clientInfo.client_code}
                          </span>
                          <span className="text-gray-300 dark:text-gray-600 mx-1">·</span>
                          <span className="text-[13px] text-gray-600 dark:text-gray-400 truncate">
                            {clientInfo.full_name}
                          </span>
                          {clientInfo.phone && (
                            <>
                              <span className="text-gray-300 dark:text-gray-600 mx-1">·</span>
                              <span className="flex items-center gap-0.5 text-[12px] text-gray-400 dark:text-gray-500">
                                <Phone className="w-3 h-3" />
                                {clientInfo.phone}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">
                            Hamyon
                          </p>
                          <p
                            className={`text-[13px] font-bold ${
                              displayBalance > 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-gray-400"
                            }`}
                          >
                            {formatCurrencySum(displayBalance)}
                          </p>
                        </div>
                        {/* stopPropagation prevents the card click from firing when clearing */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearClient();
                          }}
                          className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {!canProcess ? (
                    <div className="p-6 flex flex-col items-center justify-center gap-3 text-center border-t border-gray-100 dark:border-white/[0.06]">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
                        <Lock className="w-5 h-5 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
                      </div>
                      <p className="text-[12px] text-gray-400 dark:text-gray-500 max-w-[220px]">
                        Sizda to'lov qabul qilish huquqi yo'q
                      </p>
                    </div>
                  ) : (
                    <>
                      {cargoLoading ? (
                        <div className="p-3 space-y-2">
                          <div className="space-y-2 py-2">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="h-16 bg-gray-50 dark:bg-white/[0.04] rounded-xl animate-pulse" />
                            ))}
                          </div>
                        </div>
                      ) : cargos.length === 0 && activeNotifData?.payment_status !== "paid" ? (
                        <div className="p-6 text-center">
                          <Package className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
                          <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400">Qarzdorlik yo'q</p>
                          <p className="text-[12px] text-gray-400 dark:text-gray-600 mt-1">Barcha yuklar uchun to'lov qilingan</p>
                        </div>
                      ) : null}

                      {/* ── Payment section ── */}
                      <div className="p-4 border-t border-gray-100 dark:border-white/[0.06] space-y-3">
                          {/* Section title */}
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              {activeNotifData?.payment_status === "paid"
                                ? "To'lovni o'zgartirish (faqat to'lov turi va izoh)"
                                : "To'lovni tekshirish va tasdiqlash"}
                            </p>
                            {activeNotifData && (
                              <button
                                onClick={() => setActiveNotifData(null)}
                                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Total amount display */}
                          <div className="relative flex items-center justify-between px-4 py-3 bg-orange-50 dark:bg-orange-500/5 border border-orange-200 dark:border-orange-500/20 rounded-xl">
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                                {activeNotifData
                                  ? activeNotifData.payment_status === "paid"
                                    ? "To'langan ✓"
                                    : activeNotifData.payment_status === "partial"
                                      ? "Qoldiq (qisman to'langan)"
                                      : "To'lanishi kerak"
                                  : "Jami to'lov summasi"}
                              </span>
                              {activeNotifData && (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded-md text-[10px] font-bold",
                                      activeNotifData.payment_type === "cash" && "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
                                      activeNotifData.payment_type === "click" && "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400",
                                      activeNotifData.payment_type === "payme" && "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400",
                                      activeNotifData.payment_type === "card" && "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
                                      !["cash","click","payme","card"].includes(activeNotifData.payment_type ?? "") && "bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-gray-400",
                                    )}>
                                      {TYPE_LABEL[activeNotifData.payment_type ?? ""] ?? activeNotifData.payment_type ?? "—"}
                                    </span>
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                      {formatDateTime(activeNotifData.created_at)}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-0.5 mt-0.5">
                                    <span className="text-[12px] text-gray-500 dark:text-gray-400">Jami: <span className="font-bold text-[13px] text-gray-700 dark:text-gray-300">{formatCurrencySum(activeNotifData.total_amount)}</span></span>
                                    {activeNotifData.amount_paid > 0 && (
                                      <span className="text-[12px] text-gray-500 dark:text-gray-400">To'langan: <span className="font-bold text-[13px] text-green-600 dark:text-green-400">{formatCurrencySum(activeNotifData.amount_paid)}</span></span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <span className="text-[18px] font-black text-orange-700 dark:text-orange-300 shrink-0 ml-3">
                              {activeNotifData
                                ? (() => {
                                    const n = activeNotifData;
                                    // "paid" → no remaining debt, never fall back to amount_paid
                                    if (n.payment_status === "paid") return formatCurrencySum(0);
                                    // partial/pending → show remaining, then total, then 0
                                    const amt = n.remaining_amount > 0 ? n.remaining_amount
                                              : n.total_amount > 0    ? n.total_amount
                                              : 0;
                                    return formatCurrencySum(amt);
                                  })()
                                : formatCurrencySum(totalOwed)
                              }
                            </span>
                          </div>

                          {/* 4 inputs in a row */}
                          <div className="flex gap-2 flex-wrap">
                            {/* Received amount */}
                            <div className="flex-1 min-w-[140px]">
                              <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                                {activeNotifData?.payment_status === "paid" ? "To'langan summa" : "Qabul qilingan summa"}
                              </label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={receivedInput.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\s/g, "");
                                  const normalized = normalizeNumber(raw);
                                  if (normalized !== null) setReceivedInput(normalized);
                                }}
                                onFocus={(e) => e.target.select()}
                                placeholder={String(Math.round(netAfterWallet)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
                                disabled={activeNotifData?.payment_status === "paid"}
                                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-bold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all text-gray-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                              />
                            </div>

                            {/* Payment type */}
                            <div className="flex-1 min-w-[120px]">
                              <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                                To'lov turi
                              </label>
                              <select
                                value={paymentType}
                                onChange={(e) => setPaymentType(e.target.value as PaymentProvider)}
                                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-900 dark:text-white"
                              >
                                {PAYMENT_TYPES.map(({ id, label }) => (
                                  <option key={id} value={id}>{label}</option>
                                ))}
                              </select>
                            </div>

                            {/* Flight dropdown (or read-only flight name in edit mode) */}
                            <div className="flex-1 min-w-[200px] relative">
                              <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                                Reys
                              </label>
                              {activeNotifData?.payment_status === "paid" ? (
                                <div className="w-full px-3 py-2.5 bg-gray-100 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-semibold text-gray-700 dark:text-gray-300">
                                  {activeNotifData.flight_name}
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setFlightDropdownOpen((p) => !p)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-left transition-all hover:border-gray-300 dark:hover:border-white/[0.15]"
                                  >
                                    <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 truncate">
                                      {(() => {
                                        if (selectedIds.size === 0) return "Reys tanlang";
                                        const selectedArr = cargos.filter((c) => selectedIds.has(c.cargo_id));
                                        const uniqueFlights = [...new Set(selectedArr.map((c) => c.flight_name))];
                                        if (uniqueFlights.length === 1) return uniqueFlights[0];
                                        if (selectedIds.size === cargos.length) return "Barcha reyslar";
                                        return `${selectedIds.size} ta yuk`;
                                      })()}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${flightDropdownOpen ? "rotate-180" : ""}`} />
                                  </button>
                                  <AnimatePresence>
                                    {flightDropdownOpen && (
                                      <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        className="absolute z-10 left-0 mt-1 min-w-[320px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-lg overflow-hidden"
                                      >
                                        <div className="p-2 border-b border-gray-100 dark:border-white/[0.06]">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedIds(new Set(cargos.map(c => c.cargo_id)));
                                            }}
                                            className="w-full text-[12px] font-semibold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg px-2 py-1.5 transition-colors text-left"
                                          >
                                            Hammasini tanlash
                                          </button>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                                          {flightGroups.map(({ flightName, items, totalWeight, totalAmount }) => {
                                            const allSelected = items.every(c => selectedIds.has(c.cargo_id));
                                            return (
                                              <button
                                                key={flightName}
                                                type="button"
                                                onClick={() => toggleFlight(flightName)}
                                                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors text-left"
                                              >
                                                <div className="flex items-center gap-2.5">
                                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${allSelected ? "bg-orange-500 border-orange-500" : "border-gray-300 dark:border-gray-600"}`}>
                                                    {allSelected && <CheckCheck className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                                  </div>
                                                  <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">{flightName}</span>
                                                </div>
                                                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                                  {totalWeight % 1 === 0 ? totalWeight : totalWeight.toFixed(2)} kg · {formatCurrencySum(totalAmount)}
                                                </span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </>
                              )}
                            </div>

                            {/* Note */}
                            <div className="flex-1 min-w-[140px]">
                              <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                                Izoh (ixtiyoriy)
                              </label>
                              <textarea
                                rows={1}
                                placeholder="Izoh..."
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 resize-none"
                              />
                            </div>
                          </div>

                          {/* Card selector — shown when paymentType === "card" (hide in edit mode) */}
                          <AnimatePresence>
                            {paymentType === "card" && activeNotifData?.payment_status !== "paid" && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                                  Kartani tanlang
                                </p>
                                <div className="space-y-1.5">
                                  {activeCards.length === 0 ? (
                                    <p className="text-[12px] text-gray-400 dark:text-gray-500 text-center py-2">
                                      Faol kartalar yo'q
                                    </p>
                                  ) : (
                                    activeCards.map((card) => {
                                      const isSelected = selectedCardId === card.id;
                                      return (
                                        <button
                                          key={card.id}
                                          type="button"
                                          onClick={() => setSelectedCardId(card.id)}
                                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border-2 text-left transition-all ${
                                            isSelected
                                              ? "border-blue-500 bg-blue-50 dark:bg-blue-500/[0.1]"
                                              : "border-gray-200 dark:border-white/[0.08] hover:border-blue-300 dark:hover:border-blue-500/40 bg-gray-50 dark:bg-white/[0.03]"
                                          }`}
                                        >
                                          <div className="min-w-0">
                                            <p className="text-[13px] font-black text-gray-900 dark:text-white font-mono tracking-wider leading-tight">
                                              {maskCard(card.card_number)}
                                            </p>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                              {card.full_name}
                                              <span className="ml-1.5 text-gray-400 dark:text-gray-500">
                                                · {formatCurrencySum(card.total_collected)}
                                              </span>
                                            </p>
                                          </div>
                                          <div
                                            className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ml-3 transition-colors ${
                                              isSelected
                                                ? "border-blue-500 bg-blue-500"
                                                : "border-gray-300 dark:border-gray-600"
                                            }`}
                                          />
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Wallet toggle — hide in edit mode */}
                          {displayBalance > 0 && activeNotifData?.payment_status !== "paid" && (
                            <button
                              type="button"
                              onClick={() => setUseWallet((p) => !p)}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                                useWallet
                                  ? "bg-green-50 dark:bg-green-500/[0.1] border-green-400 dark:border-green-500/50 shadow-sm shadow-green-500/10"
                                  : "bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15]"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                    useWallet ? "bg-green-500 shadow-sm shadow-green-500/30" : "bg-gray-200 dark:bg-white/[0.1]"
                                  }`}
                                >
                                  <Wallet className="w-4 h-4 text-white" />
                                </div>
                                <div className="text-left">
                                  <p className={`text-[12px] font-bold transition-colors ${useWallet ? "text-green-700 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}>
                                    Hamyon ishlatish
                                  </p>
                                  <p className={`text-[13px] font-black transition-colors ${useWallet ? "text-green-600 dark:text-green-300" : "text-gray-700 dark:text-gray-300"}`}>
                                    {formatCurrencySum(displayBalance)}
                                  </p>
                                </div>
                              </div>
                              <div
                                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                                  useWallet ? "bg-green-500" : "bg-gray-300 dark:bg-white/20"
                                }`}
                              >
                                <span
                                  className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                                    useWallet ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </div>
                            </button>
                          )}

                          {/* Amount breakdown — hide in edit mode */}
                          {activeNotifData?.payment_status !== "paid" && (
                          <div className="pt-1 border-t border-gray-100 dark:border-white/[0.06] space-y-1">
                            <div className="flex items-center justify-between text-[12px]">
                              <span className="text-gray-500 dark:text-gray-400">{selectedIds.size} ta yuk jami:</span>
                              <span className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrencySum(totalOwed)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[12px]">
                              <span className="text-gray-500 dark:text-gray-400">Umumiy hajm:</span>
                              <span className="font-semibold text-gray-800 dark:text-gray-200">
                                {totalSelectedWeight % 1 === 0 ? totalSelectedWeight : totalSelectedWeight.toFixed(2)} kg
                              </span>
                            </div>
                            {walletDeduction > 0 && (
                              <div className="flex items-center justify-between text-[12px]">
                                <span className="text-green-600 dark:text-green-400">Hamyon:</span>
                                <span className="font-semibold text-green-600 dark:text-green-400">−{formatCurrencySum(walletDeduction)}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-[13px] pt-1 border-t border-gray-100 dark:border-white/[0.06]">
                              <span className="font-bold text-gray-700 dark:text-gray-300">To'lash:</span>
                              <span className="font-black text-orange-600 dark:text-orange-400">{formatCurrencySum(netAfterWallet)}</span>
                            </div>
                          </div>
                          )}

                          {/* Confirm / Edit / Reject row */}
                          {activeNotifData?.payment_status === "paid" ? (
                            <motion.button
                              onClick={handleEditSave}
                              disabled={editMut.isPending}
                              whileTap={{ scale: 0.97 }}
                              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-[15px] rounded-2xl shadow-lg shadow-amber-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                              {editMut.isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-5 h-5" />
                              )}
                              O'ZGARTIRISH
                            </motion.button>
                          ) : activeNotifData ? (
                            <div className="flex gap-2">
                              <motion.button
                                onClick={handleOpenConfirm}
                                disabled={payMut.isPending || selectedIds.size === 0}
                                whileTap={{ scale: selectedIds.size === 0 ? 1 : 0.97 }}
                                className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-black text-[15px] rounded-2xl shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                              >
                                <CheckCircle2 className="w-5 h-5" />
                                {selectedIds.size === 0 ? "Yuk tanlang" : `TASDIQLASH (${selectedIds.size} ta · ${formatCurrencySum(receivedAmount)})`}
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                onClick={() => { setRejectModalWithComment(false); setRejectModalOpen(true); }}
                                disabled={rejectMut.isPending}
                                title="Bekor qilish"
                                className="shrink-0 w-14 py-3.5 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-red-500/25 rounded-2xl shadow-lg transition-all disabled:opacity-40 flex items-center justify-center"
                              >
                                {rejectMut.isPending && !rejectModalWithComment ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <X className="w-5 h-5" />
                                )}
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                onClick={() => { setRejectModalWithComment(true); setRejectModalOpen(true); }}
                                disabled={rejectMut.isPending}
                                title="Izoh bilan bekor qilish"
                                className="shrink-0 w-14 py-3.5 border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 rounded-2xl shadow-lg transition-all disabled:opacity-40 flex items-center justify-center"
                              >
                                {rejectMut.isPending && rejectModalWithComment ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <MessageSquare className="w-5 h-5" />
                                )}
                              </motion.button>
                            </div>
                          ) : (
                            <motion.button
                              onClick={handleOpenConfirm}
                              disabled={payMut.isPending || selectedIds.size === 0}
                              whileTap={{ scale: selectedIds.size === 0 ? 1 : 0.97 }}
                              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-black text-[15px] rounded-2xl shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                              {selectedIds.size === 0 ? "Yuk tanlang" : `TASDIQLASH (${selectedIds.size} ta · ${formatCurrencySum(receivedAmount)})`}
                            </motion.button>
                          )}
                        </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Warehouse pickup request card — always visible */}
            <WarehouseRequestCard canProcess={canProcess} activeClientCode={clientInfo?.client_code} />

            {/* Empty state */}
            {!clientInfo && !searchError && !isSearching && (
              <div className="py-16 text-center">
                <Search
                  className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-gray-700"
                  strokeWidth={1.2}
                />
                <p className="text-[15px] font-medium text-gray-400 dark:text-gray-500">
                  Mijoz kodini kiriting
                </p>
                <p className="text-[12px] text-gray-300 dark:text-gray-600 mt-1">
                  To'lovni boshlash uchun qidiring
                </p>
              </div>
            )}
          </div>

          <ResizeHandle onResize={handleCenterResize} />

          {/* ── Right column: Payment Notifications + Pickup Preview (desktop only) ───────────── */}
          <div className="hidden lg:flex flex-col flex-1 min-w-[200px] h-[calc(100dvh-5rem)] gap-3 lg:px-1.5">
            <div className="flex-1 min-h-0">
              <PaymentNotificationDrawer
                mode="inline"
                containerClassName="h-full"
                notifications={paymentNotifications}
                total={paymentTotal}
                page={paymentPage}
                perPage={paymentPerPage}
                unreadCount={paymentUnreadCount}
                filters={paymentFilters}
                setPage={setPaymentPage}
                setFilters={setPaymentFilters}
                resetFilters={handleResetNotifFilters}
                markAllRead={markPaymentNotificationsRead}
                readIds={paymentReadIds}
                onClientClick={handleSearch}
                isLoading={paymentLoading}
                activeTab={notifTab}
                onTabChange={handleNotifTabChange}
                tabCounts={tabCounts ?? { flight: 0, zayafka: 0 }}
                onRefresh={refetchNotifications}
                onClientAndFlightClick={handleClientAndFlightClick}
              />
            </div>
            <PosPickupQueuePreviewCard />
          </div>
        </div>
      </div>

      {/* ── Overlays ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showProfile && clientInfo && (
          <ClientProfileDrawer
            clientCode={clientInfo.client_code}
            clientName={clientInfo.full_name}
            currentBalance={displayBalance}
            onClose={handleCloseProfile}
            onBalanceUpdate={handleBalanceUpdate}
            onRefreshClient={handleRefreshClient}
            canAdjust={canAdjust}
            canUpdateStatus={canUpdateStatus}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmPayload && (
          <ConfirmModal
            payload={confirmPayload}
            onConfirm={handleConfirmPay}
            onCancel={() => setConfirmPayload(null)}
            isPending={payMut.isPending}
          />
        )}
      </AnimatePresence>

      <RejectConfirmModal
        isOpen={rejectModalOpen}
        onConfirm={(comment) => rejectMut.mutate(comment)}
        onCancel={() => setRejectModalOpen(false)}
        isPending={rejectMut.isPending}
        clientCode={activeNotifData?.client_code ?? ""}
        flightName={activeNotifData?.flight_name ?? ""}
        showComment={rejectModalWithComment}
      />

      <CalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        isAdminMode
      />

      <ReceiptScannerModal
        open={isScannerOpen}
        onClose={() => { setIsScannerOpen(false); setScannerOrderId(null); }}
        initialOrderId={scannerOrderId}
        onOpenInPos={(code) => { void handleSearch(code); }}
      />
    </>
  );
}
