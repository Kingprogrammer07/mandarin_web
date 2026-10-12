import type { SendTaskState } from "@/api/services/flightNotifications";

// Polling cadence for bulk-send progress. The previous 1.5 s value generated
// 200 requests per 5-minute task per watching admin. 5 s is still well below
// human perception of "live" progress and slashes per-task traffic ~70%.
export const POLL_INTERVAL_MS = 5000;

// One dropped poll is a network blip; three in a row (15 s of silence) means
// the progress shown is stale and the operator has to be told.
export const MAX_POLL_FAILURES = 3;

// Written to localStorage the instant "Send" is pressed, before the start
// request resolves. If the page reloads in that window, mount recovery sees the
// placeholder and asks the server for the running task instead of losing it.
export const PENDING_PLACEHOLDER = "pending";

export const activeTaskKey = (flightName: string): string =>
  `cargo_send_task:${flightName}`;

export function isTaskFinished(status: string): boolean {
  return status === "completed" || status === "failed";
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} soniya`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest > 0 ? `${minutes} daq ${rest} son` : `${minutes} daqiqa`;
}

export interface SendProgress {
  processed: number;
  /** 0–100, safe to draw as a bar width. */
  percent: number;
  isDone: boolean;
  /** Finished as "failed" before every client was processed — the operator stopped it. */
  wasCancelled: boolean;
  etaText: string | null;
}

export function sendProgress(task: SendTaskState, now: number): SendProgress {
  const isDone = isTaskFinished(task.status);
  const processed = task.sent + task.failed + task.skipped;
  const elapsedSec = (now - new Date(task.started_at).getTime()) / 1000;
  const rate = elapsedSec > 0 && processed > 0 ? processed / elapsedSec : 0;
  const etaSec = rate > 0 ? (task.total - processed) / rate : null;
  return {
    processed,
    percent: Math.min(100, Math.max(0, task.percent)),
    isDone,
    wasCancelled: task.status === "failed" && processed < task.total,
    etaText:
      !isDone && etaSec !== null && etaSec > 1
        ? `~${formatDuration(etaSec)} qoldi`
        : null,
  };
}

/** The optimistic state shown between "start accepted" and the first poll. */
export function initialTaskState(
  taskId: string,
  total: number,
  startedAt: string,
): SendTaskState {
  return {
    task_id: taskId,
    status: "running",
    total,
    sent: 0,
    failed: 0,
    skipped: 0,
    percent: 0,
    errors: [],
    started_at: startedAt,
    finished_at: null,
  };
}

/** The API client rejects with `{ message, status }`; anything else gets the fallback. */
export function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}
