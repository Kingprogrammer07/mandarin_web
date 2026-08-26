import { apiClient } from '../client';

// ── Legacy types & functions (used by FlightSchedulePage & FlightScheduleAdminPage) ──

export interface FlightScheduleItem {
  id: number;
  flight_name: string;
  flight_date: string;
  type: 'avia' | 'aksiya';
  status: 'arrived' | 'scheduled' | 'delayed';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlightScheduleListResponse {
  year: number;
  total: number;
  items: FlightScheduleItem[];
}

export interface CreateFlightScheduleRequest {
  flight_name: string;
  flight_date: string;
  type: 'avia' | 'aksiya';
  status: 'arrived' | 'scheduled' | 'delayed';
  notes?: string | null;
}

export interface UpdateFlightScheduleRequest {
  flight_name?: string;
  flight_date?: string;
  type?: 'avia' | 'aksiya';
  status?: 'arrived' | 'scheduled' | 'delayed';
  notes?: string | null;
}

export const getFlightSchedule = async (year?: number): Promise<FlightScheduleListResponse> => {
  const response = await apiClient.get<FlightScheduleListResponse>('/api/v1/flight-schedule', {
    params: year ? { year } : undefined,
  });
  return response.data;
};

export const createFlightSchedule = async (
  data: CreateFlightScheduleRequest
): Promise<FlightScheduleItem> => {
  const response = await apiClient.post<FlightScheduleItem>('/api/v1/flight-schedule', data);
  return response.data;
};

export const updateFlightSchedule = async (
  id: number,
  data: UpdateFlightScheduleRequest
): Promise<FlightScheduleItem> => {
  const response = await apiClient.put<FlightScheduleItem>(`/api/v1/flight-schedule/${id}`, data);
  return response.data;
};

export const deleteFlightSchedule = async (id: number): Promise<{ deleted_id: number; message: string }> => {
  const response = await apiClient.delete(`/api/v1/flight-schedule/${id}`);
  return response.data;
};

// ── New types & functions (used by FlightsPage) ──

export interface FlightStats {
  cargo_count: number;
  client_count: number;
  total_weight_kg: number;
  remaining_cargos: number;
  remaining_clients: number;
  remaining_weight_kg: number;
}

export interface FlightWithStats {
  name: string;
  stats: FlightStats;
}

export interface FlightWithStatsListResponse {
  items: FlightWithStats[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface FlightListParams {
  page?: number;
  per_page?: number;
  search?: string;
}

export interface FlightDashboardStats {
  /** `flight_cargos` rows — one client can hold several, so NOT a parcel count. */
  cargo_count: number;
  /**
   * `client_transaction_data` rows for the flight. The only figure that shares
   * a population with `remaining_cargos`, so the only honest denominator for a
   * handed-over ratio. Optional: the SPA deploys ahead of the backend.
   */
  transaction_count?: number;
  /**
   * Weight split, all four from `client_transaction_data` so the ratios add up.
   * `total_weight_kg` above comes from `flight_cargos` — a different table with
   * different cardinality — and must not be mixed into these.
   *
   * `unclaimed_weight_kg` ("ostatka") is a SUBSET of `unpaid_weight_kg`: cargo
   * whose client has neither paid nor collected. Never add it to the other two.
   */
  transaction_weight_kg?: number;
  paid_weight_kg?: number;
  unpaid_weight_kg?: number;
  unclaimed_weight_kg?: number;
  client_count: number;
  total_weight_kg: number;
  remaining_cargos: number;
  remaining_clients: number;
  remaining_weight_kg: number;
  expected_clients: number;
  expected_track_codes: number;
}

export type FlightDashboardType = 'avia' | 'ostatka' | 'custom';
export type FlightDashboardStatus = 'new' | 'active' | 'completed';

export interface FlightDashboardItem {
  name: string;
  type: FlightDashboardType;
  status: FlightDashboardStatus;
  source: 'flight_cargos' | 'expected_cargo' | 'google_sheets';
  is_new: boolean;
  last_activity_at: string | null;
  stats: FlightDashboardStats;
  /**
   * Shown in the board's photo-report and track-code sections.
   *
   * Optional because the frontend deploys to Vercel on push while the backend
   * ships separately: for the window between the two, an older API returns
   * rows without these fields and a required type would render `undefined`.
   */
  is_visible?: boolean;
  /**
   * `null` means the flight has never been placed on the board — which is not
   * position 0. The table sorts unplaced flights last, so collapsing the two
   * would push every untouched flight above the arranged board.
   */
  sort_order?: number | null;
}

export interface FlightDashboardResponse {
  items: FlightDashboardItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface FlightDashboardParams {
  page?: number;
  per_page?: number;
  search?: string;
  type?: 'all' | FlightDashboardType;
  status?: 'active' | 'new' | 'completed' | 'all';
  sort?: 'newest' | 'remaining_desc' | 'name_asc';
  /** Only flights switched on for the board. Replaces `sort` with the manual order. */
  visible_only?: boolean;
}

/** Counts behind the three cards at the top of the Reyslar page. */
export interface FlightBoardSummary {
  total: number;
  visible: number;
  hidden: number;
}

export const getFlightsWithStats = async (
  params: FlightListParams = {}
): Promise<FlightWithStatsListResponse> => {
  const response = await apiClient.get<FlightWithStatsListResponse>('/api/v1/flights/with-stats', {
    params,
  });
  return response.data;
};

export const getFlightsDashboard = async (
  params: FlightDashboardParams = {},
): Promise<FlightDashboardResponse> => {
  const response = await apiClient.get<FlightDashboardResponse>('/api/v1/flights/dashboard', {
    params,
  });
  return response.data;
};

// ─── Board: visibility and manual order ──────────────────────────────────────

export const getFlightBoardSummary = async (): Promise<FlightBoardSummary> => {
  const response = await apiClient.get<FlightBoardSummary>('/api/v1/flights/board/summary');
  return response.data;
};

/** Switch one flight on or off for the board. */
export const setFlightVisibility = async (
  flightName: string,
  isVisible: boolean,
): Promise<{ flight_name: string; is_visible: boolean; sort_order: number }> => {
  const response = await apiClient.patch(
    `/api/v1/flights/${encodeURIComponent(flightName)}/visibility`,
    { is_visible: isVisible },
  );
  return response.data;
};

/**
 * Write the board order, first name first.
 *
 * Only the names sent are renumbered, so the caller may send just the visible
 * board without pushing every other flight to the end.
 */
export const setFlightBoardOrder = async (
  flightNames: string[],
): Promise<{ updated: number }> => {
  const response = await apiClient.put('/api/v1/flights/board/order', {
    flight_names: flightNames,
  });
  return response.data;
};
