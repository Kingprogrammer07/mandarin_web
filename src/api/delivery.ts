import { apiClientFormData } from './client';

export interface AdminDeliveryRequestResponse {
    message: string;
    delivery_request_id: number;
}

/**
 * Submit an admin-initiated delivery request.
 * Uses FormData to support file uploads (like Uzpost payment receipts).
 * 
 * @param formData FormData containing:
 * - client_id: number
 * - admin_telegram_id: number
 * - delivery_type: string ('uzpost', 'yandex', etc.)
 * - flight_names_json: string (JSON array of flight names)
 * - full_name: string
 * - phone: string
 * - region: string
 * - district: string
 * - address: string
 * - wallet_used: number
 * - receipt_file: File (optional, for Uzpost)
 */
export const submitAdminDeliveryRequest = async (formData: FormData): Promise<AdminDeliveryRequestResponse> => {
    const response = await apiClientFormData.post<AdminDeliveryRequestResponse>(
        '/api/v1/delivery/admin-delivery-request',
        formData
    );
    return response.data;
};
