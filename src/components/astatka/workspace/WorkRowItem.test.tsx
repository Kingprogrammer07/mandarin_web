import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AstatkaPackage } from "@/api/services/astatkaFlights";
import type { WorkRow, WorkRowState } from "@/lib/astatkaWorkQueue";

import { WorkRowItem } from "./WorkRowItem";

const pkg: AstatkaPackage = {
  id: 7,
  astatka_flight_name: "OSTATKA.202",
  client_code: "SS101",
  client_name: null,
  source_flight_name: "M262",
  track_codes: ["YT1"],
  track_count: 1,
  weight_kg: 4.5,
  weight_edited: false,
  bags: 1,
  has_photo: true,
  status: "confirmed",
  origin: "scan",
  comment: null,
  taken_away: false,
  payment_state: null,
  already_in_astatka: null,
  scanned_at: null,
  confirmed_at: "2026-10-12T05:00:00Z",
  confirmed_by: "Vali",
  created_at: null,
};

function row(state: WorkRowState): WorkRow {
  return {
    id: "r1",
    trackCode: "YT1",
    scannedCodes: ["YT1"],
    firstScanAt: "2026-10-12T05:00:00Z",
    lastScanAt: "2026-10-12T05:00:00Z",
    state,
    kind: "in_astatka",
    message: "",
    pkg,
    edits: {},
    confirmKey: null,
    warnings: [],
    fromIndex: false,
    origin: "scan",
    otherAstatka: null,
  };
}

function renderRow(state: WorkRowState | WorkRow, isOnline = true) {
  const handlers = {
    onOpen: vi.fn(),
    onConfirm: vi.fn(),
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onRecheck: vi.fn(),
  };
  const item = typeof state === "string" ? row(state) : state;
  render(
    <ul>
      <WorkRowItem row={item} highlighted={false} isOnline={isOnline} {...handlers} />
    </ul>,
  );
  // The row renders a wide and a phone layout; CSS shows one of them.
  const removeButtons = screen.getAllByRole("button", {
    name: "Ekrandan olib tashlash",
  });
  return { handlers, item, removeButtons };
}

describe("WorkRowItem's remove button", () => {
  it("takes a confirmed row off the screen", () => {
    const { handlers, item, removeButtons } = renderRow("confirmed");

    removeButtons.forEach((button) => expect(button).toBeEnabled());
    fireEvent.click(removeButtons[0]);

    expect(handlers.onRemove).toHaveBeenCalledWith(item);
    // The button does its own thing, it does not also open the bag window.
    expect(handlers.onOpen).not.toHaveBeenCalled();
  });

  it.each<WorkRowState>(["ready", "not_found", "failed"])(
    "works on a %s row",
    (state) => {
      const { removeButtons } = renderRow(state);
      removeButtons.forEach((button) => expect(button).toBeEnabled());
    },
  );

  it.each<WorkRowState>(["saving", "queued"])(
    "stays locked while a %s row's work has not reached the server",
    (state) => {
      const { handlers, removeButtons } = renderRow(state);
      removeButtons.forEach((button) => expect(button).toBeDisabled());
      fireEvent.click(removeButtons[0]);
      expect(handlers.onRemove).not.toHaveBeenCalled();
    },
  );
});

describe("WorkRowItem's Qayta tekshirish", () => {
  it.each<WorkRowState>(["not_found", "failed"])(
    "asks the server again about a %s row's code",
    (state) => {
      const { handlers, item } = renderRow({
        ...row(state),
        pkg: null,
        message: "AKB bilan aloqa bo'lmadi. Keyinroq qayta tekshiring.",
      });

      fireEvent.click(screen.getByRole("button", { name: "Qayta tekshirish" }));

      expect(handlers.onRecheck).toHaveBeenCalledWith(item);
      expect(handlers.onOpen).not.toHaveBeenCalled();
    },
  );

  it("waits for the internet", () => {
    const { handlers } = renderRow({ ...row("not_found"), pkg: null }, false);
    const button = screen.getByRole("button", { name: "Qayta tekshirish" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handlers.onRecheck).not.toHaveBeenCalled();
  });

  it.each<WorkRowState>(["ready", "confirmed", "queued", "waiting_net"])(
    "is not offered on a %s row",
    (state) => {
      renderRow(state);
      expect(screen.queryByRole("button", { name: "Qayta tekshirish" })).toBeNull();
    },
  );
});

describe("WorkRowItem — a partner cargo's bag", () => {
  it("carries the partner's API chip beside the client code in both layouts", () => {
    renderRow({
      ...row("ready"),
      kind: "new",
      pkg: {
        ...pkg,
        id: null,
        status: null,
        client_code: "ZZ17",
        source_company: "AKB",
        source_company_name: "AKB",
      },
    });
    expect(screen.getAllByText("AKB · API")).toHaveLength(2);
    // The chip is part of what the client button says.
    expect(
      screen.getAllByRole("button", { name: /^ZZ17\s*AKB API'dan topildi/ }),
    ).toHaveLength(2);
  });

  it("carries no chip on our own cargo", () => {
    renderRow("ready");
    expect(screen.queryByText(/· API/)).toBeNull();
  });
});
