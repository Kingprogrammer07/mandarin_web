import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("@/api/services/flightSchedule", () => ({
  getFlightsDashboard: vi.fn(),
}));
vi.mock("@/api/services/astatka", () => ({ listAstatka: vi.fn() }));
vi.mock("@/api/services/astatkaFlights", () => ({
  astatkaStatsQueryKey: ["astatka-flight-stats"],
  astatkaPackagesQueryKey: (name: string) => ["astatka-packages", name],
  getAstatkaFlightStats: vi.fn(),
  deleteAstatkaFlight: vi.fn(),
}));
vi.mock("@/api/services/adminManagement", () => ({ getAdminJwtClaims: vi.fn() }));
vi.mock("@/components/astatka/AstatkaExtractDialog", () => ({
  AstatkaExtractDialog: ({ flightName }: { flightName: string }) => (
    <div role="dialog" aria-label={`ajratish ${flightName}`} />
  ),
}));
// The scanner pulls in IndexedDB and the camera; the list never renders it.
vi.mock("@/components/astatka/AstatkaScanner", () => ({ AstatkaScanner: () => null }));
vi.mock("@/components/astatka/AstatkaItemSheet", () => ({ AstatkaItemSheet: () => null }));
vi.mock("@/utils/astatkaStore", () => ({ astatkaStore: {} }));

import { listAstatka, type Astatka } from "@/api/services/astatka";
import { getAdminJwtClaims, type AdminJwtClaims } from "@/api/services/adminManagement";
import { deleteAstatkaFlight, getAstatkaFlightStats } from "@/api/services/astatkaFlights";
import {
  getFlightsDashboard,
  type FlightDashboardItem,
} from "@/api/services/flightSchedule";
import { AstatkaPage } from "./AstatkaPage";

const dashboard = vi.mocked(getFlightsDashboard);
const stockTakes = vi.mocked(listAstatka);
const astatkaStats = vi.mocked(getAstatkaFlightStats);
const deleteAstatka = vi.mocked(deleteAstatkaFlight);
const claims = vi.mocked(getAdminJwtClaims);

function signedInAs(permissions: string[], isSuperAdmin = false): void {
  const value: AdminJwtClaims = {
    permissions: new Set(permissions),
    role_name: isSuperAdmin ? "super-admin" : "admin",
    role_names: [isSuperAdmin ? "super-admin" : "admin"],
    home_page: null,
    isSuperAdmin,
    admin_id: 1,
  };
  claims.mockReturnValue(value);
}
const onOpenAstatka = vi.fn();
const onSendAstatka = vi.fn();

function flight(name: string, isVisible: boolean): FlightDashboardItem {
  return {
    name,
    type: "ostatka",
    status: "new",
    source: "expected_cargo",
    is_new: true,
    last_activity_at: null,
    is_visible: isVisible,
    sort_order: null,
    stats: {
      cargo_count: 0,
      client_count: 0,
      total_weight_kg: 0,
      remaining_cargos: 0,
      remaining_clients: 0,
      remaining_weight_kg: 0,
      expected_clients: 3,
      expected_track_codes: 7,
    },
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AstatkaPage
        embedded
        onBack={() => undefined}
        onOpenAstatka={onOpenAstatka}
        onSendAstatka={onSendAstatka}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  stockTakes.mockResolvedValue([]);
  astatkaStats.mockResolvedValue([]);
  signedInAs([]);
});

describe("AstatkaPage", () => {
  it("lists every O flight whatever the board's visibility switch says", async () => {
    dashboard.mockResolvedValue({
      items: [
        flight("OSTATKA-11.10", true),
        flight("OSTATKA-04.10", false),
        // Older leftover naming: typed ostatka by the API, but not an O flight.
        flight("A-OSTATKA-29.07", true),
      ],
      total: 3,
      page: 1,
      per_page: 100,
      total_pages: 1,
    });
    renderPage();

    expect(await screen.findByText("OSTATKA-11.10")).toBeTruthy();
    expect(screen.getByText("OSTATKA-04.10")).toBeTruthy();
    expect(screen.queryByText("A-OSTATKA-29.07")).toBeNull();
    expect(screen.getByText("Ko‘rinmoqda")).toBeTruthy();
    expect(screen.getByText("Yashirin")).toBeTruthy();

    // Not limited to the switched-on flights.
    expect(dashboard).toHaveBeenCalledWith(
      expect.not.objectContaining({ visible_only: true }),
    );
    expect(dashboard).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ostatka", status: "all" }),
    );
  });

  it("opens the window from the card and offers extract and send beside it", async () => {
    dashboard.mockResolvedValue({
      items: [flight("OSTATKA.202", true)],
      total: 1,
      page: 1,
      per_page: 100,
      total_pages: 1,
    });
    astatkaStats.mockResolvedValue([
      {
        astatka_flight_name: "OSTATKA.202",
        expected: 4,
        confirmed: 9,
        expected_weight_kg: 12.5,
        confirmed_weight_kg: 30,
        source_flights: ["M210"],
        last_confirmed_at: null,
      },
    ]);
    renderPage();

    fireEvent.click(await screen.findByText("OSTATKA.202"));
    expect(onOpenAstatka).toHaveBeenCalledWith("OSTATKA.202");

    expect(await screen.findByText(/4 ta kutilmoqda/)).toBeTruthy();
    expect(screen.getByText(/9 ta tasdiqlandi/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Yuborish/ }));
    expect(onSendAstatka).toHaveBeenCalledWith("OSTATKA.202");

    fireEvent.click(screen.getByRole("button", { name: /Astatka ajratish/ }));
    expect(screen.getByRole("dialog", { name: "ajratish OSTATKA.202" })).toBeTruthy();
  });

  it("no longer offers to create an astatka", async () => {
    dashboard.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      per_page: 100,
      total_pages: 1,
    });
    renderPage();

    expect(await screen.findByText("Hali astatka reysi yo‘q")).toBeTruthy();
    expect(screen.queryByText(/Yangi astatka/)).toBeNull();
  });

  it("keeps stock-takes recorded before reachable", async () => {
    dashboard.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      per_page: 100,
      total_pages: 1,
    });
    const legacy: Astatka = {
      id: 1,
      name: "OSTATKA-05.08",
      flight_names: ["M262-M263"],
      note: null,
      closed_at: null,
      created_at: "2026-08-05T10:00:00Z",
      created_by_username: "worker",
      counts: { matched: 4 },
    };
    stockTakes.mockResolvedValue([legacy]);
    renderPage();

    expect(await screen.findByText("Oldingi astatka hisoblari")).toBeTruthy();
    expect(screen.getByRole("button", { name: /OSTATKA-05\.08/ })).toBeTruthy();
  });

  it("offers delete only to an admin who may delete flights", async () => {
    dashboard.mockResolvedValue({
      items: [flight("OSTATKA.202", true)],
      total: 1,
      page: 1,
      per_page: 100,
      total_pages: 1,
    });
    signedInAs(["flights:read", "flights:update"]);
    const { unmount } = renderPage();
    expect(await screen.findByText("OSTATKA.202")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Astatkani o‘chirish" })).toBeNull();
    unmount();

    signedInAs(["flights:delete"]);
    renderPage();
    expect(await screen.findByRole("button", { name: "Astatkani o‘chirish" })).toBeTruthy();
  });

  it("deletes an astatka only after its name is typed again", async () => {
    dashboard.mockResolvedValue({
      items: [flight("OSTATKA.202", true)],
      total: 1,
      page: 1,
      per_page: 100,
      total_pages: 1,
    });
    astatkaStats.mockResolvedValue([
      {
        astatka_flight_name: "OSTATKA.202",
        expected: 4,
        confirmed: 9,
        expected_weight_kg: 12.5,
        confirmed_weight_kg: 30,
        source_flights: ["M210"],
        last_confirmed_at: null,
        sent: 3,
      },
    ]);
    deleteAstatka.mockResolvedValue({
      flight_name: "OSTATKA.202",
      deleted_packages: 13,
      confirmed: 9,
      sent: 3,
    });
    signedInAs([], true);
    renderPage();

    await screen.findByText(/9 ta tasdiqlandi/);
    fireEvent.click(screen.getByRole("button", { name: "Astatkani o‘chirish" }));
    const dialog = await screen.findByRole("dialog", { name: "Astatkani o'chirish" });
    expect(dialog.textContent).toContain("3 ta yuk haqida mijozlarga xabar yuborilgan");

    const submit = screen.getByRole("button", { name: "O'chirish" }) as HTMLButtonElement;
    const field = screen.getByLabelText(/Tasdiqlash uchun astatka nomini yozing/);
    fireEvent.change(field, { target: { value: "OSTATKA.20" } });
    expect(submit.disabled).toBe(true);

    // Case and spaces do not matter; the name does.
    fireEvent.change(field, { target: { value: " ostatka.202 " } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() =>
      expect(deleteAstatka).toHaveBeenCalledWith("OSTATKA.202", "ostatka.202"),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Astatkani o'chirish" })).toBeNull(),
    );
  });
});
