import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Star } from 'lucide-react';

interface ReviewPromptCardProps {
  onOpen: () => void;
}

/**
 * Home-screen entry point for the delivery review.
 *
 * Replaces the modal that auto-opened on every dashboard load: people arriving
 * to pay or track a parcel were greeted by a rating dialog they had to dismiss
 * first. As a card it stays visible but never blocks — and it is still shown at
 * most once per delivery (`isReviewSeen` in the dashboard retires it).
 */
function ReviewPromptCard({ onOpen }: ReviewPromptCardProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-3.5 text-left transition active:scale-[0.99] dark:border-amber-400/20 dark:from-amber-400/10 dark:to-orange-400/5"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300">
        <Star className="h-5 w-5 fill-current" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-gray-950 dark:text-[#fff8ed]">
          {t('review.promptCard.title', 'Yetkazib berishni baholang')}
        </span>
        <span className="block truncate text-xs font-semibold text-gray-500 dark:text-white/45">
          {t('review.promptCard.subtitle', 'Bir daqiqa vaqtingizni oling — xizmatni yaxshilashga yordam beradi')}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-amber-500" />
    </button>
  );
}

export default memo(ReviewPromptCard);
