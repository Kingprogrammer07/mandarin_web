import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Plane,
  Images,
  X,
} from "lucide-react";
import { useMyActivity } from "../../api/hooks/useWarehouse";
import { DELIVERY_METHOD_LABELS } from "../../schemas/warehouseSchemas";
import { formatCurrencySum, formatTashkentDateTime } from "../../lib/format";

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
};

function getPaymentStyle(status: string) {
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

interface MyActivityListProps {
  page: number;
  onPageChange: (page: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MyActivityList({ page, onPageChange }: MyActivityListProps) {
  const { data, isLoading } = useMyActivity(page, 20);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 bg-white dark:bg-white/[0.03] rounded-xl animate-pulse border border-gray-100 dark:border-white/[0.05]"
          />
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="py-20 text-center">
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
          Siz hali hech qanday yukni bermaganssiz
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Header row */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Mening faolligim
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md font-mono">
            {data.total_count} ta
          </span>
        </div>

        {/* Activity rows */}
        <div className="space-y-2">
          {data.items.map((item, idx) => {
            const methodLabel =
              DELIVERY_METHOD_LABELS[item.delivery_method] ?? item.delivery_method;
            const paymentStyle = getPaymentStyle(item.payment_status);

            return (
              <motion.div
                key={item.proof_id ?? item.transaction_id ?? idx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                className="p-3.5 bg-white dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/[0.05] border-l-[3px] border-l-emerald-400 dark:border-l-emerald-500 hover:shadow-sm transition-all"
              >
                {/* Top row: client + flight + date */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-gray-800 dark:text-white font-mono">
                        {item.client_code}
                      </span>
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
                </div>

                {/* Bottom row: amounts + payment badge + photos */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Amount */}
                  {item.total_amount != null && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-[12px] font-bold text-gray-800 dark:text-white">
                        {formatCurrencySum(item.total_amount)}
                      </span>
                      {item.remaining_amount > 0 && item.payment_status !== "paid" && (
                        <span className="text-[10px] font-semibold text-red-500 dark:text-red-400">
                          −{formatCurrencySum(item.remaining_amount)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Payment status */}
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${paymentStyle.bg} ${paymentStyle.text}`}>
                    {paymentStyle.label}
                  </span>

                  {/* Photo thumbnails */}
                  {item.photo_urls.length > 0 && (
                    <div className="flex items-center gap-1 ml-auto">
                      <div className="flex -space-x-1.5">
                        {item.photo_urls.slice(0, 3).map((url, photoIdx) => (
                          <button
                            key={photoIdx}
                            type="button"
                            onClick={() => setLightbox({ urls: item.photo_urls, index: photoIdx })}
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
                          onClick={() => setLightbox({ urls: item.photo_urls, index: 3 })}
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
      </div>

      {/* Photo lightbox */}
      {lightbox && (
        <PhotoLightbox
          urls={lightbox.urls}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
