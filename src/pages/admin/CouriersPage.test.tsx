/**
 * Admin «Kuryerlar»: who is where, a courier's day, and the month's kilometres.
 * The Leaflet map is replaced by a stub that records what it was given.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/client', () => ({ apiClient: {} }));
vi.mock('@/api/services/adminManagement', () => ({ getAdminJwtClaims: vi.fn() }));
vi.mock('@/api/services/courierMonitor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/services/courierMonitor')>()),
  courierMonitorService: { live: vi.fn(), track: vi.fn(), mileage: vi.fn() },
}));

interface MapProps {
  track: MonitorTrack | null;
  couriers: readonly MonitorLiveCourier[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  focus: { latitude: number; longitude: number } | null;
}
const mapProps: MapProps[] = [];
vi.mock('@/components/admin/couriers/CourierMonitorMap', () => ({
  default: (props: MapProps) => {
    mapProps.push(props);
    return <div data-testid="map" />;
  },
}));

import { getAdminJwtClaims } from '@/api/services/adminManagement';
import {
  courierMonitorService,
  type MonitorLive,
  type MonitorLiveCourier,
  type MonitorMileage,
  type MonitorTrack,
} from '@/api/services/courierMonitor';
import { getTashkentDateIso } from '@/lib/format';
import { shiftDay } from '@/lib/courierMonitor';
import CouriersPage from './CouriersPage';

const TODAY = getTashkentDateIso();
const D = (time: string) => `${TODAY}T${time}:00+05:00`;

const AZIZ: MonitorLiveCourier = {
  id: 7,
  username: 'aziz',
  is_active: true,
  name: 'Aziz Karimov',
  phone: '+998901234567',
  car: 'Cobalt · 01 A 123 BC',
  consent_at: '2026-10-24T04:12:00Z',
  run: {
    run_date: TODAY,
    status: 'on_route',
    shift_active: true,
    shift_started_at: D('09:00'),
    shift_ended_at: null,
    started_at: D('10:05'),
    finished_at: null,
    driven_m: 23_400,
    delivered: 1,
    postponed: 0,
    open: 2,
  },
  tracking: true,
  position: { latitude: 41.33, longitude: 69.27, heading: 90, speed_mps: 8, recorded_at: new Date().toISOString(), live: true },
  heading_to: { name: 'Bekzod', address: 'Yunusobod 4', eta_at: D('12:40') },
};

const VALI: MonitorLiveCourier = {
  id: 9,
  username: 'vali',
  is_active: true,
  name: null,
  phone: null,
  car: null,
  run: null,
  tracking: false,
  position: null,
  heading_to: null,
};

const LIVE: MonitorLive = { date: TODAY, unassigned: 3, couriers: [VALI, AZIZ] };

const TRACK: MonitorTrack = {
  date: TODAY,
  courier: AZIZ,
  office: { latitude: 41.3, longitude: 69.25 },
  run: AZIZ.run,
  driven_m: 23_400,
  trail: [
    [41.3, 69.25, 1],
    [41.34, 69.28, 2],
  ],
  stays: [
    { latitude: 41.3401, longitude: 69.2801, started_at: D('11:00'), ended_at: D('11:25'), minutes: 25 },
  ],
  gaps: [],
  stops: [
    {
      public_id: 's1', name: 'Dilnoza', address: 'Chilonzor 5', latitude: 41.34, longitude: 69.28,
      status: 'delivered', departed_at: D('10:05'), arrived_at: D('11:00'), delivered_at: D('11:10'), partner_color: null,
    },
    {
      public_id: 's2', name: 'Bekzod', address: 'Yunusobod 4', latitude: 41.36, longitude: 69.29,
      status: 'on_the_way', departed_at: D('11:25'), arrived_at: null, delivered_at: null, partner_color: '#2563eb',
    },
    {
      public_id: 's3', name: 'Sardor', address: null, latitude: null, longitude: null,
      status: 'waiting', departed_at: null, arrived_at: null, delivered_at: null, partner_color: null,
    },
  ],
};

const MILEAGE: MonitorMileage = {
  start: `${TODAY.slice(0, 7)}-01`,
  end: TODAY,
  couriers: [
    {
      id: 7, username: 'aziz', is_active: true, name: 'Aziz Karimov', phone: null, car: 'Cobalt',
      total_m: 107_650,
      days: [
        { date: `${TODAY.slice(0, 7)}-01`, driven_m: 84_250, shift_started_at: D('09:00'), shift_ended_at: D('18:40'), delivered: 6 },
        { date: `${TODAY.slice(0, 7)}-02`, driven_m: 23_400, shift_started_at: D('09:00'), shift_ended_at: null, delivered: 1 },
      ],
    },
  ],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CouriersPage />
    </QueryClientProvider>,
  );
}

function asAdmin(permissions: string[] = [], isSuperAdmin = false) {
  vi.mocked(getAdminJwtClaims).mockReturnValue({
    permissions: new Set(permissions),
    role_name: isSuperAdmin ? 'super-admin' : 'admin',
    role_names: [isSuperAdmin ? 'super-admin' : 'admin'],
    home_page: null,
    isSuperAdmin,
    admin_id: 1,
  });
}

beforeEach(() => {
  mapProps.length = 0;
  vi.mocked(courierMonitorService.live).mockReset().mockResolvedValue(LIVE);
  vi.mocked(courierMonitorService.track).mockReset().mockResolvedValue(TRACK);
  vi.mocked(courierMonitorService.mileage).mockReset().mockResolvedValue(MILEAGE);
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CouriersPage', () => {
  it('explains itself to an admin without courier:monitor and asks nothing', () => {
    asAdmin(['flights:read']);
    renderPage();
    expect(screen.getByText("Ruxsat yo'q")).toBeInTheDocument();
    expect(courierMonitorService.live).not.toHaveBeenCalled();
  });

  it('opens on the courier on the road, with the day and its timeline', async () => {
    asAdmin([], true);
    renderPage();

    // The one on the road comes first and is picked.
    const list = await screen.findByRole('list');
    const rows = within(list).getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Aziz Karimov');
    expect(rows[0]).toHaveAttribute('aria-pressed', 'true');
    expect(rows[0]).toHaveTextContent("Yo'lda");
    expect(rows[0]).toHaveTextContent('23,4 km');
    expect(rows[0]).toHaveTextContent('1/3 yetkazildi');
    expect(rows[1]).toHaveTextContent('vali');
    expect(rows[1]).toHaveTextContent('Ishda emas');
    expect(screen.getByText(/Skladda 3 ta manzil kutmoqda/)).toBeInTheDocument();
    expect(screen.getByText('Joylashuvga rozilik: 24 okt 09:12')).toBeInTheDocument();

    await waitFor(() => expect(courierMonitorService.track).toHaveBeenCalledWith(7, TODAY));
    expect(await screen.findByText('Ish boshlandi')).toBeInTheDocument();
    expect(screen.queryByText('Kunni yakunladi')).toBeNull();
    expect(screen.getByText("Yo'lga chiqdi")).toBeInTheDocument();
    expect(screen.getByText('Yetkazildi: Dilnoza')).toBeInTheDocument();
    expect(screen.getByText('Dilnoza manzili yonida · 11:00–11:25')).toBeInTheDocument();
    expect(screen.getByText('09:00 dan')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText(/Hozir yo'lda:/)).toHaveTextContent('Bekzod · Yunusobod 4 · ~12:40 da yetadi');

    // A stay in the timeline flies the map there.
    fireEvent.click(screen.getByRole('button', { name: /Turdi · 25 daq: xaritada ko'rsatish/ }));
    await waitFor(() => expect(mapProps.at(-1)?.focus).toMatchObject({ latitude: 41.3401, longitude: 69.2801 }));
    expect(mapProps.at(-1)?.couriers).toHaveLength(2);

    // Another courier, from the list.
    fireEvent.click(rows[1]);
    await waitFor(() => expect(courierMonitorService.track).toHaveBeenCalledWith(9, TODAY));
  });

  it('walks back a day, where the map shows no live couriers', async () => {
    asAdmin(['courier:monitor']);
    renderPage();
    await screen.findByText('Ish boshlandi');
    expect(screen.getByRole('button', { name: 'Keyingi kun' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Oldingi kun' }));
    await waitFor(() => expect(courierMonitorService.track).toHaveBeenCalledWith(7, shiftDay(TODAY, -1)));
    await waitFor(() => expect(mapProps.at(-1)?.couriers).toHaveLength(0));
    expect(screen.getByRole('button', { name: 'Keyingi kun' })).toBeEnabled();
  });

  it('says when a courier has not agreed to the recording, and shows a shift break', async () => {
    asAdmin([], true);
    const unsigned = { ...AZIZ, consent_at: null };
    vi.mocked(courierMonitorService.live).mockResolvedValue({ ...LIVE, couriers: [unsigned] });
    vi.mocked(courierMonitorService.track).mockResolvedValue({
      ...TRACK,
      courier: unsigned,
      run: TRACK.run && { ...TRACK.run, breaks: [{ started_at: D('13:00'), ended_at: D('14:10') }] },
    });
    renderPage();
    expect(await screen.findByText('Ilovada rozilik hali berilmagan')).toBeInTheDocument();
    expect(await screen.findByText("Smena to'xtatildi · 1 soat 10 daq")).toBeInTheDocument();
    expect(screen.getByText("13:00–14:10 · bu vaqt km'ga kirmaydi")).toBeInTheDocument();
  });

  it('adds up the month in kilometres and exports a CSV', async () => {
    asAdmin([], true);
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob;
      return 'blob:km';
    });
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Kilometrlar/ }));

    expect(await screen.findByText('108 km')).toBeInTheDocument();
    expect(screen.getByText("2 kun yurgan · o'rtacha 53,8 km kuniga")).toBeInTheDocument();
    expect(screen.getByText('84,3 km')).toBeInTheDocument();
    expect(screen.getByText('09:00–18:40 · 6 ta yetkazildi')).toBeInTheDocument();

    // Inside Tashkent the fee is a fixed price; no money per kilometre here.
    expect(screen.queryByText(/so'm/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Excel \(CSV\)/ }));
    expect(click).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    const text = await blob.text();
    expect(text).toContain('Jami;Aziz Karimov;Cobalt;;;7;107,7\r\n');
  });
});
