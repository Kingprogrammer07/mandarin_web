import { apiClient } from '../client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FlightScheduleItem {
  id: number;
  /** Human-readable flight or event name, e.g. "MC-1044" or "Navro'z bayrami". */
  flight_name: string;
  /** ISO date string, e.g. "2025-04-15". */
  flight_date: string;
  /** "avia" = regular cargo flight; "aksiya" = promotional/holiday event. */
  type: 'avia' | 'aksiya';
  status: 'arrived' | 'scheduled' | 'delayed';
  /** Optional description for aksiya events; null for regular flights. */
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlightScheduleResponse {
  year: number;
  items: FlightScheduleItem[];
  total: number;
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

export interface DeleteFlightScheduleResponse {
  deleted_id: number;
  message: string;
}

// ── API ────────────────────────────────────────────────────────────────────────

/**
 * Fetch the flight schedule for a given year.
 * Backend: GET /api/v1/flight-schedule?year=YYYY
 */
export const getFlightSchedule = async (year?: number): Promise<FlightScheduleResponse> => {
  const response = await apiClient.get<FlightScheduleResponse>('/api/v1/flight-schedule', {
    params: { year: year ?? new Date().getFullYear() },
  });
  return response.data;
};

/**
 * Create a new flight schedule entry.
 * Backend: POST /api/v1/flight-schedule
 */
export const createFlightSchedule = async (
  body: CreateFlightScheduleRequest,
): Promise<FlightScheduleItem> => {
  const response = await apiClient.post<FlightScheduleItem>('/api/v1/flight-schedule', body);
  return response.data;
};

/**
 * Partially update an existing entry.
 * Backend: PUT /api/v1/flight-schedule/{id}
 */
export const updateFlightSchedule = async (
  id: number,
  body: UpdateFlightScheduleRequest,
): Promise<FlightScheduleItem> => {
  const response = await apiClient.put<FlightScheduleItem>(`/api/v1/flight-schedule/${id}`, body);
  return response.data;
};

/**
 * Delete a flight schedule entry.
 * Backend: DELETE /api/v1/flight-schedule/{id}
 */
export const deleteFlightSchedule = async (
  id: number,
): Promise<DeleteFlightScheduleResponse> => {
  const response = await apiClient.delete<DeleteFlightScheduleResponse>(
    `/api/v1/flight-schedule/${id}`,
  );
  return response.data;
};
