import { rowWeightKg } from "@/lib/adminDeliveryFlights";

import type {
  DeliveryFlightRow,
  DeliveryFlightState,
} from "@/api/services/adminDeliveryService";

/** Above this weight the manager is offered an automatic split. */
export const UZPOST_BAG_AUTO_SPLIT_KG = 10;
/** Matches the existing delivery_request_bags database constraint. */
export const UZPOST_BAG_MAX_WEIGHT_KG = 20;
export const WEIGHT_TOLERANCE_KG = 0.01;

/**
 * One physical bag of a UzPost parcel: its place and its weight.
 *
 * A bag is cut from the parcel's total weight, not from a ledger row. Each bag
 * becomes its own UzPost order and receipt, so tying bags to rows turned three
 * small items into three paid parcels.
 */
export interface UzpostBagDraft {
  sequence_no: number;
  weight_kg: number;
}

export function roundKg(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isPerCargoRow(row: DeliveryFlightRow): boolean {
  return (row.qator_raqami ?? 0) !== 0;
}

/**
 * The weight the server will ship for these flights.
 *
 * Mirrors the backend (`load_uzpost_parcel_rows` and `_dedup_total_weight`):
 * only cargo still in the warehouse counts while there is any, every row
 * otherwise (a re-file over collected cargo); within a flight, per-cargo rows
 * win over the flight's `qator_raqami == 0` total so it is not counted twice.
 */
export function uzpostParcelWeightKg(
  flights: DeliveryFlightState[],
  selectedFlightNames: string[],
): number {
  const selected = new Set(selectedFlightNames);
  const chosen = flights.filter((flight) => selected.has(flight.flight));
  const anyInWarehouse = chosen.some((flight) =>
    flight.rows.some((row) => !row.is_taken_away),
  );

  let total = 0;
  for (const flight of chosen) {
    const weighable = anyInWarehouse
      ? flight.rows.filter((row) => !row.is_taken_away)
      : flight.rows;
    const perCargo = weighable.filter(isPerCargoRow);
    const rows = perCargo.length > 0 ? perCargo : weighable;
    total += rows.reduce((sum, row) => sum + (rowWeightKg(row) ?? 0), 0);
  }
  return roundKg(total);
}

/** Whether a parcel is heavy enough to open the bag planner. */
export function needsUzpostBags(parcelKg: number): boolean {
  return roundKg(parcelKg) > UZPOST_BAG_AUTO_SPLIT_KG;
}

/**
 * The recommended number of bags at the automatic 10 kg target, filled evenly.
 *
 * Even, not 10 kg and a remainder: 20.2 kg is three bags of 6.74 kg rather than
 * two at the limit and one of 200 g, and no bag sits right at 10 kg where the
 * post office's scale could put it over.
 */
export function splitUzpostParcel(parcelKg: number): UzpostBagDraft[] {
  const total = roundKg(parcelKg);
  if (!needsUzpostBags(total)) return [];

  const count = Math.ceil(total / UZPOST_BAG_AUTO_SPLIT_KG - 1e-9);
  // Rounded up to 10 g so the last bag, which takes the rest, is never heavier
  // than the others.
  const each = Math.ceil((total / count) * 100 - 1e-6) / 100;
  return Array.from({ length: count }, (_, index) => ({
    sequence_no: index + 1,
    weight_kg: index < count - 1 ? each : roundKg(total - each * (count - 1)),
  }));
}

export function bagsTotalKg(bags: UzpostBagDraft[]): number {
  return roundKg(
    bags.reduce(
      (sum, bag) => sum + (Number.isFinite(bag.weight_kg) ? bag.weight_kg : 0),
      0,
    ),
  );
}

export function validateUzpostBags(
  bags: UzpostBagDraft[],
  parcelKg: number,
): string[] {
  if (bags.length === 0) {
    return ["Qoplar ro'yxati bo'sh. Avto bo'lishni bosing."];
  }

  const errors: string[] = [];
  for (const bag of bags) {
    if (!Number.isFinite(bag.weight_kg) || bag.weight_kg <= 0) {
      errors.push(`${bag.sequence_no}-qop vazni 0 dan katta bo'lishi kerak.`);
    } else if (bag.weight_kg > UZPOST_BAG_MAX_WEIGHT_KG) {
      errors.push(
        `${bag.sequence_no}-qop vazni ${UZPOST_BAG_MAX_WEIGHT_KG} kgdan oshmasligi kerak.`,
      );
    }
  }

  const total = bagsTotalKg(bags);
  if (Math.abs(total - parcelKg) > WEIGHT_TOLERANCE_KG) {
    errors.push(
      `Qoplar yig'indisi ${parcelKg.toFixed(2)} kg bo'lishi kerak, hozir ${total.toFixed(
        2,
      )} kg.`,
    );
  }

  return errors;
}
