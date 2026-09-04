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
  /** `ShipmentView`, not `ShipmentTab`: the history list carries rows the three
   *  tabs leave out, and those come back tagged `history`. */
  tab: ShipmentView;

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

/** One parcel as the China manifest listed it, before billing exists. */
export interface ManifestParcel {
  track_code: string;
  /** As the manifest named it — Russian where both languages are present. */
  item_name: string | null;
  /** Kilograms. `0` when the manifest cell was blank or unparseable. */
  weight: number;
  /** The Tashkent warehouse has physically seen this parcel. */
  is_scanned: boolean;
  scanned_at: string | null;
}

export interface ShipmentManifest {
  flight_name: string;
  /** Every label that turned out to be this same flight. */
  flight_names: string[];
  items: ManifestParcel[];
  total_count: number;
  total_weight: number;
  scanned_count: number;
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

  /**
   * What the client has on one flight, read from the China manifest.
   *
   * The detail screen's own source is the billing table, which only has a row
   * once the flight has arrived and its report was sent. Before that it returns
   * nothing and the screen said "Ma'lumot topilmadi" — so this answers the same
   * question from the table that does know: `cargo_items`.
   *
   * The flight goes in a query parameter, not the path: real labels carry dots
   * and dashes (`A-11.07.2026`).
   */
  async manifest(flight: string): Promise<ShipmentManifest> {
    const { data } = await apiClient.get<ShipmentManifest>(`${BASE}/manifest`, {
      params: { flight },
    });
    return data;
  },
};
