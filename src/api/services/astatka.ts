import { apiClient } from "../client";

/**
 * Astatka — the warehouse stock-take of leftover cargo.
 *
 * A worker walks the shelves with a phone and scans what is left after a flight
 * has been distributed. The network in a warehouse is bad, so almost nothing
 * here is called directly by the UI: the store in `utils/astatkaStore.ts` writes
 * to IndexedDB first and these functions are what the sync worker drains
 * through. The only calls a screen makes itself are the read-only ones.
 */

/** How a scanned parcel resolved. Mirrors the backend's ASTATKA_STATUSES. */
export type AstatkaStatus =
  /** Found, and a weight and price were available to copy. */
  | "matched"
  /** Found, but no billing row — the worker supplies weight and price.
   *  The COMMON case: flight_cargos covers 18 flights, cargo_items 129. */
  | "needs_data"
  /** Resolved to a flight this stock-take does not cover. Kept, flagged. */
  | "foreign_flight"
  /** Not found anywhere. Kept anyway — the parcel is real. */
  | "unknown";

/** A photo reference, tagged so nothing downstream has to guess its source. */
export interface AstatkaPhoto {
  kind: "s3" | "telegram";
  ref: string;
}

export interface Astatka {
  id: number;
  name: string;
  flight_names: string[];
  note: string | null;
  closed_at: string | null;
  created_at: string;
  created_by_username: string | null;
  /** Per-status counts. A missing key means zero. */
  counts: Partial<Record<AstatkaStatus, number>>;
}

export interface AstatkaScanResult {
  status: AstatkaStatus;
  track_code: string;
  client_code: string | null;
  source_flight_name: string | null;
  weight_kg: string | null;
  price_per_kg: string | null;
  comment: string | null;
  source_flight_cargo_id: number | null;
  photos: AstatkaPhoto[];
  /** Already recorded in THIS stock-take. Show it, do not count it twice. */
  duplicate: boolean;
  /** True when a human still has to supply the weight or the price. */
  needs_manual_entry: boolean;
}

/** One parcel as the phone sends it, after sitting in the offline queue. */
export interface AstatkaItemInput {
  /**
   * Minted on the device BEFORE the row was queued, and unique server-side.
   *
   * This is what makes the queue safe to retry. The phone cannot tell "the
   * server never got it" from "it got it and the reply was lost", so it sends
   * again; without this key the second attempt would create a second parcel and
   * the count — the entire point of a stock-take — would be wrong.
   */
  idempotency_key: string;
  track_code?: string | null;
  client_code?: string | null;
  source_flight_name?: string | null;
  weight_kg?: string | null;
  price_per_kg?: string | null;
  comment?: string | null;
  status: AstatkaStatus;
  source_flight_cargo_id?: number | null;
  photos?: AstatkaPhoto[];
  entered_manually?: boolean;
  /** When it was scanned on the phone — not when it reached the server. */
  scanned_at?: string | null;
}

export interface AstatkaItem {
  id: number;
  idempotency_key: string;
  track_code: string | null;
  client_code: string | null;
  source_flight_name: string | null;
  weight_kg: string | null;
  price_per_kg: string | null;
  comment: string | null;
  status: AstatkaStatus;
  photos: AstatkaPhoto[];
  entered_manually: boolean;
  scanned_by_username: string | null;
  scanned_at: string | null;
  created_at: string;
}

export interface AstatkaItemsResult {
  /** Rows that landed for the first time. */
  accepted: number;
  /** Keys already present. On a retry this is every row, and that is success. */
  duplicates: number;
  items: AstatkaItem[];
}

export async function listAstatka(): Promise<Astatka[]> {
  const response = await apiClient.get<Astatka[]>("/api/v1/astatka");
  return response.data;
}

export async function getAstatka(id: number): Promise<Astatka> {
  const response = await apiClient.get<Astatka>(`/api/v1/astatka/${id}`);
  return response.data;
}

/**
 * Flights a stock-take can cover, newest first.
 *
 * From the China manifest rather than the billing table: it carries 129 flights
 * against 18, and it is what a scan resolves against — so every flight offered
 * is one a scan can actually match.
 */
export async function listAstatkaFlights(): Promise<string[]> {
  const response = await apiClient.get<{ flight_names: string[] }>(
    "/api/v1/astatka/flights",
  );
  return response.data.flight_names;
}

export async function createAstatka(payload: {
  name: string;
  flight_names: string[];
  note?: string | null;
}): Promise<Astatka> {
  const response = await apiClient.post<Astatka>("/api/v1/astatka", payload);
  return response.data;
}

export async function listAstatkaItems(id: number): Promise<AstatkaItem[]> {
  const response = await apiClient.get<AstatkaItem[]>(
    `/api/v1/astatka/${id}/items`,
  );
  return response.data;
}

/**
 * Ask the server what a scanned code is. Writes nothing.
 *
 * Only reachable online. Offline the phone answers from its own index, which
 * knows the client and the flight but not the weight — so an offline scan lands
 * on `needs_data` and the worker types the numbers.
 */
export async function scanTrackCode(
  id: number,
  trackCode: string,
): Promise<AstatkaScanResult> {
  const response = await apiClient.post<AstatkaScanResult>(
    `/api/v1/astatka/${id}/scan`,
    { track_code: trackCode },
  );
  return response.data;
}

/**
 * Drain a batch of queued parcels.
 *
 * A batch and not one request per parcel: the queue exists because the
 * connection is bad, and a hundred round trips over that same connection would
 * be a poor way to recover from it.
 */
export async function submitAstatkaItems(
  id: number,
  items: AstatkaItemInput[],
): Promise<AstatkaItemsResult> {
  const response = await apiClient.post<AstatkaItemsResult>(
    `/api/v1/astatka/${id}/items`,
    { items },
  );
  return response.data;
}

/**
 * Correct the stock-take's own copy of a parcel.
 *
 * The billing row it was copied from is not touched — an inventory count must
 * not move a customer's debt.
 */
export async function updateAstatkaItem(
  astatkaId: number,
  itemId: number,
  patch: {
    weight_kg?: string | null;
    price_per_kg?: string | null;
    comment?: string | null;
    photos?: AstatkaPhoto[];
    status?: AstatkaStatus;
  },
): Promise<AstatkaItem> {
  const response = await apiClient.patch<AstatkaItem>(
    `/api/v1/astatka/${astatkaId}/items/${itemId}`,
    patch,
  );
  return response.data;
}
