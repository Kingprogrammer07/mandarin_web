import { useCallback, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { X, Truck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { markTakenSchema } from "../../schemas/warehouseSchemas";
import type { MarkTakenFormValues } from "../../schemas/warehouseSchemas";
import { useWarehouseQueueStore } from "../../store/useWarehouseQueueStore";
import type { DeliveryMethodOption } from "../../api/services/warehouse";
import MultiPhotoUpload from "../MultiPhotoUpload";

// ── Props ─────────────────────────────────────────────────────────────────────

interface MarkTakenModalProps {
  transactionIds: number[];
  clientCode: string;
  flightName: string;
  deliveryMethods: DeliveryMethodOption[];
  isTakenAway?: boolean;
  preSelectedDeliveryMethod?: string;
  isRedelivery?: boolean;
  isOpen: boolean;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MarkTakenModal({
  transactionIds,
  clientCode,
  flightName,
  deliveryMethods,
  isTakenAway,
  preSelectedDeliveryMethod,
  isRedelivery,
  isOpen,
  onClose,
}: MarkTakenModalProps) {
  const enqueue = useWarehouseQueueStore((s) => s.enqueue);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<MarkTakenFormValues>({
    resolver: zodResolver(markTakenSchema),
    defaultValues: { delivery_method: "", photos: [], comment: "" },
  });

  const watchedPhotos = watch("photos");
  const photos = useMemo(() => watchedPhotos ?? [], [watchedPhotos]);

  // Auto-select the only delivery method so the user doesn't have to tap
  useEffect(() => {
    if (preSelectedDeliveryMethod && !watch("delivery_method")) {
      setValue("delivery_method", preSelectedDeliveryMethod, { shouldValidate: true });
    } else if (deliveryMethods.length === 1 && !watch("delivery_method")) {
      setValue("delivery_method", deliveryMethods[0].value, { shouldValidate: true });
    }
  }, [deliveryMethods, setValue, watch, preSelectedDeliveryMethod]);

  // Reset form when modal is closed externally
  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const onSubmit = useCallback(
    async (data: MarkTakenFormValues) => {
      const selectedDeliveryMethod = deliveryMethods.find(
        (method) => method.value === data.delivery_method,
      );

      reset();
      onClose();

      await enqueue({
        transactionIds,
        clientCode,
        flightName,
        deliveryMethod: data.delivery_method,
        deliveryMethodLabel: selectedDeliveryMethod?.label,
        comment: data.comment,
        photos: data.photos,
        force: isRedelivery,
      });

      toast.success(`${clientCode} - navbatga qo'shildi`, {
        description: `${transactionIds.length} ta yuk orqa fonda yuborilmoqda`,
        duration: 3000,
      });
    },
    [reset, onClose, enqueue, transactionIds, clientCode, flightName, deliveryMethods, isRedelivery],
  );

  const hasDeliveryMethods = deliveryMethods.length > 0;

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
                    {isRedelivery ? "Qayta yetkazib berish" : "Yukni berish"}
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

                {isTakenAway && (
                  <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-500 shrink-0" />
                    <div>
                      <h4 className="text-[12px] font-bold text-amber-800 dark:text-amber-500">
                        Bu yuk avval berilgan
                      </h4>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-500/80 mt-0.5 leading-relaxed">
                        Yuk bazada "Berilgan" deb belgilangan. Hozirgi yuklanayotgan isbot (rasmlar va izoh) to'g'ridan-to'g'ri hisobot guruhiga yuboriladi.
                      </p>
                    </div>
                  </div>
                )}

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
                        {deliveryMethods.map((method) => (
                          <button
                            key={method.value}
                            type="button"
                            onClick={() => field.onChange(method.value)}
                            className={`relative flex items-center justify-center px-4 py-3.5 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-[0.96] ${
                              field.value === method.value
                                ? method.value === "self_pickup"
                                  ? "bg-blue-50 dark:bg-blue-500/10 border-blue-400 dark:border-blue-500/50 text-blue-700 dark:text-blue-400"
                                  : "bg-orange-50 dark:bg-orange-500/10 border-orange-400 dark:border-orange-500/50 text-orange-700 dark:text-orange-400"
                                : "bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/[0.07] text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {method.label}
                            {field.value === method.value && (
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
                  {!hasDeliveryMethods && (
                    <p className="mt-2 text-[12px] text-red-500 font-medium">
                      Bu yuk uchun yetkazib berish usuli mavjud emas.
                    </p>
                  )}
                  {errors.delivery_method && (
                    <p className="mt-2 text-[12px] text-red-500 font-medium">
                      {errors.delivery_method.message}
                    </p>
                  )}
                </div>

                {/* ── Photos via MultiPhotoUpload ────────────────────────── */}
                <Controller
                  name="photos"
                  control={control}
                  render={({ field }) => (
                    <MultiPhotoUpload
                      label={`Isbotlovchi rasmlar (${photos.length}/10)`}
                      value={field.value ?? []}
                      onChange={field.onChange}
                      maxPhotos={10}
                      error={errors.photos?.message as string | undefined}
                    />
                  )}
                />

                {/* ── Comment ───────────────────────────────────────────── */}
                <div>
                  <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                    Izoh (ixtiyoriy)
                  </p>
                  <Controller
                    name="comment"
                    control={control}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        value={field.value ?? ""}
                        rows={3}
                        placeholder="Masalan: Telegram guruhi uchun isbot yuklandi..."
                        className="w-full p-3.5 rounded-2xl border-2 text-[16px] bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/[0.07] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:bg-white dark:focus:bg-[#1a1a1a] focus:border-orange-400 dark:focus:border-orange-500/50 outline-none resize-none transition-all"
                      />
                    )}
                  />
                  {errors.comment && (
                    <p className="mt-2 text-[12px] text-red-500 font-medium">
                      {errors.comment.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Sticky submit footer */}
              <div
                className="sticky bottom-0 px-5 pt-3 bg-white dark:bg-[#111] border-t border-gray-200 dark:border-white/[0.06]"
                style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
              >
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  disabled={!hasDeliveryMethods}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-[14px] rounded-2xl shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/35 disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Olib ketildi deb belgilash
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
