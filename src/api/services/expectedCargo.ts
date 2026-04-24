import { apiClient } from '../client';

// ── Shared read schema ─────────────────────────────────────────────────────────

export interface ExpectedCargoItem {
  id: number;
  flight_name: string;
  client_code: string;
  track_code: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedExpectedCargoResponse {
  items: ExpectedCargoItem[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

// ── API 1 — Bulk create ────────────────────────────────────────────────────────

export interface BulkCreateExpectedCargoRequest {
  flight_name: string;
  client_code: string;
  track_codes: string[];
}

export interface BulkCreateExpectedCargoResponse {
  created_count: number;
  duplicate_track_codes: string[];
}

// ── API 3 — Replace-all ────────────────────────────────────────────────────────

export interface ReplaceTrackCodesRequest {
  flight_name: string;
  client_code: string;
  new_track_codes: string[];
}

export interface ReplaceTrackCodesResponse {
  deleted_count: number;
  created_count: number;
}

// ── API 4 — Rename flight ──────────────────────────────────────────────────────

export interface RenameFlightRequest {
  old_flight_name: string;
  new_flight_name: string;
}

export interface RenameFlightResponse {
  updated_count: number;
  old_flight_name: string;
  new_flight_name: string;
}

// ── API 4b — Rename client code ──────────────────────────────────────────────────

export interface RenameClientCodeRequest {
  old_client_code: string;
  new_client_code: string;
  flight_name?: string;
}

export interface RenameClientCodeResponse {
  updated_count: number;
}

// ── API 5 — Dynamic delete ─────────────────────────────────────────────────────

export interface DeleteExpectedCargoResponse {
  deleted_count: number;
}

// ── API 7 — Resolve client ─────────────────────────────────────────────────────

/** 409 error body returned when a track code is already in the expected cargo table. */
export interface AlreadySentErrorBody {
  detail: string;
  track_code: string;
  flight_name: string | null;
}

export interface ResolvedClientResponse {
  client_id: number;
  client_code: string;
  full_name: string;
  phone: string | null;
  track_code: string;
  flight_name: string;
}

// ── API 8 — Summary stats ──────────────────────────────────────────────────────

export interface ExpectedCargoSummaryStats {
  total_records: number;
  total_unique_flights: number;
  total_unique_clients: number;
}

// ── API 9 — Stats by flight ────────────────────────────────────────────────────

export interface FlightStatItem {
  flight_name: string;
  client_count: number;
  track_code_count: number;
}

export interface PaginatedFlightStatsResponse {
  items: FlightStatItem[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

// ── API 10 — Stats by client ───────────────────────────────────────────────────

export interface ClientStatItem {
  client_code: string;
  flight_count: number;
  track_code_count: number;
}

export interface PaginatedClientStatsResponse {
  items: ClientStatItem[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

// ── API 11 — Summary by flight ─────────────────────────────────────────────────

export interface ClientSummaryItem {
  client_code: string;
  total_track_codes: number;
}

export interface PaginatedClientSummaryResponse {
  flight_name: string;
  items: ClientSummaryItem[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

// ── API 12 — Flight list ───────────────────────────────────────────────────────

export interface FlightListItem {
  flight_name: string;
  client_count: number;
  track_code_count: number;
}

export interface FlightListResponse {
  items: FlightListItem[];
  total: number;
}

// ── API 13 — Empty flight registration ───────────────────────────────────────

export interface CreateEmptyFlightRequest {
  flight_name: string;
}

export interface CreateEmptyFlightResponse {
  flight_name: string;
  created: boolean;
}

// ── Search params ──────────────────────────────────────────────────────────────

export interface SearchExpectedCargoParams {
  page?: number;
  size?: number;
  flight_name?: string;
  client_code?: string;
  track_code?: string;
}

// ── API Functions ──────────────────────────────────────────────────────────────

const BASE = '/api/v1/admin/expected-cargos';

/** API 1 — Register one or more tracking codes under a given flight and client. */
export async function bulkCreateExpectedCargo(
  payload: BulkCreateExpectedCargoRequest,
): Promise<BulkCreateExpectedCargoResponse> {
  const response = await apiClient.post<BulkCreateExpectedCargoResponse>(BASE, payload);
  return response.data;
}

/** API 2 — Return a paginated list of expected cargo records with optional filters. */
export async function searchExpectedCargo(
  params: SearchExpectedCargoParams = {},
): Promise<PaginatedExpectedCargoResponse> {
  const response = await apiClient.get<PaginatedExpectedCargoResponse>(BASE, { params });
  return response.data;
}

/** API 3 — Atomically replace all track codes for a client in a flight. */
export async function replaceTrackCodes(
  payload: ReplaceTrackCodesRequest,
): Promise<ReplaceTrackCodesResponse> {
  const response = await apiClient.put<ReplaceTrackCodesResponse>(
    `${BASE}/replace`,
    payload,
  );
  return response.data;
}

/** API 4 — Update flight_name for every record matching old_flight_name. */
export async function renameFlight(
  payload: RenameFlightRequest,
): Promise<RenameFlightResponse> {
  const response = await apiClient.patch<RenameFlightResponse>(
    `${BASE}/rename-flight`,
    payload,
  );
  return response.data;
}

/** API 4b — Update client_code for every record matching old_client_code. */
export async function renameClientCode(
  payload: RenameClientCodeRequest,
): Promise<RenameClientCodeResponse> {
  const response = await apiClient.patch<RenameClientCodeResponse>(
    `${BASE}/rename-client-code`,
    payload,
  );
  return response.data;
}

/** API 5 — Delete expected cargo records by dynamic filter. */
export async function deleteExpectedCargo(params: {
  flight_name?: string;
  client_code?: string;
}): Promise<DeleteExpectedCargoResponse> {
  const response = await apiClient.delete<DeleteExpectedCargoResponse>(BASE, { params });
  return response.data;
}

/** API 6 — Download expected cargo data as an Excel file. */
export async function exportExpectedCargoExcel(flightName?: string): Promise<void> {
  let response;

  try {
    response = await apiClient.get<Blob>(`${BASE}/export/excel`, {
      params: flightName ? { flight_name: flightName } : {},
      responseType: 'blob',
    });
  } catch (raw: unknown) {
    // When responseType is 'blob', Axios wraps error response bodies as Blobs too.
    // The global interceptor cannot parse JSON from a Blob, so for 429 we must
    // manually read the Blob to surface the backend's exact Uzbek detail message
    // (which includes the remaining cooldown seconds, e.g. "Eksport 25 soniyadan …").
    const err = raw as { status?: number; data?: unknown; message?: string };
    if (err.status === 429 && err.data instanceof Blob) {
      try {
        const text = await err.data.text();
        const json = JSON.parse(text) as { detail?: string };
        throw new Error(json.detail ?? err.message ?? 'Juda ko\'p urinish. Biroz kuting.');
      } catch (parseError) {
        // If parseError is the Error we just threw, re-throw it; otherwise fall through.
        if (parseError instanceof Error) throw parseError;
      }
    }
    // For all other errors the interceptor has already resolved a user-facing message.
    throw new Error(err.message ?? 'Eksport qilishda xatolik yuz berdi');
  }

  const blobUrl = URL.createObjectURL(new Blob([response.data]));
  const anchor = document.createElement('a');
  anchor.href = blobUrl;

  const suffix = flightName ? flightName.replace(/\s/g, '_') : 'all';
  anchor.setAttribute('download', `expected_cargo_${suffix}.xlsx`);

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}

/** API 7 — Given a track_code, return the Client who owns it (warehouse scanning bridge). */
export async function resolveClientByTrackCode(
  trackCode: string,
  flightName?: string,
): Promise<ResolvedClientResponse> {
  const response = await apiClient.get<ResolvedClientResponse>(`${BASE}/resolve-client`, {
    params: {
      track_code: trackCode,
      ...(flightName ? { flight_name: flightName } : {}),
    },
  });
  return response.data;
}

/** API 8 — Return aggregate totals for the entire expected cargo table. */
export async function getExpectedCargoStats(): Promise<ExpectedCargoSummaryStats> {
  const response = await apiClient.get<ExpectedCargoSummaryStats>(`${BASE}/stats`);
  return response.data;
}

/** API 9 — Return per-flight statistics ordered by track code count. */
export async function getStatsByFlight(
  page = 1,
  size = 50,
  clientCode?: string,
): Promise<PaginatedFlightStatsResponse> {
  const response = await apiClient.get<PaginatedFlightStatsResponse>(
    `${BASE}/stats/by-flight`,
    {
      params: {
        page,
        size,
        ...(clientCode ? { client_code: clientCode } : {}),
      },
    },
  );
  return response.data;
}

/** API 10 — Return per-client statistics ordered by track code count. */
export async function getStatsByClient(
  page = 1,
  size = 50,
  flightName?: string,
): Promise<PaginatedClientStatsResponse> {
  const response = await apiClient.get<PaginatedClientStatsResponse>(
    `${BASE}/stats/by-client`,
    {
      params: {
        page,
        size,
        ...(flightName ? { flight_name: flightName } : {}),
      },
    },
  );
  return response.data;
}

/** API 11 — Return each client's track code count within a specific flight (collapsed list). */
export async function getClientSummaryByFlight(
  flightName: string,
  page = 1,
  size = 200,
): Promise<PaginatedClientSummaryResponse> {
  const response = await apiClient.get<PaginatedClientSummaryResponse>(`${BASE}/summary`, {
    params: { flight_name: flightName, page, size },
  });
  return response.data;
}

/** API 12 — Return all distinct flight names together with their aggregate counts. */
export async function getFlightList(): Promise<FlightListResponse> {
  const response = await apiClient.get<FlightListResponse>(`${BASE}/flights`);
  return response.data;
}

/** API 13 — Register an empty flight (no cargo yet). */
export async function createEmptyFlight(
  payload: CreateEmptyFlightRequest,
): Promise<CreateEmptyFlightResponse> {
  const response = await apiClient.post<CreateEmptyFlightResponse>(`${BASE}/flights`, payload);
  return response.data;
}
