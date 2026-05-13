import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  User,
  Wallet,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCheck,
  Square,
  CheckSquare,
  Loader2,
  AlertCircle,
  Package,
  X,
  ChevronRight,
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
} from "lucide-react";
import CalculatorModal from "@/components/modals/CalculatorModal";

import { getAdminJwtClaims } from "@/api/services/adminManagement";
import { refreshAdminToken } from "@/api/services/adminAuth";
import {
  getCashierLog,
  processBulkPayment,
} from "@/api/pos";
import { PICKUP_METHOD_LABELS, PICKUP_PRIORITY_LABELS } from "@/api/pickupQueue";
import { getPaymentCards } from "@/api/pos";
import type { PickupMethod, PickupQueuePriority } from "@/api/pickupQueue";
import {
  useBroadcastChannel,
  type BroadcastMessage,
} from "@/hooks/useBroadcastChannel";
import { usePaymentNotifications } from "@/hooks/usePaymentNotifications";
import { PaymentNotificationDrawer } from "@/components/pos/PaymentNotificationDrawer";
import type {
  PaymentProvider,
  CashierLogProvider,
} from "@/api/pos";
import {
  searchClients,
  getUnpaidCargo,
  normalizeSearchResult,
} from "@/api/verification";
import type { ClientSearchResult, UnpaidCargoItem } from "@/api/verification";
import { formatCurrencySum } from "@/lib/format";
import { normalizeNumber } from "@/utils/numberFormat";
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
import { TodayTotal } from "./components/TodayTotal";
import { CashierLogPanel } from "./components/CashierLogPanel";
import { CargoRow } from "./components/CargoRow";
import { ClientProfileDrawer } from "./components/ClientProfileDrawer";
import { ConfirmModal } from "./components/ConfirmModal";
import type { ConfirmPayload } from "./components/ConfirmModal";
import { ResizeHandle } from "./components/ResizeHandle";

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
    resetFilters: resetPaymentFilters,
    markAllRead: markPaymentNotificationsRead,
    readIds: paymentReadIds,
    isLoading: paymentLoading,
  } = usePaymentNotifications();

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
  const { sendMessage } = useBroadcastChannel(
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

  // Live balance updated after successful balance adjustments without re-fetching client
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const displayBalance = liveBalance ?? clientInfo?.client_balance ?? 0;

  // ── Selection & payment ───────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [paymentType, setPaymentType] = useState<PaymentProvider>("cash");
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [receivedInput, setReceivedInput] = useState("");

  // ── Pickup queue state ──────────────────────────────────────────────────────
  const [createPickupQueue, setCreatePickupQueue] = useState(false);
  const [pickupMethod, setPickupMethod] = useState<PickupMethod>("self_pickup");
  const [pickupPriority, setPickupPriority] = useState<PickupQueuePriority>("normal");
  const [pickupNote, setPickupNote] = useState("");

  // ── UI overlays ───────────────────────────────────────────────────────────
  const [showProfile, setShowProfile] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<ConfirmPayload | null>(
    null,
  );

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const cashierLogParams = useMemo(
    () => ({
      page: 1,
      size: 30,
      date_from: toIsoDateBound(logDateFrom, "start"),
      date_to: toIsoDateBound(logDateTo, "end"),
      payment_provider: logProvider === "all" ? undefined : logProvider,
    }),
    [logDateFrom, logDateTo, logProvider],
  );
  // ── Queries ───────────────────────────────────────────────────────────────
  const {
    data: logData,
    isLoading: logLoading,
    refetch: refetchLog,
  } = useQuery({
    queryKey: ["cashier-log", cashierLogParams],
    queryFn: () => getCashierLog(cashierLogParams),
    // Poll every 10 s so all cashiers see each other's entries in near-real-time
    // without requiring a manual refresh.
    refetchInterval: 10_000,
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
  const allSelected = useMemo(
    () => cargos.length > 0 && cargos.every((c) => selectedIds.has(c.cargo_id)),
    [cargos, selectedIds],
  );
  const someSelected = selectedIds.size > 0;

  // ── Bulk payment mutation ─────────────────────────────────────────────────
  const payMut = useMutation({
    mutationFn: processBulkPayment,
    onSuccess: (result) => {
      const msg = createPickupQueue
        ? `${result.processed_count} ta yuk to'lovi qabul qilindi va warehousega yuborildi! Jami: ${formatCurrencySum(result.total_paid)}`
        : `${result.processed_count} ta yuk to'lovi qabul qilindi! Jami: ${formatCurrencySum(result.total_paid)}`;
      toast.success(msg);
      setSelectedIds(new Set());
      setReceivedInput("");
      setConfirmPayload(null);
      setCreatePickupQueue(false);
      setPickupMethod("self_pickup");
      setPickupPriority("normal");
      setPickupNote("");
      // Aggressively invalidate all POS-related query keys
      queryClient.invalidateQueries({ queryKey: ["pos-unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["cashier-log"] });
      queryClient.invalidateQueries({ queryKey: ["pos-txn"] });
      queryClient.invalidateQueries({ queryKey: ["client-info"] });
      // Refresh client wallet balance in the background
      if (clientInfo) {
        void handleSearch(clientInfo.client_code);
      }
      refetchLog();
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

  // Auto-fill received input when selection/wallet changes (only if user hasn't manually edited)
  const userEditedRef = useRef(false);
  const prevNetRef = useRef(0);
  useEffect(() => {
    const net = totalOwed - (useWallet ? Math.min(displayBalance, totalOwed) : 0);
    if (!userEditedRef.current || net !== prevNetRef.current) {
      setReceivedInput(net > 0 ? String(Math.round(net)) : "");
      prevNetRef.current = net;
    }
  }, [totalOwed, useWallet, displayBalance]);

  const receivedAmount = parseFloat(receivedInput) || netAfterWallet;

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(
    async (overrideCode?: string) => {
      const query = (overrideCode ?? searchInput).trim().toUpperCase();
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
    [searchInput],
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
    setCreatePickupQueue(false);
    setPickupMethod("self_pickup");
    setPickupNote("");
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  // ── Cargo selection ───────────────────────────────────────────────────────
  const toggleAll = useCallback(() => {
    setSelectedIds(
      allSelected ? new Set() : new Set(cargos.map((c) => c.cargo_id)),
    );
  }, [allSelected, cargos]);

  const toggleCargo = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
    const idempotencyKey = crypto.randomUUID();
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
      create_pickup_queue: createPickupQueue || undefined,
      pickup_method: createPickupQueue ? pickupMethod : null,
      pickup_priority: createPickupQueue ? pickupPriority : undefined,
      pickup_note: createPickupQueue ? (pickupNote.trim() || null) : null,
      pickup_idempotency_key: createPickupQueue ? idempotencyKey : null,
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
                resetFilters={resetPaymentFilters}
                markAllRead={markPaymentNotificationsRead}
                readIds={paymentReadIds}
                onClientClick={handleSearch}
                isLoading={paymentLoading}
              />
            </div>

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
               Always rendered so the layout stays consistent.
               Content is gated behind pos:read; otherwise shows a lock panel. */}
          <div className="shrink-0 space-y-3 lg:px-1.5 lg:w-[var(--pos-left-w)]">
            {canRead ? (
              <>
                <TodayTotal
                  total={logData?.today_total ?? 0}
                  loading={logLoading}
                />
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
                />
              </>
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

          <ResizeHandle onResize={(d) => setLeftWidth((w) => Math.max(200, Math.min(480, w + d)))} />

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

            {/* Client card — clicking opens the profile drawer */}
            <AnimatePresence>
              {clientInfo && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  onClick={() => setShowProfile(true)}
                  className="bg-white dark:bg-[#161616] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm p-4 cursor-pointer hover:border-orange-200/80 dark:hover:border-orange-500/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/[0.1] flex items-center justify-center">
                        <User
                          className="w-5 h-5 text-orange-500"
                          strokeWidth={1.8}
                        />
                      </div>
                      <div>
                        <p className="text-[15px] font-bold text-gray-900 dark:text-white">
                          {clientInfo.full_name}
                        </p>
                        <p className="text-[12px] font-mono text-gray-500 dark:text-gray-400">
                          {clientInfo.client_code}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inline lock — shown when a client is found but the admin cannot process payments */}
            <AnimatePresence>
              {!canProcess && clientInfo && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="bg-white dark:bg-[#161616] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm p-6 flex flex-col items-center justify-center gap-3 text-center"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
                    <Lock className="w-5 h-5 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
                  </div>
                  <p className="text-[12px] text-gray-400 dark:text-gray-500 max-w-[220px]">
                    Sizda to'lov qabul qilish huquqi yo'q
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cargo list — only visible to users who can process payments */}
            <AnimatePresence>
              {canProcess && clientInfo && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white dark:bg-[#161616] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-white/[0.05] sticky top-0 bg-white dark:bg-[#161616] z-10">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        onClick={toggleAll}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          allSelected
                            ? "bg-orange-500 border-orange-500"
                            : someSelected
                              ? "bg-orange-200 border-orange-300 dark:bg-orange-500/20 dark:border-orange-500/40"
                              : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {allSelected ? (
                          <CheckCheck
                            className="w-3 h-3 text-white"
                            strokeWidth={3}
                          />
                        ) : someSelected ? (
                          <Square
                            className="w-3 h-3 text-orange-500"
                            strokeWidth={3}
                          />
                        ) : (
                          <CheckSquare className="w-3 h-3 text-transparent" />
                        )}
                      </div>
                      <span className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">
                        Barchasini tanlash
                      </span>
                    </label>
                    {cargos.length > 0 && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        {cargoData?.total_count ?? cargos.length} ta yuk
                      </span>
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    {cargoLoading ? (
                      <div className="space-y-2 py-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="h-16 bg-gray-50 dark:bg-white/[0.04] rounded-xl animate-pulse"
                          />
                        ))}
                      </div>
                    ) : cargos.length === 0 ? (
                      <div className="py-10 text-center">
                        <Package
                          className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600"
                          strokeWidth={1.5}
                        />
                        <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400">
                          Qarzdorlik yo'q
                        </p>
                        <p className="text-[12px] text-gray-400 dark:text-gray-600 mt-1">
                          Barcha yuklar uchun to'lov qilingan
                        </p>
                      </div>
                    ) : (
                      cargos.map((cargo) => (
                        <CargoRow
                          key={cargo.cargo_id}
                          cargo={cargo}
                          isSelected={selectedIds.has(cargo.cargo_id)}
                          onToggle={() => toggleCargo(cargo.cargo_id)}
                        />
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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

            {/* ── Sticky payment footer (pos:process required) ───────────── */}
            <AnimatePresence>
              {canProcess && someSelected && clientInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 24 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  className="sticky bottom-4 z-30"
                >
                  <div className="bg-white/95 dark:bg-[#161616]/95 backdrop-blur-xl rounded-2xl border border-black/[0.08] dark:border-white/[0.1] shadow-2xl shadow-black/10 dark:shadow-black/40 p-4 space-y-3">
                    {/* Payment type pills */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider shrink-0">
                        To'lov:
                      </span>
                      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl flex-wrap">
                        {PAYMENT_TYPES.map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() => setPaymentType(id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                              paymentType === id
                                ? "bg-white dark:bg-[#222] text-gray-900 dark:text-white shadow-sm"
                                : "text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            {id === "cash" && (
                              <Banknote className="w-3.5 h-3.5" />
                            )}
                            {id === "card" && (
                              <CreditCard className="w-3.5 h-3.5" />
                            )}
                            {(id === "click" || id === "payme") && (
                              <Smartphone className="w-3.5 h-3.5" />
                            )}
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Card selector — shown when paymentType === "card" */}
                    <AnimatePresence>
                      {paymentType === "card" && (
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

                    {/* Wallet toggle — large, prominent block */}
                    {displayBalance > 0 && (
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
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                              useWallet
                                ? "bg-green-500 shadow-sm shadow-green-500/30"
                                : "bg-gray-200 dark:bg-white/[0.1]"
                            }`}
                          >
                            <Wallet className="w-5 h-5 text-white" />
                          </div>
                          <div className="text-left">
                            <p
                              className={`text-[12px] font-bold transition-colors ${
                                useWallet
                                  ? "text-green-700 dark:text-green-400"
                                  : "text-gray-500 dark:text-gray-400"
                              }`}
                            >
                              Hamyon ishlatish
                            </p>
                            <p
                              className={`text-[14px] font-black transition-colors ${
                                useWallet
                                  ? "text-green-600 dark:text-green-300"
                                  : "text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {formatCurrencySum(displayBalance)}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                            useWallet
                              ? "bg-green-500"
                              : "bg-gray-300 dark:bg-white/20"
                          }`}
                        >
                          <span
                            className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                              useWallet ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </div>
                      </button>
                    )}

                    {/* Received amount input */}
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                        Qabul qilingan summa (UZS)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={receivedInput}
                        onChange={(e) => {
                          const normalized = normalizeNumber(e.target.value);
                          if (normalized !== null) setReceivedInput(normalized);
                        }}
                        onFocus={(e) => e.target.select()}
                        placeholder={String(Math.round(netAfterWallet))}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[15px] font-bold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all text-gray-900 dark:text-white"
                      />
                    </div>

                    {/* Amount breakdown */}
                    <div className="pt-1 border-t border-gray-100 dark:border-white/[0.06] space-y-1">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-gray-500 dark:text-gray-400">
                          {selectedIds.size} ta yuk jami:
                        </span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {formatCurrencySum(totalOwed)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-gray-500 dark:text-gray-400">
                          Umumiy hajm:
                        </span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {totalSelectedWeight % 1 === 0
                            ? totalSelectedWeight
                            : totalSelectedWeight.toFixed(2)}{" "}
                          kg
                        </span>
                      </div>
                      {walletDeduction > 0 && (
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-green-600 dark:text-green-400">
                            Hamyon:
                          </span>
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            −{formatCurrencySum(walletDeduction)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[13px] pt-1 border-t border-gray-100 dark:border-white/[0.06]">
                        <span className="font-bold text-gray-700 dark:text-gray-300">
                          To'lash:
                        </span>
                        <span className="font-black text-orange-600 dark:text-orange-400">
                          {formatCurrencySum(netAfterWallet)}
                        </span>
                      </div>
                    </div>

                    {/* Pickup queue toggle */}
                    <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => setCreatePickupQueue((p) => !p)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all ${
                          createPickupQueue
                            ? "bg-blue-50 dark:bg-blue-500/[0.1] border-blue-400 dark:border-blue-500/50"
                            : "bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              createPickupQueue ? "bg-blue-500" : "bg-gray-200 dark:bg-white/[0.1]"
                            }`}
                          >
                            <Package className="w-4 h-4 text-white" />
                          </div>
                          <span
                            className={`text-[12px] font-bold ${
                              createPickupQueue
                                ? "text-blue-700 dark:text-blue-400"
                                : "text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            Warehousega yuborish
                          </span>
                        </div>
                        <div
                          className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                            createPickupQueue ? "bg-blue-500" : "bg-gray-300 dark:bg-white/20"
                          }`}
                        >
                          <span
                            className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                              createPickupQueue ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </div>
                      </button>

                      {createPickupQueue && (
                        <div className="space-y-2">
                          <select
                            value={pickupMethod}
                            onChange={(e) => setPickupMethod(e.target.value as PickupMethod)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 text-gray-700 dark:text-gray-200"
                          >
                            {(Object.keys(PICKUP_METHOD_LABELS) as PickupMethod[]).map((m) => (
                              <option key={m} value={m}>
                                {PICKUP_METHOD_LABELS[m]}
                              </option>
                            ))}
                          </select>
                          <select
                            value={pickupPriority}
                            onChange={(e) => setPickupPriority(e.target.value as PickupQueuePriority)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 text-gray-700 dark:text-gray-200"
                          >
                            {(Object.keys(PICKUP_PRIORITY_LABELS) as PickupQueuePriority[]).map((p) => (
                              <option key={p} value={p}>
                                {PICKUP_PRIORITY_LABELS[p]}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={pickupNote}
                            onChange={(e) => setPickupNote(e.target.value.slice(0, 200))}
                            placeholder="Izoh (ixtiyoriy)"
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 text-gray-900 dark:text-white placeholder:text-gray-400"
                          />
                        </div>
                      )}
                    </div>

                    {/* Pay button */}
                    <motion.button
                      onClick={handleOpenConfirm}
                      disabled={payMut.isPending}
                      whileTap={{ scale: 0.97 }}
                      className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-[16px] rounded-2xl shadow-lg shadow-orange-500/25 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      <ChevronRight className="w-5 h-5" />
                      TO'LASH ({selectedIds.size} ta ·{" "}
                      {formatCurrencySum(netAfterWallet)})
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <ResizeHandle onResize={(d) => setCenterWidth((w) => Math.max(320, Math.min(800, w + d)))} />

          {/* ── Right column: Payment Notifications (desktop only) ───────────── */}
          <div className="hidden lg:block flex-1 min-w-[200px] space-y-3 lg:px-1.5">
            <PaymentNotificationDrawer
              mode="inline"
              notifications={paymentNotifications}
              total={paymentTotal}
              page={paymentPage}
              perPage={paymentPerPage}
              unreadCount={paymentUnreadCount}
              filters={paymentFilters}
              setPage={setPaymentPage}
              setFilters={setPaymentFilters}
              resetFilters={resetPaymentFilters}
              markAllRead={markPaymentNotificationsRead}
              readIds={paymentReadIds}
              onClientClick={handleSearch}
              isLoading={paymentLoading}
            />
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

      <CalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        isAdminMode
      />
    </>
  );
}
