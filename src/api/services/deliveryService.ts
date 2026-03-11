import { apiClient, apiClientFormData } from '@/api/client';

// ============================================
// DELIVERY REQUEST SCHEMAS
// ============================================

export interface FlightItem {
  flight_name: string;
}

export interface PaidFlightsResponse {
  flights: FlightItem[];
}

export interface CardInfo {
  card_number: string;
  card_owner: string;
}

export interface CalculateUzpostResponse {
  total_weight: number;
  price_per_kg: number;
  total_amount: number;
  wallet_balance: number;
  card: CardInfo | null;
  warning: string | null;
}

export interface DeliverySuccessResponse {
  message: string;
  delivery_request_id: number;
}

export interface DeliveryRequestHistoryItem {
  id: number;
  delivery_type: string;
  flight_names: string[];
  region: string;
  address: string;
  status: string;
  admin_comment: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface DeliveryHistoryResponse {
  requests: DeliveryRequestHistoryItem[];
  total_count: number;
  page: number;
  size: number;
  has_next: boolean;
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Get paid flights for the current user
 */
export async function getPaidFlights(): Promise<PaidFlightsResponse> {
  const response = await apiClient.get<PaidFlightsResponse>('/api/user/delivery/flights');
  return response.data;
}

/**
 * Calculate UzPost delivery cost
 */
export async function calculateUzpost(flightNames: string[]): Promise<CalculateUzpostResponse> {
  const response = await apiClient.post<CalculateUzpostResponse>(
    '/api/user/delivery/calculate-uzpost',
    { flight_names: flightNames }
  );
  return response.data;
}

/**
 * Submit a standard delivery request (Yandex, Mandarin, BTS)
 */
export async function submitStandardDelivery(
  deliveryType: 'yandex' | 'mandarin' | 'bts',
  flightNames: string[]
): Promise<DeliverySuccessResponse> {
  const response = await apiClient.post<DeliverySuccessResponse>(
    '/api/user/delivery/request/standard',
    { delivery_type: deliveryType, flight_names: flightNames }
  );
  return response.data;
}

/**
 * Submit an UzPost delivery request with optional receipt file
 */
export async function submitUzpostDelivery(
  flightNames: string[],
  walletUsed: number,
  receiptFile?: File | null
): Promise<DeliverySuccessResponse> {
  const formData = new FormData();
  formData.append('flight_names', JSON.stringify(flightNames));
  formData.append('wallet_used', String(walletUsed));

  if (receiptFile) {
    formData.append('receipt_file', receiptFile);
  }

  const response = await apiClientFormData.post<DeliverySuccessResponse>(
    '/api/user/delivery/request/uzpost',
    formData
  );
  return response.data;
}

/**
 * Get delivery request history for the current user (paginated)
 */
export async function getDeliveryHistory(page = 1, size = 10): Promise<DeliveryHistoryResponse> {
  const response = await apiClient.get<DeliveryHistoryResponse>('/api/user/delivery/history', {
    params: { page, size },
  });
  return response.data;
}
