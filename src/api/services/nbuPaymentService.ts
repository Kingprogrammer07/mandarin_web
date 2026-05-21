import { apiClient } from '@/api/client';

export interface NbuStatusResponse {
  enabled: boolean;
}

export interface NbuInitRequest {
  flight_name: string;
}

export interface NbuInitResponse {
  payment_url: string;
  transaction_id: string;
  order_id: string;
  amount_tiyin: number;
  amount_uzs: number;
  currency: number;
  session_timeout_seconds: number;
  flight_name: string;
}

const BASE = '/api/v1/payments/nbu';

export const nbuPaymentService = {
  async getStatus(): Promise<NbuStatusResponse> {
    const response = await apiClient.get<NbuStatusResponse>(`${BASE}/status`);
    return response.data;
  },

  async init(body: NbuInitRequest): Promise<NbuInitResponse> {
    const response = await apiClient.post<NbuInitResponse>(`${BASE}/init`, body);
    return response.data;
  },
};
