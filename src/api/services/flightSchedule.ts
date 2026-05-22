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
  cargo_count: number;
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
  source: 'flight_cargos' | 'expected_cargo';
  is_new: boolean;
  last_activity_at: string | null;
  stats: FlightDashboardStats;
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
