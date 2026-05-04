import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  ChevronDown,
  Plane,
  CheckCheck,
  Clock,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  MapPin,
  Phone,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  PICKUP_METHOD_LABELS,
  PICKUP_STATUS_LABELS,
  PICKUP_PRIORITY_LABELS,
} from "../../api/pickupQueue";
import type {
  PickupMethod,
  WarehousePickupQueueEntry,
  WarehousePickupQueueTransaction,
} from "../../api/pickupQueue";
import { useCancelPickupQueue } from "../../api/hooks/usePickupQueue";
import { formatCurrencySum, formatTashkentDateTime } from "../../lib/format";

interface PickupQueuePanelProps {
  items: WarehousePickupQueueEntry[];
  isLoading: boolean;
  pickupMethod: PickupMethod;
  onPickupMethodChange: (method: PickupMethod) => void;
  onMarkTaken: (
    transactionIds: number[],
    clientCode: string,
    flightName: string,
    isTakenAway: boolean,
    deliveryMethods: { value: string; label: string }[],
  ) => void;
  canMarkTaken: boolean;
  canCancel?: boolean;
}

function getRemainingTransactions(entry: WarehousePickupQueueEntry): {
  flightName: string;
  transactions: WarehousePickupQueueTransaction[];
}[] {
  return entry.flights
    .map((f) => ({
      flightName: f.flight_name,
      transactions: f.transactions.filter((tx) => !tx.is_taken_away),
    }))
    .filter((g) => g.transactions.length > 0);
}

export default function PickupQueuePanel({
  items,
  isLoading,
  pickupMethod,
  onMarkTaken,
  canMarkTaken,
  canCancel = false,
}: PickupQueuePanelProps) {
  const [expandedQueueIds, setExpandedQueueIds] = useState<Record<number, boolean>>({});
  const cancelMutation = useCancelPickupQueue();

  // Image lightbox state
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const toggleQueue = (queueId: number) => {
    setExpandedQueueIds((prev) => ({
      ...prev,
      [queueId]: !prev[queueId],
    }));
  };

  const openLightbox = useCallback((photos: string[], index: number) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => (i > 0 ? i - 1 : lightboxPhotos.length - 1));
  }, [lightboxPhotos.length]);

  const goNext = useCallback(() => {
    setLightboxIndex((i) => (i < lightboxPhotos.length - 1 ? i + 1 : 0));
  }, [lightboxPhotos.length]);

  const handleCopy = useCallback((text: string | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Nusxalandi!");
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, closeLightbox, goPrev, goNext]);

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 bg-white/50 dark:bg-white/[0.02] rounded-2xl animate-pulse border border-white/20 dark:border-white/[0.05]"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <Package
          className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600"
          strokeWidth={1.5}
        />
        <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400">
          Navbatlar yo'q
        </p>
        <p className="text-[12px] text-gray-400 dark:text-gray-600 mt-1">
          {PICKUP_METHOD_LABELS[pickupMethod]} usulida faol navbat yo'q
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((entry) => {
        const isExpanded = expandedQueueIds[entry.queue_id] ?? true;
        const statusLabel = PICKUP_STATUS_LABELS[entry.queue_status];
        const remainingGroups = getRemainingTransactions(entry);
        const allRemainingTxIds = remainingGroups.flatMap((g) =>
          g.transactions.map((tx) => tx.id),
        );
        const hasRemaining = allRemainingTxIds.length > 0;

        return (
          <div
            key={entry.queue_id}
            className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/[0.08] overflow-hidden shadow-sm"
          >
            {/* Queue card header */}
            <div
              onClick={() => toggleQueue(entry.queue_id)}
              className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
                  <span className="text-[13px] font-black text-orange-500">
                    #{entry.display_number}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-gray-900 dark:text-white font-mono">
                      {entry.client_code}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300">
                      {PICKUP_METHOD_LABELS[entry.pickup_method]}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        entry.queue_status === "ready"
                          ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                          : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {statusLabel}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        entry.priority === "vip"
                          ? "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400"
                          : entry.priority === "high"
                          ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {PICKUP_PRIORITY_LABELS[entry.priority]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                    <span>
                      {entry.remaining_cargo_count}/{entry.cargo_count} yuk
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTashkentDateTime(entry.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {canCancel && entry.queue_status === 'preparing' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Navbatni bekor qilishni xohlaysizmi?')) {
                        cancelMutation.mutate({ queueId: entry.queue_id, data: {} });
                      }
                    }}
                    disabled={cancelMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    Bekor
                  </button>
                )}
                {canMarkTaken && hasRemaining && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkTaken(
                        allRemainingTxIds,
                        entry.client_code,
                        remainingGroups.map((g) => g.flightName).join(", "),
                        false,
                        [{ value: entry.pickup_method, label: PICKUP_METHOD_LABELS[entry.pickup_method] }],
                      );
                    }}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Berish
                  </button>
                )}
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>

            {/* Expanded flights & transactions */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-gray-100 dark:border-white/[0.05] px-3 sm:px-4 py-3 space-y-3">
                    {entry.note && (
                      <div className="flex items-start gap-2 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/[0.03] rounded-lg p-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{entry.note}</span>
                      </div>
                    )}

                    {/* Delivery request courier hand-off block */}
                    {entry.source === "delivery_request" && (
                      <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-3 space-y-2">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Yetkazib berish ma'lumotlari
                        </div>

                        {entry.recipient_phone && (
                          <div className="flex items-center justify-between gap-2 bg-white dark:bg-white/[0.04] rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Phone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100 truncate">
                                {entry.recipient_phone}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(entry.recipient_phone);
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-200 dark:hover:bg-blue-500/25 transition-colors shrink-0"
                            >
                              <Copy className="w-3 h-3" />
                              Nusxa
                            </button>
                          </div>
                        )}

                        {entry.caption && (
                          <div className="flex items-start justify-between gap-2 bg-white dark:bg-white/[0.04] rounded-lg px-3 py-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                              <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300 leading-relaxed">
                                {entry.caption}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(entry.caption);
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-200 dark:hover:bg-blue-500/25 transition-colors shrink-0"
                            >
                              <Copy className="w-3 h-3" />
                              Nusxa
                            </button>
                          </div>
                        )}

                        {entry.location_url && (
                          <a
                            href={entry.location_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold transition-colors"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            Xaritada ochish
                          </a>
                        )}
                      </div>
                    )}

                    {entry.flights.map((flight) => (
                      <div key={flight.flight_name} className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Plane className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="text-[12px] font-bold text-gray-700 dark:text-gray-300">
                            {flight.flight_name}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {flight.transactions.length} ta
                          </span>
                          {/* Flight cargo photos */}
                          {flight.flight_cargo_photos && flight.flight_cargo_photos.length > 0 && (
                            <div className="flex items-center gap-1 ml-1">
                              {flight.flight_cargo_photos.slice(0, 3).map((url, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openLightbox(flight.flight_cargo_photos, idx);
                                  }}
                                  className="w-6 h-6 rounded-md overflow-hidden bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-white/10 hover:opacity-80 transition-opacity"
                                >
                                  <img
                                    src={url}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                </button>
                              ))}
                              {flight.flight_cargo_photos.length > 3 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openLightbox(flight.flight_cargo_photos, 3);
                                  }}
                                  className="text-[9px] text-gray-400 hover:text-orange-500 transition-colors"
                                >
                                  +{flight.flight_cargo_photos.length - 3}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1 pl-5">
                          {flight.transactions.map((tx) => (
                            <div
                              key={tx.id}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg text-[12px] ${
                                tx.is_taken_away
                                  ? "bg-green-50/50 dark:bg-green-500/[0.04] text-green-700 dark:text-green-400"
                                  : "bg-gray-50 dark:bg-white/[0.03] text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold">
                                  #{tx.qator_raqami}
                                </span>
                                <span>{tx.vazn} kg</span>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    tx.payment_status === "paid"
                                      ? "bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                                      : tx.payment_status === "partial"
                                      ? "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                      : "bg-gray-100 dark:bg-white/[0.06] text-gray-500"
                                  }`}
                                >
                                  {tx.payment_status === "paid"
                                    ? "To'landi"
                                    : tx.payment_status === "partial"
                                    ? "Qisman"
                                    : tx.payment_status ?? "—"}
                                </span>
                                {tx.is_taken_away && (
                                  <span className="text-[10px] font-bold text-green-600 dark:text-green-400">
                                    Berilgan
                                  </span>
                                )}
                              </div>
                              <span className="font-bold">
                                {tx.summa != null ? formatCurrencySum(tx.summa) : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {canMarkTaken && hasRemaining && (
                      <button
                        onClick={() =>
                          onMarkTaken(
                            allRemainingTxIds,
                            entry.client_code,
                            remainingGroups.map((g) => g.flightName).join(", "),
                            false,
                            [{ value: entry.pickup_method, label: PICKUP_METHOD_LABELS[entry.pickup_method] }],
                          )
                        }
                        className="w-full sm:hidden flex items-center justify-center gap-2 py-2.5 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 rounded-xl text-[13px] font-bold"
                      >
                        <CheckCheck className="w-4 h-4" />
                        Berish ({allRemainingTxIds.length} ta)
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
      {/* Image Lightbox */}
      <AnimatePresence>
        {lightboxOpen && lightboxPhotos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={closeLightbox}
          >
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-[71]"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Prev */}
            {lightboxPhotos.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-[71]"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Image */}
            <motion.img
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              src={lightboxPhotos[lightboxIndex]}
              alt={`Rasm ${lightboxIndex + 1} / ${lightboxPhotos.length}`}
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Next */}
            {lightboxPhotos.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-[71]"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/50 text-white text-xs font-bold">
              {lightboxIndex + 1} / {lightboxPhotos.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
