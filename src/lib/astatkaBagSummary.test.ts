import { describe, expect, it } from "vitest";

import type { AstatkaPackage } from "@/api/services/astatkaFlights";
import type { WorkRow } from "@/lib/astatkaWorkQueue";

import {
  astatkaSentLabel,
  isSentFromAstatka,
  summaryFromPackage,
  summaryFromRow,
} from "./astatkaBagSummary";

function pkg(overrides: Partial<AstatkaPackage> = {}): AstatkaPackage {
  return {
    id: 7,
    astatka_flight_name: "OSTATKA.202",
    client_code: "SS101",
    client_name: "Ali",
    source_flight_name: "M262",
    track_codes: ["YT1", "YT2"],
    track_count: 2,
    weight_kg: 4.5,
    weight_edited: false,
    bags: 2,
    has_photo: true,
    status: "expected",
    origin: "auto",
    comment: null,
    taken_away: false,
    payment_state: "paid",
    already_in_astatka: null,
    scanned_at: null,
    confirmed_at: null,
    confirmed_by: null,
    created_at: "2026-10-01T05:00:00Z",
    ...overrides,
  };
}

function row(overrides: Partial<WorkRow> = {}): WorkRow {
  return {
    id: "r1",
    trackCode: "YT1",
    scannedCodes: ["YT1"],
    firstScanAt: "2026-10-12T05:00:00Z",
    lastScanAt: "2026-10-12T05:01:00Z",
    state: "ready",
    kind: "in_astatka",
    message: "Ro'yxatda bor. Tekshirib, tasdiqlang.",
    pkg: pkg(),
    edits: {},
    confirmKey: null,
    warnings: [],
    fromIndex: false,
    origin: "scan",
    otherAstatka: null,
    ...overrides,
  };
}

describe("summaryFromPackage", () => {
  it("reads a waiting bag", () => {
    const summary = summaryFromPackage(pkg());
    expect(summary.statusLabel).toBe("Kutilmoqda");
    expect(summary.statusTone).toBe("warn");
    expect(summary.photoReport).toBe("Bor · 2 ta");
    expect(summary.payment).toBe("To'langan");
    expect(summary.timeIso).toBe("2026-10-01T05:00:00Z");
  });

  it("reads a confirmed bag's confirmation", () => {
    const summary = summaryFromPackage(
      pkg({ status: "confirmed", confirmed_by: "Vali", confirmed_at: "2026-10-02T05:00:00Z" }),
    );
    expect(summary.statusLabel).toBe("Tasdiqlangan");
    expect(summary.statusTone).toBe("success");
    expect(summary.confirmedBy).toBe("Vali");
    expect(summary.timeIso).toBe("2026-10-02T05:00:00Z");
  });
});

describe("summaryFromRow", () => {
  it("prefers what the worker typed over the saved facts", () => {
    const summary = summaryFromRow(
      row({ edits: { clientCode: "SS202", weightKg: 9, comment: "Yirtilgan" } }),
    );
    expect(summary.clientCode).toBe("SS202");
    expect(summary.clientName).toBeNull();
    expect(summary.weightKg).toBe(9);
    expect(summary.weightEdited).toBe(true);
    expect(summary.comment).toBe("Yirtilgan");
    expect(summary.statusTone).toBe("brand");
    expect(summary.notes).toEqual([]);
  });

  it("explains a stuck row and knows nothing yet about an unknown bag", () => {
    const summary = summaryFromRow(
      row({ state: "not_found", pkg: null, message: "Topilmadi", warnings: ["Diqqat"] }),
    );
    expect(summary.statusLabel).toBe("Topilmadi");
    expect(summary.statusTone).toBe("danger");
    expect(summary.photoReport).toBeNull();
    expect(summary.trackCodes).toEqual(["YT1"]);
    expect(summary.notes).toEqual(["Topilmadi", "Diqqat"]);
  });
});

describe("a partner cargo's bag", () => {
  const partnerPkg = pkg({
    id: null,
    client_code: "ZZ17",
    client_name: null,
    source_flight_name: "M200",
    bags: 2,
    has_photo: true,
    payment_state: null,
    status: null,
    source_company: "AKB",
    source_company_name: "AKB Cargo",
    external: {
      flight_name: "M200",
      weight_kg: 12.5,
      price_per_kg: 8,
      rows: 2,
      photo_count: 3,
      comment: null,
      is_sent: false,
      created_at: null,
      updated_at: null,
    },
  });

  it("names the partner; ours names none, also when the field is missing", () => {
    expect(summaryFromPackage(partnerPkg)).toMatchObject({
      sourceCompany: "AKB",
      sourceCompanyName: "AKB Cargo",
    });
    const older = pkg();
    delete older.source_company;
    expect(summaryFromPackage(older)).toMatchObject({ sourceCompany: "", sourceCompanyName: "" });
  });

  it("describes the flight the worker picked, not the one proposed", () => {
    const summary = summaryFromRow(
      row({
        kind: "new",
        pkg: partnerPkg,
        edits: { sourceFlight: "M199" },
        externalOptions: [
          partnerPkg.external!,
          { ...partnerPkg.external!, flight_name: "M199", weight_kg: 7, rows: 1, photo_count: 0 },
        ],
      }),
    );
    expect(summary).toMatchObject({
      sourceFlight: "M199",
      weightKg: 7,
      photoReport: "Yo'q",
      sourceCompany: "AKB",
    });
  });
});

describe("the astatka's own send", () => {
  it("is unknown for a bag saved on the device before the markers existed", () => {
    expect(isSentFromAstatka(pkg())).toBe(false);
    expect(astatkaSentLabel(pkg())).toBeNull();
    expect(summaryFromPackage(pkg()).astatkaSent).toBeNull();
  });

  it("counts either channel and lists each on its own line", () => {
    const web = pkg({ sent_at: null, sent_web_at: "2026-10-16T09:31:00Z" });
    expect(isSentFromAstatka(web)).toBe(true);
    expect(astatkaSentLabel(web)).toMatch(/^Sayt · /);

    const both = pkg({ sent_at: "2026-10-16T09:30:00Z", sent_web_at: "2026-10-16T09:31:00Z" });
    const lines = astatkaSentLabel(both)?.split("\n") ?? [];
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Bot · /);
    expect(lines[1]).toMatch(/^Sayt · /);
    expect(summaryFromPackage(both).astatkaSent).toBe(astatkaSentLabel(both));
  });
});
