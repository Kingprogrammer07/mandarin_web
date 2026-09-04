import { apiClient } from '@/api/client';

/**
 * SMS gateway configuration, editable by a super-admin.
 *
 * The password is never part of this type: the API reports only whether one is
 * stored. Returning the credential so the form could pre-fill it would put it
 * in every browser cache and proxy log.
 */
export interface SmsSettings {
  provider: 'none' | 'smsgate';
  /**
   * Which SMS Gate server `base_url` points at. The paths differ —
   * cloud/private serve `/3rdparty/v1/messages`, the phone's own server serves
   * `/message` — so this cannot be inferred from the URL.
   */
  mode: 'cloud' | 'local';
  base_url: string;
  username: string;
  password_set: boolean;
  device_id: string;
  sim_number: number | null;
  /** Refuse to queue unless the phone was online this recently. 0 disables. */
  active_within_hours: number;
  daily_limit: number;
  message_ttl_seconds: number;
  request_timeout_seconds: number;
  updated_at: string | null;
  updated_by: string | null;
  /** Stored password can no longer be decrypted — it must be re-entered. */
  password_unreadable: boolean;
}

/** One place the bot can offer a video guide. */
export interface VideoGuideEntry {
  key: string;
  label: string;
  /** Where in the bot this guide appears. */
  placement: string;
  /** Empty when no video has been recorded yet — the bot then shows nothing. */
  url: string;
}

export interface VideoGuides {
  guides: VideoGuideEntry[];
  updated_at: string | null;
  updated_by: string | null;
}

/** One home-menu button that can carry a premium custom emoji. */
export interface ButtonIconEntry {
  key: string;
  label: string;
  /** Numeric Telegram custom emoji id. Empty = plain button. */
  emoji_id: string;
  /** '', 'primary', 'success' or 'danger'. */
  style: string;
}

export interface ButtonIcons {
  enabled: boolean;
  buttons: ButtonIconEntry[];
  /** Telegram refused the decoration; it is off regardless of `enabled`. */
  auto_disabled: boolean;
  auto_disabled_reason: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

/** One plain emoji and the premium one shown in its place in message text. */
export interface MessageEmojiEntry {
  emoji: string;
  emoji_id: string;
}

export interface MessageEmoji {
  enabled: boolean;
  entries: MessageEmojiEntry[];
  /** Telegram refused the decoration; it is off regardless of `enabled`. */
  auto_disabled: boolean;
  auto_disabled_reason: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface MessageEmojiUpdate {
  enabled?: boolean;
  /** Full replacement map; `{}` clears it. */
  mapping?: Record<string, string>;
}

export interface ButtonIconsUpdate {
  enabled?: boolean;
  icons?: Record<string, { emoji_id?: string; style?: string }>;
}

/** One phone registered on the gateway account. */
export interface SmsDevice {
  id: string;
  name: string;
  /** ISO timestamp exactly as the gateway reported it. */
  last_seen: string;
}

/** Read-only probe result — no message is sent. */
export interface SmsCheckResult {
  ok: boolean;
  detail: string;
  devices: SmsDevice[];
}

export interface SmsSettingsUpdate {
  provider?: 'none' | 'smsgate';
  mode?: 'cloud' | 'local';
  base_url?: string;
  username?: string;
  /** Omit to keep the stored password; send a value to replace it. */
  password?: string;
  /** Explicit erase — an omitted password means "leave it alone". */
  clear_password?: boolean;
  device_id?: string;
  sim_number?: number | null;
  active_within_hours?: number;
  daily_limit?: number;
  message_ttl_seconds?: number;
  request_timeout_seconds?: number;
}

/** Where the nightly database dump goes, and how the last attempt went. */
export interface BackupSettings {
  /** The panel's choice. `null` means the server falls back to its env value. */
  channel_id: number | null;
  /** What the scheduler will actually use once that fallback is applied. */
  effective_channel_id: number | null;
  daily_enabled: boolean;
  /** Hour of day in Asia/Tashkent. */
  hour: number;
  last_at: string | null;
  /** `null` when no backup has run on this deployment yet. */
  last_ok: boolean | null;
  last_size: number | null;
  last_error: string | null;
  /** Telegram's document ceiling, so the screen can warn before it is hit. */
  size_limit: number;
}

export interface BackupSettingsUpdate {
  channel_id: number | null;
  daily_enabled: boolean;
  hour: number;
}

export interface BackupCheckResult {
  ok: boolean;
  chat_id: number;
  title: string | null;
  chat_type: string | null;
  can_send: boolean;
  detail: string;
}

export interface BackupRunResult {
  ok: boolean;
  size_bytes: number | null;
  chat_id: number | null;
  error: string | null;
}

export interface MaintenanceStatusResponse {
  maintenance: boolean;
  is_admin: boolean;
}

export interface MaintenanceToggleRequest {
  active: boolean;
}

export interface NbuStatusResponse {
  enabled: boolean;
}

export interface NbuToggleRequest {
  active: boolean;
}

export interface RedisInfoResponse {
  info: string;
}

export interface RedisClientsResponse {
  clients: string;
}

export interface NbuPendingPaymentRow {
  id: number;
  transaction_id: string;
  order_id: string;
  telegram_id: number;
  purpose: string;
  amount_uzs: number;
  currency: number;
  created_at: string | null;
  age_seconds: number | null;
  callback_received_at: string | null;
  last_synced_at: string | null;
  card_masked: string | null;
  error_code: number | null;
}

export interface NbuPendingPaymentsResponse {
  /** Rows in THIS page — the backend clamps `limit` to 500, so it saturates. */
  count: number;
  /**
   * The real backlog, from a separate COUNT. Optional because the SPA deploys
   * to Vercel independently of the backend: a frontend-first deploy talks to a
   * server that does not send it yet, and a required field would render
   * `undefined` in the badge.
   */
  total?: number;
  rows: NbuPendingPaymentRow[];
}

export interface NbuReconcileResponse {
  transaction_id: string;
  previous_status: string;
  new_status: string;
  flipped_to_terminal: boolean;
  notes_tail: string | null;
}

export interface NbuExpireResponse {
  transaction_id: string;
  previous_status: string;
  new_status: string;
}

export interface NbuExpireBulkRequest {
  /** Specific NBU transaction ids to expire (selected rows). */
  transaction_ids?: string[];
  /** Expire ALL pending rows older than this many seconds. */
  older_than_seconds?: number;
}

export interface NbuExpireBulkResponse {
  requested: number;
  expired: number;
  flipped_to_success: number;
  skipped: number;
  expired_transaction_ids: string[];
}

export interface UzPostPendingRow {
  delivery_request_id: number;
  client_code: string;
  flight_names: string[];
  created_at: string | null;
  age_seconds: number | null;
  is_paid: boolean;
  nbu_order_id: string | null;
  amount_uzs: number | null;
  has_approved_sibling: boolean;
  uzpost_order_number: string | null;
}

export interface UzPostPendingResponse {
  /** Rows in THIS page. See {@link NbuPendingPaymentsResponse}. */
  count: number;
  /** Real backlog; optional for the same deploy-skew reason. */
  total?: number;
  rows: UzPostPendingRow[];
}

export interface UzPostReconcileResponse {
  delivery_request_id: number;
  previous_status: string;
  new_status: string;
  approved: boolean;
  detail: string;
}

export interface UzPostRejectResponse {
  delivery_request_id: number;
  previous_status: string;
  new_status: string;
}

export interface UzPostExpireBulkRequest {
  delivery_request_ids?: number[];
  older_than_seconds?: number;
}

export interface UzPostExpireBulkResponse {
  requested: number;
  rejected: number;
  skipped_paid: number;
  skipped: number;
  rejected_ids: number[];
}

export interface NbuReportConfig {
  enabled: boolean;
  max_flights: number;
  group_id: number;
}

export interface NbuReportConfigUpdate {
  enabled?: boolean;
  max_flights?: number;
}

export interface NbuReportResendResponse {
  sent: number;
  windows: string[];
}

export const systemService = {
  async getMaintenanceStatus(): Promise<MaintenanceStatusResponse> {
    const { data } = await apiClient.get<MaintenanceStatusResponse>('/api/v1/system/maintenance-status');
    return data;
  },

  async toggleMaintenance(body: MaintenanceToggleRequest): Promise<MaintenanceStatusResponse> {
    const { data } = await apiClient.post<MaintenanceStatusResponse>('/api/v1/system/maintenance', body);
    return data;
  },

  async getNbuStatus(): Promise<NbuStatusResponse> {
    const { data } = await apiClient.get<NbuStatusResponse>('/api/v1/system/nbu-status');
    return data;
  },

  async toggleNbu(body: NbuToggleRequest): Promise<NbuStatusResponse> {
    const { data } = await apiClient.post<NbuStatusResponse>('/api/v1/system/nbu', body);
    return data;
  },

  async getRedisInfo(): Promise<RedisInfoResponse> {
    const { data } = await apiClient.get<RedisInfoResponse>('/api/v1/system/redis-info');
    return data;
  },

  async getRedisClients(): Promise<RedisClientsResponse> {
    const { data } = await apiClient.get<RedisClientsResponse>('/api/v1/system/redis-clients');
    return data;
  },

  async getNbuPending(limit = 100): Promise<NbuPendingPaymentsResponse> {
    const { data } = await apiClient.get<NbuPendingPaymentsResponse>(
      '/api/v1/system/nbu/pending',
      { params: { limit } },
    );
    return data;
  },

  async forceReconcileNbu(transactionId: string): Promise<NbuReconcileResponse> {
    const { data } = await apiClient.post<NbuReconcileResponse>(
      `/api/v1/system/nbu/reconcile/${encodeURIComponent(transactionId)}`,
    );
    return data;
  },

  async expireNbu(transactionId: string): Promise<NbuExpireResponse> {
    const { data } = await apiClient.post<NbuExpireResponse>(
      `/api/v1/system/nbu/expire/${encodeURIComponent(transactionId)}`,
    );
    return data;
  },

  async expireNbuBulk(body: NbuExpireBulkRequest): Promise<NbuExpireBulkResponse> {
    const { data } = await apiClient.post<NbuExpireBulkResponse>(
      '/api/v1/system/nbu/expire-bulk',
      body,
    );
    return data;
  },

  async listUzpostPending(limit = 100): Promise<UzPostPendingResponse> {
    const { data } = await apiClient.get<UzPostPendingResponse>(
      '/api/v1/system/uzpost/pending',
      { params: { limit } },
    );
    return data;
  },

  async reconcileUzpost(drId: number): Promise<UzPostReconcileResponse> {
    const { data } = await apiClient.post<UzPostReconcileResponse>(
      `/api/v1/system/uzpost/reconcile/${drId}`,
    );
    return data;
  },

  async rejectUzpost(drId: number): Promise<UzPostRejectResponse> {
    const { data } = await apiClient.post<UzPostRejectResponse>(
      `/api/v1/system/uzpost/reject/${drId}`,
    );
    return data;
  },

  async expireUzpostBulk(
    body: UzPostExpireBulkRequest,
  ): Promise<UzPostExpireBulkResponse> {
    const { data } = await apiClient.post<UzPostExpireBulkResponse>(
      '/api/v1/system/uzpost/expire-bulk',
      body,
    );
    return data;
  },

  async getNbuReportConfig(): Promise<NbuReportConfig> {
    const { data } = await apiClient.get<NbuReportConfig>(
      '/api/v1/system/nbu/report-config',
    );
    return data;
  },

  async updateNbuReportConfig(
    body: NbuReportConfigUpdate,
  ): Promise<NbuReportConfig> {
    const { data } = await apiClient.post<NbuReportConfig>(
      '/api/v1/system/nbu/report-config',
      body,
    );
    return data;
  },

  async resendNbuReports(hoursBack: number): Promise<NbuReportResendResponse> {
    const { data } = await apiClient.post<NbuReportResendResponse>(
      '/api/v1/system/nbu/report/resend',
      { hours_back: hoursBack },
    );
    return data;
  },

  async getVideoGuides(): Promise<VideoGuides> {
    const { data } = await apiClient.get<VideoGuides>('/api/v1/system/video-guides');
    return data;
  },

  async updateVideoGuides(links: Record<string, string>): Promise<VideoGuides> {
    const { data } = await apiClient.put<VideoGuides>('/api/v1/system/video-guides', {
      links,
    });
    return data;
  },

  async getButtonIcons(): Promise<ButtonIcons> {
    const { data } = await apiClient.get<ButtonIcons>('/api/v1/system/button-icons');
    return data;
  },

  async updateButtonIcons(body: ButtonIconsUpdate): Promise<ButtonIcons> {
    const { data } = await apiClient.put<ButtonIcons>(
      '/api/v1/system/button-icons',
      body,
    );
    return data;
  },

  async getMessageEmoji(): Promise<MessageEmoji> {
    const { data } = await apiClient.get<MessageEmoji>('/api/v1/system/message-emoji');
    return data;
  },

  async updateMessageEmoji(body: MessageEmojiUpdate): Promise<MessageEmoji> {
    const { data } = await apiClient.put<MessageEmoji>(
      '/api/v1/system/message-emoji',
      body,
    );
    return data;
  },

  async getSmsSettings(): Promise<SmsSettings> {
    const { data } = await apiClient.get<SmsSettings>('/api/v1/system/sms-settings');
    return data;
  },

  async checkSmsGateway(): Promise<SmsCheckResult> {
    const { data } = await apiClient.post<SmsCheckResult>(
      '/api/v1/system/sms-settings/check',
    );
    return data;
  },

  async updateSmsSettings(body: SmsSettingsUpdate): Promise<SmsSettings> {
    const { data } = await apiClient.put<SmsSettings>(
      '/api/v1/system/sms-settings',
      body,
    );
    return data;
  },

  async getBackupSettings(): Promise<BackupSettings> {
    const { data } = await apiClient.get<BackupSettings>('/api/v1/system/backup');
    return data;
  },

  async updateBackupSettings(body: BackupSettingsUpdate): Promise<BackupSettings> {
    const { data } = await apiClient.put<BackupSettings>('/api/v1/system/backup', body);
    return data;
  },

  /** Ask Telegram whether a backup could actually reach this chat. */
  async checkBackupChannel(chatId: number): Promise<BackupCheckResult> {
    const { data } = await apiClient.post<BackupCheckResult>(
      '/api/v1/system/backup/check',
      { chat_id: chatId },
    );
    return data;
  },

  /** Take a backup now. Slow by nature — a dump plus an upload of tens of MB. */
  async runBackupNow(): Promise<BackupRunResult> {
    const { data } = await apiClient.post<BackupRunResult>('/api/v1/system/backup/run');
    return data;
  },
};
