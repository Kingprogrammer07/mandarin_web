import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("@/api/services/astatkaCleanup", () => ({
  astatkaCleanupQueryKey: (name: string) => ["astatka-cleanup", name],
  getAstatkaCleanupPreview: vi.fn(),
  getAstatkaCleanupRuns: vi.fn(),
  cleanAstatkaFlights: vi.fn(),
  undoAstatkaCleanup: vi.fn(),
  downloadAstatkaCleanupExcel: vi.fn(),
}));

import {
  cleanAstatkaFlights,
  getAstatkaCleanupPreview,
  getAstatkaCleanupRuns,
  undoAstatkaCleanup,
  type CleanupPreview,
  type CleanupRun,
} from "@/api/services/astatkaCleanup";
import { AstatkaCleanupDialog } from "./AstatkaCleanupDialog";

const previewApi = vi.mocked(getAstatkaCleanupPreview);
const runsApi = vi.mocked(getAstatkaCleanupRuns);
const cleanApi = vi.mocked(cleanAstatkaFlights);
const undoApi = vi.mocked(undoAstatkaCleanup);

const NAME = "OSTATKA-21.10.2026";

const preview: CleanupPreview = {
  astatka_flight_name: NAME,
  started_at: "2026-10-21T05:00:00Z",
  recent_days: 7,
  flights: [
    {
      flight_name: "M300",
      arrived_at: "2026-09-20T05:00:00Z",
      recent: false,
      bags: 40,
      taken: 30,
      on_shelf: 6,
      to_clean: 2,
      skipped: 1,
      unpaid_bags: 1,
      unpaid_amount: 150000,
    },
    {
      flight_name: "M308",
      arrived_at: "2026-10-20T05:00:00Z",
      recent: true,
      bags: 120,
      taken: 10,
      on_shelf: 1,
      to_clean: 1,
      skipped: 0,
      unpaid_bags: 1,
      unpaid_amount: 90000,
    },
    {
      flight_name: "M290",
      arrived_at: "2026-09-01T05:00:00Z",
      recent: false,
      bags: 20,
      taken: 20,
      on_shelf: 0,
      to_clean: 0,
      skipped: 0,
      unpaid_bags: 0,
      unpaid_amount: 0,
    },
  ],
  bags: [
    { flight_name: "M300", client_code: "SS1", client_name: "Ali", weight_kg: 2.5, payment: "pending", debt: 150000, reason: null },
    { flight_name: "M300", client_code: "SS2", client_name: null, weight_kg: 1, payment: "paid", debt: 0, reason: null },
    { flight_name: "M308", client_code: "SS9", client_name: null, weight_kg: 3, payment: "pending", debt: 90000, reason: null },
  ],
  skipped: [
    { flight_name: "M300", client_code: "SS4", client_name: null, weight_kg: 1, payment: null, debt: 0, reason: "no_payment_row" },
  ],
};

const run: CleanupRun = {
  id: 7,
  astatka_flight_name: NAME,
  source_flights: ["M300"],
  bags: 2,
  transactions: 2,
  unpaid_bags: 1,
  unpaid_amount: 150000,
  admin_username: "boss",
  created_at: "2026-10-22T08:00:00Z",
  undone_at: null,
  undone_by_username: null,
  reverted: null,
  kept: null,
};

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AstatkaCleanupDialog flightName={NAME} stats={null} open onOpenChange={() => undefined} />
    </QueryClientProvider>,
  );
}

const flightButton = (name: string) =>
  screen.getByText(name).closest("button") as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  previewApi.mockResolvedValue(preview);
  runsApi.mockResolvedValue([]);
});

describe("AstatkaCleanupDialog", () => {
  it("says what changes and what does not, before anything else", async () => {
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Reyslarni tozalash" });
    expect(dialog.textContent).toContain("Bu tugma nima qiladi");
    expect(dialog.textContent).toContain("«olib ketilgan» deb belgilaydi");
    expect(dialog.textContent).toContain("To'lanmagan yuk kassada qarz bo'lib qoladi");
    expect(dialog.textContent).toContain("Mijozga xabar bormaydi");
  });

  it("ticks old flights only, and cleans after the name is typed", async () => {
    cleanApi.mockResolvedValue({ run, changed_meanwhile: 0 });
    renderDialog();
    await screen.findByText("M300");

    expect(flightButton("M300").getAttribute("aria-pressed")).toBe("true");
    // M308 arrived the day before the astatka: still being handed out.
    expect(flightButton("M308").getAttribute("aria-pressed")).toBe("false");
    expect(flightButton("M290").disabled).toBe(true);

    const submit = screen.getByRole("button", { name: /Tozalash \(2 ta yuk\)/ }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getByText(/qarz kassada qarz bo'lib qoladi/)).toBeTruthy();

    fireEvent.click(flightButton("M308"));
    expect(screen.getByText(/Yangi reys tanlandi: M308/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tozalash \(3 ta yuk\)/ })).toBeTruthy();
    fireEvent.click(flightButton("M308"));

    fireEvent.change(screen.getByLabelText(/Tasdiqlash uchun astatka nomini yozing/), {
      target: { value: "ostatka-21.10.2026" },
    });
    const ready = screen.getByRole("button", { name: /Tozalash \(2 ta yuk\)/ }) as HTMLButtonElement;
    expect(ready.disabled).toBe(false);
    fireEvent.click(ready);

    await waitFor(() =>
      expect(cleanApi).toHaveBeenCalledWith(NAME, ["M300"], "ostatka-21.10.2026"),
    );
    expect(await screen.findByText("2 ta yuk «olib ketilgan» deb belgilandi")).toBeTruthy();
  });

  it("lists the bags it would touch and the ones it leaves", async () => {
    renderDialog();
    await screen.findByText("M300");
    fireEvent.click(screen.getByRole("button", { name: /Belgilanadigan yuklar ro'yxati \(2\)/ }));
    expect(screen.getByText("SS1")).toBeTruthy();
    expect(screen.queryByText("SS9")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Tegilmaydigan yuklar \(1\)/ }));
    expect(screen.getByText("To'lov yozuvi yo'q")).toBeTruthy();
  });

  it("undoes an earlier run after a second tap", async () => {
    runsApi.mockResolvedValue([run]);
    undoApi.mockResolvedValue({ ...run, undone_at: "2026-10-22T09:00:00Z", reverted: 2, kept: 0 });
    renderDialog();

    const history = (await screen.findByText("Oldingi tozalashlar")).closest("section") as HTMLElement;
    fireEvent.click(within(history).getByRole("button", { name: /Bekor qilish/ }));
    expect(undoApi).not.toHaveBeenCalled();
    fireEvent.click(within(history).getByRole("button", { name: /Ha, 2 ta yukni qaytarish/ }));
    await waitFor(() => expect(undoApi).toHaveBeenCalledWith(NAME, 7));
  });
});
