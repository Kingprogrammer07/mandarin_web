import { useState, useEffect, useCallback, useRef } from "react";
import {
  Warehouse,
  LogOut,
  Sun,
  Moon,
  ArrowLeft,
  Plane,
  ClipboardList,
  Lock,
  PackageSearch,
  PackageCheck,
  Bell,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { getAdminJwtClaims } from "../../api/services/adminManagement";
import { refreshAdminToken } from "../../api/services/adminAuth";
import { useWarehouseStore } from "../../store/useWarehouseStore";
import { useGroupedWarehouseSearch } from "../../api/hooks/useWarehouse";
import { useWarehouseQueueProcessor } from "../../api/hooks/useWarehouseQueueProcessor";
import RoleSwitcher from "../../components/admin/RoleSwitcher";
import {
  useWarehousePickupQueueCount,
  useWarehousePickupQueueList,
} from "../../api/hooks/usePickupQueue";
import WarehouseFilters from "../../components/warehouse/WarehouseFilters";
import GroupedTransactionsList from "../../components/warehouse/GroupedTransactionsList";
import MyActivityList, { type ActivityScope, type ActivityItemData } from "../../components/warehouse/MyActivityList";
import MarkTakenModal from "../../components/warehouse/MarkTakenModal";
import WarehouseOfflineManager from "../../components/warehouse/WarehouseOfflineManager";
import UzPostOrdersPanel from "../../components/warehouse/UzPostOrdersPanel";
import PickupQueuePanel from "../../components/warehouse/PickupQueuePanel";
import { useBroadcastChannel, type BroadcastMessage, type PosNotificationPayload } from "../../hooks/useBroadcastChannel";
import type { DeliveryMethodOption } from "../../api/services/warehouse";
import { revertTakenStatus } from "../../api/services/warehouse";
import type { PickupMethod, PickupQueuePriority } from "../../api/pickupQueue";
import { PICKUP_PRIORITY_LABELS } from "../../api/pickupQueue";
import { playNotificationSound } from "../../utils/notificationSounds";
import {
  requestNotificationPermission,
  showLocalNotification,
  vibratePattern,
  isPageVisible,
} from "../../utils/pushNotifications";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab = "transactions" | "my-activity" | "uzpost-orders";

interface WarehousePageProps {
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

// ── Theme helper ──────────────────────────────────────────────────────────────

function getInitialTheme(): boolean {
  return (
    localStorage.getItem("adminTheme") === "dark" ||
    (!("adminTheme" in localStorage) &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
        <Lock className="w-8 h-8 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[16px] font-bold text-gray-700 dark:text-gray-300">Ruxsat yo'q</p>
        <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
          Ombor sahifasini ko'rish uchun huquqingiz yo'q.
        </p>
      </div>
    </div>
  );
}

export default function WarehousePage({ onNavigate, onLogout }: WarehousePageProps) {
  // Start background upload queue processor for this session
  useWarehouseQueueProcessor();

  const {
    flightName,
    searchQuery,
    strictSearch,
    paymentStatus,
    takenStatus,
    page,
    size,
    setPage,
  } = useWarehouseStore();

  const [jwtClaims, setJwtClaims] = useState(() => getAdminJwtClaims());
  const [isDark, setIsDark] = useState(getInitialTheme);

  const canView = jwtClaims.isSuperAdmin || jwtClaims.permissions.has('warehouse:read');
  const canMarkTaken = jwtClaims.isSuperAdmin || jwtClaims.permissions.has('warehouse:mark_taken');
  const canCancelQueue = jwtClaims.isSuperAdmin || jwtClaims.permissions.has('pickup_queue:cancel');
  const canViewExpectedCargo = jwtClaims.isSuperAdmin || jwtClaims.permissions.has('expected_cargo:manage');
  const [activeTab, setActiveTab] = useState<ActiveTab>("transactions");
  const [activityPage, setActivityPage] = useState(1);
  const [activityScope, setActivityScope] = useState<ActivityScope>("self");
  const [activityClientCode, setActivityClientCode] = useState("");
  const [activityStrict, setActivityStrict] = useState(false);

  // Mark-taken modal state
  const [modalTxIds, setModalTxIds] = useState<number[]>([]);
  const [modalClientCode, setModalClientCode] = useState("");
  const [modalFlightName, setModalFlightName] = useState("");
  const [modalDeliveryMethods, setModalDeliveryMethods] = useState<DeliveryMethodOption[]>([]);
  const [modalIsTakenAway, setModalIsTakenAway] = useState(false);
  const [modalPreSelectedDeliveryMethod, setModalPreSelectedDeliveryMethod] = useState<string | undefined>(undefined);
  const [modalIsRedelivery, setModalIsRedelivery] = useState(false);

  // Pickup queue panel state
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [queuePickupMethod, setQueuePickupMethod] = useState<PickupMethod | "all">("all");
  const [queuePriority, setQueuePriority] = useState<PickupQueuePriority | "all">("all");
  const [queueClientCode, setQueueClientCode] = useState("");

  // Bell sound state
  const [soundMuted, setSoundMuted] = useState(() => {
    try { return localStorage.getItem("warehouse_bell_muted") === "true"; } catch { return false; }
  });
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const prevCountsRef = useRef<{
    preparing_count: number;
    priority_counts: Record<string, number>;
    hasFetched: boolean;
  }>({ preparing_count: 0, priority_counts: {}, hasFetched: false });
  const lastSoundTimeRef = useRef(0);

  const toggleMute = useCallback(() => {
    setSoundMuted((prev) => {
      const next = !prev;
      localStorage.setItem("warehouse_bell_muted", String(next));
      return next;
    });
  }, []);

  const { data: queueCount } = useWarehousePickupQueueCount({
    status: "preparing",
    pickup_method: queuePickupMethod === "all" ? undefined : queuePickupMethod,
  });

  // ── Notifications permission (ask once on first user gesture) ───────────────
  const notifPermissionRef = useRef<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied",
  );

  const unlockAudio = useCallback(() => {
    if (!audioUnlocked) setAudioUnlocked(true);
    // Also try to get notification permission on first interaction
    if (notifPermissionRef.current === "default") {
      requestNotificationPermission().then((perm) => {
        notifPermissionRef.current = perm;
      });
    }
  }, [audioUnlocked]);

  // ── Bell audio + background alerts ────────────────────────────────────────────
  const playBellAlert = useCallback((urgent: boolean) => {
    if (!soundMuted && audioUnlocked) {
      const now = Date.now();
      if (now - lastSoundTimeRef.current >= 2500) {
        lastSoundTimeRef.current = now;
        playNotificationSound(urgent, { volume: urgent ? 0.8 : 0.7 });
      }
    }

    // Background notification when tab is hidden
    if (!isPageVisible()) {
      vibratePattern(urgent ? [300, 100, 300, 100, 300] : [200, 100, 200]);
      showLocalNotification({
        title: urgent ? "🔥 VIP so'rov keldi!" : "📦 Yangi navbat",
        body: urgent
          ? "Yangi shoshilinch navbat warehousega tushdi. Ilovani oching."
          : "Yangi navbat warehousega tushdi. Ilovani oching.",
        tag: urgent ? "pickup-queue-urgent" : "pickup-queue",
        requireInteraction: urgent,
        vibrate: urgent ? [300, 100, 300, 100, 300] : [200, 100, 200],
      });
    }
  }, [soundMuted, audioUnlocked]);

  useEffect(() => {
    if (!queueCount) return;
    const prev = prevCountsRef.current;

    if (prev.hasFetched) {
      const totalIncreased = queueCount.preparing_count > prev.preparing_count;
      const vipIncreased = (queueCount.priority_counts["vip"] ?? 0) > (prev.priority_counts["vip"] ?? 0);
      const highIncreased = (queueCount.priority_counts["high"] ?? 0) > (prev.priority_counts["high"] ?? 0);

      if (totalIncreased) {
        playBellAlert(vipIncreased || highIncreased);
      }
    } else {
      prev.hasFetched = true;
    }

    prev.preparing_count = queueCount.preparing_count;
    prev.priority_counts = { ...queueCount.priority_counts };
  }, [queueCount, playBellAlert]);

  const hasUrgentQueues =
    (queueCount?.priority_counts["vip"] ?? 0) > 0 ||
    (queueCount?.priority_counts["high"] ?? 0) > 0;

  const { data: queueListData, isLoading: queueListLoading } = useWarehousePickupQueueList({
    status: "preparing",
    pickup_method: queuePickupMethod === "all" ? undefined : queuePickupMethod,
    priority: queuePriority === "all" ? undefined : queuePriority,
    client_code: queueClientCode.trim() || undefined,
    page: 1,
    size: 50,
  });

  // Apply theme immediately on mount and on every toggle
  useEffect(() => {
    if (isDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("adminTheme", next ? "dark" : "light");
    if (next) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [isDark]);

  // Silent token refresh on mount so permissions stay current
  useEffect(() => {
    let cancelled = false;
    refreshAdminToken()
      .then((data) => {
        if (cancelled) return;
        localStorage.setItem("access_token", data.access_token);
        setJwtClaims(getAdminJwtClaims());
      })
      .catch(() => {
        /* Non-fatal — continue with existing token */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isFlightMode = flightName.trim().length > 0;
  const isSearchMode = !isFlightMode && searchQuery.trim().length > 0;
  const isEnabled = isFlightMode || isSearchMode;

  const { data: activeData, isLoading } = useGroupedWarehouseSearch(
    {
      flight: isFlightMode ? flightName : undefined,
      code: isSearchMode ? searchQuery : undefined,
      strict: strictSearch,
      payment_status: paymentStatus,
      taken_status: takenStatus,
      page,
      size,
    },
    isEnabled,
  );

  const handleMarkTaken = useCallback(
    (
      transactionIds: number[],
      clientCode: string,
      txFlightName: string,
      isTakenAway: boolean,
      deliveryMethods: DeliveryMethodOption[],
    ) => {
      setModalTxIds(transactionIds);
      setModalClientCode(clientCode);
      setModalFlightName(txFlightName);
      setModalDeliveryMethods(deliveryMethods);
      setModalIsTakenAway(isTakenAway);
      setModalPreSelectedDeliveryMethod(undefined);
      setModalIsRedelivery(false);
    },
    [],
  );

  const handleRevertTaken = useCallback(
    async (transactionId: number, clientCode: string, flightName: string) => {
      if (!confirm(`${clientCode} - ${flightName} reysidagi yukni "Berilgan" holatidan qaytarib olishni xohlaysizmi?`)) {
        return;
      }
      try {
        await revertTakenStatus(transactionId);
        toast.success("Yuk holati qaytarildi", {
          description: `${clientCode} - ${flightName}`,
        });
        // Refetch data
        setPage(1);
      } catch (err: unknown) {
        const e = err as { message?: string };
        toast.error(e.message ?? "Holatni qaytarishda xatolik");
      }
    },
    [setPage],
  );

  const handlePageChange = useCallback(
    (newPage: number) => setPage(newPage),
    [setPage],
  );

  const { sendMessage } = useBroadcastChannel(
    useCallback((msg: BroadcastMessage) => {
      if (msg.type !== "CASHIER_ACK") return;
      const { clientCode, flightName } = msg.payload;
      toast.success(`Kassir ko'rdi: ${clientCode}`, {
        description: `Reys: ${flightName}`,
        duration: 5000,
      });
    }, []),
  );

  const handleNotifyCashier = useCallback(
    (clientCode: string, flightName: string, amount: number) => {
      sendMessage({
        type: "POS_NOTIFY",
        payload: {
          id: `wh-${Date.now()}`,
          timestamp: new Date().toISOString(),
          clientCode,
          clientName: clientCode,
          flightName,
          amountPaid: amount,
          totalAmount: amount,
          remainingAmount: 0,
          paymentStatus: "pending",
          paymentType: "cash",
          currency: "UZS",
        } as PosNotificationPayload,
      });
      toast.success(`Kassirga xabar yuborildi: ${clientCode}`, {
        description: `Reys: ${flightName}`,
        duration: 3000,
      });
    },
    [sendMessage],
  );

  const handleActivityPageChange = useCallback(
    (newPage: number) => setActivityPage(newPage),
    [],
  );

  const handleActivityScopeChange = useCallback((scope: ActivityScope) => {
    setActivityScope(scope);
    setActivityPage(1);
  }, []);

  const handleActivityClientCodeChange = useCallback((value: string) => {
    setActivityClientCode(value);
    setActivityPage(1);
  }, []);

  const handleActivityStrictChange = useCallback((value: boolean) => {
    setActivityStrict(value);
    setActivityPage(1);
  }, []);

  if (!canView) return <AccessDenied />;

  return (
    <div className="min-h-screen bg-[#f5f5f4] dark:bg-[#0a0a0a]">

      {/* ── Sticky Header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3">

          {/* Title row */}
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => window.history.back()}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                aria-label="Orqaga"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                  <Warehouse className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" />
                </div>
                <div>
                  <h1 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white leading-tight">
                    Ombor
                  </h1>
                  {activeTab === "transactions" && activeData && (isFlightMode || isSearchMode) && (
                    <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
                      {activeData.total_count} ta yuk
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-0.5 sm:gap-1">
              <span className="hidden sm:inline text-[12px] text-gray-500 dark:text-gray-400 mr-1">
                {jwtClaims.role_name}
              </span>
              {/* Pickup queue bell */}
              <button
                onClick={() => {
                  unlockAudio();
                  setShowQueuePanel((p) => !p);
                }}
                className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                  hasUrgentQueues
                    ? "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 animate-pulse"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                }`}
                title="Navbatlar"
              >
                <Bell className="w-4 h-4" />
                {/* Total count */}
                {(queueCount?.preparing_count ?? 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {queueCount!.preparing_count}
                  </span>
                )}
                {/* VIP indicator */}
                {(queueCount?.priority_counts["vip"] ?? 0) > 0 && (
                  <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full bg-purple-500 border-2 border-white dark:border-[#111]" />
                )}
              </button>
              {/* Mute toggle */}
              <button
                onClick={() => { unlockAudio(); toggleMute(); }}
                className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                  soundMuted
                    ? "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                    : "text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10"
                }`}
                title={soundMuted ? "Ovozni yoqish" : "Ovozni o'chirish"}
              >
                {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              {canViewExpectedCargo && (
                <button
                  onClick={() => onNavigate('expected-cargo')}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                  title="Kutilayotgan yuklar"
                >
                  <PackageSearch className="w-4 h-4" />
                </button>
              )}
              <RoleSwitcher onNavigate={onNavigate} />
              <button
                onClick={toggleTheme}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                title={isDark ? "Kunduzgi rejim" : "Tungi rejim"}
              >
                {isDark ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={onLogout}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                title="Chiqish"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab switcher — full-width on mobile for larger tap targets */}
          <div className="flex gap-1 bg-gray-100 dark:bg-white/[0.05] rounded-xl p-1 mb-2 sm:mb-3 w-full sm:w-fit">
            <button
              onClick={() => setActiveTab("transactions")}
              className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                activeTab === "transactions"
                  ? "bg-white dark:bg-white/[0.09] text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <Plane className="w-3.5 h-3.5" />
              Reyslar
            </button>
            <button
              onClick={() => setActiveTab("my-activity")}
              className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                activeTab === "my-activity"
                  ? "bg-white dark:bg-white/[0.09] text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Faolligim
            </button>
            <button
              onClick={() => setActiveTab("uzpost-orders")}
              className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                activeTab === "uzpost-orders"
                  ? "bg-white dark:bg-white/[0.09] text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              UzPost
            </button>
          </div>

          {/* Filters — only shown on Transactions tab */}
          {activeTab === "transactions" && <WarehouseFilters />}
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
        {activeTab === "transactions" ? (
          !isFlightMode && !isSearchMode ? (
            // Prompt: neither flight nor search term provided
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-24 text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-orange-50 dark:bg-orange-500/[0.08] border border-orange-100 dark:border-orange-500/15 flex items-center justify-center">
                <Plane
                  className="w-8 h-8 text-orange-400 dark:text-orange-500"
                  strokeWidth={1.5}
                />
              </div>
              <h2 className="text-[16px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Reys yoki mijoz kodini kiriting
              </h2>
              <p className="text-[13px] text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
                Reys tanlang yoki mijoz kodini yozing — reyzsiz ham barcha yuklar bo'yicha qidiradi
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <GroupedTransactionsList
                items={activeData?.items ?? []}
                isLoading={isLoading}
                onMarkTaken={handleMarkTaken}
                onRevertTaken={handleRevertTaken}
                canMarkTaken={canMarkTaken}
                onNotifyCashier={handleNotifyCashier}
              />
              
              {/* Basic Pagination - if activeData is paginated. Note Grouped doesn't give total_pages yet, but we calculate it */}
              {activeData && activeData.total_count > size && (
                <nav aria-label="Sahifalar" className="flex items-center justify-center gap-1.5 pt-2 pb-4">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    aria-label="Oldingi sahifa"
                    className="w-11 h-11 flex items-center justify-center rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors shadow-sm"
                  >
                    O'tgan
                  </button>
                  <span className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 font-bold">
                    Sahifa {page}
                  </span>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page * size >= activeData.total_count}
                    aria-label="Keyingi sahifa"
                    className="w-11 h-11 flex items-center justify-center rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors shadow-sm"
                  >
                    Keyingi
                  </button>
                </nav>
              )}
            </div>
          )
        ) : activeTab === "my-activity" ? (
          <MyActivityList
            scope={activityScope}
            onScopeChange={handleActivityScopeChange}
            clientCode={activityClientCode}
            onClientCodeChange={handleActivityClientCodeChange}
            strict={activityStrict}
            onStrictChange={handleActivityStrictChange}
            page={activityPage}
            onPageChange={handleActivityPageChange}
            onRedeliver={(item: ActivityItemData) => {
              if (!item.transaction_ids?.length || !item.client_code) return;
              setModalTxIds(item.transaction_ids);
              setModalClientCode(item.client_code ?? "");
              setModalFlightName(item.flight_name ?? "");
              setModalPreSelectedDeliveryMethod(item.delivery_method ?? undefined);
              setModalIsRedelivery(true);
              // Derive delivery methods from the item's delivery_method
              if (item.delivery_method) {
                setModalDeliveryMethods([
                  { value: item.delivery_method, label: item.delivery_method_label ?? item.delivery_method },
                ]);
              } else {
                setModalDeliveryMethods([]);
              }
              setModalIsTakenAway(false);
            }}
          />
        ) : (
          <UzPostOrdersPanel />
        )}
      </div>

      {/* ── Full-screen Pickup Queue Panel ──────────────────────────────── */}
      <AnimatePresence>
        {showQueuePanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-[#f5f5f4] dark:bg-[#0a0a0a] flex flex-col"
          >
            {/* Panel Header */}
            <div className="shrink-0 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-white/[0.08]">
              <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                      <Bell className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">
                        Navbatlar
                      </h2>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {queueCount?.preparing_count ?? 0} ta tayyorlanmoqda
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowQueuePanel(false)}
                    className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Filters row */}
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Method filter */}
                  <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/[0.05] rounded-xl overflow-x-auto">
                    {(["all", "self_pickup", "yandex", "bts", "uzpost", "mandarin"] as (PickupMethod | "all")[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setQueuePickupMethod(m)}
                        className={`flex-1 min-w-[72px] px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                          queuePickupMethod === m
                            ? "bg-white dark:bg-white/[0.09] text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                        }`}
                      >
                        {m === "all" ? "Barchasi" : m === "self_pickup" ? "O'zi" : m.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {/* Priority filter */}
                  <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/[0.05] rounded-xl overflow-x-auto">
                    {(["vip", "high", "normal", "all"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setQueuePriority(p)}
                        className={`flex-1 min-w-[60px] px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                          queuePriority === p
                            ? "bg-white dark:bg-white/[0.09] text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                        }`}
                      >
                        {p === "all" ? "Barcha" : PICKUP_PRIORITY_LABELS[p]}
                      </button>
                    ))}
                  </div>

                  {/* Client code search */}
                  <div className="relative min-w-[140px]">
                    <input
                      type="text"
                      value={queueClientCode}
                      onChange={(e) => setQueueClientCode(e.target.value.toUpperCase())}
                      placeholder="Mijoz kodi"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-900 dark:text-white placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
                <PickupQueuePanel
                  items={queueListData?.items ?? []}
                  isLoading={queueListLoading}
                  pickupMethod={queuePickupMethod}
                  onPickupMethodChange={setQueuePickupMethod}
                  onMarkTaken={handleMarkTaken}
                  onRevertTaken={handleRevertTaken}
                  canMarkTaken={canMarkTaken}
                  canCancel={canCancelQueue}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mark Taken Modal ──────────────────────────────────────────────── */}
      {modalTxIds.length > 0 && (
        <MarkTakenModal
          transactionIds={modalTxIds}
          clientCode={modalClientCode}
          flightName={modalFlightName}
          deliveryMethods={modalDeliveryMethods}
          isTakenAway={modalIsTakenAway}
          preSelectedDeliveryMethod={modalPreSelectedDeliveryMethod}
          isRedelivery={modalIsRedelivery}
          isOpen={modalTxIds.length > 0}
          onClose={() => {
            setModalTxIds([]);
            setModalDeliveryMethods([]);
            setModalPreSelectedDeliveryMethod(undefined);
            setModalIsRedelivery(false);
          }}
        />
      )}

      {/* ── Background upload queue manager ───────────────────────────────── */}
      <WarehouseOfflineManager />
    </div>
  );
}
