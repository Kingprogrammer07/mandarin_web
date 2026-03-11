import { apiClient } from './client';

// ============================================
// ENUMS / LITERALS - Matching backend exactly
// ============================================

export type BalanceStatus = 'debt' | 'overpaid' | 'balanced';
export type UnpaidFilterType = 'all' | 'pending';
export type SortOrder = 'asc' | 'desc';

// ============================================
// CLIENT SEARCH - GET /verification/search
// ============================================

export interface ClientStats {
  total_payments: number;
  cargo_taken: number;
}

// Raw API response for search endpoint
export interface ClientSearchApiResponse {
  client: {
    id: number;
    client_code: string;
    full_name: string;
    telegram_id: number | null;
    phone: string | null;
    is_admin: boolean;
    stats: ClientStats;
    flights: string[];
    client_balance: number;
    client_balance_status: BalanceStatus;
  };
}

// Normalized search result for UI
export interface ClientSearchResult {
  id: number;
  client_code: string;
  full_name: string;
  phone: string | null;
  is_admin: boolean;
  stats: ClientStats;
  flights: string[];
  client_balance: number;
  client_balance_status: BalanceStatus;
}

// ============================================
// CLIENT PROFILE (FULL INFO) - GET /verification/{client_id}
// ============================================

export type PaymentStatus = 'pending' | 'partial' | 'paid';
export type PaymentType = 'online' | 'cash';

// Matches backend TransactionSummary
export interface TransactionSummary {
  id: number;
  reys: string;           // alias="reys"
  row_number: number;       // alias="qator_raqami"
  total_amount: number;           // alias="summa"
  weight: string | null;    // alias="vazn"
  payment_status: PaymentStatus;
  payment_type: PaymentType;
  is_taken_away: boolean;
  taken_away_date: string | null;
  has_receipt: boolean;
  created_at: string;
  paid_amount: number;
  remaining_amount: number;
  payment_balance_difference: number;
}

// Raw API response from backend - ClientFullInfoResponse
export interface ClientProfileApiResponse {
  client: {
    id: number;
    client_code: string;
    full_name: string;
    telegram_id: number | null;
    phone: string | null;
    passport_series: string | null;
    pinfl: string | null;
    date_of_birth: string | null;
    region: string | null;
    district: string | null;
    address: string | null;
    is_admin: boolean;
    referral_count: number;
    extra_passports_count: number;
    passport_image_file_ids: string[];  // Array of Telegram file_ids
    created_at: string;
    transaction_count: number;
    latest_transaction: TransactionSummary | null;
    client_balance: number;
    client_balance_status: BalanceStatus;
  };
}

// Normalized frontend model
export interface ClientProfile {
  id: number;
  client_code: string;
  full_name: string;
  phone: string | null;
  passport_series: string | null;
  pinfl: string | null;
  region: string | null;
  district: string | null;
  address: string | null;
  date_of_birth: string | null;
  created_at: string;
  client_balance: number;
  client_balance_status: BalanceStatus;
  total_cargo_count: number; // Mapped from transaction_count as per previous context, or we can keep separate
  referral_count: number;
  extra_passports_count: number;
  transaction_count: number;
  latest_transaction: TransactionSummary | null;
  passport_image_file_ids: string[];  // Array of Telegram file_ids
}



// Transform raw API response to normalized ClientProfile
export function normalizeClientProfile(raw: ClientProfileApiResponse['client']): ClientProfile {
  return {
    id: raw.id,
    client_code: raw.client_code,
    full_name: raw.full_name,
    phone: raw.phone,
    passport_series: raw.passport_series,
    pinfl: raw.pinfl,
    region: raw.region,
    district: raw.district,
    address: raw.address,
    date_of_birth: raw.date_of_birth,
    created_at: raw.created_at,
    client_balance: raw.client_balance ?? 0,
    client_balance_status: raw.client_balance_status ?? 'balanced',
    total_cargo_count: raw.transaction_count ?? 0,
    referral_count: raw.referral_count ?? 0,
    extra_passports_count: raw.extra_passports_count ?? 0,
    transaction_count: raw.transaction_count ?? 0,
    latest_transaction: raw.latest_transaction,
    passport_image_file_ids: raw.passport_image_file_ids ?? [],
  };
}

// Transform search result to normalized format
export function normalizeSearchResult(raw: ClientSearchApiResponse['client']): ClientSearchResult {
  return {
    id: raw.id,
    client_code: raw.client_code,
    full_name: raw.full_name,
    phone: raw.phone,
    is_admin: raw.is_admin,
    stats: raw.stats,
    flights: raw.flights || [],
    client_balance: raw.client_balance,
    client_balance_status: raw.client_balance_status,
  };
}

// ============================================
// CLIENT FLIGHTS - GET /verification/{client_code}/flights
// ============================================

export interface ClientFlightsApiResponse {
  flights: string[];
  source: 'database' | 'sheets' | 'combined';
}

// ============================================
// UNPAID CARGO - GET /verification/{client_code}/cargo/unpaid
// ============================================

// Backend UnpaidCargoItem schema - EXACT match to JSON response
// NOTE: Pydantic uses aliases for INPUT, but JSON output uses the FIELD NAME
// Backend: flight: str = Field(..., alias="flight_name") -> JSON key is "flight"
// Backend: expected_amount: float = Field(..., alias="total_payment") -> JSON key is "expected_amount"
export interface UnpaidCargoItem {
  cargo_id: number;
  flight_name: string;           // Pydantic field name (JSON key)
  row_number: number;
  weight: number;
  price_per_kg: number;
  total_payment: number;  // Pydantic field name (JSON key)
  currency: string;
  payment_status: 'pending';
  created_at: string;
}

// Backend UnpaidCargoListResponse
export interface UnpaidCargoApiResponse {
  items: UnpaidCargoItem[];
  total_count: number;
  limit: number;
  offset: number;
  total_pages: number;
  filter_type: string;
  sort_order: SortOrder;
  flight_filter: string | null;
}

// Alias for compatibility
export type UnpaidCargo = UnpaidCargoItem;

// ============================================
// CARGO IMAGES - GET /transactions/{id}/cargo-images
// ============================================

export interface CargoImage {
  file_id: string;
  telegram_url: string | null;
}

export interface CargoImagesApiResponse {
  transaction_id: number;
  flight: string;
  cargo_id: number | null;
  images: CargoImage[];
  total_count: number;
}

// ============================================
// FLIGHT PAYMENT SUMMARY
// ============================================

export interface FlightPaymentSummary {
  total_weight: number;
  price_per_kg_usd: number;
  price_per_kg_uzs: number;
  extra_charge: number;
  total_payment: number;
  track_codes: string[];
}

// ============================================
// API FUNCTIONS
// ============================================

export const searchClients = async (query: string): Promise<ClientSearchApiResponse> => {
  const response = await apiClient.get<ClientSearchApiResponse>('/api/v1/verification/search', {
    params: { q: query },
  });
  return response.data;
};

export const getClientProfile = async (clientId: string | number): Promise<ClientProfileApiResponse> => {
  const response = await apiClient.get<ClientProfileApiResponse>(`/api/v1/verification/${clientId}`);
  return response.data;
};

// Backend REQUIRES include_sheets and include_database params - no defaults
export const getClientFlights = async (
  clientCode: string,
  includeSheets: boolean,
  includeDatabase: boolean
): Promise<string[]> => {
  const response = await apiClient.get<ClientFlightsApiResponse>(
    `/api/v1/verification/${clientCode}/flights`,
    {
      params: {
        include_sheets: includeSheets,
        include_database: includeDatabase,
      },
    }
  );
  return response.data.flights || [];
};

// Get flights with unpaid cargo
export const getUnpaidCargoFlights = async (clientCode: string): Promise<string[]> => {
  const response = await apiClient.get<ClientFlightsApiResponse>(
    `/api/v1/verification/${clientCode}/cargo/unpaid/flights`
  );
  return response.data.flights || [];
};

// Backend requires ALL filter params - they are not optional
export interface UnpaidCargoParams {
  clientCode: string;
  filterType: UnpaidFilterType;  // REQUIRED
  sortOrder: SortOrder;  // REQUIRED
  limit: number;  // REQUIRED
  offset: number;  // REQUIRED
  flightCode?: string;  // Optional
}

export const getUnpaidCargo = async (params: UnpaidCargoParams): Promise<UnpaidCargoApiResponse> => {
  const response = await apiClient.get<UnpaidCargoApiResponse>(
    `/api/v1/verification/${params.clientCode}/cargo/unpaid`,
    {
      params: {
        filter_type: params.filterType,
        sort_order: params.sortOrder,
        limit: params.limit,
        offset: params.offset,
        ...(params.flightCode && { flight_code: params.flightCode }),
      },
    }
  );
  return response.data;
};

export const getCargoImages = async (transactionId: number): Promise<CargoImagesApiResponse> => {
  const response = await apiClient.get<CargoImagesApiResponse>(
    `/api/v1/transactions/${transactionId}/cargo-images`
  );
  return response.data;
};

export const getCargoImagesUnpaid = async (transactionId: number): Promise<CargoImagesApiResponse> => {
  const response = await apiClient.get<CargoImagesApiResponse>(
    `/api/v1/transactions/${transactionId}/cargo-images?type=unpaid`
  );
  return response.data;
};

export const getFlightPaymentSummary = async (
  clientCode: string,
  flightName: string
): Promise<FlightPaymentSummary> => {
  const response = await apiClient.get<FlightPaymentSummary>(
    `/api/v1/verification/${clientCode}/flights/${encodeURIComponent(flightName)}/payment-summary`
  );
  return response.data;
};



