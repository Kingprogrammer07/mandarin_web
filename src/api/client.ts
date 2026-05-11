import axios from 'axios';
import { API_BASE_URL } from '@/config/config';
import i18n from '@/i18n/config';
import { logFrontendError, flushPendingErrors } from '@/api/services/frontendErrors';
import { useMaintenanceStore } from '@/store/useMaintenanceStore';

// Status codes that reliably mean the backend is down (gateway / proxy errors).
const SERVER_DOWN_STATUSES = new Set([502, 503, 504]);

function triggerMaintenanceIfServerDown(
  status: number | undefined,
  isNetworkDown: boolean,
  endpointUrl: string,
): void {
  // Never trigger for silent auth-warmup endpoints — those fail transiently
  // during Android WebView cold-start and would produce false positives.
  const isSilent =
    endpointUrl.includes('/auth/validate-init-data') ||
    endpointUrl.includes('/auth/telegram-login');
  if (isSilent) return;

  // Gateway errors (502/503/504) = nginx is up but backend process is down.
  // isNetworkDown = true when browser gets "Network Error" / ERR_CONNECTION_REFUSED
  // meaning the server port is not accepting connections at all.
  const isGatewayError = status !== undefined && SERVER_DOWN_STATUSES.has(status);

  if (isGatewayError || isNetworkDown) {
    useMaintenanceStore.getState().triggerMaintenance();
  }
}

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
  (response) => {
    flushPendingErrors().catch(() => {}); // fire-and-forget
    return response;
  },
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

      triggerMaintenanceIfServerDown(status, false, error.config?.url ?? '');

      const resolved = resolveErrorMessage(status, error.response.data?.detail);
      // Log API errors (4xx/5xx) to Telegram
      if (status >= 500) {
        logFrontendError('api', resolved, {
          status,
          endpoint: error.config?.url ?? window.location.href,
          additional_data: { responseData: error.response.data },
        }).catch(() => {});
      }
      return Promise.reject({
        message: resolved,
        status,
        data: error.response.data,
      });
    }

    if (error.request) {
      // Request yuborildi, lekin javob kelmay qoldi.
      // Bu: timeout, DNS, CORS preflight, SSL, yoki haqiqiy network muammosi bo'lishi mumkin.
      const isTimeout = error.code === 'ECONNABORTED';
      const isNetworkError = error.message?.includes('Network Error');
      const isCertError = error.code === 'ERR_CERT_AUTHORITY_INVALID' || error.code === 'ERR_CERT_COMMON_NAME_INVALID';
      const isConnRefused = error.code === 'ERR_CONNECTION_REFUSED';
      const isNameNotResolved = error.code === 'ERR_NAME_NOT_RESOLVED';
      const method = error.config?.method?.toUpperCase() ?? 'UNKNOWN';
      const url = error.config?.url ?? 'unknown';

      // Trigger maintenance when the backend port is unreachable (server down/restarting).
      // Exclude cert/DNS errors — those are config issues, not temporary maintenance.
      triggerMaintenanceIfServerDown(
        undefined,
        (isNetworkError || isConnRefused) && !isCertError && !isNameNotResolved,
        url,
      );

      // Debug ma'lumot — faqat browser console'da ko'rinadi
      console.error('[API Network Error]', {
        code: error.code,
        message: error.message,
        method,
        url,
        timeout: error.config?.timeout,
        isTimeout,
        isNetworkError,
        isCertError,
        isConnRefused,
        isNameNotResolved,
      });

      let message: string;
      if (isTimeout) {
        message = "Server javob bermadi (vaqt tugadi). Iltimos, qayta urinib ko'ring.";
      } else if (isCertError) {
        message = "Xavfsiz ulanishda xatolik. Iltimos, boshqa brauzer yoki qurilmadan urinib ko'ring.";
      } else if (isConnRefused) {
        message = "Server vaqtincha javob bermayapti. Iltimos, keyinroq qayta urinib ko'ring.";
      } else if (isNameNotResolved) {
        message = "Server manzili topilmadi. DNS sozlamalarini tekshiring.";
      } else if (isNetworkError) {
        message = "Serverga ulanib bo'lmadi. Internetni tekshiring.";
      } else {
        message = "Serverga ulanishda xatolik. Iltimos, qayta urinib ko'ring.";
      }

      // Telegram cold-start and auto-login endpoints always fail transiently on
      // Android WebView warm-up — no actionable server signal, suppress monitoring.
      const endpoint = error.config?.url ?? '';
      const isSilentEndpoint =
        endpoint.includes('/auth/validate-init-data') ||
        endpoint.includes('/auth/telegram-login');

      if (!isSilentEndpoint) {
        logFrontendError('network', message, {
          endpoint: error.config?.url ?? window.location.href,
          additional_data: {
            code: error.code,
            isTimeout,
            isNetworkError,
            isCertError,
            isConnRefused,
            isNameNotResolved,
            method: error.config?.method?.toUpperCase(),
          },
        }).catch(() => {});
      }

      return Promise.reject({
        message,
        status: 0,
        code: error.code,
        isTimeout,
        isNetworkError,
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
  (response) => {
    flushPendingErrors().catch(() => {});
    return response;
  },
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

      triggerMaintenanceIfServerDown(status, false, error.config?.url ?? '');

      const resolved = resolveErrorMessage(status, error.response.data?.detail);
      if (status >= 500) {
        logFrontendError('api', resolved, {
          status,
          endpoint: error.config?.url ?? window.location.href,
          additional_data: { responseData: error.response.data },
        }).catch(() => {});
      }
      return Promise.reject({
        message: resolved,
        status,
        data: error.response.data,
      });
    }

    if (error.request) {
      const isTimeout = error.code === 'ECONNABORTED';
      const isNetworkError = error.message?.includes('Network Error');
      const isCertError = error.code === 'ERR_CERT_AUTHORITY_INVALID' || error.code === 'ERR_CERT_COMMON_NAME_INVALID';
      const isConnRefused = error.code === 'ERR_CONNECTION_REFUSED';
      const isNameNotResolved = error.code === 'ERR_NAME_NOT_RESOLVED';
      const method = error.config?.method?.toUpperCase() ?? 'UNKNOWN';
      const url = error.config?.url ?? 'unknown';

      triggerMaintenanceIfServerDown(
        undefined,
        (isNetworkError || isConnRefused) && !isCertError && !isNameNotResolved,
        url,
      );

      console.error('[API Network Error]', {
        code: error.code,
        message: error.message,
        method,
        url,
        timeout: error.config?.timeout,
        isTimeout,
        isNetworkError,
        isCertError,
        isConnRefused,
        isNameNotResolved,
      });

      let message: string;
      if (isTimeout) {
        message = "Server javob bermadi (vaqt tugadi). Iltimos, qayta urinib ko'ring.";
      } else if (isCertError) {
        message = "Xavfsiz ulanishda xatolik. Iltimos, boshqa brauzer yoki qurilmadan urinib ko'ring.";
      } else if (isConnRefused) {
        message = "Server vaqtincha javob bermayapti. Iltimos, keyinroq qayta urinib ko'ring.";
      } else if (isNameNotResolved) {
        message = "Server manzili topilmadi. DNS sozlamalarini tekshiring.";
      } else if (isNetworkError) {
        message = "Serverga ulanib bo'lmadi. Internetni tekshiring.";
      } else {
        message = "Serverga ulanishda xatolik. Iltimos, qayta urinib ko'ring.";
      }

      const isSilentEndpointFD =
        url.includes('/auth/validate-init-data') ||
        url.includes('/auth/telegram-login');

      if (!isSilentEndpointFD) {
        logFrontendError('network', message, {
          endpoint: url,
          additional_data: {
            code: error.code,
            isTimeout,
            isNetworkError,
            isCertError,
            isConnRefused,
            isNameNotResolved,
            method,
          },
        }).catch(() => {});
      }

      return Promise.reject({
        message,
        status: 0,
        code: error.code,
        isTimeout,
        isNetworkError,
      });
    }

    return Promise.reject({
      message: error.message || "Noma'lum xatolik yuz berdi.",
      status: -1,
    });
  },
);
