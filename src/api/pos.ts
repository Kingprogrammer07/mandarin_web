import { apiClient } from './client';
import type { FilterType, MarkTakenResponse, TransactionsApiResponse } from './transactions';

// ─── Admin header helper ───────────────────────────────────────────────────────
// POS endpoints are protected by require_permission("pos", "process|read"),
// which validates the X-Admin-Authorization header (same system as adminManagement).
const getAdminHeaders = () => {
  const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
  return { 'X-Admin-Authorization': `Bearer ${token}` };
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentProvider = 'cash' | 'click' | 'payme' | 'card';

/** A single cargo payment within an atomic bulk request. */
export interface BulkPaymentItem {
  cargo_id: number;
  flight: string;
  client_code: string;
  /** Actual amount the client hands over (UZS). Must be > 0. */
  paid_amount: number;
  payment_type: PaymentProvider;
  /** If true, deduct from client wallet balance before the payment_type amount. */
  use_balance: boolean;
}

/** Atomic bulk payment request — all items succeed or the entire batch is rejected. */
export interface BulkPaymentRequest {
  /** 1–50 cargo payment items. */
  items: BulkPaymentItem[];
  /** Optional cashier note recorded in the audit log. */
  cashier_note: string | null;
}

/** Processing result for a single item within a bulk payment response. */
export interface BulkItemResult {
  cargo_id: number;
  client_code: string;
  flight: string;
  transaction_id: number;
  paid_amount: number;
  expected_amount: number;
  payment_status: string;
  is_taken_away: boolean;
}

/** Response for a successfully committed atomic bulk payment. */
export interface BulkPaymentResponse {
  processed_count: number;
  total_paid: number;
  results: BulkItemResult[];
}

/** A single entry in the shared cashier payment audit log. */
export interface CashierLogItem {
  id: number;
  transaction_id: number;
  client_code: string | null;
  flight: string | null;
  paid_amount: number;
  payment_provider: string;
  /**
   * Admin DB PK of the cashier who processed this entry.
   * Populated for all entries — used by the frontend to colour-code rows
   * and distinguish the current user's entries from colleagues'.
   */
  cashier_id: number | null;
  created_at: string;
}

/** Paginated cashier log with daily totals. */
export interface CashierLogResponse {
  items: CashierLogItem[];
  total_count: number;
  page: number;
  size: number;
  total_pages: number;
  /** Sum of all amounts processed today (UTC calendar day). */
  today_total: number;
}

export interface CashierLogParams {
  page?: number;
  size?: number;
  date_from?: string;
  date_to?: string;
}

/** Manual cashier balance correction request. */
export interface AdjustBalanceRequest {
  client_code: string;
  /** Signed UZS amount — positive = credit (client owes less), negative = debit (client owes more). Non-zero. */
  amount: number;
  /** Short reason slug (1-64 chars). Colons/spaces are sanitised by the backend. */
  reason: string;
}

export interface AdjustBalanceResponse {
  transaction_id: number;
  client_code: string;
  amount: number;
  reason: string;
  /** Client's net wallet balance after the adjustment. */
  new_wallet_balance: number;
}

/** Random active payment card returned by GET /payments/active-cards/random. */
export interface ActiveCardResponse {
  card_number: string;
  holder_name: string;
  bank_name: string | null;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/payments/process-bulk
 *
 * Process 1–50 cargo payments atomically.
 * Requires `pos:process` permission on the caller's admin role.
 */
export async function processBulkPayment(data: BulkPaymentRequest): Promise<BulkPaymentResponse> {
  const res = await apiClient.post<BulkPaymentResponse>(
    '/api/v1/payments/process-bulk',
    data,
    { headers: getAdminHeaders() },
  );
  return res.data;
}

/**
 * GET /api/v1/payments/cashier-log
 *
 * Returns the caller's personal paginated payment audit log and today's total.
 * Requires `pos:read` permission on the caller's admin role.
 */
export async function getCashierLog(params: CashierLogParams = {}): Promise<CashierLogResponse> {
  const res = await apiClient.get<CashierLogResponse>('/api/v1/payments/cashier-log', {
    params,
    headers: getAdminHeaders(),
  });
  return res.data;
}

/**
 * POST /api/v1/payments/adjust-balance
 *
 * Manually credit or debit a client's wallet balance.
 * Requires `pos:adjust` permission on the caller's admin role.
 */
export async function adjustBalance(data: AdjustBalanceRequest): Promise<AdjustBalanceResponse> {
  const res = await apiClient.post<AdjustBalanceResponse>(
    '/api/v1/payments/adjust-balance',
    data,
    { headers: getAdminHeaders() },
  );
  return res.data;
}

/**
 * GET /api/v1/payments/active-cards/random
 *
 * Returns a random active payment card for card-payment display.
 */
export async function getRandomActiveCard(): Promise<ActiveCardResponse> {
  const res = await apiClient.get<ActiveCardResponse>(
    '/api/v1/payments/active-cards/random',
    { headers: getAdminHeaders() },
  );
  return res.data;
}

/**
 * GET /api/v1/transactions
 *
 * Fetches paginated transaction history for a specific client using admin auth.
 * Used exclusively in the POS cashier profile drawer.
 */
export async function getPOSClientTransactions(
  clientCode: string,
  filterType: FilterType = 'all',
  limit = 20,
  offset = 0,
): Promise<TransactionsApiResponse> {
  const res = await apiClient.get<TransactionsApiResponse>('/api/v1/transactions', {
    params: {
      client_code: clientCode,
      filter_type: filterType,
      sort_order: 'desc',
      limit,
      offset,
    },
    headers: getAdminHeaders(),
  });
  return res.data;
}

/**
 * PATCH /api/v1/transactions/{transactionId}/status
 *
 * Marks a cargo transaction as taken away by the client.
 * Uses admin authentication (X-Admin-Authorization header).
 */
export async function posMarkAsTaken(transactionId: number): Promise<MarkTakenResponse> {
  const res = await apiClient.patch<MarkTakenResponse>(
    `/api/v1/transactions/${transactionId}/status`,
    { is_taken_away: true },
    { headers: getAdminHeaders() },
  );
  return res.data;
}
