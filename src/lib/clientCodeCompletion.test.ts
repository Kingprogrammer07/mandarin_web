import { describe, expect, it } from "vitest";

import type { ClientCodeSuggestionsResponse } from "@/api/services/cargo";
import { getRegionAndDistrictFromCode } from "@/lib/aviaCodes";
import {
  isRegionOnlyCode,
  parseClientCodeInput,
  placeLabelKeyForCode,
  regionOnlyPrefix,
  resolveCodeForSubmit,
} from "@/lib/clientCodeCompletion";

function lookup(partial: Partial<ClientCodeSuggestionsResponse>): ClientCodeSuggestionsResponse {
  return { query: "", exact: false, best: null, best_reason: null, items: [], ...partial };
}

describe("parseClientCodeInput", () => {
  it("splits letters and number", () => {
    expect(parseClientCodeInput("SA123")).toEqual({ letters: "SA", digits: "123" });
    expect(parseClientCodeInput("saask12")).toEqual({ letters: "SAASK", digits: "12" });
  });

  it("waits for both parts", () => {
    expect(parseClientCodeInput("SA")).toBeNull();
    expect(parseClientCodeInput("S1")).toBeNull();
    expect(parseClientCodeInput("SA-1")).toBeNull();
  });
});

describe("region-only codes", () => {
  it("recognises region letters without a district", () => {
    expect(regionOnlyPrefix("SA123")).toBe("SA");
    expect(regionOnlyPrefix("ST15")).toBe("ST");
    expect(isRegionOnlyCode("SAAN123")).toBe(false);
    expect(isRegionOnlyCode("XX12")).toBe(false);
    expect(isRegionOnlyCode("SA")).toBe(false);
  });
});

describe("resolveCodeForSubmit", () => {
  it("leaves full codes alone, even offline", () => {
    expect(resolveCodeForSubmit("SAAN123", null)).toEqual({ kind: "ok", code: "SAAN123" });
  });

  it("fills in the single completion", () => {
    const result = resolveCodeForSubmit(
      "SA123",
      lookup({ best: "SAAN123", best_reason: "unique", items: [{ code: "SAAN123", in_flight: false }] }),
    );
    expect(result).toEqual({ kind: "ok", code: "SAAN123" });
  });

  it("keeps a code that exists as typed", () => {
    const result = resolveCodeForSubmit(
      "SS50",
      lookup({
        exact: true,
        items: [
          { code: "SS50", in_flight: false },
          { code: "SSIS50", in_flight: false },
        ],
      }),
    );
    expect(result).toEqual({ kind: "ok", code: "SS50" });
  });

  it("refuses to guess between Tashkent districts", () => {
    const result = resolveCodeForSubmit(
      "ST15",
      lookup({
        items: [
          { code: "STCH15", in_flight: false },
          { code: "STYU15", in_flight: false },
        ],
      }),
    );
    expect(result).toEqual({ kind: "ambiguous" });
  });

  it("uses the one Tashkent client expected on the flight", () => {
    const result = resolveCodeForSubmit(
      "ST15",
      lookup({
        best: "STYU15",
        best_reason: "flight",
        items: [
          { code: "STYU15", in_flight: true },
          { code: "STCH15", in_flight: false },
        ],
      }),
    );
    expect(result).toEqual({ kind: "ok", code: "STYU15" });
  });

  it("blocks an unknown or unchecked region-only code", () => {
    expect(resolveCodeForSubmit("SA999", lookup({}))).toEqual({ kind: "not_found" });
    expect(resolveCodeForSubmit("SA999", null)).toEqual({ kind: "unavailable" });
  });
});

describe("district lookup", () => {
  it("prefers the longer city code over its district prefix", () => {
    expect(getRegionAndDistrictFromCode("SAASK12").district).toBe("asaka_s");
    expect(getRegionAndDistrictFromCode("SAAS12").district).toBe("asaka_t");
    expect(getRegionAndDistrictFromCode("SNCHR7").district).toBe("chortoq_s");
  });

  it("labels a code with its district, or its region", () => {
    expect(placeLabelKeyForCode("STCH15")).toBe("districts.chilonzor");
    expect(placeLabelKeyForCode("SA123")).toBe("regions.andijan");
    expect(placeLabelKeyForCode("XX1")).toBeNull();
  });
});
