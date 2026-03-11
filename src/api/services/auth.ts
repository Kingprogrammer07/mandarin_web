import { apiClient, apiClientFormData } from '@/api/client';
import { API_LOGIN_URL, API_REGISTER_URL, API_INIT_DATA_URL } from '@/config/config';

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
  // FormData yaratish
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

  // Rasmlarni qo'shish
  data.passport_images.forEach((file) => {
    formData.append('passport_images', file);
  });

  const response = await apiClientFormData.post<RegisterResponse>(
    API_REGISTER_URL,
    formData
  );
  return response.data;
}

/**
 * Telegram WebApp initData ni validatsiya qilish
 */
export async function validateInitData(
  data: ValidateInitDataRequest
): Promise<ValidateInitDataResponse> {
  const response = await apiClient.post<ValidateInitDataResponse>(
    API_INIT_DATA_URL,
    data
  );
  return response.data;
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
export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const response = await apiClient.get<AuthMeResponse>('/auth/me');
  return response.data;
}
