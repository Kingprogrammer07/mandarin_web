"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, CheckCheck, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  posNotificationService,
  type PosNotificationItem,
} from "@/api/services/posNotificationService";

interface Props {
  notif: PosNotificationItem;
  onRefresh: () => void;
  onDismiss: () => void;
}

export function NotifConfirmMiniButton({ notif, onRefresh, onDismiss }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(
    String(notif.remaining_amount > 0 ? notif.remaining_amount : notif.total_amount)
  );
  const [payType, setPayType] = useState(
    ["cash", "click", "payme", "card"].includes(notif.payment_type ?? "")
      ? (notif.payment_type ?? "click")
      : "click"
  );
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Summani to'g'ri kiriting");
      return;
    }
    setLoading(true);
    try {
      await posNotificationService.confirmFlightNotification({
        client_code: notif.client_code,
        flight_name: notif.flight_name,
        amount: parsed,
        payment_type: payType,
      });
      toast.success("To'lov tasdiqlandi");
      onRefresh();
      onDismiss();
    } catch {
      toast.error("Tasdiqlashda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600 active:scale-95 transition-all shadow-lg shadow-green-500/30"
      >
        <CheckCircle2 className="w-[18px] h-[18px]" />
      </button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
        onClick={() => !loading && setOpen(false)}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-bold text-gray-800 dark:text-white">To'lovni tasdiqlash</p>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="text-[12px] text-gray-500 dark:text-gray-400 space-y-0.5">
            <p>
              <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{notif.client_code}</span>
              {" · "}{notif.flight_name}
            </p>
            <p className="text-amber-600 dark:text-amber-400">⚠️ Chekni tekshirib tasdiqlang</p>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
              To'langan summa (so'm)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-bold outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500/50 text-gray-900 dark:text-white"
            />
          </div>

          {/* Payment type */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
              To'lov turi
            </label>
            <select
              value={payType}
              onChange={(e) => setPayType(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-semibold outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500/50 text-gray-900 dark:text-white"
            >
              <option value="cash">Naqd</option>
              <option value="click">Click</option>
              <option value="payme">Payme</option>
              <option value="card">Karta</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-black bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600 disabled:opacity-50 transition-all shadow-lg shadow-green-500/25"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
              Tasdiqlash
            </button>
            <button
              onClick={() => setOpen(false)}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-[13px] font-bold bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 transition-colors"
            >
              Bekor
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
