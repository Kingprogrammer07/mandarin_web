
import { useState, useCallback } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Phone,
  MapPin,
  Package,
  CreditCard,
  CheckCheck,
  Loader2,
  AlertCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  SlidersHorizontal,
  User,
  Plane,
} from 'lucide-react';
import {
  adjustBalance,
  getPOSClientTransactions,
  posUpdateDeliveryProofMethod,
  posUpdateDeliveryRequestType,
  posUpdateTakenStatus,
} from '@/api/pos';
import { createPosPickupQueue, PICKUP_METHOD_LABELS, PICKUP_PRIORITY_LABELS } from '@/api/pickupQueue';
import type { PickupMethod, PickupQueuePriority } from '@/api/pickupQueue';
import type {
  AdjustBalanceRequest,
} from '@/api/pos';
import type {
  DeliveryProofMethod,
  DeliveryRequestType,
  Transaction,
  FilterType,
} from '@/api/transactions';
import { getClientProfile, normalizeClientProfile } from '@/api/verification';
import { formatCurrencySum, formatTashkentDateTime } from '@/lib/format';
import { normalizeNumber } from '@/utils/numberFormat';
import {
  STATUS_STYLES,
  FILTER_TABS,
  DELIVERY_REQUEST_OPTIONS,
  DELIVERY_PROOF_OPTIONS,
  DELIVERY_METHOD_LABELS,
} from './utils';

// ─── ClientProfileDrawer ──────────────────────────────────────────────────────

export function ClientProfileDrawer({
  clientCode,
  clientName,
  currentBalance,
  onClose,
  onBalanceUpdate,
  onRefreshClient,
  canAdjust,
  canUpdateStatus,
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
  /** Whether the current admin has pos:update_status permission. */
  canUpdateStatus: boolean;
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

  // Manual pickup queue from transaction drawer
  const [selectedTxIds, setSelectedTxIds] = useState<Set<number>>(new Set());
  const toggleTxSelection = useCallback((id: number) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const [showPickupQueueModal, setShowPickupQueueModal] = useState(false);
  const [pickupQueueMethod, setPickupQueueMethod] = useState<PickupMethod>("self_pickup");
  const [pickupQueuePriority, setPickupQueuePriority] = useState<PickupQueuePriority>("normal");
  const [pickupQueueNote, setPickupQueueNote] = useState("");

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

  // POS status updates (taken status + delivery fields)
  const markTakenMut = useMutation({
    mutationFn: ({
      transactionId,
      isTakenAway,
      reason,
    }: {
      transactionId: number;
      isTakenAway: boolean;
      reason: string;
    }) => posUpdateTakenStatus(transactionId, isTakenAway, reason),
    onSuccess: () => {
      toast.success("Olib ketish holati yangilandi");
      queryClient.invalidateQueries({ queryKey: ["pos-txn", clientCode] });
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message ?? "Belgilashda xatolik yuz berdi");
    },
  });

  const updateRequestTypeMut = useMutation({
    mutationFn: ({
      transactionId,
      requestType,
      reason,
    }: {
      transactionId: number;
      requestType: DeliveryRequestType;
      reason: string;
    }) => posUpdateDeliveryRequestType(transactionId, requestType, reason),
    onSuccess: () => {
      toast.success("Delivery request type yangilandi");
      queryClient.invalidateQueries({ queryKey: ["pos-txn", clientCode] });
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message ?? "Yangilashda xatolik yuz berdi");
    },
  });

  const updateProofMethodMut = useMutation({
    mutationFn: ({
      transactionId,
      proofMethod,
      reason,
    }: {
      transactionId: number;
      proofMethod: DeliveryProofMethod;
      reason: string;
    }) => posUpdateDeliveryProofMethod(transactionId, proofMethod, reason),
    onSuccess: () => {
      toast.success("Delivery proof method yangilandi");
      queryClient.invalidateQueries({ queryKey: ["pos-txn", clientCode] });
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message ?? "Yangilashda xatolik yuz berdi");
    },
  });

  interface DuplicateConflict {
    queue_id: number;
    display_number: number;
    client_code: string;
    status: string;
    transaction_ids: number[];
  }

  const [duplicateConflict, setDuplicateConflict] = useState<DuplicateConflict | null>(null);

  const createPickupQueueMut = useMutation({
    mutationFn: (data: {
      transaction_ids: number[];
      pickup_method: PickupMethod;
      priority?: PickupQueuePriority;
      note: string | null;
      idempotency_key?: string | null;
    }) => createPosPickupQueue(data),
    onSuccess: (res) => {
      const queue = res as { display_number?: number };
      toast.success(
        queue.display_number
          ? `Warehousega yuborildi. Navbat raqami: #${queue.display_number}`
          : "Warehousega yuborildi",
      );
      setSelectedTxIds(new Set());
      setShowPickupQueueModal(false);
      setPickupQueueMethod("self_pickup");
      setPickupQueuePriority("normal");
      setPickupQueueNote("");
      setDuplicateConflict(null);
      queryClient.invalidateQueries({ queryKey: ["pos-txn", clientCode] });
      queryClient.invalidateQueries({ queryKey: ["pickup_queue"] });
    },
    onError: (err: unknown) => {
      const e = err as {
        message?: string;
        status?: number;
        data?: DuplicateConflict & { detail?: string };
      };
      if (e.status === 409 && e.data) {
        setDuplicateConflict({
          queue_id: e.data.queue_id,
          display_number: e.data.display_number,
          client_code: e.data.client_code,
          status: e.data.status,
          transaction_ids: e.data.transaction_ids ?? [],
        });
      } else {
        toast.error(e.message ?? "Navbat yaratishda xatolik");
      }
    },
  });

  const askReason = (): string | null => {
    const reason = window.prompt("Sabab kiriting (majburiy):");
    if (!reason || !reason.trim()) {
      toast.error("Sabab kiritish majburiy");
      return null;
    }
    return reason.trim();
  };

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
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            const normalized = normalizeNumber(e.target.value);
            if (normalized !== null) setAmount(normalized);
          }}
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
                  const isTakingThis =
                    markTakenMut.isPending &&
                    markTakenMut.variables?.transactionId === tx.id;
                  const canQueue = !isAdjust && (tx.payment_status === "paid" || tx.payment_status === "partial") && !tx.is_taken_away;
                  const isSelected = selectedTxIds.has(tx.id);
                  return (
                    <div
                      key={tx.id}
                      onClick={() => canQueue && toggleTxSelection(tx.id)}
                      className={`flex flex-col gap-2.5 px-3.5 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                        canQueue
                          ? isSelected
                            ? "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30"
                            : "bg-gray-50 dark:bg-white/[0.03] border-gray-100 dark:border-white/[0.05] hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                          : "bg-gray-50 dark:bg-white/[0.03] border-gray-100 dark:border-white/[0.05] cursor-default"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {canQueue && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleTxSelection(tx.id)}
                                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 dark:border-gray-600 dark:bg-[#222] shrink-0"
                              />
                            )}
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
                            {tx.delivery_request_type && (
                              <span className="shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                User tashlagan so'rovi: {DELIVERY_METHOD_LABELS[tx.delivery_request_type] ?? tx.delivery_request_type}
                              </span>
                            )}
                            {tx.delivery_proof_method && (
                              <span className="shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                Ombordan berilgan metodi: {DELIVERY_METHOD_LABELS[tx.delivery_proof_method] ?? tx.delivery_proof_method}
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
                      </div>

                      {/* Single-cargo edit actions (requires pos:update_status) */}
                      {!isAdjust && canUpdateStatus && (
                        <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-gray-200/50 dark:border-white/[0.05]">
                          <button
                            onClick={() => {
                              const reason = askReason();
                              if (!reason) return;
                              markTakenMut.mutate({
                                transactionId: tx.id,
                                isTakenAway: !tx.is_taken_away,
                                reason,
                              });
                            }}
                            disabled={isTakingThis}
                            className="flex items-center justify-center gap-1 px-3 py-1.5 text-[11px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors disabled:opacity-50 flex-1 sm:flex-none"
                            title="Taken status yangilash"
                          >
                            {isTakingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                            {tx.is_taken_away ? "Qaytarish" : "Berildi"}
                          </button>
                          <select
                            value={tx.delivery_request_type ?? ""}
                            onChange={(e) => {
                              const selected = e.target.value as DeliveryRequestType;
                              if (!selected) return;
                              const reason = askReason();
                              if (!reason) {
                                e.target.value = tx.delivery_request_type ?? "";
                                return;
                              }
                              updateRequestTypeMut.mutate({
                                transactionId: tx.id,
                                requestType: selected,
                                reason,
                              });
                            }}
                            disabled={updateRequestTypeMut.isPending}
                            className="flex-1 sm:flex-none px-2 py-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-lg outline-none cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                            title="User tashlagan so'rovini yangilash"
                          >
                            <option value="" disabled>User tashlagan so'rovi</option>
                            {DELIVERY_REQUEST_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {DELIVERY_METHOD_LABELS[opt] ?? opt}
                              </option>
                            ))}
                          </select>
                          <select
                            value={tx.delivery_proof_method ?? ""}
                            onChange={(e) => {
                              const selected = e.target.value as DeliveryProofMethod;
                              if (!selected) return;
                              const reason = askReason();
                              if (!reason) {
                                e.target.value = tx.delivery_proof_method ?? "";
                                return;
                              }
                              updateProofMethodMut.mutate({
                                transactionId: tx.id,
                                proofMethod: selected,
                                reason,
                              });
                            }}
                            disabled={updateProofMethodMut.isPending}
                            className="flex-1 sm:flex-none px-2 py-1.5 text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-lg outline-none cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                            title="Ombordan berilgan metodini yangilash"
                          >
                            <option value="" disabled>Ombordan berilgan metodi</option>
                            {DELIVERY_PROOF_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {DELIVERY_METHOD_LABELS[opt] ?? opt}
                              </option>
                            ))}
                          </select>
                        </div>
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

              {/* Manual pickup queue action bar */}
              {selectedTxIds.size > 0 && (
                <div className="sticky bottom-2 z-10">
                  <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-orange-200 dark:border-orange-500/20 shadow-lg p-3 flex items-center justify-between">
                    <span className="text-[12px] font-bold text-gray-700 dark:text-gray-200">
                      {selectedTxIds.size} ta tanlandi
                    </span>
                    <button
                      onClick={() => setShowPickupQueueModal(true)}
                      className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[12px] font-bold rounded-lg shadow-sm"
                    >
                      Warehousega yuborish
                    </button>
                  </div>
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

      {/* ── Manual pickup queue modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showPickupQueueModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            onClick={() => setShowPickupQueueModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/[0.08] shadow-2xl overflow-hidden"
            >
              <div className="h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[16px] font-black text-gray-900 dark:text-white">
                      Warehousega yuborish
                    </h3>
                    <p className="text-[11px] text-gray-400">
                      {selectedTxIds.size} ta tranzaksiya
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPickupQueueModal(false)}
                    className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                      Olib ketish usuli
                    </label>
                    <select
                      value={pickupQueueMethod}
                      onChange={(e) => setPickupQueueMethod(e.target.value as PickupMethod)}
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-700 dark:text-gray-200"
                    >
                      {(Object.keys(PICKUP_METHOD_LABELS) as PickupMethod[]).map((m) => (
                        <option key={m} value={m}>
                          {PICKUP_METHOD_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                      Navbat ustuvorligi
                    </label>
                    <select
                      value={pickupQueuePriority}
                      onChange={(e) => setPickupQueuePriority(e.target.value as PickupQueuePriority)}
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-700 dark:text-gray-200"
                    >
                      {(Object.keys(PICKUP_PRIORITY_LABELS) as PickupQueuePriority[]).map((p) => (
                        <option key={p} value={p}>
                          {PICKUP_PRIORITY_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                      Izoh (ixtiyoriy)
                    </label>
                    <input
                      type="text"
                      value={pickupQueueNote}
                      onChange={(e) => setPickupQueueNote(e.target.value.slice(0, 200))}
                      placeholder="Izoh..."
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-900 dark:text-white placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {/* Duplicate conflict alert */}
                {duplicateConflict && (
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-red-700 dark:text-red-400">
                          Bu yuklar allaqachon navbatda
                        </p>
                        <p className="text-[12px] text-red-600 dark:text-red-300 mt-0.5">
                          Mijoz: <span className="font-bold">{duplicateConflict.client_code}</span>
                        </p>
                        <p className="text-[12px] text-red-600 dark:text-red-300">
                          Navbat raqami: <span className="font-black text-[14px]">#{duplicateConflict.display_number}</span>
                        </p>
                        <p className="text-[12px] text-red-600 dark:text-red-300">
                          Status: <span className="font-bold">{duplicateConflict.status === "preparing" ? "Tayyorlanmoqda" : duplicateConflict.status === "ready" ? "Tayyor" : duplicateConflict.status}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDuplicateConflict(null)}
                      className="w-full py-2 rounded-lg bg-white dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-[12px] font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                    >
                      Tushundim, qayta urinish
                    </button>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setShowPickupQueueModal(false); setDuplicateConflict(null); }}
                    className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-white/[0.08] text-[13px] font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    Bekor
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (selectedTxIds.size === 0) return;
                      setDuplicateConflict(null);
                      createPickupQueueMut.mutate({
                        transaction_ids: Array.from(selectedTxIds),
                        pickup_method: pickupQueueMethod,
                        priority: pickupQueuePriority,
                        note: pickupQueueNote.trim() || null,
                        idempotency_key: crypto.randomUUID(),
                      });
                    }}
                    disabled={createPickupQueueMut.isPending}
                    className="flex-[2] py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-[14px] rounded-2xl shadow-lg shadow-orange-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {createPickupQueueMut.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCheck className="w-4 h-4" />
                    )}
                    Yuborish
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

