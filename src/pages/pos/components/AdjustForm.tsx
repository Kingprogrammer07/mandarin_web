import { memo, useCallback, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpCircle, ArrowDownCircle, Loader2, SlidersHorizontal } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adjustBalance } from "@/api/pos";
import type { AdjustBalanceRequest } from "@/api/pos";
import { formatCurrencySum } from "@/lib/format";
import { normalizeNumber } from "@/utils/numberFormat";

interface AdjustFormProps {
  clientCode: string;
  onBalanceUpdate: (newBalance: number) => void;
  onRefreshClient?: () => void;
}

export const AdjustForm = memo(function AdjustForm({
  clientCode,
  onBalanceUpdate,
  onRefreshClient,
}: AdjustFormProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isCredit, setIsCredit] = useState(true);

  const adjustMut = useMutation({
    mutationFn: (req: AdjustBalanceRequest) => adjustBalance(req),
    onSuccess: (res) => {
      toast.success(`Hamyon yangilandi. Yangi balans: ${formatCurrencySum(res.new_wallet_balance)}`);
      onBalanceUpdate(res.new_wallet_balance);
      queryClient.invalidateQueries({ queryKey: ["pos-unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["cashier-log"] });
      queryClient.invalidateQueries({ queryKey: ["pos-txn", clientCode] });
      queryClient.invalidateQueries({ queryKey: ["pos-profile", clientCode] });
      queryClient.invalidateQueries({ queryKey: ["client-info"] });
      onRefreshClient?.();
      setAmount("");
      setReason("");
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message ?? "Hamyon yangilashda xatolik");
    },
  });

  const handleAdjust = useCallback(() => {
    const parsed = Number(parseFloat(amount.replace(/\s/g, "").replace(",", ".")).toFixed(2));
    if (!parsed || parsed <= 0) {
      toast.error("Summani kiriting");
      return;
    }
    if (!reason.trim()) {
      toast.error("Sababni kiriting");
      return;
    }
    adjustMut.mutate({
      client_code: clientCode,
      amount: isCredit ? parsed : -parsed,
      reason: reason.trim(),
    });
  }, [amount, reason, isCredit, clientCode, adjustMut]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Hamyon sozlash
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setIsCredit(true)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold transition-all border ${
            isCredit
              ? "bg-green-50 dark:bg-green-500/10 border-green-300 dark:border-green-500/30 text-green-700 dark:text-green-400"
              : "bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.06] text-gray-500"
          }`}
        >
          <ArrowUpCircle className="w-3.5 h-3.5" />
          Kirim
        </button>
        <button
          onClick={() => setIsCredit(false)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold transition-all border ${
            !isCredit
              ? "bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-400"
              : "bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.06] text-gray-500"
          }`}
        >
          <ArrowDownCircle className="w-3.5 h-3.5" />
          Chiqim
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            const normalized = normalizeNumber(e.target.value);
            if (normalized !== null) setAmount(normalized);
          }}
          placeholder="Summa"
          className="flex-1 min-w-0 px-3.5 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-bold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all text-gray-900 dark:text-white"
        />
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 64))}
          placeholder="Sabab (1-64 belgi)"
          className="flex-[2] min-w-0 px-3.5 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all text-gray-900 dark:text-white"
        />
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleAdjust}
        disabled={adjustMut.isPending}
        className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-[13px] rounded-2xl shadow-lg shadow-orange-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {adjustMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Hamyonni yangilash
      </motion.button>
    </div>
  );
});
