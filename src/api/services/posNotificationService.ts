import { apiClient } from '../client';

// ─── Types (mirror backend PosNotificationListItem) ───────────────────────────

export interface PaymentHistoryItem {
  amount: number;
  provider: string;
  cashier: string | null;
  created_at: string;
  remaining_after: number | null;
}

export interface FlightItem {
  cargo_id: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: 'pending' | 'partial' | 'paid';
  weight: string | null;
  created_at: string | null;
}

export interface PosNotificationItem {
  id: number;
  client_code: string;
  client_name: string | null;
  flight_name: string;
  amount_paid: number;
  total_amount: number;
  remaining_amount: number;
  payment_status: 'pending' | 'partial' | 'paid' | 'rejected';
  payment_type: string | null;
  receipt_s3_key: string | null;
  telegram_message_id: number | null;
  telegram_chat_id: number | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  payment_history: PaymentHistoryItem[];
  flight_items: FlightItem[];
  source: 'flight' | 'zayafka';
  delivery_request_id: number | null;
  admin_comment: string | null;
}

export interface PosNotificationListResponse {
  items: PosNotificationItem[];
  total: number;
  page: number;
  per_page: number;
}

export interface PosNotificationStatsResponse {
  today_count: number;
  today_total: number;
}

export interface ReceiptUrlResponse {
  url: string;
  content_type: string;
}

export interface NotificationFilters {
  status?: string;          // e.g. "pending,partial" or "paid"
  flight?: string;
  client_code?: string;
  date_from?: string;       // YYYY-MM-DD
  date_to?: string;         // YYYY-MM-DD
  time_from?: string;       // HH:MM
  time_to?: string;         // HH:MM
  strict?: boolean;
  sort?: string;            // created_desc | created_asc | status_asc | amount_desc
  source?: 'flight' | 'zayafka';
}

export interface ZayafkaConfirmRequest {
  delivery_request_id: number;
  amount: number;
}

export interface ZayafkaRejectRequest {
  delivery_request_id: number;
  comment?: string | null;
}

export interface ZayafkaEditAmountRequest {
  delivery_request_id: number;
  amount: number;
}

export interface FlightConfirmRequest {
  client_code: string;
  flight_name: string;
  amount: number;
  payment_type: string;
}

export interface FlightRejectRequest {
  client_code: string;
  flight_name: string;
  comment?: string | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const BASE = '/api/v1/pos/notifications';

export const posNotificationService = {
  /**
   * Fetch paginated POS notifications with optional filters.
   */
  getNotifications: async (
    page = 1,
    per_page = 20,
    filters: NotificationFilters = {},
  ): Promise<PosNotificationListResponse> => {
    const params: Record<string, string | number | boolean | undefined> = {
      page,
      per_page,
      ...filters,
    };
    const response = await apiClient.get<PosNotificationListResponse>(BASE, { params });
    return response.data;
  },

  /**
   * Get a presigned S3 URL for a receipt image/PDF (15 min TTL).
   */
  getReceiptUrl: async (notificationId: number): Promise<ReceiptUrlResponse> => {
    const response = await apiClient.get<ReceiptUrlResponse>(
      `${BASE}/${notificationId}/receipt`,
    );
    return response.data;
  },

  /**
   * Fetch distinct flight names for the filter dropdown.
   */
  getFlights: async (): Promise<string[]> => {
    const response = await apiClient.get<string[]>(`${BASE}/flights`);
    return response.data;
  },

  /**
   * Fetch today's aggregated stats (count + total amount).
   */
  getStats: async (): Promise<PosNotificationStatsResponse> => {
    const response = await apiClient.get<PosNotificationStatsResponse>(`${BASE}/stats`);
    return response.data;
  },

  /**
   * Fetch count of visible notifications per source tab.
   */
  getTabCounts: async (): Promise<{ flight: number; zayafka: number }> => {
    const response = await apiClient.get<{ flight: number; zayafka: number }>(`${BASE}/tab-counts`);
    return response.data;
  },

  /**
   * Confirm a zayafka (UzPost) payment from the web POS.
   */
  confirmZayafka: async (data: ZayafkaConfirmRequest): Promise<void> => {
    await apiClient.post(`${BASE}/zayafka/confirm`, data);
  },

  /**
   * Reject a zayafka (UzPost) payment from the web POS.
   */
  rejectZayafka: async (data: ZayafkaRejectRequest): Promise<void> => {
    await apiClient.post(`${BASE}/zayafka/reject`, data);
  },

  /**
   * Edit the confirmed amount of a zayafka payment.
   */
  editZayafkaAmount: async (data: ZayafkaEditAmountRequest): Promise<void> => {
    await apiClient.patch(`${BASE}/zayafka/amount`, data);
  },

  /**
   * Confirm a flight payment from the notification bubble.
   */
  confirmFlightNotification: async (data: FlightConfirmRequest): Promise<void> => {
    await apiClient.post(`${BASE}/confirm`, data);
  },

  /**
   * Reject a flight payment notification from the web POS.
   */
  rejectFlightNotification: async (data: FlightRejectRequest): Promise<void> => {
    await apiClient.post(`${BASE}/reject`, data);
  },

  /**
   * Sync a notification's financials from actual transaction data.
   * Fixes stale amount_paid / total_amount before showing in the POS panel.
   */
  syncNotification: async (notificationId: number): Promise<PosNotificationItem> => {
    const response = await apiClient.post<PosNotificationItem>(
      `${BASE}/${notificationId}/sync`,
    );
    return response.data;
  },

  /**
   * Fetch the live UzPost delivery price for a zayafka request.
   * Used to pre-fill the ZayafkaNotificationBubble amount input so the
   * operator always sees the true UzPost fee even if pos_notifications
   * total_amount has drifted in production data.
   */
  getZayafkaUzpostPrice: async (
    deliveryRequestId: number,
  ): Promise<{ uzpost_price: number; currency: string }> => {
    const response = await apiClient.get<{ uzpost_price: number; currency: string }>(
      `${BASE}/zayafka/${deliveryRequestId}/uzpost-price`,
    );
    return response.data;
  },
};
