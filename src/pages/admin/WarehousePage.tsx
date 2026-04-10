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
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { getAdminJwtClaims } from "../../api/services/adminManagement";
import { refreshAdminToken } from "../../api/services/adminAuth";
import { useWarehouseStore } from "../../store/useWarehouseStore";
import { useWarehouseTransactions } from "../../api/hooks/useWarehouse";
import { useWarehouseQueueProcessor } from "../../api/hooks/useWarehouseQueueProcessor";
import WarehouseFilters from "../../components/warehouse/WarehouseFilters";
import TransactionsTable from "../../components/warehouse/TransactionsTable";
import MyActivityList from "../../components/warehouse/MyActivityList";
import MarkTakenModal from "../../components/warehouse/MarkTakenModal";
import WarehouseOfflineManager from "../../components/warehouse/WarehouseOfflineManager";
import type { WarehouseTransactionItem } from "../../api/services/warehouse";
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

export default function WarehousePage({ onLogout }: WarehousePageProps) {
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
  const [activeTab, setActiveTab] = useState<ActiveTab>("transactions");
  const [activityPage, setActivityPage] = useState(1);

  // Mark-taken modal state
  const [modalTxId, setModalTxId] = useState<number | null>(null);
  const [modalClientCode, setModalClientCode] = useState("");
  const [modalFlightName, setModalFlightName] = useState("");

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

  // Fetch transactions for the selected flight
  const { data, isLoading } = useWarehouseTransactions(flightName, {
    payment_status: paymentStatus,
    taken_status: takenStatus,
    code: searchQuery || undefined,
    page,
    size,
  });

  const handleMarkTaken = useCallback(
    (transactionId: number) => {
      const tx = data?.items.find(
        (item: WarehouseTransactionItem) => item.id === transactionId,
      );
      if (tx) {
        setModalTxId(transactionId);
        setModalClientCode(tx.client_code);
        setModalFlightName(tx.reys);
      }
    },
    [data],
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
    (item: WarehouseTransactionItem) => {
      sendMessage({
        type: "POS_NOTIFY",
        payload: {
          flightName: item.reys,
          clientCode: item.client_code,
          amount: item.remaining_amount > 0 ? item.remaining_amount : item.total_amount ?? undefined,
          currency: "UZS",
        },
      });
      toast.success(`Kassirga xabar yuborildi: ${item.client_code}`, {
        description: `Reys: ${item.reys}`,
        duration: 3000,
      });
    },
    [sendMessage],
  );

  const handleActivityPageChange = useCallback(
    (newPage: number) => setActivityPage(newPage),
    [],
  );

  const isFlightEmpty = flightName.trim().length === 0;

  if (!canView) return <AccessDenied />;

  return (
    <div className="min-h-screen bg-[#f5f5f4] dark:bg-[#0a0a0a]">

      {/* ── Sticky Header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-4 py-3">

          {/* Title row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.history.back()}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                aria-label="Orqaga"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                  <Warehouse className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <h1 className="text-[15px] font-bold text-gray-900 dark:text-white leading-tight">
                    Ombor
                  </h1>
                  {activeTab === "transactions" && data && !isFlightEmpty && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
                      {data.total_count} ta yuk
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <span className="hidden sm:inline text-[12px] text-gray-500 dark:text-gray-400 mr-1">
                {jwtClaims.role_name}
              </span>
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

          {/* Tab switcher */}
          <div className="flex gap-1 bg-gray-100 dark:bg-white/[0.05] rounded-xl p-1 mb-3 w-fit">
            <button
              onClick={() => setActiveTab("transactions")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
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
      <div className="max-w-6xl mx-auto px-4 py-4">
        {activeTab === "transactions" ? (
          isFlightEmpty ? (
            // Prompt to enter a flight name
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
                Reys nomini kiriting
              </h2>
              <p className="text-[13px] text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
                Yuklarni ko'rish uchun yuqoridagi maydoniga reys nomini kiriting
              </p>
            </motion.div>
          ) : (
            <TransactionsTable
              items={data?.items ?? []}
              isLoading={isLoading}
              page={page}
              totalPages={data?.total_pages ?? 0}
              totalCount={data?.total_count ?? 0}
              onPageChange={handlePageChange}
              onMarkTaken={handleMarkTaken}
              canMarkTaken={canMarkTaken}
              onNotifyCashier={handleNotifyCashier}
            />
          )
        ) : (
          <MyActivityList
            page={activityPage}
            onPageChange={handleActivityPageChange}
          />
        )}
      </div>

      {/* ── Mark Taken Modal ──────────────────────────────────────────────── */}
      {modalTxId !== null && (
        <MarkTakenModal
          transactionId={modalTxId}
          clientCode={modalClientCode}
          flightName={modalFlightName}
          isOpen={modalTxId !== null}
          onClose={() => setModalTxId(null)}
        />
      )}

      {/* ── Background upload queue manager ───────────────────────────────── */}
      <WarehouseOfflineManager />
    </div>
  );
}
