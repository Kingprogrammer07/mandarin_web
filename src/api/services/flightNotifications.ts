import { apiClient, apiClientFormData } from '@/api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientNotificationStatus {
  client_id: string;
  telegram_id: number | null;
  cargo_count: number;
  total_weight: number;
  total_price_uzs: number;
  is_sent: boolean;
  is_sent_bot: boolean;
  is_sent_web: boolean;
  sent_at: string | null;
  cargo_ids: number[];
}

export interface NotificationSummary {
  flight_name: string;
  total_clients: number;
  sent_count: number;
  pending_count: number;
  bot_sent_count: number;
  web_sent_count: number;
  clients: ClientNotificationStatus[];
}

export interface SendRequest {
  client_ids?: string[];
  only_pending?: boolean;
  mark_bot?: boolean;
  mark_web?: boolean;
}

export interface StartSendResponse {
  task_id: string;
  total_clients: number;
  message: string;
}

export interface TaskErrorItem {
  client_id: string;
  error: string;
}

export type SendTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | string;

export interface SendTaskState {
  task_id: string;
  status: SendTaskStatus;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  percent: number;
  errors: TaskErrorItem[];
  started_at: string;
  finished_at: string | null;
}

export interface ForgottenCargoPayload {
  clientId: string;
  trackCodes: string[];
  weightKg: number;
  pricePerKg?: number;
  comment?: string;
  sendImmediately: boolean;
  /** Bot send: mirror to success/fail channels + set is_sent flag. */
  markBot: boolean;
  /** Web send: set is_sent_web flag, no channel logging. */
  markWeb: boolean;
  photos: File[];
}

export interface ForgottenCargoResult {
  cargo_ids: number[];
  track_codes_added: number;
  sent: boolean;
  send_error: string | null;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getNotificationSummary(flightName: string): Promise<NotificationSummary> {
  const { data } = await apiClient.get<NotificationSummary>(
    `/api/v1/admin/flight-notifications/${encodeURIComponent(flightName)}/summary`,
  );
  return data;
}

export async function startSendNotifications(
  flightName: string,
  payload: SendRequest,
): Promise<StartSendResponse> {
  const { data } = await apiClient.post<StartSendResponse>(
    `/api/v1/admin/flight-notifications/${encodeURIComponent(flightName)}/send`,
    payload,
  );
  return data;
}

export async function getSendTaskState(taskId: string): Promise<SendTaskState> {
  const { data } = await apiClient.get<SendTaskState>(
    `/api/v1/admin/flight-notifications/tasks/${encodeURIComponent(taskId)}`,
  );
  return data;
}

/**
 * Recover the flight's currently-running send task, or null if none.
 *
 * Used on page (re)load to resume the progress bar when the browser never
 * persisted the task_id (e.g. reload during the send-start request).
 */
export async function getActiveSendTask(flightName: string): Promise<SendTaskState | null> {
  const { data } = await apiClient.get<SendTaskState | null>(
    `/api/v1/admin/flight-notifications/${encodeURIComponent(flightName)}/active-task`,
  );
  return data ?? null;
}

export async function cancelSendTask(taskId: string): Promise<{ cancelled: boolean; message: string }> {
  const { data } = await apiClient.post<{ cancelled: boolean; message: string }>(
    `/api/v1/admin/flight-notifications/tasks/${encodeURIComponent(taskId)}/cancel`,
  );
  return data;
}

export async function addForgottenCargo(
  flightName: string,
  payload: ForgottenCargoPayload,
): Promise<ForgottenCargoResult> {
  const form = new FormData();
  form.append('client_id', payload.clientId.trim().toUpperCase());
  form.append('track_codes', JSON.stringify(payload.trackCodes));
  form.append('weight_kg', String(payload.weightKg));
  if (payload.pricePerKg !== undefined) {
    form.append('price_per_kg', String(payload.pricePerKg));
  }
  if (payload.comment) {
    form.append('comment', payload.comment);
  }
  form.append('send_immediately', String(payload.sendImmediately));
  form.append('mark_bot', String(payload.markBot));
  form.append('mark_web', String(payload.markWeb));
  payload.photos.forEach((photo) => form.append('photos', photo));

  const { data } = await apiClientFormData.post<ForgottenCargoResult>(
    `/api/v1/admin/flight-notifications/${encodeURIComponent(flightName)}/forgotten-cargo`,
    form,
  );
  return data;
}
