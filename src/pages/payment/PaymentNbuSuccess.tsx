import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, CreditCard, Loader2, RefreshCw, XCircle } from 'lucide-react';
import {
  nbuPaymentService,
  type PublicNbuPaymentStatus,
} from '@/api/services/nbuPaymentService';
import { getNbuReturnPath } from '@/utils/nbuReturnContext';
import { playApplePaySound } from '@/utils/audioUtils';

interface PaymentNbuSuccessProps {
  onNavigateHome?: () => void;
}

// Exponential backoff: 2s, 4s, 8s, then 10s thereafter, capped at the same
// ~40 s total polling window (12 attempts ≈ 2+4+8+10*9 = 104 s, so we keep
// MAX at 10 to stay close to the previous user-visible behaviour while
// cutting per-payment request count in half).
const POLL_BASE_MS = 2_000;
const POLL_MAX_MS = 10_000;
const MAX_POLL_ATTEMPTS = 10;

const pollDelay = (attempt: number): number =>
  Math.min(POLL_BASE_MS * 2 ** Math.max(0, attempt - 1), POLL_MAX_MS);

function formatMoney(value: number): string {
  return new Intl.NumberFormat('uz-UZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

type Phase = 'pending' | 'timeout' | 'success' | 'card_bound' | 'failure' | 'no_data';

function phaseFromStatus(s: PublicNbuPaymentStatus | null): Phase {
  if (!s) return 'pending';
  if (!s.is_terminal) return 'pending';
  if (s.status === 'SUCCESS') {
    return s.purpose === 'CARD_BINDING' ? 'card_bound' : 'success';
  }
  return 'failure';
}

export default function PaymentNbuSuccess({ onNavigateHome }: PaymentNbuSuccessProps) {
  const { t } = useTranslation();
  const orderId = new URLSearchParams(window.location.search).get('orderId') ?? '';
  const returnPath = orderId ? getNbuReturnPath(orderId) : null;

  const [statusInfo, setStatusInfo] = useState<PublicNbuPaymentStatus | null>(null);
  const [phase, setPhase] = useState<Phase>(orderId ? 'pending' : 'no_data');
  const [pollKey, setPollKey] = useState(0);
  const attemptsRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const soundPlayedRef = useRef(false);

  // Celebratory chime the moment a payment confirms — once per mount.
  useEffect(() => {
    if (phase === 'success' && !soundPlayedRef.current) {
      soundPlayedRef.current = true;
      playApplePaySound();
    }
  }, [phase]);

  const handleHome = useCallback(() => {
    if (returnPath) {
      window.location.href = returnPath;
      return;
    }
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.href = '/';
    }
  }, [onNavigateHome, returnPath]);

  const handleManualRefresh = useCallback(() => {
    attemptsRef.current = 0;
    setPhase('pending');
    setPollKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    const tick = async () => {
      attemptsRef.current += 1;
      try {
        const info = await nbuPaymentService.getPublicStatus(orderId);
        if (cancelled) return;
        setStatusInfo(info);
        const next = phaseFromStatus(info);
        if (next === 'pending') {
          if (attemptsRef.current < MAX_POLL_ATTEMPTS) {
            timeoutRef.current = window.setTimeout(tick, pollDelay(attemptsRef.current));
          } else {
            setPhase('timeout');
          }
          return;
        }
        setPhase(next);
      } catch {
        if (cancelled) return;
        if (attemptsRef.current < MAX_POLL_ATTEMPTS) {
          timeoutRef.current = window.setTimeout(tick, pollDelay(attemptsRef.current));
        } else {
          setPhase('timeout');
        }
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [orderId, pollKey]);

  const hasStoredSession = useCallback(
    () =>
      Boolean(
        localStorage.getItem('access_token') ||
        sessionStorage.getItem('access_token'),
      ),
    [],
  );

  // Auto-navigate home only when the redirect tab still has an app session.
  // External bank/browser returns often lose sessionStorage, and forcing
  // user-home from there resolves to /auth/login.
  useEffect(() => {
    if (phase !== 'success' && phase !== 'card_bound') return;
    if (!hasStoredSession()) return;
    const timer = window.setTimeout(handleHome, 10_000);
    return () => window.clearTimeout(timer);
  }, [phase, handleHome, hasStoredSession]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#06080d] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-sm bg-white dark:bg-[#151515] rounded-3xl border border-gray-200 dark:border-white/10 shadow-xl p-8 text-center space-y-6"
      >
        {phase === 'pending' && (
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

        {phase === 'timeout' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center mx-auto"
            >
              <Clock className="w-10 h-10 text-amber-500" />
            </motion.div>
            <div className="space-y-2">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">
                {t('nbu.timeout.title')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('nbu.timeout.body')}
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

        {phase === 'timeout' && (
          <div className="space-y-3">
            <button
              onClick={handleManualRefresh}
              className="w-full h-14 rounded-2xl font-black text-[16px]
                bg-gradient-to-r from-sky-500 to-cyan-500
                hover:from-sky-600 hover:to-cyan-600
                text-white shadow-xl shadow-sky-500/25
                active:scale-[0.97] transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              {t('nbu.timeout.retryButton')}
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
              {t('nbu.timeout.homeButton')}
            </button>
          </div>
        )}

        {phase !== 'pending' && phase !== 'timeout' && (
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
