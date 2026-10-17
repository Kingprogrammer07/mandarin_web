import { describe, expect, it } from "vitest";

import type { ClientCodeSuggestionsResponse } from "@/api/services/cargo";
import { getRegionAndDistrictFromCode } from "@/lib/aviaCodes";
import {
  buildClientCodeIndex,
  completeFromIndex,
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
  it("leaves full codes alone when nothing is known, even offline", () => {
    expect(resolveCodeForSubmit("SAAN123", null)).toEqual({ kind: "ok", code: "SAAN123" });
  });

  it("refuses a full code the system does not know", () => {
    expect(resolveCodeForSubmit("SAAN999", lookup({}))).toEqual({ kind: "not_found" });
  });

  it("takes a full code that exists as typed", () => {
    expect(
      resolveCodeForSubmit("SAAN123", lookup({ exact: true, best: "SAAN123" })),
    ).toEqual({ kind: "ok", code: "SAAN123" });
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

// Same cases as backend tests/test_client_code_completion.py: the device and
// the server must answer alike.
describe("completeFromIndex", () => {
  const index = (clients: string[][], flight: string[] = []) => buildClientCodeIndex(clients, flight);

  it("fills in the district from the region number", () => {
    const result = completeFromIndex("SA123", index([["SAAN123"]]));
    expect(result).toMatchObject({ best: "SAAN123", best_reason: "unique", exact: false });
  });

  it("does not offer a longer number", () => {
    const result = completeFromIndex("SA123", index([["SAAN123"], ["SAAN1234"]]));
    expect(result?.items.map((i) => i.code)).toEqual(["SAAN123"]);
  });

  it("completes a five-letter city prefix", () => {
    expect(completeFromIndex("SAAS12", index([["SAASK12"]]))?.best).toBe("SAASK12");
  });

  it("leaves a Tashkent number to the worker without flight data", () => {
    const result = completeFromIndex("ST15", index([["STCH15"], ["STYU15"], ["STSR15"]]));
    expect(result?.best).toBeNull();
    expect(result?.items.map((i) => i.code).sort()).toEqual(["STCH15", "STSR15", "STYU15"]);
  });

  it("picks the one Tashkent client on the flight, also through another code", () => {
    const clients = [["X100", "STCH15"], ["STYU15"]];
    const result = completeFromIndex("ST15", index(clients, ["x100"]));
    expect(result).toMatchObject({ best: "STCH15", best_reason: "flight" });
    expect(result?.items[0]).toEqual({ code: "STCH15", in_flight: true });
  });

  it("keeps a code that exists as typed", () => {
    const result = completeFromIndex("SS50", index([["SSIS50", "SS50"]]));
    expect(result).toMatchObject({ exact: true, best: "SS50", best_reason: "exact" });
  });

  it("does not auto-fill an exact legacy code next to another client", () => {
    const result = completeFromIndex("SS50", index([["SS50"], ["SSIS50"]]));
    expect(result).toMatchObject({ exact: true, best: null });
    expect(result?.items.map((i) => i.code)).toEqual(["SS50", "SSIS50"]);
  });

  it("finds nothing for an unknown code", () => {
    expect(completeFromIndex("SA999", index([["SAAN123"]]))).toMatchObject({
      exact: false,
      best: null,
      items: [],
    });
  });

  it("answers null until the code has letters and a number", () => {
    expect(completeFromIndex("SAAN", index([["SAAN1"]]))).toBeNull();
  });
});
