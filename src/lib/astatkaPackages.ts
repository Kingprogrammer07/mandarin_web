import type {
  AstatkaPackage,
  AstatkaPackageSort,
  AstatkaPackageStatus,
} from "@/api/services/astatkaFlights";
import { sourceCompanyOf } from "@/lib/astatkaSource";

export interface PackageFilter {
  status?: AstatkaPackageStatus;
  sourceFlight?: string;
  /** Absent = every cargo; "" = only ours; "AKB" = only that partner's. */
  sourceCompany?: string;
  search?: string;
  sort: AstatkaPackageSort;
}

export interface PackageTotals {
  counts: { all: number; expected: number; confirmed: number };
  weights: { expected: number; confirmed: number };
  sourceFlights: string[];
  /** Partner codes with bags here; empty when every bag is ours. */
  sourceCompanies: string[];
}

function activityTime(pkg: AstatkaPackage): number {
  const iso = pkg.confirmed_at ?? pkg.scanned_at ?? pkg.created_at;
  const time = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
}

/** When the bag was scanned on the device; a bag confirmed without one, when it was confirmed. */
function scanTime(pkg: AstatkaPackage): number | null {
  const iso = pkg.scanned_at ?? pkg.confirmed_at;
  const time = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(time) ? null : time;
}

const compareText = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

/**
 * The same comparison the server's sort keys make, so the offline copy of the
 * list does not reshuffle the moment the connection comes back.
 */
const COMPARATORS: Record<AstatkaPackageSort, (a: AstatkaPackage, b: AstatkaPackage) => number> = {
  recent: (a, b) => activityTime(b) - activityTime(a) || (b.id ?? 0) - (a.id ?? 0),
  scanned: (a, b) => {
    const [left, right] = [scanTime(a), scanTime(b)];
    if (left !== right) {
      if (left === null) return 1;
      if (right === null) return -1;
      return left - right;
    }
    return (a.id ?? 0) - (b.id ?? 0);
  },
  client_asc: (a, b) => compareText(a.client_code, b.client_code) || (a.id ?? 0) - (b.id ?? 0),
  client_desc: (a, b) => compareText(b.client_code, a.client_code) || (b.id ?? 0) - (a.id ?? 0),
  weight_desc: (a, b) => {
    if (a.weight_kg === null && b.weight_kg === null) return (b.id ?? 0) - (a.id ?? 0);
    if (a.weight_kg === null) return 1;
    if (b.weight_kg === null) return -1;
    return b.weight_kg - a.weight_kg || (b.id ?? 0) - (a.id ?? 0);
  },
  flight_asc: (a, b) =>
    compareText(a.source_flight_name, b.source_flight_name) ||
    compareText(a.client_code, b.client_code) ||
    (a.id ?? 0) - (b.id ?? 0),
};

/**
 * Filters the saved packages held on the device, mirroring the server's list
 * endpoint: status, source flight, cargo, one search box over client code and
 * track codes, and the same sort keys.
 */
export function filterPackages(packages: AstatkaPackage[], filter: PackageFilter): AstatkaPackage[] {
  const needle = (filter.search ?? "").trim().toUpperCase();
  const source = filter.sourceFlight?.trim().toUpperCase();
  const company = filter.sourceCompany?.trim().toUpperCase();
  return packages
    .filter((pkg) => {
      if (filter.status && pkg.status !== filter.status) return false;
      if (source !== undefined && pkg.source_flight_name.toUpperCase() !== source) return false;
      if (company !== undefined && sourceCompanyOf(pkg) !== company) return false;
      if (!needle) return true;
      return (
        pkg.client_code.toUpperCase().includes(needle) ||
        pkg.track_codes.some((code) => code.toUpperCase().includes(needle))
      );
    })
    .sort(COMPARATORS[filter.sort]);
}

/** Counts and weights over every package, before any filter, like the server's. */
export function totalsOf(packages: AstatkaPackage[]): PackageTotals {
  const totals: PackageTotals = {
    counts: { all: packages.length, expected: 0, confirmed: 0 },
    weights: { expected: 0, confirmed: 0 },
    sourceFlights: [],
    sourceCompanies: [],
  };
  const flights = new Set<string>();
  const companies = new Set<string>();
  for (const pkg of packages) {
    flights.add(pkg.source_flight_name);
    const company = sourceCompanyOf(pkg);
    if (company) companies.add(company);
    if (pkg.status === "confirmed") {
      totals.counts.confirmed += 1;
      totals.weights.confirmed += pkg.weight_kg ?? 0;
    } else if (pkg.status === "expected") {
      totals.counts.expected += 1;
      totals.weights.expected += pkg.weight_kg ?? 0;
    }
  }
  totals.sourceFlights = [...flights].sort(compareText);
  totals.sourceCompanies = [...companies].sort(compareText);
  return totals;
}
