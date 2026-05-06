import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plane } from 'lucide-react';

export const PageLoadingFallback = memo(() => {
  const { t } = useTranslation();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center w-full animate-in fade-in duration-300">
      <div className="w-16 h-16 relative flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-gray-100 dark:border-white/5"></div>
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-blue-500 dark:border-t-amber-500 dark:border-r-amber-500 animate-spin"></div>
        <Plane className="w-6 h-6 text-blue-500 dark:text-amber-500 animate-pulse absolute" />
      </div>
      <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">
        {t('dashboard.loading')}
      </p>
    </div>
  );
});
PageLoadingFallback.displayName = 'PageLoadingFallback';
