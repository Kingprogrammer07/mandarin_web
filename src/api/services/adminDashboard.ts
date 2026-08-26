/**
 * Admin landing dashboard API.
 *
 * The summary endpoint exists so the page does not open twelve connections on
 * first paint. Its contract is unusual and the types encode it: every count is
 * `number | null`, and `null` means "not measured" — the caller lacks the
 * permission, or the query failed — never "zero". A tile that prints a digit it
 * did not receive is the exact failure this replaces.
 */

import { apiClient } from '@/api/client';

/** Counts of work waiting for somebody. `null` = not measured, never zero. */
export interface DashboardQueues {
  pickup_preparing: number | null;
  pickup_ready: number | null;
  pos_pending_flight: number | null;
  pos_pending_zayafka: number | null;
  uzpost_failures_pending: number | null;
  delivery_pending_total: number | null;
  /**
   * Pending delivery requests with no active pickup queue behind them.
   *
   * The honest backlog. Submitting a standard (courier) request spawns a queue
   * row in the same transaction, so a request can already be prepared and
   * handed over while still sitting at `pending` — waiting only for someone to
   * press approve in Telegram.
   */
  delivery_pending_unqueued: number | null;
  registrations_pending: number | null;
  /** Registered today, Tashkent calendar day. */
  registrations_today: number | null;
}

/** Runtime switches. All three are Redis reads and carry no permission gate. */
export interface DashboardFlags {
  maintenance: boolean | null;
  nbu_enabled: boolean | null;
  webapp_only: boolean | null;
}

export interface DashboardSummary {
  queues: DashboardQueues;
  flags: DashboardFlags;
  /**
   * Fields the caller may never see. Permanent — render nothing for these,
   * a retry cannot help.
   */
  forbidden: string[];
  /** Fields whose query raised. Transient — show an error state with retry. */
  failed: string[];
  generated_at: string;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>(
    '/api/v1/admin/dashboard/summary',
  );
  return data;
}

/** One Tashkent calendar day of billed / paid / debt. */
export interface DailyRevenuePoint {
  period: string;
  revenue: number;
  paid: number;
  debt: number;
}

export interface DailyRevenueResponse {
  start_date: string;
  end_date: string;
  /** One entry per day — days with no transactions come back as zeros. */
  days: DailyRevenuePoint[];
}

/**
 * Day-by-day totals of transactions **by the day they were created**.
 *
 * A different lens from the cashier log: a payment made today against a
 * transaction created last week counts here on last week's day. Label it as
 * billing, never as "money received today".
 */
export async function getDailyRevenue(days = 30): Promise<DailyRevenueResponse> {
  const { data } = await apiClient.get<DailyRevenueResponse>(
    '/api/v1/statistics/financial/daily',
    { params: { days } },
  );
  return data;
}

// ---------------------------------------------------------------------------
// Recent activity
// ---------------------------------------------------------------------------

export type ActivityKind =
  | 'payment'
  | 'admin_action'
  | 'client_registered'
  | 'cargo_weighed'
  | 'cargo_expected';

/** One event. Fields irrelevant to a `kind` are null — the UI writes the sentence. */
export interface ActivityItem {
  kind: ActivityKind;
  at: string;
  actor: string | null;
  action: string | null;
  flight_name: string | null;
  client_code: string | null;
  client_name: string | null;
  amount_uzs: number | null;
  provider: string | null;
  count: number | null;
  weight_kg: number | null;
}

export interface ActivityFeed {
  items: ActivityItem[];
  forbidden: string[];
  failed: string[];
}

export async function getRecentActivity(limit = 10): Promise<ActivityFeed> {
  const { data } = await apiClient.get<ActivityFeed>(
    '/api/v1/admin/dashboard/activity',
    { params: { limit } },
  );
  return data;
}

// ---------------------------------------------------------------------------
// Flight volume
// ---------------------------------------------------------------------------

export interface FlightVolume {
  flight_name: string;
  weight_kg: number;
  /**
   * `weighed` — measured in Tashkent, exact.
   * `manifest` — declared by China, an estimate; check the coverage counts.
   * `none` — no weight available.
   */
  source: 'weighed' | 'manifest' | 'none';
  track_codes_expected: number;
  track_codes_with_weight: number;
  manifest_kg: number;
  consignments: number;
  last_activity_at: string | null;
}

export interface FlightVolumeSummary {
  last_arrived: FlightVolume | null;
  /** Newest flight with a manifest but nothing on the scale yet. */
  in_transit: FlightVolume | null;
  month_arrived: number;
  month_scheduled: number;
  month_delayed: number;
}

export async function getFlightVolumeSummary(): Promise<FlightVolumeSummary> {
  const { data } = await apiClient.get<FlightVolumeSummary>(
    '/api/v1/flight-schedule/volume-summary',
  );
  return data;
}

// ---------------------------------------------------------------------------
// Global search
// ---------------------------------------------------------------------------

export interface SearchClientHit {
  id: number;
  full_name: string;
  client_code: string | null;
  phone: string | null;
}

export interface SearchFlightHit {
  flight_name: string;
}

export interface SearchTrackHit {
  track_code: string;
  flight_name: string | null;
  client_code: string | null;
  /** `expected` has not reached Tashkent yet; `arrived` is in the manifest. */
  source: string;
}

export interface SearchResults {
  query: string;
  clients: SearchClientHit[];
  flights: SearchFlightHit[];
  tracks: SearchTrackHit[];
  /**
   * Which domains the caller was allowed to search. An empty result list means
   * "nothing found" only for a domain named here — otherwise it means "not
   * permitted", and the palette must not imply the record does not exist.
   */
  granted_scopes: string[];
  truncated: boolean;
}

export async function adminSearch(q: string): Promise<SearchResults> {
  const { data } = await apiClient.get<SearchResults>('/api/v1/admin/search', {
    params: { q },
  });
  return data;
}
