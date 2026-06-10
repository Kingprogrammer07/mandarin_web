"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Receipt, CheckCheck, Loader2, Plane, Calendar, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  posNotificationService,
  type PosNotificationItem,
} from "@/api/services/posNotificationService";
import { STATUS_META, formatSum, formatDateTime } from "./PaymentNotificationDrawer";
import { apiErrorMessage } from "@/utils/apiError";

// ─── Receipt Preview (re-used inline) ────────────────────────────────────────

function ReceiptPreviewModal({
  url,
  contentType,
  onClose,
}: {
  url: string;
  contentType: string;
  onClose: () => void;
}) {
  const isPdf = contentType === "application/pdf";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-3 sm:p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Yopish"
        className="absolute right-3 top-[calc(env(safe-area-inset-top)+12px)] z-[82] flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-700 shadow-2xl"
      >
        <X className="h-5 w-5" />
      </button>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1a1a1a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] shrink-0">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Chek</span>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 sm:p-4">
          {isPdf ? (
            <iframe src={url} className="h-[76dvh] w-full rounded-lg border border-gray-200" title="Chek" />
          ) : (
            <img src={url} alt="Chek" className="max-w-full max-h-[65vh] rounded-lg object-contain" />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  n: PosNotificationItem;
  onClientClick: (code: string) => void;
  onRefresh: () => void;
}

export function ZayafkaNotificationBubble({ n, onClientClick, onRefresh }: Props) {
  const isPending = n.payment_status === "pending";
  const isPaid = n.payment_status === "paid";
  const isRejected = n.payment_status === "rejected";
  const hasReceipt = Boolean(n.receipt_s3_key);
  const meta = STATUS_META[n.payment_status] ?? STATUS_META.pending;

  const storedPayableAmount =
    n.remaining_amount > 0
      ? n.remaining_amount
      : n.total_amount > 0
        ? n.total_amount
        : 0;

  const isWalletOnly = n.payment_type === "wallet";
  const needsLivePrice =
    isPending &&
    n.delivery_request_id != null &&
    storedPayableAmount <= 0 &&
    !isWalletOnly;

  const { data: livePrice } = useQuery({
    queryKey: ["zayafka-uzpost-price", n.delivery_request_id],
    queryFn: () => posNotificationService.getZayafkaUzpostPrice(n.delivery_request_id!),
    enabled: needsLivePrice,
    staleTime: 60_000,
    retry: 1,
  });

  const prefillAmount =
    storedPayableAmount > 0
      ? String(storedPayableAmount)
      : livePrice?.uzpost_price && livePrice.uzpost_price > 0
        ? String(livePrice.uzpost_price)
        : isWalletOnly
          ? "0"
          : "";

  const [amount, setAmount] = useState<string>(prefillAmount);
  const [rejectComment, setRejectComment] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<{ url: string; contentType: string } | null>(null);
  const [loading, setLoading] = useState<"confirm" | "reject" | "edit" | "receipt" | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Sync local amount state when the notification data or fallback live price changes.
  useEffect(() => {
    if (!editMode) {
      setAmount(prefillAmount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillAmount, n.id, editMode]);

  const handleReceiptClick = async () => {
    if (loading === "receipt") return;
    setLoading("receipt");
    try {
      const data = await posNotificationService.getReceiptUrl(n.id);
      setReceiptPreview({ url: data.url, contentType: data.content_type });
    } catch {
      toast.error("Chekni yuklab bo'lmadi");
    } finally {
      setLoading(null);
    }
  };

  const handleConfirm = async () => {
    if (!n.delivery_request_id || loading) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      toast.error("Summani to'g'ri kiriting");
      return;
    }
    setLoading("confirm");
    try {
      await posNotificationService.confirmZayafka({
        delivery_request_id: n.delivery_request_id,
        amount: parsedAmount,
      });
      toast.success("To'lov tasdiqlandi");
      onRefresh();
    } catch (err) {
      // 409 = zayafka already processed (bot/another cashier). Show the exact
      // backend reason so it doesn't look like a server crash.
      toast.error(apiErrorMessage(err, "Zayafka to'lovini tasdiqlashda xatolik"));
      onRefresh();
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    if (!n.delivery_request_id || loading) return;
    setLoading("reject");
    try {
      await posNotificationService.rejectZayafka({
        delivery_request_id: n.delivery_request_id,
        comment: rejectComment.trim() || null,
      });
      toast.success("To'lov rad etildi");
      onRefresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Zayafka to'lovini rad etishda xatolik"));
      onRefresh();
    } finally {
      setLoading(null);
      setShowRejectInput(false);
    }
  };

  const handleEditAmount = async () => {
    if (!n.delivery_request_id || loading) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Summani to'g'ri kiriting");
      return;
    }
    setLoading("edit");
    try {
      await posNotificationService.editZayafkaAmount({
        delivery_request_id: n.delivery_request_id,
        amount: parsedAmount,
      });
      toast.success("Summa yangilandi");
      setEditMode(false);
      onRefresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Summani yangilashda xatolik"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative rounded-2xl px-4 py-3 border transition-colors bg-white dark:bg-[#1a1a1a]",
          meta.border,
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-2 flex-wrap mb-2 pr-4">
          <span className="font-bold text-sm text-gray-900 dark:text-white font-mono">
            {n.client_code}
          </span>
          {n.client_name && (
            <span className="font-bold text-sm text-gray-900 dark:text-white">
              · {n.client_name}
            </span>
          )}
          <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0", meta.bg, meta.text)}>
            {meta.label}
          </span>
        </div>

        {/* Flight */}
        <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 mb-2">
          <Plane className="w-3 h-3" />
          <span>{n.flight_name}</span>
          <span className="text-gray-300 dark:text-gray-600 mx-1">·</span>
          <Calendar className="w-3 h-3" />
          <span>{formatDateTime(n.created_at)}</span>
        </div>

        {/* Pending: editable amount input */}
        {isPending && (
          <div className="mb-3">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              To'langan summa (so'm)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Summani kiriting"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-bold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50"
            />
          </div>
        )}

        {/* Paid: show confirmed amount */}
        {isPaid && (
          <div className="mb-2 text-[12px] flex items-center gap-1.5">
            <CheckCheck className="w-3.5 h-3.5 text-green-500" />
            <span className="text-gray-500 dark:text-gray-400">To'langan:</span>
            <span className="font-bold">{formatSum(n.amount_paid)}</span>
            {n.confirmed_by && (
              <span className="text-[10px] text-green-600 dark:text-green-400 ml-1">
                · {n.confirmed_by}
              </span>
            )}
          </div>
        )}

        {/* Rejected: show reason */}
        {isRejected && n.admin_comment && (
          <div className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="font-bold text-red-500">Sabab:</span> {n.admin_comment}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-1.5 flex-wrap pt-3 border-t border-gray-100 dark:border-white/[0.05]">
          {/* Receipt */}
          {hasReceipt && !showRejectInput && (
            <button
              onClick={handleReceiptClick}
              disabled={loading === "receipt"}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-300 dark:hover:border-orange-500/30 active:scale-95 transition-all shadow-sm"
            >
              {loading === "receipt"
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Receipt className="w-3.5 h-3.5" />
              }
              Chek
            </button>
          )}

          {/* Confirm button (pending only) */}
          {isPending && !showRejectInput && (
            <button
              onClick={handleConfirm}
              disabled={!!loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-black bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600 disabled:opacity-50 active:scale-[0.97] transition-all shadow-lg shadow-green-500/25"
            >
              {loading === "confirm"
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <CheckCheck className="w-4 h-4" />
              }
              Tasdiqlash
            </button>
          )}

          {/* Reject trigger (pending only) */}
          {isPending && !showRejectInput && (
            <button
              onClick={() => setShowRejectInput(true)}
              className="px-4 py-2.5 rounded-xl text-[12px] font-bold bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 hover:border-red-300 dark:hover:border-red-500/30 active:scale-95 transition-all"
            >
              Rad etish
            </button>
          )}

          {/* Reject input flow */}
          {showRejectInput && (
            <div className="w-full space-y-2.5">
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="Rad etish sababi (ixtiyoriy)"
                rows={2}
                className="w-full px-3.5 py-2.5 bg-red-50/50 dark:bg-red-500/[0.04] border border-red-200 dark:border-red-500/25 rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none placeholder:text-red-300 dark:placeholder:text-red-500/40"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={!!loading}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-black bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600 disabled:opacity-50 active:scale-[0.97] transition-all shadow-lg shadow-red-500/25"
                >
                  {loading === "reject" && <Loader2 className="w-4 h-4 animate-spin" />}
                  Rad etishni tasdiqlash
                </button>
                <button
                  onClick={() => setShowRejectInput(false)}
                  className="px-4 py-2.5 rounded-xl text-[12px] font-bold bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06] active:scale-95 transition-all"
                >
                  Bekor
                </button>
              </div>
            </div>
          )}

          {/* Edit amount (paid only) */}
          {isPaid && !showRejectInput && (
            editMode ? (
              <div className="w-full flex gap-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] font-bold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                />
                <button
                  onClick={handleEditAmount}
                  disabled={!!loading}
                  className="px-4 py-2 rounded-xl text-[12px] font-black bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 active:scale-[0.97] transition-all shadow-lg shadow-orange-500/25"
                >
                  {loading === "edit"
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : "Saqlash"
                  }
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06] active:scale-95 transition-all"
                >
                  Bekor
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setAmount(String(n.amount_paid)); setEditMode(true); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-300 dark:hover:border-orange-500/30 active:scale-95 transition-all"
              >
                <Pencil className="w-3.5 h-3.5" />
                Summani tahrirlash
              </button>
            )
          )}

          {/* View client */}
          {!showRejectInput && (
            <button
              onClick={() => onClientClick(n.client_code)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 active:scale-[0.97] transition-all shadow-lg shadow-orange-500/25"
            >
              <Eye className="w-3.5 h-3.5" />
              Ko'rish
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {receiptPreview && (
          <ReceiptPreviewModal
            url={receiptPreview.url}
            contentType={receiptPreview.contentType}
            onClose={() => setReceiptPreview(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
