import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CheckCircle2, CreditCard, Loader2, XCircle } from 'lucide-react';
import {
  nbuPaymentService,
  type PublicNbuPaymentStatus,
} from '@/api/services/nbuPaymentService';

interface PaymentNbuFailureProps {
  onNavigateHome?: () => void;
  onRetry?: () => void;
}

// Briefer polling than the success page: failure URL means NBU already
// decided this transaction is done. We only poll to catch the rare race
// where the callback flips it to SUCCESS after the redirect. Backoff:
// 2s, 4s, 8s, 10s, 10s (total ~34 s).
const POLL_BASE_MS = 2_000;
const POLL_MAX_MS = 10_000;
const MAX_POLL_ATTEMPTS = 5;

const pollDelay = (attempt: number): number =>
  Math.min(POLL_BASE_MS * 2 ** Math.max(0, attempt - 1), POLL_MAX_MS);

function formatMoney(value: number): string {
  return new Intl.NumberFormat('uz-UZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

type Phase = 'checking' | 'success' | 'card_bound' | 'failure';

function phaseFromStatus(s: PublicNbuPaymentStatus | null): Phase {
  if (!s) return 'failure';
  if (s.status === 'SUCCESS') {
    return s.purpose === 'CARD_BINDING' ? 'card_bound' : 'success';
  }
  return 'failure';
}

export default function PaymentNbuFailure({ onNavigateHome, onRetry }: PaymentNbuFailureProps) {
  const { t } = useTranslation();
  const orderId = new URLSearchParams(window.location.search).get('orderId') ?? '';

  const [statusInfo, setStatusInfo] = useState<PublicNbuPaymentStatus | null>(null);
  const [phase, setPhase] = useState<Phase>(orderId ? 'checking' : 'failure');
  const attemptsRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  const handleHome = useCallback(() => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.href = '/';
    }
  }, [onNavigateHome]);

  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.href = '/';
    }
  }, [onRetry]);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    const tick = async () => {
      attemptsRef.current += 1;
      try {
        const info = await nbuPaymentService.getPublicStatus(orderId);
        if (cancelled) return;
        setStatusInfo(info);
        const resolved = phaseFromStatus(info);
        if (resolved === 'success' || resolved === 'card_bound') {
          setPhase(resolved);
          return;
        }
        if (info.is_terminal || attemptsRef.current >= MAX_POLL_ATTEMPTS) {
          setPhase('failure');
          return;
        }
        timeoutRef.current = window.setTimeout(tick, pollDelay(attemptsRef.current));
      } catch {
        if (cancelled) return;
        if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
          setPhase('failure');
          return;
        }
        timeoutRef.current = window.setTimeout(tick, pollDelay(attemptsRef.current));
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [orderId]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#06080d] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-sm bg-white dark:bg-[#151515] rounded-3xl border border-gray-200 dark:border-white/10 shadow-xl p-8 text-center space-y-6"
      >
        {phase === 'checking' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center mx-auto"
            >
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            </motion.div>
            <div className="space-y-2">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">
                {t('nbu.pending.title')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('nbu.pending.body')}
              </p>
            </div>
          </>
        )}

        {phase === 'success' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mx-auto"
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </motion.div>
            <div className="space-y-2">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">
                {t('nbu.success.title')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('nbu.success.body')}
              </p>
            </div>
            {statusInfo && (
              <div className="bg-gray-50 dark:bg-white/[0.03] rounded-2xl p-4 space-y-2 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {t('nbu.success.amountLabel')}
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {formatMoney(statusInfo.amount_uzs)} so'm
                  </span>
                </div>
                {statusInfo.flight_name && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {t('nbu.success.flightLabel')}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white truncate ml-2">
                      {statusInfo.flight_name}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {phase === 'card_bound' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-sky-100 dark:bg-sky-500/15 flex items-center justify-center mx-auto"
            >
              <CreditCard className="w-10 h-10 text-sky-500" />
            </motion.div>
            <div className="space-y-2">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">
                {t('nbu.cardBound.title')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('nbu.cardBound.body')}
              </p>
            </div>
          </>
        )}

        {phase === 'failure' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-rose-100 dark:bg-rose-500/15 flex items-center justify-center mx-auto"
            >
              <XCircle className="w-10 h-10 text-rose-500" />
            </motion.div>
            <div className="space-y-2">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">
                {t('nbu.failure.title')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('nbu.failure.body')}
              </p>
            </div>
          </>
        )}

        {orderId && (
          <p className="text-xs font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/5 rounded-lg px-3 py-2 inline-block">
            ID: {orderId}
          </p>
        )}

        {phase === 'failure' && (
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full h-14 rounded-2xl font-black text-[16px]
                bg-gradient-to-r from-blue-500 to-indigo-500
                hover:from-blue-600 hover:to-indigo-600
                text-white shadow-xl shadow-blue-500/25
                active:scale-[0.97] transition-all"
            >
              {t('nbu.failure.retryButton')}
            </button>
            <button
              onClick={handleHome}
              className="w-full h-14 rounded-2xl font-bold text-base
                bg-white dark:bg-white/5
                border border-gray-200 dark:border-white/10
                text-gray-900 dark:text-white
                hover:bg-gray-50 dark:hover:bg-white/10
                active:scale-[0.97] transition-all"
            >
              {t('nbu.failure.homeButton')}
            </button>
          </div>
        )}

        {(phase === 'success' || phase === 'card_bound') && (
          <button
            onClick={handleHome}
            className="w-full h-14 rounded-2xl font-black text-[16px]
              bg-gradient-to-r from-amber-500 to-orange-500
              hover:from-amber-600 hover:to-orange-600
              text-white shadow-xl shadow-amber-500/25
              active:scale-[0.97] transition-all"
          >
            {phase === 'card_bound'
              ? t('nbu.cardBound.homeButton')
              : t('nbu.success.homeButton')}
          </button>
        )}
      </motion.div>
    </div>
  );
}
