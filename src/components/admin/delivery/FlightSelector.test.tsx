import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DeliveryFlightState } from "@/api/services/adminDeliveryService";
import FlightSelector, { FLIGHTS_PAGE_SIZE } from "./FlightSelector";

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

  it("pages the flights still in the warehouse", () => {
    const flights = Array.from({ length: FLIGHTS_PAGE_SIZE + 2 }, (_, index) =>
      makeFlight({ flight: `M${300 + index}`, active_requests: [] }),
    );
    renderSelector({ flights });

    expect(screen.getByRole("button", { name: "M300" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `M${300 + FLIGHTS_PAGE_SIZE}` })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Keyingi sahifa" }));
    expect(screen.getByRole("button", { name: `M${300 + FLIGHTS_PAGE_SIZE}` })).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 2/)).toBeInTheDocument();
  });

  it("folds collected flights away until opened", () => {
    const flights = [
      makeFlight({ flight: "M301", active_requests: [] }),
      makeFlight({ flight: "M290", is_taken_away: true, taken_count: 2, active_requests: [] }),
    ];
    renderSelector({ flights, selectedFlights: ["M290"] });

    expect(screen.queryByRole("button", { name: "M290" })).toBeNull();
    const toggle = screen.getByRole("button", { name: /Olib ketilganlar \(1\)/ });
    expect(toggle).toHaveTextContent("1 ta tanlangan");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "M290" })).toHaveAttribute("aria-pressed", "true");
  });

  it("searches and filters, and selects all of what the filter shows", () => {
    const flights = [
      makeFlight({ flight: "M301", payment_status: "paid", active_requests: [] }),
      makeFlight({ flight: "M302", active_requests: [] }),
      ...Array.from({ length: 6 }, (_, index) =>
        makeFlight({ flight: `A${index}`, active_requests: [] }),
      ),
    ];
    const { onSelectAll } = renderSelector({ flights });

    fireEvent.change(screen.getByPlaceholderText(/Reys nomi/), { target: { value: "m30" } });
    expect(screen.queryByRole("button", { name: "A0" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Qarzdor" }));
    expect(screen.queryByRole("button", { name: "M301" })).toBeNull();
    expect(screen.getByRole("button", { name: "M302" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Barchasini tanlash" }));
    expect(onSelectAll).toHaveBeenCalledWith(["M302"]);
  });
});
