import { apiClient } from "../client";

/**
 * "Reyslarni tozalash" — `/astatka-flights/{name}/cleanup`.
 *
 * Once an astatka has been scanned shelf by shelf, a bag of one of its source
 * flights that is neither marked taken away nor in any astatka left the
 * warehouse without a proof. The cleanup marks those bags taken away and
 * changes nothing else: no amount, no proof, no message. Mirrors
 * `src/api/schemas/astatka_cleanup.py`; every call needs flights:delete.
 */

export type CleanupSkipReason = "no_payment_row" | "receipt_pending" | "in_delivery";
export type CleanupPayment = "paid" | "partial" | "pending";

export interface CleanupFlight {
  flight_name: string;
  /** First photo-report row of the flight. */
  arrived_at: string | null;
  /** Arrived shortly before the astatka started: probably still handed out. */
  recent: boolean;
  bags: number;
  taken: number;
  on_shelf: number;
  to_clean: number;
  skipped: number;
  unpaid_bags: number;
  unpaid_amount: number;
}

export interface CleanupBag {
  flight_name: string;
  client_code: string;
  client_name: string | null;
  weight_kg: number | null;
  payment: CleanupPayment | null;
  /** Stays a debt in the kassa after the cleanup. */
  debt: number;
  reason: CleanupSkipReason | null;
}

export interface CleanupPreview {
  astatka_flight_name: string;
  started_at: string | null;
  recent_days: number;
  flights: CleanupFlight[];
  bags: CleanupBag[];
  skipped: CleanupBag[];
}

/**
 * Why a bag of a run keeps its debt when the run's debt is closed:
 * handed out or changed since, a receipt waiting, in a queue or delivery, or
 * a credit on the same flight that closing the debt would make spendable.
 */
export type WriteOffSkipReason = "changed" | "receipt_pending" | "in_delivery" | "flight_credit";

export interface WriteOffPlan {
  bags: number;
  transactions: number;
  amount: number;
  skipped: { flight_name: string; client_code: string; debt: number; reason: WriteOffSkipReason }[];
}

/** One closing of a run's debt; `undone_at` set once it was brought back. */
export interface CleanupWriteOff {
  id: number;
  created_at: string | null;
  admin_username: string | null;
  bags: number;
  transactions: number;
  amount: number;
  skipped: number;
  undone_at: string | null;
  undone_by_username: string | null;
  reverted: number | null;
  kept: number | null;
}

export interface CleanupRun {
  id: number;
  astatka_flight_name: string;
  source_flights: string[];
  bags: number;
  transactions: number;
  unpaid_bags: number;
  unpaid_amount: number;
  admin_username: string | null;
  created_at: string | null;
  undone_at: string | null;
  undone_by_username: string | null;
  reverted: number | null;
  kept: number | null;
  /** The latest write-off of this run's debt, undone ones included. */
  write_off?: CleanupWriteOff | null;
}

export interface CleanupApplyResult {
  run: CleanupRun;
  changed_meanwhile: number;
}

const base = (flightName: string) =>
  `/api/v1/astatka-flights/${encodeURIComponent(flightName)}`;

export const astatkaCleanupQueryKey = (flightName: string) =>
  ["astatka-cleanup", flightName.trim().toUpperCase()] as const;

export async function getAstatkaCleanupPreview(flightName: string): Promise<CleanupPreview> {
  const { data } = await apiClient.get<CleanupPreview>(`${base(flightName)}/cleanup`);
  return data;
}

/** `confirmName` is the astatka's name typed again; the server compares it. */
export async function cleanAstatkaFlights(
  flightName: string,
  flights: string[],
  confirmName: string,
): Promise<CleanupApplyResult> {
  const { data } = await apiClient.post<CleanupApplyResult>(`${base(flightName)}/cleanup`, {
    flights,
    confirm: confirmName,
  });
  return data;
}

export async function getAstatkaCleanupRuns(flightName: string): Promise<CleanupRun[]> {
  const { data } = await apiClient.get<{ items: CleanupRun[] }>(`${base(flightName)}/cleanups`);
  return data.items;
}

export async function undoAstatkaCleanup(flightName: string, runId: number): Promise<CleanupRun> {
  const { data } = await apiClient.post<CleanupRun>(
    `${base(flightName)}/cleanups/${runId}/undo`,
  );
  return data;
}

/** What closing the run's debt would do; writes nothing. */
export async function getAstatkaWriteOffPlan(flightName: string, runId: number): Promise<WriteOffPlan> {
  const { data } = await apiClient.get<WriteOffPlan>(
    `${base(flightName)}/cleanups/${runId}/write-off`,
  );
  return data;
}

/**
 * Close the debt of the bags the run marked taken: the kassa and the client's
 * balance stop showing it. `confirmName` is the astatka's name typed again.
 */
export async function writeOffAstatkaCleanupDebt(
  flightName: string,
  runId: number,
  confirmName: string,
): Promise<CleanupRun> {
  const { data } = await apiClient.post<CleanupRun>(
    `${base(flightName)}/cleanups/${runId}/write-off`,
    { confirm: confirmName },
  );
  return data;
}

export async function undoAstatkaWriteOff(flightName: string, runId: number): Promise<CleanupRun> {
  const { data } = await apiClient.post<CleanupRun>(
    `${base(flightName)}/cleanups/${runId}/write-off/undo`,
  );
  return data;
}

export async function downloadAstatkaCleanupExcel(
  flightName: string,
  runId: number,
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`${base(flightName)}/cleanups/${runId}/export`, {
    responseType: "blob",
  });
  return data;
}

/** Inventory Excel: each source-flight bag on the shelf, taken, or found nowhere. */
export async function downloadAstatkaInventoryReport(flightName: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`${base(flightName)}/cleanup/report`, {
    responseType: "blob",
  });
  return data;
}
