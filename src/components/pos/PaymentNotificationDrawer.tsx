"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Wallet,
  Plane,
  Calendar,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Receipt,
  SlidersHorizontal,
  RotateCcw,
  FileText,
  CheckCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QuickDatePresets } from "@/components/ui/QuickDatePresets";
import { posNotificationService, type PosNotificationItem, type NotificationFilters } from "@/api/services/posNotificationService";


interface Props {
  notifications: PosNotificationItem[];
  total: number;
  page: number;
  perPage: number;
  unreadCount: number;
  filters: NotificationFilters;
  setPage: (p: number) => void;
  setFilters: (f: NotificationFilters | ((prev: NotificationFilters) => NotificationFilters)) => void;
  resetFilters: () => void;
  markAllRead: () => void;
  /** Set of IDs already marked as read */
  readIds: Set<number>;
  onClientClick: (clientCode: string) => void;
  isLoading: boolean;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
  pending: {
    label: "Kutilmoqda",
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    dot: "bg-red-500",
    border: "border-red-200 dark:border-red-500/30",
  },
  partial: {
    label: "Qisman",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    border: "border-amber-200 dark:border-amber-500/30",
  },
  paid: {
    label: "To'langan",
    bg: "bg-green-50 dark:bg-green-500/10",
    text: "text-green-700 dark:text-green-400",
    dot: "bg-green-500",
    border: "border-green-200 dark:border-green-500/30",
  },
};

const TYPE_LABEL: Record<string, string> = {
  wallet: "Hamyon",
  cash: "Naqd",
  online: "Online",
  click: "Click",
  payme: "Payme",
  card: "Karta",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSum(n: number): string {
  return `${n.toLocaleString("uz-UZ")} so'm`;
}

// ─── Receipt Preview Modal ────────────────────────────────────────────────────

function ReceiptPreview({ url, contentType, onClose }: { url: string; contentType: string; onClose: () => void }) {
  const isPdf = contentType === "application/pdf" || url.endsWith(".pdf");
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative max-w-2xl w-full max-h-[85vh] bg-white dark:bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Chek</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-4 overflow-auto max-h-[70vh] flex items-center justify-center">
          {isPdf ? (
            <iframe
              src={url}
              className="w-full h-[60vh] rounded-lg border border-gray-200 dark:border-white/[0.08]"
              title="Receipt PDF"
            />
          ) : (
            <img
              src={url}
              alt="Receipt"
              className="max-w-full max-h-[65vh] rounded-lg object-contain"
            />
          )}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 dark:border-white/[0.06] flex justify-end">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
          >
            Yangi oynada ochish
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Notification Bubble (Telegram chat style) ────────────────────────────────

function NotificationBubble({
  n,
  isUnread,
  onClientClick,
  onReceiptClick,
  expandAll,
}: {
  n: PosNotificationItem;
  isUnread: boolean;
  onClientClick: (code: string) => void;
  onReceiptClick: (id: number) => void;
  expandAll: boolean;
}) {
  const meta = STATUS_META[n.payment_status] ?? STATUS_META.pending;
  const hasReceipt = Boolean(n.receipt_s3_key);
  const [viewMode, setViewMode] = useState<'summary' | 'detail'>(() => expandAll ? 'detail' : 'summary');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-2xl px-4 py-3 border transition-colors",
        meta.border,
        isUnread
          ? "bg-white dark:bg-[#1a1a1a] shadow-sm"
          : "bg-gray-50/60 dark:bg-white/[0.03]"
      )}
    >
      {/* Unread dot */}
      {isUnread && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-orange-500" />
      )}

      {viewMode === 'summary' ? (
        <SummaryView
          n={n}
          meta={meta}
          hasReceipt={hasReceipt}
          onClientClick={onClientClick}
          onReceiptClick={onReceiptClick}
          onDetail={() => setViewMode('detail')}
        />
      ) : (
        <DetailView
          n={n}
          meta={meta}
          hasReceipt={hasReceipt}
          onClientClick={onClientClick}
          onReceiptClick={onReceiptClick}
          onBack={() => setViewMode('summary')}
        />
      )}
    </motion.div>
  );
}

// ─── Summary View (compact) ───────────────────────────────────────────────────

function SummaryView({
  n,
  meta,
  hasReceipt,
  onClientClick,
  onReceiptClick,
  onDetail,
}: {
  n: PosNotificationItem;
  meta: (typeof STATUS_META)["pending"];
  hasReceipt: boolean;
  onClientClick: (code: string) => void;
  onReceiptClick: (id: number) => void;
  onDetail: () => void;
}) {
  return (
    <>
      {/* Header: client + flight */}
      <div className="flex items-start justify-between gap-2 pr-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-gray-900 dark:text-white">
              {n.client_name || n.client_code}
            </span>
            <Badge
              variant="secondary"
              className="text-[10px] font-bold shrink-0 flex items-center gap-1 bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-gray-400"
            >
              <Plane className="h-3 w-3" />
              {n.flight_name}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
            <span className={cn("text-[11px] font-bold", meta.text)}>
              {meta.label}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              · {TYPE_LABEL[n.payment_type ?? ""] ?? n.payment_type ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Amounts */}
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-gray-500 dark:text-gray-400">To'langan:</span>
          <span className="font-bold text-gray-800 dark:text-gray-200">
            {formatSum(n.amount_paid)}
          </span>
        </div>
        {n.total_amount > 0 && (
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-gray-500 dark:text-gray-400">Jami:</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {formatSum(n.total_amount)}
            </span>
          </div>
        )}
        {n.remaining_amount > 0 && (
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-gray-500 dark:text-gray-400">Qoldiq:</span>
            <span className="font-bold text-red-600 dark:text-red-400">
              {formatSum(n.remaining_amount)}
            </span>
          </div>
        )}
      </div>

      {/* Cargo count badges */}
      {n.flight_items.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.06] text-[11px] font-medium text-gray-600 dark:text-gray-400">
            {n.flight_items.length} ta yuk
          </span>
          <span className="px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-500/10 text-[11px] font-medium text-green-600 dark:text-green-400">
            {n.flight_items.filter((i) => i.payment_status === "paid").length} to'langan
          </span>
          {n.flight_items.filter((i) => i.payment_status !== "paid").length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-500/10 text-[11px] font-medium text-red-600 dark:text-red-400">
              {n.flight_items.filter((i) => i.payment_status !== "paid").length} qoldi
            </span>
          )}
        </div>
      )}

      {/* Footer: actions */}
      <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-white/[0.05]">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
            <Calendar className="w-3 h-3" />
            {formatDateTime(n.created_at)}
          </div>
          {n.confirmed_by && n.confirmed_at && (
            <div className="flex items-center gap-1 text-[9px] text-green-600 dark:text-green-400">
              <CheckCheck className="w-2.5 h-2.5" />
              {n.confirmed_by} · {formatDateTime(n.confirmed_at)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {hasReceipt && (
            <button
              onClick={(e) => { e.stopPropagation(); onReceiptClick(n.id); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              <Receipt className="w-3 h-3" />
              Chek
            </button>
          )}
          <button
            onClick={() => onClientClick(n.client_code)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-sm"
          >
            <Eye className="w-3 h-3" />
            Ko'rish
          </button>
          <button
            onClick={onDetail}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-white/[0.06] border border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
          >
            Batafsil
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Detail View (full) ───────────────────────────────────────────────────────

function DetailView({
  n,
  meta,
  hasReceipt,
  onClientClick,
  onReceiptClick,
  onBack,
}: {
  n: PosNotificationItem;
  meta: (typeof STATUS_META)["pending"];
  hasReceipt: boolean;
  onClientClick: (code: string) => void;
  onReceiptClick: (id: number) => void;
  onBack: () => void;
}) {
  return (
    <>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-2"
      >
        <ChevronLeft className="w-4 h-4" />
        Orqaga
      </button>

      {/* Header: client + flight */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base text-gray-900 dark:text-white">
              {n.client_name || n.client_code}
            </span>
            <Badge
              variant="secondary"
              className="text-[10px] font-bold shrink-0 flex items-center gap-1 bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-gray-400"
            >
              <Plane className="h-3 w-3" />
              {n.flight_name}
            </Badge>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold", meta.bg, meta.text)}>
              {meta.label}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {TYPE_LABEL[n.payment_type ?? ""] ?? n.payment_type ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Amounts */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-gray-500 dark:text-gray-400">To'langan:</span>
          <span className="font-bold text-gray-800 dark:text-gray-200">
            {formatSum(n.amount_paid)}
          </span>
        </div>
        {n.total_amount > 0 && (
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-gray-500 dark:text-gray-400">Jami:</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {formatSum(n.total_amount)}
            </span>
          </div>
        )}
        {n.remaining_amount > 0 && (
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-gray-500 dark:text-gray-400">Qoldiq:</span>
            <span className="font-bold text-red-600 dark:text-red-400">
              {formatSum(n.remaining_amount)}
            </span>
          </div>
        )}
      </div>

      {/* Cargo items table */}
      {n.flight_items.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
            Yuklar ({n.flight_items.length})
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-white/[0.06]">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-white/[0.03] text-gray-400 dark:text-gray-500">
                  <th className="text-left py-1.5 px-2 font-medium">Yuk №</th>
                  <th className="text-left py-1.5 px-2 font-medium">Og&apos;irlik</th>
                  <th className="text-right py-1.5 px-2 font-medium">Jami</th>
                  <th className="text-right py-1.5 px-2 font-medium">Qoldiq</th>
                  <th className="text-right py-1.5 px-2 font-medium">Holat</th>
                </tr>
              </thead>
              <tbody>
                {n.flight_items.map((item) => {
                  const itemMeta = STATUS_META[item.payment_status] ?? STATUS_META.pending;
                  return (
                    <tr
                      key={item.cargo_id}
                      className="border-t border-gray-50 dark:border-white/[0.03]"
                    >
                      <td className="py-1.5 px-2 text-gray-600 dark:text-gray-400">
                        #{item.cargo_id}
                        {item.created_at && (
                          <span className="block text-[10px] text-gray-400 dark:text-gray-500">
                            {formatDateTime(item.created_at)}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-gray-500 dark:text-gray-400">{item.weight ?? "—"}</td>
                      <td className="py-1.5 px-2 text-right font-medium text-gray-700 dark:text-gray-300">
                        {formatSum(item.total_amount)}
                      </td>
                      <td className="py-1.5 px-2 text-right text-red-500 dark:text-red-400">
                        {item.remaining_amount > 0 ? formatSum(item.remaining_amount) : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <span className={cn("text-[10px] font-bold", itemMeta.text)}>
                          {itemMeta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment history */}
      {n.payment_history.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
            To&apos;lov tarixi ({n.payment_history.length})
          </div>
          <div className="space-y-1">
            {n.payment_history.map((ev, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-gray-50 dark:bg-white/[0.04]"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-gray-700 dark:text-gray-300 shrink-0">
                    {formatSum(ev.amount)}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500">·</span>
                  <span className="text-gray-500 dark:text-gray-400 capitalize">
                    {TYPE_LABEL[ev.provider] ?? ev.provider}
                  </span>
                  {ev.cashier && (
                    <>
                      <span className="text-gray-400 dark:text-gray-500">·</span>
                      <span className="text-gray-500 dark:text-gray-400 truncate">
                        {ev.cashier}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ev.remaining_after !== null && ev.remaining_after > 0 && (
                    <span className="text-red-500 dark:text-red-400 font-medium">
                      Qoldi: {formatSum(ev.remaining_after)}
                    </span>
                  )}
                  {ev.remaining_after !== null && ev.remaining_after === 0 && (
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      To&apos;landi
                    </span>
                  )}
                  <span className="text-gray-400 dark:text-gray-500">
                    {formatDateTime(ev.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-white/[0.05]">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
            <Calendar className="w-3 h-3" />
            {formatDateTime(n.created_at)}
          </div>
          {n.confirmed_by && n.confirmed_at && (
            <div className="flex items-center gap-1 text-[9px] text-green-600 dark:text-green-400">
              <CheckCheck className="w-2.5 h-2.5" />
              {n.confirmed_by} · {formatDateTime(n.confirmed_at)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {hasReceipt && (
            <button
              onClick={() => onReceiptClick(n.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              <Receipt className="w-3 h-3" />
              Chek
            </button>
          )}
          <button
            onClick={() => onClientClick(n.client_code)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-sm"
          >
            <Eye className="w-3 h-3" />
            Ko'rish
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  onChange,
  onReset,
}: {
  filters: NotificationFilters;
  onChange: (f: NotificationFilters) => void;
  onReset: () => void;
}) {
  const [localClientCode, setLocalClientCode] = useState(filters.client_code ?? "");
  const [showFilters, setShowFilters] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 640;
  });
  const hasFilters = Boolean(
    filters.status || filters.flight || filters.client_code || filters.date_from || filters.date_to || filters.time_from || filters.time_to || filters.strict
  );

  const applyClientCode = useCallback(() => {
    onChange({ ...filters, client_code: localClientCode.trim() || undefined });
  }, [filters, localClientCode, onChange]);

  // Re-evaluate on resize
  useEffect(() => {
    const onResize = () => {
      const isDesktop = window.innerWidth >= 640;
      setShowFilters((prev) => {
        if (isDesktop && !prev) return true;
        return prev;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="bg-gray-50/80 dark:bg-white/[0.03] border-b border-gray-100 dark:border-white/[0.06]">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setShowFilters((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-100/50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Filter
          </span>
          {hasFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {hasFilters && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              className="flex items-center gap-1 text-[10px] font-bold text-orange-500 hover:text-orange-600 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Tozalash
            </button>
          )}
          <span className="text-gray-300 dark:text-gray-700">
            {showFilters ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-2 p-3 pt-1">
              {/* Quick date presets */}
              <QuickDatePresets
                dateFrom={filters.date_from}
                dateTo={filters.date_to}
                onChange={(from, to) => onChange({ ...filters, date_from: from, date_to: to })}
              />

              {/* Status */}
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { value: undefined, label: "Barchasi" },
                  { value: "pending", label: "Kutilmoqda" },
                  { value: "partial", label: "Qisman" },
                  { value: "paid", label: "To'langan" },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => onChange({ ...filters, status: opt.value })}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all",
                      filters.status === opt.value || (!filters.status && !opt.value)
                        ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                        : "bg-white dark:bg-white/[0.05] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Client code */}
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={localClientCode}
                    onChange={(e) => setLocalClientCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && applyClientCode()}
                    placeholder="Mijoz kodi"
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] rounded-lg text-[11px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-900 dark:text-white placeholder:text-gray-400"
                  />
                </div>
                <button
                  onClick={applyClientCode}
                  className="px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-[11px] font-bold hover:opacity-90 transition-opacity"
                >
                  Izlash
                </button>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="relative">
                  <input
                    type="date"
                    value={filters.date_from ?? ""}
                    max={filters.date_to ?? undefined}
                    onChange={(e) => onChange({ ...filters, date_from: e.target.value || undefined })}
                    className="w-full px-2.5 pt-3 pb-1 bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] rounded-lg text-[11px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-700 dark:text-gray-200"
                  />
                  <span className="absolute left-2.5 top-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 pointer-events-none">
                    Sana (dan)
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="date"
                    value={filters.date_to ?? ""}
                    min={filters.date_from ?? undefined}
                    onChange={(e) => onChange({ ...filters, date_to: e.target.value || undefined })}
                    className="w-full px-2.5 pt-3 pb-1 bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] rounded-lg text-[11px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-700 dark:text-gray-200"
                  />
                  <span className="absolute left-2.5 top-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 pointer-events-none">
                    Sana (gacha)
                  </span>
                </div>
              </div>

              {/* Time range */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="relative">
                  <input
                    type="time"
                    value={filters.time_from ?? ""}
                    onChange={(e) => onChange({ ...filters, time_from: e.target.value || undefined })}
                    className="w-full px-2.5 pt-3 pb-1 bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] rounded-lg text-[11px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-700 dark:text-gray-200"
                  />
                  <span className="absolute left-2.5 top-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 pointer-events-none">
                    Soat (dan)
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="time"
                    value={filters.time_to ?? ""}
                    onChange={(e) => onChange({ ...filters, time_to: e.target.value || undefined })}
                    className="w-full px-2.5 pt-3 pb-1 bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] rounded-lg text-[11px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-700 dark:text-gray-200"
                  />
                  <span className="absolute left-2.5 top-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 pointer-events-none">
                    Soat (gacha)
                  </span>
                </div>
              </div>

              {/* Strict toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  className={cn(
                    "w-8 h-4 rounded-full transition-colors relative",
                    filters.strict ? "bg-orange-500" : "bg-gray-300 dark:bg-white/20"
                  )}
                  onClick={() => onChange({ ...filters, strict: !filters.strict })}
                >
                  <span
                    className={cn(
                      "absolute top-[2px] left-[2px] w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform duration-200",
                      filters.strict ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </div>
                <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                  Aniq moslash
                </span>
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  perPage,
  total,
  onPageChange,
}: {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-white/[0.06]">
      <span className="text-[11px] text-gray-400 dark:text-gray-500">
        {total} ta dan {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[12px] font-bold text-gray-700 dark:text-gray-300 min-w-[3rem] text-center">
          {page} / {pages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(pages, page + 1))}
          disabled={page >= pages}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Drawer Component ────────────────────────────────────────────────────

export function PaymentNotificationDrawer({
  notifications,
  total,
  page,
  perPage,
  unreadCount,
  filters,
  setPage,
  setFilters,
  resetFilters,
  markAllRead,
  readIds,
  onClientClick,
  isLoading,
}: Props) {
  const [receiptPreview, setReceiptPreview] = useState<{ url: string; contentType: string } | null>(null);
  const [isReceiptLoading, setIsReceiptLoading] = useState(false);
  const [expandAll, setExpandAll] = useState(false);

  const handleReceiptClick = useCallback(async (id: number) => {
    setIsReceiptLoading(true);
    try {
      const data = await posNotificationService.getReceiptUrl(id);
      setReceiptPreview({ url: data.url, contentType: data.content_type });
    } catch {
      // silently fail — receipt may not exist
    } finally {
      setIsReceiptLoading(false);
    }
  }, []);

  // Defensive deduplication: ensure only 1 card per (client, flight)
  const uniqueNotifications = useMemo(() => {
    const seen = new Set<string>();
    return notifications.filter((n) => {
      const key = `${(n.client_code ?? "").toUpperCase()}:${(n.flight_name ?? "").toUpperCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [notifications]);

  // Aggregate cargo stats across all visible notifications on the page
  const cargoStats = useMemo(() => {
    let total = 0;
    let paid = 0;
    let remaining = 0;
    for (const n of uniqueNotifications) {
      total += n.flight_items.length;
      paid += n.flight_items.filter((i) => i.payment_status === "paid").length;
      remaining += n.flight_items.filter((i) => i.payment_status !== "paid").length;
    }
    return { total, paid, remaining };
  }, [uniqueNotifications]);

  return (
    <>
      <Drawer direction="right">
        <DrawerTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="To'lov bildirishnomalari">
            <Wallet className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center text-[10px] px-1 text-white"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>
        </DrawerTrigger>

        <DrawerContent
          aria-describedby={undefined}
          className="
            !inset-0 !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-none
            overflow-hidden rounded-none border-l-0 bg-white pb-[env(safe-area-inset-bottom)]
            dark:bg-[#0b0f17]
            sm:!left-auto sm:!right-0 sm:!top-0 sm:!bottom-0 sm:!w-full sm:!max-w-lg
            sm:rounded-l-xl sm:border-l sm:pb-0
            flex flex-col
          "
        >
          {/* Header */}
          <DrawerHeader className="border-b border-gray-100 dark:border-white/[0.06] pb-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <DrawerTitle className="text-base font-bold text-gray-900 dark:text-white truncate">
                  To&apos;lov bildirishnomalari
                </DrawerTitle>
                {total > 0 && (
                  <Badge variant="secondary" className="text-[10px] font-bold bg-gray-100 dark:bg-white/[0.08] text-gray-500 dark:text-gray-400 shrink-0">
                    {total}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold" onClick={markAllRead}>
                    Barchasini o&apos;qildi
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[11px] font-bold text-orange-600 dark:text-orange-400"
                  onClick={() => setExpandAll((v) => !v)}
                >
                  {expandAll ? "Yopish" : "Batafsil"}
                </Button>
                <DrawerClose asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <X className="w-4 h-4" />
                  </Button>
                </DrawerClose>
              </div>
            </div>
          </DrawerHeader>

          {/* Filters */}
          <FilterBar filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} onReset={resetFilters} />

          {/* Cargo stats summary */}
          {cargoStats.total > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02]">
              <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.06] text-[11px] font-medium text-gray-600 dark:text-gray-400">
                {cargoStats.total} ta yuk
              </span>
              <span className="px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-500/10 text-[11px] font-medium text-green-600 dark:text-green-400">
                {cargoStats.paid} to&apos;langan
              </span>
              {cargoStats.remaining > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-500/10 text-[11px] font-medium text-red-600 dark:text-red-400">
                  {cargoStats.remaining} qoldi
                </span>
              )}
            </div>
          )}

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {isLoading && uniqueNotifications.length === 0 ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-gray-50 dark:bg-white/[0.04] rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : uniqueNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-10 h-10 text-gray-200 dark:text-gray-700 mb-3" strokeWidth={1.5} />
                <p className="text-[13px] font-medium text-gray-400 dark:text-gray-500">
                  Bildirishnomalar yo&apos;q
                </p>
                <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1">
                  Filterni o&apos;zgartiring yoki keyinroq qayta tekshiring
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {uniqueNotifications.map((n) => (
                  <NotificationBubble
                    key={n.id}
                    n={n}
                    isUnread={!readIds.has(n.id) && n.payment_status !== "paid"}
                    onClientClick={onClientClick}
                    onReceiptClick={handleReceiptClick}
                    expandAll={expandAll}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Pagination */}
          <Pagination page={page} perPage={perPage} total={total} onPageChange={setPage} />
        </DrawerContent>
      </Drawer>

      {/* Receipt preview modal */}
      <AnimatePresence>
        {receiptPreview && (
          <ReceiptPreview
            url={receiptPreview.url}
            contentType={receiptPreview.contentType}
            onClose={() => setReceiptPreview(null)}
          />
        )}
      </AnimatePresence>

      {/* Receipt loading overlay */}
      {isReceiptLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 shadow-xl flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Chek yuklanmoqda...</span>
          </div>
        </div>
      )}
    </>
  );
}
