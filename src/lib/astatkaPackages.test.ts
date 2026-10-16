import { describe, expect, it } from "vitest";

import type { AstatkaPackage } from "@/api/services/astatkaFlights";

import { filterPackages, totalsOf } from "./astatkaPackages";

function pkg(overrides: Partial<AstatkaPackage>): AstatkaPackage {
  return {
    id: 1,
    astatka_flight_name: "OSTATKA.202",
    client_code: "SS100",
    client_name: null,
    source_flight_name: "M210",
    track_codes: ["YT001"],
    track_count: 1,
    weight_kg: 1,
    weight_edited: false,
    bags: 1,
    has_photo: true,
    status: "expected",
    origin: "auto",
    comment: null,
    taken_away: false,
    payment_state: null,
    already_in_astatka: null,
    scanned_at: null,
    confirmed_at: null,
    confirmed_by: null,
    created_at: "2026-10-11T08:00:00Z",
    ...overrides,
  };
}

const packages = [
  pkg({ id: 1, client_code: "SS100", weight_kg: 2, track_codes: ["YT001"] }),
  pkg({
    id: 2,
    client_code: "SS200",
    status: "confirmed",
    weight_kg: 5,
    source_flight_name: "M211",
    track_codes: ["JT777", "JT778"],
    confirmed_at: "2026-10-11T10:00:00Z",
  }),
  pkg({ id: 3, client_code: "AB300", weight_kg: null, track_codes: ["YT900"] }),
];

describe("filterPackages", () => {
  it("searches client codes and track codes in one box, ignoring case", () => {
    expect(filterPackages(packages, { search: "jt77", sort: "recent" }).map((p) => p.id)).toEqual([2]);
    expect(filterPackages(packages, { search: "ss", sort: "client_asc" }).map((p) => p.id)).toEqual([1, 2]);
  });

  it("filters by status and source flight", () => {
    expect(filterPackages(packages, { status: "expected", sort: "recent" })).toHaveLength(2);
    expect(filterPackages(packages, { sourceFlight: "m211", sort: "recent" }).map((p) => p.id)).toEqual([2]);
  });

  it("sorts like the server: newest activity first, unknown weight last", () => {
    expect(filterPackages(packages, { sort: "recent" }).map((p) => p.id)).toEqual([2, 3, 1]);
    expect(filterPackages(packages, { sort: "weight_desc" }).map((p) => p.id)).toEqual([2, 1, 3]);
    expect(filterPackages(packages, { sort: "client_desc" }).map((p) => p.id)).toEqual([2, 1, 3]);
  });
});

describe("totalsOf", () => {
  it("counts and weighs each status and lists the source flights", () => {
    expect(totalsOf(packages)).toEqual({
      counts: { all: 3, expected: 2, confirmed: 1 },
      weights: { expected: 2, confirmed: 5 },
      sourceFlights: ["M210", "M211"],
      sourceCompanies: [],
    });
  });

  it("lists the partner cargos present, ours never among them", () => {
    const mixed = [
      ...packages,
      pkg({ id: 4, source_company: "akb", source_company_name: "AKB" }),
      pkg({ id: 5, source_company: "" }),
    ];
    expect(totalsOf(mixed).sourceCompanies).toEqual(["AKB"]);
  });
});

describe("filterPackages by cargo", () => {
  const mixed = [
    pkg({ id: 1, client_code: "ZZ17", source_flight_name: "M200" }),
    // Saved on the device by a build before partner cargo: ours.
    pkg({ id: 2, client_code: "ZZ18" }),
    pkg({
      id: 3,
      client_code: "ZZ17",
      source_flight_name: "M200",
      source_company: "AKB",
      source_company_name: "AKB",
    }),
  ];
  delete mixed[1].source_company;

  const ids = (sourceCompany?: string) =>
    filterPackages(mixed, { sourceCompany, sort: "client_asc" }).map((p) => p.id);

  it("keeps every cargo when no cargo is chosen", () => {
    expect(ids(undefined)).toEqual([1, 3, 2]);
  });

  it('reads "" as our own cargo, a package with no field included', () => {
    expect(ids("")).toEqual([1, 2]);
  });

  it("keeps only the chosen partner's bags, ignoring case", () => {
    expect(ids("AKB")).toEqual([3]);
    expect(ids("akb")).toEqual([3]);
    expect(ids("XYZ")).toEqual([]);
  });
});
