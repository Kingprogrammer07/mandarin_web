import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { getAdminJwtClaims } from "../../api/services/adminManagement";
import { refreshAdminToken } from "../../api/services/adminAuth";
import { useWarehouseStore } from "../../store/useWarehouseStore";
import { useGroupedWarehouseSearch } from "../../api/hooks/useWarehouse";
import { useWarehouseQueueProcessor } from "../../api/hooks/useWarehouseQueueProcessor";
import WarehouseFilters from "../../components/warehouse/WarehouseFilters";
import GroupedTransactionsList from "../../components/warehouse/GroupedTransactionsList";
import MyActivityList from "../../components/warehouse/MyActivityList";
import MarkTakenModal from "../../components/warehouse/MarkTakenModal";
import WarehouseOfflineManager from "../../components/warehouse/WarehouseOfflineManager";
import { useBroadcastChannel, type BroadcastMessage } from "../../hooks/useBroadcastChannel";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab = "transactions" | "my-activity";

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
  const canViewExpectedCargo = jwtClaims.isSuperAdmin || jwtClaims.permissions.has('expected_cargo:manage');
  const [activeTab, setActiveTab] = useState<ActiveTab>("transactions");
  const [activityPage, setActivityPage] = useState(1);

  // Mark-taken modal state
  const [modalTxIds, setModalTxIds] = useState<number[]>([]);
  const [modalClientCode, setModalClientCode] = useState("");
  const [modalFlightName, setModalFlightName] = useState("");
  const [modalIsTakenAway, setModalIsTakenAway] = useState(false);

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
      payment_status: paymentStatus,
      taken_status: takenStatus,
      page,
      size,
    },
    isEnabled,
  );

  const handleMarkTaken = useCallback(
    (transactionIds: number[], clientCode: string, txFlightName: string, isTakenAway: boolean) => {
      setModalTxIds(transactionIds);
      setModalClientCode(clientCode);
      setModalFlightName(txFlightName);
      setModalIsTakenAway(isTakenAway);
    },
    [],
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
          flightName,
          clientCode,
          amount,
          currency: "UZS",
        },
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
              {canViewExpectedCargo && (
                <button
                  onClick={() => onNavigate('expected-cargo')}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                  title="Kutilayotgan yuklar"
                >
                  <PackageSearch className="w-4 h-4" />
                </button>
              )}
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
        ) : (
          <MyActivityList
            page={activityPage}
            onPageChange={handleActivityPageChange}
          />
        )}
      </div>

      {/* ── Mark Taken Modal ──────────────────────────────────────────────── */}
      {modalTxIds.length > 0 && (
        <MarkTakenModal
          transactionIds={modalTxIds}
          clientCode={modalClientCode}
          flightName={modalFlightName}
          isTakenAway={modalIsTakenAway}
          isOpen={modalTxIds.length > 0}
          onClose={() => setModalTxIds([])}
        />
      )}

      {/* ── Background upload queue manager ───────────────────────────────── */}
      <WarehouseOfflineManager />
    </div>
  );
}
