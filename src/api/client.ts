import axios from 'axios';
import { API_BASE_URL } from '@/config/config';
import i18n from '@/i18n/config';

// Axios client yaratish
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 soniya
});

// Request interceptor - har bir so'rovga qo'shimcha ma'lumotlar qo'shish
apiClient.interceptors.request.use(
  (config) => {
    // Telegram WebApp initData ni qo'shish
    if (window.Telegram?.WebApp?.initData) {
      config.headers['X-Telegram-Init-Data'] = window.Telegram.WebApp.initData;
    }

    // Opaque Session Token ni qo'shish
    const token = sessionStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Tanlangan tilni qo'shish (i18next dan)
    const currentLanguage = i18n.language || 'uz';
    config.headers['Accept-Language'] = currentLanguage;

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - xatolarni boshqarish
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Xatolik xabarini tarjima qilish yoki formatlash
    if (error.response) {
      // Global 401/403 Error handler -> Logout & Redirect
      if (error.response.status === 401 || error.response.status === 403) {
        sessionStorage.removeItem('access_token');
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return Promise.reject(error);
      }

      // Server javob berdi lekin xatolik kodi bilan (404, 500, etc.)
      const errorMessage = error.response.data?.detail || 'Serverda xatolik yuz berdi';
      return Promise.reject({
        message: errorMessage,
        status: error.response.status,
        data: error.response.data,
      });
    } else if (error.request) {
      // So'rov yuborildi lekin javob kelmadi
      return Promise.reject({
        message: 'Serverga ulanib bo\'lmadi. Internetni tekshiring.',
        status: 0,
      });
    } else {
      // So'rov yuborishda xatolik yuz berdi
      return Promise.reject({
        message: error.message || 'Noma\'lum xatolik yuz berdi',
        status: -1,
      });
    }
  }
);

// FormData uchun alohida client
export const apiClientFormData = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
  timeout: 60000, // 60 soniya (rasm yuklash uchun ko'proq vaqt)
});

// FormData client uchun ham interceptorlar
apiClientFormData.interceptors.request.use(
  (config) => {
    if (window.Telegram?.WebApp?.initData) {
      config.headers['X-Telegram-Init-Data'] = window.Telegram.WebApp.initData;
    }

    // Opaque Session Token ni qo'shish
    const token = sessionStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Tanlangan tilni qo'shish (i18next dan)
    const currentLanguage = i18n.language || 'uz';
    config.headers['Accept-Language'] = currentLanguage;

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClientFormData.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // Global 401/403 Error handler -> Logout & Redirect
      if (error.response.status === 401 || error.response.status === 403) {
        sessionStorage.removeItem('access_token');
        window.location.href = '/auth/login';
        return Promise.reject(error);
      }

      const errorMessage = error.response.data?.detail || 'Serverda xatolik yuz berdi';
      return Promise.reject({
        message: errorMessage,
        status: error.response.status,
        data: error.response.data,
      });
    } else if (error.request) {
      return Promise.reject({
        message: 'Serverga ulanib bo\'lmadi. Internetni tekshiring.',
        status: 0,
      });
    } else {
      return Promise.reject({
        message: error.message || 'Noma\'lum xatolik yuz berdi',
        status: -1,
      });
    }
  }
);
