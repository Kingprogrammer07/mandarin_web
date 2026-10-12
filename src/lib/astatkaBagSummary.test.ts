import { describe, expect, it } from "vitest";

import type { AstatkaPackage } from "@/api/services/astatkaFlights";
import type { WorkRow } from "@/lib/astatkaWorkQueue";

import { summaryFromPackage, summaryFromRow } from "./astatkaBagSummary";

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
