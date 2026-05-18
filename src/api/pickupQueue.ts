import { apiClient } from './client';

// ─── Admin header helper ───────────────────────────────────────────────────────
// Reuses the same admin auth pattern as src/api/pos.ts
const getAdminHeaders = () => {
  const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
  return { 'X-Admin-Authorization': `Bearer ${token}` };
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type PickupMethod = 'self_pickup' | 'yandex' | 'bts' | 'uzpost' | 'mandarin';

export type PickupQueueStatus = 'preparing' | 'ready' | 'cancelled' | 'expired';

export type PickupQueuePriority = 'vip' | 'high' | 'normal';

export const PICKUP_METHOD_LABELS: Record<PickupMethod, string> = {
  self_pickup: "O'zi olib ketadi",
  yandex: 'Yandex',
  bts: 'BTS',
  uzpost: 'UzPost',
  mandarin: 'Mandarin',
};

export const PICKUP_STATUS_LABELS: Record<PickupQueueStatus, string> = {
  preparing: 'Tayyorlanmoqda',
  ready: 'Tayyor',
  cancelled: 'Bekor qilingan',
  expired: "Muddati o'tgan",
};

export const PICKUP_PRIORITY_LABELS: Record<PickupQueuePriority, string> = {
  vip: 'VIP',
  high: 'Yuqori',
  normal: 'Oddiy',
};

// ─── Request / Response interfaces ────────────────────────────────────────────

export interface PickupQueueCreateRequest {
  transaction_ids: number[];
  pickup_method: PickupMethod;
  priority?: PickupQueuePriority;
  note?: string | null;
  idempotency_key?: string | null;
}

export interface PickupQueueByClientCodeRequest {
  client_code: string;
  pickup_method: PickupMethod;
  priority?: PickupQueuePriority;
  note?: string | null;
}

export interface PickupQueueCancelRequest {
  reason?: string | null;
}

export interface PickupQueueBellCountResponse {
  preparing_count: number;
  priority_counts: Record<string, number>;
}

export interface WarehousePickupQueueListParams {
  status?: PickupQueueStatus;
  pickup_method?: PickupMethod;
  priority?: PickupQueuePriority;
  client_code?: string;
  order_by_time?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

export interface WarehousePickupQueueListResponse {
  page: number;
  size: number;
  total: number;
  items: WarehousePickupQueueEntry[];
}

export interface WarehousePickupQueueEntry {
  queue_id: number;
  display_number: number;
  business_date: string;
  client_code: string;
  pickup_method: PickupMethod;
  queue_status: PickupQueueStatus;
  priority: PickupQueuePriority;
  source: 'pos_bulk_payment' | 'pos_manual' | 'warehouse_manual' | 'delivery_request';
  note: string | null;
  cargo_count: number;
  remaining_cargo_count: number;
  ready_count: number;
  created_at: string;
  ready_at: string | null;
  expires_at: string;
  flights: WarehousePickupQueueFlight[];
  // ── Courier hand-off block (delivery_request only) ──
  delivery_request_id: number | null;
  recipient_phone: string | null;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  location_url: string | null;
}

export interface WarehousePickupQueueFlight {
  flight_name: string;
  flight_cargo_photos: string[];
  transactions: WarehousePickupQueueTransaction[];
}

export interface WarehousePickupQueueTransaction {
  id: number;
  qator_raqami: number;
  vazn: string;
  summa: number | null;
  payment_status: string | null;
  paid_amount: number | null;
  remaining_amount: number | null;
  is_taken_away: boolean;
  taken_away_date: string | null;
  selected_in_queue: true;
}

export interface PickupQueueTVActivateRequest {
  passcode: string;
}

export interface PickupQueueTVActivateResponse {
  token: string;
  expires_at: string;
}

export interface PickupQueueTVParams {
  status?: 'preparing' | 'ready';
  pickup_method?: PickupMethod;
  date_from?: string;
  date_to?: string;
  order_by_time?: 'asc' | 'desc';
  limit?: number;
}

export interface PickupQueueTVResponse {
  items: PickupQueueTVItem[];
}

export interface PickupQueueTVItem {
  display_number: number;
  client_code: string;
  flight_names: string[];
  pickup_method: PickupMethod;
  status: 'preparing' | 'ready';
  cargo_count: number;
  remaining_cargo_count: number;
  created_at: string;
  ready_at: string | null;
}

// ── POS preview card ─────────────────────────────────────────────────────────

export interface PosPickupQueueItem {
  id: number;
  display_number: number;
  client_code: string;
  pickup_method: PickupMethod;
  priority: PickupQueuePriority;
  status: PickupQueueStatus;
  note: string | null;
  created_at: string;
}

export interface PosPickupQueueListResponse {
  items: PosPickupQueueItem[];
}

export interface PosPickupQueueUpdateRequest {
  note?: string | null;
  pickup_method?: PickupMethod;
  priority?: PickupQueuePriority;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function createPosPickupQueue(data: PickupQueueCreateRequest): Promise<unknown> {
  const res = await apiClient.post<unknown>('/api/v1/pos/pickup-queue', data, {
    headers: getAdminHeaders(),
  });
  return res.data;
}

export async function createPosPickupQueueByClientCode(data: PickupQueueByClientCodeRequest): Promise<unknown> {
  const res = await apiClient.post<unknown>('/api/v1/pos/pickup-queue/by-client-code', data, {
    headers: getAdminHeaders(),
  });
  return res.data;
}

export async function createWarehousePickupQueue(data: PickupQueueCreateRequest): Promise<unknown> {
  const res = await apiClient.post<unknown>('/api/v1/warehouse/pickup-queue', data, {
    headers: getAdminHeaders(),
  });
  return res.data;
}

export async function getWarehousePickupQueueCount(params: {
  status?: PickupQueueStatus;
  pickup_method?: PickupMethod;
}): Promise<PickupQueueBellCountResponse> {
  const res = await apiClient.get<PickupQueueBellCountResponse>('/api/v1/warehouse/pickup-queue/count', {
    params,
    headers: getAdminHeaders(),
  });
  return res.data;
}

export async function getWarehousePickupQueueList(
  params: WarehousePickupQueueListParams,
): Promise<WarehousePickupQueueListResponse> {
  const res = await apiClient.get<WarehousePickupQueueListResponse>('/api/v1/warehouse/pickup-queue', {
    params,
    headers: getAdminHeaders(),
  });
  return res.data;
}

export async function getWarehousePickupQueue(queueId: number): Promise<WarehousePickupQueueEntry> {
  const res = await apiClient.get<WarehousePickupQueueEntry>(`/api/v1/warehouse/pickup-queue/${queueId}`, {
    headers: getAdminHeaders(),
  });
  return res.data;
}

export async function cancelPickupQueue(
  queueId: number,
  data: PickupQueueCancelRequest,
): Promise<unknown> {
  const res = await apiClient.post<unknown>(`/api/v1/warehouse/pickup-queue/${queueId}/cancel`, data, {
    headers: getAdminHeaders(),
  });
  return res.data;
}

export async function activatePickupQueueTV(
  data: PickupQueueTVActivateRequest,
): Promise<PickupQueueTVActivateResponse> {
  const res = await apiClient.post<PickupQueueTVActivateResponse>('/api/v1/pickup-queue/tv/activate', data, {
    headers: getAdminHeaders(),
  });
  return res.data;
}

export async function getPickupQueueTV(
  params: PickupQueueTVParams,
  token: string,
): Promise<PickupQueueTVResponse> {
  const res = await apiClient.get<PickupQueueTVResponse>('/api/v1/pickup-queue/tv', {
    params,
    headers: {
      'X-TV-Token': token,
    },
  });
  return res.data;
}

export async function getPosPickupQueueList(): Promise<PosPickupQueueListResponse> {
  const res = await apiClient.get<PosPickupQueueListResponse>('/api/v1/pos/pickup-queue', {
    headers: getAdminHeaders(),
  });
  return res.data;
}

export async function updatePosPickupQueue(
  queueId: number,
  data: PosPickupQueueUpdateRequest,
): Promise<PosPickupQueueItem> {
  const res = await apiClient.patch<PosPickupQueueItem>(`/api/v1/pos/pickup-queue/${queueId}`, data, {
    headers: getAdminHeaders(),
  });
  return res.data;
}

export async function cancelPosPickupQueue(
  queueId: number,
  reason?: string | null,
): Promise<unknown> {
  const res = await apiClient.post<unknown>(`/api/v1/pos/pickup-queue/${queueId}/cancel`, {
    reason: reason || null,
  }, {
    headers: getAdminHeaders(),
  });
  return res.data;
}
