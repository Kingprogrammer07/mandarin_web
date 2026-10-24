/**
 * Online now, last seen and client activity (`/api/v1/admin/presence/*`).
 *
 * Online = a request in the last `online_seconds`. Every number is counted from
 * recorded requests on the backend; nothing here is estimated.
 */

import { apiClient } from '@/api/client';

export interface AdminPresenceItem {
  admin_id: number;
  system_username: string;
  full_name: string | null;
  role_names: string[];
  is_active: boolean;
  online: boolean;
  /** Last request with this admin's token; null = none since tracking began. */
  last_seen_at: string | null;
  /** Last successful PIN / passkey login (audit log, kept 90 days). */
  last_login_at: string | null;
  last_login_ip: string | null;
}

export interface AdminPresenceResponse {
  online_seconds: number;
  online_count: number;
  items: AdminPresenceItem[];
}

export interface OnlineClient {
  client_id: number;
  code: string;
  full_name: string;
  last_seen_at: string;
}

export interface ClientsOverview {
  online_seconds: number;
  online_count: number;
  online: OnlineClient[];
  active_today: number;
  active_7_days: number;
  active_30_days: number;
  registered_clients: number;
  tracking_since: string | null;
}

export interface DayCount {
  day: string;
  active_clients: number;
}

export interface ClientActivityStats {
  days_requested: number;
  tracking_since: string | null;
  start: string | null;
  end: string | null;
  days_counted: number;
  by_hour: number[];
  by_weekday: number[];
  weekday_days: number[];
  heatmap: number[][];
  daily: DayCount[];
  average_daily: number;
  average_hourly: number;
  peak_hour: number | null;
  quiet_hour: number | null;
  busiest_weekday: number | null;
  quietest_weekday: number | null;
  record_day: DayCount | null;
  record_hour: { day: string; hour: number; active_clients: number } | null;
}

export interface ClientActivityRow {
  client_id: number;
  code: string;
  full_name: string;
  phone: string | null;
  online: boolean;
  last_seen_at: string | null;
  active_days: number;
  active_hours: number;
}

export interface ClientActivityPage {
  days: number;
  total_count: number;
  page: number;
  size: number;
  items: ClientActivityRow[];
}

export interface ClientActivityDetail {
  client_id: number;
  code: string;
  full_name: string;
  phone: string | null;
  registered_at: string | null;
  online: boolean;
  last_seen_at: string | null;
  days: number;
  first_active_day: string | null;
  active_days: number;
  active_hours: number;
  by_hour: number[];
  by_weekday: number[];
  top_hour: number | null;
  timeline: { day: string; hours: number[] }[];
}

export type ClientSort = 'last_seen' | 'active_days' | 'active_hours';
export type ClientFilter = 'all' | 'active' | 'inactive';

const BASE = '/api/v1/admin/presence';

export const getAdminPresence = async (): Promise<AdminPresenceResponse> =>
  (await apiClient.get(`${BASE}/admins`)).data;

export const getClientsOverview = async (): Promise<ClientsOverview> =>
  (await apiClient.get(`${BASE}/clients/overview`)).data;

export const getClientActivityStats = async (days: number): Promise<ClientActivityStats> =>
  (await apiClient.get(`${BASE}/clients/activity`, { params: { days } })).data;

export const getClientActivityList = async (params: {
  q?: string;
  days: number;
  sort: ClientSort;
  only: ClientFilter;
  page: number;
  size?: number;
}): Promise<ClientActivityPage> =>
  (await apiClient.get(`${BASE}/clients`, { params: { ...params, q: params.q || undefined } })).data;

export const getClientActivityDetail = async (
  clientId: number,
  days: number,
): Promise<ClientActivityDetail> =>
  (await apiClient.get(`${BASE}/clients/${clientId}`, { params: { days } })).data;
