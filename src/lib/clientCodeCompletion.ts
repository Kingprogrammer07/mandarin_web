import type { ClientCodeSuggestionsResponse } from "@/api/services/cargo";
import { REGION_PREFIXES, getRegionAndDistrictFromCode } from "@/lib/aviaCodes";
import { DISTRICTS, regions } from "@/lib/validation";

/*
 * Client-code completion rules for the cargo photo form.
 *
 * Outside Tashkent city a code's number is unique across its whole region
 * (backend `generate_client_code`), so the region letters plus the number
 * ("SA123") are enough: the backend finds the one district it belongs to and
 * the form fills in "SAAN123". Tashkent city numbers restart in every
 * district, so "ST15" is usually a choice between several codes.
 */

const CODE_INPUT_RE = /^([A-Z]{2,6})([0-9]{1,7})$/;
const REGION_LETTERS = new Set(Object.values(REGION_PREFIXES));

export interface ParsedClientCode {
  letters: string;
  digits: string;
}

/** Split "SA123" into letters and number; null until it has both. */
export function parseClientCodeInput(value: string): ParsedClientCode | null {
  const match = CODE_INPUT_RE.exec(value.trim().toUpperCase());
  return match ? { letters: match[1], digits: match[2] } : null;
}

/** Region letters of a code typed without its district part ("SA123" → "SA"), else null. */
export function regionOnlyPrefix(value: string): string | null {
  const parsed = parseClientCodeInput(value);
  return parsed && REGION_LETTERS.has(parsed.letters) ? parsed.letters : null;
}

/** "SA123": region letters and a number, district letters still missing. */
export function isRegionOnlyCode(value: string): boolean {
  return regionOnlyPrefix(value) !== null;
}

export type CodeSubmitResolution =
  | { kind: "ok"; code: string }
  | { kind: "ambiguous" }
  | { kind: "not_found" }
  | { kind: "unavailable" };

/**
 * What to upload for the typed code.
 *
 * A code that exists as typed goes through; a code with one safe completion
 * ("SA123" -> "SAAN123") is replaced by it. A code the system does not know
 * comes back "not_found": the form uploads it only when the worker ticks
 * "Ro'yxatdan o'tmagan mijoz" for this one parcel. Without an answer (offline
 * and no saved code list) a full code goes through as it always has, while a
 * region-only one is refused: uploading "SA123" would attach the parcel to no
 * client at all.
 */
export function resolveCodeForSubmit(
  typed: string,
  lookup: ClientCodeSuggestionsResponse | null,
): CodeSubmitResolution {
  if (!lookup) {
    return isRegionOnlyCode(typed) ? { kind: "unavailable" } : { kind: "ok", code: typed };
  }
  if (lookup.exact) return { kind: "ok", code: typed };
  if (lookup.best) return { kind: "ok", code: lookup.best };
  return lookup.items.length > 0 ? { kind: "ambiguous" } : { kind: "not_found" };
}

/** Every client's codes, indexed by number, for completing codes on the device. */
export interface ClientCodeIndex {
  /** Number part ("123") -> positions in `clients` with a code ending in it. */
  byDigits: Map<string, number[]>;
  /** One list per client, codes in primary-code order (as the server sends them). */
  clients: string[][];
  /** Upper-cased codes on the flight's expected-cargo list. */
  flightCodes: Set<string>;
}

const FULL_CODE_RE = /^([A-Z]+)([0-9]+)$/;

export function buildClientCodeIndex(
  clients: string[][],
  flightCodes: readonly string[],
): ClientCodeIndex {
  const byDigits = new Map<string, number[]>();
  clients.forEach((codes, position) => {
    const numbers = new Set<string>();
    for (const code of codes) {
      const match = FULL_CODE_RE.exec(code);
      if (match) numbers.add(match[2]);
    }
    for (const digits of numbers) {
      const list = byDigits.get(digits);
      if (list) list.push(position);
      else byDigits.set(digits, [position]);
    }
  });
  return {
    byDigits,
    clients,
    flightCodes: new Set(flightCodes.map((c) => c.trim().toUpperCase())),
  };
}

function codeSortKey(code: string): [string, number] {
  const match = /^([A-Z]*)([0-9]*)/.exec(code);
  return [match?.[1] ?? code, match?.[2] ? Number(match[2]) : 0];
}

/**
 * The answer `/flights/client-code-suggestions` would give, worked out from the
 * saved code list. Mirrors backend `pick_completion`; keep the two in step.
 */
export function completeFromIndex(
  typed: string,
  index: ClientCodeIndex,
): ClientCodeSuggestionsResponse | null {
  const parsed = parseClientCodeInput(typed);
  if (!parsed) return null;
  const { letters, digits } = parsed;
  const typedCode = letters + digits;
  const matches = (code: string) => {
    const match = FULL_CODE_RE.exec(code);
    return match !== null && match[2] === digits && match[1].startsWith(letters);
  };

  const chosen: { code: string; inFlight: boolean }[] = [];
  for (const position of index.byDigits.get(digits) ?? []) {
    const codes = index.clients[position];
    const matching = codes.filter(matches);
    if (matching.length === 0) continue;
    chosen.push({
      code: matching.includes(typedCode) ? typedCode : matching[0],
      inFlight: codes.some((c) => index.flightCodes.has(c)),
    });
  }

  const exact = chosen.some((c) => c.code === typedCode);
  let best: string | null = null;
  let bestReason: ClientCodeSuggestionsResponse["best_reason"] = null;
  if (chosen.length === 1) {
    best = chosen[0].code;
    bestReason = exact ? "exact" : "unique";
  } else if (chosen.length > 1) {
    const onFlight = chosen.filter((c) => c.inFlight);
    if (onFlight.length === 1) {
      best = onFlight[0].code;
      bestReason = "flight";
    }
  }

  chosen.sort((a, b) => {
    if (a.inFlight !== b.inFlight) return a.inFlight ? -1 : 1;
    const aTyped = a.code === typedCode;
    if (aTyped !== (b.code === typedCode)) return aTyped ? -1 : 1;
    const [aLetters, aNumber] = codeSortKey(a.code);
    const [bLetters, bNumber] = codeSortKey(b.code);
    if (aLetters !== bLetters) return aLetters < bLetters ? -1 : 1;
    return aNumber - bNumber;
  });

  return {
    query: typedCode,
    exact,
    best,
    best_reason: bestReason,
    items: chosen.map((c) => ({ code: c.code, in_flight: c.inFlight })),
  };
}

/** i18n key of the district (or, failing that, region) a code belongs to. */
export function placeLabelKeyForCode(code: string): string | null {
  const { region, district } = getRegionAndDistrictFromCode(code);
  if (region && district) {
    const label = DISTRICTS[region]?.find((d) => d.value === district)?.label;
    if (label) return label;
  }
  if (region) return regions.find((r) => r.value === region)?.label ?? null;
  return null;
}
