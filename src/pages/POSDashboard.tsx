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
  ReceiptText,
  RefreshCw,
  X,
  Plane,
  ChevronRight,
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  SlidersHorizontal,
  Phone,
  MapPin,
  Sun,
  Moon,
  Lock,
  UserCircle,
  LogOut,
  Bell,
  BellOff,
  BellRing,
} from "lucide-react";

import { getAdminJwtClaims } from "@/api/services/adminManagement";
import { refreshAdminToken } from "@/api/services/adminAuth";
import {
  getCashierLog,
  processBulkPayment,
  adjustBalance,
  getRandomActiveCard,
  getPOSClientTransactions,
  posMarkAsTaken,
} from "@/api/pos";
import {
  useBroadcastChannel,
  type BroadcastMessage,
} from "@/hooks/useBroadcastChannel";
import type {
  PaymentProvider,
  CashierLogItem,
  ActiveCardResponse,
  AdjustBalanceRequest,
} from "@/api/pos";
import type { Transaction, FilterType } from "@/api/transactions";
import {
  searchClients,
  getUnpaidCargo,
  normalizeSearchResult,
  getClientProfile,
  normalizeClientProfile,
} from "@/api/verification";
import type { ClientSearchResult, UnpaidCargoItem } from "@/api/verification";
import { formatCurrencySum, formatTashkentDateTime } from "@/lib/format";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_TYPES: { id: PaymentProvider; label: string }[] = [
  { id: "cash", label: "Naqd" },
  { id: "card", label: "Karta" },
  { id: "click", label: "Click" },
  { id: "payme", label: "Payme" },
];

const PROVIDER_CHIP: Record<string, string> = {
  cash: "bg-green-50  dark:bg-green-500/10  text-green-600  dark:text-green-400",
  card: "bg-blue-50   dark:bg-blue-500/10   text-blue-600   dark:text-blue-400",
  click:
    "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
  payme:
    "bg-cyan-50   dark:bg-cyan-500/10   text-cyan-600   dark:text-cyan-400",
};

/**
 * Deterministic color palette assigned to other cashiers' log rows.
 * Index is derived from `cashier_id % PEER_CASHIER_PALETTE.length`.
 */
const PEER_CASHIER_PALETTE = [
  {
    row: "border-l-2 border-blue-400 bg-blue-50/40 dark:bg-blue-500/[0.06]",
    dot: "bg-blue-400",
    label: "text-blue-500 dark:text-blue-400",
  },
  {
    row: "border-l-2 border-purple-400 bg-purple-50/40 dark:bg-purple-500/[0.06]",
    dot: "bg-purple-400",
    label: "text-purple-500 dark:text-purple-400",
  },
  {
    row: "border-l-2 border-teal-400 bg-teal-50/40 dark:bg-teal-500/[0.06]",
    dot: "bg-teal-400",
    label: "text-teal-500 dark:text-teal-400",
  },
  {
    row: "border-l-2 border-rose-400 bg-rose-50/40 dark:bg-rose-500/[0.06]",
    dot: "bg-rose-400",
    label: "text-rose-500 dark:text-rose-400",
  },
  {
    row: "border-l-2 border-indigo-400 bg-indigo-50/40 dark:bg-indigo-500/[0.06]",
    dot: "bg-indigo-400",
    label: "text-indigo-500 dark:text-indigo-400",
  },
] as const;

/** Style applied to the current user's own log rows. */
const OWN_CASHIER_STYLE = {
  row: "border-l-2 border-orange-400 bg-orange-50/40 dark:bg-orange-500/[0.06]",
  dot: "bg-orange-400",
  label: "text-orange-500 dark:text-orange-400",
} as const;

/** Returns the colour tokens for a log entry given the entry's cashier_id and the current admin's id. */
function resolveCashierStyle(
  cashierId: number | null,
  currentAdminId: number | null,
): { row: string; dot: string; label: string } {
  if (cashierId === null) {
    return { row: "", dot: "bg-gray-300 dark:bg-gray-600", label: "text-gray-400" };
  }
  if (cashierId === currentAdminId) {
    return OWN_CASHIER_STYLE;
  }
  return PEER_CASHIER_PALETTE[cashierId % PEER_CASHIER_PALETTE.length]!;
}

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  paid: {
    bg: "bg-green-50 dark:bg-green-500/10",
    text: "text-green-600 dark:text-green-400",
    label: "To'landi",
  },
  partial: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    label: "Qisman",
  },
  pending: {
    bg: "bg-red-50   dark:bg-red-500/10",
    text: "text-red-500   dark:text-red-400",
    label: "Qarzdor",
  },
};

const FILTER_TABS: { id: FilterType; label: string }[] = [
  { id: "all", label: "Barchasi" },
  { id: "not_taken", label: "Olib ketilmagan" },
  { id: "taken", label: "Olib ketilgan" },
  { id: "partial", label: "Qisman to'langan" },
];

// ─── Payment provider / status localisation ───────────────────────────────────

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Naqd",
  card: "Karta",
  click: "Click",
  payme: "Payme",
  wallet: "Hamyon",
  online: "Online",
};

/** Translates raw backend payment_provider / payment_type strings to Uzbek. */
function translatePayment(raw: string): string {
  if (!raw) return "—";
  if (raw.toUpperCase().startsWith("SYS_ADJ")) return "Hamyon tahriri";
  return PAYMENT_LABEL[raw.toLowerCase()] ?? raw;
}

const RECENT_KEY = "pos_recent_searches";
const MAX_RECENT = 5;
const SOUND_KEY = "pos_sound_enabled";
const PENDING_NOTIFS_KEY = "pos_pending_notifs";

/**
 * A single warehouse→cashier notification that has been received but not yet
 * acted on (dismissed or opened).  Persisted in localStorage so the cashier
 * does not lose notifications if they briefly leave or refresh the page.
 */
interface PendingNotif {
  id: string;
  clientCode: string;
  flightName: string;
  amount?: number;
  currency?: string;
}

function loadPendingNotifs(): PendingNotif[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_NOTIFS_KEY) ?? "[]") as PendingNotif[];
  } catch {
    return [];
  }
}

function persistPendingNotifs(notifs: PendingNotif[]): void {
  localStorage.setItem(PENDING_NOTIFS_KEY, JSON.stringify(notifs));
}

/**
 * Plays a two-tone notification chime using the Web Audio API.
 * No external audio file needed — the sound is synthesised on-the-fly.
 * Silently no-ops if AudioContext is unavailable or blocked by the browser.
 */
function playNotificationChime(): void {
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0.35, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

    // First tone — higher pitch
    const osc1 = ctx.createOscillator();
    osc1.connect(master);
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1318, ctx.currentTime);        // E6
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.18);

    // Second tone — lower pitch, slight delay
    const osc2 = ctx.createOscillator();
    osc2.connect(master);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(987, ctx.currentTime + 0.18);  // B5
    osc2.start(ctx.currentTime + 0.18);
    osc2.stop(ctx.currentTime + 0.7);

    // Release the AudioContext after the sound completes.
    osc2.onended = () => void ctx.close();
  } catch {
    // AudioContext may be blocked before a user gesture on some browsers.
  }
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function saveRecentSearch(code: string): void {
  const next = [code, ...getRecentSearches().filter((c) => c !== code)].slice(
    0,
    MAX_RECENT,
  );
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function deleteRecentSearch(code: string): void {
  localStorage.setItem(
    RECENT_KEY,
    JSON.stringify(getRecentSearches().filter((c) => c !== code)),
  );
}

// ─── Waterfall distribution ───────────────────────────────────────────────────

/** Spread `received` across cargo debts sequentially; last item absorbs remainder. */
function waterfallDistribute(
  cargos: UnpaidCargoItem[],
  received: number,
): number[] {
  if (cargos.length === 0) return [];
  const result: number[] = new Array(cargos.length).fill(0.01);
  let remaining = received - 0.01 * cargos.length;

  for (let i = 0; i < cargos.length && remaining > 0; i++) {
    const canTake = Math.max(0, (cargos[i]?.total_payment ?? 0) - 0.01);
    const take = Math.min(canTake, remaining);
    result[i] = (result[i] ?? 0.01) + take;
    remaining -= take;
  }
  if (remaining > 0) {
    result[result.length - 1] = (result[result.length - 1] ?? 0.01) + remaining;
  }
  return result;
}

function formatCard(raw: string): string {
  return raw
    .replace(/\s/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

// ─── TodayTotal ───────────────────────────────────────────────────────────────

function TodayTotal({ total, loading }: { total: number; loading: boolean }) {
  return (
    <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg shadow-green-500/20">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-green-100/80 mb-1">
        Bugungi tushum
      </p>
      {loading ? (
        <div className="h-8 w-32 bg-white/20 animate-pulse rounded-lg" />
      ) : (
        <p className="text-2xl font-black tracking-tight">
          {formatCurrencySum(total)}
        </p>
      )}
    </div>
  );
}

// ─── LogEntry ─────────────────────────────────────────────────────────────────

function LogEntry({
  item,
  index,
  onSelect,
  currentAdminId,
}: {
  item: CashierLogItem;
  index: number;
  onSelect: (code: string) => void;
  /** The current user's Admin DB PK — used to colour-code own vs. peer entries. */
  currentAdminId: number | null;
}) {
  const hasCode = !!item.client_code;
  const isOwn = item.cashier_id !== null && item.cashier_id === currentAdminId;
  const cashierStyle = resolveCashierStyle(item.cashier_id, currentAdminId);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.4) }}
      onClick={() => hasCode && onSelect(item.client_code!)}
      className={`flex items-center justify-between gap-3 py-2.5 border-b border-gray-50 dark:border-white/[0.04] last:border-0 rounded-lg px-2 -mx-1 transition-colors ${cashierStyle.row} ${
        hasCode ? "cursor-pointer hover:opacity-80" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {/* Coloured dot — visually groups rows by cashier */}
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cashierStyle.dot}`} />
          <span className="text-[13px] font-bold text-gray-800 dark:text-white font-mono">
            {item.client_code ?? "—"}
          </span>
          {item.flight && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[80px]">
              · {item.flight}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[10px] text-gray-400 dark:text-gray-600">
            {formatTashkentDateTime(item.created_at)}
          </p>
          {/* "Men" badge for own entries; cashier_id number for peers */}
          {item.cashier_id !== null && (
            <span className={`text-[9px] font-bold ${cashierStyle.label}`}>
              {isOwn ? "Men" : `#${item.cashier_id}`}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={`text-[13px] font-bold ${
            item.paid_amount < 0
              ? "text-red-500 dark:text-red-400"
              : "text-gray-800 dark:text-white"
          }`}
        >
          {item.paid_amount < 0
            ? `−${formatCurrencySum(Math.abs(item.paid_amount))}`
            : formatCurrencySum(item.paid_amount)}
        </p>
        <span
          className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
            PROVIDER_CHIP[item.payment_provider] ??
            "bg-gray-50 dark:bg-white/[0.05] text-gray-500"
          }`}
        >
          {translatePayment(item.payment_provider)}
        </span>
      </div>
    </motion.div>
  );
}

// ─── CargoRow ─────────────────────────────────────────────────────────────────

function CargoRow({
  cargo,
  isSelected,
  onToggle,
}: {
  cargo: UnpaidCargoItem;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.label
      layout
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
        isSelected
          ? "bg-orange-50 dark:bg-orange-500/[0.08] border-orange-200/70 dark:border-orange-500/20"
          : "bg-white dark:bg-[#111] border-gray-100 dark:border-white/[0.06] hover:border-orange-200/50 dark:hover:border-orange-500/10"
      }`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={isSelected}
        onChange={onToggle}
      />
      <div
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
          isSelected
            ? "bg-orange-500 border-orange-500 shadow-sm shadow-orange-500/20"
            : "border-gray-300 dark:border-gray-600"
        }`}
      >
        {isSelected && (
          <CheckCheck className="w-3 h-3 text-white" strokeWidth={3} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-gray-700 dark:text-gray-300">
            #{cargo.row_number}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {cargo.weight} kg
          </span>
          <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
            <Plane className="w-3 h-3" />
            {cargo.flight_name}
          </span>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">
          {formatCurrencySum(cargo.price_per_kg, undefined, "$")}/kg
        </p>
      </div>
      <p
        className={`text-[14px] font-black shrink-0 transition-colors ${
          isSelected
            ? "text-orange-600 dark:text-orange-400"
            : "text-red-500 dark:text-red-400"
        }`}
      >
        {formatCurrencySum(cargo.total_payment)}
      </p>
    </motion.label>
  );
}

// ─── ClientProfileDrawer ──────────────────────────────────────────────────────

function ClientProfileDrawer({
  clientCode,
  clientName,
  currentBalance,
  onClose,
  onBalanceUpdate,
  onRefreshClient,
  canAdjust,
}: {
  clientCode: string;
  clientName: string;
  currentBalance: number;
  onClose: () => void;
  onBalanceUpdate: (newBalance: number) => void;
  /** Called after any mutation so the parent re-fetches the client's balance. */
  onRefreshClient?: () => void;
  /** Whether the current admin has pos:adjust permission. */
  canAdjust: boolean;
}) {
  const queryClient = useQueryClient();

  // Adjust form state
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isCredit, setIsCredit] = useState(true);

  // Transaction history filter
  const [txFilter, setTxFilter] = useState<FilterType>("all");

  // Full client info overlay
  const [showFullInfo, setShowFullInfo] = useState(false);

  // Full client profile (phone, passport, region, …)
  const { data: profile } = useQuery({
    queryKey: ["pos-profile", clientCode],
    queryFn: async () => {
      const res = await getClientProfile(clientCode);
      return normalizeClientProfile(res.client);
    },
  });

  // Paginated transactions — re-fetches on filter change
  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ["pos-txn", clientCode, txFilter],
    queryFn: () => getPOSClientTransactions(clientCode, txFilter, 20, 0),
  });

  console.log(JSON.stringify(txData, null, 2));

  // Balance adjustment
  const adjustMut = useMutation({
    mutationFn: (req: AdjustBalanceRequest) => adjustBalance(req),
    onSuccess: (res) => {
      toast.success(
        `Hamyon yangilandi. Yangi balans: ${formatCurrencySum(res.new_wallet_balance)}`,
      );
      onBalanceUpdate(res.new_wallet_balance);
      // Aggressively invalidate all POS-related query keys so nothing stays stale
      queryClient.invalidateQueries({ queryKey: ["pos-unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["cashier-log"] });
      queryClient.invalidateQueries({ queryKey: ["pos-txn", clientCode] });
      queryClient.invalidateQueries({ queryKey: ["pos-profile", clientCode] });
      queryClient.invalidateQueries({ queryKey: ["client-info"] });
      onRefreshClient?.();
      setAmount("");
      setReason("");
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message ?? "Hamyon yangilashda xatolik");
    },
  });

  // Mark cargo as taken
  const markTakenMut = useMutation({
    mutationFn: (txId: number) => posMarkAsTaken(txId),
    onSuccess: () => {
      toast.success("Olib ketildi deb belgilandi");
      queryClient.invalidateQueries({ queryKey: ["pos-txn", clientCode] });
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message ?? "Belgilashda xatolik yuz berdi");
    },
  });

  const handleAdjust = () => {
    const parsed = Number(
      parseFloat(amount.replace(/\s/g, "").replace(",", ".")).toFixed(2),
    );
    if (!parsed || parsed <= 0) {
      toast.error("Summani kiriting");
      return;
    }
    if (!reason.trim()) {
      toast.error("Sababni kiriting");
      return;
    }
    adjustMut.mutate({
      client_code: clientCode,
      amount: isCredit ? parsed : -parsed,
      reason: reason.trim(),
    });
  };

  const statusOf = (s: string) =>
    STATUS_STYLES[s] ?? {
      bg: "bg-gray-50 dark:bg-white/[0.04]",
      text: "text-gray-500",
      label: s,
    };

  // Adjust form JSX is rendered in two places (desktop left panel + mobile bottom).
  // Both share the same state via closure; only one is visible at a time via responsive CSS.
  const adjustFormContent = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Hamyon sozlash
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setIsCredit(true)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold transition-all border ${
            isCredit
              ? "bg-green-50 dark:bg-green-500/10 border-green-300 dark:border-green-500/30 text-green-700 dark:text-green-400"
              : "bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.06] text-gray-500"
          }`}
        >
          <ArrowUpCircle className="w-3.5 h-3.5" />
          Kirim
        </button>
        <button
          onClick={() => setIsCredit(false)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold transition-all border ${
            !isCredit
              ? "bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-400"
              : "bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.06] text-gray-500"
          }`}
        >
          <ArrowDownCircle className="w-3.5 h-3.5" />
          Chiqim
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Summa"
          className="flex-1 min-w-0 px-3.5 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-bold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all text-gray-900 dark:text-white"
        />
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 64))}
          placeholder="Sabab (1-64 belgi)"
          className="flex-[2] min-w-0 px-3.5 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all text-gray-900 dark:text-white"
        />
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleAdjust}
        disabled={adjustMut.isPending}
        className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-[13px] rounded-2xl shadow-lg shadow-orange-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {adjustMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Hamyonni yangilash
      </motion.button>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg md:max-w-4xl flex flex-col bg-white dark:bg-[#111] rounded-t-3xl border-t border-gray-100 dark:border-white/[0.08] shadow-2xl"
        style={{ maxHeight: "88vh" }}
      >
        {/* Drag handle */}
        <div className="shrink-0 pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-white/10" />
        </div>

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 pb-3 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/[0.1] flex items-center justify-center">
              <User className="w-5 h-5 text-orange-500" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight">
                {clientName}
              </p>
              <p className="text-[11px] font-mono text-gray-400">
                {clientCode}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                Hamyon
              </p>
              <p
                className={`text-[14px] font-black ${
                  currentBalance > 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-400"
                }`}
              >
                {formatCurrencySum(currentBalance)}
              </p>
            </div>
            <button
              onClick={() => setShowFullInfo(true)}
              className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg font-bold text-[12px] hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 transition-colors"
            >
              Batafsil
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body — 2-column on desktop, stacked on mobile */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row">
          {/* DESKTOP LEFT: Profile details + adjust form */}
          <div className="hidden md:flex md:w-80 shrink-0 flex-col border-r border-gray-100 dark:border-white/[0.06]">
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 min-h-0">
              <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Mijoz ma'lumotlari
              </p>

              {/* Phone */}
              <div className="flex items-start gap-2.5 py-1.5">
                <Phone
                  className="w-4 h-4 text-gray-400 mt-0.5 shrink-0"
                  strokeWidth={1.8}
                />
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    Telefon
                  </p>
                  <p className="text-[12px] font-semibold text-gray-800 dark:text-white">
                    {profile?.phone ?? "—"}
                  </p>
                </div>
              </div>

              {/* Passport */}
              <div className="flex items-start gap-2.5 py-1.5">
                <CreditCard
                  className="w-4 h-4 text-gray-400 mt-0.5 shrink-0"
                  strokeWidth={1.8}
                />
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    Pasport seriyasi
                  </p>
                  <p className="text-[12px] font-semibold text-gray-800 dark:text-white font-mono">
                    {profile?.passport_series ?? "—"}
                  </p>
                </div>
              </div>

              {/* Region */}
              <div className="flex items-start gap-2.5 py-1.5">
                <MapPin
                  className="w-4 h-4 text-gray-400 mt-0.5 shrink-0"
                  strokeWidth={1.8}
                />
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    Viloyat
                  </p>
                  <p className="text-[12px] font-semibold text-gray-800 dark:text-white">
                    {profile?.region ?? "—"}
                  </p>
                </div>
              </div>

              {/* Stats */}
              {profile && (
                <div className="grid grid-cols-2 gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                  <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-2.5">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      Jami tranzaksiya
                    </p>
                    <p className="text-[18px] font-black text-gray-800 dark:text-white">
                      {profile.transaction_count}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-2.5">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      Referallar
                    </p>
                    <p className="text-[18px] font-black text-gray-800 dark:text-white">
                      {profile.referral_count}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Adjust form in desktop left panel (pos:adjust required) */}
            {canAdjust && (
              <div className="shrink-0 px-5 pb-6 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
                {adjustFormContent}
              </div>
            )}
          </div>

          {/* TRANSACTIONS: full on mobile, right column on desktop */}
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
            {/* Filter tabs */}
            <div className="shrink-0 px-5 pt-3">
              <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl">
                {FILTER_TABS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setTxFilter(id)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      txFilter === id
                        ? "bg-white dark:bg-[#222] text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-2.5 mb-0.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Operatsiyalar
                </span>
                {txData && (
                  <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md">
                    {txData.total_count} ta
                  </span>
                )}
              </div>
            </div>

            {/* Transaction list */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 min-h-0 space-y-2">
              {txLoading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-14 bg-gray-50 dark:bg-white/[0.04] rounded-xl animate-pulse"
                    />
                  ))}
                </>
              ) : txData && txData.transactions.length > 0 ? (
                txData.transactions.map((tx: Transaction) => {
                  const style = statusOf(tx.payment_status);
                  const isAdjust = tx.reys.startsWith("SYS_ADJ");
                  // Identifies if THIS specific transaction is being processed
                  const isTakingThis =
                    markTakenMut.isPending && markTakenMut.variables === tx.id;
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Plane className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="text-[12px] font-bold text-gray-800 dark:text-white truncate">
                            {tx.reys}
                          </span>
                          <span
                            className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${style.bg} ${style.text}`}
                          >
                            {style.label}
                          </span>
                          {tx.is_taken_away && (
                            <span className="shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400">
                              Berilgan
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">
                          {formatTashkentDateTime(tx.created_at)}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        {isAdjust ? (
                          // Wallet adjustments: show signed payment_balance_difference, hide summa/remaining
                          <p
                            className={`text-[13px] font-bold ${
                              tx.payment_balance_difference >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-500 dark:text-red-400"
                            }`}
                          >
                            {tx.payment_balance_difference >= 0 ? "+" : "−"}
                            {formatCurrencySum(
                              Math.abs(tx.payment_balance_difference),
                            )}
                          </p>
                        ) : (
                          <>
                            <p className="text-[13px] font-bold text-gray-800 dark:text-white">
                              {formatCurrencySum(tx.summa)}
                            </p>
                            {tx.payment_status !== "paid" &&
                              tx.remaining_amount > 0 && (
                                <p className="text-[10px] text-red-500 font-semibold">
                                  −{formatCurrencySum(tx.remaining_amount)}
                                </p>
                              )}
                          </>
                        )}
                      </div>

                      {/* Mark as taken — only shown for real cargo, not wallet adjustments */}
                      {!isAdjust && !tx.is_taken_away && (
                        <button
                          onClick={() => markTakenMut.mutate(tx.id)}
                          disabled={isTakingThis}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors disabled:opacity-50"
                        >
                          {isTakingThis ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCheck className="w-3 h-3" />
                          )}
                          Berildi
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center">
                  <Package
                    className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600"
                    strokeWidth={1.5}
                  />
                  <p className="text-[12px] text-gray-400">
                    Operatsiyalar yo'q
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* MOBILE ONLY: Adjust form pinned at bottom (pos:adjust required) */}
          {canAdjust && (
            <div className="md:hidden shrink-0 px-5 pb-6 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
              {adjustFormContent}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Full client info modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {showFullInfo && profile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            onClick={() => setShowFullInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/[0.08] shadow-2xl overflow-hidden"
            >
              <div className="h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-400" />
              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[16px] font-black text-gray-900 dark:text-white">
                      To'liq ma'lumot
                    </h3>
                    <p className="text-[11px] font-mono text-gray-400">
                      {profile.client_code}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFullInfo(false)}
                    className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Fields grid */}
                <div className="bg-gray-50 dark:bg-white/[0.04] rounded-2xl divide-y divide-gray-100 dark:divide-white/[0.05] overflow-hidden text-[13px]">
                  {[
                    { label: "Ism Familiya", value: profile.full_name },
                    { label: "Telefon", value: profile.phone ?? "—" },
                    {
                      label: "Pasport seriyasi",
                      value: profile.passport_series ?? "—",
                    },
                    { label: "JSHSHIR (PINFL)", value: profile.pinfl ?? "—" },
                    {
                      label: "Tug'ilgan sana",
                      value: profile.date_of_birth ?? "—",
                    },
                    { label: "Viloyat", value: profile.region ?? "—" },
                    { label: "Tuman", value: profile.district ?? "—" },
                    { label: "Manzil", value: profile.address ?? "—" },
                    {
                      label: "Tranzaksiyalar",
                      value: String(profile.transaction_count),
                    },
                    {
                      label: "Referallar",
                      value: String(profile.referral_count),
                    },
                    {
                      label: "Qo'shimcha pasportlar",
                      value: String(profile.extra_passports_count),
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex items-start justify-between px-4 py-2.5 gap-3"
                    >
                      <span className="text-gray-400 dark:text-gray-500 shrink-0">
                        {label}
                      </span>
                      <span className="font-semibold text-gray-800 dark:text-white text-right break-all">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

interface ConfirmPayload {
  cargos: UnpaidCargoItem[];
  amounts: number[];
  paymentType: PaymentProvider;
  useWallet: boolean;
  received: number;
  walletDeduction: number;
  cardInfo: ActiveCardResponse | null;
  clientCode: string;
}

function ConfirmModal({
  payload,
  onConfirm,
  onCancel,
  isPending,
}: {
  payload: ConfirmPayload;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const netCash = payload.received - payload.walletDeduction;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/[0.08] shadow-2xl overflow-hidden"
      >
        <div className="h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-[17px] font-black text-gray-900 dark:text-white">
              To'lovni tasdiqlash
            </h3>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 font-mono">
              {payload.clientCode}
            </p>
          </div>

          {/* Line items */}
          <div className="bg-gray-50 dark:bg-white/[0.04] rounded-2xl divide-y divide-gray-100 dark:divide-white/[0.05] overflow-hidden">
            {payload.cargos.map((c, i) => (
              <div
                key={c.cargo_id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">
                    #{c.row_number} · {c.flight_name}
                  </span>
                </div>
                <span className="text-[12px] font-bold text-gray-800 dark:text-white">
                  {formatCurrencySum(payload.amounts[i] ?? 0)}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[12px]">
              <span className="text-gray-500">To'lov usuli</span>
              <span className="font-semibold text-gray-800 dark:text-white">
                {translatePayment(payload.paymentType)}
              </span>
            </div>
            {payload.walletDeduction > 0 && (
              <div className="flex justify-between text-[12px]">
                <span className="text-green-600">Hamyon</span>
                <span className="font-semibold text-green-600">
                  −{formatCurrencySum(payload.walletDeduction)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-[14px] font-black border-t border-gray-100 dark:border-white/[0.06] pt-2">
              <span className="text-gray-700 dark:text-gray-200">
                Naqd/karta:
              </span>
              <span className="text-orange-600 dark:text-orange-400">
                {formatCurrencySum(netCash > 0 ? netCash : payload.received)}
              </span>
            </div>
          </div>

          {/* Card info */}
          {payload.paymentType === "card" && payload.cardInfo && (
            <div className="bg-blue-50 dark:bg-blue-500/[0.08] border border-blue-200/60 dark:border-blue-500/20 rounded-2xl p-3">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">
                {payload.cardInfo.bank_name ?? "Bank kartasi"}
              </p>
              <p className="text-[15px] font-black text-blue-700 dark:text-blue-300 font-mono tracking-widest">
                {formatCard(payload.cardInfo.card_number)}
              </p>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                {payload.cardInfo.holder_name}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-white/[0.08] text-[13px] font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
            >
              Bekor
            </button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onConfirm}
              disabled={isPending}
              className="flex-[2] py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-[14px] rounded-2xl shadow-lg shadow-orange-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4" />
              )}
              HA, TO'LASH
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface POSDashboardProps {
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export default function POSDashboard({ onNavigate, onLogout }: POSDashboardProps) {
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Dark mode ─────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState<boolean>(() => {
    // Initialise from localStorage; fall back to the current <html> class
    const saved = localStorage.getItem("pos_theme");
    if (saved) return saved === "dark";
    return document.documentElement.classList.contains("dark");
  });

  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("pos_theme", next ? "dark" : "light");
      return next;
    });
  }, []);

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
  // Super-admins always have full access; others need at least one POS permission
  const hasPosAccess = jwtClaims.isSuperAdmin || canRead || canProcess || canAdjust;

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

  // Live balance updated after successful balance adjustments without re-fetching client
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const displayBalance = liveBalance ?? clientInfo?.client_balance ?? 0;

  // ── Selection & payment ───────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [paymentType, setPaymentType] = useState<PaymentProvider>("cash");
  const [useWallet, setUseWallet] = useState(false);
  const [receivedInput, setReceivedInput] = useState("");

  // ── UI overlays ───────────────────────────────────────────────────────────
  const [showProfile, setShowProfile] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<ConfirmPayload | null>(
    null,
  );

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // ── Queries ───────────────────────────────────────────────────────────────
  const {
    data: logData,
    isLoading: logLoading,
    refetch: refetchLog,
  } = useQuery({
    queryKey: ["cashier-log"],
    queryFn: () => getCashierLog({ page: 1, size: 30 }),
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
        filterType: "pending",
        sortOrder: "asc",
        limit: 100,
        offset: 0,
      }),
    // Cargo list is only meaningful when the admin can process payments
    enabled: canProcess && !!clientInfo,
  });

  const { data: activeCard } = useQuery({
    queryKey: ["active-card"],
    queryFn: getRandomActiveCard,
    enabled: canProcess && paymentType === "card",
    staleTime: 5 * 60_000,
  });

  const cargos: UnpaidCargoItem[] = useMemo(
    () => cargoData?.items ?? [],
    [cargoData?.items],
  );
  const allSelected =
    cargos.length > 0 && cargos.every((c) => selectedIds.has(c.cargo_id));
  const someSelected = selectedIds.size > 0;

  // ── Bulk payment mutation ─────────────────────────────────────────────────
  const payMut = useMutation({
    mutationFn: processBulkPayment,
    onSuccess: (result) => {
      toast.success(
        `${result.processed_count} ta yuk to'lovi qabul qilindi! Jami: ${formatCurrencySum(result.total_paid)}`,
      );
      setSelectedIds(new Set());
      setReceivedInput("");
      setConfirmPayload(null);
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
        data?: {
          detail?: { error?: string; failed_cargo_id?: number } | string;
        };
        message?: string;
      };
      const apiErr = err as PosError;
      const detail = apiErr?.data?.detail;
      if (detail && typeof detail === "object" && detail.error) {
        toast.error(
          `Xatolik (cargo #${detail.failed_cargo_id ?? "?"}): ${detail.error}`,
          { duration: 6000 },
        );
      } else {
        toast.error(apiErr.message ?? "To'lov qilishda xatolik yuz berdi");
      }
      setConfirmPayload(null);
    },
  });

  // ── Derived payment totals ────────────────────────────────────────────────
  const selectedCargos = cargos.filter((c) => selectedIds.has(c.cargo_id));
  const totalOwed = selectedCargos.reduce(
    (s, c) => s + (c.total_payment ?? 0),
    0,
  );
  const walletDeduction = useWallet ? Math.min(displayBalance, totalOwed) : 0;
  const netAfterWallet = totalOwed - walletDeduction;

  // Sync received input whenever cargo selection or wallet toggle changes
  useEffect(() => {
    const net =
      totalOwed - (useWallet ? Math.min(displayBalance, totalOwed) : 0);
    setReceivedInput(net > 0 ? String(Math.round(net)) : "");
  }, [selectedIds, useWallet, totalOwed, displayBalance]);

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

  const handleLogEntryClick = useCallback(
    (code: string) => handleSearch(code),
    [handleSearch],
  );
  const handleRecentChipClick = useCallback(
    (code: string) => handleSearch(code),
    [handleSearch],
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
    setConfirmPayload({
      cargos: selectedCargos,
      amounts: waterfallDistribute(selectedCargos, receivedAmount),
      paymentType,
      useWallet,
      received: receivedAmount,
      walletDeduction,
      cardInfo: paymentType === "card" ? (activeCard ?? null) : null,
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
      })),
      cashier_note: null,
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
      <div className="max-w-7xl mx-auto px-3 sm:px-4 pb-6">
        {/* Dashboard header with theme toggle */}
        <div className="flex items-center justify-between py-3 mb-1">
          <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            POS Kassa
          </span>
          <div className="flex items-center gap-1">
            {/* Dismiss all active notifications */}
            {notifCount > 0 && (
              <button
                onClick={handleDismissAllNotifs}
                title="Barcha bildirishnomalarni yopish"
                className="relative p-2 rounded-xl text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/[0.08] transition-colors"
              >
                <BellRing className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
            )}

            {/* Sound toggle */}
            <button
              onClick={toggleSound}
              title={soundEnabled ? "Ovozni o'chirish" : "Ovozni yoqish"}
              className="p-2 rounded-xl text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/[0.08] transition-colors"
            >
              {soundEnabled ? (
                <Bell className="w-4 h-4" />
              ) : (
                <BellOff className="w-4 h-4" />
              )}
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

        <div className="flex flex-col lg:flex-row gap-4">
          {/* ── Left column: Cashier Log ───────────────────────────────────
               Always rendered so the layout stays consistent.
               Content is gated behind pos:read; otherwise shows a lock panel. */}
          <div className="lg:w-72 xl:w-80 shrink-0 space-y-3">
            {canRead ? (
              <>
                <TodayTotal
                  total={logData?.today_total ?? 0}
                  loading={logLoading}
                />
                <div className="bg-white dark:bg-[#111] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-white/[0.05]">
                    <div className="flex items-center gap-2">
                      <ReceiptText className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        So'nggi to'lovlar
                      </span>
                    </div>
                    <button
                      onClick={() => refetchLog()}
                      className="p-1 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/[0.08] transition-colors"
                      title="Yangilash"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="px-4 py-1 max-h-[50vh] lg:max-h-[65vh] overflow-y-auto overscroll-contain">
                    {logLoading ? (
                      <div className="space-y-3 py-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className="h-10 bg-gray-50 dark:bg-white/[0.04] rounded-lg animate-pulse"
                          />
                        ))}
                      </div>
                    ) : logData && logData.items.length > 0 ? (
                      logData.items.map((item, i) => (
                        <LogEntry
                          key={item.id}
                          item={item}
                          index={i}
                          onSelect={handleLogEntryClick}
                          currentAdminId={jwtClaims.admin_id}
                        />
                      ))
                    ) : (
                      <div className="py-8 text-center">
                        <ReceiptText
                          className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600"
                          strokeWidth={1.5}
                        />
                        <p className="text-[12px] text-gray-400">
                          Bugun hali to'lov yo'q
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white dark:bg-[#111] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[160px]">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
                  <Lock className="w-5 h-5 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
                </div>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 max-w-[180px]">
                  Sizda kassa tarixini ko'rish huquqi yo'q
                </p>
              </div>
            )}
          </div>

          {/* ── Right column: Search & Payment ────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Search bar */}
            <div className="bg-white dark:bg-[#111] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm p-3">
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
                  className="bg-white dark:bg-[#111] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm p-4 cursor-pointer hover:border-orange-200/80 dark:hover:border-orange-500/20 transition-colors"
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
                  className="bg-white dark:bg-[#111] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm p-6 flex flex-col items-center justify-center gap-3 text-center"
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
                  className="bg-white dark:bg-[#111] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-white/[0.05] sticky top-0 bg-white dark:bg-[#111] z-10">
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
                  <div className="bg-white/95 dark:bg-[#111]/95 backdrop-blur-xl rounded-2xl border border-black/[0.08] dark:border-white/[0.1] shadow-2xl shadow-black/10 dark:shadow-black/40 p-4 space-y-3">
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

                    {/* Card info banner */}
                    <AnimatePresence>
                      {paymentType === "card" && activeCard && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-blue-50 dark:bg-blue-500/[0.08] border border-blue-200/60 dark:border-blue-500/20 rounded-xl px-3 py-2 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">
                              {activeCard.bank_name ?? "Bank kartasi"}
                            </p>
                            <p className="text-[14px] font-black text-blue-700 dark:text-blue-300 font-mono tracking-widest">
                              {formatCard(activeCard.card_number)}
                            </p>
                            <p className="text-[10px] text-blue-500 dark:text-blue-400">
                              {activeCard.holder_name}
                            </p>
                          </div>
                          <CreditCard className="w-6 h-6 text-blue-400" />
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
                        type="number"
                        value={receivedInput}
                        onChange={(e) => setReceivedInput(e.target.value)}
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
        </div>
      </div>

      {/* ── Overlays ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showProfile && clientInfo && (
          <ClientProfileDrawer
            clientCode={clientInfo.client_code}
            clientName={clientInfo.full_name}
            currentBalance={displayBalance}
            onClose={() => setShowProfile(false)}
            onBalanceUpdate={(newBalance) => setLiveBalance(newBalance)}
            onRefreshClient={() => handleSearch(clientInfo.client_code)}
            canAdjust={canAdjust}
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
    </>
  );
}
