import { apiClient } from '../client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CarouselMediaItemResponse {
  id: number;
  media_type: 'image' | 'video' | 'gif';
  media_url: string;
  media_s3_key: string | null;
  order: number;
}

export interface CarouselItemResponse {
  id: number;
  type: string;
  title: string | null;
  sub_title: string | null;
  media_type: 'image' | 'video' | 'gif';
  media_url: string;
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

// ─── API functions ────────────────────────────────────────────────────────────

/** Fetch all active carousel items for the current user, sorted by display order. */
export async function getActiveCarouselItems(): Promise<CarouselItemResponse[]> {
  const res = await apiClient.get<CarouselItemResponse[]>('/api/v1/carousel/');
  return res.data;
}

/**
 * Track a carousel item view with session-level deduplication.
 *
 * `sessionStorage` key `cv:{itemId}` prevents re-counting within the same
 * app session — if the user scrolls back to the same card it won't fire again.
 * Tracking failures are swallowed silently (never block the UI).
 */
export async function trackCarouselView(itemId: number): Promise<void> {
  const storageKey = `cv:${itemId}`;
  if (sessionStorage.getItem(storageKey)) return;
  // Mark before the request so rapid re-renders don't fire duplicate calls
  sessionStorage.setItem(storageKey, '1');
  try {
    await apiClient.post(`/api/v1/carousel/${itemId}/view`);
  } catch {
    // Don't clear the key on failure — avoids retry spam on flaky networks
  }
}

/**
 * Track a carousel item click with session-level deduplication.
 *
 * `sessionStorage` key `cc:{itemId}` prevents re-counting within the same
 * app session. On network error the key is cleared so the next genuine click
 * can retry.
 */
export async function trackCarouselClick(itemId: number): Promise<void> {
  const storageKey = `cc:${itemId}`;
  if (sessionStorage.getItem(storageKey)) return;
  sessionStorage.setItem(storageKey, '1');
  try {
    await apiClient.post(`/api/v1/carousel/${itemId}/click`);
  } catch {
    // Clear on error so the next real click can succeed
    sessionStorage.removeItem(storageKey);
  }
}
