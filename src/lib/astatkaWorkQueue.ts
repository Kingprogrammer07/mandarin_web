import type {
  AstatkaConfirmItem,
  AstatkaConfirmResult,
  AstatkaExternalBag,
  AstatkaPackage,
  AstatkaPartnerState,
  AstatkaScanKind,
  AstatkaScanResult,
} from "@/api/services/astatkaFlights";
import {
  cargoLabel,
  isPartnerPackage,
  sourceCompanyLabel,
  sourceCompanyOf,
} from "@/lib/astatkaSource";

/**
 * The astatka work-mode queue, as pure functions.
 *
 * One row is one BAG, not one scan: scanning a second code of a bag the
 * worker already has on screen lights that row up again instead of adding a
 * row, so the screen always reads "these clients' bags are in my hands".
 * Everything here is synchronous and side-effect free so the rules can be
 * tested without a browser, a camera or a network.
 */

export type WorkRowState =
  /** Sent to the server, waiting for the answer. */
  | "checking"
  /** Scanned with no internet and not in the downloaded list. */
  | "waiting_net"
  /** Found. Waiting for the worker to press "Tasdiqlash". */
  | "ready"
  /** "Tasdiqlash" is being sent. */
  | "saving"
  /** "Tasdiqlash" was pressed offline; goes out when the internet is back. */
  | "queued"
  | "confirmed"
  /** The bag belongs to a different astatka flight. */
  | "other_astatka"
  | "not_found"
  /** The server refused the confirm; `message` says why. */
  | "failed";

export interface WorkRowEdits {
  clientCode?: string;
  sourceFlight?: string;
  /** Only present when the worker typed a weight. */
  weightKg?: number | null;
  comment?: string;
  trackCodes?: string[];
  /**
   * The saved bag whose list the worker was looking at when they wrote
   * `trackCodes`; `null` when they wrote it before the server named a bag.
   * Only a list written against a confirmed bag may take codes off it.
   */
  trackCodesBase?: number | null;
}

export interface WorkRow {
  id: string;
  /** The first code scanned for this bag. */
  trackCode: string;
  /** Every code of the bag scanned so far, in scan order. */
  scannedCodes: string[];
  firstScanAt: string;
  lastScanAt: string;
  state: WorkRowState;
  kind: AstatkaScanKind | null;
  message: string;
  pkg: AstatkaPackage | null;
  edits: WorkRowEdits;
  confirmKey: string | null;
  /** When "Tasdiqlash" was last pressed; absent on rows saved by older builds. */
  pressedAt?: string;
  warnings: string[];
  /** Answered from the downloaded list, not by the server. */
  fromIndex: boolean;
  origin: "scan" | "import";
  otherAstatka: string | null;
  /**
   * A partner cargo's bag: every flight the partner holds for the client,
   * newest first. The worker picks the bag's flight from these in the bag
   * window (`edits.sourceFlight`). Absent for our own cargo, and on rows a
   * build before partner cargo saved on the device.
   */
  externalOptions?: AstatkaExternalBag[];
  /** False when the partner did not say which flight the code is in. */
  externalFlightKnown?: boolean;
  /**
   * The server could not say whose the code is because of a partner cargo
   * (it did not answer, or our table files the code under its flight). Such
   * a row is settled by "Qayta tekshirish", never by typing a client.
   */
  partnerState?: AstatkaPartnerState;
}

export type WorkFilter = "all" | "to_confirm" | "confirmed" | "waiting" | "problems";

export const WORK_FILTERS: { key: WorkFilter; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "to_confirm", label: "Tasdiqlash kerak" },
  { key: "confirmed", label: "Tasdiqlandi" },
  { key: "waiting", label: "Internet kutmoqda" },
  { key: "problems", label: "Muammoli" },
];

/** A scanner sends control characters around the code; people paste spaces. */
export function normaliseTrackCode(raw: string): string {
  return raw.replace(/[\s\p{Cc}]+/gu, "").toUpperCase();
}

/** Codes from pasted text: one per line, or separated by commas / spaces. */
export function parseTrackCodes(text: string): string[] {
  const codes = text
    .split(/[\s,;]+/)
    .map(normaliseTrackCode)
    .filter((code) => code.length >= 3);
  return [...new Set(codes)];
}

export function rowCodes(row: WorkRow): string[] {
  // The proposal's other codes belong to the flight it proposed; once the
  // worker picks another flight only what was scanned is known to be in it —
  // also when the list was fixed by hand before the pick and still holds them.
  if (!pickedPartnerFlight(row)) {
    return [...new Set(row.edits.trackCodes ?? [...(row.pkg?.track_codes ?? []), ...row.scannedCodes])];
  }
  if (!row.edits.trackCodes) return [...new Set(row.scannedCodes)];
  const proposalOnly = new Set(
    (row.pkg?.track_codes ?? []).filter((code) => !row.scannedCodes.includes(code)),
  );
  return [...new Set(row.edits.trackCodes.filter((code) => !proposalOnly.has(code)))];
}

export function findRowByCode(rows: WorkRow[], code: string): WorkRow | undefined {
  return rows.find((row) => rowCodes(row).includes(code) || row.scannedCodes.includes(code));
}

export type ScanEffect =
  /** A bag not on screen yet. */
  | "new"
  /** Another code of a bag already on screen. */
  | "same_bag"
  /** This exact code was already scanned. */
  | "repeat";

export interface ScanRegistration {
  rows: WorkRow[];
  row: WorkRow;
  effect: ScanEffect;
}

function newestFirst(rows: WorkRow[]): WorkRow[] {
  return [...rows].sort((a, b) => b.lastScanAt.localeCompare(a.lastScanAt));
}

export function registerScan(
  rows: WorkRow[],
  code: string,
  nowIso: string,
  newId: string,
  origin: WorkRow["origin"] = "scan",
): ScanRegistration {
  const existing = findRowByCode(rows, code);
  if (existing) {
    const repeat = existing.scannedCodes.includes(code);
    const updated: WorkRow = {
      ...existing,
      scannedCodes: repeat ? existing.scannedCodes : [...existing.scannedCodes, code],
      lastScanAt: nowIso,
    };
    return {
      rows: newestFirst(rows.map((row) => (row.id === existing.id ? updated : row))),
      row: updated,
      effect: repeat ? "repeat" : "same_bag",
    };
  }
  const row: WorkRow = {
    id: newId,
    trackCode: code,
    scannedCodes: [code],
    firstScanAt: nowIso,
    lastScanAt: nowIso,
    state: "checking",
    kind: null,
    message: "Tekshirilmoqda…",
    pkg: null,
    edits: {},
    confirmKey: null,
    warnings: [],
    fromIndex: false,
    origin,
    otherAstatka: null,
  };
  return { rows: [row, ...rows], row, effect: "new" };
}

/** The part of the downloaded base an offline scan reads. */
export interface OfflineBase {
  packages: AstatkaPackage[];
  candidates?: AstatkaPackage[];
}

interface BaseHit {
  pkg: AstatkaPackage;
  inThisAstatka: boolean;
}

// A base holds thousands of bags; an import of a few hundred codes must not
// walk all of them for every code. Rebuilt only when the base object changes.
const lookupCache = new WeakMap<OfflineBase, Map<string, BaseHit>>();

function codeLookup(base: OfflineBase): Map<string, BaseHit> {
  const cached = lookupCache.get(base);
  if (cached) return cached;
  const lookup = new Map<string, BaseHit>();
  for (const pkg of base.candidates ?? []) {
    for (const code of pkg.track_codes) lookup.set(code, { pkg, inThisAstatka: false });
  }
  // This astatka's own bags win over a candidate carrying the same code.
  for (const pkg of base.packages) {
    for (const code of pkg.track_codes) lookup.set(code, { pkg, inThisAstatka: true });
  }
  lookupCache.set(base, lookup);
  return lookup;
}

/**
 * Offline answer from the base on this computer, worded like the server's.
 * `null` means the base does not know the code; it waits for the internet.
 */
export function resolveFromIndex(base: OfflineBase, code: string): AstatkaScanResult | null {
  const hit = codeLookup(base).get(code);
  if (!hit) return null;
  const { pkg } = hit;
  if (hit.inThisAstatka) {
    return {
      kind: "in_astatka",
      track_code: code,
      package: pkg,
      other_astatka_flight: null,
      message:
        pkg.status === "confirmed"
          ? "Bu yuk allaqachon tasdiqlangan."
          : "Ro'yxatda bor. Tekshirib, tasdiqlang.",
    };
  }
  if (pkg.already_in_astatka) {
    return {
      kind: "other_astatka",
      track_code: code,
      package: pkg,
      other_astatka_flight: pkg.already_in_astatka,
      message: `Bu yuk ${pkg.already_in_astatka} astatkasida turibdi.`,
    };
  }
  return {
    kind: "new",
    track_code: code,
    package: pkg,
    other_astatka_flight: null,
    message: pkg.taken_away
      ? "Diqqat: tizimda bu yuk mijozga berilgan deb turibdi. Tekshiring."
      : "",
  };
}

function sameFlight(left: string, right: string): boolean {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

type PartnerOptions = Pick<WorkRow, "externalOptions" | "externalFlightKnown">;

function partnerOptionsAfter(row: WorkRow, result: AstatkaScanResult): PartnerOptions {
  const options = result.external_options ?? [];
  if (options.length > 0) {
    return {
      externalOptions: options,
      externalFlightKnown: result.external_flight_known ?? false,
    };
  }
  // An answer without the list (from the base on this computer, or a re-scan
  // of a bag already saved) is still that partner's bag: the flights the
  // server listed stay. Any other answer is not a partner's bag any more.
  const samePartner =
    isPartnerPackage(result.package) &&
    sourceCompanyOf(result.package) === sourceCompanyOf(row.pkg);
  return samePartner
    ? { externalOptions: row.externalOptions, externalFlightKnown: row.externalFlightKnown }
    : { externalOptions: undefined, externalFlightKnown: undefined };
}

/**
 * The partner's data names the client and lists the flights, and the edit
 * form locks both for its bag — so a client or flight typed while the code was
 * still unknown could never be fixed again. A flight picked from the list stays.
 *
 * The other way round, a flight picked from a partner's list means nothing for
 * a row that is no longer the partner's bag, and an answer that leaves the
 * code's owner open drops a typed client: it could be the partner's parcel.
 */
function editsForAnswer(
  row: WorkRow,
  result: AstatkaScanResult,
  options: AstatkaExternalBag[] | undefined,
): WorkRowEdits {
  const { edits } = row;
  const pkg = result.package;
  if (!isPartnerPackage(pkg)) {
    const next: WorkRowEdits = { ...edits };
    if (isPartnerPackage(row.pkg)) delete next.sourceFlight;
    if (result.partner_state) {
      delete next.clientCode;
      delete next.sourceFlight;
    }
    return next;
  }
  const next: WorkRowEdits = { ...edits };
  delete next.clientCode;
  const picked = next.sourceFlight;
  if (picked !== undefined && !(options ?? []).some((option) => sameFlight(option.flight_name, picked))) {
    delete next.sourceFlight;
  }
  return next;
}

/**
 * The code's bag is saved here and confirmed, but its list does not have the
 * code: a parcel added to the client's flight after the bag was taken. It
 * still has to be sent, or it never reaches the bag.
 */
export function addsToConfirmedBag(result: AstatkaScanResult): boolean {
  const pkg = result.package;
  return (
    result.kind === "in_astatka" &&
    pkg?.status === "confirmed" &&
    !pkg.track_codes.includes(result.track_code)
  );
}

function stateForScan(result: AstatkaScanResult): WorkRowState {
  switch (result.kind) {
    case "in_astatka":
      return result.package?.status === "confirmed" && !addsToConfirmedBag(result)
        ? "confirmed"
        : "ready";
    case "new":
      return "ready";
    case "other_astatka":
      return "other_astatka";
    case "not_found":
      return "not_found";
  }
}

export function applyScanResult(
  row: WorkRow,
  result: AstatkaScanResult,
  fromIndex: boolean,
): WorkRow {
  // A row the worker already pressed "Tasdiqlash" on keeps that state; a
  // late scan answer must not turn a queued confirm back into "ready".
  if (row.state === "queued" || row.state === "saving" || row.state === "confirmed") {
    if (row.pkg) return row;
    return { ...row, pkg: result.package, ...partnerOptionsAfter(row, result) };
  }
  const partner = partnerOptionsAfter(row, result);
  return {
    ...row,
    state: stateForScan(result),
    kind: result.kind,
    message: addsToConfirmedBag(result)
      ? "Bu kod tasdiqlangan yuk ro'yxatida yo'q. Tasdiqlang — yukka qo'shiladi."
      : result.message,
    pkg: result.package,
    edits: editsForAnswer(row, result, partner.externalOptions),
    fromIndex,
    otherAstatka: result.other_astatka_flight,
    partnerState: result.partner_state ?? undefined,
    ...partner,
  };
}

export function markWaitingForNetwork(row: WorkRow, hasBase: boolean): WorkRow {
  return {
    ...row,
    state: "waiting_net",
    message: hasBase
      ? "Kompyuterdagi bazada topilmadi. Internet qaytganda qayta tekshiriladi."
      : "Internet yo'q. Internet qaytganda tekshiriladi.",
  };
}

function bagIdentity(row: WorkRow): string | null {
  if (!row.pkg) return null;
  if (!isPartnerPackage(row.pkg)) {
    if (row.pkg.id !== null) return `id:${row.pkg.id}`;
    return `bag:|${row.pkg.client_code}|${row.pkg.source_flight_name}`;
  }
  // A flight the server only assumed (the partner did not say) is no proof
  // that two codes are one bag: the client may have bags in two flights.
  // Once the bag is confirmed its flight is settled.
  const guessed =
    row.externalFlightKnown === false &&
    row.edits.sourceFlight === undefined &&
    row.state !== "confirmed";
  if (guessed) return null;
  // The flight as picked, not as proposed: two bags of one client differ only
  // in that, and a partner's bag is saved once per client and flight, so a
  // code picked into a saved bag's flight is that bag. The company keeps a
  // partner's "ZZ17 from M200" apart from ours, which only shares a client
  // code and a flight name.
  return `bag:${sourceCompanyOf(row.pkg)}|${row.pkg.client_code}|${rowView(row).sourceFlight.trim().toUpperCase()}`;
}

function isSettled(row: WorkRow): boolean {
  return row.state === "confirmed" || row.state === "other_astatka";
}

/** Something typed on the row that only its own confirm would send. */
function hasEdits(row: WorkRow): boolean {
  return Object.values(row.edits).some((value) => value !== undefined);
}

/** Which way two rows of one bag fold, or `null` while they must stay apart. */
type FoldWay = "into_keeper" | "into_settled";

function foldWay(keeper: WorkRow, row: WorkRow): FoldWay | null {
  // A row being sent, or one pressed offline, goes out exactly as the worker
  // pressed it: its key may already have reached the server, which answers a
  // repeated key with what it saved the first time and ignores the rest. Its
  // answer must also still find it.
  const pressed = (candidate: WorkRow) =>
    candidate.state === "saving" || candidate.state === "queued";
  if (pressed(keeper) || pressed(row)) return null;
  if (isSettled(keeper) && isSettled(row)) {
    // Two answers naming different saved rows: a partner's bag confirmed here
    // was moved off another shelf, and the older answer about that shelf is
    // stale. Folded, the stale answer would hide the confirm.
    return (keeper.pkg?.id ?? null) === (row.pkg?.id ?? null) ? "into_keeper" : null;
  }
  if (!isSettled(keeper) && !isSettled(row)) return "into_keeper";
  // A settled row may never be sent again, so the other row may only join it
  // when nothing on it is unsent: every scanned code already on the saved
  // bag, and nothing typed.
  const [open, settled] = isSettled(keeper) ? [row, keeper] : [keeper, row];
  const held = new Set(settled.pkg?.track_codes ?? []);
  if (hasEdits(open) || !open.scannedCodes.every((code) => held.has(code))) return null;
  return isSettled(keeper) ? "into_keeper" : "into_settled";
}

function lastScan(left: WorkRow, right: WorkRow): string {
  return left.lastScanAt > right.lastScanAt ? left.lastScanAt : right.lastScanAt;
}

function foldIntoKeeper(keeper: WorkRow, row: WorkRow): WorkRow {
  const sent = new Set(rowCodes(keeper));
  // A code scanned onto the bag after its list was fixed by hand belongs
  // in that list: the confirm sends the fixed list as the bag's whole list.
  const fixedCodes = keeper.edits.trackCodes;
  return {
    ...keeper,
    // A key that may have reached the server stands for what was sent with
    // it; a row now carrying more codes goes out under a new one. The server
    // adds codes to a bag that is already confirmed, so nothing is lost
    // whether the old key landed or not.
    confirmKey: row.scannedCodes.every((code) => sent.has(code)) ? keeper.confirmKey : null,
    scannedCodes: [...new Set([...keeper.scannedCodes, ...row.scannedCodes])],
    edits: fixedCodes
      ? { ...keeper.edits, trackCodes: [...new Set([...fixedCodes, ...row.scannedCodes])] }
      : keeper.edits,
    lastScanAt: lastScan(keeper, row),
  };
}

/** The newer row is the server's word on the bag; the row keeps its place. */
function foldIntoSettled(keeper: WorkRow, row: WorkRow): WorkRow {
  return {
    ...row,
    id: keeper.id,
    trackCode: keeper.trackCode,
    firstScanAt: keeper.firstScanAt,
    origin: keeper.origin,
    scannedCodes: [...new Set([...keeper.scannedCodes, ...row.scannedCodes])],
    lastScanAt: lastScan(keeper, row),
  };
}

/**
 * Two rows scanned offline can turn out to be the same bag once the server
 * answers. Keep the older row, fold the other's codes into it. A row that
 * cannot join yet stays on its own, and a later row of the bag may still
 * join it.
 */
export function mergeSameBag(
  rows: WorkRow[],
  /** Told each row that left the list, and the row it joined. */
  onFold?: (goneId: string, keptId: string) => void,
): WorkRow[] {
  const byBag = new Map<string, WorkRow[]>();
  const result: WorkRow[] = [];
  for (const row of [...rows].sort((a, b) => a.firstScanAt.localeCompare(b.firstScanAt))) {
    const identity = bagIdentity(row);
    if (!identity) {
      result.push(row);
      continue;
    }
    const group = byBag.get(identity) ?? [];
    let keeper: WorkRow | undefined;
    let way: FoldWay | null = null;
    for (const candidate of group) {
      way = foldWay(candidate, row);
      if (way) {
        keeper = candidate;
        break;
      }
    }
    if (!keeper || !way) {
      byBag.set(identity, [...group, row]);
      result.push(row);
      continue;
    }
    const merged = way === "into_settled" ? foldIntoSettled(keeper, row) : foldIntoKeeper(keeper, row);
    onFold?.(row.id, keeper.id);
    byBag.set(
      identity,
      group.map((candidate) => (candidate === keeper ? merged : candidate)),
    );
    result[result.indexOf(keeper)] = merged;
  }
  return newestFirst(result);
}

/**
 * Queued confirms in the order they were pressed. The server applies a
 * batch in order and a hand-fixed list replaces the bag's codes, so two
 * pressed rows of one bag must land the way the worker pressed them: the
 * later press wins.
 */
export function inPressOrder(rows: WorkRow[]): WorkRow[] {
  const pressed = (row: WorkRow) => row.pressedAt ?? row.firstScanAt;
  // Rows pressed together ("Hammasini tasdiqlash") go in the order they were scanned.
  return [...rows].sort(
    (a, b) => pressed(a).localeCompare(pressed(b)) || a.firstScanAt.localeCompare(b.firstScanAt),
  );
}

/**
 * First scanned first. The server saves a batch in the order it is sent, so
 * the bags get their ids and confirm times in the order they were scanned.
 */
export function inScanOrder(rows: WorkRow[]): WorkRow[] {
  return [...rows].sort((a, b) => a.firstScanAt.localeCompare(b.firstScanAt));
}

export interface WorkRowView {
  clientCode: string;
  clientName: string | null;
  sourceFlight: string;
  trackCount: number;
  scannedCount: number;
  weightKg: number | null;
  weightEdited: boolean;
  timeIso: string;
  takenAway: boolean;
  /** "" for our own cargo, otherwise the partner's code ("AKB"). */
  sourceCompany: string;
  /** The partner's name for its chip; "" for our own cargo. */
  sourceCompanyName: string;
  /** The partner's data for the bag as picked; null for our own cargo. */
  external: AstatkaExternalBag | null;
  /** Photo-report rows of the bag as picked. */
  bags: number;
  hasPhoto: boolean;
}

/**
 * The partner flight the worker picked instead of the one the server
 * proposed; `null` when nothing else was picked.
 */
function pickedPartnerFlight(row: WorkRow): AstatkaExternalBag | null {
  const picked = row.edits.sourceFlight;
  if (picked === undefined || !isPartnerPackage(row.pkg)) return null;
  if (sameFlight(picked, row.pkg?.source_flight_name ?? "")) return null;
  return row.externalOptions?.find((option) => sameFlight(option.flight_name, picked)) ?? null;
}

export function rowView(row: WorkRow): WorkRowView {
  const weightTyped = row.edits.weightKg !== undefined;
  const picked = pickedPartnerFlight(row);
  const partner = isPartnerPackage(row.pkg);
  const proposedWeight = picked ? picked.weight_kg : row.pkg?.weight_kg ?? null;
  return {
    clientCode: row.edits.clientCode ?? row.pkg?.client_code ?? "",
    clientName: row.edits.clientCode ? null : row.pkg?.client_name ?? null,
    sourceFlight: row.edits.sourceFlight ?? row.pkg?.source_flight_name ?? "",
    trackCount: rowCodes(row).length,
    scannedCount: row.scannedCodes.length,
    weightKg: weightTyped ? row.edits.weightKg ?? null : proposedWeight,
    // A weight typed on the saved bag belongs to that flight, not to another one picked.
    weightEdited: weightTyped || (!picked && Boolean(row.pkg?.weight_edited)),
    timeIso: row.state === "confirmed" && row.pkg?.confirmed_at
      ? row.pkg.confirmed_at
      : row.lastScanAt,
    takenAway: Boolean(row.pkg?.taken_away),
    sourceCompany: sourceCompanyOf(row.pkg),
    sourceCompanyName: sourceCompanyLabel(row.pkg),
    external: partner ? picked ?? row.pkg?.external ?? null : null,
    bags: picked ? picked.rows : row.pkg?.bags ?? 0,
    hasPhoto: picked ? picked.photo_count > 0 : Boolean(row.pkg?.has_photo),
  };
}

// "Boshqa astatkada" is what the server said at scan time; that astatka may
// have been deleted or the bag unconfirmed there since. The confirm checks
// again: it refuses a bag still confirmed elsewhere and moves one that is
// only listed there, so pressing it is how the worker asks.
const CONFIRMABLE: WorkRowState[] = ["ready", "failed", "not_found", "waiting_net", "other_astatka"];

/** States "Qayta tekshirish" asks the server about again. */
const RECHECKABLE: WorkRowState[] = ["not_found", "failed"];

/**
 * Can the code be asked about again? A partner's API that was down, or a
 * server error, leaves the row here; a saving or queued row never is.
 */
export function canRecheck(row: WorkRow): boolean {
  return RECHECKABLE.includes(row.state);
}

/**
 * The id of the row's bag saved in THIS astatka, for its own photos; null
 * for a bag not saved yet, held by another astatka, or a partner cargo's.
 */
export function ownPackageId(row: WorkRow, flightName: string): number | null {
  return row.pkg ? ownPackageIdOf(row.pkg, flightName) : null;
}

/** {@link ownPackageId} for a bag the server just answered with. */
export function ownPackageIdOf(pkg: AstatkaPackage, flightName: string): number | null {
  if (pkg.id == null || isPartnerPackage(pkg) || pkg.already_in_astatka) return null;
  const sameAstatka =
    pkg.astatka_flight_name.trim().toUpperCase() === flightName.trim().toUpperCase();
  return sameAstatka ? pkg.id : null;
}

/** Can "Tasdiqlash" be pressed on this row? */
export function canConfirm(row: WorkRow): boolean {
  if (!CONFIRMABLE.includes(row.state)) return false;
  if (row.partnerState && !row.pkg) return false;
  return rowView(row).clientCode.trim().length > 0;
}

export function buildConfirmItem(row: WorkRow, key: string): AstatkaConfirmItem {
  const view = rowView(row);
  return {
    idempotency_key: key,
    client_code: view.clientCode,
    source_flight_name: view.sourceFlight,
    track_code: row.trackCode,
    track_codes: rowCodes(row),
    // A list fixed by hand replaces the bag's codes; scanned codes only add.
    track_codes_edited: row.edits.trackCodes !== undefined ? true : undefined,
    // Which bag the list was written against: a confirmed bag only lets a
    // list written looking at its own codes take any of them off.
    track_codes_base_package_id:
      row.edits.trackCodes !== undefined ? (row.edits.trackCodesBase ?? null) : undefined,
    // Only a typed weight is sent: the server already knows the report's.
    weight_kg: row.edits.weightKg !== undefined ? row.edits.weightKg : undefined,
    comment: row.edits.comment ?? undefined,
    scanned_at: row.firstScanAt,
    origin: row.origin,
    // The server re-reads a partner's bag itself and keeps it out of our
    // cargo tables; it only has to know whose bag it is.
    source_company: view.sourceCompany,
  };
}

/** The confirm left the bag saved: newly, or by an earlier press of the same key. */
export function confirmSaved(result: AstatkaConfirmResult): boolean {
  return (
    result.outcome === "confirmed" ||
    result.outcome === "duplicate" ||
    result.outcome === "already_confirmed"
  );
}

export function applyConfirmResult(row: WorkRow, result: AstatkaConfirmResult): WorkRow {
  if (confirmSaved(result)) {
    return {
      ...row,
      state: "confirmed",
      pkg: result.package ?? row.pkg,
      message: result.message,
      warnings: result.warnings,
      edits: {},
    };
  }
  return {
    ...row,
    state: "failed",
    message: result.message,
    warnings: result.warnings,
    // A transient error retries with the same key; a refusal gets a fresh
    // one, because whatever it refused may change before the next try.
    confirmKey: result.outcome === "error" ? row.confirmKey : null,
  };
}

export function matchesFilter(row: WorkRow, filter: WorkFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "to_confirm":
      return row.state === "ready";
    case "confirmed":
      return row.state === "confirmed";
    case "waiting":
      return (
        row.state === "waiting_net" ||
        row.state === "queued" ||
        row.state === "checking" ||
        row.state === "saving"
      );
    case "problems":
      return (
        row.state === "failed" ||
        row.state === "not_found" ||
        row.state === "other_astatka" ||
        (row.state === "ready" && rowView(row).takenAway)
      );
  }
}

export function countByFilter(rows: WorkRow[]): Record<WorkFilter, number> {
  const counts: Record<WorkFilter, number> = {
    all: 0,
    to_confirm: 0,
    confirmed: 0,
    waiting: 0,
    problems: 0,
  };
  for (const row of rows) {
    for (const { key } of WORK_FILTERS) {
      if (matchesFilter(row, key)) counts[key] += 1;
    }
  }
  return counts;
}

const STATE_LABELS: Record<WorkRowState, string> = {
  checking: "Tekshirilmoqda",
  waiting_net: "Internet kutmoqda",
  ready: "Tasdiqlash kerak",
  saving: "Saqlanmoqda",
  queued: "Navbatda",
  confirmed: "Tasdiqlandi",
  other_astatka: "Boshqa astatkada",
  not_found: "Topilmadi",
  failed: "Xato",
};

export function stateLabel(state: WorkRowState): string {
  return STATE_LABELS[state];
}

function csvCell(value: string | number | null): string {
  let text = value === null ? "" : String(value);
  // A spreadsheet runs a cell that starts like a formula; a partner's client
  // code or flight name is data, so it is kept as text.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The queue as a spreadsheet, for a backup before anything is confirmed. */
export function rowsToCsv(rows: WorkRow[]): string {
  const header = [
    "Mijoz kodi",
    "Qaysi reysdan",
    "Kargo",
    "Trek kodlar soni",
    "Og'irligi (kg)",
    "Holati",
    "Skan qilingan kodlar",
    "Vaqt",
  ];
  const lines = rows.map((row) => {
    const view = rowView(row);
    return [
      view.clientCode,
      view.sourceFlight,
      cargoLabel(view.sourceCompany),
      view.trackCount,
      view.weightKg,
      stateLabel(row.state),
      row.scannedCodes.join(" "),
      row.lastScanAt,
    ]
      .map(csvCell)
      .join(",");
  });
  // The BOM makes Excel read the file as UTF-8 instead of mangling ʻ and ʼ.
  return `\uFEFF${[header.join(","), ...lines].join("\n")}`;
}
