import { apiClient } from '@/api/client';

/**
 * Admin-side outbound notifications: templates, dry-run previews and campaigns.
 * Distinct from `notificationService`, which reads a single user's in-app feed.
 */

export type NotificationChannel = 'telegram' | 'sms';

/**
 * Who to include, on top of channel reachability.
 *
 * `telegram_unreachable` is the cost control for SMS: paying to text someone the
 * bot already reached for free is waste.
 */
export type CampaignAudience = 'all' | 'telegram_unreachable';

/**
 * Where the recipient list comes from.
 *
 * `manual` is an explicit list the operator pastes — client codes, phone
 * numbers, or a mix of both.
 */
export type AudienceSource = 'flight' | 'segment' | 'manual';

/**
 * Whether the frequency cap applies.
 *
 * `transactional` is service information the client needs — "your cargo
 * arrived". Always delivered. `promotional` is news, offers and reminders:
 * subject to the 7-day cap and to the client's marketing opt-out.
 */
export type CampaignKind = 'transactional' | 'promotional';

export interface SegmentParam {
  name: string;
  label: string;
  /** `number` renders a numeric input, `region` a region picker. */
  kind: 'number' | 'region';
  default: unknown;
}

export interface Segment {
  key: string;
  label: string;
  description: string;
  param: SegmentParam | null;
  /** Live size. Null for segments that need operator input first. */
  count: number | null;
}

/** How to work out who receives a message. */
export interface AudienceSpec {
  source: AudienceSource;
  flight_name?: string | null;
  segment?: string | null;
  segment_params?: Record<string, unknown>;
  /** For `source: 'manual'` — pasted codes and/or phones, any separator. */
  recipients?: string | null;
  audience?: CampaignAudience;
}

export type CampaignStatus =
  | 'queued'
  | 'running'
  | 'cancelling'
  | 'cancelled'
  | 'completed'
  | 'failed';

/** Statuses where no further messages will go out. */
export const TERMINAL_CAMPAIGN_STATUSES: CampaignStatus[] = [
  'cancelled',
  'completed',
  'failed',
];

export interface NotificationTemplate {
  id: number;
  /** Database identifier, e.g. "cargo_in_china". Never shown to an operator. */
  key: string;
  /** Human name for `key` — this is what the UI displays. */
  label: string;
  /** When this notification goes out, in the operator's words. */
  description: string;
  channel: NotificationChannel;
  lang: string;
  title: string | null;
  body: string;
  is_active: boolean;
  /** Placeholder names the body uses, e.g. ["flight", "track"]. */
  placeholders: string[];
  /** SMS only — billable segments this body costs. */
  sms_segments: number | null;
  sms_encoding: string | null;
}

/** Draft text rendered against sample data — nothing is saved. */
export interface TemplatePreview {
  rendered: string;
  placeholders: string[];
  /** Placeholders nothing will fill — they reach the client as literal text. */
  unknown_placeholders: string[];
  available_placeholders: string[];
  sms_length: number | null;
  sms_segments: number | null;
  sms_encoding: string | null;
}

/** One test message to an admin's own Telegram or phone. */
export interface TestSendResult {
  ok: boolean;
  error: string | null;
  resolved_telegram_id: number | null;
  /** Number the SMS went to; null on the Telegram channel. */
  resolved_phone: string | null;
  channel: NotificationChannel;
  /** Text as delivered, after placeholder substitution. */
  rendered: string;
}

/**
 * Dry-run result. `reachable` is who will actually be messaged; `already_notified`
 * were sent this event before, so a re-import will not message them again.
 */
export interface CampaignPreview {
  source: AudienceSource;
  flight_name: string | null;
  segment: string | null;
  channel: NotificationChannel;
  audience: CampaignAudience;
  kind: CampaignKind;
  total_clients: number;
  reachable: number;
  unreachable: number;
  /** `unreachable` split by cause, so the operator knows what to fix. */
  unreachable_no_phone: number;
  unreachable_no_consent: number;
  unreachable_no_telegram: number;
  /** Reachable but left out by the audience choice — not the same as unreachable. */
  excluded_by_filter: number;
  /** Promotional only: asked not to receive news and offers. */
  opted_out: number;
  /** Promotional only: already heard from us inside the 7-day window. */
  too_soon: number;
  /** The segment was bigger than the safety cap and was trimmed. */
  truncated: boolean;
  already_notified: number;
  /** First 20 only — `unknown_count` is the real total. */
  unknown_codes: string[];
  unknown_count: number;
  sample_message: string | null;
  sms_segments: number | null;
  sms_encoding: string | null;
  /** SMS only — today's usage against the hard daily ceiling. */
  sms_daily_used: number | null;
  sms_daily_limit: number | null;
  sms_provider: string | null;
}

export interface Campaign {
  id: number;
  title: string;
  channel: NotificationChannel;
  template_key: string | null;
  status: CampaignStatus;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  percent: number;
  created_by: string | null;
  created_at: string | null;
  finished_at: string | null;
  error: string | null;
}

/**
 * Inline button attached under every message of a Telegram campaign.
 *
 * A closed set, mirrored from the backend: the button's callback reaches a bot
 * handler, so the panel picks a named action, never raw callback data.
 */
export type CampaignAttachment = 'sms_opt_in';

export interface CreateCampaignBody extends AudienceSpec {
  channel: NotificationChannel;
  template_key?: string | null;
  custom_body?: string | null;
  title?: string | null;
  kind?: CampaignKind | null;
  attach?: CampaignAttachment | null;
}

export interface PreviewBody extends AudienceSpec {
  channel: NotificationChannel;
  template_key?: string | null;
  custom_body?: string | null;
  kind?: CampaignKind | null;
}

const BASE = '/api/v1/notifications';

export const campaignService = {
  async listTemplates(): Promise<NotificationTemplate[]> {
    const response = await apiClient.get<NotificationTemplate[]>(`${BASE}/templates`);
    return response.data;
  },

  async updateTemplate(
    templateId: number,
    body: { body?: string; title?: string; is_active?: boolean },
  ): Promise<NotificationTemplate> {
    const response = await apiClient.patch<NotificationTemplate>(
      `${BASE}/templates/${templateId}`,
      body,
    );
    return response.data;
  },

  /**
   * Render draft template text server-side. Deliberately not done in the
   * browser: the preview must use the same substitution, escaping and SMS
   * segment rules as the real send, and a second implementation would drift.
   */
  async previewTemplate(body: {
    body: string;
    channel: NotificationChannel;
    flight_name?: string;
  }): Promise<TemplatePreview> {
    const response = await apiClient.post<TemplatePreview>(
      `${BASE}/templates/preview`,
      body,
    );
    return response.data;
  },

  /** Available audiences with their current size. */
  async listSegments(): Promise<Segment[]> {
    const response = await apiClient.get<Segment[]>(`${BASE}/segments`);
    return response.data;
  },

  /**
   * Send one message to an admin's own Telegram before the real run.
   *
   * `target` accepts a Telegram id, a phone number or a client code. Whatever
   * it resolves to must still be an admin account — the server refuses anything
   * else, so this cannot become a way to message a client off the record.
   */
  async testSend(body: {
    channel: NotificationChannel;
    body: string;
    target: string;
    /** Fills `{flight}` and the sample track codes, as in the editor preview. */
    flight_name?: string;
  }): Promise<TestSendResult> {
    const response = await apiClient.post<TestSendResult>(`${BASE}/test-send`, body);
    return response.data;
  },

  /** Writes nothing — shows the blast radius before committing. */
  async preview(body: PreviewBody): Promise<CampaignPreview> {
    const response = await apiClient.post<CampaignPreview>(`${BASE}/preview`, body);
    return response.data;
  },

  async createCampaign(body: CreateCampaignBody): Promise<Campaign> {
    const response = await apiClient.post<Campaign>(`${BASE}/campaigns`, body);
    return response.data;
  },

  async listCampaigns(limit = 30): Promise<Campaign[]> {
    const response = await apiClient.get<Campaign[]>(`${BASE}/campaigns`, {
      params: { limit },
    });
    return response.data;
  },

  async getCampaign(campaignId: number): Promise<Campaign> {
    const response = await apiClient.get<Campaign>(`${BASE}/campaigns/${campaignId}`);
    return response.data;
  },

  /** Stops after the current batch; already-sent messages cannot be recalled. */
  async cancelCampaign(campaignId: number): Promise<Campaign> {
    const response = await apiClient.post<Campaign>(`${BASE}/campaigns/${campaignId}/cancel`);
    return response.data;
  },
};
