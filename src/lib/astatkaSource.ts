import type { AstatkaPackage } from "@/api/services/astatkaFlights";

/**
 * Whose cargo a bag is: ours, or a partner cargo's whose API found it. A
 * package saved on the device by an older build has no `source_company` at
 * all, and that means ours — every check goes through here so none of them
 * forgets it.
 */

/** How our own cargo is named next to the partners' in filters and exports. */
export const OWN_CARGO_LABEL = "Mandarin";

type SourceFields = Pick<AstatkaPackage, "source_company" | "source_company_name">;

/** "" for our own cargo, otherwise the partner's code in capitals ("AKB"). */
export function sourceCompanyOf(pkg: SourceFields | null | undefined): string {
  return (pkg?.source_company ?? "").trim().toUpperCase();
}

export function isPartnerPackage(pkg: SourceFields | null | undefined): boolean {
  return sourceCompanyOf(pkg) !== "";
}

/** The partner's display name, or its code; "" for our own cargo. */
export function sourceCompanyLabel(pkg: SourceFields | null | undefined): string {
  if (!isPartnerPackage(pkg)) return "";
  return pkg?.source_company_name?.trim() || sourceCompanyOf(pkg);
}

/** A cargo code as a filter or a spreadsheet names it: "" is ours. */
export function cargoLabel(code: string): string {
  return code.trim() === "" ? OWN_CARGO_LABEL : code.trim().toUpperCase();
}
