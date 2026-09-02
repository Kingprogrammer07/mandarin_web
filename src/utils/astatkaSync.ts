import {
  submitAstatkaItems,
  type AstatkaItemInput,
  type AstatkaPhoto,
} from "@/api/services/astatka";
import {
  astatkaStore,
  isAvailable,
  type QueuedItem,
} from "@/utils/astatkaStore";

/**
 * Draining the offline queue.
 *
 * The contract this has to keep is one sentence: a worker never does the same
 * parcel twice. Everything below follows from it.
 *
 * - Rows are already on disk before this runs; it only moves them.
 * - A row is never deleted because a request failed — only because the server
 *   said it has it.
 * - Retries are unlimited but slow down, so a dead server is waited out rather
 *   than hammered.
 * - Re-sending is safe: every row carries an idempotency key the server made
 *   unique, so a duplicate is impossible even if the same batch lands twice.
 */

/** How many parcels go in one request. */
const BATCH_SIZE = 100;

/**
 * Backoff between failed attempts, in milliseconds.
 *
 * Climbs to a minute and stays there. Longer would leave a worker staring at a
 * stale "3 unsent" badge long after the network came back; shorter would batter
 * a struggling server with a hundred phones at once.
 */
const BACKOFF_MS = [1_000, 3_000, 10_000, 30_000, 60_000];

export function backoffFor(attempts: number): number {
  return BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
}

export interface SyncOutcome {
  sent: number;
  duplicates: number;
  failed: number;
  /** True when the queue is now empty — the badge can go away. */
  drained: boolean;
  error: string | null;
}

function toInput(item: QueuedItem, uploaded: AstatkaPhoto[]): AstatkaItemInput {
  return {
    idempotency_key: item.id,
    track_code: item.trackCode,
    client_code: item.clientCode,
    source_flight_name: item.sourceFlightName,
    weight_kg: item.weightKg,
    price_per_kg: item.pricePerKg,
    comment: item.comment,
    status: item.scanStatus,
    source_flight_cargo_id: item.sourceFlightCargoId,
    photos: [...item.photos, ...uploaded],
    entered_manually: item.enteredManually,
    // The moment the parcel was in the worker's hand. The server records its own
    // arrival time separately, and for a queue that sat offline overnight the
    // two are hours apart — the stock-take cares about this one.
    scanned_at: new Date(item.scannedAt).toISOString(),
  };
}

/**
 * Send everything owed for one stock-take.
 *
 * Returns rather than throws: the caller is a background loop and a failure
 * here is an expected condition, not an exception. The rows stay queued and the
 * next pass tries again.
 */
export async function syncAstatka(astatkaId: number): Promise<SyncOutcome> {
  const outcome: SyncOutcome = {
    sent: 0,
    duplicates: 0,
    failed: 0,
    drained: false,
    error: null,
  };

  if (!(await isAvailable())) {
    outcome.error = "offline-storage-unavailable";
    return outcome;
  }

  const pending = await astatkaStore.pending(astatkaId);
  if (pending.length === 0) {
    outcome.drained = true;
    return outcome;
  }

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);

    // Marked before the request, so a tab that dies mid-flight leaves a trace.
    // `recoverStuck` turns those back into `pending` on the next load, and the
    // idempotency key makes the re-send harmless.
    await Promise.all(
      batch.map((item) => astatkaStore.update(item.id, { status: "saving" })),
    );

    try {
      const payload = batch.map((item) => toInput(item, []));
      const result = await submitAstatkaItems(astatkaId, payload);

      outcome.sent += result.accepted;
      outcome.duplicates += result.duplicates;

      // Only now, with the server's confirmation in hand, are these rows done.
      await Promise.all(
        batch.map((item) =>
          astatkaStore.update(item.id, {
            status: "saved",
            lastError: null,
          }),
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcome.failed += batch.length;
      outcome.error = message;

      // Back to `pending`, attempt count up. Nothing is discarded: a failed
      // send is a send to try again, never a parcel to forget.
      await Promise.all(
        batch.map((item) =>
          astatkaStore.update(item.id, {
            status: "pending",
            attempts: item.attempts + 1,
            lastError: message,
          }),
        ),
      );

      // Stop the pass. Later batches would almost certainly fail the same way,
      // and burning through them just inflates the attempt counts.
      return outcome;
    }
  }

  outcome.drained = (await astatkaStore.countPending(astatkaId)) === 0;
  if (outcome.drained) {
    await astatkaStore.pruneSaved(astatkaId);
  }
  return outcome;
}

/**
 * Keep a stock-take drained in the background.
 *
 * Wakes on three things: a timer, the browser reporting the network is back,
 * and the tab becoming visible again. The last one matters more than it looks —
 * a phone in a pocket suspends timers, so returning to the app is often the
 * first chance to send anything.
 */
export function startAstatkaSync(
  astatkaId: number,
  onOutcome?: (outcome: SyncOutcome) => void,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  const run = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const outcome = await syncAstatka(astatkaId);
      onOutcome?.(outcome);

      const pending = await astatkaStore.pending(astatkaId);
      const worst = pending.reduce(
        (max, item) => Math.max(max, item.attempts),
        0,
      );
      // Nothing owed → idle poll. Something owed → back off by the worst
      // offender, so one poisonous row cannot spin the loop.
      schedule(pending.length === 0 ? 30_000 : backoffFor(worst));
    } finally {
      running = false;
    }
  };

  const schedule = (delay: number) => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, delay);
  };

  const onOnline = () => schedule(0);
  const onVisible = () => {
    if (document.visibilityState === "visible") schedule(0);
  };

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  void run();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
