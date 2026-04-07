import { apiClient, apiClientFormData } from '../client';
import type { CarouselMediaItemResponse } from './carousel';

// Re-export so callers only need to import from adminCarousel
export type { CarouselMediaItemResponse } from './carousel';

// ─── Auth helper ───────────────────────────────────────────────────────────────

function adminAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  if (!token) return {};
  return { 'X-Admin-Authorization': `Bearer ${token}` };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CarouselMediaType = 'image' | 'gif' | 'video';

/** Returned after a successful media upload to S3. */
export interface CarouselMediaUploadResponse {
  /** S3 object key — store this on the carousel item */
  s3_key: string;
  /** Public HTTPS URL ready to use in media_url field */
  media_url: string;
  /** Detected media type */
  media_type: CarouselMediaType;
  /** Uploaded file size in bytes */
  size_bytes: number;
}

export interface CarouselItemResponse {
  id: number;
  /** 'ad' | 'feature' */
  type: string;
  title: string | null;
  sub_title: string | null;
  media_type: CarouselMediaType;
  media_url: string;
  /** Present only for S3-backed media; null for external URLs */
  media_s3_key: string | null;
  action_url: string | null;
  text_color: string;
  gradient: string | null;
  order: number;
  is_active: boolean;
  created_at: string;
  /** Gallery slides — empty for "ad" items, 0-N for "feature" items */
  media_items: CarouselMediaItemResponse[];
}

export interface CarouselItemStatsResponse extends CarouselItemResponse {
  total_views: number;
  total_clicks: number;
}

/**
 * Input shape for a single gallery slide (used in create/update requests).
 * Exactly one of `media_url` (external link) or `media_s3_key` (S3 key) must
 * be provided — the backend validator enforces this.
 */
export type CarouselMediaItemInput = {
  media_type: CarouselMediaType;
  order: number;
} & (
  | { media_url: string; media_s3_key?: never }
  | { media_s3_key: string; media_url?: never }
);

export interface CarouselItemCreateRequest {
  type: string;
  title?: string;
  sub_title?: string;
  media_type: CarouselMediaType;
  /** Main item media — required for "ad" items; optional for "feature" when media_items provided */
  media_url?: string;
  media_s3_key?: string;
  /** Gallery slides for "feature" type items */
  media_items?: CarouselMediaItemInput[];
  action_url?: string;
  text_color: string;
  gradient?: string;
  order: number;
  is_active: boolean;
}

export interface CarouselItemUpdateRequest {
  type?: string;
  title?: string | null;
  sub_title?: string | null;
  media_type?: CarouselMediaType;
  /** Switch to an external URL (clears s3_key on backend) */
  media_url?: string;
  /** Switch to a newly uploaded S3 file (old S3 file is deleted by backend) */
  media_s3_key?: string | null;
  /** Full replacement of gallery slides */
  media_items?: CarouselMediaItemInput[];
  action_url?: string | null;
  text_color?: string;
  gradient?: string | null;
  order?: number;
  is_active?: boolean;
}

// ─── API functions ─────────────────────────────────────────────────────────────

/**
 * Upload a media file to S3 and return the public URL + s3_key.
 * Pass `onProgress` to receive real-time upload progress (0–100).
 * Do NOT set Content-Type manually — axios derives the multipart boundary automatically.
 */
export async function uploadCarouselMedia(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CarouselMediaUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  // Use apiClientFormData — its default Content-Type is 'multipart/form-data', which causes
  // axios 1.x to delete the header entirely and let the browser XHR set it with the correct
  // multipart boundary.  Using apiClient (default: application/json) would make axios keep
  // that header, FastAPI would try to parse the body as JSON, and the upload would 422.
  const res = await apiClientFormData.post<CarouselMediaUploadResponse>(
    '/api/v1/admin/carousel/upload',
    formData,
    {
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          // Cap at 99 until server responds to avoid premature 100%
          const percent = Math.min(
            Math.round((event.loaded * 100) / event.total),
            99,
          );
          onProgress(percent);
        }
      },
    },
  );
  return res.data;
}

export async function uploadCarouselMediaBatch(
  files: File[],
  onProgress?: (fileIndex: number, percent: number) => void,
): Promise<CarouselMediaUploadResponse[]> {
  const promises = files.map((file, index) =>
    uploadCarouselMedia(file, (percent) => {
      onProgress?.(index, percent);
    }),
  );
  return Promise.all(promises);
}

/** Returns all carousel items including inactive ones (admin view). */
export async function getAdminCarouselItems(): Promise<CarouselItemResponse[]> {
  const res = await apiClient.get<CarouselItemResponse[]>('/api/v1/admin/carousel/', {
    headers: adminAuthHeaders(),
  });
  return res.data;
}

/** Returns all carousel items with aggregated view/click statistics. */
export async function getCarouselStats(): Promise<CarouselItemStatsResponse[]> {
  const res = await apiClient.get<CarouselItemStatsResponse[]>('/api/v1/admin/carousel/stats', {
    headers: adminAuthHeaders(),
  });
  return res.data;
}

export async function createCarouselItem(
  data: CarouselItemCreateRequest,
): Promise<CarouselItemResponse> {
  const res = await apiClient.post<CarouselItemResponse>('/api/v1/admin/carousel/', data, {
    headers: adminAuthHeaders(),
  });
  return res.data;
}

export async function updateCarouselItem(
  item_id: number,
  data: CarouselItemUpdateRequest,
): Promise<CarouselItemResponse> {
  const res = await apiClient.put<CarouselItemResponse>(
    `/api/v1/admin/carousel/${item_id}`,
    data,
    { headers: adminAuthHeaders() },
  );
  return res.data;
}

export async function deleteCarouselItem(item_id: number): Promise<void> {
  await apiClient.delete(`/api/v1/admin/carousel/${item_id}`, {
    headers: adminAuthHeaders(),
  });
}

/**
 * Append a single gallery slide to an existing carousel item.
 * Use this when editing an item to add new slides without replacing all existing ones.
 */
export async function addCarouselMediaItem(
  item_id: number,
  data: CarouselMediaItemInput,
): Promise<CarouselMediaItemResponse> {
  const res = await apiClient.post<CarouselMediaItemResponse>(
    `/api/v1/admin/carousel/${item_id}/media`,
    data,
    { headers: adminAuthHeaders() },
  );
  return res.data;
}

/**
 * Remove a single gallery slide from an existing carousel item.
 */
export async function deleteCarouselMediaItem(
  item_id: number,
  media_id: number,
): Promise<void> {
  await apiClient.delete(
    `/api/v1/admin/carousel/${item_id}/media/${media_id}`,
    { headers: adminAuthHeaders() },
  );
}
