import { apiClient } from '@/api/client';

export type TrackingStepStatus = 'available' | 'pending' | 'nodata';

/**
 * What the automatic rule says about one step, ignoring any manual override.
 *
 * `partial` is admin-only: the flight is mixed (some parcels scanned, some not).
 * Clients never see it — their tracker stays three-valued.
 */
export interface StepAutoStatus {
  status: 'available' | 'partial' | 'pending' | 'nodata';
  /** Units the signal already counts as done. */
  matched: number;
  total: number;
  unit: 'parcel' | 'client';
}

export interface FlightTrackingStatus {
  flight_name: string;
  /** What clients currently see — the override when one is set. */
  step_2_status: TrackingStepStatus;
  step_3_status: TrackingStepStatus;
  step_4_status: TrackingStepStatus;
  step_2_is_manual: boolean;
  step_3_is_manual: boolean;
  step_4_is_manual: boolean;
  /** What the warehouse data says on its own. */
  step_2_auto: StepAutoStatus | null;
  step_3_auto: StepAutoStatus | null;
  step_4_auto: StepAutoStatus | null;
  /** Report progress. Not overridable, but it is the end-of-flight number. */
  step_5_auto: StepAutoStatus | null;
  total_parcels: number;
  total_clients: number;
  updated_at: string | null;
}

export interface ClearFlightTrackingStepResponse {
  flight_name: string;
  step_number: number;
  cleared: boolean;
  message: string;
}

export interface UpdateTrackingRequest {
  step_2_status?: TrackingStepStatus | null;
  step_3_status?: TrackingStepStatus | null;
  step_4_status?: TrackingStepStatus | null;
}

export interface DeleteFlightCargoItemsResponse {
  flight_name: string;
  deleted_count: number;
  message: string;
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

/**
 * Qo'lda qo'yilgan step statusini olib tashlash — reys yana avtomatik
 * signalga qaytadi. Busiz override abadiy qolib ketardi.
 */
export async function clearFlightTrackingStep(
  flightName: string,
  stepNumber: number,
): Promise<ClearFlightTrackingStepResponse> {
  const response = await apiClient.delete<ClearFlightTrackingStepResponse>(
    `/api/v1/admin/flights/${encodeURIComponent(flightName)}/steps/${stepNumber}`,
  );
  return response.data;
}

/**
 * Reysga tegishli barcha cargo_items qatorlarini o'chirish
 */
export async function deleteFlightCargoItems(
  flightName: string,
): Promise<DeleteFlightCargoItemsResponse> {
  const response = await apiClient.delete<DeleteFlightCargoItemsResponse>(
    `/api/v1/admin/flights/${encodeURIComponent(flightName)}/cargo-items`,
  );
  return response.data;
}
