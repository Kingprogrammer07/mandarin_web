import { apiClient } from '@/api/client';

export interface FlightTrackingStatus {
  flight_name: string;
  step_2_status: string;
  step_3_status: string;
  step_4_status: string;
  step_2_is_manual: boolean;
  step_3_is_manual: boolean;
  step_4_is_manual: boolean;
  updated_at: string | null;
}

export interface UpdateTrackingRequest {
  step_2_status?: string | null;
  step_3_status?: string | null;
  step_4_status?: string | null;
}

/**
 * Oxirgi 20 ta reysning tracking statuslarini olish
 */
export async function getFlightTrackingStatuses(): Promise<FlightTrackingStatus[]> {
  const response = await apiClient.get<FlightTrackingStatus[]>('/api/v1/admin/flights/tracking');
  return response.data;
}

/**
 * Reysning step statuslarini yangilash
 */
export async function updateFlightTrackingSteps(
  flightName: string,
  data: UpdateTrackingRequest,
): Promise<FlightTrackingStatus> {
  const response = await apiClient.put<FlightTrackingStatus>(
    `/api/v1/admin/flights/${encodeURIComponent(flightName)}/steps`,
    data,
  );
  return response.data;
}
