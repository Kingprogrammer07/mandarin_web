import { useState, useCallback, useId } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Camera,
  Images,
  Loader2,
  Trash2,
  Truck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  markTakenSchema,
  DELIVERY_METHODS,
  DELIVERY_METHOD_LABELS,
} from "../../schemas/warehouseSchemas";
import type { MarkTakenFormValues } from "../../schemas/warehouseSchemas";
import { useWarehouseQueueStore } from "../../store/useWarehouseQueueStore";

// ── Image compression ─────────────────────────────────────────────────────────

/** Compresses an image to max 1280px wide at 82% JPEG quality using canvas API. */
async function compressImage(file: File): Promise<File> {
  const MAX_WIDTH = 1280;
  const QUALITY = 0.82;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      if (img.width <= MAX_WIDTH) {
        resolve(file);
        return;
      }

      const scale = MAX_WIDTH / img.width;
      const canvas = document.createElement("canvas");
      canvas.width = MAX_WIDTH;
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            }),
          );
        },
        "image/jpeg",
        QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface MarkTakenModalProps {
  transactionId: number;
  clientCode: string;
  flightName: string;
  isOpen: boolean;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MarkTakenModal({
  transactionId,
  clientCode,
  flightName,
  isOpen,
  onClose,
}: MarkTakenModalProps) {
  const enqueue = useWarehouseQueueStore((s) => s.enqueue);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);

  // Unique IDs so labels correctly bind to inputs even if multiple modals exist
  const cameraInputId = useId();
  const galleryInputId = useId();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<MarkTakenFormValues>({
    resolver: zodResolver(markTakenSchema),
    defaultValues: { delivery_method: undefined, photos: [] },
  });

  const photos = watch("photos") ?? [];

  const handleClose = useCallback(() => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPreviews([]);
    reset();
    onClose();
  }, [previews, reset, onClose]);

  const handleFileChange = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setIsCompressing(true);
      try {
        const remaining = 10 - photos.length;
        const toProcess = Array.from(files).slice(0, remaining);
        const compressed = await Promise.all(toProcess.map(compressImage));
        const combined = [...photos, ...compressed];
        setValue("photos", combined, { shouldValidate: true });
        previews.forEach((url) => URL.revokeObjectURL(url));
        setPreviews(combined.map((f) => URL.createObjectURL(f)));
      } finally {
        setIsCompressing(false);
      }
    },
    [photos, previews, setValue],
  );

  const removePhoto = useCallback(
    (index: number) => {
      const updated = photos.filter((_, i) => i !== index);
      setValue("photos", updated, { shouldValidate: true });
      URL.revokeObjectURL(previews[index]);
      setPreviews((prev) => prev.filter((_, i) => i !== index));
    },
    [photos, previews, setValue],
  );

  const onSubmit = useCallback(
    async (data: MarkTakenFormValues) => {
      previews.forEach((url) => URL.revokeObjectURL(url));
      setPreviews([]);
      reset();
      onClose();

      await enqueue({
        transactionId,
        clientCode,
        flightName,
        deliveryMethod: data.delivery_method,
        photos: data.photos,
      });

      toast.success(`${clientCode} — navbatga qo'shildi`, {
        description: "Yuk orqa fonda yuborilmoqda",
        duration: 3000,
      });
    },
    [previews, reset, onClose, enqueue, transactionId, clientCode, flightName],
  );

  const canAddMore = photos.length < 10;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
          onClick={handleClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mark-taken-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-white dark:bg-[#111] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: "92dvh" }}
          >
            {/* Drag handle — mobile only */}
            <div className="sm:hidden shrink-0 pt-3 pb-1 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-white/10" />
            </div>

            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-orange-500" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 id="mark-taken-title" className="text-[15px] font-bold text-gray-900 dark:text-white">
                    Yukni berish
                  </h2>
                  <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                    <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
                      {clientCode}
                    </span>
                    <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
                    {flightName}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-9 h-9 flex items-center justify-center rounded-2xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex-1 overflow-y-auto overscroll-contain"
            >
              <div className="px-5 pt-5 pb-4 space-y-6">

                {/* ── Delivery method ────────────────────────────────────── */}
                <div>
                  <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                    Yetkazib berish usuli
                  </p>
                  <Controller
                    name="delivery_method"
                    control={control}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 gap-2.5">
                        {DELIVERY_METHODS.map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => field.onChange(method)}
                            className={`relative flex items-center justify-center px-4 py-3.5 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-[0.96] ${
                              field.value === method
                                ? method === "self_pickup"
                                  ? "bg-blue-50 dark:bg-blue-500/10 border-blue-400 dark:border-blue-500/50 text-blue-700 dark:text-blue-400"
                                  : "bg-orange-50 dark:bg-orange-500/10 border-orange-400 dark:border-orange-500/50 text-orange-700 dark:text-orange-400"
                                : "bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/[0.07] text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {DELIVERY_METHOD_LABELS[method]}
                            {field.value === method && (
                              <motion.div
                                layoutId="delivery-check"
                                className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-orange-500"
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                  {errors.delivery_method && (
                    <p className="mt-2 text-[12px] text-red-500 font-medium">
                      {errors.delivery_method.message}
                    </p>
                  )}
                </div>

                {/* ── Photo upload ───────────────────────────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Isbotlovchi rasmlar
                      <span className="ml-1.5 normal-case font-normal">
                        ({photos.length}/10)
                      </span>
                    </p>
                    {isCompressing && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-orange-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Siqilmoqda...
                      </span>
                    )}
                  </div>

                  {/* Camera + Gallery — using <label> for reliable mobile camera trigger */}
                  {canAddMore && (
                    <div className="grid grid-cols-2 gap-2.5 mb-4">
                      {/* Camera label — opens rear camera directly on mobile */}
                      <label
                        htmlFor={cameraInputId}
                        className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 border-orange-200 dark:border-orange-500/25 bg-orange-50 dark:bg-orange-500/[0.06] text-orange-600 dark:text-orange-400 cursor-pointer active:scale-[0.97] transition-all select-none"
                      >
                        <Camera className="w-6 h-6" strokeWidth={1.8} />
                        <span className="text-[13px] font-bold">Kameradan</span>
                      </label>

                      {/* Gallery label — standard file picker */}
                      <label
                        htmlFor={galleryInputId}
                        className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-gray-600 dark:text-gray-400 cursor-pointer active:scale-[0.97] transition-all select-none"
                      >
                        <Images className="w-6 h-6" strokeWidth={1.8} />
                        <span className="text-[13px] font-bold">Galereadan</span>
                      </label>

                      {/*
                       * Camera input: capture="environment" instructs the browser to
                       * open the rear-facing camera directly — no file picker shown.
                       * Using `image/*` (not specific mime types) for widest iOS support.
                       */}
                      <input
                        id={cameraInputId}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        onChange={(e) => {
                          handleFileChange(e.target.files);
                          // Reset input so the same photo can be retaken
                          e.target.value = "";
                        }}
                      />

                      {/* Gallery input: no capture attribute — shows full file picker */}
                      <input
                        id={galleryInputId}
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        onChange={(e) => {
                          handleFileChange(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  )}

                  {/* Previews — 3 cols on mobile, 4 on sm+ */}
                  {previews.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {previews.map((url, idx) => (
                        <motion.div
                          key={url}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative aspect-square rounded-2xl overflow-hidden border border-gray-200 dark:border-white/[0.08]"
                        >
                          <img
                            src={url}
                            alt={`Rasm ${idx + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {/* Delete overlay */}
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-white active:scale-90 transition-transform"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <span className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                            {idx + 1}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {errors.photos && (
                    <p className="mt-2 text-[12px] text-red-500 font-medium">
                      {errors.photos.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Sticky submit footer — pb accounts for iPhone home indicator */}
              <div
                className="sticky bottom-0 px-5 pt-3 bg-white dark:bg-[#111] border-t border-gray-200 dark:border-white/[0.06]"
                style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
              >
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  disabled={isCompressing}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-[14px] rounded-2xl shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/35 disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
                >
                  {isCompressing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Rasmlar siqilmoqda...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Olib ketildi deb belgilash
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
