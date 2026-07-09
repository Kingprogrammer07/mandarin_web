import { apiClient, apiClientFormData } from '@/api/client';
import { API_LOGIN_URL, API_REGISTER_URL, API_INIT_DATA_URL } from '@/config/config';

// Retries fn up to maxAttempts times on transient network failures (ERR_NETWORK / timeout).
// Each retry waits baseDelayMs * attempt ms. All other errors propagate immediately.
async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 800,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const e = error as Record<string, unknown>;
      const isRetryable = e?.isNetworkError === true || e?.isTimeout === true;
      if (!isRetryable || attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, baseDelayMs * attempt));
    }
  }
  throw new Error('unreachable');
}

// Type definitions
export interface LoginRequest {
  client_code: string;
  phone_number: string;
  telegram_id?: number;
  region?: string;
  district?: string;
}

export interface LoginResponse {
  client_code: string;
  full_name: string;
  phone: string | null;
  telegram_id: number;
  created_at: string;
  access_token: string | null;
  token_type: string | null;
  role: string;
}

export interface AuthMeResponse {
  id: number;
  client_code: string | null;
  full_name: string;
  phone: string | null;
  telegram_id: number | null;
  role: string;
  /**
   * True when the backend recognises the session but the account is missing
   * region/district. Handled by routing the user through the address
   * drawer instead of triggering a logout.
   */
  requires_address?: boolean;
}

const AUTH_ME_TIMEOUT_MS = 5_000;

export function isRequestCanceled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; name?: string; message?: string };
  return (
    maybeError.code === 'ERR_CANCELED' ||
    maybeError.name === 'CanceledError' ||
    maybeError.name === 'AbortError' ||
    maybeError.message === 'canceled'
  );
}

export interface RegisterRequest {
  full_name: string;
  passport_series: string;
  pinfl: string;
  region: string;
  district: string;
  address: string;
  phone_number: string;
  date_of_birth: string; // YYYY-MM-DD format
  telegram_id: number;
  passport_images: File[];
  /** Accepted Privacy Policy + User Agreement version (legal consent audit). */
  privacy_policy_version?: string;
}

export interface RegisterResponse {
  client_code: string | null; // null until approved
  full_name: string;
  phone: string;
  passport_series: string;
  pinfl: string;
  telegram_id: number;
  message: string;
}

export interface ValidateInitDataRequest {
  init_data: string;
}

export interface ValidateInitDataResponse {
  valid: boolean;
  user_id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  message?: string;
}

/**
 * Login qilish - client_code VA phone_number orqali
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(API_LOGIN_URL, data);
  return response.data;
}

/**
 * Yangi client ro'yxatdan o'tkazish
 */
export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  const formData = new FormData();

  formData.append('full_name', data.full_name);
  formData.append('passport_series', data.passport_series);
  formData.append('pinfl', data.pinfl);
  formData.append('region', data.region);
  formData.append('district', data.district);
  formData.append('address', data.address);
  formData.append('phone_number', data.phone_number);
  formData.append('date_of_birth', data.date_of_birth);
  formData.append('telegram_id', data.telegram_id.toString());
  if (data.privacy_policy_version) {
    formData.append('privacy_policy_version', data.privacy_policy_version);
  }

  data.passport_images.forEach((file) => {
    formData.append('passport_images', file);
  });

  return withNetworkRetry(
    () => apiClientFormData.post<RegisterResponse>(API_REGISTER_URL, formData).then(r => r.data),
    2,
  );
}

/**
 * Telegram WebApp initData ni validatsiya qilish
 */
export async function validateInitData(
  data: ValidateInitDataRequest
): Promise<ValidateInitDataResponse> {
  return withNetworkRetry(
    () => apiClient.post<ValidateInitDataResponse>(API_INIT_DATA_URL, data).then(r => r.data),
  );
}

/**
 * Telegram auto-login - initData orqali avtomatik kirish
 */
export async function telegramAutoLogin(initData: string): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/telegram-login', {
    init_data: initData,
  });
  return response.data;
}

/**
 * Telegram WebApp ma'lumotlarini olish
 */
export function getTelegramWebAppData() {
  if (!window.Telegram?.WebApp) {
    return null;
  }

  const webApp = window.Telegram.WebApp;
  const user = webApp.initDataUnsafe?.user;
  return {
    initData: webApp.initData,
    user: user
      ? {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          language_code: user.language_code,
        }
      : null,
  };
}

/**
 * Get current authenticated user profile and role
 */
export async function fetchAuthMe(timeoutMs: number = AUTH_ME_TIMEOUT_MS): Promise<AuthMeResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await apiClient.get<AuthMeResponse>('/auth/me', {
      signal: controller.signal,
      timeout: timeoutMs + 1_000,
    });
    return response.data;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
