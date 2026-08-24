import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Wrench } from 'lucide-react';

export default function MaintenanceOverlay() {
  const { t } = useTranslation();

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-sm bg-mc-surface rounded-mc-xl border border-mc-border shadow-2xl p-6 text-center space-y-5"
      >
        <div className="w-20 h-20 rounded-full bg-mc-warn-soft flex items-center justify-center mx-auto">
          <Wrench className="w-10 h-10 text-mc-brand" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-mc-text">
            {t('maintenance.title')}
          </h1>
          <p className="text-sm text-mc-text-2 leading-relaxed">
            {t('maintenance.body')}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-mc-text-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mc-warn opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-mc-brand" />
          </span>
          {t('maintenance.autoRecheck')}
        </div>
      </motion.div>
    </div>
  );
}
