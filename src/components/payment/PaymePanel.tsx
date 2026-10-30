/**
 * Pay on Payme's own page: a flight's whole debt, or an UzPost delivery fee.
 *
 * The caller opened the order (and Payme's page with it). This step shows what
 * Payme charges and for how long, reopens the same page, and polls the order
 * until Payme has performed the payment and the server has booked it. Payme
 * itself refuses an expired or replaced order; a new one starts over, and the
 * server hands back the order Payme is already paying instead of a second one.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Undo2,
  type LucideIcon,
} from 'lucide-react';

import {
  openPaymeCheckout,
  paymeRefusal,
  paymeService,
  type PaymeOrder,
} from '@/api/services/paymeService';
import { playApplePaySound } from '@/utils/audioUtils';
import { triggerSuccessHaptic } from '@/utils/haptics';

const POLL_MS = 4_000;
const LOW_TIME_SECONDS = 5 * 60;

function formatSom(value: number): string {
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 }).format(value);
}

/** Minutes and seconds to `expires_at`, counted from the server's clock. */
function Countdown({ order, receivedAt }: { order: PaymeOrder; receivedAt: number }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(receivedAt);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsed = Math.max(now, receivedAt) - receivedAt;
  const remaining = Date.parse(order.expires_at) - Date.parse(order.server_time) - elapsed;
  const seconds = Math.max(0, Math.floor(remaining / 1000));
  const low = seconds < LOW_TIME_SECONDS;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <span
      role="timer"
      aria-label={t('payme.timeLeft')}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-mc-sm px-2.5 text-[13px] font-bold tabular-nums ${
        low ? 'bg-mc-warn-soft text-mc-warn' : 'bg-mc-surface-2 text-mc-text'
      }`}
    >
      <Clock className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
      {seconds > 0 ? clock : t('payme.timeUp')}
    </span>
  );
}

type Tone = 'success' | 'warn' | 'neutral';

const TONE_CIRCLE: Record<Tone, string> = {
  success: 'bg-mc-success/12 text-mc-success',
  warn: 'bg-mc-warn-soft text-mc-warn',
  neutral: 'bg-mc-surface-2 text-mc-text-2',
};

function StatusBlock({
  tone,
  icon: Icon,
  spin,
  title,
  children,
}: {
  tone: Tone;
  icon: LucideIcon;
  spin?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className={`flex h-16 w-16 items-center justify-center rounded-full ${TONE_CIRCLE[tone]}`}
      >
        <Icon className={`h-8 w-8 ${spin ? 'animate-spin' : ''}`} strokeWidth={2} aria-hidden="true" />
      </motion.div>
      <h3 className="text-[17px] font-extrabold text-mc-text">{title}</h3>
      {children}
    </div>
  );
}

const primaryButton =
  'flex h-14 w-full items-center justify-center gap-2 rounded-mc-lg bg-mc-brand text-[15px] font-extrabold text-mc-on-brand shadow-[var(--mc-shadow-cta)] transition-transform active:scale-[0.97] disabled:opacity-60';
const secondaryButton =
  'flex h-12 w-full items-center justify-center rounded-mc-lg border border-mc-border bg-mc-surface text-[14px] font-bold text-mc-text transition-transform active:scale-[0.97]';
const description = 'max-w-[290px] text-[13px] font-medium leading-relaxed text-mc-text-2';

interface PaymePanelProps {
  /** The order the pay button opened. */
  initialOrder: PaymeOrder;
  /** Open the order again (the same one while it is open), for «Yangi buyurtma». */
  reopenOrder: () => Promise<PaymeOrder>;
  /** Once, when the order is paid: refresh what the payment changed. */
  onPaid?: (order: PaymeOrder) => void;
  /** Back to the choice of method. */
  onBack: () => void;
  /** Close the wizard. */
  onDone: () => void;
}

export function PaymePanel({ initialOrder, reopenOrder, onPaid, onBack, onDone }: PaymePanelProps) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(() => ({
    order: initialOrder,
    receivedAt: Date.now(),
  }));

  const poll = useQuery({
    queryKey: ['payme-order', current.order.id],
    queryFn: () => paymeService.getOrder(current.order.id),
    refetchInterval: (query) => {
      const state = (query.state.data ?? current.order).state;
      return state === 'open' || state === 'processing' ? POLL_MS : false;
    },
    gcTime: 0,
  });

  const order = poll.data ?? current.order;
  const receivedAt = poll.data ? poll.dataUpdatedAt : current.receivedAt;

  const openPage = (url: string) => {
    if (!openPaymeCheckout(url)) toast.error(t('payme.badLink'));
  };

  const reopen = useMutation({
    mutationFn: reopenOrder,
    onSuccess: (next) => {
      setCurrent({ order: next, receivedAt: Date.now() });
      if (next.state === 'open' && next.checkout_url) openPage(next.checkout_url);
    },
    onError: (error) => toast.error(paymeRefusal(error, t('makePayment.errorOccurred'))),
  });

  // Feedback once per order, not on every poll that repeats it.
  const announced = useRef<number | null>(null);
  useEffect(() => {
    if (order.state !== 'paid' || announced.current === order.id) return;
    announced.current = order.id;
    playApplePaySound();
    triggerSuccessHaptic();
    onPaid?.(order);
  }, [order, onPaid]);

  const amount = formatSom(order.amount);

  if (order.state === 'paid') {
    return (
      <StatusBlock tone="success" icon={CheckCircle2} title={t('payme.paidTitle')}>
        <p className={description}>
          {order.kind === 'delivery' && order.delivery_request_id
            ? t('payme.paidDeliveryDesc', { amount, request: order.delivery_request_id })
            : t('payme.paidDesc', { amount, flight: order.flight_name })}
        </p>
        <button type="button" onClick={onDone} className={`${primaryButton} max-w-xs`}>
          {t('makePayment.done')}
        </button>
      </StatusBlock>
    );
  }

  if (order.state === 'processing') {
    return (
      <StatusBlock tone="neutral" icon={Loader2} spin title={t('payme.processingTitle')}>
        <p className={description}>{t('payme.processingDesc', { amount })}</p>
      </StatusBlock>
    );
  }

  if (order.state === 'refunded') {
    return (
      <StatusBlock tone="warn" icon={Undo2} title={t('payme.refundedTitle')}>
        <p className={description}>{t('payme.refundedDesc', { amount })}</p>
        <button type="button" onClick={onDone} className={`${secondaryButton} max-w-xs`}>
          {t('makePayment.done')}
        </button>
      </StatusBlock>
    );
  }

  if (order.state === 'expired' || order.state === 'replaced') {
    const expired = order.state === 'expired';
    return (
      <StatusBlock
        tone="warn"
        icon={expired ? Clock : RefreshCw}
        title={expired ? t('payme.expiredTitle') : t('payme.replacedTitle')}
      >
        <p className={description}>
          {expired ? t('payme.expiredDesc') : t('payme.replacedDesc')}
        </p>
        <div className="flex w-full max-w-xs flex-col gap-2.5">
          <button
            type="button"
            onClick={() => reopen.mutate()}
            disabled={reopen.isPending}
            className={primaryButton}
          >
            {reopen.isPending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {t('payme.newOrder')}
          </button>
          <button type="button" onClick={onBack} className={secondaryButton}>
            {t('payme.otherMethod')}
          </button>
        </div>
      </StatusBlock>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-extrabold text-mc-text">{t('payme.title')}</h3>
        <Countdown order={order} receivedAt={receivedAt} />
      </div>

      <div className="rounded-mc-lg border border-mc-border bg-mc-surface-2 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-mc-text-3">
          {t('payme.amountLabel')}
        </p>
        <p className="mt-1 text-[26px] font-extrabold leading-tight tabular-nums text-mc-text min-[360px]:text-[28px]">
          {amount}
          <span className="ml-1.5 text-[14px] font-bold text-mc-text-2">so'm</span>
        </p>
        <p className="mt-1.5 break-words text-[12px] font-semibold text-mc-text-2">
          {order.kind === 'delivery'
            ? t('payme.deliveryFor', { flights: order.flight_name })
            : t('payme.flightFor', { flight: order.flight_name })}
        </p>
      </div>

      {order.checkout_url && (
        <button
          type="button"
          onClick={() => openPage(order.checkout_url as string)}
          className={primaryButton}
        >
          {t('payme.open')}
          <ExternalLink className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
        </button>
      )}

      <p className="flex items-start gap-2.5 text-[12px] font-medium leading-relaxed text-mc-text-2">
        <span className="relative mt-1.5 flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mc-brand opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-mc-brand" />
        </span>
        {t('payme.waiting')}
      </p>

      <button type="button" onClick={onBack} className={secondaryButton}>
        {t('payme.otherMethod')}
      </button>
    </div>
  );
}
