import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DeliveryFlightState } from "@/api/services/adminDeliveryService";
import FlightSelector from "./FlightSelector";

function makeFlight(overrides: Partial<DeliveryFlightState> = {}): DeliveryFlightState {
  return {
    flight: "M250",
    cargo_count: 2,
    total_amount: 100000,
    paid_amount: 50000,
    payment_status: "partial",
    is_taken_away: false,
    taken_count: 1,
    rows: [
      {
        id: 2,
        qator_raqami: 1,
        vazn: "2.5",
        total_amount: 50000,
        paid_amount: 50000,
        remaining_amount: 0,
        payment_status: "paid",
        is_taken_away: true,
      },
      {
        id: 3,
        qator_raqami: 2,
        vazn: "1,5",
        total_amount: 50000,
        paid_amount: 0,
        remaining_amount: 50000,
        payment_status: "pending",
        is_taken_away: false,
      },
    ],
    active_requests: [
      {
        id: 11,
        status: "approved",
        delivery_type: "uzpost",
        created_via: "admin",
        recipient_name: "Vali Aliyev",
        phone: "+998935551122",
      },
    ],
    ...overrides,
  };
}

function renderSelector(props: Partial<Parameters<typeof FlightSelector>[0]> = {}) {
  const handlers = { onToggleFlight: vi.fn(), onSelectAll: vi.fn() };
  const view = render(
    <FlightSelector flights={[makeFlight()]} selectedFlights={[]} {...handlers} {...props} />,
  );
  return { ...handlers, ...view };
}

describe("FlightSelector", () => {
  it("shows the flight's weight, debt and collection from its rows", () => {
    renderSelector();
    const card = screen.getByRole("button", { name: /M250/ });

    expect(within(card).getByText("4.00 kg")).toBeInTheDocument();
    expect(within(card).getByText(/qarz/)).toBeInTheDocument();
    expect(within(card).getByText(/1\/2/)).toBeInTheDocument();
  });

  it("shows the requests already on their way for the flight", () => {
    renderSelector();
    const card = screen.getByRole("button", { name: /M250/ });

    expect(within(card).getByText("#11")).toBeInTheDocument();
    expect(within(card).getByText("UzPost")).toBeInTheDocument();
    expect(within(card).getByText(/Tasdiqlangan/)).toBeInTheDocument();
    expect(within(card).getByText(/Vali Aliyev/)).toBeInTheDocument();
  });

  it("shows no request line for a flight nobody has filed for", () => {
    renderSelector({ flights: [makeFlight({ active_requests: [] })] });

    expect(screen.queryByText(/^#\d+$/)).toBeNull();
  });

  it("toggles a flight and reports whether it is selected", () => {
    const { onToggleFlight, rerender, onSelectAll } = renderSelector();

    const card = screen.getByRole("button", { name: /M250/ });
    expect(card).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(card);
    expect(onToggleFlight).toHaveBeenCalledWith("M250");

    rerender(
      <FlightSelector
        flights={[makeFlight()]}
        selectedFlights={["M250"]}
        onToggleFlight={onToggleFlight}
        onSelectAll={onSelectAll}
      />,
    );
    expect(screen.getByRole("button", { name: /M250/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Barchasini bekor qilish" })).toBeInTheDocument();
  });
});
