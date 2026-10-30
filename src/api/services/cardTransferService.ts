import { apiClient } from '@/api/client';

/**
 * Card transfers: whether the bot books a clear CardXabar credit itself.
 *
 * Off, the bot only writes under each found credit what it would have done;
 * on, it books the credits that pass every check (exact sum on the request's
 * card in its 30 minutes, the flight unchanged since). Super-admin only.
 */
export interface CardTransferReason {
  code: string;
  /** Why the bot left those credits to the admin, in Uzbek. */
  label: string;
  count: number;
}

export interface CardTransferStats {
  days: number;
  /** Credits whose exact sum named a request. */
  found: number;
  /** Passed every check while the switch was off. */
  would: number;
  /** Of those, confirmed by an admin for that same request. */
  would_confirmed: number;
  /** Booked by the bot and still standing. */
  booked: number;
  /** Bot bookings an admin took back with «↩️ Bekor qilish». */
  undone: number;
  reasons: CardTransferReason[];
}

export interface CardTransferSettings {
  auto_approve: boolean;
  /** False when CardXabar was not read in the last 5 minutes: nothing is seen. */
  reader_active: boolean;
  updated_by: string | null;
  updated_at: string | null;
  stats: CardTransferStats;
}

const BASE = '/api/v1/system/card-transfer';

export const cardTransferService = {
  async get(): Promise<CardTransferSettings> {
    const { data } = await apiClient.get<CardTransferSettings>(BASE);
    return data;
  },

  async setAutoApprove(enabled: boolean): Promise<CardTransferSettings> {
    const { data } = await apiClient.put<CardTransferSettings>(BASE, {
      auto_approve: enabled,
    });
    return data;
  },
};
