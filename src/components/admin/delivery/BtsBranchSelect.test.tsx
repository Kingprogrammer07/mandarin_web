/**
 * The BTS office picker leads with the offices of the district the client's
 * code was issued for, as the UzPost picker does (owner, 2026-10-30).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BtsBranch } from "@/hooks/useBtsBranches";

function office(code: string, name: string, district: string): BtsBranch {
  return {
    id: Number(code),
    index: code,
    name,
    address: `${district}, ko'cha 1`,
    latitude: 41.3,
    longitude: 69.2,
    workdays: null,
    lunch: null,
    saturday: null,
    dayOff: null,
    otherScheduleNotes: null,
    region: "Toshkent shahri",
    district,
    landmark: null,
  };
}

const offices = [
  office("0101", "YAKKASAROY", "Yakkasaroy tumani"),
  office("0122", "CHILONZOR", "Chilonzor tumani"),
  office("0114", "OQTEPA", "Chilonzor tumani"),
];

vi.mock("@/hooks/useBtsBranches", () => ({
  useBtsBranches: () => ({ data: offices, isLoading: false, isError: false, refetch: vi.fn() }),
}));

const getBtsBranchSuggestions = vi.fn();
vi.mock("@/api/services/adminDeliveryService", () => ({
  getBtsBranchSuggestions: (code: string) => getBtsBranchSuggestions(code),
}));

import BtsBranchSelect from "./BtsBranchSelect";

function renderSelect(clientCode: string | null, onChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BtsBranchSelect selected={null} onChange={onChange} clientCode={clientCode} />
    </QueryClientProvider>,
  );
  return onChange;
}

describe("BtsBranchSelect", () => {
  it("suggests the offices of the code's district first", async () => {
    getBtsBranchSuggestions.mockResolvedValue({
      client_code: "STCH3",
      district: "Chilonzor",
      match_level: "district",
      codes: ["0114", "0122"],
    });
    const onChange = renderSelect("STCH3");

    expect(await screen.findByText("Mijoz kodiga ko'ra — Chilonzor")).toBeInTheDocument();
    expect(getBtsBranchSuggestions).toHaveBeenCalledWith("STCH3");
    // Each suggested office shows once above the full list, which keeps all three.
    expect(screen.getAllByText(/· OQTEPA$/)).toHaveLength(2);
    expect(screen.getAllByText(/· YAKKASAROY$/)).toHaveLength(1);

    fireEvent.click(screen.getAllByText(/· OQTEPA$/)[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ index: "0114" }));
  });

  it("hides the suggestions while the manager searches", async () => {
    getBtsBranchSuggestions.mockResolvedValue({
      client_code: "STCH3",
      district: "Chilonzor",
      match_level: "district",
      codes: ["0114"],
    });
    renderSelect("STCH3");
    await screen.findByText("Mijoz kodiga ko'ra — Chilonzor");

    fireEvent.change(screen.getByLabelText("BTS filialini qidirish"), {
      target: { value: "yakka" },
    });
    expect(screen.queryByText("Mijoz kodiga ko'ra — Chilonzor")).toBeNull();
  });
});
