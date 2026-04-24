import { apiClient } from './client';

// ============================================
// TYPES - Matching backend schemas exactly
// ============================================

// Backend FilterType enum
export type FilterType = 'all' | 'taken' | 'not_taken' | 'partial' | 'pending';
export type SortOrder = 'asc' | 'desc';
export type PaymentStatus = 'pending' | 'partial' | 'paid';
export type PaymentType = 'online' | 'cash' | 'card';
export type DeliveryRequestType = 'uzpost' | 'bts' | 'mandarin' | 'yandex';
export type DeliveryProofMethod =
  | 'uzpost'
  | 'bts'
  | 'mandarin'
  | 'yandex'
  | 'self_pickup';

// Transaction item matching backend TransactionSummary schema exactly
export interface Transaction {
  id: number;
  reys: string;
  qator_raqami: number;
  summa: number;
  vazn: string | null;
  payment_status: PaymentStatus;
  payment_type: PaymentType;
  is_taken_away: boolean;
  taken_away_date: string | null;
  has_receipt: boolean;
  created_at: string;
  // Payment tracking fields
  paid_amount: number;
  total_amount: number | null;
  remaining_amount: number;
  payment_balance_difference: number;
  delivery_request_type?: DeliveryRequestType | null;
  delivery_proof_method?: DeliveryProofMethod | null;
  // Wallet usage fields (populated when wallet was used for this transaction)
  wallet_deducted?: number;
  wallet_balance_before?: number;
  wallet_balance_after?: number;
}

// TransactionDetail extends TransactionSummary with additional fields
export interface TransactionDetail extends Transaction {
  client_code: string;
  telegram_id: number | null;
  payment_deadline: string | null;
  receipt_file_id: string | null;  // Backend alias from 'payment_receipt_file_id'
}

// Paginated response from backend - TransactionListResponse
export interface TransactionsApiResponse {
  transactions: Transaction[];
  total_count: number;
  limit: number;
  offset: number;
  total_pages: number;
  filter_type: FilterType;
  sort_order: SortOrder;
  flight_filter: string | null;
}

// Frontend filter params
export interface TransactionFilters {
  clientCode: string;
  filterType?: FilterType;
  sortOrder?: SortOrder;
  limit?: number;
  offset?: number;
  flightCode?: string;
}

// MarkTakenResponse from backend
export interface MarkTakenResponse {
  success: boolean;
  transaction_id: number;
  is_taken_away: boolean;
  taken_away_date: string | null;
  message: string;
}

// ============================================
// API FUNCTIONS
// ============================================

export const getTransactions = async (filters: TransactionFilters): Promise<TransactionsApiResponse> => {
  // Backend requires ALL filter parameters - no defaults on backend
  const response = await apiClient.get<TransactionsApiResponse>(
    '/api/v1/transactions',
    {
      params: {
        client_code: filters.clientCode,
        filter_type: filters.filterType ?? 'all',
        sort_order: filters.sortOrder ?? 'desc',
        limit: filters.limit ?? 20,
        offset: filters.offset ?? 0,
        ...(filters.flightCode && { flight_code: filters.flightCode }),
      },
    }
  );
  return response.data;
};

// Backend endpoint is PATCH /transactions/{id}/status (not /taken)
export const markAsTaken = async (transactionId: number): Promise<MarkTakenResponse> => {
  const response = await apiClient.patch<MarkTakenResponse>(
    `/api/v1/transactions/${transactionId}/status`,
    { is_taken_away: true }
  );
  return response.data;
};

export const getTransactionDetails = async (transactionId: number): Promise<TransactionDetail> => {
  const response = await apiClient.get<TransactionDetail>(`/api/v1/transactions/${transactionId}`);
  return response.data;
};
