export interface UzpostBranchPickerTheme {
  shellClassName: string;
  mapClassName: string;
  searchClassName: string;
  selectedPanelClassName: string;
  resultButtonClassName: string;
  selectedResultButtonClassName: string;
  primaryTextClassName: string;
  mutedTextClassName: string;
  markerColor: string;
  selectedMarkerColor: string;
}

export const UZPOST_BRANCH_PICKER_THEME: UzpostBranchPickerTheme = {
  shellClassName:
    'rounded-3xl border border-orange-200 bg-orange-50/80 p-3 shadow-sm shadow-orange-500/5 dark:border-orange-500/20 dark:bg-orange-500/5',
  mapClassName: 'h-[220px] w-full overflow-hidden rounded-2xl border border-white/70 dark:border-white/10',
  searchClassName:
    'h-12 w-full rounded-2xl border border-orange-200 bg-white pl-11 pr-4 text-sm font-semibold text-gray-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-orange-500/20 dark:bg-white/10 dark:text-white',
  selectedPanelClassName:
    'rounded-2xl border border-orange-200 bg-white p-4 shadow-sm dark:border-orange-500/20 dark:bg-white/5',
  resultButtonClassName:
    'w-full rounded-2xl border border-transparent bg-white/80 p-3 text-left transition active:scale-[0.99] dark:bg-white/5',
  selectedResultButtonClassName:
    'border-orange-400 bg-orange-100 shadow-sm shadow-orange-500/10 dark:border-orange-500/50 dark:bg-orange-500/15',
  primaryTextClassName: 'text-gray-950 dark:text-white',
  mutedTextClassName: 'text-gray-500 dark:text-gray-400',
  markerColor: '#f97316',
  selectedMarkerColor: '#16a34a',
};
