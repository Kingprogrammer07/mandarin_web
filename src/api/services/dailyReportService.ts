import { apiClient } from '@/api/client';

/**
 * Daily warehouse-vs-cashier report sent to chosen super-admins.
 *
 * Recipients are admin account ids, not Telegram ids: an admin who changes
 * Telegram keeps receiving it, and one who loses the super-admin role stops.
 */
export interface DailyReportSuperAdmin {
  admin_id: number;
  username: string;
  selected: boolean;
  /** False when the bot has no usable Telegram chat for this admin. */
  can_receive: boolean;
  problem: string | null;
}

export interface DailyReportDeliveryEntry {
  admin_id: number;
  username: string;
  reason: string | null;
  /** 'rich' — tables; 'text' — the classic fallback. */
  format?: 'rich' | 'text' | null;
}

export interface DailyReportDeliveryResult {
  delivered: DailyReportDeliveryEntry[];
  failed: DailyReportDeliveryEntry[];
  sent_at: string | null;
  /** Why Telegram refused the rich (table) form, when it did. */
  rich_error?: string | null;
}

export interface DailyReportSettings {
  enabled: boolean;
  /** HH:MM, Tashkent time. */
  send_time: string;
  recipient_admin_ids: number[];
  super_admins: DailyReportSuperAdmin[];
  last_sent_date: string | null;
  last_sent_at: string | null;
  last_result: DailyReportDeliveryResult | null;
}

export interface DailyReportSettingsUpdate {
  enabled?: boolean;
  send_time?: string;
  recipient_admin_ids?: number[];
}

export interface DailyReportPreview {
  /** Rich message HTML (tables), exactly as the bot would send it. */
  rich_html: string;
  /** Classic Telegram HTML, sent only if the rich form is refused. */
  text: string;
  window_start: string;
  window_end: string;
}

const BASE = '/api/v1/system/daily-report';

export const dailyReportService = {
  async get(): Promise<DailyReportSettings> {
    const { data } = await apiClient.get<DailyReportSettings>(BASE);
    return data;
  },

  async update(body: DailyReportSettingsUpdate): Promise<DailyReportSettings> {
    const { data } = await apiClient.put<DailyReportSettings>(BASE, body);
    return data;
  },

  async preview(reportDate?: string): Promise<DailyReportPreview> {
    const { data } = await apiClient.post<DailyReportPreview>(`${BASE}/preview`, {
      report_date: reportDate ?? null,
    });
    return data;
  },

  async sendNow(adminIds: number[]): Promise<DailyReportDeliveryResult> {
    const { data } = await apiClient.post<DailyReportDeliveryResult>(
      `${BASE}/send-now`,
      { admin_ids: adminIds },
    );
    return data;
  },
};
