/**
 * Pure pieces of the admin «Kuryerlar» page: numbers, clocks and the day's
 * timeline, kept out of the components so they can be tested without a map.
 */
import { TASHKENT_TZ } from '@/lib/format';
import type {
  MonitorBreak,
  MonitorLiveCourier,
  MonitorMileageCourier,
  MonitorTrack,
} from '@/api/services/courierMonitor';

const MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const MONTHS_LONG = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];
const WEEKDAYS_SHORT = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];

function groupThousands(whole: string): string {
  // A non-breaking space, so «1 234 km» never breaks across two lines.
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

/**
 * Tenths of a kilometre from whole metres. Rounded on `metres / 100`, which is
 * exact, not with `toFixed` on `metres / 1000`, which is not: 96 550 m would
 * print as 96,5 there and 84 250 m as 84,3.
 */
function kmTenths(meters: number): string {
  const tenths = Math.round(Math.max(0, Number.isFinite(meters) ? meters : 0) / 100);
  return `${groupThousands(String(Math.floor(tenths / 10)))},${tenths % 10}`;
}

/** «84,2 km»; whole kilometres from 100 km, where a tenth no longer matters. */
export function formatKm(meters: number): string {
  const safe = Math.max(0, Number.isFinite(meters) ? meters : 0);
  if (safe >= 100_000) return `${groupThousands(String(Math.round(safe / 1000)))} km`;
  return `${kmTenths(safe)} km`;
}

/** Kilometres as a number for the CSV: comma decimal, what Excel in uz/ru expects. */
export function kmForCsv(meters: number): string {
  return kmTenths(meters).replace(/\u00a0/g, '');
}

const clockFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TASHKENT_TZ,
});

/** «09:05» in Tashkent, whatever the admin's own computer clock says. */
export function clockTashkent(value: string | number | Date): string {
  return clockFormat.format(typeof value === 'number' ? new Date(value) : new Date(value));
}

const isoDayFormat = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TASHKENT_TZ,
});

function tashkentDayOf(value: string | Date): string {
  return isoDayFormat.format(new Date(value));
}

function parseIsoDay(day: string): { year: number; month: number; date: number } {
  const [year, month, date] = day.split('-').map(Number);
  return { year, month, date };
}

/** «24 okt» */
export function dayShort(day: string): string {
  const { month, date } = parseIsoDay(day);
  return `${date} ${MONTHS_SHORT[month - 1]}`;
}

/** «23 okt 18:40» in Tashkent. */
export function momentTashkent(value: string): string {
  return `${dayShort(tashkentDayOf(value))} ${clockTashkent(value)}`;
}

/** «24 okt, Shan» */
export function dayLabel(day: string): string {
  const { year, month, date } = parseIsoDay(day);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return `${dayShort(day)}, ${WEEKDAYS_SHORT[weekday]}`;
}

/** The calendar day `delta` days from `day`; plain dates, no time zone to slip on. */
export function shiftDay(day: string, delta: number): string {
  const { year, month, date } = parseIsoDay(day);
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
}

/** «2026-10» → first and last day of that month. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** «Oktabr 2026» */
export function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${year}`;
}

/** «09:00–18:40», «09:00 dan» while it is still on, «—» when it never started. */
export function shiftSpan(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt) return '—';
  if (!endedAt) return `${clockTashkent(startedAt)} dan`;
  return `${clockTashkent(startedAt)}–${clockTashkent(endedAt)}`;
}

/** «35 daq», «1 soat 20 daq» */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} daq`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} soat` : `${hours} soat ${rest} daq`;
}

/** When the phone last reported, in words: «hozir», «7 daq oldin», «18:40 da», «23 okt 18:40». */
export function lastSeen(recordedAt: string, now: Date = new Date()): string {
  const seconds = (now.getTime() - new Date(recordedAt).getTime()) / 1000;
  if (seconds < 60) return 'hozir';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} daq oldin`;
  if (tashkentDayOf(recordedAt) === tashkentDayOf(now)) return `${clockTashkent(recordedAt)} da`;
  return `${dayShort(tashkentDayOf(recordedAt))} ${clockTashkent(recordedAt)}`;
}

export type CourierState = 'on_route' | 'returning' | 'on_shift' | 'finished' | 'off';

/** One word for where a courier is in the day, the same rule the app uses. */
export function courierState(courier: Pick<MonitorLiveCourier, 'run'>): CourierState {
  const run = courier.run;
  if (!run) return 'off';
  if (run.status === 'on_route') return 'on_route';
  if (run.status === 'returning') return 'returning';
  if (run.shift_active) return 'on_shift';
  if (run.status === 'finished' || run.shift_ended_at) return 'finished';
  return 'off';
}

export const COURIER_STATE_LABEL: Record<CourierState, string> = {
  on_route: "Yo'lda",
  returning: 'Qaytmoqda',
  on_shift: 'Ishda',
  finished: 'Kun tugadi',
  off: 'Ishda emas',
};

/** The name to show: profile name, else the login. */
export function courierName(courier: { name: string | null; username: string }): string {
  return courier.name?.trim() || courier.username;
}

/** The couriers on the road first, then on shift, then the rest; by name inside each. */
export function sortCouriers<T extends MonitorLiveCourier>(couriers: readonly T[]): T[] {
  const rank: Record<CourierState, number> = { on_route: 0, returning: 1, on_shift: 2, finished: 3, off: 4 };
  return [...couriers].sort(
    (a, b) =>
      Number(b.is_active) - Number(a.is_active) ||
      rank[courierState(a)] - rank[courierState(b)] ||
      courierName(a).localeCompare(courierName(b)),
  );
}

const EARTH_RADIUS_M = 6_371_000;

export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * How close a stay must be to a client's door or the office to be named after
 * it. A parked car is often across the street or round the corner of a block.
 */
export const PLACE_RADIUS_M = 150;

export type TimelineEvent =
  | { kind: 'shift_start'; at: string }
  | { kind: 'route_start'; at: string }
  | { kind: 'shift_end'; at: string }
  | { kind: 'route_end'; at: string }
  | {
      kind: 'stay';
      at: string;
      endedAt: string;
      minutes: number;
      latitude: number;
      longitude: number;
      /** A client whose door it was next to, or the office. */
      place: { type: 'office' } | { type: 'stop'; name: string } | null;
    }
  | { kind: 'break'; at: string; endedAt: string }
  | {
      kind: 'gap';
      at: string;
      endedAt: string;
      distanceM: number;
      latitude: number;
      longitude: number;
    }
  | {
      kind: 'delivered';
      at: string;
      name: string;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
    };

/** Everything the day held, oldest first: the shift, the stays, the GPS holes, the deliveries. */
export function dayTimeline(track: MonitorTrack): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const run = track.run;
  if (run?.shift_started_at) events.push({ kind: 'shift_start', at: run.shift_started_at });
  if (run?.started_at) events.push({ kind: 'route_start', at: run.started_at });
  if (run?.finished_at) events.push({ kind: 'route_end', at: run.finished_at });
  if (run?.shift_ended_at) events.push({ kind: 'shift_end', at: run.shift_ended_at });
  for (const pause of run?.breaks ?? []) {
    events.push({ kind: 'break', at: pause.started_at, endedAt: pause.ended_at });
  }

  const placedStops = track.stops.filter(
    (stop): stop is typeof stop & { latitude: number; longitude: number } =>
      stop.latitude !== null && stop.longitude !== null,
  );
  for (const stay of track.stays) {
    let place: Extract<TimelineEvent, { kind: 'stay' }>['place'] = null;
    let best = PLACE_RADIUS_M;
    for (const stop of placedStops) {
      const d = distanceM(stay.latitude, stay.longitude, stop.latitude, stop.longitude);
      if (d <= best) {
        best = d;
        place = { type: 'stop', name: stop.name };
      }
    }
    if (
      track.office &&
      distanceM(stay.latitude, stay.longitude, track.office.latitude, track.office.longitude) <= best
    ) {
      place = { type: 'office' };
    }
    events.push({
      kind: 'stay',
      at: stay.started_at,
      endedAt: stay.ended_at,
      minutes: stay.minutes,
      latitude: stay.latitude,
      longitude: stay.longitude,
      place,
    });
  }
  for (const gap of track.gaps) {
    events.push({
      kind: 'gap',
      at: gap.started_at,
      endedAt: gap.ended_at,
      distanceM: gap.distance_m,
      latitude: (gap.start[0] + gap.end[0]) / 2,
      longitude: (gap.start[1] + gap.end[1]) / 2,
    });
  }
  for (const stop of track.stops) {
    if (stop.status !== 'delivered' || !stop.delivered_at) continue;
    events.push({
      kind: 'delivered',
      at: stop.delivered_at,
      name: stop.name,
      address: stop.address,
      latitude: stop.latitude,
      longitude: stop.longitude,
    });
  }
  // Same minute: the shift opens before anything in it and closes after.
  const order: Record<TimelineEvent['kind'], number> = {
    shift_start: 0, route_start: 1, break: 2, stay: 2, gap: 2, delivered: 3, route_end: 4, shift_end: 5,
  };
  return events.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime() || order[a.kind] - order[b.kind],
  );
}

/**
 * The trail as lines to draw: a new one after each shift break, so the time
 * off the shift (not counted) is not drawn as a road driven.
 */
export function splitTrail(
  trail: readonly [number, number, number][],
  breaks: readonly MonitorBreak[] = [],
): [number, number][][] {
  const spans = breaks.map((b) => [Date.parse(b.started_at) / 1000, Date.parse(b.ended_at) / 1000] as const);
  const lines: [number, number][][] = [];
  let line: [number, number][] = [];
  let previous: number | null = null;
  for (const [latitude, longitude, at] of trail) {
    const since = previous;
    // The step from the last point to this one overlaps a break.
    const crossed = since !== null && spans.some(([from, to]) => since <= to && at >= from);
    if (crossed && line.length) {
      lines.push(line);
      line = [];
    }
    line.push([latitude, longitude]);
    previous = at;
  }
  if (line.length) lines.push(line);
  return lines.filter((l) => l.length > 1);
}

/** Total minutes the car stood still during the day. */
export function stoodMinutes(track: Pick<MonitorTrack, 'stays'>): number {
  return track.stays.reduce((sum, stay) => sum + stay.minutes, 0);
}

/** Only a `#rgb`/`#rrggbb` partner colour reaches inline styles; anything else is dropped. */
export function safeColor(color: string | null | undefined): string | null {
  return color && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : null;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The month as a spreadsheet: one row per courier per day, then a total per
 * courier. `;` and a comma decimal because that is what Excel opens correctly
 * on a uz/ru Windows; the BOM keeps «O'zbek» letters intact.
 */
export function buildMileageCsv(couriers: readonly MonitorMileageCourier[]): string {
  const rows: (string | number)[][] = [
    ['Sana', 'Kuryer', 'Mashina', 'Smena boshlandi', 'Smena tugadi', 'Yetkazildi', 'Km'],
  ];
  for (const courier of couriers) {
    const name = courierName(courier);
    for (const day of courier.days) {
      rows.push([
        day.date,
        name,
        courier.car ?? '',
        day.shift_started_at ? clockTashkent(day.shift_started_at) : '',
        day.shift_ended_at ? clockTashkent(day.shift_ended_at) : '',
        day.delivered,
        kmForCsv(day.driven_m),
      ]);
    }
    rows.push([
      'Jami',
      name,
      courier.car ?? '',
      '',
      '',
      courier.days.reduce((sum, day) => sum + day.delivered, 0),
      kmForCsv(courier.total_m),
    ]);
  }
  return `\ufeff${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}
