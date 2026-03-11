import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ReceiptText,
  Calendar as CalendarIcon,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { paymentService, type TransactionHistoryItem } from '@/api/services/paymentService';
import { formatTashkentDateTime } from '@/lib/format';
import { UniqueBackground } from '@/components/ui/UniqueBackground';
import { useTranslation } from 'react-i18next';

interface UserHistoryPageProps {
  onBack?: () => void;
}

type PaymentStatus = TransactionHistoryItem['payment_status'];

const statusMeta: Record<PaymentStatus, { labelKey: string; className: string; Icon: typeof CheckCircle2 } > = {
  paid: {
    labelKey: 'paymentHistory.status.paid',
    className: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    Icon: CheckCircle2,
  },
  partial: {
    labelKey: 'paymentHistory.status.partial',
    className: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    Icon: Clock,
  },
  pending: {
    labelKey: 'paymentHistory.status.pending',
    className: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
    Icon: Clock,
  },
};

const formatMoney = (value: number) => `${value.toLocaleString('uz-UZ')} so'm`;

const BreakdownBadge = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between rounded-2xl bg-white/70 dark:bg-white/5 border border-white/30 dark:border-white/10 px-2.5 sm:px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
    <span className="truncate mr-1">{label}</span>
    <span className="text-xs sm:text-sm text-gray-900 dark:text-white whitespace-nowrap">{value.toLocaleString('uz-UZ')}</span>
  </div>
);

const HistoryCard = ({ item }: { item: TransactionHistoryItem }) => {
  const { t } = useTranslation();
  const StatusIcon = statusMeta[item.payment_status].Icon;

  const showBreakdown = item.payment_status === 'paid' || item.payment_status === 'partial';
  const breakdownEntries = useMemo(
    () => [
      { key: 'click', label: t('paymentHistory.breakdownTypes.click'), value: item.breakdown.click },
      { key: 'payme', label: t('paymentHistory.breakdownTypes.payme'), value: item.breakdown.payme },
      { key: 'cash', label: t('paymentHistory.breakdownTypes.cash'), value: item.breakdown.cash },
      { key: 'card', label: t('paymentHistory.breakdownTypes.card'), value: item.breakdown.card },
    ],
    [item.breakdown.click, item.breakdown.payme, item.breakdown.cash, item.breakdown.card, t],
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/80 dark:bg-white/5 backdrop-blur-xl shadow-lg p-4 sm:p-5"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white/40 to-slate-100 dark:from-white/5 dark:via-white/0 dark:to-white/0" />
      <div className="absolute inset-x-10 -bottom-12 h-32 bg-gradient-to-br from-orange-400/10 via-amber-400/5 to-transparent blur-3xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('paymentHistory.card.flight')}</p>
          <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white leading-tight truncate" title={item.flight_name}>{item.flight_name}</h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300/80 flex items-center gap-1">
            <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            {formatTashkentDateTime(item.created_at, 'uz')}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold border whitespace-nowrap shrink-0 ${statusMeta[item.payment_status].className}`}
        >
          <StatusIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          {t(statusMeta[item.payment_status].labelKey)}
        </span>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-2xl bg-white/70 dark:bg-white/5 border border-white/25 dark:border-white/10 p-3">
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-semibold">{t('paymentHistory.card.totalAmount')}</p>
          <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{formatMoney(item.total_amount)}</p>
        </div>
        <div className="rounded-2xl bg-white/70 dark:bg-white/5 border border-white/25 dark:border-white/10 p-3">
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-semibold">{t('paymentHistory.card.paid')}</p>
          <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-300">{formatMoney(item.paid_amount)}</p>
        </div>
        <div className="rounded-2xl bg-white/70 dark:bg-white/5 border border-white/25 dark:border-white/10 p-3">
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-semibold">{t('paymentHistory.card.remaining')}</p>
          <p className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-300">{formatMoney(item.remaining_amount)}</p>
        </div>
        <div className="rounded-2xl bg-white/70 dark:bg-white/5 border border-white/25 dark:border-white/10 p-3">
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-1">
            <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
            {t('paymentHistory.card.paymentType')}
          </p>
          <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white capitalize truncate" title={item.payment_type}>{item.payment_type}</p>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">{item.is_taken_away ? t('paymentHistory.card.takenAway') : t('paymentHistory.card.notTakenAway')}</p>
        </div>
      </div>

      {showBreakdown && (
        <div className="relative mt-4 p-3 rounded-2xl bg-white/80 dark:bg-white/5 border border-white/20 dark:border-white/10">
          <div className="flex items-center gap-2 mb-3 text-sm sm:text-base font-semibold text-gray-800 dark:text-white">
            <ReceiptText className="w-4 h-4 sm:w-5 sm:h-5" />
            {t('paymentHistory.card.breakdown')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {breakdownEntries.map((entry) => (
              <BreakdownBadge key={entry.key} label={entry.label} value={entry.value} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

const SkeletonCard = () => (
  <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-lg p-5">
    <div className="absolute inset-0 bg-gradient-to-br from-white/70 to-white/30 dark:from-white/10 dark:to-white/5 animate-pulse" />
    <div className="relative space-y-4">
      <div className="h-4 w-2/5 bg-gray-200 dark:bg-white/10 rounded-full" />
      <div className="h-7 w-3/5 bg-gray-200 dark:bg-white/10 rounded-full" />
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {[...Array(4)].map((_, idx) => (
          <div key={idx} className="h-14 rounded-2xl bg-gray-200/80 dark:bg-white/10" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[...Array(4)].map((_, idx) => (
          <div key={idx} className="h-8 rounded-xl bg-gray-200/70 dark:bg-white/10" />
        ))}
      </div>
    </div>
  </div>
);

export default function UserHistoryPage({ onBack }: UserHistoryPageProps) {
  const { t } = useTranslation();
  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['payment-history'],
    queryFn: ({ pageParam = 0 }) => paymentService.getPaymentHistory(10, pageParam),
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;
      return nextOffset < lastPage.total_count ? nextOffset : undefined;
    },
    initialPageParam: 0,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = data?.pages?.[0]?.total_count ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0a04] text-gray-900 dark:text-white pb-28 pt-24 md:pt-32 relative">
      <UniqueBackground />

      <div className="container mx-auto px-4 max-w-lg md:max-w-3xl lg:max-w-5xl relative z-10">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-white/20 bg-white/70 dark:bg-white/5 backdrop-blur-xl text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-sm hover:-translate-y-[1px] transition"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('paymentHistory.back')}
            </button>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('paymentHistory.subtitle')}</p>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t('paymentHistory.title')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300/80">{t('paymentHistory.desc')}</p>
          </div>
        </div>

        {isError && (
          <div className="relative overflow-hidden rounded-3xl border border-rose-200 dark:border-rose-500/20 bg-rose-50/80 dark:bg-rose-500/5 p-4 text-rose-700 dark:text-rose-200 mt-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5" />
              <div>
                <p className="font-bold">{t('paymentHistory.error.title')}</p>
                <p className="text-sm opacity-80">{t('paymentHistory.error.desc')}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => refetch()}
                className="px-3 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold shadow-sm"
              >
                {t('paymentHistory.error.retry')}
              </button>
              {onBack && (
                <button
                  onClick={onBack}
                  className="px-3 py-2 rounded-xl border border-white/30 bg-white/70 dark:bg-white/5 text-sm font-semibold text-gray-700 dark:text-gray-200"
                >
                  {t('paymentHistory.error.home')}
                </button>
              )}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mt-6">
            {[...Array(3)].map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/80 dark:bg-white/5 backdrop-blur-xl shadow-lg p-8 text-center mt-6">
            <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 mb-3">
              <ReceiptText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('paymentHistory.emptyState.title')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300/80 mt-1">{t('paymentHistory.emptyState.desc')}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mt-6">
          {items.map((item) => (
            <HistoryCard key={item.id} item={item} />
          ))}
        </div>

        {hasNextPage && !isError && (
          <div className="flex justify-center pt-4 pb-10">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isFetchingNextPage ? t('paymentHistory.loading') : t('paymentHistory.loadMore', { current: items.length, total: totalCount })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
