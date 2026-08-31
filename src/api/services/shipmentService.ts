import { apiClient } from '@/api/client';

/**
 * The client's shipments, in one list.
 *
 * Replaces the split between "Yuklar tarixi" (the China manifest, flights named
 * `M257`) and "Mening yuklarim" (the Uzbekistan billing, the same flight named
 * `M257-M258`), which showed one parcel twice under two labels. The server does
 * the joining: the flight-name token rule lives in Python and a second copy of
 * it here would drift.
 */

/** Which list a shipment is in. The three are a partition, never overlapping. */
export type ShipmentTab = 'active' | 'transit' | 'archive';

/** `history` is not a tab — it is the full list, including the pre-scanner
 *  flights the three tabs deliberately leave out. */
export type ShipmentView = ShipmentTab | 'history';

export interface ShipmentItem {
  /** The billing label, which is what the payment screen and the bot use. */
  flight_name: string;
  /** The manifest label when it differs — `M257` against a billed `M257-M258`. */
  manifest_flight_name: string | null;
  tab: ShipmentTab;

  total_count: number;
  total_weight: number;

  /** At least one of this client's parcels was scanned in Tashkent. */
  is_scanned: boolean;
  is_sent_web: boolean;
  is_taken_away: boolean;

  payment_status: 'paid' | 'partial' | 'pending' | null;
  total_amount: number | null;
  paid_amount: number | null;
  remaining_amount: number | null;

  scanned_at: string | null;
  taken_away_date: string | null;
  last_update: string | null;
}

export interface ShipmentListResponse {
  items: ShipmentItem[];
  total: number;
  page: number;
  size: number;
}

export interface ShipmentCounts {
  active: number;
  transit: number;
  archive: number;
  history: number;
}

const BASE = '/api/v1/shipments';

export const shipmentService = {
  /**
   * @param search Flight-name filter. Sent to the server rather than applied
   *   here so it covers every flight the client has: the longest production
   *   history is 120 flights and the page holds 20.
   */
  async list(
    tab: ShipmentView,
    page = 1,
    size = 20,
    search = '',
  ): Promise<ShipmentListResponse> {
    const { data } = await apiClient.get<ShipmentListResponse>(BASE, {
      params: { tab, page, size, ...(search.trim() ? { q: search.trim() } : {}) },
    });
    return data;
  },

  async counts(): Promise<ShipmentCounts> {
    const { data } = await apiClient.get<ShipmentCounts>(`${BASE}/counts`);
    return data;
  },
};
