import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { DriveStep } from 'driver.js';
import {
  CreditCard,
  Trash2,
  Plus,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { nbuPaymentService } from '@/api/services/nbuPaymentService';
import { redirectToNbuUrl } from '@/utils/nbuReturnContext';
import { useGuideTour } from '@/hooks/useGuideTour';

interface SavedCardsPageProps {
  onBack?: () => void;
}

function formatRelativeTime(isoDate: string | null, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return t('time.justNow', { defaultValue: 'Hozirgina' });
  if (diffMin < 60) return `${diffMin} ${t('time.minutesAgo', { defaultValue: 'daqiqa oldin' })}`;
  if (diffHour < 24) return `${diffHour} ${t('time.hoursAgo', { defaultValue: 'soat oldin' })}`;
  if (diffDay < 30) return `${diffDay} ${t('time.daysAgo', { defaultValue: 'kun oldin' })}`;
  return date.toLocaleDateString('uz-UZ');
}

export default function SavedCardsPage({ onBack }: SavedCardsPageProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    data: cardsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['nbu-cards'],
    queryFn: nbuPaymentService.listCards,
    staleTime: 60_000,
  });
  const cards = cardsData?.items ?? [];

  const deleteMutation = useMutation({
    mutationFn: nbuPaymentService.deleteCard,
    onSuccess: () => {
      toast.success(t('nbu.cards.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['nbu-cards'] });
    },
    onError: () => {
      toast.error(t('makePayment.errorOccurred'));
    },
  });

  const bindMutation = useMutation({
    mutationFn: () => nbuPaymentService.bindCard(),
    onSuccess: (data) => {
      const paymentUrl = data.payment_url;
      if (paymentUrl) {
        redirectToNbuUrl({
          orderId: data.order_id,
          kind: 'card_binding',
          paymentUrl,
        });
      }
    },
    onError: () => {
      toast.error(t('makePayment.errorOccurred'));
    },
  });

  const handleDelete = useCallback(
    (cardId: number) => {
      if (window.confirm(t('nbu.cards.deleteConfirm'))) {
        deleteMutation.mutate(cardId);
      }
    },
    [deleteMutation, t],
  );

  const handleBind = useCallback(() => {
    bindMutation.mutate();
  }, [bindMutation]);

  const buildCardTour = useCallback((): DriveStep[] => {
    const steps: DriveStep[] = [
      {
        element: '[data-tour="card-bind"]',
        popover: {
          title: t('tour.cardBinding.bind.title'),
          description: t('tour.cardBinding.bind.desc'),
        },
      },
    ];

    if (cards.length > 0) {
      steps.push({
        element: '[data-tour="card-item"]',
        popover: {
          title: t('tour.cardBinding.use.title'),
          description: t('tour.cardBinding.use.desc'),
        },
      });
    }

    return steps;
  }, [t, cards.length]);
  useGuideTour('card-binding', buildCardTour, !isLoading && !isError);

  return (
    <div className="min-h-dvh bg-mc-bg px-4 pt-3 pb-5">
      {/* Header */}
      <div className="max-w-lg mx-auto flex items-center gap-2.5 mb-3">
        {onBack && (
          <button
            onClick={onBack}
            aria-label={t('common.back', 'Ortga')}
            className="p-2 -ml-2 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-mc-text-2" />
          </button>
        )}
        <h1 className="text-xl font-extrabold text-mc-text">
          {t('nbu.cards.title')}
        </h1>
      </div>

      <div className="max-w-lg mx-auto space-y-4">
        {/* Bind new card button */}
        <motion.button
          data-tour="card-bind"
          whileTap={{ scale: 0.97 }}
          onClick={handleBind}
          disabled={bindMutation.isPending}
          className="w-full flex items-center justify-center gap-2 h-14 rounded-mc-lg font-bold text-base
            bg-mc-surface
            border border-dashed border-mc-border dark:border-white/15
            text-mc-text
            active:scale-[0.97] transition-all
            disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {bindMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
          {t('nbu.cards.bindNew')}
        </motion.button>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-mc-brand animate-spin" />
          </div>
        )}

        {/* Error */}
        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <p className="text-mc-text-2">
              {t('makePayment.errorOccurred')}
            </p>
            <button
              onClick={() => refetch()}
              className="px-6 py-3 rounded-mc-md bg-mc-brand text-white font-semibold text-base active:scale-95 transition-transform"
            >
              {t('makePayment.retry')}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && cards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-mc-surface-2 flex items-center justify-center">
              <CreditCard className="w-8 h-8 text-mc-text-3" />
            </div>
            <p className="text-lg font-semibold text-mc-text">
              {t('nbu.cards.empty')}
            </p>
          </div>
        )}

        {/* Card list */}
        <AnimatePresence>
          {cards.map((card, index) => (
            <motion.div
              key={card.id}
              data-tour={index === 0 ? 'card-item' : undefined}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-4 p-4 rounded-mc-lg
                bg-mc-surface
                border border-mc-border
                shadow-sm"
            >
              <div className="w-11 h-11 rounded-mc-md bg-mc-brand-soft flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-mc-brand" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base text-mc-text truncate">
                  {card.nickname || card.card_masked || t('nbu.cards.namedCardFallback')}
                </p>
                {card.nickname && card.card_masked ? (
                  <p className="font-mono text-xs text-mc-text-2 truncate">
                    {card.card_masked}
                  </p>
                ) : !card.card_masked ? (
                  <p className="text-xs text-mc-text-3 truncate">
                    {t('nbu.cards.pendingMasked')}
                  </p>
                ) : null}
                {card.last_used_at && (
                  <p className="text-xs text-mc-text-2">
                    {t('nbu.cards.lastUsed', {
                      when: formatRelativeTime(card.last_used_at, t),
                    })}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(card.id)}
                disabled={deleteMutation.isPending}
                className="p-2.5 rounded-mc-md
                  text-mc-text-3
                  active:scale-90 transition-all
                  disabled:opacity-60"
                aria-label={t('nbu.cards.deleteConfirm')}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
