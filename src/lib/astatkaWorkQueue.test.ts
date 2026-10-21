import { describe, expect, it, vi } from "vitest";

import type {
  AstatkaExternalBag,
  AstatkaPackage,
  AstatkaScanResult,
} from "@/api/services/astatkaFlights";

import {
  applyConfirmResult,
  applyScanResult,
  buildConfirmItem,
  canConfirm,
  canRecheck,
  countByFilter,
  inPressOrder,
  inScanOrder,
  markWaitingForNetwork,
  mergeSameBag,
  normaliseTrackCode,
  parseTrackCodes,
  registerScan,
  resolveFromIndex,
  rowCodes,
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
    const onFold = vi.fn();
    const merged = mergeSameBag(rows, onFold);
    expect(merged).toHaveLength(1);
    expect(merged[0].scannedCodes.sort()).toEqual(["YT001", "YT002"]);
    expect(merged[0].id).toBe("a");
    // Whatever was kept for the folded row (its photos) follows it.
    expect(onFold).toHaveBeenCalledWith("b", "a");
  });

  it("never folds away a confirm that still has to reach the server", () => {
    const answer = { ...resolveFromIndex({ packages: [pkg()] }, "YT001")! };
    const [ready] = registerScan([], "YT001", T0, "a").rows.map((row) => applyScanResult(row, answer, false));
    const [other] = registerScan([], "YT002", T1, "b").rows.map((row) => applyScanResult(row, answer, false));

    // Pressed offline with the list fixed by hand, a weight and a comment:
    // it goes out exactly as pressed, under its own key.
    const queued: WorkRow = {
      ...other,
      state: "queued",
      confirmKey: "key-q",
      edits: { trackCodes: ["YT002"], weightKg: 9.9, comment: "yirtiq" },
    };
    const pressed = buildConfirmItem(queued, "key-q");
    for (const rows of [[ready, queued], [queued, { ...ready, firstScanAt: T2 }]]) {
      const merged = mergeSameBag(rows);
      expect(merged).toHaveLength(2);
      const kept = merged.find((row) => row.id === "b")!;
      expect(buildConfirmItem(kept, kept.confirmKey!)).toEqual(pressed);
    }

    // Being sent: its answer must find it.
    expect(mergeSameBag([ready, { ...other, state: "saving" }])).toHaveLength(2);
    expect(mergeSameBag([{ ...ready, state: "saving" }, other])).toHaveLength(2);
  });

  it("sends a row that took on more codes under a new key", () => {
    const answer = { ...resolveFromIndex({ packages: [pkg()] }, "YT001")! };
    // A transient error left the key: it may have reached the server, which
    // would answer it again with the bag as first saved.
    const [failed] = registerScan([], "YT001", T0, "a").rows.map((row) => ({
      ...applyScanResult(row, answer, false),
      state: "failed" as const,
      confirmKey: "key-1",
    }));
    const [more] = registerScan([], "NEW9", T1, "b").rows.map((row) =>
      applyScanResult(row, { ...answer, track_code: "NEW9" }, false),
    );
    const [merged] = mergeSameBag([failed, more]);
    expect(merged.scannedCodes).toEqual(["YT001", "NEW9"]);
    expect(merged.confirmKey).toBeNull();

    // A code the key already carried changes nothing.
    const [same] = registerScan([], "YT002", T1, "c").rows.map((row) => applyScanResult(row, answer, false));
    expect(mergeSameBag([failed, same])[0].confirmKey).toBe("key-1");
  });

  it("keeps what was typed on a row off a settled bag until it is sent", () => {
    const answer = { ...resolveFromIndex({ packages: [pkg()] }, "YT001")! };
    const [confirmedRow] = registerScan([], "YT001", T0, "a").rows.map((row) => ({
      ...applyScanResult(row, answer, false),
      state: "confirmed" as const,
      pkg: pkg({ status: "confirmed" }),
    }));
    const [open] = registerScan([], "YT002", T1, "b").rows.map((row) => applyScanResult(row, answer, false));
    expect(mergeSameBag([confirmedRow, open])).toHaveLength(1);
    for (const edits of [{ trackCodes: ["YT002", "NEW9"] }, { weightKg: 3 }, { comment: "yirtiq" }]) {
      const rows = mergeSameBag([confirmedRow, { ...open, edits }]);
      expect(rows).toHaveLength(2);
      expect(canConfirm(rows.find((row) => row.id === "b")!)).toBe(true);
    }
  });

  it("lets a later answer that the bag is confirmed settle an older row", () => {
    const answer = { ...resolveFromIndex({ packages: [pkg()] }, "YT001")! };
    const [older] = registerScan([], "YT001", T0, "a").rows.map((row) => applyScanResult(row, answer, false));
    const [newer] = registerScan([], "YT002", T1, "b").rows.map((row) => ({
      ...applyScanResult(row, answer, false),
      state: "confirmed" as const,
      pkg: pkg({ status: "confirmed" }),
    }));
    const [merged, ...rest] = mergeSameBag([older, newer]);
    expect(rest).toHaveLength(0);
    expect(merged.id).toBe("a");
    expect(merged.state).toBe("confirmed");
    expect(merged.pkg?.status).toBe("confirmed");
    expect(merged.scannedCodes).toEqual(["YT001", "YT002"]);

    // An older row with a code the confirmed bag does not hold stays open.
    const [extra] = registerScan([], "NEW9", T0, "c").rows.map((row) =>
      applyScanResult(row, { ...answer, track_code: "NEW9" }, false),
    );
    expect(mergeSameBag([extra, newer])).toHaveLength(2);
  });

  it("folds two later rows of a bag together while it waits for the earlier one", () => {
    const answer = { ...resolveFromIndex({ packages: [pkg()] }, "YT001")! };
    const [sending] = registerScan([], "YT001", T0, "a").rows.map((row) => ({
      ...applyScanResult(row, answer, false),
      state: "saving" as const,
    }));
    const [first] = registerScan([], "NEW8", T1, "b").rows.map((row) =>
      applyScanResult(row, { ...answer, track_code: "NEW8" }, false),
    );
    const [second] = registerScan([], "NEW9", T2, "c").rows.map((row) =>
      applyScanResult(row, { ...answer, track_code: "NEW9" }, false),
    );
    const rows = mergeSameBag([sending, first, second]);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === "b")!.scannedCodes).toEqual(["NEW8", "NEW9"]);
  });

  it("still sends a code its confirmed bag does not list yet", () => {
    const confirmedBag = pkg({ status: "confirmed" });
    const [confirmedRow] = registerScan([], "YT001", T0, "a").rows.map((row) => ({
      ...applyScanResult(row, { ...resolveFromIndex({ packages: [confirmedBag] }, "YT001")! }, false),
    }));
    expect(confirmedRow.state).toBe("confirmed");
    // A parcel added to the client's flight after the bag was taken: the
    // server names the bag, which does not list the code.
    const [added] = registerScan([], "YT009", T1, "b").rows.map((row) =>
      applyScanResult(
        row,
        {
          kind: "in_astatka",
          track_code: "YT009",
          package: confirmedBag,
          other_astatka_flight: null,
          message: "Bu yuk allaqachon tasdiqlangan.",
        },
        false,
      ),
    );
    expect(added.state).toBe("ready");
    expect(added.message).toContain("yukka qo'shiladi");
    const rows = mergeSameBag([confirmedRow, added]);
    expect(rows).toHaveLength(2);
    const open = rows.find((row) => row.id === "b")!;
    expect(canConfirm(open)).toBe(true);
    expect(buildConfirmItem(open, "key-9").track_codes).toContain("YT009");

    // A list typed while the code waited for the internet says which bag it
    // was written against — none — so the server only adds it to the
    // confirmed bag and never takes the confirmed codes off.
    const addAnswer: AstatkaScanResult = {
      kind: "in_astatka",
      track_code: "YT009",
      package: confirmedBag,
      other_astatka_flight: null,
      message: "Bu yuk allaqachon tasdiqlangan.",
    };
    const waiting = (edits: WorkRow["edits"]): WorkRow => ({
      ...registerScan([], "YT009", T1, "c").row,
      state: "waiting_net",
      edits,
    });
    const typed = applyScanResult(
      waiting({ trackCodes: ["YT009", "YT010"], trackCodesBase: null }),
      addAnswer,
      false,
    );
    expect(typed.state).toBe("ready");
    expect(typed.scannedCodes).toEqual(["YT009"]);
    expect(buildConfirmItem(typed, "key-10")).toMatchObject({
      track_codes: ["YT009", "YT010"],
      track_codes_edited: true,
      track_codes_base_package_id: null,
    });

    // A row typed on an older screen has no base: it is sent as blind too.
    const older = applyScanResult(waiting({ trackCodes: ["YT009"] }), addAnswer, false);
    expect(buildConfirmItem(older, "key-11").track_codes_base_package_id).toBeNull();

    // A list fixed looking at the bag's whole list is written against it.
    const fixedAfter: WorkRow = {
      ...typed,
      edits: { trackCodes: ["YT001", "YT009"], trackCodesBase: confirmedBag.id },
    };
    expect(buildConfirmItem(fixedAfter, "key-12")).toMatchObject({
      track_codes: ["YT001", "YT009"],
      track_codes_edited: true,
      track_codes_base_package_id: confirmedBag.id,
    });

    // Scanned codes alone say nothing about a base.
    expect(buildConfirmItem(open, "key-13").track_codes_base_package_id).toBeUndefined();
  });

  it("lines pressed rows up in the order they were pressed", () => {
    const row = (id: string, firstScanAt: string, pressedAt?: string): WorkRow => ({
      ...registerScan([], id, firstScanAt, id).row,
      pressedAt,
    });
    // An older build left no press time: the scan time stands in for it.
    const rows = [row("late", T0, T2), row("legacy", T1), row("early", T2, T0)];
    expect(inPressOrder(rows).map((r) => r.id)).toEqual(["early", "legacy", "late"]);
  });

  it("sends rows pressed together in the order they were scanned", () => {
    const row = (id: string, firstScanAt: string, pressedAt?: string): WorkRow => ({
      ...registerScan([], id, firstScanAt, id).row,
      pressedAt,
    });
    // The scan list shows the newest scan on top; the server must get the first one first.
    const together = [row("third", T2, T2), row("second", T1, T2), row("first", T0, T2)];
    expect(inPressOrder(together).map((r) => r.id)).toEqual(["first", "second", "third"]);
    expect(inScanOrder(together).map((r) => r.id)).toEqual(["first", "second", "third"]);
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

describe("a partner cargo's bag", () => {
  function external(overrides: Partial<AstatkaExternalBag> = {}): AstatkaExternalBag {
    return {
      flight_name: "M200",
      weight_kg: 12.5,
      price_per_kg: 8,
      rows: 2,
      photo_count: 3,
      comment: null,
      is_sent: false,
      created_at: "2026-10-01T05:00:00Z",
      updated_at: null,
      ...overrides,
    };
  }
  const m200 = external();
  const m199 = external({ flight_name: "M199", weight_kg: 7, rows: 1, photo_count: 0 });

  function partnerAnswer(overrides: Partial<AstatkaScanResult> = {}): AstatkaScanResult {
    return {
      kind: "new",
      track_code: "AK001",
      package: pkg({
        id: null,
        client_code: "ZZ17",
        client_name: null,
        source_flight_name: "M200",
        track_codes: ["AK001"],
        weight_kg: 12.5,
        bags: 2,
        has_photo: true,
        status: null,
        payment_state: null,
        source_company: "AKB",
        source_company_name: "AKB",
        external: m200,
      }),
      other_astatka_flight: null,
      message: "AKB tizimida topildi. Tekshirib, tasdiqlang.",
      external_options: [m200, m199],
      external_flight_known: false,
      ...overrides,
    };
  }

  const partnerRow = applyScanResult(scannedRow("AK001"), partnerAnswer(), false);

  it("keeps the partner's flights on the row, also through an answer without them", () => {
    expect(partnerRow.state).toBe("ready");
    expect(partnerRow.externalOptions).toEqual([m200, m199]);
    expect(partnerRow.externalFlightKnown).toBe(false);

    const fromBase = applyScanResult(
      { ...partnerRow, state: "waiting_net" },
      partnerAnswer({ external_options: [], external_flight_known: undefined }),
      true,
    );
    expect(fromBase.externalOptions).toEqual([m200, m199]);
    expect(fromBase.externalFlightKnown).toBe(false);
  });

  it("forgets the partner's flights once the code turns out to be ours", () => {
    const ours = resolveFromIndex({ packages: [pkg({ track_codes: ["AK001"] })] }, "AK001")!;
    const after = applyScanResult(partnerRow, ours, false);
    expect(after.externalOptions).toBeUndefined();
    expect(rowView(after).sourceCompany).toBe("");
    expect(rowView(after).external).toBeNull();
  });

  it("drops a client or flight typed before the partner answered, keeps a flight from its list", () => {
    const typed: WorkRow = {
      ...markWaitingForNetwork(scannedRow("AK001"), false),
      edits: { clientCode: "SS9", sourceFlight: "X1", comment: "yirtiq" },
    };
    expect(applyScanResult(typed, partnerAnswer(), false).edits).toEqual({ comment: "yirtiq" });

    const picked: WorkRow = { ...partnerRow, state: "failed", edits: { sourceFlight: "M199" } };
    expect(applyScanResult(picked, partnerAnswer(), false).edits).toEqual({ sourceFlight: "M199" });
  });

  it("shows the bag as proposed until another flight is picked", () => {
    const view = rowView(partnerRow);
    expect(view).toMatchObject({
      clientCode: "ZZ17",
      sourceFlight: "M200",
      weightKg: 12.5,
      bags: 2,
      hasPhoto: true,
      sourceCompany: "AKB",
      sourceCompanyName: "AKB",
    });
    expect(view.external).toBe(m200);
  });

  it("follows the picked flight's weight, rows and photos; a typed weight still wins", () => {
    const picked = rowView({ ...partnerRow, edits: { sourceFlight: "M199" } });
    expect(picked).toMatchObject({
      sourceFlight: "M199",
      weightKg: 7,
      weightEdited: false,
      bags: 1,
      hasPhoto: false,
    });
    expect(picked.external).toBe(m199);

    const typed = rowView({ ...partnerRow, edits: { sourceFlight: "M199", weightKg: 9 } });
    expect(typed.weightKg).toBe(9);
    expect(typed.weightEdited).toBe(true);
    expect(typed.external).toBe(m199);
  });

  it("never merges a partner's bag with ours of the same client and flight", () => {
    const oursAnswer = resolveFromIndex(
      {
        packages: [],
        candidates: [
          pkg({ id: null, client_code: "ZZ17", source_flight_name: "M200", track_codes: ["YT500"], status: null }),
        ],
      },
      "YT500",
    )!;
    const ours = applyScanResult(registerScan([], "YT500", T1, "ours").row, oursAnswer, false);
    expect(mergeSameBag([partnerRow, ours])).toHaveLength(2);
  });

  function partnerScan(code: string, at: string, flightKnown: boolean): WorkRow {
    return applyScanResult(
      registerScan([], code, at, code).row,
      partnerAnswer({ track_code: code, external_flight_known: flightKnown }),
      false,
    );
  }

  it("folds two codes into one row only when both are known to be in the same flight", () => {
    // The partner named the flight for both codes: one bag.
    const folded = mergeSameBag([partnerScan("AK001", T0, true), partnerScan("AK002", T1, true)]);
    expect(folded).toHaveLength(1);
    expect(folded[0].scannedCodes).toEqual(["AK001", "AK002"]);

    // The newest flight was only assumed: the client may have a bag in each.
    const assumed = [partnerScan("AK001", T0, false), partnerScan("AK002", T1, false)];
    expect(mergeSameBag(assumed)).toHaveLength(2);

    // The worker read both labels: same flight folds, different flights do not.
    const pick = (row: WorkRow, flight: string): WorkRow => ({ ...row, edits: { sourceFlight: flight } });
    expect(mergeSameBag([pick(assumed[0], "M200"), pick(assumed[1], "M200")])).toHaveLength(1);
    expect(mergeSameBag([pick(assumed[0], "M200"), pick(assumed[1], "M199")])).toHaveLength(2);
  });

  it("sends only the scanned codes once another flight than the proposed one is picked", () => {
    const proposal = partnerAnswer().package!;
    const row = applyScanResult(
      scannedRow("AK001"),
      partnerAnswer({ package: { ...proposal, track_codes: ["AK001", "AK009"] } }),
      false,
    );
    expect(rowCodes(row)).toEqual(["AK001", "AK009"]);

    // AK009 is the proposed M200 bag's code; nothing says it is in M199.
    const picked: WorkRow = { ...row, edits: { sourceFlight: "M199" } };
    expect(rowCodes(picked)).toEqual(["AK001"]);
    expect(buildConfirmItem(picked, "key-ak3").track_codes).toEqual(["AK001"]);
    expect(rowView(picked).trackCount).toBe(1);

    // Picking the proposed flight itself changes nothing.
    expect(rowCodes({ ...row, edits: { sourceFlight: "m200" } })).toEqual(["AK001", "AK009"]);
  });

  it("drops the proposed bag's codes from an edited list once another flight is picked", () => {
    const proposal = partnerAnswer().package!;
    const row = applyScanResult(
      scannedRow("AK001"),
      partnerAnswer({ package: { ...proposal, track_codes: ["AK001", "AK009"] } }),
      false,
    );
    // The worker typed a code into the list, then read M199 on the label.
    const edited: WorkRow = {
      ...row,
      edits: { trackCodes: ["AK001", "AK009", "AK777"], sourceFlight: "M199" },
    };
    expect(rowCodes(edited)).toEqual(["AK001", "AK777"]);
    expect(buildConfirmItem(edited, "key-ak4").track_codes).toEqual(["AK001", "AK777"]);
  });

  it("does not fold two codes of an assumed flight even when its bag is a saved one", () => {
    const saved = (code: string, at: string): WorkRow =>
      applyScanResult(
        registerScan([], code, at, code).row,
        partnerAnswer({
          track_code: code,
          external_flight_known: false,
          package: { ...partnerAnswer().package!, id: 55, track_codes: [code] },
        }),
        false,
      );
    expect(mergeSameBag([saved("AK001", T0), saved("AK002", T1)])).toHaveLength(2);

    // One of them read M199 on its label: that is not the saved M200 bag.
    const picked: WorkRow = { ...saved("AK002", T1), edits: { sourceFlight: "M199" } };
    const known = applyScanResult(
      registerScan([], "AK003", T2, "AK003").row,
      partnerAnswer({
        track_code: "AK003",
        external_flight_known: true,
        package: { ...partnerAnswer().package!, id: 55, track_codes: ["AK003"] },
      }),
      false,
    );
    expect(mergeSameBag([known, picked])).toHaveLength(2);
  });

  it("keeps a code picked into a confirmed bag's flight on its own row until the server has it", () => {
    // QQ6's AKB265 bag is saved and confirmed on screen.
    const saved = partnerAnswer().package!;
    const confirmedRow: WorkRow = {
      ...applyScanResult(
        registerScan([], "AK001", T0, "saved").row,
        partnerAnswer({
          kind: "in_astatka",
          external_flight_known: true,
          package: { ...saved, id: 60, status: "confirmed", source_flight_name: "M199", track_codes: ["AK001"] },
        }),
        false,
      ),
      state: "confirmed",
    };
    // A code the partner did not place: proposed in M200, the label says M199.
    const fresh: WorkRow = {
      ...applyScanResult(
        registerScan([], "AK050", T1, "fresh").row,
        partnerAnswer({ track_code: "AK050", package: { ...saved, track_codes: ["AK050"] } }),
        false,
      ),
      edits: { sourceFlight: "M199" },
    };
    const rows = mergeSameBag([confirmedRow, fresh]);
    expect(rows).toHaveLength(2);
    expect(canConfirm(rows.find((row) => row.id === "fresh")!)).toBe(true);

    // Once the server put AK050 on the saved bag, the two rows are one.
    const answered: WorkRow = {
      ...fresh,
      state: "confirmed",
      pkg: { ...saved, id: 60, status: "confirmed", source_flight_name: "M199", track_codes: ["AK001", "AK050"] },
      edits: {},
    };
    const settled = { ...confirmedRow, pkg: answered.pkg };
    expect(mergeSameBag([settled, answered])).toHaveLength(1);
  });

  it("keeps a bag confirmed from an assumed flight one row with later answers about it", () => {
    const saved = { ...partnerAnswer().package!, id: 60, status: "confirmed" as const };
    const confirmedRow: WorkRow = { ...partnerRow, state: "confirmed", pkg: saved, edits: {} };
    expect(confirmedRow.externalFlightKnown).toBe(false);
    const later = applyScanResult(
      registerScan([], "AK002", T2, "later").row,
      partnerAnswer({
        kind: "in_astatka",
        track_code: "AK002",
        external_options: [],
        external_flight_known: undefined,
        package: { ...saved, track_codes: ["AK001", "AK002"] },
      }),
      false,
    );
    expect(mergeSameBag([confirmedRow, { ...later, state: "confirmed" }])).toHaveLength(1);
  });

  it("folds a code picked into a saved bag's flight into that bag's row", () => {
    // QQ6's AKB bag 60 is saved here, waiting, on M199.
    const saved = { ...partnerAnswer().package!, id: 60, status: "expected" as const, source_flight_name: "M199" };
    const savedRow = applyScanResult(
      registerScan([], "AK001", T0, "saved").row,
      partnerAnswer({
        kind: "in_astatka",
        external_options: [],
        external_flight_known: undefined,
        package: { ...saved, track_codes: ["AK001", "AK002"] },
      }),
      false,
    );
    // The partner did not place AK050; the label says M199.
    const fresh: WorkRow = {
      ...applyScanResult(
        registerScan([], "AK050", T1, "fresh").row,
        partnerAnswer({ track_code: "AK050", package: { ...partnerAnswer().package!, track_codes: ["AK050"] } }),
        false,
      ),
      edits: { sourceFlight: "M199" },
    };
    for (const rows of [[savedRow, fresh], [{ ...fresh, firstScanAt: T0 }, { ...savedRow, firstScanAt: T1 }]]) {
      const merged = mergeSameBag(rows);
      expect(merged).toHaveLength(1);
      const item = buildConfirmItem(merged[0], "key-60");
      expect(item.source_flight_name).toBe("M199");
      expect(item.source_company).toBe("AKB");
      expect(item.track_codes).toEqual(expect.arrayContaining(["AK001", "AK050"]));
    }
  });

  it("never hides a bag confirmed here behind an older answer that it was on another shelf", () => {
    const shelf = { ...partnerAnswer().package!, source_flight_name: "M199", track_codes: ["AK001", "AK050"] };
    const stale: WorkRow = {
      ...applyScanResult(
        registerScan([], "AK001", T0, "stale").row,
        partnerAnswer({
          kind: "other_astatka",
          other_astatka_flight: "OSTATKA.203",
          external_options: [],
          external_flight_known: undefined,
          package: { ...shelf, id: 70, status: "expected", already_in_astatka: "OSTATKA.203" },
        }),
        false,
      ),
    };
    expect(stale.state).toBe("other_astatka");
    const moved: WorkRow = {
      ...applyScanResult(registerScan([], "AK050", T1, "moved").row, partnerAnswer({ track_code: "AK050" }), false),
      state: "confirmed",
      pkg: { ...shelf, id: 81, status: "confirmed" },
      edits: {},
    };
    const rows = mergeSameBag([stale, moved]);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === "moved")!.state).toBe("confirmed");

    // Two answers about the same saved row are still one row.
    expect(mergeSameBag([{ ...stale, state: "confirmed", pkg: moved.pkg }, moved])).toHaveLength(1);
  });

  it("drops a flight picked from the partner's list once the code turns out to be ours", () => {
    const ours = resolveFromIndex({ packages: [pkg({ track_codes: ["AK001"] })] }, "AK001")!;
    const picked: WorkRow = { ...partnerRow, edits: { sourceFlight: "M199", comment: "yirtiq" } };
    const after = applyScanResult(picked, ours, false);
    expect(after.edits).toEqual({ comment: "yirtiq" });
    expect(rowView(after).sourceFlight).toBe("M210");
  });

  it("keeps formula-looking client codes and flight names as text in the CSV", () => {
    const proposal = partnerAnswer().package!;
    const row = applyScanResult(
      scannedRow("AK001"),
      partnerAnswer({
        package: { ...proposal, client_code: '=HYPERLINK("x")', source_flight_name: "+M1" },
      }),
      false,
    );
    const line = rowsToCsv([row]).split("\n")[1];
    expect(line.startsWith(`"'=HYPERLINK(""x"")",'+M1,AKB,`)).toBe(true);
  });

  it("sends whose bag it is and the picked flight, and a weight only when typed", () => {
    const item = buildConfirmItem({ ...partnerRow, edits: { sourceFlight: "M199" } }, "key-ak1");
    expect(item).toMatchObject({
      client_code: "ZZ17",
      source_flight_name: "M199",
      source_company: "AKB",
      track_codes: ["AK001"],
    });
    expect(item.weight_kg).toBeUndefined();

    const typed = buildConfirmItem({ ...partnerRow, edits: { weightKg: 9 } }, "key-ak2");
    expect(typed).toMatchObject({ source_flight_name: "M200", source_company: "AKB", weight_kg: 9 });

    const ours = applyScanResult(scannedRow(), resolveFromIndex({ packages: [pkg()] }, "YT001")!, true);
    expect(buildConfirmItem(ours, "key-ours").source_company).toBe("");
  });

  it("names the cargo of every row in the CSV", () => {
    const ours = applyScanResult(scannedRow(), resolveFromIndex({ packages: [pkg()] }, "YT001")!, true);
    const [header, partnerLine, oursLine] = rowsToCsv([partnerRow, ours]).split("\n");
    expect(header).toContain("Qaysi reysdan,Kargo,");
    expect(partnerLine.startsWith("ZZ17,M200,AKB,")).toBe(true);
    expect(oursLine.startsWith("SS100,M210,Mandarin,")).toBe(true);
  });
});

describe("a code a partner cargo may own", () => {
  function unsureAnswer(state: "unavailable" | "foreign"): AstatkaScanResult {
    return {
      kind: "not_found",
      track_code: "QX1",
      package: null,
      other_astatka_flight: null,
      message: "Tekshirib bo'lmadi.",
      partner_state: state,
    };
  }

  const typedEarly: WorkRow = {
    ...markWaitingForNetwork(scannedRow("QX1"), false),
    edits: { clientCode: "SS9", sourceFlight: "M1", comment: "yirtiq" },
  };

  it("drops a client typed offline and cannot be confirmed by hand", () => {
    for (const state of ["unavailable", "foreign"] as const) {
      const row = applyScanResult(typedEarly, unsureAnswer(state), false);
      expect(row.partnerState).toBe(state);
      expect(row.edits).toEqual({ comment: "yirtiq" });
      expect(canConfirm(row)).toBe(false);
      expect(canConfirm({ ...row, state: "ready", edits: { clientCode: "SS9" } })).toBe(false);
      expect(canRecheck(row)).toBe(true);
    }
  });

  it("still lets a code nobody claims be written by hand", () => {
    const plain = applyScanResult(typedEarly, { ...unsureAnswer("foreign"), partner_state: null }, false);
    expect(plain.partnerState).toBeUndefined();
    expect(plain.edits.clientCode).toBe("SS9");
    expect(canConfirm(plain)).toBe(true);
  });

  it("forgets the doubt once a re-check finds the bag", () => {
    const unsure = applyScanResult(typedEarly, unsureAnswer("unavailable"), false);
    const found = applyScanResult(
      unsure,
      resolveFromIndex({ packages: [pkg({ track_codes: ["QX1"] })] }, "QX1")!,
      false,
    );
    expect(found.partnerState).toBeUndefined();
    expect(canConfirm(found)).toBe(true);
  });
});

describe("Qayta tekshirish", () => {
  it("is offered only for a code the server could not find or answer", () => {
    const row = scannedRow();
    expect(canRecheck({ ...row, state: "not_found" })).toBe(true);
    expect(canRecheck({ ...row, state: "failed" })).toBe(true);
    for (const state of ["checking", "ready", "saving", "queued", "confirmed", "waiting_net", "other_astatka"] as const) {
      expect(canRecheck({ ...row, state })).toBe(false);
    }
  });
});
