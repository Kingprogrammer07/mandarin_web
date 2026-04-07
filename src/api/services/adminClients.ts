import { apiClient } from '../client';
import type { UpdateClientPersonalFormValues } from "../../schemas/clientSchemas";

export interface ClientSearchItem {
  id: number;
  primary_code: string;
  full_name: string;
  phone?: string | null;
  region?: string | null;
  district?: string | null;
  is_logged_in: boolean;
  created_at: string;
}

export interface ClientSearchResponse {
  items: ClientSearchItem[];
  total_count: number;
  total_pages: number;
  page: number;
  size: number;
}

export interface AdminClientDetailResponse {
  id: number;
  primary_code: string;
  full_name: string;
  phone?: string | null;
  passport_series?: string | null;
  pinfl?: string | null;
  date_of_birth?: string | null;
  region?: string | null;
  district?: string | null;
  address?: string | null;
  username?: string | null;
  telegram_id?: number | null;
  is_logged_in: boolean;
  created_at: string;
  wallet_balance: number;
  debt: number;
  net_balance: number;
  referral_count: number;
  extra_passport_count: number;
}

export interface ClientTransactionItem {
  id: number;
  /** Backend returns Uzbek column name — do not alias on the frontend. */
  reys: string;
  qator_raqami: number;
  summa: number;
  vazn: string;
  payment_type: string;
  payment_status: "paid" | "unpaid" | "partial" | string;
  paid_amount: number;
  remaining_amount: number;
  total_amount?: number | null;
  is_taken_away: boolean;
  taken_away_date?: string | null;
  payment_balance_difference: number;
  created_at: string;
}

export type FinancesFilterType = "all" | "paid" | "unpaid" | "partial" | "taken" | "not_taken";

export interface GetClientFinancesParams {
  page?: number;
  size?: number;
  sort_order?: "asc" | "desc";
  filter_type?: FinancesFilterType;
  flight_name?: string;
}

export interface ClientFinancesResponse {
  wallet_balance: number;
  debt: number;
  net_balance: number;
  total_count: number;
  total_pages: number;
  page: number;
  size: number;
  transactions: ClientTransactionItem[];
}

export interface PaymentEvent {
  id: number;
  payment_provider: string;
  amount: number;
  created_at: string;
}

export interface PaymentBreakdown {
  cash: number;
  click: number;
  payme: number;
  card: number;
  wallet: number;
  [key: string]: number;
}

export interface TransactionPaymentDetailResponse {
  transaction_id: number;
  flight_name: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_events: PaymentEvent[];
  breakdown: PaymentBreakdown;
}

export interface ClientFlightsResponse {
  client_id: number;
  primary_code: string;
  flights: string[];
}

// --- API Calls ---

/**
 * Targeted search params — pass exactly one of `code`, `name`, or general `q`.
 * Priority on the backend: code → phone → name → q.
 * Omitting all params returns all clients paginated.
 */
export interface SearchClientsParams {
  /** Search by client code only (extra_code / client_code / legacy_code). */
  code?: string;
  /** Search by phone number only. */
  phone?: string;
  /** Search by full name only. */
  name?: string;
  /** Search all fields at once (may produce false positives). */
  q?: string;
  page?: number;
  size?: number;
}

export async function searchClientsPaginated(
  params: SearchClientsParams,
): Promise<ClientSearchResponse> {
  const response = await apiClient.get("/api/v1/admin/clients/search", {
    params: { ...params },
  });
  return response.data;
}

export async function getClientDetail(
  client_id: number,
): Promise<AdminClientDetailResponse> {
  const response = await apiClient.get(`/api/v1/admin/clients/${client_id}`);
  return response.data;
}

export async function updateClientPersonal(
  client_id: number,
  data: UpdateClientPersonalFormValues,
): Promise<AdminClientDetailResponse> {
  const payload = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== ""),
  );
  const response = await apiClient.patch(`/api/v1/admin/clients/${client_id}/personal`, payload);
  return response.data;
}

export async function getClientFinances(
  client_id: number,
  params: GetClientFinancesParams = {},
): Promise<ClientFinancesResponse> {
  const response = await apiClient.get(`/api/v1/admin/clients/${client_id}/finances`, {
    params: {
      page: params.page ?? 1,
      size: params.size ?? 20,
      sort_order: params.sort_order ?? "desc",
      filter_type: params.filter_type ?? "all",
      ...(params.flight_name ? { flight_name: params.flight_name } : {}),
    },
  });
  return response.data;
}

export async function getTransactionPaymentDetail(
  client_id: number,
  transaction_id: number,
): Promise<TransactionPaymentDetailResponse> {
  const response = await apiClient.get(
    `/api/v1/admin/clients/${client_id}/finances/${transaction_id}/payment-detail`,
  );
  return response.data;
}

export async function getClientFlights(
  client_id: number,
): Promise<ClientFlightsResponse> {
  const response = await apiClient.get(`/api/v1/admin/clients/${client_id}/flights`);
  return response.data;
}
