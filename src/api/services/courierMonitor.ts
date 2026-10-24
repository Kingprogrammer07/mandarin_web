import { apiClient } from '@/api/client';

/**
 * Admin «Kuryerlar» (`/api/v1/admin/couriers`). Mirrors
 * `src/api/schemas/courier_monitor.py` in the backend. Every route needs
 * `courier:monitor` (super-admin by default): it is location history.
 */

export type MonitorRunStatus = 'planning' | 'on_route' | 'returning' | 'finished';

export interface MonitorRun {
  run_date: string;
  status: MonitorRunStatus;
  shift_active: boolean;
  shift_started_at: string | null;
  shift_ended_at: string | null;
  /** «Yo'lga chiqdim» and «Kunni yakunlash». */
  started_at: string | null;
  finished_at: string | null;
  driven_m: number | null;
  delivered: number;
  postponed: number;
  /** Stops still to deliver. */
  open: number;
}

export interface MonitorPosition {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed_mps: number | null;
  recorded_at: string;
  /** Reported within the last few minutes; false: the last stored point. */
  live: boolean;
}

export interface MonitorCourier {
  id: number;
  username: string;
  is_active: boolean;
  name: string | null;
  phone: string | null;
  car: string | null;
}

export interface MonitorLiveCourier extends MonitorCourier {
  run: MonitorRun | null;
  /** The phone is reporting now: on shift, or on the road. */
  tracking: boolean;
  position: MonitorPosition | null;
  heading_to: { name: string; address: string | null; eta_at: string | null } | null;
}

export interface MonitorLive {
  date: string;
  /** Today's open stops no courier has taken yet. */
  unassigned: number;
  couriers: MonitorLiveCourier[];
}

export interface MonitorStay {
  latitude: number;
  longitude: number;
  started_at: string;
  ended_at: string;
  minutes: number;
}

export interface MonitorGap {
  start: [number, number];
  end: [number, number];
  started_at: string;
  ended_at: string;
  /** Straight line; counted in the kilometres. */
  distance_m: number;
}

export interface MonitorStop {
  public_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: 'waiting' | 'on_the_way' | 'delivered' | 'cancelled';
  departed_at: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
  partner_color: string | null;
}

export interface MonitorTrack {
  date: string;
  courier: MonitorCourier;
  office: { latitude: number; longitude: number } | null;
  run: MonitorRun | null;
  driven_m: number;
  /** [latitude, longitude, unix seconds], oldest first. */
  trail: [number, number, number][];
  stays: MonitorStay[];
  gaps: MonitorGap[];
  stops: MonitorStop[];
}

export interface MonitorMileageDay {
  date: string;
  driven_m: number;
  shift_started_at: string | null;
  shift_ended_at: string | null;
  delivered: number;
}

export interface MonitorMileageCourier extends MonitorCourier {
  total_m: number;
  days: MonitorMileageDay[];
}

export interface MonitorMileage {
  start: string;
  end: string;
  couriers: MonitorMileageCourier[];
}

export const courierMonitorKeys = {
  all: ['courier-monitor'] as const,
  live: ['courier-monitor', 'live'] as const,
  track: (courierId: number, date: string) => ['courier-monitor', 'track', courierId, date] as const,
  mileage: (from: string, to: string) => ['courier-monitor', 'mileage', from, to] as const,
};

export const courierMonitorService = {
  async live(): Promise<MonitorLive> {
    const response = await apiClient.get<MonitorLive>('/api/v1/admin/couriers/live');
    return response.data;
  },

  async track(courierId: number, date: string): Promise<MonitorTrack> {
    const response = await apiClient.get<MonitorTrack>(`/api/v1/admin/couriers/${courierId}/track`, {
      params: { date },
    });
    return response.data;
  },

  /** Both dates included; at most 93 days. */
  async mileage(from: string, to: string): Promise<MonitorMileage> {
    const response = await apiClient.get<MonitorMileage>('/api/v1/admin/couriers/mileage', {
      params: { from, to },
    });
    return response.data;
  },
};
