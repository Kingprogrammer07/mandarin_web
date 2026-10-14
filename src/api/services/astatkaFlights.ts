import { apiClient, apiClientFormData } from "../client";

/**
 * Astatka flights — the "O…" flight window on `/astatka/<name>`.
 *
 * An astatka flight is an ordinary flight whose name starts with "O". Its
 * contents are packages: one client's bag from one source flight. A package is
 * `expected` until a worker confirms it on the shelf; confirming moves the
 * bag's track codes and photo-report rows into the astatka flight (the payment
 * row stays on the old flight), so the flight's "Yuborish" sends it like any
 * other flight's cargo. Mirrors `src/api/schemas/astatka_flight.py`.
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
}

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
  weight_kg?: number | null;
  comment?: string | null;
  scanned_at?: string | null;
  origin?: AstatkaPackageOrigin;
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
}

export interface AstatkaPackagesParams {
  status?: AstatkaPackageStatus;
  source_flight?: string;
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

export interface AstatkaCargoUpdateResult {
  cargo: AstatkaBagCargo;
  synced_packages: number;
}

export interface AstatkaFlightStats {
  astatka_flight_name: string;
  expected: number;
  confirmed: number;
  expected_weight_kg: number;
  confirmed_weight_kg: number;
  source_flights: string[];
  last_confirmed_at: string | null;
}

/** Every astatka flight's counts; refreshed after any change to a package. */
export const astatkaStatsQueryKey = ["astatka-flight-stats"] as const;

/** One astatka flight's saved list; filters are appended to this prefix. */
export const astatkaPackagesQueryKey = (flightName: string) =>
  ["astatka-packages", flightName.trim().toUpperCase()] as const;

/** One bag's photo-report rows; refreshed after a weight or photo change. */
export const astatkaBagQueryKey = (flightName: string, ref: AstatkaBagRef) =>
  [
    "astatka-bag",
    flightName.trim().toUpperCase(),
    "packageId" in ref ? `id:${ref.packageId}` : `${ref.clientCode}|${ref.sourceFlight}`,
  ] as const;

export const astatkaCargoPhotosQueryKey = (cargoId: number) =>
  ["astatka-cargo-photos", cargoId] as const;

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

export async function getAstatkaBagDetails(
  flightName: string,
  ref: AstatkaBagRef,
): Promise<AstatkaBagDetails> {
  const params =
    "packageId" in ref
      ? { package_id: ref.packageId }
      : { client_code: ref.clientCode, source_flight: ref.sourceFlight };
  const { data } = await apiClient.get<AstatkaBagDetails>(`${base(flightName)}/bag`, { params });
  return data;
}

export async function getAstatkaCargoPhotos(
  flightName: string,
  cargoId: number,
): Promise<AstatkaCargoPhoto[]> {
  const { data } = await apiClient.get<{ cargo_id: number; photos: AstatkaCargoPhoto[] }>(
    `${base(flightName)}/cargos/${cargoId}/photos`,
  );
  return data.photos;
}

export async function updateAstatkaCargoWeight(
  flightName: string,
  cargoId: number,
  weightKg: number,
): Promise<AstatkaCargoUpdateResult> {
  const { data } = await apiClient.patch<AstatkaCargoUpdateResult>(
    `${base(flightName)}/cargos/${cargoId}`,
    { weight_kg: weightKg },
  );
  return data;
}

/**
 * Re-take a photo-report row's photos. With `replaceIndex` only that photo is
 * swapped (the photo count adds one at the end); without it all are replaced.
 */
export async function replaceAstatkaCargoPhotos(
  flightName: string,
  cargoId: number,
  photos: File[],
  replaceIndex?: number,
): Promise<AstatkaCargoUpdateResult> {
  const form = new FormData();
  for (const photo of photos) form.append("photos", photo);
  if (replaceIndex !== undefined) form.append("replace_index", String(replaceIndex));
  const { data } = await apiClientFormData.put<AstatkaCargoUpdateResult>(
    `${base(flightName)}/cargos/${cargoId}/photos`,
    form,
  );
  return data;
}
