import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  courierDeliveriesKey,
  listCourierDeliveries,
  pickCourierDelivery,
  type CourierDelivery,
} from '@/api/services/courierService';
import { triggerSoftHaptic } from '@/utils/haptics';

const TZ = 'Asia/Tashkent';

interface CourierHomeCardProps {
  /** Opens the full tracking screen for this delivery. */
  onOpen: (publicId: string) => void;
}

function timeOf(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(
    date,
  );
}

function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}.${month}`;
}

/** Title and one supporting line, worded like the tracking screen's headline. */
function useLines(
  delivery: CourierDelivery,
  now: number,
): { title: string; body: string; live: boolean } {
  const { t } = useTranslation();
  if (delivery.status === 'on_the_way') {
    if (delivery.arrived_at) {
      return { title: t('courierTrack.tagArrived'), body: t('courierTrack.arrivedTitle'), live: true };
    }
    const etaMs = delivery.eta_at ? Date.parse(delivery.eta_at) : NaN;
    const time = timeOf(delivery.eta_at);
    return {
      title: t('courierTrack.tagOnTheWay'),
      // A late courier's estimate is in the past: say they are arriving.
      body:
        !time || Number.isNaN(etaMs)
          ? t('courierTrack.etaUnknown')
          : etaMs - now <= 60_000
            ? t('courierTrack.etaSoon')
            : t('courierTrack.etaAt', { time }),
      live: true,
    };
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(now));
  if (delivery.postpone_reason && delivery.delivery_date > today) {
    return {
      title: t('courierTrack.tagMoved'),
      body: t('courierTrack.movedTitle', { date: shortDate(delivery.delivery_date) }),
      live: false,
    };
  }
  return {
    title:
      delivery.delivery_date <= today
        ? t('courierTrack.tagToday')
        : t('courierTrack.tagScheduled', { date: shortDate(delivery.delivery_date) }),
    body: delivery.eta_window
      ? t('courierTrack.queueWindow', { window: delivery.eta_window })
      : delivery.position
        ? t('courierTrack.queueTitle', { position: delivery.position })
        : t('courierTrack.waitingTitle'),
    live: false,
  };
}

interface CardBodyProps {
  delivery: CourierDelivery;
  /** When the list was fetched; it is refetched every 30 s while on the way. */
  now: number;
  onOpen: (id: string) => void;
}

function CardBody({ delivery, now, onOpen }: CardBodyProps) {
  const { t } = useTranslation();
  const { title, body, live } = useLines(delivery, now);
  return (
    <div className="px-4">
      <button
        type="button"
        onClick={() => {
          triggerSoftHaptic();
          onOpen(delivery.public_id);
        }}
        className="flex w-full items-center gap-3 rounded-mc-lg border border-mc-border bg-mc-surface
                   p-3 text-left shadow-[var(--mc-shadow-card)] transition-transform duration-150
                   active:scale-[0.99]"
        aria-label={`${title}. ${body}. ${t('courierTrack.homeOpen')}`}
      >
        <span
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full
                     bg-mc-brand-soft text-mc-brand"
          aria-hidden="true"
        >
          <Truck className="h-[22px] w-[22px]" strokeWidth={2} />
          {live && (
            // The one moving thing on the home screen, and only while the
            // courier is actually driving to this client.
            <span className="absolute right-0.5 top-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mc-brand opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-mc-surface bg-mc-brand" />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-extrabold text-mc-text">{title}</span>
          <span className="mt-0.5 block truncate text-[12px] font-medium text-mc-text-2 tabular-nums">
            {body}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-[12px] font-bold text-mc-brand">
          {t('courierTrack.homeOpen')}
          <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}

/**
 * A way back to the courier map from the home screen. Without it the tracking
 * screen was reachable only from the bot message, so a client who lost that
 * message could not find their courier.
 *
 * Renders nothing while loading, on error, and when no delivery is open: most
 * clients never have one, and a placeholder would push the page down for them.
 */
export function CourierHomeCard({ onOpen }: CourierHomeCardProps) {
  const { data, dataUpdatedAt } = useQuery({
    queryKey: courierDeliveriesKey,
    queryFn: listCourierDeliveries,
    staleTime: 10_000,
    // Poll only while the courier is driving here; the ETA line changes then.
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.status === 'on_the_way') ? 30_000 : false,
  });
  const delivery = data ? pickCourierDelivery(data) : null;
  if (!delivery) return null;
  return <CardBody delivery={delivery} now={dataUpdatedAt} onOpen={onOpen} />;
}
