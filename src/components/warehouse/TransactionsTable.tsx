import { motion } from "framer-motion";
import {
  Package,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ChevronRight as TapHint,
  Plane,
  User,
  Phone,
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

function getRowAccent(item: WarehouseTransactionItem): string {
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
  /** Called when the warehouse worker taps "Kassirga xabar" on an unpaid row */
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
      <div className="space-y-2" aria-busy="true" aria-label="Yuklanmoqda">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-16 bg-white dark:bg-white/[0.03] rounded-xl animate-pulse border border-gray-200 dark:border-white/[0.05]"
          />
        ))}
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="py-16 text-center" role="status">
        <Package
          className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600"
          strokeWidth={1.5}
          aria-hidden="true"
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
      <div className="flex items-center gap-2 px-1" aria-live="polite">
        <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Natijalar
        </span>
        <span className="text-[10px] text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md font-mono">
          {totalCount} ta
        </span>
      </div>

      {/* Transaction rows */}
      <div className="space-y-2" role="list" aria-label="Tranzaksiyalar ro'yxati">
        {items.map((item, idx) => {
          const paymentStyle = getPaymentStyle(item.payment_status);
          const rowAccent = getRowAccent(item);
          const isClickable = canMarkTaken && !item.is_taken_away;
          const isUnpaid =
            item.payment_status === "unpaid" || item.payment_status === "pending";

          return (
            <motion.div
              key={item.id}
              role={isClickable ? "button" : "listitem"}
              tabIndex={isClickable ? 0 : undefined}
              aria-label={
                isClickable
                  ? `${item.client_code} — ${item.reys} yukini berish`
                  : undefined
              }
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.3) }}
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
                "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3.5",
                "bg-white dark:bg-white/[0.03]",
                "rounded-xl border border-gray-200 dark:border-white/[0.05] border-l-[3px]",
                rowAccent,
                "shadow-sm dark:shadow-none transition-all",
                isClickable
                  ? "cursor-pointer hover:shadow-md hover:border-orange-200 dark:hover:border-orange-500/20 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* Left: Client info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-bold text-gray-800 dark:text-white font-mono">
                    {item.client_code}
                  </span>
                  {item.client_full_name && (
                    <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                      <User className="w-3 h-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                      {item.client_full_name}
                    </span>
                  )}
                  {item.client_phone && (
                    <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                      <Phone className="w-3 h-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                      {item.client_phone}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                    <Plane className="w-3 h-3" strokeWidth={1.8} aria-hidden="true" />
                    {item.reys}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
                  <span className="text-gray-500 dark:text-gray-400 font-medium">
                    #{item.qator_raqami}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
                  <span className="text-gray-400 dark:text-gray-500">
                    {item.vazn} kg
                  </span>
                  <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
                  <span className="text-gray-400 dark:text-gray-600 text-[10px]">
                    {formatTashkentDateTime(item.created_at)}
                  </span>
                </div>
              </div>

              {/* Right: Payment info + status */}
              <div className="flex items-center gap-2.5 shrink-0">
                {/* Payment amounts */}
                <div className="text-right">
                  <p className="text-[13px] font-bold text-gray-800 dark:text-white">
                    {item.total_amount != null
                      ? formatCurrencySum(item.total_amount)
                      : "—"}
                  </p>
                  {item.remaining_amount > 0 && item.payment_status !== "paid" && (
                    <p className="text-[10px] font-semibold text-red-500 dark:text-red-400">
                      −{formatCurrencySum(item.remaining_amount)}
                    </p>
                  )}
                </div>

                {/* Payment status badge */}
                <span
                  className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${paymentStyle.bg} ${paymentStyle.text}`}
                  aria-label={`To'lov holati: ${paymentStyle.label}`}
                >
                  {paymentStyle.label}
                </span>

                {/* Notify cashier button — only for unpaid/pending rows */}
                {isUnpaid && onNotifyCashier && (
                  <button
                    type="button"
                    onClick={(e) => {
                      // Prevent the row's onMarkTaken click from firing
                      e.stopPropagation();
                      onNotifyCashier(item);
                    }}
                    title="Kassirga to'lov uchun xabar yuborish"
                    className="shrink-0 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20 active:scale-95 transition-all"
                  >
                    <BellRing className="w-3 h-3" aria-hidden="true" />
                    Kassir
                  </button>
                )}

                {/* Action indicator */}
                {item.is_taken_away ? (
                  <span className="shrink-0 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCheck className="w-3 h-3" aria-hidden="true" />
                    Berilgan
                  </span>
                ) : canMarkTaken ? (
                  /* Tap-hint badge — the whole card is the interactive target */
                  <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400">
                    <Package className="w-3 h-3" aria-hidden="true" strokeWidth={2} />
                    Berish
                    <TapHint className="w-3 h-3 opacity-60" aria-hidden="true" />
                  </span>
                ) : (
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/[0.04] text-gray-400 dark:text-gray-500">
                    Kutilmoqda
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Sahifalar" className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Oldingi sahifa"
            aria-disabled={page <= 1}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors shadow-sm dark:shadow-none"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 7) {
              pageNum = i + 1;
            } else if (page <= 4) {
              pageNum = i + 1;
            } else if (page >= totalPages - 3) {
              pageNum = totalPages - 6 + i;
            } else {
              pageNum = page - 3 + i;
            }
            const isCurrent = pageNum === page;
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                aria-label={`${pageNum}-sahifa`}
                aria-current={isCurrent ? "page" : undefined}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[12px] font-bold transition-all shadow-sm dark:shadow-none ${
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
            aria-disabled={page >= totalPages}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors shadow-sm dark:shadow-none"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}
