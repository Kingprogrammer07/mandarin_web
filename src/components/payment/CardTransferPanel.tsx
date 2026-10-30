/**
 * Pay a flight (or an UzPost delivery fee) by card transfer from the client's
 * own bank app, no receipt.
 *
 * The server freezes the debt for 30 minutes and gives one of our cards and an
 * exact sum: the debt (or the part) plus 1–99 so'm that nobody else was given.
 * A delivery fee is paid whole; its delivery request is made, approved, only
 * when the money is approved.
 * The bank's notice names only the card and the sum, so that sum is what tells
 * whose money it is. A rounded sum cannot be matched and waits for an admin,
 * which is why the screen insists on the exact figure.
 *
 * The request is polled until the money is booked. An expired request keeps
 * being polled, slower: a transfer made in the last minute is still matched
 * when its notice comes after the half hour.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { AlertCircle, Check, CheckCircle2, Clock, Copy, Loader2, type LucideIcon } from 'lucide-react';

import {
  paymentService,
  type CardDeliveryIntentRequest,
  type CardIntent,
  type CardIntentRequest,
} from '@/api/services/paymentService';
import { playApplePaySound } from '@/utils/audioUtils';
import { triggerSoftHaptic, triggerSuccessHaptic } from '@/utils/haptics';

const POLL_MS = 5_000;
const POLL_EXPIRED_MS = 15_000;
const LOW_TIME_SECONDS = 5 * 60;

function formatSom(value: number): string {
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 }).format(value);
}

function groupCardNumber(cardNumber: string): string {
  return cardNumber.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
}

interface RefusalDetail {
  code?: string;
  message?: string;
}

/** The server's reason, in the client's language when the code is known. */
function refusalText(error: unknown, t: TFunction): string {
  const rejected = error as { message?: string; data?: { detail?: unknown } } | null;
  const detail = rejected?.data?.detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const { code, message } = detail as RefusalDetail;
    if (code) {
      return t(`cardTransfer.errors.${code}`, {
        defaultValue: message || t('makePayment.errorOccurred'),
      });
    }
    if (message) return message;
  }
  return rejected?.message || t('makePayment.errorOccurred');
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // No clipboard in this WebView, or the permission was refused.
    return false;
  }
}

function CopyButton({ value, label, onCard }: { value: string; label: string; onCard?: boolean }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    if (await copyText(value)) {
      setCopied(true);
      triggerSoftHaptic();
      toast.success(t('makePayment.copied'));
    } else {
      toast.error(t('cardTransfer.copyFailed'));
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm transition-transform active:scale-90 ${
        onCard ? 'bg-white/12 text-white' : 'border border-mc-border bg-mc-surface text-mc-text-2'
      }`}
    >
      {copied ? <Check className="h-5 w-5" strokeWidth={2.4} /> : <Copy className="h-5 w-5" />}
    </button>
  );
}

/** Minutes and seconds to `expires_at`, counted from the server's clock. */
function Countdown({ intent, receivedAt }: { intent: CardIntent; receivedAt: number }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(receivedAt);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsed = Math.max(now, receivedAt) - receivedAt;
  const remaining =
    Date.parse(intent.expires_at) - Date.parse(intent.server_time) - elapsed;
  const seconds = Math.max(0, Math.floor(remaining / 1000));
  const low = seconds < LOW_TIME_SECONDS;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <span
      role="timer"
      aria-label={t('cardTransfer.timeLeft')}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-mc-sm px-2.5 text-[13px] font-bold tabular-nums ${
        low ? 'bg-mc-warn-soft text-mc-warn' : 'bg-mc-surface-2 text-mc-text'
      }`}
    >
      <Clock className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
      {seconds > 0 ? clock : t('cardTransfer.timeUp')}
    </span>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-mc-text-2">{label}</dt>
      <dd
        className={`text-right font-bold tabular-nums ${tone === 'success' ? 'text-mc-success' : 'text-mc-text'}`}
      >
        {value}
      </dd>
    </div>
  );
}

function ReceiptNote({ receipt }: { receipt: CardIntent['receipt'] }) {
  const { t } = useTranslation();
  if (receipt === 'asked') {
    return (
      <p className="rounded-mc-md border border-mc-warn/25 bg-mc-warn-soft px-3 py-2.5 text-[12px] font-semibold leading-snug text-mc-text">
        {t('cardTransfer.receiptAsked')}
      </p>
    );
  }
  if (receipt === 'sent') {
    return (
      <p className="rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-2.5 text-[12px] font-semibold leading-snug text-mc-text">
        {t('cardTransfer.receiptSent')}
      </p>
    );
  }
  return null;
}

type Tone = 'success' | 'warn';

const TONE_CIRCLE: Record<Tone, string> = {
  success: 'bg-mc-success/12 text-mc-success',
  warn: 'bg-mc-warn-soft text-mc-warn',
};

function StatusBlock({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: Tone;
  icon: LucideIcon;
  title?: string;
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
        <Icon className="h-8 w-8" strokeWidth={2} />
      </motion.div>
      {title && <h3 className="text-[17px] font-extrabold text-mc-text">{title}</h3>}
      {children}
    </div>
  );
}

const primaryButton =
  'flex h-14 w-full items-center justify-center gap-2 rounded-mc-lg bg-mc-brand text-[15px] font-extrabold text-mc-on-brand shadow-[var(--mc-shadow-cta)] transition-transform active:scale-[0.97] disabled:opacity-60';
const secondaryButton =
  'flex h-12 w-full items-center justify-center rounded-mc-lg border border-mc-border bg-mc-surface text-[14px] font-bold text-mc-text transition-transform active:scale-[0.97]';

/** What the request pays: a flight's debt (or its part), or a delivery fee. */
type Target =
  | { kind: 'flight'; body: CardIntentRequest }
  | { kind: 'delivery'; body: CardDeliveryIntentRequest };

function openTarget(target: Target): Promise<CardIntent> {
  return target.kind === 'delivery'
    ? paymentService.openDeliveryCardIntent(target.body)
    : paymentService.openCardIntent(target.body);
}

interface CommonProps {
  /** Back to the choice of method. */
  onBack: () => void;
  /** Close the wizard once the payment is booked. */
  onDone: () => void;
  /** Once, when the payment is booked. */
  onPaid?: (intent: CardIntent) => void;
}

type CardTransferPanelProps = CommonProps &
  (
    | {
        flightName: string;
        paymentMode: 'full' | 'partial';
        /** The part to pay, so'm (partial only). */
        partAmount?: number;
        delivery?: undefined;
      }
    | {
        /** An UzPost delivery fee: the delivery request the money makes. */
        delivery: CardDeliveryIntentRequest;
        flightName?: undefined;
        paymentMode?: undefined;
        partAmount?: undefined;
      }
  );

export function CardTransferPanel({
  flightName,
  paymentMode,
  partAmount,
  delivery,
  onBack,
  onDone,
  onPaid,
}: CardTransferPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // By value: a parent re-render that rebuilds the same delivery must not open
  // another request.
  const deliveryKey = delivery ? JSON.stringify(delivery) : null;
  const target = useMemo<Target>(
    () =>
      deliveryKey
        ? { kind: 'delivery', body: JSON.parse(deliveryKey) as CardDeliveryIntentRequest }
        : {
            kind: 'flight',
            body: {
              flight_name: flightName ?? '',
              payment_mode: paymentMode ?? 'full',
              ...(paymentMode === 'partial' && partAmount ? { amount: partAmount } : {}),
            },
          },
    [deliveryKey, flightName, paymentMode, partAmount],
  );

  const {
    mutate: openIntent,
    data: opened,
    error: refused,
    isPending: opening,
    submittedAt,
  } = useMutation({ mutationFn: openTarget });

  useEffect(() => {
    openIntent(target);
  }, [openIntent, target]);

  const intentId = opened?.id;
  const poll = useQuery({
    queryKey: ['card-intent', intentId],
    queryFn: () => paymentService.getCardIntent(intentId as number),
    enabled: intentId !== undefined,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (state === 'paid') return false;
      return state === 'expired' ? POLL_EXPIRED_MS : POLL_MS;
    },
    gcTime: 0,
  });

  const intent = poll.data ?? opened;
  const receivedAt = poll.data ? poll.dataUpdatedAt : submittedAt;

  // Feedback once per state, not on every poll that repeats it.
  const announced = useRef('');
  useEffect(() => {
    if (!intent) return;
    const key = `${intent.id}:${intent.state}`;
    if (announced.current === key) return;
    announced.current = key;
    if (intent.state === 'found') {
      triggerSoftHaptic();
    } else if (intent.state === 'paid') {
      playApplePaySound();
      triggerSuccessHaptic();
      queryClient.invalidateQueries({ queryKey: ['payment-available-flights'] });
      queryClient.invalidateQueries({ queryKey: ['payment-flight-details'] });
      queryClient.invalidateQueries({ queryKey: ['payment-history'] });
      queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
      onPaid?.(intent);
    }
  }, [intent, queryClient, onPaid]);

  if (refused && !opening) {
    return (
      <StatusBlock tone="warn" icon={AlertCircle}>
        <p className="max-w-[280px] text-[13px] font-semibold leading-relaxed text-mc-text">
          {refusalText(refused, t)}
        </p>
        <button type="button" onClick={onBack} className={`${secondaryButton} max-w-xs`}>
          {t('cardTransfer.otherMethod')}
        </button>
      </StatusBlock>
    );
  }

  if (!intent) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-mc-brand" aria-hidden="true" />
        <p className="text-[12px] font-medium text-mc-text-2">{t('cardTransfer.opening')}</p>
      </div>
    );
  }

  const full = intent.payment_mode === 'full';
  const forDelivery = intent.purpose === 'uzpost';
  // Full: the sum is over the debt by the added so'm, which go to the balance.
  const toWallet = Math.max(0, Math.round((intent.amount - intent.debt) * 100) / 100);
  const restAfter = Math.max(0, Math.round((intent.debt - intent.amount) * 100) / 100);

  if (intent.state === 'paid') {
    return (
      <StatusBlock tone="success" icon={CheckCircle2} title={t('cardTransfer.paidTitle')}>
        <p className="max-w-[280px] text-[13px] font-medium leading-relaxed text-mc-text-2">
          {forDelivery && intent.delivery_request_id
            ? t('cardTransfer.paidDeliveryDesc', {
                amount: formatSom(intent.amount),
                request: intent.delivery_request_id,
              })
            : t('cardTransfer.paidDesc', { amount: formatSom(intent.amount), flight: intent.flight_name })}
        </p>
        {full && toWallet > 0 && (
          <p className="rounded-mc-md bg-mc-success/12 px-3 py-2 text-[12px] font-semibold text-mc-text">
            {t('cardTransfer.paidToWallet', { amount: formatSom(toWallet) })}
          </p>
        )}
        <button type="button" onClick={onDone} className={`${primaryButton} max-w-xs`}>
          {t('makePayment.done')}
        </button>
      </StatusBlock>
    );
  }

  if (intent.state === 'found') {
    return (
      <StatusBlock tone="success" icon={Check} title={t('cardTransfer.foundTitle')}>
        <p className="text-[26px] font-extrabold tabular-nums text-mc-text">
          {formatSom(intent.amount)}
          <span className="ml-1.5 text-[14px] font-bold text-mc-text-2">so'm</span>
        </p>
        <p className="max-w-[290px] text-[13px] font-medium leading-relaxed text-mc-text-2">
          {t('cardTransfer.foundDesc')}
        </p>
        <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-mc-text-3">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t('cardTransfer.foundWaiting')}
        </span>
      </StatusBlock>
    );
  }

  if (intent.state === 'expired') {
    return (
      <StatusBlock tone="warn" icon={Clock} title={t('cardTransfer.expiredTitle')}>
        <p className="max-w-[290px] text-[13px] font-medium leading-relaxed text-mc-text-2">
          {t('cardTransfer.expiredDesc', { amount: formatSom(intent.amount), card: intent.card_last4 })}
        </p>
        <ReceiptNote receipt={intent.receipt} />
        <div className="flex w-full max-w-xs flex-col gap-2.5">
          <button
            type="button"
            onClick={() => openIntent(target)}
            disabled={opening}
            className={primaryButton}
          >
            {opening && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {t('cardTransfer.newRequest')}
          </button>
          <button type="button" onClick={onBack} className={secondaryButton}>
            {t('cardTransfer.otherMethod')}
          </button>
        </div>
      </StatusBlock>
    );
  }

  const cardNumber = intent.card_number ? groupCardNumber(intent.card_number) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-extrabold text-mc-text">{t('cardTransfer.title')}</h3>
        <Countdown intent={intent} receivedAt={receivedAt} />
      </div>

      <div className="rounded-mc-lg border border-white/8 bg-mc-cardface p-4 shadow-[var(--mc-shadow-card)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/55">
          {t('cardTransfer.cardNumber')}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <p className="min-w-0 text-[16px] font-bold tabular-nums tracking-[0.06em] text-white min-[360px]:text-[19px]">
            {cardNumber ?? `•••• ${intent.card_last4}`}
          </p>
          {cardNumber && (
            <CopyButton
              value={cardNumber.replace(/\s/g, '')}
              label={t('makePayment.copyCard')}
              onCard
            />
          )}
        </div>
        {intent.card_owner && (
          <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-white/60">
            {intent.card_owner}
          </p>
        )}
      </div>

      <div className="rounded-mc-lg border border-mc-border bg-mc-surface-2 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-mc-text-3">
          {t('cardTransfer.amountLabel')}
        </p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="min-w-0 text-[26px] font-extrabold leading-tight tabular-nums text-mc-text min-[360px]:text-[28px]">
            {formatSom(intent.amount)}
            <span className="ml-1.5 text-[14px] font-bold text-mc-text-2">so'm</span>
          </p>
          <CopyButton value={String(Math.round(intent.amount))} label={t('cardTransfer.copyAmount')} />
        </div>
        <p className="mt-2.5 flex items-start gap-1.5 text-[12px] font-semibold leading-snug text-mc-warn">
          <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
          {t('cardTransfer.exactWarn')}
        </p>
      </div>

      <dl className="space-y-2 rounded-mc-md border border-mc-border px-3.5 py-3 text-[13px]">
        <Row
          label={forDelivery ? t('cardTransfer.deliveryFee') : t('cardTransfer.debt')}
          value={`${formatSom(intent.debt)} so'm`}
        />
        {full ? (
          <Row
            label={t('cardTransfer.toWallet')}
            value={`${formatSom(toWallet)} so'm`}
            tone="success"
          />
        ) : (
          <Row label={t('cardTransfer.restAfter')} value={`${formatSom(restAfter)} so'm`} />
        )}
      </dl>

      <ReceiptNote receipt={intent.receipt} />

      <p className="flex items-start gap-2.5 text-[12px] font-medium leading-relaxed text-mc-text-2">
        <span className="relative mt-1.5 flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mc-brand opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-mc-brand" />
        </span>
        {t('cardTransfer.waiting')}
      </p>

      <button type="button" onClick={onBack} className={secondaryButton}>
        {t('cardTransfer.otherMethod')}
      </button>
    </div>
  );
}
