import { describe, expect, it } from "vitest";

import type {
  DeliveryFlightRow,
  DeliveryFlightState,
} from "@/api/services/adminDeliveryService";
import {
  needsUzpostBags,
  splitUzpostParcel,
  uzpostParcelWeightKg,
  validateUzpostBags,
} from "./uzpostBagSplit";

function row(
  id: number,
  weight: string,
  { qator = id, taken = false }: { qator?: number; taken?: boolean } = {},
): DeliveryFlightRow {
  return {
    id,
    qator_raqami: qator,
    vazn: weight,
    weight_kg: Number(weight),
    is_weight_source: true,
    total_amount: 0,
    paid_amount: 0,
    remaining_amount: 0,
    payment_status: "paid",
    is_taken_away: taken,
  };
}

function flight(name: string, rows: DeliveryFlightRow[]): DeliveryFlightState {
  return {
    flight: name,
    cargo_count: rows.length,
    total_amount: 0,
    paid_amount: 0,
    payment_status: "paid",
    is_taken_away: rows.every((item) => item.is_taken_away),
    taken_count: rows.filter((item) => item.is_taken_away).length,
    rows,
    active_requests: [],
  };
}

const weights = (parcelKg: number) =>
  splitUzpostParcel(parcelKg).map((bag) => bag.weight_kg);

describe("splitUzpostParcel", () => {
  it("leaves a parcel of 10 kg or less whole", () => {
    expect(splitUzpostParcel(1.9)).toEqual([]);
    expect(splitUzpostParcel(10)).toEqual([]);
    expect(needsUzpostBags(10)).toBe(false);
    expect(needsUzpostBags(10.01)).toBe(true);
  });

  it("uses the fewest bags and fills them evenly", () => {
    expect(weights(15)).toEqual([7.5, 7.5]);
    expect(weights(20)).toEqual([10, 10]);
    expect(weights(25)).toEqual([8.34, 8.34, 8.32]);
    expect(weights(45)).toEqual([9, 9, 9, 9, 9]);
  });

  it("never makes a bag over 10 kg near the limit", () => {
    for (const total of [10.005, 19.999, 20.008, 29.99, 30.001, 60.001]) {
      const bags = weights(total);
      expect(bags.every((weight) => weight > 0 && weight <= 10)).toBe(true);
      expect(validateUzpostBags(splitUzpostParcel(total), total)).toEqual([]);
    }
  });
});

describe("uzpostParcelWeightKg", () => {
  it("weighs only cargo still in the warehouse while there is any", () => {
    const flights = [flight("M1", [row(1, "30", { taken: true }), row(2, "15")])];
    expect(uzpostParcelWeightKg(flights, ["M1"])).toBe(15);
  });

  it("falls back to every row when everything was collected", () => {
    const flights = [flight("M1", [row(1, "30", { taken: true })])];
    expect(uzpostParcelWeightKg(flights, ["M1"])).toBe(30);
  });

  it("does not count a flight's total row on top of its cargo rows", () => {
    const flights = [
      flight("M1", [row(1, "25", { qator: 0 }), row(2, "15"), row(3, "10")]),
      flight("M2", [row(4, "7", { qator: 0 })]),
    ];
    expect(uzpostParcelWeightKg(flights, ["M1", "M2"])).toBe(32);
    expect(uzpostParcelWeightKg(flights, ["M2"])).toBe(7);
  });
});

describe("validateUzpostBags", () => {
  it("asks for the bags to add up to the parcel", () => {
    const errors = validateUzpostBags(
      [
        { sequence_no: 1, weight_kg: 9 },
        { sequence_no: 2, weight_kg: 10 },
      ],
      20,
    );
    expect(errors).toEqual(["Qoplar yig'indisi 20.00 kg bo'lishi kerak, hozir 19.00 kg."]);
  });

  it("flags an empty or overweight bag", () => {
    const errors = validateUzpostBags(
      [
        { sequence_no: 1, weight_kg: Number.NaN },
        { sequence_no: 2, weight_kg: 10.5 },
      ],
      10.5,
    );
    expect(errors).toContain("1-qop vazni 0 dan katta bo'lishi kerak.");
    expect(errors).toContain("2-qop vazni 10 kgdan oshmasligi kerak.");
  });
});
