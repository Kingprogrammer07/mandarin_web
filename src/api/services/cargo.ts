import { apiClient, apiClientFormData } from '../client';
import { API_BASE_URL } from '@/config/config';

export interface CargoPhoto {
  id: string;
  flight_name: string;
  client_id: string;
  photo_file_ids: string[]; // Array of Telegram file IDs
  weight_kg: number | null;
  price_per_kg: number | null;
  comment: string | null;
  is_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface FlightPhotosResponse {
  flight_name: string;
  photos: CargoPhoto[];
  total: number;
  unique_clients: number;
  unsent_count: number;
  sent_count: number;
  page: number;
  size: number;
  total_pages: number;
}

export interface ClientPhotosResponse {
  flight_name: string;
  client_id: string;
  photos: CargoPhoto[];
  total: number;
}

export interface PhotoUploadResponse {
  success: boolean;
  message: string;
  photo: CargoPhoto;
}

export interface FlightStatsResponse {
  flight_name: string;
  total_photos: number;
  unique_clients: number;
}

export interface CargoDeleteResponse {
  success: boolean;
  message: string;
  deleted_cargo_id: string;
}

export interface CargoUpdateResponse {
  success: boolean;
  message: string;
  photo: CargoPhoto;
}

// ==================== Track Code Search (NEW) ====================

export interface CargoItemResponse {
  id: number;
  track_code: string;
  flight_name?: string;
  client_id?: string;

  // Item details
  item_name_cn?: string;
  item_name_ru?: string;
  quantity?: string;
  weight_kg?: string;
  price_per_kg_usd?: string;
  price_per_kg_uzs?: string;
  total_payment_usd?: string;
  total_payment_uzs?: string;
  exchange_rate?: string;
  box_number?: string;

  // Status and Dates
  checkin_status: string; // 'pre' for China, 'post' for Uzbekistan
  pre_checkin_date?: string;
  post_checkin_date?: string;

  // Flight cargo / billing status
  is_sent_web?: boolean;
  is_taken_away?: boolean;
  taken_away_date?: string;
}

export interface TrackCodeSearchResponse {
  found: boolean;
  track_code: string;
  items: CargoItemResponse[];
  total_count: number;
}

// Track cargo by code
export const trackCargo = async (trackCode: string): Promise<TrackCodeSearchResponse> => {
  const response = await apiClient.get<TrackCodeSearchResponse>(`/api/v1/cargo/track/${trackCode}`);
  return response.data;
};

// Get paginated photos for a flight with optional server-side search
export const getFlightPhotos = async (
  flightName: string,
  page: number = 1,
  size: number = 50,
  search?: string,
): Promise<FlightPhotosResponse> => {
  const params: Record<string, string | number> = { page, size };
  if (search && search.trim() !== '') {
    params.search = search.trim();
  }
  const response = await apiClient.get<FlightPhotosResponse>(
    `/api/v1/flights/${flightName}/photos`,
    { params },
  );
  return response.data;
};

// Get photos for a specific client in a flight
export const getClientPhotos = async (flightName: string, clientId: string): Promise<ClientPhotosResponse> => {
  const response = await apiClient.get<ClientPhotosResponse>(`/api/v1/flights/${flightName}/photos/${clientId}`);
  return response.data;
};

// Upload photos (multipart/form-data) - supports single or multiple photos
export const uploadPhoto = async (
  flightName: string,
  clientId: string,
  photos: File[], // Now accepts array of files
  weightKg?: number,
  pricePerKg?: number,
  comment?: string
): Promise<PhotoUploadResponse> => {
  const formData = new FormData();
  formData.append('flight_name', flightName);
  formData.append('client_id', clientId.toUpperCase());

  // Append all photos with the same field name 'photos'
  photos.forEach((photo) => {
    formData.append('photos', photo);
  });

  if (weightKg !== undefined && weightKg !== null) {
    formData.append('weight_kg', weightKg.toString());
  }

  if (pricePerKg !== undefined && pricePerKg !== null) {
    formData.append('price_per_kg', pricePerKg.toString());
  }

  if (comment) {
    formData.append('comment', comment);
  }

  const response = await apiClientFormData.post<PhotoUploadResponse>('/api/v1/flights/photos', formData);
  return response.data;
};

// Get flight photo statistics
export const getFlightStats = async (flightName: string): Promise<FlightStatsResponse> => {
  const response = await apiClient.get<FlightStatsResponse>(`/api/v1/flights/${flightName}/stats`);
  return response.data;
};

// Delete a single cargo photo
export const deleteCargo = async (cargoId: string): Promise<CargoDeleteResponse> => {
  const response = await apiClient.delete<CargoDeleteResponse>(`/api/v1/flights/photos/${cargoId}`);
  return response.data;
};

// Clear all photos for a flight
export const clearFlightPhotos = async (flightName: string): Promise<void> => {
  await apiClient.delete(`/api/v1/flights/${flightName}/photos`);
};

// Update cargo photo (PUT request with multipart/form-data)
export const updateCargo = async (
  cargoId: string,
  flightName?: string,
  clientId?: string,
  weightKg?: number,
  pricePerKg?: number,
  comment?: string,
  photos?: File[] // Now accepts array of files (replaces ALL existing photos)
): Promise<CargoUpdateResponse> => {
  const formData = new FormData();

  if (flightName !== undefined && flightName !== null) {
    formData.append('flight_name', flightName.toUpperCase());
  }

  if (clientId !== undefined && clientId !== null) {
    formData.append('client_id', clientId.toUpperCase());
  }

  if (weightKg !== undefined && weightKg !== null) {
    formData.append('weight_kg', weightKg.toString());
  }

  if (pricePerKg !== undefined && pricePerKg !== null) {
    formData.append('price_per_kg', pricePerKg.toString());
  }

  if (comment !== undefined && comment !== null) {
    formData.append('comment', comment);
  }

  // If photos provided, append all (this replaces ALL existing photos)
  if (photos && photos.length > 0) {
    photos.forEach((photo) => {
      formData.append('photos', photo);
    });
  }

  const response = await apiClientFormData.put<CargoUpdateResponse>(
    `/api/v1/flights/photos/${cargoId}`,
    formData
  );
  return response.data;
};

// ==================== Cargo Image Metadata (NEW v2.0) ====================

export interface CargoPhotoMetadata {
  index: number;
  file_id: string;
  telegram_url: string | null;
  is_regenerated: boolean;
  error: string | null;
}

export interface CargoImageMetadataResponse {
  cargo_id: number;
  flight_name: string;
  client_id: string;
  photo_count: number;
  photos: CargoPhotoMetadata[];
}

// Get cargo image metadata with optional URL resolution
export const getCargoImageMetadata = async (
  cargoId: number | string,
  resolveUrls: boolean = true
): Promise<CargoImageMetadataResponse> => {
  const response = await apiClient.get<CargoImageMetadataResponse>(
    `/api/v1/flights/photos/${cargoId}/metadata`,
    {
      params: { resolve_urls: resolveUrls }
    }
  );
  return response.data;
};

// ==================== Excel Export (Download) ====================

/**
 * Parse filename from Content-Disposition header.
 * Supports both `filename*=UTF-8''encoded` and `filename="name"` formats.
 */
function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;

  // Try UTF-8 encoded filename first: filename*=UTF-8''My%20File.xlsx
  const utf8Match = header.match(/filename\*=UTF-8''(.+?)(?:;|$)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch { /* fall through */ }
  }

  // Fallback: filename="My File.xlsx" or filename=MyFile.xlsx
  const standardMatch = header.match(/filename="?([^";\n]+)"?/i);
  if (standardMatch) {
    return standardMatch[1].trim();
  }

  return null;
}

/**
 * Trigger file download via anchor tag (desktop fallback).
 */
function downloadViaAnchor(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Cleanup after a short delay to ensure download starts
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 150);
}

/**
 * Try to share the file using Web Share API (mobile/Android).
 * Returns true if sharing succeeded, false if unsupported or cancelled.
 */
async function tryShareFile(blob: Blob, filename: string): Promise<boolean> {
  try {
    const file = new File([blob], filename, { type: blob.type });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return true;
    }
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'name' in (err as object) && (err as { name?: string }).name === 'AbortError') {
      return true; // User intentionally cancelled, treat as handled
    }
    console.warn('Web Share API failed, falling back to anchor download:', err);
  }
  return false;
}

/**
 * Export flight cargo data as an Excel file download.
 * Uses XMLHttpRequest for download progress tracking.
 *
 * - Parses Content-Disposition header for dynamic filename from backend.
 * - On mobile (Android Telegram WebView): uses Web Share API for reliable saving.
 * - On desktop: uses standard anchor-tag download.
 *
 * Backend endpoint: GET /api/v1/flights/{flight_name}/export
 * Rate limited: 1 request per 60 seconds per IP per flight.
 */
export const exportFlightCargoExcel = (
  flightName: string,
  onProgress?: (percent: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';

    // Track download progress
    xhr.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const blob = xhr.response as Blob;

        // Extract filename from Content-Disposition or use default
        const disposition = xhr.getResponseHeader('Content-Disposition');
        const filename =
          parseContentDispositionFilename(disposition)
          || `${flightName.toUpperCase()}_cargo_export.xlsx`;

        try {
          // Mobile strategy: Web Share API (fixes Android Telegram WebView)
          const shared = await tryShareFile(blob, filename);

          // Desktop fallback: anchor tag download
          if (!shared) {
            downloadViaAnchor(blob, filename);
          }

          resolve();
        } catch {
          // Last resort fallback
          downloadViaAnchor(blob, filename);
          resolve();
        }
      } else {
        // Parse error from response (it may be JSON even on error)
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result as string);
            reject({
              message: data.detail || 'Export failed',
              status: xhr.status,
            });
          } catch {
            reject({
              message: xhr.status === 429
                ? 'rate_limit'
                : xhr.status === 404
                  ? 'no_data'
                  : 'Export failed',
              status: xhr.status,
            });
          }
        };
        reader.onerror = () => {
          reject({ message: 'Export failed', status: xhr.status });
        };
        reader.readAsText(xhr.response as Blob);
      }
    });

    xhr.addEventListener('error', () => {
      reject({
        message: 'network_error',
        status: 0,
      });
    });

    xhr.addEventListener('abort', () => {
      reject({
        message: 'cancelled',
        status: -1,
      });
    });

    xhr.open('GET', `${API_BASE_URL}/api/v1/flights/${flightName.toUpperCase()}/export`);

    // Add Telegram init data header if available
    if (window.Telegram?.WebApp?.initData) {
      xhr.setRequestHeader('X-Telegram-Init-Data', window.Telegram.WebApp.initData);
    }
    const adminToken = localStorage.getItem('access_token');

    xhr.setRequestHeader('X-Admin-Authorization', `Bearer ${adminToken}`);

    xhr.send();
  });
};


// ==================== Client Cargo History (Master-Detail) ====================

export interface ClientFlightSummary {
  flight_name: string;
  total_count: number;
  total_weight: number;
  last_update: string | null;
}

export interface ClientFlightDetailResponse {
  flight_name: string;
  items: CargoItemResponse[];
  total: number;
  page: number;
  size: number;
}

// Get client flight history (Master list)
export const getClientFlightHistory = async (clientCode: string): Promise<ClientFlightSummary[]> => {
  const response = await apiClient.get<ClientFlightSummary[]>(`/api/v1/cargo/history/${clientCode}/flights`);
  return response.data;
};

// Get detailed cargo for a specific flight (Detail list)
export const getClientFlightDetails = async (
  clientCode: string,
  flightName: string,
  page: number = 1,
  size: number = 20
): Promise<ClientFlightDetailResponse> => {
  const response = await apiClient.get<ClientFlightDetailResponse>(
    `/api/v1/cargo/history/${clientCode}/flights/${flightName}`,
    {
      params: { page, size }
    }
  );
  return response.data;
};
