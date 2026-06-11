import { apiClient } from '@/api/client';

/** One person the current user invited (privacy-trimmed by the backend). */
export interface ReferredClient {
  client_code: string | null;
  /** First name only — surnames are never returned. */
  name: string;
  /** DD.MM.YYYY */
  joined_at: string;
}

export interface ReferralInfo {
  /** Full `https://t.me/<bot>?start=<payload>` deep link, or '' if unresolved. */
  invite_link: string;
  /** Raw `<telegram_id>_<primary_code>` start payload. */
  invite_payload: string;
  primary_code: string;
  /** Total invited across all pages. */
  referral_count: number;
  /** Current page of invited clients. */
  invited: ReferredClient[];
  page: number;
  page_size: number;
  has_more: boolean;
}

/** Fetch the current user's referral page data (share + stats, paginated list). */
export async function getReferralInfo(page = 1): Promise<ReferralInfo> {
  const { data } = await apiClient.get<ReferralInfo>('/api/v1/profile/referral', {
    params: { page },
  });
  return data;
}
