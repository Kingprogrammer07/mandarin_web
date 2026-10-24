import { describe, expect, it } from 'vitest';

import type { MonitorMileageCourier, MonitorRun, MonitorTrack } from '@/api/services/courierMonitor';
import {
  buildMileageCsv,
  clockTashkent,
  courierState,
  dayLabel,
  dayTimeline,
  formatKm,
  formatMinutes,
  lastSeen,
  momentTashkent,
  monthLabel,
  monthRange,
  safeColor,
  shiftDay,
  shiftMonth,
  shiftSpan,
  splitTrail,
} from './courierMonitor';

const RUN: MonitorRun = {
  run_date: '2026-10-24',
  status: 'finished',
  shift_active: false,
  shift_started_at: '2026-10-24T04:00:00Z',
  shift_ended_at: '2026-10-24T13:40:00Z',
  started_at: '2026-10-24T05:05:00Z',
  finished_at: '2026-10-24T12:30:00Z',
  driven_m: 84_200,
  delivered: 2,
  postponed: 0,
  open: 0,
};

const OFFICE = { latitude: 41.3, longitude: 69.25 };

function track(overrides: Partial<MonitorTrack> = {}): MonitorTrack {
  return {
    date: '2026-10-24',
    courier: { id: 7, username: 'aziz', is_active: true, name: 'Aziz', phone: null, car: 'Cobalt' },
    office: OFFICE,
    run: RUN,
    driven_m: 84_200,
    trail: [],
    stays: [],
    gaps: [],
    stops: [],
    ...overrides,
  };
}

describe('numbers and clocks', () => {
  it('shows kilometres with a comma, whole from 100 km', () => {
    expect(formatKm(84_200)).toBe('84,2 km');
    expect(formatKm(0)).toBe('0,0 km');
    expect(formatKm(450)).toBe('0,5 km');
    expect(formatKm(146_400)).toBe('146 km');
    expect(formatKm(1_234_000)).toBe('1\u00a0234 km');
  });

  it('reads every time in Tashkent', () => {
    expect(clockTashkent('2026-10-24T04:05:00Z')).toBe('09:05');
    expect(clockTashkent('2026-10-24T19:30:00Z')).toBe('00:30');
    expect(shiftSpan('2026-10-24T04:00:00Z', '2026-10-24T13:40:00Z')).toBe('09:00–18:40');
    expect(shiftSpan('2026-10-24T04:00:00Z', null)).toBe('09:00 dan');
    expect(shiftSpan(null, null)).toBe('—');
  });

  it('says how long ago the phone reported', () => {
    const now = new Date('2026-10-24T10:00:00Z');
    expect(lastSeen('2026-10-24T09:59:30Z', now)).toBe('hozir');
    expect(lastSeen('2026-10-24T09:53:00Z', now)).toBe('7 daq oldin');
    expect(lastSeen('2026-10-24T05:00:00Z', now)).toBe('10:00 da');
    expect(lastSeen('2026-10-23T13:40:00Z', now)).toBe('23 okt 18:40');
    expect(momentTashkent('2026-10-24T04:12:00Z')).toBe('24 okt 09:12');
  });

  it('walks days and months as plain dates', () => {
    expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(dayLabel('2026-10-24')).toBe('24 okt, Shan');
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthLabel('2026-10')).toBe('Oktabr 2026');
    expect(formatMinutes(35)).toBe('35 daq');
    expect(formatMinutes(80)).toBe('1 soat 20 daq');
    expect(formatMinutes(120)).toBe('2 soat');
  });
});

describe('courierState', () => {
  it('names the part of the day the courier is in', () => {
    expect(courierState({ run: null })).toBe('off');
    expect(courierState({ run: { ...RUN, status: 'on_route' } })).toBe('on_route');
    expect(courierState({ run: { ...RUN, status: 'returning' } })).toBe('returning');
    expect(courierState({ run: { ...RUN, status: 'planning', shift_active: true, shift_ended_at: null } })).toBe(
      'on_shift',
    );
    expect(courierState({ run: RUN })).toBe('finished');
    expect(
      courierState({ run: { ...RUN, status: 'planning', shift_started_at: null, shift_ended_at: null } }),
    ).toBe('off');
  });
});

describe('dayTimeline', () => {
  it('puts the shift, stays, holes and deliveries in time order and names the stays', () => {
    const events = dayTimeline(
      track({
        stays: [
          // Next to the client's door (about 60 m away).
          { latitude: 41.3405, longitude: 69.2805, started_at: '2026-10-24T07:00:00Z', ended_at: '2026-10-24T07:20:00Z', minutes: 20 },
          // At the office.
          { latitude: 41.3001, longitude: 69.2501, started_at: '2026-10-24T09:00:00Z', ended_at: '2026-10-24T09:45:00Z', minutes: 45 },
          // Nowhere we know.
          { latitude: 41.37, longitude: 69.33, started_at: '2026-10-24T10:00:00Z', ended_at: '2026-10-24T10:10:00Z', minutes: 10 },
        ],
        gaps: [
          { start: [41.31, 69.26], end: [41.33, 69.28], started_at: '2026-10-24T06:00:00Z', ended_at: '2026-10-24T06:15:00Z', distance_m: 2_100 },
        ],
        stops: [
          {
            public_id: 'a', name: 'Dilnoza', address: 'Chilonzor 5', latitude: 41.34, longitude: 69.28,
            status: 'delivered', departed_at: null, arrived_at: '2026-10-24T07:01:00Z',
            delivered_at: '2026-10-24T07:10:00Z', partner_color: null,
          },
          {
            public_id: 'b', name: 'Bekzod', address: null, latitude: null, longitude: null,
            status: 'waiting', departed_at: null, arrived_at: null, delivered_at: null, partner_color: null,
          },
        ],
      }),
    );

    expect(events.map((e) => e.kind)).toEqual([
      'shift_start', 'route_start', 'gap', 'stay', 'delivered', 'stay', 'stay', 'route_end', 'shift_end',
    ]);
    const stays = events.filter((e) => e.kind === 'stay');
    expect(stays.map((s) => s.place)).toEqual([{ type: 'stop', name: 'Dilnoza' }, { type: 'office' }, null]);
  });

  it('shows a shift break where it was, between the start and the end', () => {
    const events = dayTimeline(
      track({
        run: { ...RUN, breaks: [{ started_at: '2026-10-24T08:00:00Z', ended_at: '2026-10-24T09:30:00Z' }] },
      }),
    );
    expect(events.map((e) => e.kind)).toEqual(['shift_start', 'route_start', 'break', 'route_end', 'shift_end']);
    expect(events[2]).toEqual({ kind: 'break', at: '2026-10-24T08:00:00Z', endedAt: '2026-10-24T09:30:00Z' });
  });

  it('is empty for a day with no run', () => {
    expect(dayTimeline(track({ run: null }))).toEqual([]);
  });
});

describe('splitTrail', () => {
  const at = (iso: string) => Date.parse(iso) / 1000;
  const trail: [number, number, number][] = [
    [41.3, 69.25, at('2026-10-24T07:00:00Z')],
    [41.31, 69.26, at('2026-10-24T07:50:00Z')],
    // Inside the break: not drawn.
    [41.4, 69.4, at('2026-10-24T08:30:00Z')],
    [41.32, 69.27, at('2026-10-24T09:40:00Z')],
    [41.33, 69.28, at('2026-10-24T09:50:00Z')],
  ];

  it('draws one line without breaks', () => {
    expect(splitTrail(trail)).toHaveLength(1);
    expect(splitTrail(trail)[0]).toHaveLength(5);
  });

  it('never draws a road across a shift break', () => {
    expect(splitTrail(trail, [{ started_at: '2026-10-24T08:00:00Z', ended_at: '2026-10-24T09:30:00Z' }])).toEqual([
      [
        [41.3, 69.25],
        [41.31, 69.26],
      ],
      [
        [41.32, 69.27],
        [41.33, 69.28],
      ],
    ]);
  });
});

describe('the km sheet', () => {
  const courier: MonitorMileageCourier = {
    id: 7,
    username: 'aziz',
    is_active: true,
    name: 'Aziz; Karimov',
    phone: null,
    car: 'Cobalt',
    total_m: 96_550,
    days: [
      { date: '2026-10-23', driven_m: 84_250, shift_started_at: '2026-10-23T04:00:00Z', shift_ended_at: '2026-10-23T13:40:00Z', delivered: 6 },
      { date: '2026-10-24', driven_m: 12_300, shift_started_at: '2026-10-24T04:30:00Z', shift_ended_at: null, delivered: 1 },
    ],
  };

  it('builds a semicolon CSV Excel opens in uz/ru, kilometres only', () => {
    const csv = buildMileageCsv([courier]);
    expect(csv.startsWith('\ufeff')).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines).toEqual([
      'Sana;Kuryer;Mashina;Smena boshlandi;Smena tugadi;Yetkazildi;Km',
      '2026-10-23;"Aziz; Karimov";Cobalt;09:00;18:40;6;84,3',
      '2026-10-24;"Aziz; Karimov";Cobalt;09:30;;1;12,3',
      'Jami;"Aziz; Karimov";Cobalt;;;7;96,6',
    ]);
  });

  it('only lets a hex partner colour into a style', () => {
    expect(safeColor('#FF7a1a')).toBe('#FF7a1a');
    expect(safeColor('#abc')).toBe('#abc');
    expect(safeColor('red;background:url(x)')).toBeNull();
    expect(safeColor(null)).toBeNull();
  });
});
