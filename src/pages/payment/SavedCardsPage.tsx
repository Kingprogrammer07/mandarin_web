import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  CreditCard,
  Trash2,
  Plus,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { nbuPaymentService } from '@/api/services/nbuPaymentService';
import { redirectToNbuUrl } from '@/utils/nbuReturnContext';

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
    mutationFn: nbuPaymentService.bindCard,
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

  const cards = cardsData?.items ?? [];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#06080d] px-4 pt-6 pb-24">
      {/* Header */}
      <div className="max-w-lg mx-auto flex items-center gap-3 mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        )}
        <h1 className="text-xl font-black text-gray-900 dark:text-white">
          {t('nbu.cards.title')}
        </h1>
      </div>

      <div className="max-w-lg mx-auto space-y-4">
        {/* Bind new card button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleBind}
          disabled={bindMutation.isPending}
          className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl font-bold text-base
            bg-white dark:bg-white/[0.04]
            border border-dashed border-gray-300 dark:border-white/15
            text-gray-700 dark:text-gray-300
            hover:border-amber-400 dark:hover:border-amber-500/40
            hover:bg-amber-50 dark:hover:bg-amber-500/5
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
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        )}

        {/* Error */}
        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              {t('makePayment.errorOccurred')}
            </p>
            <button
              onClick={() => refetch()}
              className="px-6 py-3 rounded-xl bg-amber-500 text-white font-semibold text-base active:scale-95 transition-transform"
            >
              {t('makePayment.retry')}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && cards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
              <CreditCard className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              {t('nbu.cards.empty')}
            </p>
          </div>
        )}

        {/* Card list */}
        <AnimatePresence>
          {cards.map((card) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-4 p-4 rounded-2xl
                bg-white dark:bg-white/[0.04]
                border border-gray-200 dark:border-white/10
                shadow-sm"
            >
              <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-6 h-6 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base text-gray-900 dark:text-white truncate">
                  {card.card_masked ?? t('nbu.cards.unknown')}
                </p>
                {card.last_used_at && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('nbu.cards.lastUsed', {
                      when: formatRelativeTime(card.last_used_at, t),
                    })}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(card.id)}
                disabled={deleteMutation.isPending}
                className="p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10
                  text-gray-400 dark:text-gray-500
                  hover:text-red-500 dark:hover:text-red-400
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
