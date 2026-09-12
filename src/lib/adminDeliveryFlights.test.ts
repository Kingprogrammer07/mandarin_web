import { describe, expect, it } from "vitest";
import type {
  DeliveryFlightRow,
  DeliveryFlightState,
} from "@/api/services/adminDeliveryService";
import {
  flightDebt,
  flightWeightKg,
  hasUnpaidRows,
  parseWeightKg,
} from "./adminDeliveryFlights";

function row(overrides: Partial<DeliveryFlightRow> = {}): DeliveryFlightRow {
  return {
    id: 1,
    qator_raqami: 0,
    vazn: "2.5",
    total_amount: 50000,
    paid_amount: 50000,
    remaining_amount: 0,
    payment_status: "paid",
    is_taken_away: false,
    ...overrides,
  };
}

function flight(name: string, rows: DeliveryFlightRow[]): DeliveryFlightState {
  return {
    flight: name,
    cargo_count: rows.length,
    total_amount: 0,
    paid_amount: 0,
    payment_status: "paid",
    is_taken_away: false,
    taken_count: 0,
    rows,
    active_requests: [],
  };
}

describe("parseWeightKg", () => {
  it("reads decimal points and decimal commas", () => {
    expect(parseWeightKg("2.5")).toBe(2.5);
    expect(parseWeightKg("1,25")).toBe(1.25);
    expect(parseWeightKg(" 3 ")).toBe(3);
  });

  it("treats a missing or unreadable weight as unknown rather than zero", () => {
    expect(parseWeightKg(null)).toBeNull();
    expect(parseWeightKg("")).toBeNull();
    expect(parseWeightKg("   ")).toBeNull();
    expect(parseWeightKg("abc")).toBeNull();
    expect(parseWeightKg("-1")).toBeNull();
  });
});

describe("flightWeightKg", () => {
  it("adds up the readable weights only", () => {
    const rows = [
      row({ vazn: "2.5" }),
      row({ vazn: "1,5" }),
      row({ vazn: "abc" }),
      row({ vazn: null }),
    ];
    expect(flightWeightKg(rows)).toBe(4);
  });
});

describe("flightDebt", () => {
  it("does not let an overpaid row cancel another row's debt", () => {
    const rows = [
      row({ remaining_amount: 1000 }),
      row({ remaining_amount: -500 }),
      row({ remaining_amount: 250 }),
    ];
    expect(flightDebt(rows)).toBe(1250);
  });
});

describe("hasUnpaidRows", () => {
  const paid = flight("M249", [row()]);
  const partlyPaid = flight("M250", [row(), row({ id: 2, payment_status: "partial" })]);

  it("looks only at the chosen flights", () => {
    expect(hasUnpaidRows([paid, partlyPaid], ["M249"])).toBe(false);
    expect(hasUnpaidRows([paid, partlyPaid], ["M250"])).toBe(true);
    expect(hasUnpaidRows([paid, partlyPaid], [])).toBe(false);
  });
});
