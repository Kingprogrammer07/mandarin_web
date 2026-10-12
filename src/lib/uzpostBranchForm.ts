/**
 * Checks for the "add a UzPost branch" form, mirroring the server's rules.
 *
 * The index is what UzPost delivers to: a wrong one is quietly rerouted to the
 * parent office, so it must be exactly the 6 digits printed at the office. The
 * coordinates price the parcel; a pasted Google Maps link is accepted because
 * that is where a manager will copy them from.
 */

// Uzbekistan, generously rounded — same box the server enforces.
const LAT_RANGE: [number, number] = [37, 46];
const LON_RANGE: [number, number] = [55, 74];

export interface UzpostBranchFormValues {
  name: string;
  postcodeIndex: string;
  address: string;
  coordinates: string;
  workdays: string;
}

export interface ParsedCoordinates {
  latitude: number;
  longitude: number;
}

const NUMBER = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
const PATTERNS = [
  // ".../place/...!3d41.311!4d69.279" — the pin itself, more exact than "@".
  new RegExp(String.raw`!3d${NUMBER}!4d${NUMBER}`),
  // "...?q=41.311,69.279" or "query=" / "ll="
  new RegExp(String.raw`[?&](?:q|query|ll)=${NUMBER},\s*${NUMBER}`),
  // ".../@41.311,69.279,17z"
  new RegExp(String.raw`@${NUMBER},${NUMBER}`),
  // "41.311, 69.279" typed or copied from the map's right-click menu
  new RegExp(String.raw`^\s*${NUMBER}\s*[,;\s]\s*${NUMBER}\s*$`),
];

export function parseCoordinates(text: string): ParsedCoordinates | null {
  const value = text.trim();
  if (!value) return null;
  for (const pattern of PATTERNS) {
    const match = value.match(pattern);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }
  return null;
}

function inUzbekistan({ latitude, longitude }: ParsedCoordinates): boolean {
  return (
    latitude >= LAT_RANGE[0] &&
    latitude <= LAT_RANGE[1] &&
    longitude >= LON_RANGE[0] &&
    longitude <= LON_RANGE[1]
  );
}

export type UzpostBranchFormErrors = Partial<
  Record<keyof UzpostBranchFormValues, string>
>;

export function validateUzpostBranchForm(
  values: UzpostBranchFormValues,
): UzpostBranchFormErrors {
  const errors: UzpostBranchFormErrors = {};
  if (values.name.trim().length < 2) {
    errors.name = "Filial nomini yozing.";
  }
  if (!/^\d{6}$/.test(values.postcodeIndex.trim())) {
    errors.postcodeIndex = "Indeks 6 ta raqamdan iborat bo'lishi kerak.";
  }
  if (values.address.trim().length < 3) {
    errors.address = "Manzilni yozing.";
  }
  const point = parseCoordinates(values.coordinates);
  if (!point) {
    errors.coordinates =
      "Koordinatani \"41.311, 69.279\" ko'rinishida yoki Google Maps havolasi bilan kiriting.";
  } else if (!inUzbekistan(point)) {
    errors.coordinates =
      "Nuqta O'zbekistondan tashqarida. Kenglik va uzunlik joyi almashmaganini tekshiring.";
  }
  return errors;
}
