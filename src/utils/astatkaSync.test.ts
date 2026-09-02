/**
 * The offline queue must never make a worker do a parcel twice.
 *
 * That is the whole requirement, in the owner's words: *"internet muammosi
 * server muammosi yokida boshqa muammolarni deb workerlar qayta va qayta
 * ishlamasligi kerak"*. Every test here is a way that promise could be broken.
 *
 * The store is faked rather than run against a real IndexedDB, because what is
 * under test is the decision-making — when a row is considered done, when it
 * goes back in the queue, what a retry means — and those are the parts that
 * lose data when they are wrong.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QueuedItem } from "./astatkaStore";

const submitAstatkaItems = vi.fn();
const rows = new Map<string, QueuedItem>();

vi.mock("@/api/services/astatka", () => ({
  submitAstatkaItems: (...args: unknown[]) => submitAstatkaItems(...args),
}));

vi.mock("@/utils/astatkaStore", () => ({
  isAvailable: async () => true,
  astatkaStore: {
    async pending(astatkaId: number) {
      return [...rows.values()]
        .filter((row) => row.astatkaId === astatkaId && row.status !== "saved")
        .sort((a, b) => a.scannedAt - b.scannedAt);
    },
    async countPending(astatkaId: number) {
      return (await this.pending(astatkaId)).length;
    },
    async update(id: string, patch: Partial<QueuedItem>) {
      const existing = rows.get(id);
      if (existing) rows.set(id, { ...existing, ...patch });
    },
    async pruneSaved() {},
  },
}));

const { backoffFor, syncAstatka } = await import("./astatkaSync");

function queued(id: string, overrides: Partial<QueuedItem> = {}): QueuedItem {
  return {
    id,
    astatkaId: 1,
    status: "pending",
    trackCode: `TRK${id}`,
    clientCode: "M1001",
    sourceFlightName: "M267",
    weightKg: "12.4",
    pricePerKg: "5",
    comment: null,
    scanStatus: "matched",
    sourceFlightCargoId: null,
    photos: [],
    localPhotoIds: [],
    enteredManually: false,
    scannedAt: 1_700_000_000_000,
    attempts: 0,
    lastError: null,
    ...overrides,
  };
}

describe("draining the queue", () => {
  beforeEach(() => {
    rows.clear();
    submitAstatkaItems.mockReset();
  });

  it("marks rows saved only after the server confirms", async () => {
    rows.set("a", queued("a"));
    submitAstatkaItems.mockResolvedValue({
      accepted: 1,
      duplicates: 0,
      items: [],
    });

    const outcome = await syncAstatka(1);

    expect(outcome.sent).toBe(1);
    expect(outcome.drained).toBe(true);
    expect(rows.get("a")!.status).toBe("saved");
  });

  it("keeps a failed row queued instead of dropping it", async () => {
    // The single most important assertion in this file. A parcel that failed to
    // send is a parcel to send again — never one to forget.
    rows.set("a", queued("a"));
    submitAstatkaItems.mockRejectedValue(new Error("network down"));

    const outcome = await syncAstatka(1);

    expect(outcome.failed).toBe(1);
    expect(outcome.drained).toBe(false);
    expect(rows.get("a")).toBeDefined();
    expect(rows.get("a")!.status).toBe("pending");
  });

  it("counts the attempt so the next try waits longer", async () => {
    rows.set("a", queued("a", { attempts: 2 }));
    submitAstatkaItems.mockRejectedValue(new Error("502"));

    await syncAstatka(1);

    expect(rows.get("a")!.attempts).toBe(3);
    expect(rows.get("a")!.lastError).toBe("502");
  });

  it("treats a retry answered entirely with duplicates as success", async () => {
    // This is how the phone learns its earlier attempt did land. Reading it as
    // a failure would leave the rows queued forever, resending the same parcels
    // on every pass.
    rows.set("a", queued("a"));
    submitAstatkaItems.mockResolvedValue({
      accepted: 0,
      duplicates: 1,
      items: [],
    });

    const outcome = await syncAstatka(1);

    expect(outcome.duplicates).toBe(1);
    expect(outcome.failed).toBe(0);
    expect(rows.get("a")!.status).toBe("saved");
  });

  it("sends the idempotency key, which is what makes a retry safe", async () => {
    rows.set("a", queued("a"));
    submitAstatkaItems.mockResolvedValue({
      accepted: 1,
      duplicates: 0,
      items: [],
    });

    await syncAstatka(1);

    const [, payload] = submitAstatkaItems.mock.calls[0];
    expect(payload[0].idempotency_key).toBe("a");
  });

  it("sends when the parcel was scanned, not when it was uploaded", async () => {
    // A queue that sat offline overnight reaches the server hours late. The
    // stock-take is a record of when parcels were on the shelf.
    rows.set("a", queued("a", { scannedAt: 1_700_000_000_000 }));
    submitAstatkaItems.mockResolvedValue({
      accepted: 1,
      duplicates: 0,
      items: [],
    });

    await syncAstatka(1);

    const [, payload] = submitAstatkaItems.mock.calls[0];
    expect(payload[0].scanned_at).toBe(
      new Date(1_700_000_000_000).toISOString(),
    );
  });

  it("stops after a failing batch rather than burning through the rest", async () => {
    for (let i = 0; i < 250; i += 1) rows.set(`k${i}`, queued(`k${i}`));
    submitAstatkaItems.mockRejectedValue(new Error("down"));

    await syncAstatka(1);

    // One attempt, not three. Later batches would fail the same way, and
    // hammering them only inflates every row's attempt count.
    expect(submitAstatkaItems).toHaveBeenCalledTimes(1);
  });

  it("does nothing, successfully, when there is nothing owed", async () => {
    const outcome = await syncAstatka(1);

    expect(outcome.drained).toBe(true);
    expect(submitAstatkaItems).not.toHaveBeenCalled();
  });

  it("picks up rows left mid-flight by a dead tab", async () => {
    // `recoverStuck` resets these to pending on load; this asserts the sync
    // itself does not skip them, since `pending` deliberately means
    // "not yet saved" rather than "status === pending".
    rows.set("a", queued("a", { status: "saving" }));
    submitAstatkaItems.mockResolvedValue({
      accepted: 0,
      duplicates: 1,
      items: [],
    });

    const outcome = await syncAstatka(1);

    expect(outcome.duplicates).toBe(1);
    expect(rows.get("a")!.status).toBe("saved");
  });

  it("leaves other stock-takes alone", async () => {
    rows.set("a", queued("a", { astatkaId: 1 }));
    rows.set("b", queued("b", { astatkaId: 2 }));
    submitAstatkaItems.mockResolvedValue({
      accepted: 1,
      duplicates: 0,
      items: [],
    });

    await syncAstatka(1);

    expect(rows.get("b")!.status).toBe("pending");
  });
});

describe("backoff", () => {
  it("grows with each failure", () => {
    expect(backoffFor(0)).toBeLessThan(backoffFor(1));
    expect(backoffFor(1)).toBeLessThan(backoffFor(3));
  });

  it("stops growing, so a recovered network is noticed within a minute", () => {
    expect(backoffFor(50)).toBe(backoffFor(4));
    expect(backoffFor(50)).toBeLessThanOrEqual(60_000);
  });

  it("is defined for an attempt count past the table", () => {
    expect(Number.isFinite(backoffFor(9999))).toBe(true);
  });
});

describe('a 200 that is not our response', () => {
  beforeEach(() => {
    rows.clear();
    submitAstatkaItems.mockReset();
  });

  it('does not mark parcels saved on a body that is not ours', async () => {
    // Found by a real browser probe: a stub answering 200 with `{}` made the
    // queue mark every parcel saved. A captive portal or a proxy error page
    // does exactly that, and the result would be worse than a failed send —
    // the parcels would be dropped from the queue having never arrived.
    rows.set('a', queued('a'));
    submitAstatkaItems.mockResolvedValue({});

    const outcome = await syncAstatka(1);

    expect(rows.get('a')!.status).toBe('pending');
    expect(outcome.failed).toBe(1);
    expect(outcome.sent).toBe(0);
  });

  it('does not mark parcels saved on an HTML error page', async () => {
    rows.set('a', queued('a'));
    submitAstatkaItems.mockResolvedValue('<html>502 Bad Gateway</html>');

    await syncAstatka(1);

    expect(rows.get('a')!.status).toBe('pending');
  });

  it('still accepts a well-formed response', async () => {
    rows.set('a', queued('a'));
    submitAstatkaItems.mockResolvedValue({ accepted: 1, duplicates: 0, items: [] });

    await syncAstatka(1);

    expect(rows.get('a')!.status).toBe('saved');
  });
});
