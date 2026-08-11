import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";

/**
 * The server's 409 body when a rename would touch a client who already has
 * cargo. `error_code` is what distinguishes it from the duplicate-code 409:
 * this one can be answered, that one cannot.
 */
export type CodeChangeWarning = {
  transaction_count: number;
  old_code: string;
  new_code: string;
  message: string;
};

interface CodeChangeWarningModalProps {
  warning: CodeChangeWarning | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation shown before overwriting a client code that transactions
 * already point at.
 *
 * Deliberately not a `window.confirm`: the operator has to read what is at
 * stake and who carries it, and the native dialog is suppressed outright in
 * some Telegram WebView builds — a silently skipped warning would let the
 * rename through unannounced.
 */
export function CodeChangeWarningModal({
  warning,
  isPending,
  onConfirm,
  onCancel,
}: CodeChangeWarningModalProps) {
  return (
    <AnimatePresence>
      {warning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={isPending ? undefined : onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/[0.08] shadow-2xl overflow-hidden"
          >
            <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-400" />
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-[17px] font-black text-gray-900 dark:text-white">
                    Mijoz kodi almashtirilsinmi?
                  </h3>
                  <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                    {warning.transaction_count} ta yuk/tranzaksiya mavjud
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06]">
                <span className="font-mono text-[14px] font-bold text-gray-500 dark:text-gray-400 line-through">
                  {warning.old_code}
                </span>
                <ArrowRight className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="font-mono text-[14px] font-black text-gray-900 dark:text-white">
                  {warning.new_code}
                </span>
              </div>

              <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
                {warning.message}
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onCancel}
                  disabled={isPending}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-white/[0.08] text-[13px] font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-60"
                >
                  Bekor
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onConfirm}
                  disabled={isPending}
                  className="flex-[2] py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-[13px] rounded-2xl shadow-lg shadow-amber-500/25 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  HA, ALMASHTIRILSIN
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
