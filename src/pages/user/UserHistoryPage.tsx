import { useMemo, useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import type { TFunction } from 'i18next';
import {
  ReceiptText,
  Calendar as CalendarIcon,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Gift,
  Landmark,
  Loader2,
  MinusCircle,
  X,
} from 'lucide-react';
import { paymentService, type TransactionHistoryItem } from '@/api/services/paymentService';
import { nbuPaymentService } from '@/api/services/nbuPaymentService';
import { formatTashkentDateTime } from '@/lib/format';
import { parseLedgerFlight, type LedgerKind } from '@/lib/ledgerFlight';
import { HomeHeader } from '@/components/user/HomeHeader';
import { useTranslation } from 'react-i18next';

type PaymentStatus = TransactionHistoryItem['payment_status'];

const paymentTypeKeys: Record<string, string> = {
  cash: 'paymentHistory.paymentTypes.cash',
  click: 'paymentHistory.paymentTypes.click',
  payme: 'paymentHistory.paymentTypes.payme',
  card: 'paymentHistory.paymentTypes.card',
  online: 'paymentHistory.paymentTypes.online',
  wallet: 'paymentHistory.paymentTypes.wallet',
  mixed: 'paymentHistory.paymentTypes.mixed',
};

const statusMeta: Record<PaymentStatus, { labelKey: string; className: string; Icon: typeof CheckCircle2 } > = {
  paid: {
    labelKey: 'paymentHistory.status.paid',
    className: 'bg-mc-success/12 text-mc-success border-mc-success/30',
    Icon: CheckCircle2,
  },
  partial: {
    labelKey: 'paymentHistory.status.partial',
    className: 'bg-mc-warn-soft text-mc-warn border-mc-warn/30',
    Icon: Clock,
  },
  pending: {
    labelKey: 'paymentHistory.status.pending',
    className: 'bg-mc-danger-soft text-mc-danger border-mc-danger/30',
    Icon: Clock,
  },
};

/** Bonus and penalty rows are balance corrections, not flights. */
const adjustmentMeta: Record<
  Exclude<LedgerKind, 'flight'>,
  { labelKey: string; chipClass: string; amountClass: string; Icon: typeof Gift }
> = {
  bonus: {
    labelKey: 'paymentHistory.adjustment.bonus',
    chipClass: 'border-mc-success/25 bg-mc-success/12 text-mc-success',
    amountClass: 'text-mc-success',
    Icon: Gift,
  },
  penalty: {
    labelKey: 'paymentHistory.adjustment.penalty',
    chipClass: 'border-mc-danger/25 bg-mc-danger-soft text-mc-danger',
    amountClass: 'text-mc-danger',
    Icon: MinusCircle,
  },
};

const formatMoney = (value: number, language: string, currencyLabel: string) => {
  const locale = language === 'ru' ? 'ru-RU' : 'uz-UZ';
  return `${value.toLocaleString(locale)} ${currencyLabel}`;
};

const getPaymentTypeLabel = (type: string | null | undefined, t: TFunction) => {
  const normalizedType = type?.trim().toLowerCase();
  if (!normalizedType) {
    return t('paymentHistory.paymentTypes.unknown', { type: '—' });
  }

  const labelKey = paymentTypeKeys[normalizedType];
  if (labelKey) {
    return t(labelKey);
  }

  return t('paymentHistory.paymentTypes.unknown', { type });
};

const BreakdownBadge = ({ label, value, icon: Icon }: { label: string; value: number; icon?: typeof Landmark }) => (
  <div className="flex items-center justify-between rounded-mc-lg bg-mc-surface border border-mc-border dark:border-white/10 px-2.5 sm:px-3 py-2 text-xs font-semibold text-mc-text">
    <span className="truncate mr-1 flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3 text-mc-text-3" />}
      {label}
    </span>
    <span className="text-xs sm:text-sm text-mc-text whitespace-nowrap">{value.toLocaleString('uz-UZ')}</span>
  </div>
);

const HistoryCard = ({ item }: { item: TransactionHistoryItem }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'ru' ? 'ru' : 'uz';
  const currencyLabel = t('paymentHistory.card.currencyUzs');
  const StatusIcon = statusMeta[item.payment_status].Icon;
  const PickupIcon = item.is_taken_away ? CheckCircle2 : Clock;
  const paymentTypeLabel = getPaymentTypeLabel(item.payment_type, t);

  // Receipt viewer — fetches the rendered PNG (owner-scoped) on demand.
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const openReceipt = useCallback(async () => {
    if (!item.nbu_order_id || receiptLoading) return;
    setReceiptLoading(true);
    try {
      const url = await nbuPaymentService.getReceiptBlobUrl(item.nbu_order_id);
      setReceiptUrl(url);
    } catch {
      // Silent — button simply does nothing on failure.
    } finally {
      setReceiptLoading(false);
    }
  }, [item.nbu_order_id, receiptLoading]);

  const closeReceipt = useCallback(() => {
    setReceiptUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  // Release the object URL if the card unmounts while the viewer is open.
  useEffect(() => () => {
    if (receiptUrl) URL.revokeObjectURL(receiptUrl);
  }, [receiptUrl]);

  const ledger = useMemo(() => parseLedgerFlight(item.flight_name), [item.flight_name]);
  const isAdjustment = ledger.kind !== 'flight';
  const adjustment = isAdjustment ? adjustmentMeta[ledger.kind as 'bonus' | 'penalty'] : null;

  // Adjustment rows carry zero in total/paid/remaining — the money lives in
  // `balance_difference`. Showing the normal four-cell grid would print
  // "0 so'm" four times under a penalty.
  const showBreakdown =
    !isAdjustment && (item.payment_status === 'paid' || item.payment_status === 'partial');
  const breakdownEntries = useMemo(
    () => [
      { key: 'click', label: t('paymentHistory.breakdownTypes.click'), value: item.breakdown.click },
      { key: 'payme', label: t('paymentHistory.breakdownTypes.payme'), value: item.breakdown.payme },
      { key: 'cash', label: t('paymentHistory.breakdownTypes.cash'), value: item.breakdown.cash },
      { key: 'card', label: t('paymentHistory.breakdownTypes.card'), value: item.breakdown.card },
      { key: 'nbu', label: t('paymentHistory.breakdownTypes.nbu'), value: item.breakdown.nbu, icon: Landmark },
    ].filter((entry) => entry.value > 0),
    [item.breakdown.click, item.breakdown.payme, item.breakdown.cash, item.breakdown.card, item.breakdown.nbu, t],
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-mc-lg border border-mc-border bg-mc-surface backdrop-blur-xl shadow-lg p-4 sm:p-5"
    >
      <div className="absolute inset-0 bg-mc-surface" />
      <div className="absolute inset-x-10 -bottom-12 h-32 bg-gradient-to-br from-mc-brand/10 via-mc-brand/5 to-transparent blur-3xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.09em] text-mc-text-3">
            {isAdjustment
              ? t('paymentHistory.card.adjustment')
              : t('paymentHistory.card.flight')}
          </p>
          <h3
            className="truncate text-[16px] font-extrabold leading-tight text-mc-text"
            title={isAdjustment ? ledger.reason : item.flight_name}
          >
            {isAdjustment
              ? ledger.reason || t(adjustment!.labelKey)
              : item.flight_name}
          </h3>
          <p className="flex items-center gap-1 text-[12px] font-medium text-mc-text-2">
            <CalendarIcon className="h-3.5 w-3.5" strokeWidth={2} />
            {formatTashkentDateTime(item.created_at, language)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {adjustment ? (
            <span
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${adjustment.chipClass}`}
            >
              <adjustment.Icon className="h-3.5 w-3.5" strokeWidth={2} />
              {t(adjustment.labelKey)}
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold border whitespace-nowrap ${statusMeta[item.payment_status].className}`}
            >
              <StatusIcon className="w-3 h-3 sm:w-4 sm:h-4" />
              {t(statusMeta[item.payment_status].labelKey)}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-bold whitespace-nowrap ${
              isAdjustment ? 'hidden ' : ''
            }${
              item.is_taken_away
                ? 'border-mc-border bg-mc-surface-2 text-mc-text dark:border-white/[0.12] dark:bg-white/[0.08] dark:text-mc-text'
                : 'border-mc-brand/25 bg-mc-brand-soft text-mc-brand dark:border-mc-brand/25 dark:bg-mc-brand-soft dark:text-mc-brand'
            }`}
          >
            <PickupIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {item.is_taken_away ? t('paymentHistory.card.takenAway') : t('paymentHistory.card.notTakenAway')}
          </span>
        </div>
      </div>

      {isAdjustment ? (
        <div className="relative mt-3 rounded-mc-md border border-mc-border bg-mc-surface-2 p-3">
          <p className="text-[11px] font-semibold text-mc-text-2">
            {t('paymentHistory.adjustment.effect')}
          </p>
          <p className={`mt-0.5 text-[18px] font-extrabold tabular-nums ${adjustment!.amountClass}`}>
            {typeof item.balance_difference === 'number'
              ? `${item.balance_difference > 0 ? '+' : ''}${formatMoney(item.balance_difference, language, currencyLabel)}`
              : '—'}
          </p>
        </div>
      ) : (
      <div className="relative mt-4 grid grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-mc-lg bg-mc-surface border border-white/25 dark:border-white/10 p-3">
          <p className="text-[11px] sm:text-xs text-mc-text-2 font-semibold">{t('paymentHistory.card.totalAmount')}</p>
          <p className="text-base sm:text-lg font-bold text-mc-text">{formatMoney(item.total_amount, language, currencyLabel)}</p>
        </div>
        <div className="rounded-mc-lg bg-mc-surface border border-white/25 dark:border-white/10 p-3">
          <p className="text-[11px] sm:text-xs text-mc-text-2 font-semibold">{t('paymentHistory.card.paid')}</p>
          <p className="text-base sm:text-lg font-bold text-mc-success">{formatMoney(item.paid_amount, language, currencyLabel)}</p>
        </div>
        <div className="rounded-mc-lg bg-mc-surface border border-white/25 dark:border-white/10 p-3">
          <p className="text-[11px] sm:text-xs text-mc-text-2 font-semibold">{t('paymentHistory.card.remaining')}</p>
          <p className="text-base sm:text-lg font-bold text-mc-warn">{formatMoney(item.remaining_amount, language, currencyLabel)}</p>
        </div>
        <div className="rounded-mc-lg bg-mc-surface border border-white/25 dark:border-white/10 p-3">
          <p className="text-[11px] sm:text-xs text-mc-text-2 font-semibold flex items-center gap-1">
            <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
            {t('paymentHistory.card.paymentType')}
          </p>
          <p className="text-sm sm:text-base font-bold text-mc-text truncate" title={paymentTypeLabel}>{paymentTypeLabel}</p>
        </div>
      </div>
      )}

      {showBreakdown && (
        <div className="relative mt-4 p-3 rounded-mc-lg bg-mc-surface border border-mc-border dark:border-white/10">
          <div className="flex items-center gap-2 mb-3 text-sm sm:text-base font-semibold text-mc-text">
            <ReceiptText className="w-4 h-4 sm:w-5 sm:h-5" />
            {t('paymentHistory.card.breakdown')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {breakdownEntries.map((entry) => (
              <BreakdownBadge key={entry.key} label={entry.label} value={entry.value} icon={entry.icon} />
            ))}
          </div>
          {/* NBU card + receipt: recognise the card, view the rendered check. */}
          {(item.nbu_card_masked || item.nbu_order_id) && (
            <div className="mt-2.5 flex items-center justify-between gap-2">
              {item.nbu_card_masked ? (
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-mc-text-2 min-w-0">
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono truncate">{item.nbu_card_masked}</span>
                </div>
              ) : <span />}
              {item.nbu_order_id && (
                <button
                  onClick={openReceipt}
                  disabled={receiptLoading}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-mc-sm text-[11px] sm:text-xs font-bold
                    bg-mc-brand-soft text-mc-brand active:scale-95 transition-all
                    disabled:opacity-60"
                >
                  {receiptLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ReceiptText className="w-3.5 h-3.5" />
                  )}
                  {t('paymentHistory.card.viewReceipt')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Receipt image viewer */}
      {createPortal(
        <AnimatePresence>
          {receiptUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeReceipt}
              className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                className="relative max-w-sm w-full"
              >
                <button
                  onClick={closeReceipt}
                  className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-mc-surface shadow-lg flex items-center justify-center text-mc-text"
                  aria-label={t('common.close')}
                >
                  <X className="w-5 h-5" />
                </button>
                <img
                  src={receiptUrl}
                  alt={t('paymentHistory.card.receiptAlt')}
                  className="w-full rounded-mc-lg shadow-2xl"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </motion.div>
  );
};

const SkeletonCard = () => (
  <div className="relative overflow-hidden rounded-mc-lg border border-mc-border bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-lg p-5">
    <div className="absolute inset-0 bg-gradient-to-br from-white/70 to-white/30 dark:from-white/10 dark:to-white/5 animate-pulse" />
    <div className="relative space-y-4">
      <div className="h-4 w-2/5 bg-mc-surface-2 rounded-full" />
      <div className="h-7 w-3/5 bg-mc-surface-2 rounded-full" />
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {[...Array(4)].map((_, idx) => (
          <div key={idx} className="h-14 rounded-mc-lg bg-mc-surface-2/80 dark:bg-white/10" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[...Array(4)].map((_, idx) => (
          <div key={idx} className="h-8 rounded-mc-md bg-mc-surface-2/70 dark:bg-white/10" />
        ))}
      </div>
    </div>
  </div>
);

const NotificationCenter = lazy(
  () => import('@/components/notifications/NotificationCenter'),
);

/**
 * Payment history.
 *
 * Takes no props: it is a bottom-bar destination, so there is nothing behind it
 * to go back to. The `onBack` prop it used to accept described a navigation
 * model the tab bar replaced.
 */
export default function UserHistoryPage() {
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

  const items = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );
  const totalCount = data?.pages?.[0]?.total_count ?? 0;

  // Filtering happens over the pages already loaded: the endpoint paginates by
  // offset only and has no kind parameter, so a server-side filter would need a
  // new API. Adjustments are rare, and the counts below say exactly how many of
  // the loaded rows each chip holds — no silent truncation.
  const [kindFilter, setKindFilter] = useState<'all' | LedgerKind>('all');
  const counts = useMemo(() => {
    const acc = { all: items.length, flight: 0, bonus: 0, penalty: 0 };
    for (const item of items) acc[parseLedgerFlight(item.flight_name).kind] += 1;
    return acc;
  }, [items]);
  const visibleItems = useMemo(
    () =>
      kindFilter === 'all'
        ? items
        : items.filter((item) => parseLedgerFlight(item.flight_name).kind === kindFilter),
    [items, kindFilter],
  );
  const FILTERS: Array<{ id: 'all' | LedgerKind; labelKey: string }> = [
    { id: 'all', labelKey: 'paymentHistory.filter.all' },
    { id: 'flight', labelKey: 'paymentHistory.filter.flight' },
    { id: 'bonus', labelKey: 'paymentHistory.adjustment.bonus' },
    { id: 'penalty', labelKey: 'paymentHistory.adjustment.penalty' },
  ];

  return (
    <div className="min-h-dvh bg-mc-bg text-mc-text">
      {/* pt-24 cleared the top NavigationBar, which client pages no longer
          render, and pb-28 duplicated the tab-bar clearance App.tsx already
          adds. The column matches every other client screen; this page used to
          widen to max-w-5xl on desktop while the tab bar under it stayed at
          max-w-lg. */}
      <div className="mx-auto max-w-lg">
        <HomeHeader
          notificationSlot={
            <Suspense fallback={<span className="block h-10 w-10" aria-hidden="true" />}>
              <NotificationCenter />
            </Suspense>
          }
        />

        {/* No back control: this is a bottom-bar destination, so there is
            nowhere behind it to return to. */}
        <div className="px-4 pt-3">
          <h1 className="text-[19px] font-extrabold leading-tight tracking-tight text-mc-text">
            {t('paymentHistory.title')}
          </h1>
          <p className="mt-0.5 text-[12px] font-medium text-mc-text-2">
            {t('paymentHistory.desc')}
          </p>
        </div>

        {!isLoading && !isError && items.length > 0 && (
          <div className="mc-no-scrollbar mt-3 flex gap-1.5 overflow-x-auto px-4">
            {FILTERS.map(({ id, labelKey }) => {
              const isActive = id === kindFilter;
              // A chip for a kind the client has none of is a dead control.
              if (id !== 'all' && counts[id] === 0) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setKindFilter(id)}
                  aria-pressed={isActive}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5
                              text-[12px] font-extrabold transition-colors duration-150 ${
                                isActive
                                  ? 'border-mc-brand/25 bg-mc-brand-soft text-mc-brand'
                                  : 'border-mc-border bg-mc-surface-2 text-mc-text-2'
                              }`}
                >
                  {t(labelKey)}
                  <span
                    className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                      isActive ? 'bg-mc-brand text-mc-on-brand' : 'bg-mc-surface text-mc-text-3'
                    }`}
                  >
                    {counts[id]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {isError && (
          <div className="mx-4 mt-3 rounded-mc-lg border border-mc-danger/25 bg-mc-danger-soft p-3">
            <div className="flex items-start gap-2 text-mc-danger">
              <AlertCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold">{t('paymentHistory.error.title')}</p>
                <p className="mt-0.5 text-[12px] font-medium opacity-90">
                  {t('paymentHistory.error.desc')}
                </p>
              </div>
            </div>
            <button
              onClick={() => refetch()}
              className="mt-3 rounded-mc-sm bg-mc-danger-fill px-3 py-2 text-[13px] font-bold
                         text-mc-on-danger transition-transform active:scale-95"
            >
              {t('paymentHistory.error.retry')}
            </button>
          </div>
        )}

        {isLoading && (
          <div className="mt-3 space-y-2.5 px-4">
            {[...Array(3)].map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="mx-4 mt-3 rounded-mc-lg border border-mc-border bg-mc-surface p-8 text-center shadow-[var(--mc-shadow-card)]">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-mc-md bg-mc-brand-soft text-mc-brand">
              <ReceiptText className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <h3 className="text-[15px] font-extrabold text-mc-text">
              {t('paymentHistory.emptyState.title')}
            </h3>
            <p className="mt-1 text-[12px] font-medium text-mc-text-2">
              {t('paymentHistory.emptyState.desc')}
            </p>
          </div>
        )}

        <div className="mt-3 space-y-2.5 px-4">
          {visibleItems.map((item) => (
            <HistoryCard key={item.id} item={item} />
          ))}
        </div>

        {!isLoading && !isError && items.length > 0 && visibleItems.length === 0 && (
          <div className="mx-4 mt-3 rounded-mc-lg border border-mc-border bg-mc-surface p-6 text-center">
            <p className="text-[12px] font-medium text-mc-text-2">
              {t('paymentHistory.filter.empty')}
            </p>
          </div>
        )}

        {hasNextPage && !isError && (
          <div className="px-4 pb-5 pt-3">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full rounded-mc-lg border border-mc-border py-3 text-[13px]
                         font-bold text-mc-text-2 disabled:opacity-50"
            >
              {isFetchingNextPage ? t('paymentHistory.loading') : t('paymentHistory.loadMore', { current: items.length, total: totalCount })}
            </button>
          </div>
        )}
        <div className="h-5" aria-hidden="true" />
      </div>
    </div>
  );
}
