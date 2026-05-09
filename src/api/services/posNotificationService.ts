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
  payment_status: 'pending' | 'partial' | 'paid';
  payment_type: string | null;
  receipt_s3_key: string | null;
  telegram_message_id: number | null;
  telegram_chat_id: number | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  payment_history: PaymentHistoryItem[];
  flight_items: FlightItem[];
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
};
