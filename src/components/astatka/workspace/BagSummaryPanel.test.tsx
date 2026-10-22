import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { BagSummary } from "@/lib/astatkaBagSummary";
import { ownWeightHint } from "@/lib/astatkaBagSummary";

import { BagSummaryPanel } from "./BagSummaryPanel";

const base: BagSummary = {
  statusLabel: "Tasdiqlangan",
  statusTone: "success",
  clientCode: "SS100",
  clientName: null,
  sourceFlight: "M300",
  weightKg: 8,
  weightEdited: true,
  photoReport: "Bor · 2 ta",
  payment: "To'lanmagan",
  takenAway: false,
  confirmedBy: "ishchi",
  timeIso: null,
  comment: null,
  trackCodes: ["YT001"],
  notes: [],
  sourceCompany: "",
  sourceCompanyName: "",
  astatkaSent: null,
  price: null,
  handedOut: null,
};

describe("BagSummaryPanel — price and «Ostatkadan berish»", () => {
  it("shows the first price struck through beside the one the typed weight gave", () => {
    render(
      <BagSummaryPanel
        summary={{
          ...base,
          price: {
            first_weight_kg: 4,
            first_amount: 255000,
            weight_kg: 8,
            amount: 505000,
            changed_at: "2026-10-22T10:00:00Z",
            changed_by: "ishchi",
          },
        }}
      />,
    );
    expect(screen.getByText("Narx (astatka vaznidan)")).toBeInTheDocument();
    expect(screen.getByText(/255\s000 so'm/)).toHaveClass("line-through");
    expect(screen.getByText(/505\s000 so'm/)).toBeInTheDocument();
    expect(screen.getByText("Asl vazn 4 kg")).toBeInTheDocument();
  });

  it("has no price line while nothing was repriced", () => {
    render(<BagSummaryPanel summary={base} />);
    expect(screen.queryByText("Narx (astatka vaznidan)")).not.toBeInTheDocument();
  });

  it("points a bag marked taken to «Ostatkadan berish», and shows when it was given", () => {
    const { rerender } = render(<BagSummaryPanel summary={{ ...base, takenAway: true }} />);
    expect(screen.getByText(/«Ostatkadan berish» bilan beradi/)).toBeInTheDocument();

    rerender(
      <BagSummaryPanel
        summary={{ ...base, takenAway: true, handedOut: "22.10.2026 15:40 · ombor1" }}
      />,
    );
    expect(screen.queryByText(/«Ostatkadan berish» bilan beradi/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Ostatkadan berilgan")).toHaveLength(2); // chip and fact
    expect(screen.getByText("22.10.2026 15:40 · ombor1")).toBeInTheDocument();
  });
});

describe("ownWeightHint", () => {
  it("says the weight reprices the bag on the flight it came on", () => {
    expect(ownWeightHint("M300")).toMatch(/narxi M300 reysida shu vazndan qayta hisoblanadi/);
    expect(ownWeightHint("")).toMatch(/eski reysida/);
  });
});
