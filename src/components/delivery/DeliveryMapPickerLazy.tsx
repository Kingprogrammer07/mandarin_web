import { lazy, Suspense, useState, useCallback, memo, useEffect } from 'react';
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
  const [savedSuggestion, setSavedSuggestion] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);

  useEffect(() => {
    const saved = getSavedMapLocation();
    if (saved && !confirmedLocation && !dismissedSuggestion) {
      setSavedSuggestion(saved);
    }
  }, [confirmedLocation, dismissedSuggestion]);

  const handleConfirm = useCallback(
    (location: { latitude: number; longitude: number }) => {
      saveMapLocation(location);
      onConfirm(location);
      setIsOpen(false);
      setSavedSuggestion(null);
    },
    [onConfirm]
  );

  const handleCancel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleUseSaved = useCallback(() => {
    if (savedSuggestion) {
      onConfirm(savedSuggestion);
      setSavedSuggestion(null);
    }
  }, [onConfirm, savedSuggestion]);

  const handleDismissSaved = useCallback(() => {
    setSavedSuggestion(null);
    setDismissedSuggestion(true);
  }, []);

  if (confirmedLocation && !isOpen) {
    return (
      <div className="rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
              <MapPinned className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                {t('deliveryRequest.map.selectedLabel')}
              </p>
              <a
                href={`https://yandex.com/maps/?pt=${confirmedLocation.longitude},${confirmedLocation.latitude}&z=16&l=map`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400"
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
              className="h-9 rounded-xl bg-orange-50 px-3 text-xs font-bold text-orange-700 transition active:scale-95 dark:bg-orange-500/15 dark:text-orange-300"
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
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 transition active:scale-95 dark:bg-red-500/15"
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
      <div className="rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300">
            <MapPinned className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
              {t('deliveryRequest.map.savedSuggestionLabel')}
            </p>
            <p className="mt-0.5 text-sm font-extrabold text-gray-900 dark:text-gray-100">
              {t('deliveryRequest.map.savedSuggestionHint')}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleUseSaved}
            className="h-11 rounded-2xl bg-emerald-500 px-3 text-xs font-extrabold text-white shadow-lg shadow-emerald-500/20 transition active:scale-95"
          >
            {t('deliveryRequest.map.useSavedLocation')}
          </button>
          <button
            type="button"
            onClick={handleDismissSaved}
            className="h-11 rounded-2xl border border-orange-200 bg-orange-50 px-3 text-xs font-extrabold text-orange-700 transition active:scale-95 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300"
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
        className="w-full rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/15 bg-gray-50 dark:bg-white/[0.02] p-5 flex flex-col items-center justify-center gap-2 transition active:scale-[0.99] hover:bg-gray-100 dark:hover:bg-white/5"
      >
        <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center text-orange-500">
          <MapPin className="w-6 h-6" />
        </div>
        <p className="font-bold text-sm text-gray-700 dark:text-gray-200">{t('deliveryRequest.map.openButton')}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{t('deliveryRequest.map.openHint')}</p>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 backdrop-blur-md">
      <p className="text-sm font-extrabold text-gray-900 dark:text-gray-100 mb-3">
        {t('deliveryRequest.map.title')}
      </p>
      <Suspense
        fallback={
          <div className="flex h-[320px] items-center justify-center rounded-3xl bg-gray-100 dark:bg-white/5">
            <div className="text-center">
              <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-orange-500" />
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
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
