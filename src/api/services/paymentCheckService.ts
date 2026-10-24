import { apiClient } from '@/api/client';

/**
 * Payme / Click receipt check: whether the bot approves clear receipts itself.
 *
 * Off, the bot only writes under each receipt what it would have done; on, it
 * approves the receipts that pass every check (exact sum, one matching
 * payment, the flight's whole debt). Super-admin only.
 */
export interface PaymentCheckStats {
  days: number;
  /** Receipts the bot judged. */
  checked: number;
  /** Passed every check but were left to the admin (switch off). */
  would_approve: number;
  /** Approved by the bot and still approved. */
  bot_approved: number;
  /** Bot approvals an admin took back with «↩️ Bekor qilish». */
  undone: number;
}

export interface PaymentCheckSettings {
  auto_approve: boolean;
  /** False when the Payme / Click reader is not running: nothing is checked. */
  reader_active: boolean;
  updated_by: string | null;
  updated_at: string | null;
  stats: PaymentCheckStats;
}

const BASE = '/api/v1/system/payment-check';

export const paymentCheckService = {
  async get(): Promise<PaymentCheckSettings> {
    const { data } = await apiClient.get<PaymentCheckSettings>(BASE);
    return data;
  },

  async setAutoApprove(enabled: boolean): Promise<PaymentCheckSettings> {
    const { data } = await apiClient.put<PaymentCheckSettings>(BASE, {
      auto_approve: enabled,
    });
    return data;
  },
};
