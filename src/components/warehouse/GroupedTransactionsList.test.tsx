import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));

import type { ClientGroup, FlightGroup } from "../../api/services/warehouse";
import GroupedTransactionsList from "./GroupedTransactionsList";

function flight(name: string, astatka: string | null): FlightGroup {
  return {
    flight_name: name,
    total_weight_kg: 4.2,
    total_amount: 0,
    total_remaining_amount: 0,
    flight_cargo_photos: [],
    available_delivery_methods: [],
    delivery_request_id: null,
    delivery_request_type: null,
    delivery_request_status: null,
    transactions: [
      {
        id: name.length,
        qator_raqami: 0,
        vazn: "4.2",
        summa: 0,
        payment_status: "pending",
        remaining_amount: 0,
        is_taken_away: false,
        taken_away_date: null,
        comment: null,
        has_proof: false,
        available_delivery_methods: [],
        delivery_request_id: null,
        delivery_request_type: null,
        delivery_request_status: null,
      },
    ],
    astatka_flight_name: astatka,
  };
}

const client: ClientGroup = {
  client_code: "SNMB43",
  full_name: "Otajonova Ruzigul",
  phone: null,
  wallet_balance: 0,
  debt: 0,
  total_unpaid_amount: 0,
  flights: [flight("M286-M287", "OSTATKA-21.10.2026"), flight("M300", null)],
};

describe("GroupedTransactionsList — astatka shelf", () => {
  it("names the astatka beside the flight the bag came on", () => {
    render(
      <GroupedTransactionsList
        items={[client]}
        isLoading={false}
        onMarkTaken={vi.fn()}
        canMarkTaken={false}
      />,
    );
    // Expanded: each flight is headed by its own name, the shelf under it.
    expect(screen.getByRole("heading", { name: "M286-M287" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "M300" })).toBeInTheDocument();
    const shelf = screen.getByText("OSTATKA-21.10.2026");
    expect(shelf.closest("p")?.textContent).toBe("Ostatkada:OSTATKA-21.10.2026");
    expect(screen.getAllByText("Ostatkada:")).toHaveLength(1);

    // Collapsed by one tap: the flight chip carries the astatka too.
    fireEvent.click(screen.getByText("SNMB43"));
    expect(screen.queryByText("Ostatkada:")).not.toBeInTheDocument();
    expect(screen.getByText("· OSTATKA-21.10.2026")).toBeInTheDocument();
  });
});
