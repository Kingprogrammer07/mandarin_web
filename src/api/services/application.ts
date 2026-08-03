import { apiClient, apiClientFormData } from '@/api/client';

/**
 * The applicant's own registration request, while it waits for an admin.
 *
 * A pending account has no session token, so these calls authenticate with the
 * Telegram `initData` header the API client already attaches. Everything here is
 * scoped to the caller: the backend derives the identity from the signed
 * payload, never from a field we send.
 */

export type ApplicationStatus = 'none' | 'pending' | 'approved';

export interface MyApplication {
  status: ApplicationStatus;
  /** True only while the application can still be changed. */
  editable: boolean;
  client_code: string | null;
  full_name: string | null;
  phone: string | null;
  passport_series: string | null;
  pinfl: string | null;
  date_of_birth: string | null;
  region: string | null;
  region_label: string | null;
  district: string | null;
  district_label: string | null;
  address: string | null;
  submitted_at: string | null;
  /** Short-lived presigned links, [front, back]. */
  passport_image_urls: string[];
}

/** Only the fields the user actually changed need to be sent. */
export interface ApplicationEdit {
  full_name?: string;
  passport_series?: string;
  pinfl?: string;
  region?: string;
  district?: string;
  address?: string;
  phone_number?: string;
  /** YYYY-MM-DD */
  date_of_birth?: string;
  passport_front?: File | null;
  passport_back?: File | null;
}

export interface WithdrawResult {
  status: ApplicationStatus;
  message: string;
}

const BASE = '/auth/my-application';

/** Shared cache key so the form gate and the pending screen read one fetch. */
export const MY_APPLICATION_QUERY_KEY = ['my-application'] as const;

export const applicationService = {
  /** Always resolves — `status` carries the answer, including "no application". */
  async get(): Promise<MyApplication> {
    const response = await apiClient.get<MyApplication>(BASE);
    return response.data;
  },

  async update(patch: ApplicationEdit): Promise<MyApplication> {
    const formData = new FormData();

    const textFields: Array<[keyof ApplicationEdit, string | undefined]> = [
      ['full_name', patch.full_name],
      ['passport_series', patch.passport_series],
      ['pinfl', patch.pinfl],
      ['region', patch.region],
      ['district', patch.district],
      ['address', patch.address],
      ['phone_number', patch.phone_number],
      ['date_of_birth', patch.date_of_birth],
    ];
    for (const [field, value] of textFields) {
      if (value !== undefined) formData.append(field, value);
    }

    // Each side is optional and replaces only itself; an untouched side keeps
    // the photo already on file.
    if (patch.passport_front) formData.append('passport_front', patch.passport_front);
    if (patch.passport_back) formData.append('passport_back', patch.passport_back);

    const response = await apiClientFormData.patch<MyApplication>(BASE, formData);
    return response.data;
  },

  /** Cancels the request and frees the phone/passport for a new registration. */
  async withdraw(): Promise<WithdrawResult> {
    const response = await apiClient.delete<WithdrawResult>(BASE);
    return response.data;
  },
};
