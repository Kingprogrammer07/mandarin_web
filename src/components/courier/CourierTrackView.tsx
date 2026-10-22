import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  CircleCheck,
  Loader2,
  Lock,
  MapPinOff,
  PackageCheck,
  PackageX,
  Phone,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  courierDeliveryKey,
  getCourierDelivery,
  payCourierOnline,
  type CourierDelivery,
  type CourierPayMethod,
} from '@/api/services/courierService';
import { formatUzsAmount } from '@/lib/format';
import { triggerSoftHaptic } from '@/utils/haptics';
import { openNbuUrl } from '@/utils/nbuReturnContext';

const CourierLiveMap = lazy(() => import('./CourierLiveMap'));

const TZ = 'Asia/Tashkent';
/** How far the sheet's rounded edge reaches over the map, px. */
const SHEET_OVERLAP = 22;
/**
 * Its own full-screen layer over the app shell: the client tab bar is fixed at
 * z-40 and would otherwise sit on the sheet, as in the design it does not.
 */
const LAYER = 'fixed inset-0 z-50 isolate bg-mc-bg';
/** A fix older than this is shown as "last seen", not as live. */
const LIVE_FOR_MS = 90_000;

interface CourierTrackViewProps {
  publicId: string;
  onClose: () => void;
}

function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

function errorStatus(error: unknown): number | undefined {
  const e = error as { status?: number; response?: { status?: number } } | null;
  return e?.status ?? e?.response?.status;
}

function timeOf(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** YYYY-MM-DD of today in Tashkent, comparable with `delivery_date`. */
function tashkentToday(now: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(now));
}

function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}.${month}`;
}

function flightsOf(delivery: CourierDelivery): string {
  const names = delivery.items.map((i) => i.flight_name).filter((n): n is string => !!n);
  return [...new Set(names)].join(', ');
}

type Tone = 'brand' | 'success' | 'warn' | 'neutral';

const TONE_CLASS: Record<Tone, string> = {
  brand: 'bg-mc-brand-soft text-mc-brand',
  success: 'bg-mc-success/12 text-mc-success',
  warn: 'bg-mc-warn-soft text-mc-warn',
  neutral: 'bg-mc-surface-2 text-mc-text-2',
};

function Tag({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-[26px] items-center self-start rounded-mc-sm px-2.5 text-[13px] font-extrabold ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

function BackButton({ onClose, floating }: { onClose: () => void; floating?: boolean }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => {
        triggerSoftHaptic();
        onClose();
      }}
      aria-label={t('common.back')}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-md text-mc-text transition-transform active:scale-95 ${
        floating ? 'bg-mc-surface shadow-[var(--mc-shadow-card)]' : 'bg-mc-surface-2'
      }`}
    >
      <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

/** Set off → on the way → delivered, with the time under each step. */
function Steps({ delivery, now }: { delivery: CourierDelivery; now: number }) {
  const { t } = useTranslation();
  const stage = delivery.status === 'delivered' ? 2 : delivery.status === 'on_the_way' ? 1 : 0;
  // A late courier's estimate is in the past; the headline already says
  // "arriving", so the step shows no stale time.
  const etaMs = delivery.eta_at ? Date.parse(delivery.eta_at) : NaN;
  const eta = etaMs > now ? timeOf(delivery.eta_at) : null;
  const steps = [
    { label: t('courierTrack.stepDeparted'), meta: timeOf(delivery.departed_at) ?? '—' },
    { label: t('courierTrack.stepOnTheWay'), meta: '' },
    {
      label: t('courierTrack.stepDelivered'),
      meta: timeOf(delivery.delivered_at) ?? (eta ? `~${eta}` : '—'),
    },
  ];

  const dot = (index: number) => {
    if (index < stage || stage === 2) {
      return (
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-mc-text-3 text-mc-surface">
          <Check className="h-2.5 w-2.5" strokeWidth={3.6} aria-hidden="true" />
        </span>
      );
    }
    if (index === stage && stage === 1) {
      return (
        <span className="h-[18px] w-[18px] shrink-0 rounded-full bg-mc-brand ring-4 ring-mc-brand/20" />
      );
    }
    return <span className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-mc-border bg-mc-surface" />;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center px-0.5" aria-hidden="true">
        {dot(0)}
        <span className={`h-[3px] flex-1 ${stage >= 1 ? 'bg-mc-text-3' : 'bg-mc-border'}`} />
        {dot(1)}
        <span className={`h-[3px] flex-1 ${stage >= 2 ? 'bg-mc-text-3' : 'bg-mc-border'}`} />
        {dot(2)}
      </div>
      <ol className="grid grid-cols-3 tabular-nums">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={`flex min-w-0 flex-col gap-px ${
              index === 1 ? 'items-center text-center' : index === 2 ? 'items-end text-right' : ''
            }`}
          >
            <span
              className={`text-[13px] ${
                index === stage && stage === 1
                  ? 'font-extrabold text-mc-brand'
                  : index <= stage || stage === 2
                    ? 'font-bold text-mc-text'
                    : 'font-bold text-mc-text-2'
              }`}
            >
              {step.label}
            </span>
            {step.meta && <span className="text-[12px] font-semibold text-mc-text-2">{step.meta}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function CourierRow({ delivery, name }: { delivery: CourierDelivery; name: string }) {
  const { t } = useTranslation();
  const phone = delivery.courier_phone?.replace(/[^\d+]/g, '');
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mc-surface-2 text-[17px] font-extrabold text-mc-text"
      >
        {name.trim().charAt(0).toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-extrabold text-mc-text">{name}</span>
        <span className="break-words text-[13px] font-semibold text-mc-text-2">
          {delivery.courier_car ?? t('courierTrack.courierRole')}
        </span>
      </div>
      {phone && (
        <a
          href={`tel:${phone}`}
          onClick={() => triggerSoftHaptic()}
          aria-label={t('courierTrack.call')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-md bg-mc-surface-2 text-mc-text transition-transform active:scale-95"
        >
          <Phone className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

function methodName(t: (key: string) => string, method: CourierPayMethod): string {
  return t(`courierTrack.pay.method.${method}`);
}

function errorText(error: unknown, fallback: string): string {
  const e = error as { message?: string; data?: { detail?: unknown } } | null;
  const detail = e?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return e?.message || fallback;
}

/**
 * The delivery fee: what it is, how it stands, and — once the courier is at
 * the door and online payment is on — the NBU button. Cash and card are taken
 * by the courier, so for those this only says what to have ready.
 */
function PaymentCard({ delivery }: { delivery: CourierDelivery }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const amount = t('courierTrack.pay.amount', { amount: formatUzsAmount(delivery.fee_uzs) });
  const pay = useMutation({
    mutationFn: () => payCourierOnline(delivery.public_id),
    onSuccess: (res) => {
      openNbuUrl({
        orderId: res.order_id,
        kind: 'payment',
        paymentUrl: res.payment_url,
        homePath: `/user/home?courier=${encodeURIComponent(delivery.public_id)}`,
      });
      void queryClient.invalidateQueries({ queryKey: courierDeliveryKey(delivery.public_id) });
    },
    onError: (error) => toast.error(errorText(error, t('courierTrack.pay.error'))),
  });

  let tag: ReactNode = null;
  let note: string;
  if (delivery.paid_at) {
    tag = (
      <Tag tone="success">
        <CircleCheck className="mr-1 h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
        {t('courierTrack.pay.paidTag')}
      </Tag>
    );
    note = delivery.payment_method
      ? t('courierTrack.pay.paidWith', { method: methodName(t, delivery.payment_method) })
      : t('courierTrack.pay.paidTag');
  } else if (delivery.online_pending) {
    tag = <Tag tone="warn">{t('courierTrack.pay.pendingTag')}</Tag>;
    note = t('courierTrack.pay.pending');
  } else if (delivery.can_pay_online) {
    note = t('courierTrack.pay.atDoorOnline');
  } else if (delivery.arrived_at) {
    note = t('courierTrack.pay.atDoor');
  } else {
    note = t('courierTrack.pay.later');
  }
  const choice =
    !delivery.paid_at && delivery.payment_choice && delivery.payment_choice !== 'nbu'
      ? t('courierTrack.pay.yourChoice', { method: methodName(t, delivery.payment_choice) })
      : null;
  const showButton = !delivery.paid_at && (delivery.can_pay_online || delivery.online_pending);

  return (
    <div className="flex flex-col gap-3 rounded-mc-lg border border-mc-border px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[12px] font-semibold text-mc-text-2">{t('courierTrack.pay.title')}</span>
          <span className="text-[17px] font-extrabold text-mc-text tabular-nums">{amount}</span>
        </div>
        {tag}
      </div>
      <p className="text-[13px] font-semibold leading-[19px] text-mc-text-2">
        {note}
        {choice && <span className="mt-0.5 block text-mc-text">{choice}</span>}
      </p>
      {showButton && (
        <button
          type="button"
          disabled={pay.isPending}
          onClick={() => {
            triggerSoftHaptic();
            pay.mutate();
          }}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-mc-md px-4 text-[15px] font-extrabold transition-transform active:scale-[0.98] disabled:opacity-60 ${
            delivery.online_pending
              ? 'bg-mc-surface-2 text-mc-text'
              : 'bg-mc-brand text-mc-on-brand shadow-[var(--mc-shadow-cta)]'
          }`}
        >
          {pay.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          <span className="truncate">
            {delivery.online_pending
              ? t('courierTrack.pay.reopen')
              : t('courierTrack.pay.button', { amount })}
          </span>
        </button>
      )}
    </div>
  );
}

function CargoCard({ delivery }: { delivery: CourierDelivery }) {
  const { t } = useTranslation();
  const flights = flightsOf(delivery);
  return (
    <div className="flex flex-col gap-0.5 rounded-mc-lg border border-mc-border px-3.5 py-3">
      <span className="text-[12px] font-semibold text-mc-text-2">{t('courierTrack.cargo')}</span>
      <span className="text-[17px] font-extrabold text-mc-text tabular-nums">
        {t('courierTrack.cargoCount', { count: delivery.items.length })}
      </span>
      {flights && <span className="break-words font-mono text-[12px] text-mc-text-2">{flights}</span>}
    </div>
  );
}

/** The headline block: what is happening, in one large line and one small. */
function Headline({ delivery, now }: { delivery: CourierDelivery; now: number }) {
  const { t } = useTranslation();
  const today = tashkentToday(now);

  if (delivery.status === 'on_the_way' && delivery.arrived_at) {
    const time = timeOf(delivery.arrived_at);
    return (
      <div className="flex flex-col gap-1">
        <Tag tone="brand">{t('courierTrack.tagArrived')}</Tag>
        <span className="mt-1.5 text-[24px] font-extrabold leading-8 tracking-[-0.02em] text-mc-text">
          {t('courierTrack.arrivedTitle')}
        </span>
        {time && (
          <span className="text-[15px] font-semibold text-mc-text-2 tabular-nums">
            {t('courierTrack.arrivedAt', { time })}
          </span>
        )}
      </div>
    );
  }

  if (delivery.status === 'on_the_way') {
    const etaMs = delivery.eta_at ? Date.parse(delivery.eta_at) : NaN;
    const minutes = Number.isNaN(etaMs) ? null : Math.ceil((etaMs - now) / 60_000);
    const time = timeOf(delivery.eta_at);
    return (
      <div className="flex flex-col gap-1">
        <Tag tone="brand">{t('courierTrack.tagOnTheWay')}</Tag>
        <span className="mt-1.5 text-[28px] font-extrabold leading-9 tracking-[-0.02em] text-mc-text tabular-nums">
          {minutes === null
            ? t('courierTrack.etaUnknown')
            : minutes <= 1
              ? t('courierTrack.etaSoon')
              : t('courierTrack.etaMinutes', { count: minutes })}
        </span>
        {time && minutes !== null && minutes > 1 && (
          <span className="text-[15px] font-semibold text-mc-text-2 tabular-nums">
            {t('courierTrack.etaAt', { time })}
          </span>
        )}
      </div>
    );
  }

  if (delivery.status === 'waiting') {
    const moved = !!delivery.postpone_reason && delivery.delivery_date > today;
    if (moved) {
      return (
        <div className="flex flex-col gap-1">
          <Tag tone="warn">{t('courierTrack.tagMoved')}</Tag>
          <span className="mt-1.5 text-[20px] font-extrabold leading-7 text-mc-text">
            {t('courierTrack.movedTitle', { date: shortDate(delivery.delivery_date) })}
          </span>
          <span className="text-[15px] font-semibold text-mc-text-2">
            {t('courierTrack.movedReason', { reason: delivery.postpone_reason })}
          </span>
        </div>
      );
    }
    const isToday = delivery.delivery_date <= today;
    return (
      <div className="flex flex-col gap-1">
        <Tag tone={isToday ? 'brand' : 'neutral'}>
          {isToday
            ? t('courierTrack.tagToday')
            : t('courierTrack.tagScheduled', { date: shortDate(delivery.delivery_date) })}
        </Tag>
        <span className="mt-1.5 text-[20px] font-extrabold leading-7 text-mc-text">
          {delivery.position
            ? t('courierTrack.queueTitle', { position: delivery.position })
            : t('courierTrack.waitingTitle')}
        </span>
        <span className="text-[15px] font-semibold text-mc-text-2 tabular-nums">
          {delivery.eta_window
            ? t('courierTrack.queueWindow', { window: delivery.eta_window })
            : t('courierTrack.waitingBody')}
        </span>
      </div>
    );
  }

  if (delivery.status === 'delivered') {
    const time = timeOf(delivery.delivered_at);
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mc-success/12 text-mc-success">
          <PackageCheck className="h-7 w-7" aria-hidden="true" />
        </span>
        <span className="text-[20px] font-extrabold leading-7 text-mc-text">
          {t('courierTrack.deliveredTitle')}
        </span>
        {time && (
          <span className="text-[15px] font-semibold text-mc-text-2 tabular-nums">
            {t('courierTrack.deliveredAt', { time })}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mc-surface-2 text-mc-text-2">
        <PackageX className="h-7 w-7" aria-hidden="true" />
      </span>
      <span className="text-[20px] font-extrabold leading-7 text-mc-text">
        {t('courierTrack.cancelledTitle')}
      </span>
      <span className="text-[15px] font-semibold text-mc-text-2">{t('courierTrack.cancelledBody')}</span>
    </div>
  );
}

/** "Live, 5 s ago" over the map, or why the courier is not on it. */
function LivePill({ delivery, now }: { delivery: CourierDelivery; now: number }) {
  const { t } = useTranslation();
  let text: string;
  let live = false;
  if (delivery.status !== 'on_the_way') {
    text = t('courierTrack.pillNotYet');
  } else if (!delivery.courier) {
    text = t('courierTrack.liveWaiting');
  } else {
    const age = Math.max(0, now - Date.parse(delivery.courier.recorded_at));
    live = age < LIVE_FOR_MS;
    text = live
      ? age < 15_000
        ? t('courierTrack.liveJustNow')
        : t('courierTrack.liveSecondsAgo', { seconds: Math.round(age / 1000) })
      : t('courierTrack.liveStale', { minutes: Math.max(1, Math.round(age / 60_000)) });
  }
  return (
    <div
      role="status"
      className="flex h-9 min-w-0 items-center gap-2 rounded-full bg-mc-surface px-3 text-[13px] font-bold text-mc-text shadow-[var(--mc-shadow-card)]"
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${live ? 'bg-mc-brand ring-4 ring-mc-brand/20' : 'bg-mc-text-3'}`}
      />
      <span className="truncate">{text}</span>
    </div>
  );
}

function Details({ delivery, now }: { delivery: CourierDelivery; now: number }) {
  const { t } = useTranslation();
  const showSteps = delivery.status === 'on_the_way' || delivery.status === 'delivered';
  return (
    <div className="flex flex-col gap-4">
      <Headline delivery={delivery} now={now} />
      {showSteps && <Steps delivery={delivery} now={now} />}
      {delivery.courier_name && (delivery.status === 'on_the_way' || delivery.status === 'delivered') && (
        <>
          <div className="h-px bg-mc-border" />
          <CourierRow delivery={delivery} name={delivery.courier_name} />
        </>
      )}
      {delivery.fee_uzs > 0 &&
        (delivery.status === 'waiting' || delivery.status === 'on_the_way' || !!delivery.paid_at) && (
          <PaymentCard delivery={delivery} />
        )}
      {delivery.items.length > 0 && <CargoCard delivery={delivery} />}
      {delivery.address && (
        <p className="text-[13px] font-semibold text-mc-text-2">{delivery.address}</p>
      )}
      {(delivery.status === 'waiting' || delivery.status === 'on_the_way') && (
        <p className="flex items-start gap-2 text-[13px] font-semibold leading-[19px] text-mc-text-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('courierTrack.privacy')}
        </p>
      )}
    </div>
  );
}

function Centered({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className={`${LAYER} overflow-y-auto overscroll-contain`}>
      <div className="mx-auto flex min-h-full max-w-lg flex-col px-4 pt-2.5 pb-[calc(24px+env(safe-area-inset-bottom))]">
        <BackButton onClose={onClose} />
        <div className="flex flex-1 flex-col justify-center py-8">{children}</div>
      </div>
    </div>
  );
}

/**
 * The client's courier delivery, opened from the bot's "Xaritada kuzatish".
 *
 * The courier's position comes over the app-wide event stream (see
 * `useGlobalEvents`), patched straight into this query; the 30 s refetch is
 * only the fallback for a dropped stream. The courier is on the map only while
 * driving to this client — the server sends nothing otherwise — and the map is
 * gone once the cargo is handed over.
 */
export function CourierTrackView({ publicId, onClose }: CourierTrackViewProps) {
  const { t } = useTranslation();
  const now = useNow(5_000);
  const query = useQuery({
    queryKey: courierDeliveryKey(publicId),
    queryFn: () => getCourierDelivery(publicId),
    refetchInterval: (q) => {
      const data = q.state.data;
      const status = data?.status;
      // At the door a payment can land any second; show it without a pull.
      if (status === 'on_the_way' && data?.arrived_at && !data.paid_at) return 8_000;
      if (status === 'on_the_way') return 30_000;
      if (status === 'waiting') return 60_000;
      return false;
    },
    retry: (count, error) => errorStatus(error) !== 404 && count < 2,
  });

  if (query.isPending) {
    return (
      <Centered onClose={onClose}>
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-mc-text-3" aria-label={t('common.loading')} />
      </Centered>
    );
  }

  if (query.isError) {
    const missing = errorStatus(query.error) === 404;
    return (
      <Centered onClose={onClose}>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-[17px] font-extrabold text-mc-text">
            {missing ? t('courierTrack.notFoundTitle') : t('courierTrack.loadError')}
          </span>
          {missing ? (
            <span className="text-[13px] font-semibold text-mc-text-2">{t('courierTrack.notFoundBody')}</span>
          ) : (
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="mt-2 h-11 rounded-mc-md bg-mc-surface-2 px-5 text-[15px] font-bold text-mc-text active:scale-[0.98]"
            >
              {t('common.retry')}
            </button>
          )}
        </div>
      </Centered>
    );
  }

  const delivery = query.data;
  const home =
    delivery.latitude !== null && delivery.longitude !== null
      ? { latitude: delivery.latitude, longitude: delivery.longitude }
      : null;
  const open = delivery.status === 'waiting' || delivery.status === 'on_the_way';
  // The map is for today's run; a delivery moved to another day has nothing to show on it.
  const mapToday =
    delivery.status === 'on_the_way' ||
    (delivery.status === 'waiting' && delivery.delivery_date <= tashkentToday(now));

  if (!open || !home || !mapToday) {
    return (
      <Centered onClose={onClose}>
        <Details delivery={delivery} now={now} />
        {open && !home && (
          <p className="mt-4 flex items-start gap-2 rounded-mc-md bg-mc-warn-soft p-3 text-[13px] font-semibold text-mc-warn">
            <MapPinOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {t('courierTrack.noPin')}
          </p>
        )}
      </Centered>
    );
  }

  const courier =
    delivery.status === 'on_the_way' && delivery.courier
      ? {
          latitude: delivery.courier.latitude,
          longitude: delivery.courier.longitude,
          heading: delivery.courier.heading,
        }
      : null;

  return (
    <div className={`${LAYER} overflow-hidden`}>
      <div className="relative mx-auto h-full max-w-lg">
        <div className="absolute inset-x-0 top-0 h-[48dvh]">
          <Suspense fallback={<div className="h-full w-full bg-mc-surface-2" />}>
            <CourierLiveMap
              home={home}
              homeLabel={t('courierTrack.homeLabel')}
              courier={courier}
              courierName={delivery.courier_name}
              bottomInset={SHEET_OVERLAP}
            />
          </Suspense>
        </div>

        <div className="absolute inset-x-4 top-[max(10px,env(safe-area-inset-top))] z-[1000] flex items-center gap-2">
          <BackButton onClose={onClose} floating />
          <LivePill delivery={delivery} now={now} />
        </div>

        <section
          aria-label={t('courierTrack.sheetLabel')}
          className="absolute inset-x-0 bottom-0 z-[1000] flex flex-col rounded-t-mc-xl border-t border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]"
          style={{ top: `calc(48dvh - ${SHEET_OVERLAP}px)` }}
        >
          <div className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-mc-border" aria-hidden="true" />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(24px+env(safe-area-inset-bottom))]">
            <Details delivery={delivery} now={now} />
          </div>
        </section>
      </div>
    </div>
  );
}

export default CourierTrackView;
