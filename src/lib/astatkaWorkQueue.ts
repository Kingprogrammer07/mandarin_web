import type {
  AstatkaConfirmItem,
  AstatkaConfirmResult,
  AstatkaPackage,
  AstatkaScanKind,
  AstatkaScanResult,
} from "@/api/services/astatkaFlights";

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
  warnings: string[];
  /** Answered from the downloaded list, not by the server. */
  fromIndex: boolean;
  origin: "scan" | "import";
  otherAstatka: string | null;
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
  const codes = row.edits.trackCodes ?? [
    ...(row.pkg?.track_codes ?? []),
    ...row.scannedCodes,
  ];
  return [...new Set(codes)];
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
      : "Ro'yxatda yo'q edi. Tekshirib, tasdiqlang.",
  };
}

function stateForScan(result: AstatkaScanResult): WorkRowState {
  switch (result.kind) {
    case "in_astatka":
      return result.package?.status === "confirmed" ? "confirmed" : "ready";
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
    return { ...row, pkg: row.pkg ?? result.package };
  }
  return {
    ...row,
    state: stateForScan(result),
    kind: result.kind,
    message: result.message,
    pkg: result.package,
    fromIndex,
    otherAstatka: result.other_astatka_flight,
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
  if (row.pkg.id !== null) return `id:${row.pkg.id}`;
  return `bag:${row.pkg.client_code}|${row.pkg.source_flight_name}`;
}

/**
 * Two rows scanned offline can turn out to be the same bag once the server
 * answers. Keep the older row, fold the other's codes into it.
 */
export function mergeSameBag(rows: WorkRow[]): WorkRow[] {
  const byBag = new Map<string, WorkRow>();
  const result: WorkRow[] = [];
  for (const row of [...rows].sort((a, b) => a.firstScanAt.localeCompare(b.firstScanAt))) {
    const identity = bagIdentity(row);
    const keeper = identity ? byBag.get(identity) : undefined;
    if (!identity || !keeper) {
      if (identity) byBag.set(identity, row);
      result.push(row);
      continue;
    }
    const merged: WorkRow = {
      ...keeper,
      scannedCodes: [...new Set([...keeper.scannedCodes, ...row.scannedCodes])],
      lastScanAt:
        keeper.lastScanAt > row.lastScanAt ? keeper.lastScanAt : row.lastScanAt,
    };
    byBag.set(identity, merged);
    result[result.indexOf(keeper)] = merged;
  }
  return newestFirst(result);
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
}

export function rowView(row: WorkRow): WorkRowView {
  const weightEdited = row.edits.weightKg !== undefined;
  return {
    clientCode: row.edits.clientCode ?? row.pkg?.client_code ?? "",
    clientName: row.edits.clientCode ? null : row.pkg?.client_name ?? null,
    sourceFlight: row.edits.sourceFlight ?? row.pkg?.source_flight_name ?? "",
    trackCount: rowCodes(row).length,
    scannedCount: row.scannedCodes.length,
    weightKg: weightEdited ? row.edits.weightKg ?? null : row.pkg?.weight_kg ?? null,
    weightEdited: weightEdited || Boolean(row.pkg?.weight_edited),
    timeIso: row.state === "confirmed" && row.pkg?.confirmed_at
      ? row.pkg.confirmed_at
      : row.lastScanAt,
    takenAway: Boolean(row.pkg?.taken_away),
  };
}

const CONFIRMABLE: WorkRowState[] = ["ready", "failed", "not_found", "waiting_net"];

/** Can "Tasdiqlash" be pressed on this row? */
export function canConfirm(row: WorkRow): boolean {
  if (!CONFIRMABLE.includes(row.state)) return false;
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
    // Only a typed weight is sent: the server already knows the report's.
    weight_kg: row.edits.weightKg !== undefined ? row.edits.weightKg : undefined,
    comment: row.edits.comment ?? undefined,
    scanned_at: row.firstScanAt,
    origin: row.origin,
  };
}

export function applyConfirmResult(row: WorkRow, result: AstatkaConfirmResult): WorkRow {
  if (
    result.outcome === "confirmed" ||
    result.outcome === "duplicate" ||
    result.outcome === "already_confirmed"
  ) {
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
  const text = value === null ? "" : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The queue as a spreadsheet, for a backup before anything is confirmed. */
export function rowsToCsv(rows: WorkRow[]): string {
  const header = [
    "Mijoz kodi",
    "Qaysi reysdan",
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
