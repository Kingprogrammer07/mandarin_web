/**
 * DeliveryReviewModal — post-delivery feedback prompt.
 *
 * Shown after a delivery request (any type) is approved: a 1–5 star rating,
 * an optional "what did you like" aspect (single-select), and an optional
 * comment. "Keyinroq" defers (caller snoozes for the session); submitting
 * posts the review to the backend, which forwards it to the review group.
 */

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, Loader2, Send, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { submitDeliveryReview } from '@/api/services/deliveryService';

interface DeliveryReviewModalProps {
  open: boolean;
  deliveryRequestId: number;
  /** Called when the user defers ("Keyinroq") — caller snoozes for the session. */
  onDismiss: () => void;
  /** Called after a review is successfully submitted. */
  onSubmitted: () => void;
}

const ASPECTS = [
  'Tezkor yetkazib berish',
  'Qulay narx',
  'Yaxshi xizmat',
  'Oson jarayon',
  'Boshqa',
];

export default function DeliveryReviewModal({
  open,
  deliveryRequestId,
  onDismiss,
  onSubmitted,
}: DeliveryReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [aspect, setAspect] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (rating < 1) {
      toast.error('Iltimos, baho bering (1-5 yulduz)');
      return;
    }
    setSubmitting(true);
    try {
      await submitDeliveryReview({
        delivery_request_id: deliveryRequestId,
        rating,
        aspect: aspect || null,
        comment: comment.trim() || null,
      });
      toast.success('Rahmat! Sharhingiz qabul qilindi.');
      onSubmitted();
    } catch {
      toast.error('Sharh yuborishda xatolik. Qayta urinib ko\'ring.');
    } finally {
      setSubmitting(false);
    }
  }, [rating, aspect, comment, deliveryRequestId, onSubmitted]);

  if (!open) return null;

  const activeStars = hover || rating;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10060] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      >
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="w-full sm:max-w-md bg-white dark:bg-[#151515] rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="relative px-5 pt-6 pb-4 text-center bg-gradient-to-b from-amber-50 to-white dark:from-amber-500/10 dark:to-transparent">
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              aria-label="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center mb-3">
              <Star className="w-7 h-7 text-amber-500 fill-amber-500" />
            </div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white">
              Yetkazib berishni baholang
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Fikringiz biz uchun muhim
            </p>
          </div>

          <div className="px-5 pb-5 space-y-5">
            {/* Stars */}
            <div className="flex items-center justify-center gap-2 pt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  className="p-1 active:scale-90 transition-transform"
                  aria-label={`${n} yulduz`}
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      n <= activeStars
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-gray-300 dark:text-white/20'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Aspect radios */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                Nima yoqdi? (ixtiyoriy)
              </p>
              <div className="flex flex-wrap gap-2">
                {ASPECTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAspect((cur) => (cur === a ? null : a))}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                      aspect === a
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-white/10'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Sharh (ixtiyoriy)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Tajribangiz haqida yozing..."
                className="w-full px-4 py-3 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={onDismiss}
                disabled={submitting}
                className="flex-1 h-12 rounded-2xl font-bold text-sm bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                Keyinroq
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || rating < 1}
                className={`flex-1 h-12 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  submitting || rating < 1
                    ? 'bg-gray-300 dark:bg-white/10 text-gray-500 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/25'
                }`}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Yuborish
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
