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


