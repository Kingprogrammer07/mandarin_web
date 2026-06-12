import { apiClient } from '@/api/client';

export interface MaintenanceStatusResponse {
  maintenance: boolean;
  is_admin: boolean;
}

export interface MaintenanceToggleRequest {
  active: boolean;
}

export interface NbuStatusResponse {
  enabled: boolean;
}

export interface NbuToggleRequest {
  active: boolean;
}

export interface RedisInfoResponse {
  info: string;
}

export interface RedisClientsResponse {
  clients: string;
}

export interface NbuPendingPaymentRow {
  id: number;
  transaction_id: string;
  order_id: string;
  telegram_id: number;
  purpose: string;
  amount_uzs: number;
  currency: number;
  created_at: string | null;
  age_seconds: number | null;
  callback_received_at: string | null;
  last_synced_at: string | null;
  card_masked: string | null;
  error_code: number | null;
}

export interface NbuPendingPaymentsResponse {
  count: number;
  rows: NbuPendingPaymentRow[];
}

export interface NbuReconcileResponse {
  transaction_id: string;
  previous_status: string;
  new_status: string;
  flipped_to_terminal: boolean;
  notes_tail: string | null;
}

export interface NbuExpireResponse {
  transaction_id: string;
  previous_status: string;
  new_status: string;
}

export interface NbuExpireBulkRequest {
  /** Specific NBU transaction ids to expire (selected rows). */
  transaction_ids?: string[];
  /** Expire ALL pending rows older than this many seconds. */
  older_than_seconds?: number;
}

export interface NbuExpireBulkResponse {
  requested: number;
  expired: number;
  flipped_to_success: number;
  skipped: number;
  expired_transaction_ids: string[];
}

export interface UzPostPendingRow {
  delivery_request_id: number;
  client_code: string;
  flight_names: string[];
  created_at: string | null;
  age_seconds: number | null;
  is_paid: boolean;
  nbu_order_id: string | null;
  amount_uzs: number | null;
  has_approved_sibling: boolean;
  uzpost_order_number: string | null;
}

export interface UzPostPendingResponse {
  count: number;
  rows: UzPostPendingRow[];
}

export interface UzPostReconcileResponse {
  delivery_request_id: number;
  previous_status: string;
  new_status: string;
  approved: boolean;
  detail: string;
}

export interface UzPostRejectResponse {
  delivery_request_id: number;
  previous_status: string;
  new_status: string;
}

export interface UzPostExpireBulkRequest {
  delivery_request_ids?: number[];
  older_than_seconds?: number;
}

export interface UzPostExpireBulkResponse {
  requested: number;
  rejected: number;
  skipped_paid: number;
  skipped: number;
  rejected_ids: number[];
}

export interface NbuReportConfig {
  enabled: boolean;
  max_flights: number;
  group_id: number;
}

export interface NbuReportConfigUpdate {
  enabled?: boolean;
  max_flights?: number;
}

export interface NbuReportResendResponse {
  sent: number;
  windows: string[];
}

export const systemService = {
  async getMaintenanceStatus(): Promise<MaintenanceStatusResponse> {
    const { data } = await apiClient.get<MaintenanceStatusResponse>('/api/v1/system/maintenance-status');
    return data;
  },

  async toggleMaintenance(body: MaintenanceToggleRequest): Promise<MaintenanceStatusResponse> {
    const { data } = await apiClient.post<MaintenanceStatusResponse>('/api/v1/system/maintenance', body);
    return data;
  },

  async getNbuStatus(): Promise<NbuStatusResponse> {
    const { data } = await apiClient.get<NbuStatusResponse>('/api/v1/system/nbu-status');
    return data;
  },

  async toggleNbu(body: NbuToggleRequest): Promise<NbuStatusResponse> {
    const { data } = await apiClient.post<NbuStatusResponse>('/api/v1/system/nbu', body);
    return data;
  },

  async getRedisInfo(): Promise<RedisInfoResponse> {
    const { data } = await apiClient.get<RedisInfoResponse>('/api/v1/system/redis-info');
    return data;
  },

  async getRedisClients(): Promise<RedisClientsResponse> {
    const { data } = await apiClient.get<RedisClientsResponse>('/api/v1/system/redis-clients');
    return data;
  },

  async getNbuPending(limit = 100): Promise<NbuPendingPaymentsResponse> {
    const { data } = await apiClient.get<NbuPendingPaymentsResponse>(
      '/api/v1/system/nbu/pending',
      { params: { limit } },
    );
    return data;
  },

  async forceReconcileNbu(transactionId: string): Promise<NbuReconcileResponse> {
    const { data } = await apiClient.post<NbuReconcileResponse>(
      `/api/v1/system/nbu/reconcile/${encodeURIComponent(transactionId)}`,
    );
    return data;
  },

  async expireNbu(transactionId: string): Promise<NbuExpireResponse> {
    const { data } = await apiClient.post<NbuExpireResponse>(
      `/api/v1/system/nbu/expire/${encodeURIComponent(transactionId)}`,
    );
    return data;
  },

  async expireNbuBulk(body: NbuExpireBulkRequest): Promise<NbuExpireBulkResponse> {
    const { data } = await apiClient.post<NbuExpireBulkResponse>(
      '/api/v1/system/nbu/expire-bulk',
      body,
    );
    return data;
  },

  async listUzpostPending(limit = 100): Promise<UzPostPendingResponse> {
    const { data } = await apiClient.get<UzPostPendingResponse>(
      '/api/v1/system/uzpost/pending',
      { params: { limit } },
    );
    return data;
  },

  async reconcileUzpost(drId: number): Promise<UzPostReconcileResponse> {
    const { data } = await apiClient.post<UzPostReconcileResponse>(
      `/api/v1/system/uzpost/reconcile/${drId}`,
    );
    return data;
  },

  async rejectUzpost(drId: number): Promise<UzPostRejectResponse> {
    const { data } = await apiClient.post<UzPostRejectResponse>(
      `/api/v1/system/uzpost/reject/${drId}`,
    );
    return data;
  },

  async expireUzpostBulk(
    body: UzPostExpireBulkRequest,
  ): Promise<UzPostExpireBulkResponse> {
    const { data } = await apiClient.post<UzPostExpireBulkResponse>(
      '/api/v1/system/uzpost/expire-bulk',
      body,
    );
    return data;
  },

  async getNbuReportConfig(): Promise<NbuReportConfig> {
    const { data } = await apiClient.get<NbuReportConfig>(
      '/api/v1/system/nbu/report-config',
    );
    return data;
  },

  async updateNbuReportConfig(
    body: NbuReportConfigUpdate,
  ): Promise<NbuReportConfig> {
    const { data } = await apiClient.post<NbuReportConfig>(
      '/api/v1/system/nbu/report-config',
      body,
    );
    return data;
  },

  async resendNbuReports(hoursBack: number): Promise<NbuReportResendResponse> {
    const { data } = await apiClient.post<NbuReportResendResponse>(
      '/api/v1/system/nbu/report/resend',
      { hours_back: hoursBack },
    );
    return data;
  },
};
