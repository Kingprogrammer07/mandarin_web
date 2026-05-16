import { memo, useCallback } from "react";
import { Plane, CheckCheck, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  posUpdateDeliveryProofMethod,
  posUpdateDeliveryRequestType,
  posUpdateTakenStatus,
} from "@/api/pos";
import { formatCurrencySum, formatTashkentDateTime } from "@/lib/format";
import { STATUS_STYLES, DELIVERY_REQUEST_OPTIONS, DELIVERY_PROOF_OPTIONS, DELIVERY_METHOD_LABELS } from "./utils";
import type { Transaction, DeliveryProofMethod, DeliveryRequestType } from "@/api/transactions";

interface TransactionItemProps {
  tx: Transaction;
  isSelected: boolean;
  canUpdateStatus: boolean;
  onToggleSelect: (id: number) => void;
  clientCode: string;
}

function askReason(): string | null {
  const reason = window.prompt("Sabab kiriting (majburiy):");
  if (!reason || !reason.trim()) {
    toast.error("Sabab kiritish majburiy");
    return null;
  }
  return reason.trim();
}

export const TransactionItem = memo(function TransactionItem({
  tx,
  isSelected,
  canUpdateStatus,
  onToggleSelect,
  clientCode,
}: TransactionItemProps) {
  const queryClient = useQueryClient();
  const style = STATUS_STYLES[tx.payment_status] ?? {
    bg: "bg-gray-50 dark:bg-white/[0.04]",
    text: "text-gray-500",
    label: tx.payment_status,
  };
  const isAdjust = tx.reys.startsWith("SYS_ADJ");
  const canQueue = !isAdjust && (tx.payment_status === "paid" || tx.payment_status === "partial") && !tx.is_taken_away;

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

  const isTakingThis = markTakenMut.isPending && markTakenMut.variables?.transactionId === tx.id;

  const handleToggle = useCallback(() => {
    if (canQueue) onToggleSelect(tx.id);
  }, [canQueue, onToggleSelect, tx.id]);

  const handleMarkTaken = useCallback(() => {
    const reason = askReason();
    if (!reason) return;
    markTakenMut.mutate({
      transactionId: tx.id,
      isTakenAway: !tx.is_taken_away,
      reason,
    });
  }, [tx.id, tx.is_taken_away, markTakenMut]);

  const handleRequestTypeChange = useCallback((selected: DeliveryRequestType) => {
    if (!selected) return;
    const reason = askReason();
    if (!reason) return;
    updateRequestTypeMut.mutate({
      transactionId: tx.id,
      requestType: selected,
      reason,
    });
  }, [tx.id, updateRequestTypeMut]);

  const handleProofMethodChange = useCallback((selected: DeliveryProofMethod) => {
    if (!selected) return;
    const reason = askReason();
    if (!reason) return;
    updateProofMethodMut.mutate({
      transactionId: tx.id,
      proofMethod: selected,
      reason,
    });
  }, [tx.id, updateProofMethodMut]);

  return (
    <div
      onClick={handleToggle}
      className={`flex flex-col gap-2.5 px-3.5 py-2.5 rounded-xl border transition-colors ${
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
                onChange={() => onToggleSelect(tx.id)}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 dark:border-gray-600 dark:bg-[#222] shrink-0"
              />
            )}
            <Plane className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="text-[12px] font-bold text-gray-800 dark:text-white truncate">
              {tx.reys}
            </span>
            <span className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${style.bg} ${style.text}`}>
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
            <p className={`text-[13px] font-bold ${tx.payment_balance_difference >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
              {tx.payment_balance_difference >= 0 ? "+" : "−"}
              {formatCurrencySum(Math.abs(tx.payment_balance_difference))}
            </p>
          ) : (
            <>
              <p className="text-[13px] font-bold text-gray-800 dark:text-white">
                {formatCurrencySum(tx.summa)}
              </p>
              {tx.payment_status !== "paid" && tx.remaining_amount > 0 && (
                <p className="text-[10px] text-red-500 font-semibold">
                  −{formatCurrencySum(tx.remaining_amount)}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {!isAdjust && canUpdateStatus && (
        <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-gray-200/50 dark:border-white/[0.05]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleMarkTaken();
            }}
            disabled={isTakingThis}
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-[11px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors disabled:opacity-50 flex-1 sm:flex-none"
          >
            {isTakingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
            {tx.is_taken_away ? "Qaytarish" : "Berildi"}
          </button>
          <select
            value={tx.delivery_request_type ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              handleRequestTypeChange(e.target.value as DeliveryRequestType);
            }}
            disabled={updateRequestTypeMut.isPending}
            className="flex-1 sm:flex-none px-2 py-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-lg outline-none cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
          >
            <option value="" disabled>User tashlagan so&apos;rovi</option>
            {DELIVERY_REQUEST_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {DELIVERY_METHOD_LABELS[opt] ?? opt}
              </option>
            ))}
          </select>
          <select
            value={tx.delivery_proof_method ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              handleProofMethodChange(e.target.value as DeliveryProofMethod);
            }}
            disabled={updateProofMethodMut.isPending}
            className="flex-1 sm:flex-none px-2 py-1.5 text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-lg outline-none cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors disabled:opacity-50"
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
});
