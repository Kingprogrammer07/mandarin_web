import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  AlertCircle,
  Loader2,
  Trash2,
  RotateCcw,
  X,
  Plane,
  CheckCheck,
  ClockArrowUp,
} from "lucide-react";
import { useWarehouseQueueStore } from "../../store/useWarehouseQueueStore";
import type { WarehouseQueueItem } from "../../store/useWarehouseQueueStore";
import { DELIVERY_METHOD_LABELS } from "../../schemas/warehouseSchemas";
import { formatTashkentDateTime } from "../../lib/format";

// ── Item card ─────────────────────────────────────────────────────────────────

function QueueItemCard({
  item,
  onRetry,
  onDelete,
}: {
  item: WarehouseQueueItem;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    await onRetry(item.id);
    setIsRetrying(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(item.id);
    setIsDeleting(false);
  };

  const methodLabel = DELIVERY_METHOD_LABELS[item.deliveryMethod] ?? item.deliveryMethod;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`p-3.5 rounded-xl border border-l-[3px] transition-all ${
        item.status === "error"
          ? "bg-red-50 dark:bg-red-500/[0.05] border-red-100 dark:border-red-500/10 border-l-red-400 dark:border-l-red-500"
          : item.status === "uploading"
            ? "bg-orange-50 dark:bg-orange-500/[0.05] border-orange-100 dark:border-orange-500/10 border-l-orange-400 dark:border-l-orange-500"
            : "bg-white dark:bg-white/[0.03] border-gray-100 dark:border-white/[0.05] border-l-gray-300 dark:border-l-white/20"
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-gray-800 dark:text-white font-mono">
              {item.clientCode}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
              <Plane className="w-3 h-3 shrink-0" strokeWidth={1.8} />
              {item.flightName}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">
            {methodLabel} · {item.photos.length} rasm ·{" "}
            {formatTashkentDateTime(new Date(item.timestamp).toISOString())}
          </p>
        </div>

        {/* Status indicator */}
        <div className="shrink-0">
          {item.status === "uploading" && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/10 px-2 py-1 rounded-lg">
              <Loader2 className="w-3 h-3 animate-spin" />
              Yuklanmoqda
            </span>
          )}
          {item.status === "error" && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/10 px-2 py-1 rounded-lg">
              <AlertCircle className="w-3 h-3" />
              Xatolik
            </span>
          )}
          {item.status === "pending" && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/[0.06] px-2 py-1 rounded-lg">
              <ClockArrowUp className="w-3 h-3" />
              Navbatda
            </span>
          )}
        </div>
      </div>

      {/* Error message */}
      {item.status === "error" && item.error && (
        <p className="mt-2 text-[11px] text-red-600 dark:text-red-400 bg-red-100/60 dark:bg-red-500/[0.08] px-2.5 py-1.5 rounded-lg">
          {item.error}
        </p>
      )}

      {/* Actions (only for error state) */}
      {item.status === "error" && (
        <div className="flex items-center gap-2 mt-2.5">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg shadow-sm shadow-orange-500/20 hover:shadow-md disabled:opacity-50 transition-all active:scale-[0.97]"
          >
            {isRetrying ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RotateCcw className="w-3 h-3" />
            )}
            Qayta urinish
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50 transition-all active:scale-[0.97]"
          >
            {isDeleting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
            O'chirish
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WarehouseOfflineManager() {
  const items = useWarehouseQueueStore((s) => s.items);
  const retryItem = useWarehouseQueueStore((s) => s.retryItem);
  const deleteItem = useWarehouseQueueStore((s) => s.deleteItem);
  const [isOpen, setIsOpen] = useState(false);
  const [isRetryingAll, setIsRetryingAll] = useState(false);

  const errorItems = items.filter((i) => i.status === "error");
  const uploadingItems = items.filter((i) => i.status === "uploading");
  const pendingItems = items.filter((i) => i.status === "pending");

  const totalCount = items.length;
  const errorCount = errorItems.length;
  const isActivelyUploading = uploadingItems.length > 0;

  const handleRetryAll = async () => {
    setIsRetryingAll(true);
    for (const item of errorItems) {
      await retryItem(item.id);
    }
    setIsRetryingAll(false);
  };

  // No items — nothing to show
  if (totalCount === 0) return null;

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label={`Yuklash navbati — ${totalCount} ta element`}
        className="fixed right-4 z-30 flex items-center gap-2 pl-3.5 pr-4 py-2.5 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/[0.1] rounded-2xl shadow-lg shadow-black/10 dark:shadow-black/30 hover:shadow-xl transition-all active:scale-[0.97] min-h-[44px]"
        style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="relative">
          {isActivelyUploading ? (
            <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
          ) : errorCount > 0 ? (
            <AlertCircle className="w-4 h-4 text-red-500" />
          ) : (
            <Upload className="w-4 h-4 text-orange-500" />
          )}
        </div>
        <span className="text-[12px] font-bold text-gray-700 dark:text-gray-300">
          {isActivelyUploading
            ? "Yuklanmoqda..."
            : errorCount > 0
              ? `${errorCount} ta xatolik`
              : `${pendingItems.length} ta navbatda`}
        </span>
        {totalCount > 0 && (
          <span className="text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
            {totalCount}
          </span>
        )}
      </button>

      {/* Full-screen overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#f5f5f4] dark:bg-[#0d0d0d] flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="shrink-0 flex items-center justify-between px-5 py-4 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-white/[0.08]">
                <div>
                  <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">
                    Yuklash navbati
                  </h2>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    {pendingItems.length} ta navbatda ·{" "}
                    {uploadingItems.length > 0 && `${uploadingItems.length} ta yuklanmoqda · `}
                    {errorCount > 0 && `${errorCount} ta xatolik`}
                    {errorCount === 0 && uploadingItems.length === 0 && "hammasi kutilmoqda"}
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-2">
                <AnimatePresence mode="popLayout">
                  {items.map((item) => (
                    <QueueItemCard
                      key={item.id}
                      item={item}
                      onRetry={retryItem}
                      onDelete={deleteItem}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* Footer actions */}
              {errorCount > 1 && (
                <div className="shrink-0 px-4 py-4 bg-white dark:bg-[#111] border-t border-gray-200 dark:border-white/[0.08]">
                  <button
                    onClick={handleRetryAll}
                    disabled={isRetryingAll}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-[13px] rounded-2xl shadow-lg shadow-orange-500/20 hover:shadow-xl disabled:opacity-60 flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                  >
                    {isRetryingAll ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCheck className="w-4 h-4" />
                    )}
                    Barchasini qayta yuborish ({errorCount} ta)
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
