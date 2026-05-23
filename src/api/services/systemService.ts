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
};
