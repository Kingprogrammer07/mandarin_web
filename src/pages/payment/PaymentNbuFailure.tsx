import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { XCircle } from 'lucide-react';

interface PaymentNbuFailureProps {
  onNavigateHome?: () => void;
  onRetry?: () => void;
}

export default function PaymentNbuFailure({ onNavigateHome, onRetry }: PaymentNbuFailureProps) {
  const { t } = useTranslation();

  const orderId = new URLSearchParams(window.location.search).get('orderId') ?? '';

  const handleHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.href = '/';
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.href = '/';
    }
  };

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

        {orderId && (
          <p className="text-xs font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/5 rounded-lg px-3 py-2 inline-block">
            ID: {orderId}
          </p>
        )}

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
      </motion.div>
    </div>
  );
}
