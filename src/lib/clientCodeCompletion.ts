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
 * A full code goes through untouched, as it always has. A region-only code is
 * replaced by its single completion, or kept when it exists exactly as typed
 * (old codes such as "SS50"); anything else is refused, because uploading
 * "SA123" would attach the parcel to no client at all.
 */
export function resolveCodeForSubmit(
  typed: string,
  lookup: ClientCodeSuggestionsResponse | null,
): CodeSubmitResolution {
  if (!isRegionOnlyCode(typed)) return { kind: "ok", code: typed };
  if (!lookup) return { kind: "unavailable" };
  if (lookup.exact) return { kind: "ok", code: typed };
  if (lookup.best) return { kind: "ok", code: lookup.best };
  return lookup.items.length > 0 ? { kind: "ambiguous" } : { kind: "not_found" };
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
