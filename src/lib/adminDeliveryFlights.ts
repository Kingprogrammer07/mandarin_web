/**
 * Figures the manager page shows for a client's flights, computed from the rows
 * the context endpoint returns.
 */

import type {
  DeliveryFlightRow,
  DeliveryFlightState,
} from "@/api/services/adminDeliveryService";

/**
 * A row's weight in kilograms, or null when the ledger holds no usable number.
 *
 * The ledger stores weight as text, sometimes with a decimal comma. An empty or
 * unreadable value is unknown, not zero, so it is left out of totals rather than
 * shown as "0.00 kg".
 */
export function parseWeightKg(vazn: string | null): number | null {
  const text = vazn?.trim();
  if (!text) return null;
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Sum of the readable row weights of a flight, in kilograms. */
export function flightWeightKg(rows: DeliveryFlightRow[]): number {
  return rows.reduce((sum, row) => sum + (parseWeightKg(row.vazn) ?? 0), 0);
}

/** What is still owed on a flight. Overpaid rows do not offset other rows' debt. */
export function flightDebt(rows: DeliveryFlightRow[]): number {
  return rows.reduce((sum, row) => sum + Math.max(row.remaining_amount, 0), 0);
}

/** Whether any row of the chosen flights is not fully paid. */
export function hasUnpaidRows(
  flights: DeliveryFlightState[],
  chosenFlightNames: string[],
): boolean {
  const chosen = new Set(chosenFlightNames);
  return flights.some(
    (flight) =>
      chosen.has(flight.flight) &&
      flight.rows.some((row) => row.payment_status !== "paid"),
  );
}
