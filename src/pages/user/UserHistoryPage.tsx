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
    className: 'bg-mc-tile-green text-mc-tile-green-ink',
    Icon: CheckCircle2,
  },
  partial: {
    labelKey: 'paymentHistory.status.partial',
    className: 'bg-mc-warn-soft text-mc-warn',
    Icon: Clock,
  },
  pending: {
    labelKey: 'paymentHistory.status.pending',
    className: 'bg-mc-danger-soft text-mc-danger',
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
    chipClass: 'bg-mc-tile-green text-mc-tile-green-ink',
    amountClass: 'text-mc-success',
    Icon: Gift,
  },
  penalty: {
    labelKey: 'paymentHistory.adjustment.penalty',
    chipClass: 'bg-mc-danger-soft text-mc-danger',
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
  <div className="flex min-h-8 items-center justify-between rounded-mc-sm border border-mc-border px-2.5 text-[12px] font-semibold text-mc-text">
    <span className="mr-1 flex items-center gap-1.5 truncate text-mc-text-2">
      {Icon && <Icon className="h-3.5 w-3.5 text-mc-text-3" />}
      {label}
    </span>
    <span className="whitespace-nowrap tabular-nums text-mc-text">{value.toLocaleString('uz-UZ')}</span>
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
      className="relative overflow-hidden rounded-mc-lg border border-mc-border bg-mc-surface p-3.5"
    >

      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <h3
            className="truncate text-[16px] font-extrabold leading-tight text-mc-text"
            title={isAdjustment ? ledger.reason : item.flight_name}
          >
            {isAdjustment
              ? ledger.reason || t(adjustment!.labelKey)
              : item.flight_name}
          </h3>
          <p className="flex items-center gap-1 text-[11px] font-medium text-mc-text-2">
            <CalendarIcon className="h-3 w-3" strokeWidth={2} />
            {formatTashkentDateTime(item.created_at, language)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {adjustment ? (
            <span
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${adjustment.chipClass}`}
            >
              <adjustment.Icon className="h-3.5 w-3.5" strokeWidth={2} />
              {t(adjustment.labelKey)}
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${statusMeta[item.payment_status].className}`}
            >
              <StatusIcon className="h-3 w-3" />
              {t(statusMeta[item.payment_status].labelKey)}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${
              isAdjustment ? 'hidden ' : ''
            }${
              item.is_taken_away
                ? 'bg-mc-surface-2 text-mc-text-2'
                : 'bg-mc-tile-blue text-mc-tile-blue-ink'
            }`}
          >
            <PickupIcon className="h-3 w-3" />
            {item.is_taken_away ? t('paymentHistory.card.takenAway') : t('paymentHistory.card.notTakenAway')}
          </span>
        </div>
      </div>

      {isAdjustment ? (
        <div className="relative mt-3 rounded-mc-md bg-mc-bg px-3 py-2.5">
          <p className="text-[11px] font-medium text-mc-text-2">
            {t('paymentHistory.adjustment.effect')}
          </p>
          <p className={`mt-0.5 text-[15px] font-extrabold tabular-nums ${adjustment!.amountClass}`}>
            {typeof item.balance_difference === 'number'
              ? `${item.balance_difference > 0 ? '+' : ''}${formatMoney(item.balance_difference, language, currencyLabel)}`
              : '—'}
          </p>
        </div>
      ) : (
      // One ledger of label and figure, right-aligned so the digits line up.
      // Only what is still owed takes a colour; paid money is just the record.
      <dl className="relative mt-3 divide-y divide-mc-border rounded-mc-md bg-mc-bg px-3">
        {[
          { key: 'total', label: t('paymentHistory.card.totalAmount'), value: formatMoney(item.total_amount, language, currencyLabel), tone: 'text-mc-text' },
          { key: 'paid', label: t('paymentHistory.card.paid'), value: formatMoney(item.paid_amount, language, currencyLabel), tone: 'text-mc-text' },
          { key: 'left', label: t('paymentHistory.card.remaining'), value: formatMoney(item.remaining_amount, language, currencyLabel), tone: item.remaining_amount > 0 ? 'text-mc-danger' : 'text-mc-text-3' },
          { key: 'type', label: t('paymentHistory.card.paymentType'), value: paymentTypeLabel, tone: 'text-mc-text' },
        ].map((row) => (
          <div key={row.key} className="flex min-h-8 items-center justify-between gap-3">
            <dt className="text-[12px] text-mc-text-2">{row.label}</dt>
            <dd className={`truncate text-[13px] font-bold tabular-nums ${row.tone}`} title={row.value}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      )}

      {showBreakdown && (
        <div className="relative mt-2">
          {/* The chips name their own source, so the heading only needs to
              exist for screen readers. */}
          <p className="sr-only">{t('paymentHistory.card.breakdown')}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {breakdownEntries.map((entry) => (
              <BreakdownBadge key={entry.key} label={entry.label} value={entry.value} icon={entry.icon} />
            ))}
          </div>
          {/* NBU card + receipt: recognise the card, view the rendered check. */}
          {(item.nbu_card_masked || item.nbu_order_id) && (
            <div className="mt-2 flex items-center justify-between gap-2">
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
  <div className="overflow-hidden rounded-mc-lg border border-mc-border bg-mc-surface p-5" aria-hidden="true">
    <div className="space-y-4">
      <div className="h-4 w-2/5 bg-mc-surface-2 rounded-full" />
      <div className="h-7 w-3/5 bg-mc-surface-2 rounded-full" />
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {[...Array(4)].map((_, idx) => (
          <div key={idx} className="h-14 rounded-mc-lg bg-mc-surface-2" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[...Array(4)].map((_, idx) => (
          <div key={idx} className="h-8 rounded-mc-md bg-mc-surface-2" />
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
          <h1 className="text-[19px] font-extrabold leading-tight tracking-[-0.02em] text-mc-text">
            {t('paymentHistory.title')}
          </h1>
          <p className="mt-0.5 text-[12px] text-mc-text-2">
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
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3
                              text-[12px] font-bold transition-colors duration-150 ${
                                isActive
                                  ? 'border-mc-text bg-mc-text text-mc-surface'
                                  : 'border-mc-border bg-mc-surface text-mc-text-2'
                              }`}
                >
                  {t(labelKey)}
                  <span
                    className={`text-[11px] tabular-nums ${
                      isActive ? 'text-mc-surface' : 'text-mc-text-3'
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
          <div className="mx-4 mt-3 rounded-mc-lg border border-mc-border bg-mc-surface p-8 text-center">
            <ReceiptText className="mx-auto mb-3 h-8 w-8 text-mc-text-3" strokeWidth={1.6} aria-hidden="true" />
            <h3 className="text-[15px] font-extrabold text-mc-text">
              {t('paymentHistory.emptyState.title')}
            </h3>
            <p className="mt-1 text-[12px] font-medium text-mc-text-2">
              {t('paymentHistory.emptyState.desc')}
            </p>
          </div>
        )}

        <div className="mt-3 space-y-2 px-4 pb-5">
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
