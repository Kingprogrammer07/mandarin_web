import { lazy, Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { triggerSoftHaptic } from '@/utils/haptics';

const TrackCodeTab = lazy(() => import('@/pages/dashboard/TrackCodeTab'));

interface TrackCodeViewProps {
  /** Pre-filled and searched immediately — the code typed on the home screen. */
  initialCode?: string;
  onBack: () => void;
}

/**
 * Full-screen wrapper around `TrackCodeTab`.
 *
 * The tab was written to sit inside the old dashboard's tab strip. Now that
 * the dashboard is gone it was unreachable entirely — the home search bar
 * navigated to the reports screen instead, which is a different page and never
 * ran the lookup.
 *
 * Deliberately thin: a back control and the horizontal padding the tab's old
 * container used to supply, nothing else. The tab draws its own title, so
 * anything more here would show the client two titles and two back buttons.
 */
export function TrackCodeView({ initialCode, onBack }: TrackCodeViewProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh bg-mc-bg">
      <div className="mx-auto max-w-lg">
      <div className="px-4 pt-2.5 pb-2">
        <button
          type="button"
          onClick={() => {
            triggerSoftHaptic();
            onBack();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-mc-sm
                     bg-mc-surface-2 text-mc-text transition-colors duration-150"
          aria-label={t('common.back', 'Ortga')}
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {/* The tab has no horizontal padding of its own — it used to inherit the
          dashboard's container. */}
      <div className="px-4">
        <Suspense fallback={null}>
          <TrackCodeTab initialCode={initialCode} />
        </Suspense>
      </div>
      </div>
    </div>
  );
}
