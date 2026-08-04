
import { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  Loader2,
  CheckCheck,
} from 'lucide-react';
import { formatCurrencySum } from '@/lib/format';
import { translatePayment, formatCard } from './utils';
import type { PaymentProvider, CardWithBalance } from '@/api/pos';
import type { UnpaidCargoItem } from '@/api/verification';

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

export interface ConfirmPayload {
  cargos: UnpaidCargoItem[];
  amounts: number[];
  paymentType: PaymentProvider;
  useWallet: boolean;
  received: number;
  walletDeduction: number;
  selectedCard: CardWithBalance | null;
  clientCode: string;
  /**
   * Idempotency key for this confirmation, minted when the payload is built.
   *
   * It lives on the payload rather than being generated at submit time so that
   * every retry of the same confirmation reuses it — a double-click or a
   * resent POST must not become a second ledger row.
   */
  idempotencyKey: string;
}

export function ConfirmModal({
  payload,
  onConfirm,
  onCancel,
  isPending,
}: {
  payload: ConfirmPayload;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const netCash = payload.received - payload.walletDeduction;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter" && !isPending) {
      onConfirm();
    }
    if (e.key === "Escape") {
      onCancel();
    }
  }, [isPending, onConfirm, onCancel]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/[0.08] shadow-2xl overflow-hidden"
      >
        <div className="h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-[17px] font-black text-gray-900 dark:text-white">
              To'lovni tasdiqlash
            </h3>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 font-mono">
              {payload.clientCode}
            </p>
          </div>

          {/* Line items */}
          <div className="bg-gray-50 dark:bg-white/[0.04] rounded-2xl divide-y divide-gray-100 dark:divide-white/[0.05] overflow-hidden">
            {payload.cargos.map((c, i) => (
              <div
                key={c.cargo_id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">
                    #{c.row_number} · {c.flight_name}
                  </span>
                </div>
                <span className="text-[12px] font-bold text-gray-800 dark:text-white">
                  {formatCurrencySum(payload.amounts[i] ?? 0)}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[12px]">
              <span className="text-gray-500">To'lov usuli</span>
              <span className="font-semibold text-gray-800 dark:text-white">
                {translatePayment(payload.paymentType)}
              </span>
            </div>
            {payload.walletDeduction > 0 && (
              <div className="flex justify-between text-[12px]">
                <span className="text-green-600">Hamyon</span>
                <span className="font-semibold text-green-600">
                  −{formatCurrencySum(payload.walletDeduction)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-[14px] font-black border-t border-gray-100 dark:border-white/[0.06] pt-2">
              <span className="text-gray-700 dark:text-gray-200">
                Naqd/karta:
              </span>
              <span className="text-orange-600 dark:text-orange-400">
                {formatCurrencySum(netCash > 0 ? netCash : payload.received)}
              </span>
            </div>
          </div>

          {/* Selected card */}
          {payload.paymentType === "card" && payload.selectedCard && (
            <div className="bg-blue-50 dark:bg-blue-500/[0.08] border border-blue-200/60 dark:border-blue-500/20 rounded-2xl p-3">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">
                Bank kartasi
              </p>
              <p className="text-[15px] font-black text-blue-700 dark:text-blue-300 font-mono tracking-widest">
                {formatCard(payload.selectedCard.card_number)}
              </p>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                {payload.selectedCard.full_name}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-white/[0.08] text-[13px] font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
            >
              Bekor
            </button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onConfirm}
              disabled={isPending}
              className="flex-[2] py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-black text-[14px] rounded-2xl shadow-lg shadow-emerald-500/25 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4" />
              )}
              HA, TO'LASH
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

