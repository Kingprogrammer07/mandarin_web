import { apiClient, apiClientFormData } from '../client';

// ── Client Search ──────────────────────────────────────────────────────────

export interface WarehouseClientItem {
  id: number;
  primary_code: string;
  full_name: string;
  phone: string | null;
}

export interface WarehouseClientSearchResponse {
  items: WarehouseClientItem[];
  total_count: number;
  total_pages: number;
  page: number;
  size: number;
}

// ── Flights ────────────────────────────────────────────────────────────────

export interface WarehouseFlightItem {
  flight_name: string;
  tx_count: number;
  user_count: number;
  latest_at: string;
}

export interface WarehouseFlightsResponse {
  items: WarehouseFlightItem[];
}

// ── Transactions ───────────────────────────────────────────────────────────

export interface WarehouseTransactionItem {
  id: number;
  client_code: string;
  client_full_name: string | null;
  client_phone: string | null;
  reys: string;
  qator_raqami: number;
  vazn: string;
  total_amount: number | null;
  paid_amount: number;
  remaining_amount: number;
  payment_status: string;
  is_taken_away: boolean;
  taken_away_date: string | null;
  has_proof: boolean;
  created_at: string;
}

export interface WarehouseTransactionsResponse {
  flight_name: string;
  items: WarehouseTransactionItem[];
  total_count: number;
  total_pages: number;
  page: number;
  size: number;
}

// ── Mark Taken ─────────────────────────────────────────────────────────────

export interface DeliveryProofResponse {
  proof_id: number;
  transaction_id: number;
  delivery_method: string;
  photo_s3_keys: string[];
  marked_by_admin_id: number | null;
  created_at: string;
}

export interface MarkTakenResponse {
  transaction_id: number;
  client_code: string;
  flight_name: string;
  delivery_method: string;
  delivery_method_label: string;
  photo_count: number;
  proof: DeliveryProofResponse;
  telegram_notified: boolean;
  message: string;
}

// ── My Activity ────────────────────────────────────────────────────────────

export interface WarehouseActivityItem {
  proof_id: number;
  transaction_id: number;
  client_code: string;
  flight_name: string;
  total_amount: number | null;
  paid_amount: number;
  remaining_amount: number;
  payment_status: string;
  delivery_method: string;
  delivery_method_label: string;
  photo_urls: string[];
  photo_count: number;
  created_at: string;
}

export interface WarehouseActivityResponse {
  items: WarehouseActivityItem[];
  total_count: number;
  total_pages: number;
  page: number;
  size: number;
}

// ── Search Params ──────────────────────────────────────────────────────────

export interface SearchWarehouseClientsParams {
  code?: string;
  phone?: string;
  name?: string;
  q?: string;
  page?: number;
  size?: number;
}

export interface GetFlightTransactionsParams {
  payment_status?: string;
  taken_status?: string;
  code?: string;
  phone?: string;
  name?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

export interface SearchTransactionsParams {
  code?: string;
  phone?: string;
  name?: string;
  q?: string;
  flight?: string;
  payment_status?: string;
  taken_status?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

export interface WarehouseTransactionsSearchResponse {
  items: WarehouseTransactionItem[];
  total_count: number;
  total_pages: number;
  page: number;
  size: number;
}

// 📦 Grouped Search Types
export interface GroupedTransactionItem {
  id: number;
  qator_raqami: number;
  vazn: string;
  summa: number;
  payment_status: string;
  remaining_amount: number;
  is_taken_away: boolean;
  taken_away_date: string | null;
  comment: string | null;
  has_proof: boolean;
}

export interface FlightGroup {
  flight_name: string;
  total_weight_kg: number;
  total_amount: number;
  total_remaining_amount: number;
  flight_cargo_photos: string[];
  transactions: GroupedTransactionItem[];
}

export interface ClientGroup {
  client_code: string;
  full_name: string | null;
  phone: string | null;
  wallet_balance: number;
  debt: number;
  total_unpaid_amount: number;
  flights: FlightGroup[];
}

export interface WarehouseGroupedSearchResponse {
  items: ClientGroup[];
  total_count: number;
  page: number;
  size: number;
}

// 📦 Bulk Mark Taken
export interface BulkMarkTakenResponse {
  transaction_ids: number[];
  client_code: string;
  delivery_method: string;
  delivery_method_label: string;
  photo_count: number;
  proofs_created: number;
  telegram_notified: boolean;
  message: string;
}

// API Functions

export async function getWarehouseFlights(
  limit = 10,
): Promise<WarehouseFlightsResponse> {
  const response = await apiClient.get<WarehouseFlightsResponse>(
    '/api/v1/warehouse/flights',
    { params: { limit } },
  );
  return response.data;
}

export async function searchWarehouseClients(
  params: SearchWarehouseClientsParams,
): Promise<WarehouseClientSearchResponse> {
  const response = await apiClient.get<WarehouseClientSearchResponse>(
    '/api/v1/warehouse/clients/search',
    { params },
  );
  return response.data;
}

export async function getFlightTransactions(
  flightName: string,
  params: GetFlightTransactionsParams = {},
): Promise<WarehouseTransactionsResponse> {
  const response = await apiClient.get<WarehouseTransactionsResponse>(
    `/api/v1/warehouse/flight/${encodeURIComponent(flightName)}/transactions`,
    {
      params: {
        payment_status: params.payment_status ?? 'all',
        taken_status: params.taken_status ?? 'all',
        ...(params.code ? { code: params.code } : {}),
        ...(params.phone ? { phone: params.phone } : {}),
        ...(params.name ? { name: params.name } : {}),
        sort_order: params.sort_order ?? 'asc',
        page: params.page ?? 1,
        size: params.size ?? 50,
      },
    },
  );
  return response.data;
}

export async function markTransactionTaken(
  transactionId: number,
  data: FormData,
): Promise<MarkTakenResponse> {
  const response = await apiClientFormData.post<MarkTakenResponse>(
    `/api/v1/warehouse/transactions/${transactionId}/mark-taken`,
    data,
  );
  return response.data;
}

export async function searchTransactions(
  params: SearchTransactionsParams,
): Promise<WarehouseTransactionsSearchResponse> {
  const response = await apiClient.get<WarehouseTransactionsSearchResponse>(
    '/api/v1/warehouse/transactions/search',
    {
      params: {
        ...(params.code ? { code: params.code } : {}),
        ...(params.phone ? { phone: params.phone } : {}),
        ...(params.name ? { name: params.name } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.flight ? { flight: params.flight } : {}),
        payment_status: params.payment_status ?? 'all',
        taken_status: params.taken_status ?? 'all',
        sort_order: params.sort_order ?? 'desc',
        page: params.page ?? 1,
        size: params.size ?? 50,
      },
    },
  );
  return response.data;
}

export async function getMyActivity(
  page = 1,
  size = 20,
): Promise<WarehouseActivityResponse> {
  const response = await apiClient.get<WarehouseActivityResponse>(
    '/api/v1/warehouse/my-activity',
    { params: { page, size } },
  );
  return response.data;
}
export async function searchTransactionsGrouped(params: SearchTransactionsParams): Promise<WarehouseGroupedSearchResponse> {
  const response = await apiClient.get<WarehouseGroupedSearchResponse>('/api/v1/warehouse/transactions/search-grouped', {
    params: {
      ...(params.code ? { code: params.code } : {}),
      ...(params.phone ? { phone: params.phone } : {}),
      ...(params.name ? { name: params.name } : {}),
      ...(params.q ? { q: params.q } : {}),
      ...(params.flight ? { flight: params.flight } : {}),
      payment_status: params.payment_status ?? 'all',
      taken_status: params.taken_status ?? 'all',
      sort_order: params.sort_order ?? 'desc',
      page: params.page ?? 1,
      size: params.size ?? 50,
    },
  });
  return response.data;
}

export async function bulkMarkTransactionTaken(data: FormData): Promise<BulkMarkTakenResponse> {
  const response = await apiClientFormData.post<BulkMarkTakenResponse>('/api/v1/warehouse/transactions/bulk-mark-taken', data);
  return response.data;
}
