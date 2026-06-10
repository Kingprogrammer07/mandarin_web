import { apiClient, apiClientFormData } from '@/api/client';
import type { UzpostBranch } from '@/types/uzpostBranch';

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
  phone: string | null;
  region: string;
  address: string;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  location_url: string | null;
  uzpost_location_id: number | null;
  uzpost_location_name: string | null;
  uzpost_location_index: string | null;
  uzpost_location_address: string | null;
  uzpost_order_number: string | null;
  uzpost_order_status: string | null;
  uzpost_tracking_status: string | null;
  uzpost_tracking_error: string | null;
  uzpost_label_pdf_url: string | null;
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
export async function calculateUzpost(
  flightNames: string[],
  locationId: number,
): Promise<CalculateUzpostResponse> {
  const response = await apiClient.post<CalculateUzpostResponse>(
    '/api/user/delivery/calculate-uzpost',
    { flight_names: flightNames, location_id: locationId }
  );
  return response.data;
}

/**
 * Submit a standard delivery request (Yandex, Mandarin, BTS)
 */
export async function submitStandardDelivery(
  deliveryType: 'yandex' | 'mandarin' | 'bts',
  flightNames: string[],
  phoneNumber: string | null,
  caption: string,
  latitude: number,
  longitude: number
): Promise<DeliverySuccessResponse> {
  const response = await apiClient.post<DeliverySuccessResponse>(
    '/api/user/delivery/request/standard',
    {
      delivery_type: deliveryType,
      flight_names: flightNames,
      phone_number: phoneNumber,
      caption,
      latitude,
      longitude,
    }
  );
  return response.data;
}

/**
 * Submit an UzPost delivery request with optional receipt file
 */
export async function submitUzpostDelivery(
  flightNames: string[],
  walletUsed: number,
  receiptFile?: File | null,
  selectedBranch?: UzpostBranch | null,
  phoneNumber?: string | null
): Promise<DeliverySuccessResponse> {
  const formData = new FormData();
  formData.append('flight_names', JSON.stringify(flightNames));
  formData.append('wallet_used', String(walletUsed));

  if (selectedBranch) {
    formData.append('location_id', String(selectedBranch.id));
  }

  if (phoneNumber) {
    formData.append('phone_number', phoneNumber);
  }

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
export async function getDeliveryHistory(
  page = 1,
  size = 10,
  refreshUzpostTracking = true
): Promise<DeliveryHistoryResponse> {
  const response = await apiClient.get<DeliveryHistoryResponse>('/api/user/delivery/history', {
    params: { page, size, refresh_uzpost_tracking: refreshUzpostTracking },
  });
  return response.data;
}

// ============================================
// DELIVERY REVIEW (web feedback after approval)
// ============================================

export interface PendingDeliveryReview {
  delivery_request_id: number | null;
  delivery_type: string | null;
  flight_names: string[];
  created_at: string | null;
}

export interface SubmitDeliveryReviewBody {
  delivery_request_id: number;
  rating: number; // 1-5
  aspect?: string | null;
  comment?: string | null;
}

/** Most recent approved delivery awaiting a review, or all-null when none. */
export async function getPendingDeliveryReview(): Promise<PendingDeliveryReview> {
  const response = await apiClient.get<PendingDeliveryReview>(
    '/api/user/delivery/pending-review'
  );
  return response.data;
}

/** Submit a star rating (+ optional aspect/comment) for a delivery. */
export async function submitDeliveryReview(
  body: SubmitDeliveryReviewBody
): Promise<DeliverySuccessResponse> {
  const response = await apiClient.post<DeliverySuccessResponse>(
    '/api/user/delivery/review',
    body
  );
  return response.data;
}
