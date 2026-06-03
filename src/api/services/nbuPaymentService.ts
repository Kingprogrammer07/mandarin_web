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

export interface SavedCardItem {
  id: number;
  card_masked: string | null;
  nickname: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface SavedCardListResponse {
  items: SavedCardItem[];
  count: number;
}

export interface BindCardInitResponse {
  payment_url: string | null;
  transaction_id: string;
  order_id: string;
}

export interface BindCardRequest {
  /** Optional label captured at bind time; NBU never returns the PAN on bind. */
  nickname?: string | null;
}

export interface RenameCardRequest {
  /** New label; null/blank clears it. */
  nickname: string | null;
}

export interface ChargeSavedCardRequest {
  card_id: number;
  flight_name: string;
}

export interface ChargeSavedCardResponse {
  transaction_id: string;
  order_id: string;
  status: 'SUCCESS' | 'FAILED';
  amount_tiyin: number;
  amount_uzs: number;
  flight_name: string;
  error: string | null;
}

export type NbuPurpose =
  | 'ONE_TIME_PAYMENT'
  | 'RECURRING_PAYMENT'
  | 'SUBSCRIPTION'
  | 'CARD_BINDING';

export type NbuStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUNDED';

export interface PublicNbuPaymentStatus {
  order_id: string;
  status: NbuStatus | string;
  purpose: NbuPurpose | string;
  amount_uzs: number;
  currency: number;
  flight_name: string | null;
  is_terminal: boolean;
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

  async listCards(): Promise<SavedCardListResponse> {
    const response = await apiClient.get<SavedCardListResponse>(`${BASE}/cards`);
    return response.data;
  },

  async bindCard(nickname?: string | null): Promise<BindCardInitResponse> {
    const body: BindCardRequest = { nickname: nickname?.trim() || null };
    const response = await apiClient.post<BindCardInitResponse>(`${BASE}/cards/bind`, body);
    return response.data;
  },

  async renameCard(cardId: number, nickname: string | null): Promise<SavedCardItem> {
    const body: RenameCardRequest = { nickname: nickname?.trim() || null };
    const response = await apiClient.patch<SavedCardItem>(`${BASE}/cards/${cardId}`, body);
    return response.data;
  },

  async chargeSavedCard(body: ChargeSavedCardRequest): Promise<ChargeSavedCardResponse> {
    const response = await apiClient.post<ChargeSavedCardResponse>(`${BASE}/charge`, body);
    return response.data;
  },

  async deleteCard(cardId: number): Promise<void> {
    await apiClient.delete(`${BASE}/cards/${cardId}`);
  },

  /**
   * Fetch the caller's own receipt PNG (owner-scoped) and return an object URL
   * for use in an <img>. Caller must `URL.revokeObjectURL` when done.
   */
  async getReceiptBlobUrl(orderId: string): Promise<string> {
    const response = await apiClient.get(`${BASE}/receipt/${encodeURIComponent(orderId)}`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(response.data as Blob);
  },

  async getPublicStatus(orderId: string): Promise<PublicNbuPaymentStatus> {
    const response = await apiClient.get<PublicNbuPaymentStatus>(
      `${BASE}/payment-status-public/${orderId}`,
    );
    return response.data;
  },
};
