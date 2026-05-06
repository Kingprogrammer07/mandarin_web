import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ScanBarcode } from 'lucide-react';

export const QuickSearchBar = memo(({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslation();
  return (
    <div
      onClick={onClick}
      className="
        relative flex items-center gap-3 w-full
        px-4 py-3 rounded-2xl cursor-text
        bg-white dark:bg-white/8
        border border-gray-200/80 dark:border-white/10
        shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-500/40
        transition-all duration-200 group mb-5
      "
    >
      <Search className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0 group-hover:text-purple-500 transition-colors duration-200" />
      <span className="text-xs text-gray-400 dark:text-gray-500 font-sans select-none flex-1">
        {t('tracking.placeholder', 'Kargo kodini kiriting...')}
      </span>
      <div className="
        flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold
        bg-purple-50 dark:bg-purple-500/15
        text-purple-600 dark:text-purple-400
        border border-purple-100 dark:border-purple-500/20
        group-hover:bg-purple-100 dark:group-hover:bg-purple-500/25 transition-colors
      ">
        <ScanBarcode className="w-3.5 h-3.5" />
        {t('dashboard.tabs.track', 'Track')}
      </div>
    </div>
  );
});
QuickSearchBar.displayName = 'QuickSearchBar';
