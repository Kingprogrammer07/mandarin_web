import { apiClient } from '@/api/client';

/**
 * Partner cargos that receive their clients' China-import rows by webhook.
 * Super-admin only; the backend refuses everyone else with 403.
 */

const BASE = '/api/v1/admin/partner-webhooks';

export interface PartnerWebhook {
  id: number;
  name: string;
  client_code_prefixes: string[];
  url: string;
  is_active: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  pending_count: number;
  failed_count: number;
  sent_count: number;
  last_sent_at: string | null;
  last_error: string | null;
}

/** Returned once, on creation. The secret is never readable again. */
export interface PartnerWebhookCreated extends PartnerWebhook {
  secret: string;
}

export interface PartnerWebhookInput {
  name: string;
  client_code_prefixes: string[];
  url: string;
}

export interface PartnerWebhookPatch extends Partial<PartnerWebhookInput> {
  is_active?: boolean;
}

export interface PartnerWebhookTestResult {
  ok: boolean;
  status_code: number | null;
  error: string | null;
}

export type DeliveryStatus = 'pending' | 'sent' | 'failed';

export interface PartnerWebhookDelivery {
  id: number;
  delivery_id: string;
  event: string;
  flight_name: string | null;
  item_count: number;
  status: DeliveryStatus;
  attempts: number;
  last_status_code: number | null;
  last_error: string | null;
  created_at: string | null;
  sent_at: string | null;
  next_attempt_at: string;
}

/** Answer to "Takrorlash" / "Yana yuborish": the partner's reply and the delivery after it. */
export interface PartnerWebhookDeliverySendResult extends PartnerWebhookTestResult {
  /** For a resend, the new delivery (new delivery_id), not the original. */
  delivery: PartnerWebhookDelivery;
}

export interface PartnerWebhookDeliveryPage {
  items: PartnerWebhookDelivery[];
  next_before_id: number | null;
}

export const partnerWebhookService = {
  async list(): Promise<PartnerWebhook[]> {
    const { data } = await apiClient.get<PartnerWebhook[]>(BASE);
    return data;
  },

  async create(body: PartnerWebhookInput): Promise<PartnerWebhookCreated> {
    const { data } = await apiClient.post<PartnerWebhookCreated>(BASE, body);
    return data;
  },

  async update(id: number, body: PartnerWebhookPatch): Promise<PartnerWebhook> {
    const { data } = await apiClient.patch<PartnerWebhook>(`${BASE}/${id}`, body);
    return data;
  },

  async rotateSecret(id: number): Promise<{ secret: string }> {
    const { data } = await apiClient.post<{ secret: string }>(`${BASE}/${id}/rotate-secret`);
    return data;
  },

  async test(id: number): Promise<PartnerWebhookTestResult> {
    const { data } = await apiClient.post<PartnerWebhookTestResult>(`${BASE}/${id}/test`);
    return data;
  },

  async deliveries(id: number, beforeId?: number | null): Promise<PartnerWebhookDeliveryPage> {
    const { data } = await apiClient.get<PartnerWebhookDeliveryPage>(`${BASE}/${id}/deliveries`, {
      params: { limit: 20, ...(beforeId ? { before_id: beforeId } : {}) },
    });
    return data;
  },

  /** Send a queued or failed delivery now, with the same delivery_id. */
  async retryDelivery(id: number, deliveryPk: number): Promise<PartnerWebhookDeliverySendResult> {
    const { data } = await apiClient.post<PartnerWebhookDeliverySendResult>(
      `${BASE}/${id}/deliveries/${deliveryPk}/retry`,
    );
    return data;
  },

  /** Send a delivered batch again as a new delivery (new delivery_id). */
  async resendDelivery(id: number, deliveryPk: number): Promise<PartnerWebhookDeliverySendResult> {
    const { data } = await apiClient.post<PartnerWebhookDeliverySendResult>(
      `${BASE}/${id}/deliveries/${deliveryPk}/resend`,
    );
    return data;
  },

  async retryFailed(id: number): Promise<{ requeued: number }> {
    const { data } = await apiClient.post<{ requeued: number }>(`${BASE}/${id}/retry-failed`);
    return data;
  },
};
