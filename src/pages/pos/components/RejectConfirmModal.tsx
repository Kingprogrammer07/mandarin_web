import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X, AlertTriangle } from "lucide-react";

interface RejectConfirmModalProps {
  isOpen: boolean;
  onConfirm: (comment: string | null) => void;
  onCancel: () => void;
  isPending: boolean;
  clientCode: string;
  flightName: string;
  showComment?: boolean;
}

export function RejectConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  isPending,
  clientCode,
  flightName,
  showComment = false,
}: RejectConfirmModalProps) {
  const [comment, setComment] = useState("");

  const handleConfirm = useCallback(() => {
    onConfirm(comment.trim() || null);
  }, [comment, onConfirm]);

  /**
   * Clear the draft during the render that opens the modal.
   *
   * As an effect this ran a frame late, so the box opened showing the comment
   * typed for the *previous* rejection before blanking — on a fast confirm the
   * cashier could send the old text. This is React's documented
   * adjust-state-on-prop-change pattern, not a setState-in-effect cascade.
   */
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setComment("");
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Enter" && !isPending && !showComment) {
        onConfirm(null);
      }
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, isPending, showComment, onConfirm, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
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
            <div className="h-1 bg-gradient-to-r from-red-400 via-red-500 to-rose-400" />
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-[17px] font-black text-gray-900 dark:text-white">
                    To&apos;lovni bekor qilish
                  </h3>
                  <p className="text-[12px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                    {clientCode} · {flightName}
                  </p>
                </div>
              </div>

              {showComment && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                    Sabab (ixtiyoriy)
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Rad etish sababi..."
                    rows={3}
                    autoFocus
                    className="w-full px-3 py-2 bg-red-50/50 dark:bg-red-500/[0.04] border border-red-200 dark:border-red-500/25 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none placeholder:text-red-300 dark:placeholder:text-red-500/40 text-gray-900 dark:text-white"
                  />
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
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="flex-[2] py-3 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-black text-[14px] rounded-2xl shadow-lg shadow-red-500/25 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  HA, BEKOR QILISH
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
