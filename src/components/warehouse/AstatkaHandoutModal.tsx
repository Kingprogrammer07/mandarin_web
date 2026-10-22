import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, PackageCheck, CheckCircle2, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { handOutAstatkaBag, type AstatkaShelfBag } from "../../api/services/warehouse";
import { warehouseKeys } from "../../api/hooks/useWarehouse";
import MultiPhotoUpload from "../MultiPhotoUpload";

const MAX_PHOTOS = 10;
const MAX_COMMENT = 500;

interface AstatkaHandoutModalProps {
  bag: AstatkaShelfBag;
  clientCode: string;
  flightName: string;
  onClose: () => void;
}

/**
 * «Ostatkadan berish»: the bag's payment row already says taken, so the
 * regular «Berish» is closed. This records only on the astatka bag that the
 * client got it from the shelf, with photos; no money or proof changes.
 */
export default function AstatkaHandoutModal({
  bag,
  clientCode,
  flightName,
  onClose,
}: AstatkaHandoutModalProps) {
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState<File[]>([]);
  const [comment, setComment] = useState("");
  const [photoError, setPhotoError] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: () => handOutAstatkaBag(bag.package_id, photos, comment),
    onSuccess: (res) => {
      toast.success(res.message, { description: `${clientCode} · ${flightName}` });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.groupedTransactionSearch({}) });
      onClose();
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message ?? "Ostatkadan berishda xatolik");
    },
  });

  const busy = mutation.isPending;
  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (photos.length === 0) {
      setPhotoError("Kamida bitta rasm yuklang");
      return;
    }
    setPhotoError(undefined);
    mutation.mutate();
  };

  // Portalled: the warehouse cards blur their backdrop, which would make a
  // fixed overlay inside them fixed to the card instead of the screen.
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
        onClick={close}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="astatka-handout-title"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-lg bg-white dark:bg-[#111] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col"
          style={{ maxHeight: "92dvh" }}
        >
          <div className="sm:hidden shrink-0 pt-3 pb-1 flex justify-center">
            <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-white/10" />
          </div>

          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                <PackageCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <h2 id="astatka-handout-title" className="text-[15px] font-bold text-gray-900 dark:text-white">
                  Ostatkadan berish
                </h2>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5 break-words">
                  <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{clientCode}</span>
                  <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
                  {flightName}
                  <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
                  {bag.astatka_flight_name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Yopish"
              className="w-9 h-9 flex items-center justify-center rounded-2xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={submit} className="flex-1 overflow-y-auto overscroll-contain">
            <div className="px-5 pt-5 pb-4 space-y-6">
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                <Info className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-500 shrink-0" />
                <p className="text-[12px] leading-relaxed text-amber-800 dark:text-amber-400/90">
                  To'lov yozuvi avval «berilgan» deb belgilangan, lekin bu yuk javonda qolgan.
                  Bu yerda faqat mijoz shu yukni javondan olgani yoziladi: to'lov, summa va
                  avvalgi isbot o'zgarmaydi. Rasmlar ombor guruhiga yuboriladi.
                </p>
              </div>

              <MultiPhotoUpload
                label="Berilganini ko'rsatuvchi rasmlar"
                value={photos}
                onChange={(files) => {
                  setPhotos(files);
                  if (files.length > 0) setPhotoError(undefined);
                }}
                maxPhotos={MAX_PHOTOS}
                error={photoError}
              />

              <div>
                <label
                  htmlFor="astatka-handout-comment"
                  className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3"
                >
                  Izoh (ixtiyoriy)
                </label>
                <textarea
                  id="astatka-handout-comment"
                  value={comment}
                  maxLength={MAX_COMMENT}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Masalan: paketdan tushib qolgan 1 ta tovar"
                  className="w-full p-3.5 rounded-2xl border-2 text-[16px] bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/[0.07] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:bg-white dark:focus:bg-[#1a1a1a] focus:border-amber-400 dark:focus:border-amber-500/50 outline-none resize-none transition-all"
                />
              </div>
            </div>

            <div
              className="sticky bottom-0 px-5 pt-3 bg-white dark:bg-[#111] border-t border-gray-200 dark:border-white/[0.06]"
              style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={busy}
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[14px] rounded-2xl shadow-lg shadow-amber-500/20 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
              >
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {busy ? "Yuborilmoqda…" : "Javondan berildi deb belgilash"}
              </motion.button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
