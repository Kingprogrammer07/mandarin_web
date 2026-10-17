import { apiClient, apiClientFormData } from "../client";

/**
 * Astatka flights — the "O…" flight window on `/astatka/<name>`.
 *
 * An astatka flight is an ordinary flight whose name starts with "O". Its
 * contents are packages: one client's bag from one source flight. A package is
 * `expected` until a worker confirms it on the shelf. Confirming writes only
 * the package: the old flight's photo report, track codes and payment stay as
 * they are, and the astatka's "Yuborish" reads its packages and marks them
 * sent (`sent_at` / `sent_web_at`). Mirrors `src/api/schemas/astatka_flight.py`.
 */

export type AstatkaPackageStatus = "expected" | "confirmed";
export type AstatkaPackageOrigin = "auto" | "scan" | "import";
export type AstatkaPaymentState = "paid" | "partial" | "pending";
export type AstatkaScanKind = "in_astatka" | "new" | "other_astatka" | "not_found";
export type AstatkaConfirmOutcome =
  | "confirmed"
  | "duplicate"
  | "already_confirmed"
  | "conflict"
  | "error";
export type AstatkaPackageSort =
  | "recent"
  | "client_asc"
  | "client_desc"
  | "weight_desc"
  | "flight_asc";

/**
 * One flight's worth of a partner cargo's photo-report rows for a client, as
 * the partner's read-only API reports it. Never stored in our cargo tables.
 */
export interface AstatkaExternalBag {
  flight_name: string;
  /** Sum of the rows' weights. */
  weight_kg: number | null;
  price_per_kg: number | null;
  /** The partner's photo-report rows in this bag. */
  rows: number;
  photo_count: number;
  /**
   * The partner's links to the bag's photos, when its API sends them (they
   * expire within about an hour, so only a scan answer carries them). Absent
   * or empty: only the count shows, or the stored copies below.
   */
  photo_urls?: string[];
  /**
   * A saved bag's photos already copied into our storage (the copy runs just
   * after the confirm). Their links come from `getAstatkaExternalPhotos`.
   */
  stored_photos?: number;
  comment: string | null;
  /** The partner already reported the bag to its client. */
  is_sent: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface AstatkaPackage {
  /** null for a proposal a scan made that is not saved yet. */
  id: number | null;
  astatka_flight_name: string;
  client_code: string;
  client_name: string | null;
  /** "" when the flight the bag came from is unknown. */
  source_flight_name: string;
  track_codes: string[];
  track_count: number;
  weight_kg: number | null;
  weight_edited: boolean;
  /** Photo-report rows of the bag. */
  bags: number;
  has_photo: boolean;
  status: AstatkaPackageStatus | null;
  origin: AstatkaPackageOrigin | null;
  comment: string | null;
  /** The payment row says the client already took it. */
  taken_away: boolean;
  payment_state: AstatkaPaymentState | null;
  /** Another astatka flight already holding this bag. */
  already_in_astatka: string | null;
  scanned_at: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string | null;
  /**
   * "" for our own cargo; the partner's code (e.g. "AKB") when the bag was
   * found through that partner's API. Optional: a package saved on the device
   * by an older build has none, and that means ours.
   */
  source_company?: string;
  /** The partner's display name; null for our own cargo. */
  source_company_name?: string | null;
  /** The partner's data for this bag (the chosen flight's). */
  external?: AstatkaExternalBag | null;
  /**
   * When the astatka's own "Yuborish" notified the client: by the bot, and by
   * the web report. Optional: a copy saved on the device before these existed.
   */
  sent_at?: string | null;
  sent_web_at?: string | null;
  /** Photos retaken in the astatka window; they replace the old flight's. */
  own_photo_count?: number;
}

export interface AstatkaSourceFlight {
  flight_name: string;
  clients: number;
  leftover_clients: number;
  leftover_weight_kg: number;
  in_astatka_clients: number;
  last_activity_at: string | null;
}

export interface AstatkaExtractResponse {
  astatka_flight_name: string;
  packages: AstatkaPackage[];
  created: number;
  skipped_existing: number;
  total_weight_kg: number;
}

export interface AstatkaScanResult {
  kind: AstatkaScanKind;
  track_code: string;
  package: AstatkaPackage | null;
  other_astatka_flight: string | null;
  /** Plain-language sentence for the worker. */
  message: string;
  /**
   * Every flight the partner holds for this client, newest first; empty for
   * our own cargo. The chosen one is `package.external`.
   */
  external_options?: AstatkaExternalBag[];
  /**
   * False when the partner's data did not say which flight the scanned code
   * is in and the newest one was assumed: the bag's label has to be checked.
   */
  external_flight_known?: boolean;
  /**
   * On a `not_found` answer whose owner is still open: "unavailable" when a
   * partner did not answer, "foreign" when our shared table files the code
   * under a partner's flight. Only "Qayta tekshirish" can settle such a code —
   * typing a client would make a partner's parcel one of our clients' bags.
   */
  partner_state?: AstatkaPartnerState | null;
}

export type AstatkaPartnerState = "unavailable" | "foreign";

export interface AstatkaConfirmItem {
  /**
   * Minted on the device when "Tasdiqlash" is pressed. A phone cannot tell
   * "the server never got it" from "the reply was lost", so the offline queue
   * retries; the key makes a retry of an applied confirm a no-op.
   */
  idempotency_key: string;
  client_code: string;
  source_flight_name: string;
  track_code?: string | null;
  track_codes?: string[] | null;
  /**
   * `track_codes` is the worker's corrected list: the server replaces the
   * bag's codes with it instead of adding to them.
   */
  track_codes_edited?: boolean;
  /**
   * With an edited list: the saved bag whose list it was written against,
   * or `null` when it was typed before the server named a bag. A confirmed
   * bag's codes are replaced only by a list written against that bag; any
   * other list only adds to it.
   */
  track_codes_base_package_id?: number | null;
  weight_kg?: number | null;
  comment?: string | null;
  scanned_at?: string | null;
  origin?: AstatkaPackageOrigin;
  /**
   * "" for our own cargo; the partner's code for a bag its API found. The
   * server re-reads the partner's data itself and saves the bag only into the
   * astatka's own records.
   */
  source_company?: string;
}

export interface AstatkaConfirmResult {
  idempotency_key: string;
  outcome: AstatkaConfirmOutcome;
  package: AstatkaPackage | null;
  message: string;
  warnings: string[];
}

export interface AstatkaPackagesResponse {
  astatka_flight_name: string;
  items: AstatkaPackage[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
  counts: { all: number; expected: number; confirmed: number };
  weights: { expected: number; confirmed: number };
  source_flights: string[];
  /** Partner codes with bags in this astatka; empty when every bag is ours. */
  source_companies?: string[];
}

export interface AstatkaPackagesParams {
  status?: AstatkaPackageStatus;
  source_flight?: string;
  /** Absent = every cargo; "" = only ours; "AKB" = only that partner's. */
  source_company?: string;
  q?: string;
  sort?: AstatkaPackageSort;
  page?: number;
  size?: number;
}

export interface AstatkaPackageUpdate {
  weight_kg?: number | null;
  comment?: string | null;
  track_codes?: string[];
  client_code?: string;
}

/** The base a scanning computer downloads to keep working with no network. */
export interface AstatkaIndexResponse {
  astatka_flight_name: string;
  packages: AstatkaPackage[];
  /**
   * Bags outside this astatka a scan can still hit: leftovers of recent
   * flights nobody extracted, and bags another astatka holds
   * (`already_in_astatka` set). Absent in a copy saved before it existed.
   */
  candidates?: AstatkaPackage[];
  /** Recent flights the leftovers were read from. */
  source_flights?: string[];
  synced_at: string;
}

/** One `flight_cargos` row: what the photo report stored for a bag. */
export interface AstatkaBagCargo {
  id: number;
  flight_name: string;
  client_id: string;
  photo_count: number;
  weight_kg: number | null;
  price_per_kg: number | null;
  comment: string | null;
  is_sent: boolean;
  is_sent_date: string | null;
  is_sent_web: boolean;
  is_sent_web_date: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AstatkaBagDetails {
  client_code: string;
  client_name: string | null;
  source_flight_name: string;
  weight_kg: number | null;
  cargos: AstatkaBagCargo[];
  /** The client's newest rows in other flights, only when the bag has none. */
  other_cargos: AstatkaBagCargo[];
  /** The saved bag, when it was asked for by id. */
  package?: AstatkaPackage | null;
}

/** Which bag to open: a saved one by id, or any by client and flight. */
export type AstatkaBagRef =
  | { packageId: number }
  | { clientCode: string; sourceFlight: string };

export interface AstatkaCargoPhoto {
  index: number;
  url: string | null;
  error: string | null;
}

/** A bag's own photos after a retake, with the bag as the server now holds it. */
export interface AstatkaPackagePhotosResult {
  package: AstatkaPackage;
  photos: AstatkaCargoPhoto[];
}

export interface AstatkaFlightStats {
  astatka_flight_name: string;
  expected: number;
  confirmed: number;
  expected_weight_kg: number;
  confirmed_weight_kg: number;
  source_flights: string[];
  last_confirmed_at: string | null;
  confirmed_clients?: number;
  confirmed_track_codes?: number;
  /** Own bags the astatka's "Yuborish" already notified. */
  sent?: number;
}

/** Every astatka flight's counts; refreshed after any change to a package. */
export const astatkaStatsQueryKey = ["astatka-flight-stats"] as const;

/** One astatka flight's saved list; filters are appended to this prefix. */
export const astatkaPackagesQueryKey = (flightName: string) =>
  ["astatka-packages", flightName.trim().toUpperCase()] as const;

/** One bag's photo-report rows and its saved package. */
export const astatkaBagQueryKey = (flightName: string, ref: AstatkaBagRef) =>
  [
    "astatka-bag",
    flightName.trim().toUpperCase(),
    "packageId" in ref ? `id:${ref.packageId}` : `${ref.clientCode}|${ref.sourceFlight}`,
  ] as const;

export const astatkaCargoPhotosQueryKey = (cargoId: number) =>
  ["astatka-cargo-photos", cargoId] as const;

/** The photos retaken for one saved bag in the astatka window. */
export const astatkaPackagePhotosQueryKey = (packageId: number) =>
  ["astatka-package-photos", packageId] as const;

/** Every bag's stored partner photos: a confirm can copy them again. */
export const astatkaExternalPhotosRootKey = ["astatka-external-photos"] as const;

export const astatkaExternalPhotosQueryKey = (packageId: number) =>
  [...astatkaExternalPhotosRootKey, packageId] as const;

const base = (flightName: string) =>
  `/api/v1/astatka-flights/${encodeURIComponent(flightName)}`;

export async function getAstatkaFlightStats(): Promise<AstatkaFlightStats[]> {
  const { data } = await apiClient.get<{ items: AstatkaFlightStats[] }>(
    "/api/v1/astatka-flights/stats",
  );
  return data.items;
}

export async function getAstatkaSourceFlights(
  flightName: string,
  q?: string,
): Promise<AstatkaSourceFlight[]> {
  const { data } = await apiClient.get<{ items: AstatkaSourceFlight[] }>(
    `${base(flightName)}/source-flights`,
    { params: q ? { q } : {} },
  );
  return data.items;
}

export async function extractAstatkaLeftovers(
  flightName: string,
  body: { source_flights: string[]; client_codes?: string[] | null; dry_run: boolean },
): Promise<AstatkaExtractResponse> {
  const { data } = await apiClient.post<AstatkaExtractResponse>(
    `${base(flightName)}/extract`,
    body,
  );
  return data;
}

export async function scanAstatkaTrackCode(
  flightName: string,
  trackCode: string,
): Promise<AstatkaScanResult> {
  const { data } = await apiClient.post<AstatkaScanResult>(`${base(flightName)}/scan`, {
    track_code: trackCode,
  });
  return data;
}

export async function confirmAstatkaPackages(
  flightName: string,
  items: AstatkaConfirmItem[],
): Promise<AstatkaConfirmResult[]> {
  const { data } = await apiClient.post<{ results: AstatkaConfirmResult[] }>(
    `${base(flightName)}/confirm`,
    { items },
  );
  return data.results;
}

export async function getAstatkaPackages(
  flightName: string,
  params: AstatkaPackagesParams,
): Promise<AstatkaPackagesResponse> {
  // Axios drops only undefined and null, so `source_company: ""` (our own
  // cargo) goes out as `source_company=` rather than meaning "every cargo".
  const { data } = await apiClient.get<AstatkaPackagesResponse>(
    `${base(flightName)}/packages`,
    { params },
  );
  return data;
}

export async function getAstatkaIndex(flightName: string): Promise<AstatkaIndexResponse> {
  const { data } = await apiClient.get<AstatkaIndexResponse>(`${base(flightName)}/index`);
  return data;
}

export async function unconfirmAstatkaPackage(
  flightName: string,
  packageId: number,
): Promise<{ package: AstatkaPackage; message: string; warnings: string[] }> {
  const { data } = await apiClient.post<{
    package: AstatkaPackage;
    message: string;
    warnings: string[];
  }>(`${base(flightName)}/packages/${packageId}/unconfirm`);
  return data;
}

export async function updateAstatkaPackage(
  flightName: string,
  packageId: number,
  body: AstatkaPackageUpdate,
): Promise<AstatkaPackage> {
  const { data } = await apiClient.patch<AstatkaPackage>(
    `${base(flightName)}/packages/${packageId}`,
    body,
  );
  return data;
}

export async function deleteAstatkaPackage(
  flightName: string,
  packageId: number,
): Promise<void> {
  await apiClient.delete(`${base(flightName)}/packages/${packageId}`);
}

export async function downloadAstatkaExcel(
  flightName: string,
  status?: AstatkaPackageStatus,
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`${base(flightName)}/export`, {
    params: status ? { status } : {},
    responseType: "blob",
  });
  return data;
}

/** Which bag to read; the server opens only that bag's photo-report rows. */
function bagParams(ref: AstatkaBagRef) {
  return "packageId" in ref
    ? { package_id: ref.packageId }
    : { client_code: ref.clientCode, source_flight: ref.sourceFlight };
}

export async function getAstatkaBagDetails(
  flightName: string,
  ref: AstatkaBagRef,
): Promise<AstatkaBagDetails> {
  const { data } = await apiClient.get<AstatkaBagDetails>(`${base(flightName)}/bag`, {
    params: bagParams(ref),
  });
  return data;
}

/** Short-lived links to one photo-report row's photos, read-only. */
export async function getAstatkaCargoPhotos(
  flightName: string,
  cargoId: number,
  bag: AstatkaBagRef,
): Promise<AstatkaCargoPhoto[]> {
  const { data } = await apiClient.get<{ cargo_id: number; photos: AstatkaCargoPhoto[] }>(
    `${base(flightName)}/cargos/${cargoId}/photos`,
    { params: bagParams(bag) },
  );
  return data.photos;
}

export interface AstatkaExternalPhotos {
  photos: AstatkaCargoPhoto[];
  /** Partner photos still being copied into our storage after the confirm. */
  pending: number;
}

/** Short-lived links to our stored copies of a saved partner bag's photos. */
export async function getAstatkaExternalPhotos(
  flightName: string,
  packageId: number,
): Promise<AstatkaExternalPhotos> {
  const { data } = await apiClient.get<{
    package_id: number;
    photos: AstatkaCargoPhoto[];
    pending: number;
  }>(`${base(flightName)}/packages/${packageId}/external-photos`);
  return { photos: data.photos, pending: data.pending };
}

/** Short-lived links to the photos retaken for a saved bag of ours. */
export async function getAstatkaPackagePhotos(
  flightName: string,
  packageId: number,
): Promise<AstatkaCargoPhoto[]> {
  const { data } = await apiClient.get<{ package_id: number; photos: AstatkaCargoPhoto[] }>(
    `${base(flightName)}/packages/${packageId}/photos`,
  );
  return data.photos;
}

/**
 * Retake a saved bag's own photos; they are stored on the package only, never
 * on the old flight's photo report. With `replaceIndex` only that photo is
 * swapped (the photo count adds one at the end); without it all are replaced.
 */
export async function replaceAstatkaPackagePhotos(
  flightName: string,
  packageId: number,
  photos: File[],
  replaceIndex?: number,
): Promise<AstatkaPackagePhotosResult> {
  const form = new FormData();
  for (const photo of photos) form.append("photos", photo);
  if (replaceIndex !== undefined) form.append("replace_index", String(replaceIndex));
  const { data } = await apiClientFormData.put<AstatkaPackagePhotosResult>(
    `${base(flightName)}/packages/${packageId}/photos`,
    form,
  );
  return data;
}
