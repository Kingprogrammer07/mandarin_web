import { apiClient, apiClientFormData } from "../client";

export interface AdminStandardDeliveryRequest {
  client_code: string;
  delivery_type: "self_pickup" | "yandex" | "mandarin" | "bts";
  flight_names: string[];
  phone_number?: string;
  caption?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AdminDeliverySuccessResponse {
  message: string;
  delivery_request_id: number;
  /**
   * False when the request was saved but no warehouse queue could be built —
   * the queue service only picks up cargo that is paid-or-partial and not yet
   * collected. This used to be swallowed server-side, so the filer saw plain
   * success while the warehouse received nothing.
   */
  queue_created?: boolean;
  /** Why the queue was not created, in Uzbek, ready to display. */
  queue_warning?: string | null;
  /** True when the request was filed over already-collected cargo. */
  state_overridden?: boolean;

  /**
   * UzPost only, and only for a filer holding `delivery_requests:override_state`:
   * the request dispatched the parcel itself — UzPost order created, label sent
   * to the printer, cargo marked collected without warehouse proof photos.
   */
  auto_released?: boolean;
  /** How many transactions actually changed state. */
  released_count?: number;
  uzpost_order_number?: string | null;
  /** Printer queue job id, when the label was accepted for printing. */
  printer_job_id?: number | null;
  /**
   * Why the release did not go as planned, in Uzbek. Present when the UzPost
   * order failed (cargo deliberately left in the warehouse) or when there was
   * nothing left to release.
   */
  release_warning?: string | null;
}

/** One flight of a client's, with the two facts that decide whether to file. */
export interface DeliveryFlightState {
  flight: string;
  cargo_count: number;
  total_amount: number;
  paid_amount: number;
  payment_status: "paid" | "partial" | "pending";
  is_taken_away: boolean;
  taken_count: number;
}

export interface DeliveryHistoryEntry {
  id: number;
  created_at: string;
  status: string;
  delivery_type: string;
  flight_names: string[];
  /** "user" | "admin" | null. Null means the row predates provenance tracking. */
  created_via: string | null;
  created_by_admin_id: number | null;
  state_overridden: boolean;
}

export interface ClientDeliveryContext {
  client_code: string;
  /** Whether the signed-in admin may file regardless of cargo state. */
  may_override: boolean;
  flights: DeliveryFlightState[];
  total_requests: number;
  filed_by_user: number;
  filed_by_admin: number;
  /** Rows created before provenance was recorded — genuinely unknown, not zero. */
  filed_unknown: number;
  recent: DeliveryHistoryEntry[];
}

/**
 * Prior requests and per-flight state for one client.
 *
 * Answers the two questions a manager had no way to ask before filing: has
 * anyone already filed for this person, and was it them or one of us.
 */
export async function getClientDeliveryContext(
  clientCode: string,
): Promise<ClientDeliveryContext> {
  const response = await apiClient.get<ClientDeliveryContext>(
    `/api/v1/admin/delivery-requests/context/${encodeURIComponent(clientCode)}`,
  );
  return response.data;
}

export async function adminCreateStandardDelivery(
  data: AdminStandardDeliveryRequest,
): Promise<AdminDeliverySuccessResponse> {
  const response = await apiClient.post<AdminDeliverySuccessResponse>(
    "/api/v1/admin/delivery-requests/standard",
    data,
  );
  return response.data;
}

export async function adminCreateUzpostDelivery(
  formData: FormData,
): Promise<AdminDeliverySuccessResponse> {
  const response = await apiClientFormData.post<AdminDeliverySuccessResponse>(
    "/api/v1/admin/delivery-requests/uzpost",
    formData,
  );
  return response.data;
}


