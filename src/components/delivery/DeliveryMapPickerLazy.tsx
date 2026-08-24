import { lazy, Suspense, useState, useCallback, memo } from 'react';
import { MapPin, Loader2, X, MapPinned } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getSavedMapLocation,
  saveMapLocation,
  clearSavedMapLocation,
} from '@/utils/deliveryMapStorage';

const DeliveryMapPicker = lazy(() => import('./DeliveryMapPicker').then((m) => ({ default: m.DeliveryMapPicker })));

interface DeliveryMapPickerLazyProps {
  initialLocation?: { latitude: number; longitude: number } | null;
  onConfirm: (location: { latitude: number; longitude: number }) => void;
  onClear?: () => void;
  confirmedLocation?: { latitude: number; longitude: number } | null;
}

export const DeliveryMapPickerLazy = memo(function DeliveryMapPickerLazy({
  initialLocation,
  onConfirm,
  onClear,
  confirmedLocation,
}: DeliveryMapPickerLazyProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  // Read once on mount: the saved location lives in browser storage and cannot
  // change while this component is mounted. Copying it into state from an
  // effect re-ran on every confirm/dismiss and set state from the effect body.
  const [storedLocation] = useState(() => getSavedMapLocation());
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);
  const savedSuggestion =
    storedLocation && !confirmedLocation && !dismissedSuggestion ? storedLocation : null;

  const handleConfirm = useCallback(
    (location: { latitude: number; longitude: number }) => {
      saveMapLocation(location);
      onConfirm(location);
      setIsOpen(false);
      setDismissedSuggestion(true);
    },
    [onConfirm]
  );

  const handleCancel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleUseSaved = useCallback(() => {
    if (savedSuggestion) {
      onConfirm(savedSuggestion);
      setDismissedSuggestion(true);
    }
  }, [onConfirm, savedSuggestion]);

  const handleDismissSaved = useCallback(() => {
    setDismissedSuggestion(true);
  }, []);

  if (confirmedLocation && !isOpen) {
    return (
      <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-4 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-md bg-mc-success/12 text-mc-success dark:bg-mc-success/20 dark:text-mc-success">
              <MapPinned className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-mc-text-2">
                {t('deliveryRequest.map.selectedLabel')}
              </p>
              <a
                href={`https://yandex.com/maps/?pt=${confirmedLocation.longitude},${confirmedLocation.latitude}&z=16&l=map`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-mc-brand"
              >
                <MapPin className="h-3 w-3" />
                {t('deliveryRequest.map.openYandex')}
              </a>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="h-9 rounded-mc-md bg-mc-brand-soft px-3 text-xs font-bold text-mc-brand transition active:scale-95 dark:bg-mc-brand/15 dark:text-mc-brand"
            >
              {t('deliveryRequest.map.changeButton')}
            </button>
            {onClear && (
              <button
                type="button"
                onClick={() => {
                  clearSavedMapLocation();
                  onClear();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-mc-md bg-mc-danger-soft text-mc-danger transition active:scale-95 dark:bg-mc-danger/15"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (savedSuggestion && !isOpen && !confirmedLocation) {
    return (
      <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-4 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-md bg-mc-brand-soft text-mc-brand dark:bg-mc-brand/20 dark:text-mc-brand">
            <MapPinned className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-mc-text-2">
              {t('deliveryRequest.map.savedSuggestionLabel')}
            </p>
            <p className="mt-0.5 text-sm font-extrabold text-mc-text dark:text-mc-text">
              {t('deliveryRequest.map.savedSuggestionHint')}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleUseSaved}
            className="h-11 rounded-mc-lg bg-mc-success px-3 text-xs font-extrabold text-white shadow-lg shadow-emerald-500/20 transition active:scale-95"
          >
            {t('deliveryRequest.map.useSavedLocation')}
          </button>
          <button
            type="button"
            onClick={handleDismissSaved}
            className="h-11 rounded-mc-lg border border-mc-brand/20 bg-mc-brand-soft px-3 text-xs font-extrabold text-mc-brand transition active:scale-95 dark:border-mc-brand/25 dark:bg-mc-brand/10 dark:text-mc-brand"
          >
            {t('deliveryRequest.map.chooseOtherLocation')}
          </button>
        </div>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-mc-lg border-2 border-dashed border-mc-border dark:border-white/15 bg-mc-surface-2 p-5 flex flex-col items-center justify-center gap-2 transition active:scale-[0.99]"
      >
        <div className="w-12 h-12 rounded-mc-lg bg-mc-brand-soft flex items-center justify-center text-mc-brand">
          <MapPin className="w-6 h-6" />
        </div>
        <p className="font-bold text-sm text-mc-text">{t('deliveryRequest.map.openButton')}</p>
        <p className="text-xs text-mc-text-3">{t('deliveryRequest.map.openHint')}</p>
      </button>
    );
  }

  return (
    <div className="rounded-mc-lg border border-mc-border bg-mc-surface p-4 backdrop-blur-md">
      <p className="text-sm font-extrabold text-mc-text dark:text-mc-text mb-3">
        {t('deliveryRequest.map.title')}
      </p>
      <Suspense
        fallback={
          <div className="flex h-[320px] items-center justify-center rounded-mc-lg bg-mc-surface-2">
            <div className="text-center">
              <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-mc-brand" />
              <p className="text-xs font-bold text-mc-text-2">
                {t('deliveryRequest.map.loading')}
              </p>
            </div>
          </div>
        }
      >
        <DeliveryMapPicker
          initialLocation={initialLocation ?? confirmedLocation ?? null}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      </Suspense>
    </div>
  );
});
