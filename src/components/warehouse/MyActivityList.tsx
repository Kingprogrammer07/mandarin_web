import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Package,
  Plane,
  Images,
  X,
  User,
  Users,
  Search,
  ShieldCheck,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMyActivity, useAllWarehouseActivity, useUndoTakeaway } from "../../api/hooks/useWarehouse";
import { formatCurrencySum, formatTashkentDateTime } from "../../lib/format";
import { cn } from "../../lib/utils";

// ── Payment badge ─────────────────────────────────────────────────────────────

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
  unpaid: {
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-500 dark:text-red-400",
    label: "To'lanmagan",
  },
  pending: {
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-500 dark:text-red-400",
    label: "Qarzdor",
  },
  mixed: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    label: "Aralash",
  },
};

function getPaymentStyle(status: string | null) {
  if (!status) {
    return {
      bg: "bg-gray-50 dark:bg-white/[0.04]",
      text: "text-gray-500 dark:text-gray-400",
      label: "Noma'lum",
    };
  }

  return (
    PAYMENT_STYLES[status] ?? {
      bg: "bg-gray-50 dark:bg-white/[0.04]",
      text: "text-gray-500 dark:text-gray-400",
      label: status,
    }
  );
}

// ── Photo lightbox ────────────────────────────────────────────────────────────

function PhotoLightbox({
  urls,
  initialIndex,
  onClose,
}: {
  urls: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(initialIndex);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative max-w-2xl w-full"
        >
          <button
            onClick={onClose}
            className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <img
            src={urls[current]}
            alt={`Rasm ${current + 1}`}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.5'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5L5 21'/%3E%3C/svg%3E";
            }}
            className="w-full max-h-[75vh] object-contain rounded-2xl"
          />

          {urls.length > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                disabled={current === 0}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-white/70 text-[13px] font-medium tabular-nums">
                {current + 1} / {urls.length}
              </span>
              <button
                onClick={() => setCurrent((c) => Math.min(urls.length - 1, c + 1))}
                disabled={current === urls.length - 1}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export type ActivityScope = "self" | "all";

export interface ActivityItemData {
  transaction_ids: number[];
  client_code: string | null;
  flight_name: string | null;
  delivery_method: string | null;
  delivery_method_label: string | null;
}

interface MyActivityListProps {
  scope: ActivityScope;
  onScopeChange: (scope: ActivityScope) => void;
  clientCode: string;
  onClientCodeChange: (value: string) => void;
  strict: boolean;
  onStrictChange: (value: boolean) => void;
  page: number;
  onPageChange: (page: number) => void;
  onRedeliver?: (item: ActivityItemData) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MyActivityList({
  scope,
  onScopeChange,
  clientCode,
  onClientCodeChange,
  strict,
  onStrictChange,
  page,
  onPageChange,
  onRedeliver,
}: MyActivityListProps) {
  const undoMutation = useUndoTakeaway();

  // Debounced client code input (500 ms) to avoid firing a request on every keystroke
  const [inputValue, setInputValue] = useState(clientCode);
  useEffect(() => {
    setInputValue(clientCode);
  }, [clientCode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== clientCode) {
        onClientCodeChange(inputValue);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [inputValue, clientCode, onClientCodeChange]);

  const params = {
    page,
    size: 20,
    ...(clientCode.trim() ? { client_code: clientCode.trim() } : {}),
    ...(strict ? { strict: true } : {}),
  };

  const qc = useQueryClient();
  const selfQuery = useMyActivity(params);
  const allQuery = useAllWarehouseActivity(params);
  const { data, isLoading, isFetching } = scope === "self" ? selfQuery : allQuery;

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["warehouse_my_activity"] });
    qc.invalidateQueries({ queryKey: ["warehouse_all_activity"] });
  };

  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  const headerLabel = scope === "self" ? "Mening faolligim" : "Barcha ishchilar faolligi";

  return (
    <div className="space-y-3">
      {/* Scope toggle + Filter bar */}
      <div className="space-y-2.5">
        {/* Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-white/[0.05] rounded-xl">
          <button
            type="button"
            onClick={() => onScopeChange("self")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold transition-all",
              scope === "self"
                ? "bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            )}
          >
            <User className="w-3.5 h-3.5" />
            O'zim
          </button>
          <button
            type="button"
            onClick={() => onScopeChange("all")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold transition-all",
              scope === "all"
                ? "bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Barcha
          </button>
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Mijoz kodi..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border-2 border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-[13px] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:border-orange-400 dark:focus:border-orange-500/50 outline-none transition-all"
            />
          </div>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-[12px] font-bold text-gray-600 dark:text-gray-400 cursor-pointer select-none active:scale-[0.97] transition-all shrink-0">
            <input
              type="checkbox"
              checked={strict}
              onChange={(e) => onStrictChange(e.target.checked)}
              className="w-3.5 h-3.5 accent-orange-500 rounded"
            />
            Aniq
          </label>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isFetching}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border-2 border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-gray-500 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 hover:border-orange-200 dark:hover:border-orange-500/30 disabled:opacity-50 transition-all"
            title="Yangilash"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 bg-white dark:bg-white/[0.03] rounded-xl animate-pulse border border-gray-100 dark:border-white/[0.05]"
            />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && (!data || data.items.length === 0) && (
        <div className="py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-50 dark:bg-white/[0.04] flex items-center justify-center">
            <ClipboardCheck
              className="w-7 h-7 text-gray-300 dark:text-gray-600"
              strokeWidth={1.5}
            />
          </div>
          <p className="text-[13px] font-semibold text-gray-400 dark:text-gray-500">
            Faollik tarixi yo'q
          </p>
          <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1">
            {scope === "self"
              ? "Siz hali hech qanday yukni bermaganssiz"
              : "Bu filter bo'yicha hech qanday yozuv topilmadi"}
          </p>
        </div>
      )}

      {/* List */}
      {!isLoading && data && data.items.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-1">
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              {headerLabel}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md font-mono">
              {data.total_count} ta
            </span>
          </div>

          <div className="space-y-2">
            {data.items.map((item, idx) => {
              const methodLabel = item.delivery_method_label || item.delivery_method;
              const paymentStyle = getPaymentStyle(item.payment_status);
              const cargoCount = item.cargo_count || item.transactions?.length || 1;
              const transactionRows = item.transactions ?? [];
              const transactionIds = item.transaction_ids?.length
                ? item.transaction_ids
                : [item.transaction_id];

              return (
                <motion.div
                  key={item.proof_id ?? item.transaction_id ?? idx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                  className="p-3.5 bg-white dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/[0.05] border-l-[3px] border-l-emerald-400 dark:border-l-emerald-500 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => {
                    const txIds = item.transaction_ids?.length
                      ? item.transaction_ids
                      : item.transaction_id
                        ? [item.transaction_id]
                        : [];
                    if (onRedeliver && txIds.length) {
                      onRedeliver({
                        transaction_ids: txIds,
                        client_code: item.client_code,
                        flight_name: item.flight_name,
                        delivery_method: item.delivery_method,
                        delivery_method_label: item.delivery_method_label,
                      });
                    }
                  }}
                >
                  {/* Top row: client + flight + date */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-gray-800 dark:text-white font-mono">
                          {item.client_code}
                        </span>
                        {cargoCount > 1 && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-0.5 text-[10px] font-black text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
                            <Package className="h-3 w-3" />
                            {cargoCount} ta yuk
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                          <Plane className="w-3 h-3 shrink-0" strokeWidth={1.8} />
                          {item.flight_name}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">
                        {formatTashkentDateTime(item.created_at)}
                      </p>
                    </div>

                    {/* Delivery method badge */}
                    <span className="shrink-0 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 px-2 py-1 rounded-lg">
                      {methodLabel}
                    </span>

                    {/* Undo button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const txIds = item.transaction_ids?.length
                          ? item.transaction_ids
                          : item.transaction_id
                            ? [item.transaction_id]
                            : [];
                        if (txIds.length && !undoMutation.isPending) {
                          undoMutation.mutate(txIds);
                        }
                      }}
                      disabled={undoMutation.isPending}
                      className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 px-2 py-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      title="Olib ketilgan belgisini bekor qilish"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Bekor qilish
                    </button>
                  </div>

                  {/* Worker info (only in all-activity mode) */}
                  {scope === "all" && (item.worker_username || item.worker_role) && (
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-gray-700 dark:text-gray-300">
                        <ShieldCheck className="h-3 w-3" />
                        {item.worker_username ?? "—"}
                      </span>
                      {item.worker_role && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                          {item.worker_role}
                        </span>
                      )}
                    </div>
                  )}

                  {(item.uzpost_order_number || item.uzpost_printer_status || item.uzpost_label_pdf_url) && (
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      {item.uzpost_order_number && (
                        <span className="rounded-lg bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
                          UzPost #{item.uzpost_order_number}
                        </span>
                      )}
                      {item.uzpost_order_status && (
                        <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          {item.uzpost_order_status}
                        </span>
                      )}
                      {item.uzpost_printer_status && (
                        <span className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                          Printer: {item.uzpost_printer_status}
                        </span>
                      )}
                      {item.uzpost_label_pdf_url && (
                        <a
                          href={item.uzpost_label_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-700 dark:bg-white/[0.06] dark:text-gray-300"
                        >
                          <FileText className="h-3 w-3" />
                          PDF
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}

                  {transactionRows.length > 1 && (
                    <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                      {transactionRows.map((transaction) => (
                        <span
                          key={`${transaction.proof_id}-${transaction.transaction_id}`}
                          className="shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-bold text-gray-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300"
                          title={`Transaction #${transaction.transaction_id}`}
                        >
                          #{transaction.row_number ?? transaction.transaction_id}
                          {transaction.weight ? ` · ${transaction.weight} kg` : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Bottom row: amounts + payment badge + photos */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Amount */}
                    {item.total_amount != null && (
                      <div className="flex items-baseline gap-1">
                        <span className="text-[12px] font-bold text-gray-800 dark:text-white">
                          {formatCurrencySum(item.total_amount)}
                        </span>
                        {(item.remaining_amount ?? 0) > 0 && item.payment_status !== "paid" && (
                          <span className="text-[10px] font-semibold text-red-500 dark:text-red-400">
                            −{formatCurrencySum(item.remaining_amount ?? 0)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Payment status */}
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${paymentStyle.bg} ${paymentStyle.text}`}>
                      {paymentStyle.label}
                    </span>

                    {cargoCount > 1 && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
                        ID: {transactionIds.join(", ")}
                      </span>
                    )}

                    {/* Photo thumbnails */}
                    {item.photo_urls.length > 0 && (
                      <div className="flex items-center gap-1 ml-auto">
                        <div className="flex -space-x-1.5">
                          {item.photo_urls.slice(0, 3).map((url, photoIdx) => (
                            <button
                              key={photoIdx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightbox({ urls: item.photo_urls, index: photoIdx });
                              }}
                              className="w-7 h-7 rounded-lg border-2 border-white dark:border-[#0d0d0d] overflow-hidden hover:scale-110 hover:z-10 relative transition-transform"
                            >
                              <img
                                src={url}
                                alt={`Rasm ${photoIdx + 1}`}
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                                loading="lazy"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                        {item.photo_urls.length > 3 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightbox({ urls: item.photo_urls, index: 3 });
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold text-gray-500 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                          >
                            <Images className="w-3.5 h-3.5" />
                            +{item.photo_urls.length - 3}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Pagination */}
          {data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: Math.min(data.total_pages, 7) }, (_, i) => {
                let pageNum: number;
                if (data.total_pages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= data.total_pages - 3) {
                  pageNum = data.total_pages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-[12px] font-bold transition-all ${
                      pageNum === page
                        ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                        : "bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= data.total_pages}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Photo lightbox */}
      {lightbox && (
        <PhotoLightbox
          urls={lightbox.urls}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
