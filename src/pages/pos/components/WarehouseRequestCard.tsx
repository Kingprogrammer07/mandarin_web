import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Package } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PICKUP_METHOD_LABELS,
  PICKUP_PRIORITY_LABELS,
  createPosPickupQueueByClientCode,
} from "@/api/pickupQueue";
import type { PickupMethod, PickupQueuePriority } from "@/api/pickupQueue";

interface WarehouseRequestCardProps {
  canProcess: boolean;
  activeClientCode?: string | null;
}

export function WarehouseRequestCard({ canProcess, activeClientCode }: WarehouseRequestCardProps) {
  const [clientCode, setClientCode] = useState("");
  const [pickupMethod, setPickupMethod] = useState<PickupMethod>("self_pickup");
  const [priority, setPriority] = useState<PickupQueuePriority>("normal");
  const [note, setNote] = useState("");

  // Avtomatik to'ldirish: qidirilgan mijoz kodi bo'lsa inputga qo'yish
  useEffect(() => {
    if (activeClientCode) {
      setClientCode(activeClientCode);
    }
  }, [activeClientCode]);

  const mut = useMutation({
    mutationFn: createPosPickupQueueByClientCode,
    onSuccess: () => {
      toast.success("Skladga chiqarish so'rovi yuborildi!");
      setClientCode("");
      setNote("");
    },
    onError: (err: unknown) => {
      type ApiErr = { response?: { status?: number; data?: { detail?: string } } };
      const status = (err as ApiErr)?.response?.status;
      const detail = (err as ApiErr)?.response?.data?.detail;

      if (status === 400) {
        toast.error(typeof detail === "string" ? detail : "Mijozning skladga chiqariladigan yuklari yo'q");
      } else {
        toast.error(typeof detail === "string" ? detail : "So'rov yuborishda xatolik");
      }
    },
  });

  const handleSubmit = useCallback(() => {
    const code = clientCode.trim().toUpperCase();
    if (!code) {
      toast.error("Mijoz kodini kiriting");
      return;
    }
    mut.mutate({
      client_code: code,
      pickup_method: pickupMethod,
      priority: priority,
      note: note.trim() || null,
    });
  }, [clientCode, pickupMethod, priority, note, mut]);

  if (!canProcess) return null;

  return (
    <div className="bg-white dark:bg-[#161616] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-blue-500 shrink-0" />
        <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Skladga chiqarish so&apos;rovi
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {/* Client code */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
            Mijoz kodi
          </label>
          <input
            type="text"
            value={clientCode}
            onChange={(e) => setClientCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="T123"
            className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all text-gray-900 dark:text-white uppercase"
          />
        </div>

        {/* Pickup method */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
            Xizmat turi
          </label>
          <select
            value={pickupMethod}
            onChange={(e) => setPickupMethod(e.target.value as PickupMethod)}
            className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 text-gray-900 dark:text-white"
          >
            {Object.entries(PICKUP_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div className="flex-1 min-w-[100px]">
          <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
            Ustuvorlik
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as PickupQueuePriority)}
            className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 text-gray-900 dark:text-white"
          >
            {Object.entries(PICKUP_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Note */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
            Izoh (ixtiyoriy)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Izoh..."
            className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSubmit}
        disabled={mut.isPending || !clientCode.trim()}
        className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-black text-[14px] rounded-2xl shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {mut.isPending ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        SO&apos;ROV YUBORISH
      </motion.button>
    </div>
  );
}
