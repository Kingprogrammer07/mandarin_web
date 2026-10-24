import { lazy, Suspense, useCallback, useMemo, useState, type ChangeEvent, type MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleParking,
  CirclePause,
  Flag,
  MapPin,
  Navigation,
  Phone,
  Play,
  RefreshCw,
  Square,
  TriangleAlert,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';

import {
  courierMonitorKeys,
  courierMonitorService,
  type MonitorLiveCourier,
  type MonitorTrack,
} from '@/api/services/courierMonitor';
import { SectionCard } from '@/components/admin/dashboard/DashboardPrimitives';
import { getTashkentDateIso } from '@/lib/format';
import {
  clockTashkent,
  COURIER_STATE_LABEL,
  courierName,
  courierState,
  dayLabel,
  dayTimeline,
  formatKm,
  formatMinutes,
  lastSeen,
  momentTashkent,
  shiftDay,
  shiftSpan,
  sortCouriers,
  stoodMinutes,
  type CourierState,
  type TimelineEvent,
} from '@/lib/courierMonitor';
import { triggerSoftHaptic } from '@/utils/haptics';
import type { MapFocus } from './CourierMonitorMap';

// Leaflet is ~150 kB; only this page needs it.
const CourierMonitorMap = lazy(() => import('./CourierMonitorMap'));

const LIVE_REFRESH_MS = 15_000;
const TRACK_REFRESH_MS = 30_000;

const STATE_TONE: Record<CourierState, string> = {
  on_route: 'bg-mc-brand-soft text-mc-brand',
  returning: 'bg-mc-brand-soft text-mc-brand',
  on_shift: 'bg-mc-success/12 text-mc-success',
  finished: 'bg-mc-surface-2 text-mc-text-2',
  off: 'bg-mc-surface-2 text-mc-text-3',
};

const STATE_DOT: Record<CourierState, string> = {
  on_route: 'bg-mc-brand',
  returning: 'bg-mc-brand',
  on_shift: 'bg-mc-success',
  finished: 'bg-mc-text-3',
  off: 'bg-mc-text-3',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

function StateTag({ state }: { state: CourierState }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${STATE_TONE[state]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[state]}`} aria-hidden="true" />
      {COURIER_STATE_LABEL[state]}
    </span>
  );
}

function CourierRow({
  courier,
  selected,
  onSelect,
}: {
  courier: MonitorLiveCourier;
  selected: boolean;
  onSelect: () => void;
}) {
  const state = courierState(courier);
  const name = courierName(courier);
  const run = courier.run;
  const position = courier.position;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`flex w-full items-start gap-3 rounded-mc-md border px-3 py-2.5 text-left transition-[transform,background-color] active:scale-[0.99] ${
          selected ? 'border-mc-brand/40 bg-mc-brand-soft' : 'border-transparent bg-transparent'
        }`}
      >
        <span className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mc-surface-2 text-[13px] font-extrabold text-mc-text-2">
          {initials(name)}
          {courier.tracking && (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-mc-surface bg-mc-success"
              aria-hidden="true"
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="break-words text-[13px] font-extrabold text-mc-text">{name}</span>
            <StateTag state={state} />
            {!courier.is_active && (
              <span className="rounded-full bg-mc-danger-soft px-2 py-0.5 text-[11px] font-extrabold text-mc-danger">
                O'chirilgan
              </span>
            )}
          </span>
          {courier.heading_to && (
            <span className="mt-1 block break-words text-[12px] font-semibold text-mc-text-2">
              → {courier.heading_to.name}
              {courier.heading_to.eta_at && ` · ~${clockTashkent(courier.heading_to.eta_at)}`}
            </span>
          )}
          <span className="mt-0.5 block text-[11px] font-medium text-mc-text-3">
            {position
              ? position.live
                ? `GPS: ${lastSeen(position.recorded_at)}`
                : `Oxirgi joy: ${lastSeen(position.recorded_at)}`
              : "Joylashuv hali kelmagan"}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[13px] font-extrabold tabular-nums text-mc-text">
            {run?.driven_m != null ? formatKm(run.driven_m) : '—'}
          </span>
          {run && (
            <span className="mt-0.5 block text-[11px] font-semibold tabular-nums text-mc-text-3">
              {run.delivered}/{run.delivered + run.open} yetkazildi
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function CourierList({
  couriers,
  unassigned,
  isLoading,
  isError,
  isFetching,
  updatedAt,
  selectedId,
  onSelect,
  onRetry,
}: {
  couriers: MonitorLiveCourier[];
  unassigned: number;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  updatedAt: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onRetry: () => void;
}) {
  const onRoad = couriers.filter((c) => c.tracking).length;
  return (
    <SectionCard
      title="Kuryerlar"
      subtitle={
        updatedAt
          ? `${onRoad} tasi hozir ishda · ${clockTashkent(updatedAt)} da yangilandi`
          : 'Har 15 soniyada yangilanadi'
      }
      bodyClassName="px-2 pb-2 pt-2"
    >
      {unassigned > 0 && (
        <div className="mx-2 mb-2 flex items-start gap-2 rounded-mc-md bg-mc-warn-soft px-3 py-2.5 text-[12px] font-semibold text-mc-warn">
          <TriangleAlert className="mt-px h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
          <span>Skladda {unassigned} ta manzil kutmoqda: hali hech bir kuryer olib ketmagan.</span>
        </div>
      )}
      {isLoading && (
        <div className="space-y-2 px-2 pb-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-mc-md bg-mc-surface-2" />
          ))}
        </div>
      )}
      {isError && !isLoading && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2">
          <p className="text-[12px] font-semibold text-mc-danger">Kuryerlar ro'yxati olinmadi.</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-mc-sm px-3 text-[12px] font-bold text-mc-brand active:scale-95"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
            Qayta urinish
          </button>
        </div>
      )}
      {!isLoading && !isError && couriers.length === 0 && (
        <p className="px-2 pb-2 text-[12px] font-medium text-mc-text-2">
          Kuryer akkaunti yo'q. «Adminlar» bo'limida «Kuryer» roli bilan akkaunt yarating.
        </p>
      )}
      {couriers.length > 0 && (
        <ul className="space-y-1">
          {couriers.map((courier) => (
            <CourierRow
              key={courier.id}
              courier={courier}
              selected={courier.id === selectedId}
              onSelect={() => {
                triggerSoftHaptic();
                onSelect(courier.id);
              }}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function DateStepper({
  date,
  today,
  onChange,
}: {
  date: string;
  today: string;
  onChange: (next: string) => void;
}) {
  const isToday = date === today;
  const step = (delta: number) => {
    triggerSoftHaptic();
    onChange(shiftDay(date, delta));
  };
  const openPicker = (event: MouseEvent<HTMLInputElement>) => {
    // Desktop Chrome only opens the calendar from its own icon; the field is
    // invisible here, so open it from anywhere on the label.
    try {
      event.currentTarget.showPicker?.();
    } catch {
      // Already open, or the browser refuses outside a user gesture: the
      // native field still takes the click.
    }
  };
  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    // iOS «Clear» sends an empty value; a future day has nothing to show.
    if (!value) return;
    onChange(value > today ? today : value);
  };
  const stepClass =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-md border border-mc-border bg-mc-surface text-mc-text transition-transform active:scale-95 disabled:opacity-40';
  return (
    <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto">
      <button type="button" onClick={() => step(-1)} aria-label="Oldingi kun" className={stepClass}>
        <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden="true" />
      </button>
      <label className="relative flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 text-[13px] font-extrabold text-mc-text sm:w-[168px] sm:flex-none">
        <CalendarDays className="h-4 w-4 shrink-0 text-mc-text-3" strokeWidth={2.2} aria-hidden="true" />
        <span className="whitespace-nowrap tabular-nums">{isToday ? 'Bugun' : dayLabel(date)}</span>
        <input
          type="date"
          value={date}
          max={today}
          onChange={pick}
          onClick={openPicker}
          aria-label="Sana"
          className="absolute inset-0 h-full w-full cursor-pointer text-base opacity-0"
        />
      </label>
      <button type="button" onClick={() => step(1)} disabled={isToday} aria-label="Keyingi kun" className={stepClass}>
        <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  );
}

function LegendSwatch({ kind, label }: { kind: 'trail' | 'gap' | 'stay' | 'delivered' | 'open' | 'office'; label: string }) {
  const swatch = {
    trail: <span className="h-1 w-5 rounded-full bg-mc-brand" />,
    gap: <span className="h-0 w-5 border-t-[3px] border-dotted border-mc-text-2" />,
    stay: <span className="h-3 w-3 rounded-full bg-mc-warn ring-2 ring-mc-surface" />,
    delivered: <span className="h-3 w-3 rounded-full bg-mc-success" />,
    open: <span className="h-3 w-3 rounded-full border-[3px] border-mc-brand bg-mc-surface" />,
    office: <span className="h-3 w-3 rounded-full bg-mc-brand ring-2 ring-mc-surface" />,
  }[kind];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-mc-text-2">
      <span className="flex w-5 items-center justify-center" aria-hidden="true">
        {swatch}
      </span>
      {label}
    </span>
  );
}

function MapPanel({
  courier,
  date,
  today,
  onDateChange,
  track,
  trackLoading,
  trackError,
  couriers,
  selectedId,
  onSelect,
  focus,
}: {
  courier: MonitorLiveCourier | null;
  date: string;
  today: string;
  onDateChange: (next: string) => void;
  track: MonitorTrack | null;
  trackLoading: boolean;
  trackError: boolean;
  couriers: MonitorLiveCourier[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  focus: MapFocus | null;
}) {
  const name = courier ? courierName(courier) : 'Kuryer tanlanmagan';
  const mapFallback = <div className="h-full w-full animate-pulse bg-mc-surface-2" />;
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-mc-lg border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 px-4 py-3">
        <div className="flex min-w-0 flex-[1_1_220px] items-center gap-2">
          <div className="min-w-0">
            <h2 className="break-words text-[15px] font-extrabold tracking-tight text-mc-text">{name}</h2>
            {courier?.car && <p className="mt-0.5 break-words text-[11px] font-medium text-mc-text-3">{courier.car}</p>}
            {courier?.consent_at && (
              <p className="mt-0.5 text-[11px] font-medium text-mc-text-3">
                Joylashuvga rozilik: {momentTashkent(courier.consent_at)}
              </p>
            )}
            {courier?.consent_at === null && (
              <p className="mt-1 inline-flex rounded-full bg-mc-warn-soft px-2 py-0.5 text-[11px] font-bold text-mc-warn">
                Ilovada rozilik hali berilmagan
              </p>
            )}
          </div>
          {courier?.phone && (
            <a
              href={`tel:${courier.phone}`}
              aria-label={`Qo'ng'iroq: ${courier.phone}`}
              title={courier.phone}
              className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-md border border-mc-border text-mc-text transition-transform active:scale-95 sm:ml-0"
            >
              <Phone className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
            </a>
          )}
        </div>
        <DateStepper date={date} today={today} onChange={onDateChange} />
      </div>

      <div className="relative h-[56dvh] min-h-[320px] max-h-[560px] border-y border-mc-border xl:h-[min(680px,calc(100dvh-260px))] xl:max-h-none">
        <Suspense fallback={mapFallback}>
          <CourierMonitorMap
            track={track}
            couriers={date === today ? couriers : []}
            selectedId={selectedId}
            onSelect={onSelect}
            focus={focus}
            frameKey={`${selectedId ?? 'none'}:${date}`}
          />
        </Suspense>
        {(trackLoading || trackError) && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center px-16">
            <span
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold shadow-[var(--mc-shadow-card)] ${
                trackError ? 'bg-mc-danger-soft text-mc-danger' : 'bg-mc-surface text-mc-text-2'
              }`}
            >
              {trackError ? "Kun ma'lumoti olinmadi" : 'Yuklanmoqda…'}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-3">
        <LegendSwatch kind="trail" label="Yurgan yo'li" />
        <LegendSwatch kind="stay" label="Turgan joyi" />
        <LegendSwatch kind="gap" label="GPS uzilgan" />
        <LegendSwatch kind="delivered" label="Yetkazildi" />
        <LegendSwatch kind="open" label="Kutmoqda" />
        <LegendSwatch kind="office" label="Ofis" />
      </div>
    </section>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-2.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-mc-text-3">{label}</p>
      <p className="mt-1 break-words text-[17px] font-extrabold leading-tight tracking-tight tabular-nums text-mc-text">
        {value}
      </p>
      {note && <p className="mt-0.5 break-words text-[11px] font-medium text-mc-text-3">{note}</p>}
    </div>
  );
}

interface EventView {
  Icon: LucideIcon;
  tone: string;
  title: string;
  meta: string | null;
  time: string;
  focus: { latitude: number; longitude: number } | null;
}

function viewOf(event: TimelineEvent): EventView {
  const time = clockTashkent(event.at);
  switch (event.kind) {
    case 'shift_start':
      return { Icon: Play, tone: 'bg-mc-success/12 text-mc-success', title: 'Ish boshlandi', meta: null, time, focus: null };
    case 'route_start':
      return { Icon: Navigation, tone: 'bg-mc-brand-soft text-mc-brand', title: "Yo'lga chiqdi", meta: null, time, focus: null };
    case 'route_end':
      return { Icon: Flag, tone: 'bg-mc-brand-soft text-mc-brand', title: 'Kunni yakunladi', meta: null, time, focus: null };
    case 'shift_end':
      return { Icon: Square, tone: 'bg-mc-surface-2 text-mc-text-2', title: 'Ish tugadi', meta: null, time, focus: null };
    case 'break': {
      const minutes = (new Date(event.endedAt).getTime() - new Date(event.at).getTime()) / 60_000;
      return {
        Icon: CirclePause,
        tone: 'bg-mc-surface-2 text-mc-text-2',
        title: `Smena to'xtatildi · ${formatMinutes(minutes)}`,
        meta: `${time}–${clockTashkent(event.endedAt)} · bu vaqt km'ga kirmaydi`,
        time,
        focus: null,
      };
    }
    case 'stay': {
      const where =
        event.place?.type === 'office'
          ? 'Ofisda'
          : event.place?.type === 'stop'
            ? `${event.place.name} manzili yonida`
            : 'Manzillardan uzoqda';
      return {
        Icon: CircleParking,
        tone: 'bg-mc-warn-soft text-mc-warn',
        title: `Turdi · ${formatMinutes(event.minutes)}`,
        meta: `${where} · ${time}–${clockTashkent(event.endedAt)}`,
        time,
        focus: { latitude: event.latitude, longitude: event.longitude },
      };
    }
    case 'gap': {
      const minutes = (new Date(event.endedAt).getTime() - new Date(event.at).getTime()) / 60_000;
      return {
        Icon: WifiOff,
        tone: 'bg-mc-surface-2 text-mc-text-2',
        title: `GPS signal yo'q · ${formatMinutes(minutes)}`,
        meta: `${formatKm(event.distanceM)} yo'l bo'yicha qo'shildi`,
        time,
        focus: { latitude: event.latitude, longitude: event.longitude },
      };
    }
    case 'delivered':
      return {
        Icon: CircleCheck,
        tone: 'bg-mc-success/12 text-mc-success',
        title: `Yetkazildi: ${event.name}`,
        meta: event.address,
        time,
        focus:
          event.latitude !== null && event.longitude !== null
            ? { latitude: event.latitude, longitude: event.longitude }
            : null,
      };
  }
}

function TimelineRow({ event, onFocus }: { event: TimelineEvent; onFocus: (point: { latitude: number; longitude: number }) => void }) {
  const view = viewOf(event);
  const body = (
    <>
      <span className="w-11 shrink-0 pt-2 text-[12px] font-bold tabular-nums text-mc-text-2">{view.time}</span>
      <span className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${view.tone}`}>
        <view.Icon className="h-4 w-4" strokeWidth={2.3} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 pt-1.5">
        <span className="block break-words text-[13px] font-bold text-mc-text">{view.title}</span>
        {view.meta && <span className="mt-0.5 block break-words text-[11px] font-medium text-mc-text-3">{view.meta}</span>}
      </span>
      {view.focus && (
        <MapPin className="mt-2 h-4 w-4 shrink-0 text-mc-brand" strokeWidth={2.3} aria-hidden="true" />
      )}
    </>
  );
  const rowClass = 'flex w-full items-start gap-2.5 rounded-mc-sm px-2 py-1.5 text-left';
  const point = view.focus;
  return (
    <li className="relative">
      {point ? (
        <button
          type="button"
          onClick={() => {
            triggerSoftHaptic();
            onFocus(point);
          }}
          className={`${rowClass} min-h-[44px] transition-[transform,background-color] active:scale-[0.99] active:bg-mc-surface-2`}
          aria-label={`${view.time} ${view.title}: xaritada ko'rsatish`}
        >
          {body}
        </button>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

function DayDetails({
  courier,
  date,
  today,
  track,
  isLoading,
  onFocus,
}: {
  courier: MonitorLiveCourier | null;
  date: string;
  today: string;
  track: MonitorTrack | null;
  isLoading: boolean;
  onFocus: (point: { latitude: number; longitude: number }) => void;
}) {
  const events = useMemo(() => (track ? dayTimeline(track) : []), [track]);
  const run = track?.run ?? null;
  const stops = track?.stops.filter((s) => s.status !== 'cancelled') ?? [];
  const delivered = stops.filter((s) => s.status === 'delivered').length;
  const gapsM = track?.gaps.reduce((sum, gap) => sum + gap.distance_m, 0) ?? 0;
  const headingTo = date === today ? courier?.heading_to ?? null : null;

  return (
    <SectionCard title="Kun tafsiloti" subtitle={date === today ? `Bugun, ${dayLabel(date)}` : dayLabel(date)}>
      {isLoading && !track && (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[74px] animate-pulse rounded-mc-md bg-mc-surface-2" />
          ))}
        </div>
      )}
      {track && !run && (
        <p className="text-[12px] font-medium text-mc-text-2">Bu kunda smena ham, yetkazish ham bo'lmagan.</p>
      )}
      {track && run && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 @xl:grid-cols-4">
            <Kpi label="Yurildi" value={formatKm(track.driven_m)} note={run.shift_active ? 'hali yozilmoqda' : undefined} />
            <Kpi label="Smena" value={shiftSpan(run.shift_started_at, run.shift_ended_at)} />
            <Kpi label="Yetkazildi" value={`${delivered} / ${stops.length}`} note={run.postponed ? `${run.postponed} ta keyinga qoldi` : undefined} />
            <Kpi
              label="Turgan vaqti"
              value={formatMinutes(stoodMinutes(track))}
              note={track.stays.length ? `${track.stays.length} joyda` : undefined}
            />
          </div>

          {headingTo && (
            <div className="flex items-start gap-2.5 rounded-mc-md bg-mc-brand-soft px-3 py-2.5">
              <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-mc-brand" strokeWidth={2.3} aria-hidden="true" />
              <p className="min-w-0 break-words text-[12px] font-semibold text-mc-text">
                Hozir yo'lda: <span className="font-extrabold">{headingTo.name}</span>
                {headingTo.address && <span className="text-mc-text-2"> · {headingTo.address}</span>}
                {headingTo.eta_at && <span className="text-mc-text-2"> · ~{clockTashkent(headingTo.eta_at)} da yetadi</span>}
              </p>
            </div>
          )}

          {gapsM > 0 && (
            <p className="rounded-mc-md bg-mc-surface-2 px-3 py-2 text-[11px] font-medium text-mc-text-2">
              GPS {track.gaps.length} marta uzilgan; o'sha joylar yo'l xaritasi bo'yicha qo'shildi ({formatKm(gapsM)}).
              Uzilish paytida boshqa ko'chadan yurgan bo'lsa, ozgina farq bo'lishi mumkin.
            </p>
          )}

          {events.length > 0 ? (
            <ol className="relative">
              {/* The rail behind the icons: 8px padding + 44px time + 10px gap + half the 32px dot. */}
              <span className="absolute bottom-4 left-[78px] top-4 w-px bg-mc-border" aria-hidden="true" />
              {events.map((event) => (
                <TimelineRow key={`${event.kind}-${event.at}`} event={event} onFocus={onFocus} />
              ))}
            </ol>
          ) : (
            <p className="text-[12px] font-medium text-mc-text-2">Bu kunda GPS yozuvi yo'q.</p>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/** «Xarita»: who is where now, and any courier's day on any date. */
export default function CourierDayBoard() {
  const [date, setDate] = useState(() => getTashkentDateIso());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);

  const live = useQuery({
    queryKey: courierMonitorKeys.live,
    queryFn: courierMonitorService.live,
    refetchInterval: LIVE_REFRESH_MS,
  });
  // The server's day, not this computer's: an admin abroad must still see Tashkent's «today».
  const today = live.data?.date ?? getTashkentDateIso();
  const couriers = useMemo(() => sortCouriers(live.data?.couriers ?? []), [live.data]);
  const activeId =
    selectedId !== null && couriers.some((c) => c.id === selectedId) ? selectedId : (couriers[0]?.id ?? null);
  const courier = couriers.find((c) => c.id === activeId) ?? null;
  const viewDate = date > today ? today : date;
  const isToday = viewDate === today;

  const track = useQuery({
    queryKey: courierMonitorKeys.track(activeId ?? 0, viewDate),
    queryFn: () => courierMonitorService.track(activeId ?? 0, viewDate),
    enabled: activeId !== null,
    refetchInterval: isToday && courier?.tracking ? TRACK_REFRESH_MS : false,
  });

  const select = useCallback((id: number) => {
    setSelectedId(id);
    setFocus(null);
  }, []);
  const changeDate = useCallback((next: string) => {
    setDate(next);
    setFocus(null);
  }, []);
  const focusOn = useCallback((point: { latitude: number; longitude: number }) => {
    setFocus({ ...point, nonce: Date.now() });
  }, []);

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:items-start">
      <div className="min-w-0 xl:col-start-1 xl:row-start-1">
        <CourierList
          couriers={couriers}
          unassigned={live.data?.unassigned ?? 0}
          isLoading={live.isLoading}
          isError={live.isError}
          isFetching={live.isFetching}
          updatedAt={live.dataUpdatedAt}
          selectedId={activeId}
          onSelect={select}
          onRetry={() => void live.refetch()}
        />
      </div>

      <div className="min-w-0 xl:sticky xl:top-0 xl:col-start-2 xl:row-span-2 xl:row-start-1">
        <MapPanel
          courier={courier}
          date={viewDate}
          today={today}
          onDateChange={changeDate}
          track={track.data ?? null}
          trackLoading={activeId !== null && track.isLoading}
          trackError={track.isError}
          couriers={couriers}
          selectedId={activeId}
          onSelect={select}
          focus={focus}
        />
      </div>

      {activeId !== null && (
        <div className="min-w-0 xl:col-start-1 xl:row-start-2">
          <DayDetails
            courier={courier}
            date={viewDate}
            today={today}
            track={track.data ?? null}
            isLoading={track.isLoading}
            onFocus={focusOn}
          />
        </div>
      )}
    </div>
  );
}
