import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

interface PaymentNbuSuccessProps {
  onNavigateHome?: () => void;
}

export default function PaymentNbuSuccess({ onNavigateHome }: PaymentNbuSuccessProps) {
  const { t } = useTranslation();

  const orderId = new URLSearchParams(window.location.search).get('orderId') ?? '';

  const handleHome = useCallback(() => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.href = '/';
    }
  }, [onNavigateHome]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      handleHome();
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [handleHome]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#06080d] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-sm bg-white dark:bg-[#151515] rounded-3xl border border-gray-200 dark:border-white/10 shadow-xl p-8 text-center space-y-6"
      >
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

        {orderId && (
          <p className="text-xs font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/5 rounded-lg px-3 py-2 inline-block">
            ID: {orderId}
          </p>
        )}

        <button
          onClick={handleHome}
          className="w-full h-14 rounded-2xl font-black text-[16px]
            bg-gradient-to-r from-amber-500 to-orange-500
            hover:from-amber-600 hover:to-orange-600
            text-white shadow-xl shadow-amber-500/25
            active:scale-[0.97] transition-all"
        >
          {t('nbu.success.homeButton')}
        </button>
      </motion.div>
    </div>
  );
}
