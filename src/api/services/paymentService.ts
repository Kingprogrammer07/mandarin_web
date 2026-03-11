import { apiClient, apiClientFormData } from '@/api/client';

// ============================================================================
// TypeScript Interfaces (mirrors backend Pydantic schemas)
// ============================================================================

export interface AvailableFlightItem {
  flight_name: string;
  total_payment: number | null;
  payment_status: 'unpaid' | 'partial';
  remaining_amount: number | null;
}

export interface AvailableFlightsResponse {
  flights: AvailableFlightItem[];
  count: number;
}

export interface FlightPaymentDetailsResponse {
  flight_name: string;
  client_code: string;
  total_payment: number;
  total_weight: number;
  price_per_kg_usd: number;
  price_per_kg_uzs: number;
  extra_charge: number;
  track_codes: string[];
  wallet_balance: number;
  partial_allowed: boolean;
  has_existing_partial: boolean;
  existing_paid_amount: number | null;
  existing_remaining_amount: number | null;
  card_number: string | null;
  card_owner: string | null;
}

export interface WalletOnlyPaymentRequest {
  flight_name: string;
  amount: number;
  payment_mode: 'full' | 'partial' | 'full_remaining';
}

export interface CashPaymentRequest {
  flight_name: string;
  wallet_used: number;
}

export interface PaymentSubmissionResponse {
  success: boolean;
  message: string;
  flight_name: string;
  amount: number;
  wallet_used: number;
  payment_mode: string;
}

export interface PaymentBreakdown {
  click: number;
  payme: number;
  cash: number;
  card: number;
}

export interface TransactionHistoryItem {
  id: number;
  flight_name: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: 'paid' | 'partial' | 'pending';
  payment_type: string;
  is_taken_away: boolean;
  created_at: string;
  breakdown: PaymentBreakdown;
}

export interface TransactionHistoryResponse {
  items: TransactionHistoryItem[];
  total_count: number;
  limit: number;
  offset: number;
}

// ============================================================================
// API Service
// ============================================================================

const BASE = '/api/v1/payments';

export const paymentService = {
  /**
   * Step 1: Fetch all flights available for payment.
   */
  getAvailableFlights: async (): Promise<AvailableFlightsResponse> => {
    const response = await apiClient.get<AvailableFlightsResponse>(
      `${BASE}/available-flights`,
    );
    return response.data;
  },

  /**
   * Step 2: Fetch detailed payment info for a specific flight.
   */
  getFlightDetails: async (
    flightName: string,
  ): Promise<FlightPaymentDetailsResponse> => {
    const response = await apiClient.get<FlightPaymentDetailsResponse>(
      `${BASE}/flight-details/${encodeURIComponent(flightName)}`,
    );
    return response.data;
  },

  /**
   * Step 3a: Pay entirely from wallet balance.
   */
  submitWalletOnly: async (
    data: WalletOnlyPaymentRequest,
  ): Promise<PaymentSubmissionResponse> => {
    const response = await apiClient.post<PaymentSubmissionResponse>(
      `${BASE}/submit/wallet-only`,
      data,
    );
    return response.data;
  },

  /**
   * Step 3b: Submit cash payment request.
   */
  submitCash: async (
    data: CashPaymentRequest,
  ): Promise<PaymentSubmissionResponse> => {
    const response = await apiClient.post<PaymentSubmissionResponse>(
      `${BASE}/submit/cash`,
      data,
    );
    return response.data;
  },

  /**
   * Step 3c: Submit online payment with receipt file (multipart/form-data).
   */
  submitOnline: async (params: {
    flight_name: string;
    payment_mode: 'full' | 'partial' | 'full_remaining';
    paid_amount: number;
    wallet_used: number;
    receipt_file: File;
  }): Promise<PaymentSubmissionResponse> => {
    const formData = new FormData();
    formData.append('flight_name', params.flight_name);
    formData.append('payment_mode', params.payment_mode);
    formData.append('paid_amount', String(params.paid_amount));
    formData.append('wallet_used', String(params.wallet_used));
    formData.append('receipt_file', params.receipt_file);

    const response = await apiClientFormData.post<PaymentSubmissionResponse>(
      `${BASE}/submit/online`,
      formData,
    );
    return response.data;
  },

  /**
   * Fetch paginated payment history for the current user.
   */
  getPaymentHistory: async (
    limit: number = 20,
    offset: number = 0,
  ): Promise<TransactionHistoryResponse> => {
    const response = await apiClient.get<TransactionHistoryResponse>(
      `${BASE}/history`,
      { params: { limit, offset } },
    );
    return response.data;
  },
};

export const getPaymentHistory = paymentService.getPaymentHistory;
