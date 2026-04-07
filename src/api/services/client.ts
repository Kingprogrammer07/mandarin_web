import { apiClient, apiClientFormData } from '@/api/client';

// ─── Admin header helper ───────────────────────────────────────────────────────
// client_router is protected by get_admin_user, so every request must carry the
// X-Admin-Authorization header in addition to the standard Bearer token.
const getAdminHeaders = () => {
  const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
  return { 'X-Admin-Authorization': `Bearer ${token}` };
};

// ============================================
// CLIENT SCHEMAS - Matching Backend v2.0
// ============================================

export interface Client {
  id: number;
  telegram_id: number | null;
  full_name: string;
  phone: string | null;
  passport_series: string | null;
  pinfl: string | null;
  date_of_birth: string | null;
  region: string | null;
  district: string | null;
  address: string | null;
  client_code: string | null;
  extra_code: string | null;
  referrer_telegram_id: number | null;
  referrer_client_code: string | null;
  is_logged_in: boolean;
  is_admin: boolean;
  language_code: string;
  created_at: string;
  current_balance?: number;
}

export interface ClientCreateRequest {
  telegram_id?: number | null;
  full_name: string;
  passport_series?: string;
  date_of_birth?: string; // YYYY-MM-DD
  region?: string;
  district?: string;
  address?: string;
  phone?: string;
  pinfl?: string;
  referrer_telegram_id?: number;
  referrer_client_code?: string;
  client_code?: string;
  passport_images?: File[];
  adjustment_amount?: number;
  adjustment_reason?: string;
  adjustment_type?: 'bonus' | 'penalty' | 'silent';
}

export interface ClientDeleteResponse {
  message: string;
  deleted_client_id: number;
}

// ============================================
// PASSPORT IMAGE METADATA (v2.0)
// ============================================

export interface PassportImageMetadata {
  index: number;
  file_id: string;
  telegram_url: string | null;
  is_regenerated: boolean;
  error: string | null;
}

export interface PassportImagesMetadataResponse {
  client_id: number;
  image_count: number;
  images: PassportImageMetadata[];
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Get client by ID
 */
export async function getClient(id: number): Promise<Client> {
  const response = await apiClient.get<Client>(`/api/v1/clients/${id}`, {
    headers: getAdminHeaders(),
  });
  return response.data;
}

/**
 * Get passport images metadata
 */
export async function getPassportImagesMetadata(
  clientId: number,
  resolveUrls: boolean = true
): Promise<PassportImagesMetadataResponse> {
  const response = await apiClient.get<PassportImagesMetadataResponse>(
    `/api/v1/clients/${clientId}/passport-images/metadata`,
    {
      params: { resolve_urls: resolveUrls },
      headers: getAdminHeaders(),
    }
  );
  return response.data;
}

/**
 * Resolve single passport image
 */
export async function resolvePassportImage(
  clientId: number,
  imageIndex: number
): Promise<PassportImageMetadata> {
  const response = await apiClient.get<PassportImageMetadata>(
    `/api/v1/clients/${clientId}/passport-images/resolve/${imageIndex}`,
    { headers: getAdminHeaders() }
  );
  return response.data;
}

/**
 * Create new client
 */
export async function createClient(data: ClientCreateRequest): Promise<Client> {
  const formData = new FormData();

  if (data.telegram_id != null) formData.append('telegram_id', data.telegram_id.toString());
  formData.append('full_name', data.full_name);

  if (data.passport_series) formData.append('passport_series', data.passport_series);
  if (data.date_of_birth) formData.append('date_of_birth', data.date_of_birth);
  if (data.region) formData.append('region', data.region);
  if (data.district) formData.append('district', data.district);
  if (data.address) formData.append('address', data.address);
  if (data.phone) formData.append('phone', data.phone);
  if (data.pinfl) formData.append('pinfl', data.pinfl);
  if (data.referrer_telegram_id) formData.append('referrer_telegram_id', data.referrer_telegram_id.toString());
  if (data.referrer_client_code) formData.append('referrer_client_code', data.referrer_client_code);
  if (data.client_code) formData.append('client_code', data.client_code);
  // Passport images
  if (data.passport_images && data.passport_images.length > 0) {
    data.passport_images.forEach((file) => {
      formData.append('passport_images', file);
    });
  }

  const response = await apiClientFormData.post<Client>(
    '/api/v1/clients',
    formData,
    { headers: getAdminHeaders() }
  );
  return response.data;
}

/**
 * Update client
 */
export async function updateClient(id: number, data: ClientCreateRequest): Promise<Client> {
  const formData = new FormData();

  if (data.full_name) formData.append('full_name', data.full_name);
  if (data.passport_series) formData.append('passport_series', data.passport_series);
  if (data.date_of_birth) formData.append('date_of_birth', data.date_of_birth);
  if (data.region) formData.append('region', data.region);
  if (data.district) formData.append('district', data.district);
  if (data.address) formData.append('address', data.address);
  if (data.phone) formData.append('phone', data.phone);
  if (data.pinfl) formData.append('pinfl', data.pinfl);
  if (data.referrer_telegram_id) formData.append('referrer_telegram_id', data.referrer_telegram_id.toString());
  if (data.referrer_client_code) formData.append('referrer_client_code', data.referrer_client_code);
  if (data.client_code) formData.append('client_code', data.client_code);

  // Also support updating telegram_id if needed (backend supports it)
  if (data.telegram_id != null) formData.append('telegram_id', data.telegram_id.toString());

  // Balance adjustment fields
  if (data.adjustment_amount != null) formData.append('adjustment_amount', data.adjustment_amount.toString());
  if (data.adjustment_reason) formData.append('adjustment_reason', data.adjustment_reason);
  if (data.adjustment_type) formData.append('adjustment_type', data.adjustment_type.toString());

  // Passport images - faqat yangi rasm yuklangan bo'lsa yuborish
  if (data.passport_images && data.passport_images.length > 0) {
    data.passport_images.forEach((file) => {
      formData.append('passport_images', file);
    });
  }

  const response = await apiClientFormData.put<Client>(
    `/api/v1/clients/${id}`,
    formData,
    { headers: getAdminHeaders() }
  );
  return response.data;
}

/**
 * Delete client
 */
export async function deleteClient(id: number): Promise<ClientDeleteResponse> {
  const response = await apiClient.delete<ClientDeleteResponse>(`/api/v1/clients/${id}`, {
    headers: getAdminHeaders(),
  });
  return response.data;
}

export interface CodePreviewResponse {
  preview_code: string;
  prefix: string;
  is_tashkent: boolean;
}

/**
 * Frontendda jonli kodni ko'rsatish uchun API
 */
export async function previewClientCode(
  region: string,
  district: string
): Promise<CodePreviewResponse> {
  const response = await apiClient.get<CodePreviewResponse>('/api/v1/clients/preview-code', {
    params: { region, district },
    headers: getAdminHeaders(),
  });
  return response.data;
}