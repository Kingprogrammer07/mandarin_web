import { describe, expect, it } from "vitest";

import type { AstatkaPackage } from "@/api/services/astatkaFlights";

import {
  applyConfirmResult,
  applyScanResult,
  buildConfirmItem,
  canConfirm,
  countByFilter,
  markWaitingForNetwork,
  mergeSameBag,
  normaliseTrackCode,
  parseTrackCodes,
  registerScan,
  resolveFromIndex,
  rowView,
  rowsToCsv,
  type WorkRow,
} from "./astatkaWorkQueue";

function pkg(overrides: Partial<AstatkaPackage> = {}): AstatkaPackage {
  return {
    id: 7,
    astatka_flight_name: "OSTATKA.202",
    client_code: "SS100",
    client_name: "Ali",
    source_flight_name: "M210",
    track_codes: ["YT001", "YT002"],
    track_count: 2,
    weight_kg: 4.2,
    weight_edited: false,
    bags: 1,
    has_photo: true,
    status: "expected",
    origin: "auto",
    comment: null,
    taken_away: false,
    payment_state: "pending",
    already_in_astatka: null,
    scanned_at: null,
    confirmed_at: null,
    confirmed_by: null,
    created_at: null,
    ...overrides,
  };
}

const T0 = "2026-10-11T10:00:00.000Z";
const T1 = "2026-10-11T10:00:05.000Z";
const T2 = "2026-10-11T10:00:09.000Z";

function scannedRow(code = "YT001"): WorkRow {
  return registerScan([], code, T0, "row-1").row;
}

describe("reading codes", () => {
  it("strips what a scanner or a paste adds around a code", () => {
    expect(normaliseTrackCode(" yt001\r\n")).toBe("YT001");
    expect(normaliseTrackCode("yt\t001")).toBe("YT001");
  });

  it("splits pasted text and drops duplicates and noise", () => {
    expect(parseTrackCodes("yt001\nYT002, yt001;  x\n\nYT003")).toEqual([
      "YT001",
      "YT002",
      "YT003",
    ]);
  });
});

describe("one row per bag", () => {
  it("adds a row for a new bag", () => {
    const first = registerScan([], "YT001", T0, "a");
    expect(first.effect).toBe("new");
    expect(first.rows).toHaveLength(1);
    expect(first.row.state).toBe("checking");
  });

  it("lights up the same row for another code of the same bag", () => {
    const row = applyScanResult(scannedRow(), resolveFromIndex({ packages: [pkg()] }, "YT001")!, true);
    const second = registerScan([row], "YT002", T1, "b");
    expect(second.effect).toBe("same_bag");
    expect(second.rows).toHaveLength(1);
    expect(second.row.scannedCodes).toEqual(["YT001", "YT002"]);
    expect(second.row.lastScanAt).toBe(T1);
  });

  it("calls a code scanned twice a repeat, not a new bag", () => {
    const first = registerScan([], "YT001", T0, "a");
    const again = registerScan(first.rows, "YT001", T1, "b");
    expect(again.effect).toBe("repeat");
    expect(again.rows).toHaveLength(1);
  });

  it("keeps the most recently touched bag on top", () => {
    let rows = registerScan([], "A111", T0, "a").rows;
    rows = registerScan(rows, "B222", T1, "b").rows;
    rows = registerScan(rows, "A111", T2, "c").rows;
    expect(rows.map((r) => r.trackCode)).toEqual(["A111", "B222"]);
  });

  it("folds two offline rows into one once both turn out to be one bag", () => {
    let rows = registerScan([], "YT001", T0, "a").rows;
    rows = registerScan(rows, "YT002", T1, "b").rows;
    const answer = { ...resolveFromIndex({ packages: [pkg()] }, "YT001")! };
    rows = rows.map((row) => applyScanResult(row, answer, false));
    const merged = mergeSameBag(rows);
    expect(merged).toHaveLength(1);
    expect(merged[0].scannedCodes.sort()).toEqual(["YT001", "YT002"]);
    expect(merged[0].id).toBe("a");
  });

  it("adds a code scanned after the codes were fixed by hand to the fixed list", () => {
    const answer = { ...resolveFromIndex({ packages: [pkg()] }, "YT001")! };
    let rows = registerScan([], "YT001", T0, "a").rows.map((row) => applyScanResult(row, answer, false));
    rows = rows.map((row) => ({ ...row, edits: { trackCodes: ["YT001", "NEW777"] } }));
    rows = registerScan(rows, "YT002", T1, "b").rows.map((row) =>
      row.id === "b" ? applyScanResult(row, answer, false) : row,
    );
    const [merged] = mergeSameBag(rows);
    expect(merged.edits.trackCodes).toEqual(["YT001", "NEW777", "YT002"]);
    expect(buildConfirmItem(merged, "key-5").track_codes).toEqual(["YT001", "NEW777", "YT002"]);
  });
});

describe("scan answers", () => {
  it("finds a bag in the downloaded list by any of its codes", () => {
    const answer = resolveFromIndex({ packages: [pkg()] }, "YT002");
    expect(answer?.kind).toBe("in_astatka");
    expect(resolveFromIndex({ packages: [pkg()] }, "NOPE")).toBeNull();
  });

  it("knows leftovers and other astatkas' bags from the downloaded base", () => {
    const base = {
      packages: [pkg()],
      candidates: [
        pkg({ id: null, client_code: "SS300", track_codes: ["YT020"], status: null }),
        pkg({
          id: 41,
          client_code: "SS400",
          track_codes: ["YT030"],
          already_in_astatka: "OSTATKA.203",
        }),
        // The same code as this astatka's own bag: this astatka wins.
        pkg({ id: null, client_code: "SS999", track_codes: ["YT001"], status: null }),
      ],
    };
    const leftover = resolveFromIndex(base, "YT020");
    expect(leftover?.kind).toBe("new");
    expect(leftover?.package?.client_code).toBe("SS300");
    expect(leftover?.message).toBe("");
    expect(applyScanResult(scannedRow("YT020"), leftover!, true).state).toBe("ready");

    const elsewhere = resolveFromIndex(base, "YT030");
    expect(elsewhere?.kind).toBe("other_astatka");
    expect(elsewhere?.other_astatka_flight).toBe("OSTATKA.203");
    expect(applyScanResult(scannedRow("YT030"), elsewhere!, true).state).toBe("other_astatka");

    expect(resolveFromIndex(base, "YT001")?.package?.client_code).toBe("SS100");
    expect(resolveFromIndex(base, "UNKNOWN")).toBeNull();
  });

  it("says why a code waits when the base does not know it", () => {
    expect(markWaitingForNetwork(scannedRow(), true).message).toBe(
      "Kompyuterdagi bazada topilmadi. Internet qaytganda qayta tekshiriladi.",
    );
    expect(markWaitingForNetwork(scannedRow(), false).message).toBe(
      "Internet yo'q. Internet qaytganda tekshiriladi.",
    );
  });

  it("maps each answer to what the worker has to do next", () => {
    const row = scannedRow();
    expect(applyScanResult(row, resolveFromIndex({ packages: [pkg()] }, "YT001")!, true).state).toBe(
      "ready",
    );
    expect(
      applyScanResult(row, resolveFromIndex({ packages: [pkg({ status: "confirmed" })] }, "YT001")!, true)
        .state,
    ).toBe("confirmed");
    expect(
      applyScanResult(
        row,
        {
          kind: "other_astatka",
          track_code: "YT001",
          package: null,
          other_astatka_flight: "OSTATKA.201",
          message: "",
        },
        false,
      ).state,
    ).toBe("other_astatka");
  });

  it("never turns a queued confirm back into 'ready'", () => {
    const queued: WorkRow = { ...scannedRow(), state: "queued", confirmKey: "k" };
    const after = applyScanResult(queued, resolveFromIndex({ packages: [pkg()] }, "YT001")!, false);
    expect(after.state).toBe("queued");
  });
});

describe("confirming", () => {
  const ready = applyScanResult(scannedRow(), resolveFromIndex({ packages: [pkg()] }, "YT001")!, true);

  it("is offered once the bag has a client", () => {
    expect(canConfirm(ready)).toBe(true);
    expect(canConfirm(scannedRow())).toBe(false);
    const typed = { ...markWaitingForNetwork(scannedRow(), false), edits: { clientCode: "SS9" } };
    expect(canConfirm(typed)).toBe(true);
  });

  it("sends every code of the bag and only a weight the worker typed", () => {
    const item = buildConfirmItem(ready, "key-123456");
    expect(item).toMatchObject({
      client_code: "SS100",
      source_flight_name: "M210",
      track_code: "YT001",
      track_codes: ["YT001", "YT002"],
      scanned_at: T0,
    });
    expect(item.weight_kg).toBeUndefined();
    const edited = buildConfirmItem({ ...ready, edits: { weightKg: 5.5 } }, "key-2");
    expect(edited.weight_kg).toBe(5.5);
    expect(rowView({ ...ready, edits: { weightKg: 5.5 } }).weightEdited).toBe(true);
  });

  it("marks a hand-corrected code list so the server replaces the bag's codes", () => {
    expect(buildConfirmItem(ready, "key-3").track_codes_edited).toBeUndefined();
    const corrected = buildConfirmItem({ ...ready, edits: { trackCodes: ["NEW777", "NEW888"] } }, "key-4");
    expect(corrected).toMatchObject({ track_codes: ["NEW777", "NEW888"], track_codes_edited: true });
  });

  it("keeps the key for a transient error and drops it for a refusal", () => {
    const sending: WorkRow = { ...ready, state: "saving", confirmKey: "k1" };
    const base = { idempotency_key: "k1", package: null, message: "x", warnings: [] };
    expect(applyConfirmResult(sending, { ...base, outcome: "error" }).confirmKey).toBe("k1");
    expect(applyConfirmResult(sending, { ...base, outcome: "conflict" }).confirmKey).toBeNull();
    const done = applyConfirmResult(sending, {
      ...base,
      outcome: "duplicate",
      package: pkg({ status: "confirmed" }),
    });
    expect(done.state).toBe("confirmed");
  });
});

describe("filters and export", () => {
  it("counts each row under every filter it belongs to", () => {
    const ready = applyScanResult(scannedRow(), resolveFromIndex({ packages: [pkg()] }, "YT001")!, true);
    const taken = applyScanResult(
      registerScan([], "ZZ1", T1, "z").row,
      resolveFromIndex({ packages: [pkg({ id: 8, track_codes: ["ZZ1"], taken_away: true })] }, "ZZ1")!,
      true,
    );
    const counts = countByFilter([ready, taken, markWaitingForNetwork(scannedRow("Q1"), false)]);
    expect(counts).toEqual({
      all: 3,
      to_confirm: 2,
      confirmed: 0,
      waiting: 1,
      problems: 1,
    });
  });

  it("writes a CSV Excel opens as UTF-8", () => {
    const csv = rowsToCsv([scannedRow()]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.split("\n")).toHaveLength(2);
  });
});
