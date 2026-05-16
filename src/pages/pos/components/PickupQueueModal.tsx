import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCheck, Loader2, AlertCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { createPosPickupQueue, PICKUP_METHOD_LABELS, PICKUP_PRIORITY_LABELS } from "@/api/pickupQueue";
import type { PickupMethod, PickupQueuePriority } from "@/api/pickupQueue";

interface DuplicateConflict {
  queue_id: number;
  display_number: number;
  client_code: string;
  status: string;
  transaction_ids: number[];
}

interface PickupQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTxIds: Set<number>;
  onSuccess: () => void;
}

export const PickupQueueModal = memo(function PickupQueueModal({
  isOpen,
  onClose,
  selectedTxIds,
  onSuccess,
}: PickupQueueModalProps) {
  const [method, setMethod] = useState<PickupMethod>("self_pickup");
  const [priority, setPriority] = useState<PickupQueuePriority>("normal");
  const [note, setNote] = useState("");
  const [duplicateConflict, setDuplicateConflict] = useState<DuplicateConflict | null>(null);

  const createMut = useMutation({
    mutationFn: (data: {
      transaction_ids: number[];
      pickup_method: PickupMethod;
      priority?: PickupQueuePriority;
      note: string | null;
      idempotency_key?: string | null;
    }) => createPosPickupQueue(data),
    onSuccess: (res) => {
      const queue = res as { display_number?: number };
      toast.success(
        queue.display_number
          ? `Warehousega yuborildi. Navbat raqami: #${queue.display_number}`
          : "Warehousega yuborildi",
      );
      setDuplicateConflict(null);
      setMethod("self_pickup");
      setPriority("normal");
      setNote("");
      onSuccess();
      onClose();
    },
    onError: (err: unknown) => {
      const e = err as {
        message?: string;
        status?: number;
        data?: DuplicateConflict & { detail?: string };
      };
      if (e.status === 409 && e.data) {
        setDuplicateConflict({
          queue_id: e.data.queue_id,
          display_number: e.data.display_number,
          client_code: e.data.client_code,
          status: e.data.status,
          transaction_ids: e.data.transaction_ids ?? [],
        });
      } else {
        toast.error(e.message ?? "Navbat yaratishda xatolik");
      }
    },
  });

  const handleSubmit = () => {
    if (selectedTxIds.size === 0) return;
    setDuplicateConflict(null);
    createMut.mutate({
      transaction_ids: Array.from(selectedTxIds),
      pickup_method: method,
      priority: priority,
      note: note.trim() || null,
      idempotency_key: crypto.randomUUID(),
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/[0.08] shadow-2xl overflow-hidden"
          >
            <div className="h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-black text-gray-900 dark:text-white">
                    Warehousega yuborish
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    {selectedTxIds.size} ta tranzaksiya
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                    Olib ketish usuli
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PickupMethod)}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-700 dark:text-gray-200"
                  >
                    {(Object.keys(PICKUP_METHOD_LABELS) as PickupMethod[]).map((m) => (
                      <option key={m} value={m}>
                        {PICKUP_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                    Navbat ustuvorligi
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PickupQueuePriority)}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-700 dark:text-gray-200"
                  >
                    {(Object.keys(PICKUP_PRIORITY_LABELS) as PickupQueuePriority[]).map((p) => (
                      <option key={p} value={p}>
                        {PICKUP_PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                    Izoh (ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 200))}
                    placeholder="Izoh..."
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-900 dark:text-white placeholder:text-gray-400"
                  />
                </div>
              </div>

              {duplicateConflict && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-red-700 dark:text-red-400">
                        Bu yuklar allaqachon navbatda
                      </p>
                      <p className="text-[12px] text-red-600 dark:text-red-300 mt-0.5">
                        Mijoz: <span className="font-bold">{duplicateConflict.client_code}</span>
                      </p>
                      <p className="text-[12px] text-red-600 dark:text-red-300">
                        Navbat raqami: <span className="font-black text-[14px]">#{duplicateConflict.display_number}</span>
                      </p>
                      <p className="text-[12px] text-red-600 dark:text-red-300">
                        Status: <span className="font-bold">{duplicateConflict.status === "preparing" ? "Tayyorlanmoqda" : duplicateConflict.status === "ready" ? "Tayyor" : duplicateConflict.status}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDuplicateConflict(null)}
                    className="w-full py-2 rounded-lg bg-white dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-[12px] font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                  >
                    Tushundim, qayta urinish
                  </button>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setDuplicateConflict(null); onClose(); }}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-white/[0.08] text-[13px] font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  Bekor
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  disabled={createMut.isPending}
                  className="flex-[2] py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-[14px] rounded-2xl shadow-lg shadow-orange-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {createMut.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCheck className="w-4 h-4" />
                  )}
                  Yuborish
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
