import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/services/astatkaFlights", () => ({
  confirmAstatkaPackages: vi.fn(),
  getAstatkaIndex: vi.fn(),
  scanAstatkaTrackCode: vi.fn(),
}));
vi.mock("@/utils/astatkaWorkspaceDb", () => ({
  astatkaWorkspaceDb: {
    loadQueue: vi.fn(),
    loadIndex: vi.fn(),
    saveQueue: vi.fn(),
    saveIndex: vi.fn(),
    addBackup: vi.fn(),
  },
}));
vi.mock("@/utils/expectedCargoSoundManager", () => ({
  initializeExpectedCargoSounds: vi.fn(() => Promise.resolve()),
  playExpectedCargoSound: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/utils/haptics", () => ({
  triggerSoftHaptic: vi.fn(),
  triggerSuccessHaptic: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), message: vi.fn() },
}));

import {
  confirmAstatkaPackages,
  getAstatkaIndex,
  scanAstatkaTrackCode,
  type AstatkaExternalBag,
  type AstatkaPackage,
  type AstatkaScanResult,
} from "@/api/services/astatkaFlights";
import type { WorkRow, WorkRowState } from "@/lib/astatkaWorkQueue";
import { astatkaWorkspaceDb } from "@/utils/astatkaWorkspaceDb";

import { useAstatkaWorkQueue } from "./useAstatkaWorkQueue";

const scan = vi.mocked(scanAstatkaTrackCode);

const m200: AstatkaExternalBag = {
  flight_name: "M200",
  weight_kg: 12.5,
  price_per_kg: 8,
  rows: 2,
  photo_count: 3,
  comment: null,
  is_sent: false,
  created_at: null,
  updated_at: null,
};

const partnerAnswer: AstatkaScanResult = {
  kind: "new",
  track_code: "AK001",
  package: {
    id: null,
    astatka_flight_name: "OSTATKA.202",
    client_code: "ZZ17",
    client_name: null,
    source_flight_name: "M200",
    track_codes: ["AK001"],
    track_count: 1,
    weight_kg: 12.5,
    weight_edited: false,
    bags: 2,
    has_photo: true,
    status: null,
    origin: null,
    comment: null,
    taken_away: false,
    payment_state: null,
    already_in_astatka: null,
    scanned_at: null,
    confirmed_at: null,
    confirmed_by: null,
    created_at: null,
    source_company: "AKB",
    source_company_name: "AKB",
    external: m200,
  },
  other_astatka_flight: null,
  message: "AKB tizimida topildi. Tekshirib, tasdiqlang.",
  external_options: [m200],
  external_flight_known: true,
};

function storedRow(state: WorkRowState): WorkRow {
  return {
    id: "r1",
    trackCode: "AK001",
    scannedCodes: ["AK001"],
    firstScanAt: "2026-10-12T05:00:00Z",
    lastScanAt: "2026-10-12T05:00:00Z",
    state,
    kind: "not_found",
    message: "AKB bilan aloqa bo'lmadi. Keyinroq qayta tekshiring.",
    pkg: null,
    edits: {},
    confirmKey: state === "queued" ? "key-1" : null,
    warnings: [],
    fromIndex: false,
    origin: "scan",
    otherAstatka: null,
  };
}

async function renderQueue(
  rows: WorkRow[],
  autoConfirm = false,
  onConfirmed?: (rowId: string, pkg: AstatkaPackage) => void,
) {
  vi.mocked(astatkaWorkspaceDb.loadQueue).mockResolvedValue(rows);
  const hook = renderHook(() =>
    useAstatkaWorkQueue({
      flightName: "OSTATKA.202",
      autoConfirm,
      onPackagesChanged: vi.fn(),
      onConfirmed,
    }),
  );
  await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(astatkaWorkspaceDb.loadIndex).mockResolvedValue(null);
  vi.mocked(getAstatkaIndex).mockResolvedValue({
    astatka_flight_name: "OSTATKA.202",
    packages: [],
    candidates: [],
    synced_at: new Date().toISOString(),
  });
});

describe("useAstatkaWorkQueue — recheckRow", () => {
  it("asks the server again about a code it could not find, through 'checking'", async () => {
    let answer!: (result: AstatkaScanResult) => void;
    scan.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { result } = await renderQueue([storedRow("not_found")]);

    act(() => {
      void result.current.recheckRow("r1");
    });

    expect(result.current.rows[0].state).toBe("checking");
    expect(scan).toHaveBeenCalledWith("OSTATKA.202", "AK001");

    await act(async () => answer(partnerAnswer));

    const [row] = result.current.rows;
    expect(row.state).toBe("ready");
    expect(row.pkg?.source_company).toBe("AKB");
    expect(row.externalOptions).toEqual([m200]);
  });

  it("never auto-confirms a partner's bag, it is a new one", async () => {
    scan.mockResolvedValue(partnerAnswer);
    const { result } = await renderQueue([storedRow("failed")], true);

    await act(() => result.current.recheckRow("r1"));

    expect(result.current.rows[0].state).toBe("ready");
    expect(confirmAstatkaPackages).not.toHaveBeenCalled();
  });

  // A stored "queued" row goes out as soon as the window opens online, and
  // stays "saving" here: the confirm never answers in this test.
  it.each<[WorkRowState, WorkRowState]>([
    ["queued", "saving"],
    ["ready", "ready"],
    ["confirmed", "confirmed"],
  ])("leaves a %s row alone", async (stored, expected) => {
    vi.mocked(confirmAstatkaPackages).mockReturnValue(new Promise(() => {}));
    const { result } = await renderQueue([storedRow(stored)]);
    await waitFor(() => expect(result.current.rows[0].state).toBe(expected));

    await act(() => result.current.recheckRow("r1"));

    expect(scan).not.toHaveBeenCalled();
    expect(result.current.rows[0].state).toBe(expected);
  });
});

describe("useAstatkaWorkQueue — updateEdits", () => {
  it("makes an unknown code confirmable once a client is typed", async () => {
    const { result } = await renderQueue([storedRow("not_found")]);

    act(() => result.current.updateEdits("r1", { clientCode: "SS9" }));

    expect(result.current.rows[0].state).toBe("ready");
    expect(result.current.rows[0].message).toBe("Qo'lda kiritildi. Tasdiqlang.");
  });

  it("leaves a code a partner cargo may own waiting for a re-check", async () => {
    const unsure: WorkRow = { ...storedRow("not_found"), partnerState: "unavailable" };
    const { result } = await renderQueue([unsure]);

    act(() => result.current.updateEdits("r1", { clientCode: "SS9" }));

    expect(result.current.rows[0].state).toBe("not_found");
    expect(result.current.rows[0].message).toBe(unsure.message);
  });
});

describe("useAstatkaWorkQueue — back online", () => {
  it("sends pressed confirms in the order they were pressed, before asking about waiting codes", async () => {
    const calls: string[] = [];
    vi.mocked(confirmAstatkaPackages).mockImplementation(async (_flight, items) => {
      calls.push(`confirm ${items.map((item) => item.idempotency_key).join(",")}`);
      return [];
    });
    scan.mockImplementation(async (_flight, code) => {
      calls.push(`scan ${code}`);
      return { ...partnerAnswer, kind: "not_found", track_code: code, package: null, external_options: [] };
    });
    // The list fixed by hand was pressed first; the code found later was
    // pressed after it and must land last, or the fixed list would drop it.
    const fixed: WorkRow = {
      ...storedRow("queued"),
      id: "fixed",
      confirmKey: "key-fixed",
      edits: { clientCode: "SS100", trackCodes: ["XA2"] },
      firstScanAt: "2026-10-12T05:00:00Z",
      pressedAt: "2026-10-12T05:01:00Z",
    };
    const found: WorkRow = {
      ...storedRow("queued"),
      id: "found",
      trackCode: "XA3",
      scannedCodes: ["XA3"],
      confirmKey: "key-found",
      edits: { clientCode: "SS100" },
      firstScanAt: "2026-10-12T05:02:00Z",
      lastScanAt: "2026-10-12T05:02:00Z",
      pressedAt: "2026-10-12T05:03:00Z",
    };
    const waiting: WorkRow = {
      ...storedRow("waiting_net"),
      id: "waiting",
      trackCode: "XA9",
      scannedCodes: ["XA9"],
      firstScanAt: "2026-10-12T04:00:00Z",
    };
    await renderQueue([found, waiting, fixed]);
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls).toEqual(["confirm key-fixed,key-found", "scan XA9"]);
  });
});

describe("useAstatkaWorkQueue — scanning while queued confirms go out", () => {
  it("asks the server once about a code scanned during the send", async () => {
    let finishConfirm!: () => void;
    vi.mocked(confirmAstatkaPackages).mockReturnValue(
      new Promise((resolve) => {
        finishConfirm = () => resolve([]);
      }),
    );
    const answers: ((result: AstatkaScanResult) => void)[] = [];
    scan.mockImplementation(
      () =>
        new Promise((resolve) => {
          answers.push(resolve);
        }),
    );
    const { result } = await renderQueue([{ ...storedRow("queued"), id: "queued" }]);
    await waitFor(() => expect(confirmAstatkaPackages).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.scan("AK777");
    });
    await waitFor(() => expect(scan).toHaveBeenCalledTimes(1));
    await act(async () => finishConfirm());
    await act(async () => answers[0]({ ...partnerAnswer, track_code: "AK777" }));

    expect(scan).toHaveBeenCalledTimes(1);
    const row = result.current.rows.find((r) => r.trackCode === "AK777")!;
    expect(row.state).toBe("ready");
  });
});

describe("useAstatkaWorkQueue — onConfirmed", () => {
  const ours: AstatkaPackage = {
    ...partnerAnswer.package!,
    id: 55,
    source_company: undefined,
    source_company_name: null,
    external: null,
    status: "confirmed",
  };

  it.each([
    ["confirmed", true],
    ["already_confirmed", true],
    ["conflict", false],
  ] as const)("reports a %s answer: %s", async (outcome, reported) => {
    vi.mocked(confirmAstatkaPackages).mockImplementation(async (_flight, items) =>
      items.map((item) => ({
        idempotency_key: item.idempotency_key,
        outcome,
        package: ours,
        message: "",
        warnings: [],
      })),
    );
    const onConfirmed = vi.fn();
    const ready: WorkRow = { ...storedRow("ready"), edits: { clientCode: "SS9" } };
    const { result } = await renderQueue([ready], false, onConfirmed);

    await act(() => result.current.confirmRows(["r1"]));

    if (reported) expect(onConfirmed).toHaveBeenCalledWith("r1", ours);
    else expect(onConfirmed).not.toHaveBeenCalled();
  });
});
