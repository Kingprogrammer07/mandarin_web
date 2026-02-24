import { apiClient } from './client';

// ============================================
// TYPES - Matching backend schemas exactly
// ============================================

// Backend PaymentProvider enum
export type PaymentProvider = 'cash' | 'click' | 'payme' | 'card';

// Active card from backend
export interface ActiveCard {
  card_number: string;
  holder_name: string;
}

// 1. New Unpaid Cargo Payment Request
// Endpoint: POST /payments/process
export interface ProcessUnpaidCargoRequest {
  client_code: string;
  cargo_id: number;
  flight: string;
  payment_type: PaymentProvider;
  paid_amount: number;
  admin_id: number;
  use_balance?: boolean;
}

// 2. Existing Transaction Payment Request
// Endpoint: POST /payments/process-existing
export interface ProcessExistingTransactionRequest {
  transaction_id: number;
  payment_type: PaymentProvider;
  paid_amount: number;
  admin_id: number;
  use_balance?: boolean;
}

// Common Payment Result
export interface PaymentResult {
  success: boolean;
  transaction_id: number;
  client_code: string;
  flight: string;
  expected_amount: number;
  paid_amount: number;
  payment_balance_difference: number;
  payment_type: PaymentProvider;
  payment_status: 'pending' | 'partial' | 'paid';
  is_taken_away: boolean;
  message: string;
  created_at: string;
  // Wallet fields
  wallet_balance_before?: number;
  wallet_deducted?: number;
  wallet_balance_after?: number;
}

// Notification Status
export interface NotificationStatus {
  user_notified: boolean;
  user_notification_error: string | null;
  channel_notified: boolean;
  channel_notification_error: string | null;
}

// Full Response
export interface ProcessPaymentResponse {
  payment: PaymentResult;
  notifications: NotificationStatus;
}

// ============================================
// API FUNCTIONS
// ============================================

export const processUnpaidCargoPayment = async (data: ProcessUnpaidCargoRequest): Promise<ProcessPaymentResponse> => {
  const response = await apiClient.post<ProcessPaymentResponse>('/api/v1/payments/process', data);
  return response.data;
};

export const processExistingTransactionPayment = async (data: ProcessExistingTransactionRequest): Promise<ProcessPaymentResponse> => {
  const response = await apiClient.post<ProcessPaymentResponse>('/api/v1/payments/process-existing', data);
  return response.data;
};

export const fetchRandomActiveCard = async (): Promise<ActiveCard> => {
  const response = await apiClient.get<ActiveCard>('/api/v1/payments/active-cards/random');
  return response.data;
};
