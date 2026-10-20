import { apiClient } from '@/api/client';

/**
 * Admin side of the public landing page (mandarincargo.uz).
 *
 * The landing is a static site: it reads `/api/v1/public/landing` at build
 * time. Saving here changes what the *next* build shows; `publish()` asks
 * Vercel for that build.
 */

const BASE = '/api/v1/admin/landing';

export const LANDING_LANGS = ['uz', 'ru', 'en', 'cn'] as const;
export type LandingLang = (typeof LANDING_LANGS)[number];

export const METRIC_KEYS = [
  'clients',
  'cargo_kg',
  'flights',
  'delivery_days_median',
  'delivery_days_p90',
  'years',
  'channel_subscribers',
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export const LINK_KEYS = ['bot_url', 'channel_url', 'instagram_url', 'facebook_url'] as const;
export type LinkKey = (typeof LINK_KEYS)[number];

export interface MetricOverride {
  value?: number | null;
  hidden?: boolean;
}

export interface LandingTier {
  id: number;
  name: Partial<Record<LandingLang, string>>;
  description: Partial<Record<LandingLang, string>>;
  badges: Partial<Record<LandingLang, string[]>>;
  /** For a base-price tier this is the live `price_per_kg`, not the stored value. */
  price_usd: number | null;
  old_price_usd: number | null;
  uses_base_price: boolean;
  is_popular: boolean;
  is_active: boolean;
  sort_order: number;
}

export type LandingTierInput = Omit<LandingTier, 'id'>;

export interface LandingAdminData {
  founded_year: number;
  links: Partial<Record<LinkKey, string>>;
  stat_overrides: Partial<Record<MetricKey, MetricOverride>>;
  /** Numbers from the database (cached for 6 hours). */
  computed: Partial<Record<MetricKey, number | null>>;
  /** What the landing receives after overrides; null = not shown. */
  published: Partial<Record<MetricKey, number | null>>;
  delivery_sample_size: number;
  computed_at: string | null;
  base_price_usd: number | null;
  tiers: LandingTier[];
  /** False until API_LANDING_DEPLOY_HOOK_URL is set on the server. */
  publish_configured: boolean;
  last_published_at: string | null;
  /** Bot asks clients for a rating a few days after pickup. */
  review_prompts_enabled: boolean;
  /** Average of every rating, whatever its moderation status. */
  rating_average: number | null;
  rating_count: number;
  reviews_pending: number;
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface LandingReviewItem {
  id: number;
  client_code: string;
  flight_name: string | null;
  rating: number;
  /** Null when the client gave stars only. */
  text: string | null;
  /** Name shown on the site, e.g. "Dilshod A.". */
  author_name: string;
  language: string;
  status: ReviewStatus;
  created_at: string | null;
  moderated_at: string | null;
}

export interface LandingReviewList {
  items: LandingReviewItem[];
  total: number;
}

export interface ReviewListParams {
  status?: ReviewStatus;
  with_text?: boolean;
  limit?: number;
  offset?: number;
}

export interface LandingSettingsUpdate {
  founded_year?: number;
  /** null removes the link from the landing. */
  links?: Partial<Record<LinkKey, string | null>>;
  /** Replaces all overrides; entries without a value and not hidden are dropped. */
  stat_overrides?: Partial<Record<MetricKey, MetricOverride>>;
  review_prompts_enabled?: boolean;
}

export const landingAdminService = {
  async get(): Promise<LandingAdminData> {
    const { data } = await apiClient.get<LandingAdminData>(BASE);
    return data;
  },

  async refreshStats(): Promise<LandingAdminData> {
    const { data } = await apiClient.post<LandingAdminData>(`${BASE}/refresh-stats`);
    return data;
  },

  async updateSettings(body: LandingSettingsUpdate): Promise<LandingAdminData> {
    const { data } = await apiClient.put<LandingAdminData>(`${BASE}/settings`, body);
    return data;
  },

  async createTier(body: LandingTierInput): Promise<LandingTier> {
    const { data } = await apiClient.post<LandingTier>(`${BASE}/tiers`, body);
    return data;
  },

  async updateTier(id: number, body: LandingTierInput): Promise<LandingTier> {
    const { data } = await apiClient.put<LandingTier>(`${BASE}/tiers/${id}`, body);
    return data;
  },

  async deleteTier(id: number): Promise<void> {
    await apiClient.delete(`${BASE}/tiers/${id}`);
  },

  async listReviews(params: ReviewListParams): Promise<LandingReviewList> {
    const { data } = await apiClient.get<LandingReviewList>(`${BASE}/reviews`, { params });
    return data;
  },

  /** Staff change the status or the displayed name; the client's words stay as written. */
  async updateReview(
    id: number,
    body: { status?: ReviewStatus; author_name?: string },
  ): Promise<LandingReviewItem> {
    const { data } = await apiClient.patch<LandingReviewItem>(`${BASE}/reviews/${id}`, body);
    return data;
  },

  async publish(): Promise<{ last_published_at: string }> {
    const { data } = await apiClient.post<{ last_published_at: string }>(`${BASE}/publish`);
    return data;
  },
};
