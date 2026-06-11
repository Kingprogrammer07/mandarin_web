/**
 * DeliveryReviewModal — one-time bot-service feedback prompt.
 *
 * Triggered after a delivery is approved, but it asks the user to rate the *bot
 * service overall* (not a single shipment): a 1–5 star rating, a multi-select
 * "what did you like" set, and an optional comment. "Keyinroq" defers; the
 * caller marks it seen so it never reappears for that user. In `mock` mode (dev
 * force-trigger) submit is faked locally — no network call.
 *
 * iOS/Android polish: bottom-sheet on phones with safe-area padding, 16px
 * inputs (prevents iOS focus-zoom), `touch-manipulation` to kill the 300ms tap
 * delay, and best-effort haptics.
 */

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Star, X, Loader2, Send, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { submitDeliveryReview } from '@/api/services/deliveryService';
import { triggerSoftHaptic, triggerSuccessHaptic } from '@/utils/haptics';

interface DeliveryReviewModalProps {
  open: boolean;
  deliveryRequestId: number;
  /** Dev/test mode: fake the submit (no API call). */
  mock?: boolean;
  /** Called when the user defers ("Keyinroq"). */
  onDismiss: () => void;
  /** Called after a review is successfully submitted (or mock-submitted). */
  onSubmitted: () => void;
}

/** Stable aspect keys → translated labels via `review.aspects.<key>`. */
const ASPECT_KEYS = [
  'fast',
  'price',
  'service',
  'easy',
  'botGreat',
  'support',
  'other',
] as const;

export default function DeliveryReviewModal({
  open,
  deliveryRequestId,
  mock = false,
  onDismiss,
  onSubmitted,
}: DeliveryReviewModalProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [aspects, setAspects] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Lock background scroll while the sheet is open (prevents the page behind the
  // overlay from scrolling on iOS/Android — a common "not premium" tell).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const toggleAspect = useCallback((key: string) => {
    triggerSoftHaptic();
    setAspects((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
    );
  }, []);

  const handleStar = useCallback((n: number) => {
    triggerSoftHaptic();
    setRating(n);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (rating < 1) {
      toast.error(t('review.ratePrompt'));
      return;
    }
    setSubmitting(true);

    // Join selected aspect labels (current UI language) for the backend, which
    // stores them as free text and forwards to the review group.
    const aspectLabel =
      aspects.length > 0
        ? aspects.map((k) => t(`review.aspects.${k}`)).join(', ')
        : null;

    try {
      if (mock) {
        // Local test: don't hit the API — just simulate the round-trip.
        await new Promise((r) => setTimeout(r, 600));
        triggerSuccessHaptic();
        toast.success(t('review.mockThanks'));
        onSubmitted();
        return;
      }
      await submitDeliveryReview({
        delivery_request_id: deliveryRequestId,
        rating,
        aspect: aspectLabel,
        comment: comment.trim() || null,
      });
      triggerSuccessHaptic();
      toast.success(t('review.thanks'));
      onSubmitted();
    } catch {
      toast.error(t('review.error'));
    } finally {
      setSubmitting(false);
    }
  }, [rating, aspects, comment, deliveryRequestId, mock, onSubmitted, t]);

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
          initial={reduceMotion ? { opacity: 0 } : { y: 40, opacity: 0, scale: 0.98 }}
          animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
          transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 300, damping: 28 }}
          className="w-full sm:max-w-md bg-white dark:bg-[#151515] rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)] touch-manipulation"
        >
          {/* Header */}
          <div className="relative px-5 pt-6 pb-4 text-center bg-gradient-to-b from-amber-50 to-white dark:from-amber-500/10 dark:to-transparent">
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors touch-manipulation"
              aria-label={t('review.close')}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center mb-3">
              <Star className="w-7 h-7 text-amber-500 fill-amber-500" />
            </div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white">
              {t('review.title')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('review.subtitle')}
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
                  onClick={() => handleStar(n)}
                  className="p-1 active:scale-90 transition-transform touch-manipulation"
                  aria-label={t('review.starLabel', { n })}
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

            {/* Aspects (multi-select) */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                {t('review.aspectsTitle')}
              </p>
              <div className="flex flex-wrap gap-2">
                {ASPECT_KEYS.map((key) => {
                  const selected = aspects.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleAspect(key)}
                      className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 touch-manipulation ${
                        selected
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-white/10'
                      }`}
                    >
                      {t(`review.aspects.${key}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                {t('review.commentLabel')}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder={t('review.commentPlaceholder')}
                className="w-full px-4 py-3 rounded-xl text-[16px] bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={onDismiss}
                disabled={submitting}
                className="flex-1 h-12 rounded-2xl font-bold text-sm bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 active:scale-[0.98] transition-all disabled:opacity-50 touch-manipulation"
              >
                {t('review.later')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || rating < 1}
                className={`flex-1 h-12 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] touch-manipulation ${
                  submitting || rating < 1
                    ? 'bg-gray-300 dark:bg-white/10 text-gray-500 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/25'
                }`}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {t('review.submit')}
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
