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

export interface DeliveryMethodOption {
  value: string;
  label: string;
}

export interface UzPostPartySnapshot {
  name: string | null;
  phone: string | null;
  jurisdiction_name: string | null;
  location_id: number | null;
  location_name: string | null;
  index: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface UzPostPrinterJobSnapshot {
  job_id: number | null;
  status: string | null;
  response: Record<string, unknown> | null;
  submitted_at: string | null;
}

export interface UzPostOrderItem {
  delivery_request_id: number;
  delivery_request_status: string;
  client_id: number;
  client_code: string;
  telegram_id: number;
  full_name: string;
  phone: string;
  region: string | null;
  address: string | null;
  flight_names: string[];
  order_id: number | null;
  order_number: string;
  order_status: string | null;
  label_pdf_url: string | null;
  sender: UzPostPartySnapshot;
  recipient: UzPostPartySnapshot;
  printer: UzPostPrinterJobSnapshot;
  order_created_at: string | null;
  order_cancelled_at: string | null;
  created_at: string;
}

export interface UzPostOrdersResponse {
  items: UzPostOrderItem[];
  total_count: number;
  total_pages: number;
  page: number;
  size: number;
}

export interface UzPostOrderDetail extends UzPostOrderItem {
  order_response: Record<string, unknown> | null;
  cancel_response: Record<string, unknown> | null;
  live_order_detail: Record<string, unknown> | null;
}

export interface UzPostLabelResponse {
  delivery_request_id: number;
  order_id: number | null;
  order_number: string;
  pdf_url: string;
}

export interface UzPostCancelResponse {
  delivery_request_id: number;
  order_id: number | null;
  order_number: string;
  order_status: string | null;
  cancel_response: Record<string, unknown> | null;
}

export interface UzPostOrdersParams {
  page?: number;
  size?: number;
  date_from?: string;
  date_to?: string;
  order_status?: string;
  search?: string;
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
  available_delivery_methods: DeliveryMethodOption[];
  delivery_request_id: number | null;
  delivery_request_type: string | null;
  delivery_request_status: string | null;
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
  uzpost_order_id: number | null;
  uzpost_order_number: string | null;
  uzpost_label_pdf_url: string | null;
  uzpost_printer_job_id: number | null;
  uzpost_printer_status: string | null;
  message: string;
}

// ── My Activity ────────────────────────────────────────────────────────────

export interface WarehouseActivityItem {
  proof_id: number;
  transaction_id: number;
  proof_ids: number[];
  transaction_ids: number[];
  cargo_count: number;
  client_code: string | null;
  flight_name: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  remaining_amount: number | null;
  payment_status: string | null;
  delivery_method: string;
  delivery_method_label: string;
  transactions: WarehouseActivityTransactionItem[];
  photo_urls: string[];
  photo_count: number;
  uzpost_order_id: number | null;
  uzpost_order_number: string | null;
  uzpost_order_status: string | null;
  uzpost_label_pdf_url: string | null;
  uzpost_printer_job_id: number | null;
  uzpost_printer_status: string | null;
  created_at: string;
  worker_username: string | null;
  worker_role: string | null;
}

export interface WarehouseActivityTransactionItem {
  proof_id: number;
  transaction_id: number;
  row_number: number | null;
  weight: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  remaining_amount: number | null;
  payment_status: string | null;
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
  strict?: boolean;
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
  available_delivery_methods: DeliveryMethodOption[];
  delivery_request_id: number | null;
  delivery_request_type: string | null;
  delivery_request_status: string | null;
}

export interface FlightGroup {
  flight_name: string;
  total_weight_kg: number;
  total_amount: number;
  total_remaining_amount: number;
  flight_cargo_photos: string[];
  available_delivery_methods: DeliveryMethodOption[];
  delivery_request_id: number | null;
  delivery_request_type: string | null;
  delivery_request_status: string | null;
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
  uzpost_order_id: number | null;
  uzpost_order_number: string | null;
  uzpost_label_pdf_url: string | null;
  uzpost_printer_job_id: number | null;
  uzpost_printer_status: string | null;
  message: string;
}

export interface UndoTakeawayResponse {
  undone_count: number;
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

export interface ExportWarehouseParams {
  flight_name?: string;
  payment_status?: string;
  taken_status?: string;
  code?: string;
  phone?: string;
  name?: string;
}

/**
 * Download warehouse cargo as an Excel file. With no params it exports EVERY
 * flight and every cargo row; the optional filters mirror the per-flight list.
 */
export async function exportWarehouseTransactions(
  params: ExportWarehouseParams = {},
): Promise<Blob> {
  const response = await apiClient.get('/api/v1/warehouse/export', {
    params: {
      ...(params.flight_name ? { flight_name: params.flight_name } : {}),
      ...(params.payment_status && params.payment_status !== 'all'
        ? { payment_status: params.payment_status }
        : {}),
      ...(params.taken_status && params.taken_status !== 'all'
        ? { taken_status: params.taken_status }
        : {}),
      ...(params.code ? { code: params.code } : {}),
      ...(params.phone ? { phone: params.phone } : {}),
      ...(params.name ? { name: params.name } : {}),
    },
    responseType: 'blob',
  });
  return response.data as Blob;
}

export async function markTransactionTaken(
  transactionId: number,
  data: FormData,
  force = false,
): Promise<MarkTakenResponse> {
  const url = `/api/v1/warehouse/transactions/${transactionId}/mark-taken${force ? '?force=true' : ''}`;
  const response = await apiClientFormData.post<MarkTakenResponse>(url, data);
  return response.data;
}

export async function undoTakeaway(transactionIds: number[]): Promise<UndoTakeawayResponse> {
  const response = await apiClient.post<UndoTakeawayResponse>('/api/v1/warehouse/undo-takeaway', {
    transaction_ids: transactionIds,
  });
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

export interface WarehouseActivityQueryParams {
  page?: number;
  size?: number;
  client_code?: string;
  strict?: boolean;
}

export async function getMyActivity(
  params: WarehouseActivityQueryParams = {},
): Promise<WarehouseActivityResponse> {
  const response = await apiClient.get<WarehouseActivityResponse>(
    '/api/v1/warehouse/my-activity',
    {
      params: {
        page: params.page ?? 1,
        size: params.size ?? 20,
        ...(params.client_code ? { client_code: params.client_code } : {}),
        ...(params.strict ? { strict: 'true' } : {}),
      },
    },
  );
  return response.data;
}

export async function getAllWarehouseActivity(
  params: WarehouseActivityQueryParams = {},
): Promise<WarehouseActivityResponse> {
  const response = await apiClient.get<WarehouseActivityResponse>(
    '/api/v1/warehouse/all-activity',
    {
      params: {
        page: params.page ?? 1,
        size: params.size ?? 20,
        ...(params.client_code ? { client_code: params.client_code } : {}),
        ...(params.strict ? { strict: 'true' } : {}),
      },
    },
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
      ...(params.strict ? { strict: 'true' } : {}),
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

export async function getUzPostOrders(params: UzPostOrdersParams = {}): Promise<UzPostOrdersResponse> {
  const response = await apiClient.get<UzPostOrdersResponse>('/api/v1/warehouse/uzpost/orders', {
    params: {
      page: params.page ?? 1,
      size: params.size ?? 20,
      ...(params.date_from ? { date_from: params.date_from } : {}),
      ...(params.date_to ? { date_to: params.date_to } : {}),
      ...(params.order_status ? { order_status: params.order_status } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
  });
  return response.data;
}

export async function getUzPostOrderDetail(
  requestId: number,
  refreshLive = true,
): Promise<UzPostOrderDetail> {
  const response = await apiClient.get<UzPostOrderDetail>(
    `/api/v1/warehouse/uzpost/orders/${requestId}`,
    { params: { refresh_live: refreshLive } },
  );
  return response.data;
}

export async function getUzPostOrderLabel(requestId: number): Promise<UzPostLabelResponse> {
  const response = await apiClient.get<UzPostLabelResponse>(
    `/api/v1/warehouse/uzpost/orders/${requestId}/label`,
  );
  return response.data;
}

export async function cancelUzPostOrder(requestId: number): Promise<UzPostCancelResponse> {
  const response = await apiClient.post<UzPostCancelResponse>(
    `/api/v1/warehouse/uzpost/orders/${requestId}/cancel`,
  );
  return response.data;
}

// ── UzPost recovery: reprint + failed-order retry ──────────────────────────

export interface UzPostReprintResponse {
  delivery_request_id: number;
  order_number: string;
  printer_job_id: number | null;
  printer_status: string | null;
}

export interface UzPostOrderFailureItem {
  id: number;
  delivery_request_id: number | null;
  transaction_id: number | null;
  client_code: string | null;
  full_name: string | null;
  flight_names: string[];
  weight_kg: number | null;
  error_stage: string;
  error_message: string;
  status: string;
  created_at: string;
  recipient_name: string | null;
  recipient_index: string | null;
}

export interface UzPostOrderFailuresResponse {
  items: UzPostOrderFailureItem[];
  total_count: number;
  total_pages: number;
  page: number;
  size: number;
}

export interface UzPostFailureRetryResult {
  failure_id: number;
  success: boolean;
  order_number: string | null;
  error_stage: string | null;
  error_message: string | null;
}

export interface UzPostFailureRetryAllResponse {
  attempted: number;
  succeeded: number;
  failed: number;
  results: UzPostFailureRetryResult[];
}

export interface UzPostFailuresParams {
  page?: number;
  size?: number;
  failure_status?: string;
  search?: string;
}

export async function reprintUzPostOrder(requestId: number): Promise<UzPostReprintResponse> {
  const response = await apiClient.post<UzPostReprintResponse>(
    `/api/v1/warehouse/uzpost/orders/${requestId}/reprint`,
  );
  return response.data;
}

export async function getUzPostOrderFailures(
  params: UzPostFailuresParams = {},
): Promise<UzPostOrderFailuresResponse> {
  const response = await apiClient.get<UzPostOrderFailuresResponse>(
    '/api/v1/warehouse/uzpost/order-failures',
    {
      params: {
        page: params.page ?? 1,
        size: params.size ?? 20,
        failure_status: params.failure_status ?? 'pending',
        ...(params.search ? { search: params.search } : {}),
      },
    },
  );
  return response.data;
}

export async function retryUzPostOrderFailure(
  failureId: number,
): Promise<UzPostFailureRetryResult> {
  const response = await apiClient.post<UzPostFailureRetryResult>(
    `/api/v1/warehouse/uzpost/order-failures/${failureId}/retry`,
  );
  return response.data;
}

export async function retryAllUzPostOrderFailures(
  limit = 50,
): Promise<UzPostFailureRetryAllResponse> {
  const response = await apiClient.post<UzPostFailureRetryAllResponse>(
    '/api/v1/warehouse/uzpost/order-failures/retry-all',
    null,
    { params: { limit } },
  );
  return response.data;
}

export function getUzPostOrdersExportUrl(params: Omit<UzPostOrdersParams, 'page' | 'size'> = {}): string {
  const searchParams = new URLSearchParams();
  if (params.date_from) searchParams.set('date_from', params.date_from);
  if (params.date_to) searchParams.set('date_to', params.date_to);
  if (params.order_status) searchParams.set('order_status', params.order_status);
  if (params.search) searchParams.set('search', params.search);
  const query = searchParams.toString();
  return `/api/v1/warehouse/uzpost/orders/export${query ? `?${query}` : ''}`;
}

function filenameFromContentDisposition(header: string | undefined): string | null {
  if (!header) return null;

  const utf8Filename = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8Filename) return decodeURIComponent(utf8Filename.replace(/"/g, ''));

  const quotedFilename = header.match(/filename="([^"]+)"/i)?.[1];
  if (quotedFilename) return quotedFilename;

  return header.match(/filename=([^;]+)/i)?.[1]?.trim() ?? null;
}

export async function revertTakenStatus(transactionId: number): Promise<unknown> {
  const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
  const response = await apiClient.post<unknown>(
    `/api/v1/warehouse/transactions/${transactionId}/revert-taken`,
    {},
    {
      headers: { 'X-Admin-Authorization': `Bearer ${token}` },
    },
  );
  return response.data;
}

export async function downloadUzPostOrdersExport(
  params: Omit<UzPostOrdersParams, 'page' | 'size'> = {},
): Promise<void> {
  const response = await apiClient.get<Blob>(
    '/api/v1/warehouse/uzpost/orders/export',
    {
      params: {
        ...(params.date_from ? { date_from: params.date_from } : {}),
        ...(params.date_to ? { date_to: params.date_to } : {}),
        ...(params.order_status ? { order_status: params.order_status } : {}),
        ...(params.search ? { search: params.search } : {}),
      },
      responseType: 'blob',
    },
  );

  const contentDisposition = response.headers['content-disposition'];
  const headerValue = Array.isArray(contentDisposition)
    ? contentDisposition[0]
    : contentDisposition;
  const filename =
    filenameFromContentDisposition(headerValue) ??
    `uzpost_orders_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const blobUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}
