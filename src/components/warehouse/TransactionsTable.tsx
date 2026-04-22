import { motion } from "framer-motion";
import {
  Package,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Plane,
  User,
  BellRing,
} from "lucide-react";
import type { WarehouseTransactionItem } from "../../api/services/warehouse";
import { formatCurrencySum, formatTashkentDateTime } from "../../lib/format";

// ── Status Styling ────────────────────────────────────────────────────────────

const PAYMENT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
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
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-500 dark:text-red-400",
    label: "Qarzdor",
  },
  unpaid: {
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-500 dark:text-red-400",
    label: "To'lanmagan",
  },
};

function getPaymentStyle(status: string) {
  return (
    PAYMENT_STYLES[status] ?? {
      bg: "bg-gray-100 dark:bg-white/[0.04]",
      text: "text-gray-500 dark:text-gray-400",
      label: status,
    }
  );
}

function getAccentColor(item: WarehouseTransactionItem): string {
  if (item.is_taken_away) return "border-l-emerald-400 dark:border-l-emerald-500";
  if (item.payment_status === "pending" || item.payment_status === "unpaid")
    return "border-l-red-400 dark:border-l-red-500";
  if (item.payment_status === "partial")
    return "border-l-amber-400 dark:border-l-amber-500";
  return "border-l-orange-200 dark:border-l-transparent";
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface TransactionsTableProps {
  items: WarehouseTransactionItem[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onMarkTaken: (transactionId: number) => void;
  canMarkTaken: boolean;
  onNotifyCashier?: (item: WarehouseTransactionItem) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TransactionsTable({
  items,
  isLoading,
  page,
  totalPages,
  totalCount,
  onPageChange,
  onMarkTaken,
  canMarkTaken,
  onNotifyCashier,
}: TransactionsTableProps) {
  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 bg-white dark:bg-white/[0.03] rounded-2xl animate-pulse border border-gray-100 dark:border-white/[0.05]"
          />
        ))}
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <Package
          className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600"
          strokeWidth={1.5}
        />
        <p className="text-[13px] font-semibold text-gray-400 dark:text-gray-500">
          Tranzaksiyalar topilmadi
        </p>
        <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1">
          Filtrlarni o'zgartirib ko'ring
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Result count */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Natijalar
        </span>
        <span className="text-[10px] text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md font-mono">
          {totalCount} ta
        </span>
      </div>

      {/* Transaction cards */}
      <div className="space-y-2">
        {items.map((item, idx) => {
          const paymentStyle = getPaymentStyle(item.payment_status);
          const accentColor = getAccentColor(item);
          const isClickable = canMarkTaken && !item.has_proof;
          const isUnpaid =
            item.payment_status === "unpaid" || item.payment_status === "pending";

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.3) }}
              className={[
                "bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-100 dark:border-white/[0.05] border-l-[3px]",
                accentColor,
                "shadow-sm dark:shadow-none overflow-hidden",
              ].join(" ")}
            >
              {/* ── Card body (tappable area for marking taken) ─────────────── */}
              <div
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                aria-label={
                  isClickable
                    ? `${item.client_code} — ${item.reys} yukini berish`
                    : undefined
                }
                onClick={isClickable ? () => onMarkTaken(item.id) : undefined}
                onKeyDown={
                  isClickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onMarkTaken(item.id);
                        }
                      }
                    : undefined
                }
                className={[
                  "p-4",
                  isClickable
                    ? "cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-500/[0.04] active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-inset"
                    : "",
                ].join(" ")}
              >
                {/* ── Row 1: client + payment badge ─────────────────────────── */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[15px] font-black text-gray-900 dark:text-white font-mono leading-tight">
                        {item.client_code}
                      </span>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
                        #{item.qator_raqami}
                      </span>
                    </div>
                    {item.client_full_name && (
                      <p className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        <User className="w-3 h-3 shrink-0" strokeWidth={1.8} />
                        {item.client_full_name}
                      </p>
                    )}
                  </div>

                  {/* Payment badge — top-right corner */}
                  <span
                    className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-xl ${paymentStyle.bg} ${paymentStyle.text}`}
                  >
                    {paymentStyle.label}
                  </span>
                </div>

                {/* ── Row 2: flight · weight · date ─────────────────────────── */}
                <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-400 dark:text-gray-500">
                  <span className="flex items-center gap-1">
                    <Plane className="w-3 h-3" strokeWidth={1.8} />
                    {item.reys}
                  </span>
                  <span className="text-gray-200 dark:text-gray-700">·</span>
                  <span>{item.vazn} kg</span>
                  <span className="text-gray-200 dark:text-gray-700">·</span>
                  <span className="text-[10px]">
                    {formatTashkentDateTime(item.created_at)}
                  </span>
                </div>
              </div>

              {/* ── Card footer: amount + action buttons ──────────────────────── */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-50 dark:border-white/[0.04] bg-gray-50/50 dark:bg-white/[0.02]">
                {/* Amount */}
                <div className="flex-1 min-w-0">
                  <span className="text-[14px] font-bold text-gray-800 dark:text-white">
                    {item.total_amount != null
                      ? formatCurrencySum(item.total_amount)
                      : "—"}
                  </span>
                  {item.remaining_amount > 0 && item.payment_status !== "paid" && (
                    <span className="ml-2 text-[11px] font-semibold text-red-500 dark:text-red-400">
                      −{formatCurrencySum(item.remaining_amount)}
                    </span>
                  )}
                </div>

                {/* Action buttons — right side, large touch targets */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Notify cashier */}
                  {isUnpaid && onNotifyCashier && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNotifyCashier(item);
                      }}
                      title="Kassirga xabar yuborish"
                      className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20 active:scale-95 transition-all"
                    >
                      <BellRing className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Kassir</span>
                    </button>
                  )}

                  {/* Status badge / action button */}
                  {item.has_proof ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <CheckCheck className="w-3.5 h-3.5" />
                      Isbot yuklangan
                    </span>
                  ) : item.is_taken_away ? (
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <CheckCheck className="w-3.5 h-3.5" />
                        Berilgan
                      </span>
                      {canMarkTaken && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkTaken(item.id);
                          }}
                          className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 active:scale-95 transition-all shadow-sm"
                        >
                          Isbot
                        </button>
                      )}
                    </div>
                  ) : canMarkTaken ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkTaken(item.id);
                      }}
                      className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white active:scale-95 transition-all shadow-sm shadow-orange-500/20"
                    >
                      <Package className="w-3.5 h-3.5" />
                      Berish
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/[0.04] text-gray-400 dark:text-gray-500">
                      Kutilmoqda
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Sahifalar" className="flex items-center justify-center gap-1.5 pt-2 pb-4">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Oldingi sahifa"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }
            const isCurrent = pageNum === page;
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                aria-current={isCurrent ? "page" : undefined}
                className={`w-11 h-11 flex items-center justify-center rounded-xl text-[13px] font-bold transition-all shadow-sm ${
                  isCurrent
                    ? "bg-orange-500 text-white shadow-orange-500/20"
                    : "bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06]"
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Keyingi sahifa"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors shadow-sm"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
