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

export async function downloadAstatkaCleanupExcel(
  flightName: string,
  runId: number,
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`${base(flightName)}/cleanups/${runId}/export`, {
    responseType: "blob",
  });
  return data;
}
