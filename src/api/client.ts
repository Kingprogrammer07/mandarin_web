import axios from 'axios';
import { API_BASE_URL } from '@/config/config';
import i18n from '@/i18n/config';

// ─── Uzbek error messages by HTTP status ─────────────────────────────────────
// Auth/infra errors always return English from FastAPI/middleware, so we
// override them here.  Business-logic errors (400, 409, 422) use the backend's
// Uzbek `detail` message which is already localised.

const UZBEK_HTTP_ERRORS: Record<number, string> = {
  401: "Avtorizatsiya talab qilinadi. Iltimos, qayta kiring.",
  403: "Ruxsat yo'q. Bu amalni bajarish uchun huquqingiz etarli emas.",
  404: "Ma'lumot topilmadi.",
  405: "Bu amal qo'llab-quvvatlanmaydi.",
  429: "Juda ko'p urinish. Biroz kuting.",
  500: "Serverda ichki xatolik yuz berdi.",
  502: "Server vaqtincha javob bermayapti.",
  503: "Xizmat vaqtincha to'xtatilgan.",
  504: "Server javob berish vaqti tugadi.",
};

/**
 * Resolves the user-facing error message for a failed response.
 * - For auth/infra status codes (401, 403, 5xx, …) returns a hardcoded Uzbek string
 *   because the backend middleware returns English for those.
 * - For business-logic codes (400, 409, 422) trusts the backend's `detail` field,
 *   which is already written in Uzbek.
 */
function resolveErrorMessage(status: number, detail: unknown): string {
  if (UZBEK_HTTP_ERRORS[status]) return UZBEK_HTTP_ERRORS[status];
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    // FastAPI validation error array — take the first message
    const first = detail[0];
    if (typeof first?.msg === 'string') return first.msg;
  }
  return "Serverda xatolik yuz berdi.";
}

// ─── Main API client (JSON) ───────────────────────────────────────────────────

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

apiClient.interceptors.request.use(
  (config) => {
    if (window.Telegram?.WebApp?.initData) {
      config.headers['X-Telegram-Init-Data'] = window.Telegram.WebApp.initData;
    }

    // Mutually exclusive auth headers — sending both causes the user-auth
    // middleware to intercept the admin JWT and reject it with 401.
    const adminToken = localStorage.getItem('access_token');
    const userToken  = sessionStorage.getItem('access_token');
    if (adminToken) {
      config.headers['X-Admin-Authorization'] = `Bearer ${adminToken}`;
      delete config.headers['Authorization'];
    } else if (userToken) {
      config.headers['Authorization'] = `Bearer ${userToken}`;
    }

    config.headers['Accept-Language'] = i18n.language || 'uz';
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const status: number = error.response.status;

      if (status === 401) {
        const requestUrl: string = error.config?.url ?? '';
        const requestMethod: string = error.config?.method ?? '';
        // Public-read endpoints that should never trigger logout on 401 —
        // the backend permission gate is stricter than needed for read access.
        const isSilent401 =
          requestUrl.includes('/admin/auth/refresh') ||
          (requestUrl.includes('/flight-schedule') && requestMethod === 'get');
        if (!isSilent401) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('admin_role');
          sessionStorage.removeItem('access_token');
          window.dispatchEvent(new CustomEvent('auth:logout'));
        }
        return Promise.reject(error);
      }

      return Promise.reject({
        message: resolveErrorMessage(status, error.response.data?.detail),
        status,
        data: error.response.data,
      });
    }

    if (error.request) {
      return Promise.reject({
        message: "Serverga ulanib bo'lmadi. Internetni tekshiring.",
        status: 0,
      });
    }

    return Promise.reject({
      message: error.message || "Noma'lum xatolik yuz berdi.",
      status: -1,
    });
  },
);

// ─── FormData client (multipart uploads) ─────────────────────────────────────

export const apiClientFormData = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
  timeout: 60000, // longer timeout for file uploads
});

apiClientFormData.interceptors.request.use(
  (config) => {
    if (window.Telegram?.WebApp?.initData) {
      config.headers['X-Telegram-Init-Data'] = window.Telegram.WebApp.initData;
    }

    const adminToken = localStorage.getItem('access_token');
    const userToken  = sessionStorage.getItem('access_token');
    if (adminToken) {
      config.headers['X-Admin-Authorization'] = `Bearer ${adminToken}`;
      delete config.headers['Authorization'];
    } else if (userToken) {
      config.headers['Authorization'] = `Bearer ${userToken}`;
    }

    config.headers['Accept-Language'] = i18n.language || 'uz';
    return config;
  },
  (error) => Promise.reject(error),
);

apiClientFormData.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const status: number = error.response.status;

      if (status === 401) {
        const requestUrl: string = error.config?.url ?? '';
        const requestMethod: string = error.config?.method ?? '';
        const isSilent401 =
          requestUrl.includes('/admin/auth/refresh') ||
          (requestUrl.includes('/flight-schedule') && requestMethod === 'get');
        if (!isSilent401) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('admin_role');
          sessionStorage.removeItem('access_token');
          window.dispatchEvent(new CustomEvent('auth:logout'));
        }
        return Promise.reject(error);
      }

      return Promise.reject({
        message: resolveErrorMessage(status, error.response.data?.detail),
        status,
        data: error.response.data,
      });
    }

    if (error.request) {
      return Promise.reject({
        message: "Serverga ulanib bo'lmadi. Internetni tekshiring.",
        status: 0,
      });
    }

    return Promise.reject({
      message: error.message || "Noma'lum xatolik yuz berdi.",
      status: -1,
    });
  },
);
