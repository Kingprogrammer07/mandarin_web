import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScanBarcode, Search } from 'lucide-react';

export const QuickSearchBar = memo(({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslation();
  return (
    <div
      onClick={onClick}
      className="
        group relative mb-4 flex min-h-[48px] w-full cursor-text items-center gap-2.5 overflow-hidden
        rounded-[1.125rem] border border-gray-200/80 bg-white px-3 py-2
        shadow-[0_1px_2px_rgba(15,23,42,0.06)]
        transition-[transform,border-color,background-color,box-shadow] duration-200
        active:scale-[0.99] hover:border-orange-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]
        dark:border-white/[0.085] dark:bg-[#0a0e15]/95
        dark:shadow-[0_10px_28px_rgba(0,0,0,0.22)] dark:hover:border-orange-400/20 dark:hover:bg-[#0d131d]
      "
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-transparent opacity-70 dark:from-white/[0.06]" />
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/10" />
      <span className="relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[13px] bg-orange-50 text-orange-600 ring-1 ring-orange-100/80 dark:bg-orange-400/[0.10] dark:text-amber-300 dark:ring-orange-300/15">
        <Search className="h-4 w-4 transition-colors duration-200" />
      </span>
      <span className="relative z-10 flex-1 select-none truncate font-sans text-[13px] font-semibold text-gray-400 dark:text-white/42">
        {t('tracking.placeholder', 'Kargo kodini kiriting...')}
      </span>
      <div className="
        relative z-10 flex h-7 items-center gap-1.5 rounded-[0.7rem] border border-orange-200/70
        bg-orange-50 px-2.5 text-[10px] font-black uppercase tracking-wide
        text-orange-700 transition-colors
        dark:border-orange-300/15 dark:bg-orange-400/[0.10] dark:text-amber-300
      ">
        <ScanBarcode className="h-3.5 w-3.5" />
        {t('dashboard.tabs.track', 'Track')}
      </div>
    </div>
  );
});
QuickSearchBar.displayName = 'QuickSearchBar';
