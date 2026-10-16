import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("@/api/services/astatkaFlights", () => ({
  astatkaBagQueryKey: (name: string, ref: object) => [
    "astatka-bag",
    name,
    JSON.stringify(ref),
  ],
  astatkaCargoPhotosQueryKey: (id: number) => ["astatka-cargo-photos", id],
  astatkaExternalPhotosRootKey: ["astatka-external-photos"],
  astatkaExternalPhotosQueryKey: (id: number) => ["astatka-external-photos", id],
  astatkaPackagesQueryKey: (name: string) => ["astatka-packages", name],
  astatkaStatsQueryKey: ["astatka-flight-stats"],
  confirmAstatkaPackages: vi.fn(),
  deleteAstatkaPackage: vi.fn(),
  getAstatkaBagDetails: vi.fn(),
  getAstatkaCargoPhotos: vi.fn(),
  getAstatkaExternalPhotos: vi.fn(),
  getAstatkaPackages: vi.fn(),
  replaceAstatkaCargoPhotos: vi.fn(),
  unconfirmAstatkaPackage: vi.fn(),
  updateAstatkaCargoWeight: vi.fn(),
  updateAstatkaPackage: vi.fn(),
}));
vi.mock("@/utils/askConfirm", () => ({ askConfirm: vi.fn() }));
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
  },
}));

import { toast } from "sonner";

import {
  astatkaPackagesQueryKey,
  confirmAstatkaPackages,
  deleteAstatkaPackage,
  getAstatkaBagDetails,
  getAstatkaExternalPhotos,
  getAstatkaPackages,
  unconfirmAstatkaPackage,
  updateAstatkaCargoWeight,
  updateAstatkaPackage,
  type AstatkaBagCargo,
  type AstatkaPackage,
  type AstatkaPackagesResponse,
} from "@/api/services/astatkaFlights";
import { askConfirm } from "@/utils/askConfirm";

import { PackagesPreview } from "./PackagesPreview";

const list = vi.mocked(getAstatkaPackages);
const unconfirm = vi.mocked(unconfirmAstatkaPackage);
const remove = vi.mocked(deleteAstatkaPackage);
const confirmDialog = vi.mocked(askConfirm);
const errorToast = vi.mocked(toast.error);
const bagDetails = vi.mocked(getAstatkaBagDetails);
const saveCargoWeight = vi.mocked(updateAstatkaCargoWeight);
const updatePackage = vi.mocked(updateAstatkaPackage);

function cargo(overrides: Partial<AstatkaBagCargo> = {}): AstatkaBagCargo {
  return {
    id: 11,
    flight_name: "M262",
    client_id: "SS101",
    photo_count: 0,
    weight_kg: 5,
    price_per_kg: 9.5,
    comment: null,
    is_sent: false,
    is_sent_date: null,
    is_sent_web: false,
    is_sent_web_date: null,
    created_at: "2026-09-30T05:00:00Z",
    updated_at: "2026-09-30T05:00:00Z",
    ...overrides,
  };
}

/** A promise the test settles by hand: a request still on its way. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function pkg(overrides: Partial<AstatkaPackage> = {}): AstatkaPackage {
  return {
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
    has_photo: false,
    status: "confirmed",
    origin: "scan",
    comment: null,
    taken_away: false,
    payment_state: null,
    already_in_astatka: null,
    scanned_at: null,
    confirmed_at: "2026-10-12T05:00:00Z",
    confirmed_by: "Vali",
    created_at: "2026-10-11T05:00:00Z",
    ...overrides,
  };
}

function page(items: AstatkaPackage[]): AstatkaPackagesResponse {
  return {
    astatka_flight_name: "OSTATKA.202",
    items,
    total: items.length,
    page: 1,
    size: 50,
    total_pages: 1,
    counts: { all: items.length, expected: 0, confirmed: items.length },
    weights: { expected: 0, confirmed: 4.5 },
    source_flights: ["M262"],
  };
}

function renderList() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <PackagesPreview
        flightName="OSTATKA.202"
        editMode={false}
        isOnline
        offlineIndex={null}
      />
    </QueryClientProvider>,
  );
  return client;
}

async function pressRowDelete(clientCode = "SS101") {
  fireEvent.click(
    await screen.findByRole("button", { name: `${clientCode}: o'chirish` }),
  );
}

/** A tap on the row's facts opens the bag window. */
async function openBag(clientCode = "SS101") {
  const rows = await screen.findAllByRole("listitem");
  const row = rows.find((item) => item.textContent?.includes(clientCode));
  if (!row) throw new Error(`no row for ${clientCode}`);
  fireEvent.click(within(row).getAllByRole("button")[0]);
  return screen.findByRole("dialog", { name: clientCode });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAstatkaExternalPhotos).mockResolvedValue({ photos: [], pending: 0 });
  confirmDialog.mockResolvedValue(true);
  remove.mockResolvedValue(undefined);
  unconfirm.mockResolvedValue({
    package: pkg({
      status: "expected",
      confirmed_at: null,
      confirmed_by: null,
    }),
    message: "Tasdiq bekor qilindi",
    warnings: [],
  });
  vi.mocked(getAstatkaBagDetails).mockResolvedValue({
    client_code: "SS101",
    client_name: null,
    source_flight_name: "M262",
    weight_kg: 4.5,
    cargos: [],
    other_cargos: [],
  });
});

describe("PackagesPreview — delete", () => {
  it("shows the trash on every row even outside edit mode", async () => {
    list.mockResolvedValue(
      page([pkg(), pkg({ id: 8, client_code: "SS102", status: "expected" })]),
    );
    renderList();

    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(
        within(row).getByRole("button", { name: /: o'chirish$/ }),
      ).toBeEnabled();
      // The facts are a button beside the trash, never around it: VoiceOver
      // cannot reach a button nested in another.
      expect(row.querySelector("button button, [role='button']")).toBeNull();
    }
    expect(screen.queryByRole("button", { name: /tahrirlash/i })).toBeNull();
  });

  it("undoes a confirmed bag's confirmation first, then deletes it", async () => {
    list.mockResolvedValue(page([pkg()]));
    renderList();

    await pressRowDelete();

    await waitFor(() => expect(remove).toHaveBeenCalledWith("OSTATKA.202", 7));
    expect(confirmDialog.mock.calls[0][0]).toMatch(/tasdig'i bekor qilinadi/);
    expect(confirmDialog.mock.calls[0][0]).toMatch(/M262 reysiga qaytadi/);
    expect(unconfirm).toHaveBeenCalledWith("OSTATKA.202", 7);
    expect(unconfirm.mock.invocationCallOrder[0]).toBeLessThan(
      remove.mock.invocationCallOrder[0],
    );
    expect(toast.success).toHaveBeenCalledWith("Ro'yxatdan o'chirildi");
  });

  it("deletes a waiting bag straight away", async () => {
    list.mockResolvedValue(
      page([pkg({ status: "expected", confirmed_at: null })]),
    );
    renderList();

    await pressRowDelete();

    await waitFor(() => expect(remove).toHaveBeenCalledWith("OSTATKA.202", 7));
    expect(confirmDialog.mock.calls[0][0]).toBe(
      "SS101 ro'yxatdan o'chirilsinmi?",
    );
    expect(unconfirm).not.toHaveBeenCalled();
  });

  it("does nothing when the worker says no", async () => {
    confirmDialog.mockResolvedValue(false);
    list.mockResolvedValue(page([pkg()]));
    renderList();

    await pressRowDelete();

    await waitFor(() => expect(confirmDialog).toHaveBeenCalled());
    expect(unconfirm).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("stops before deleting when the confirmation cannot be undone", async () => {
    unconfirm.mockRejectedValue(new Error("409"));
    list.mockResolvedValue(page([pkg()]));
    renderList();

    await pressRowDelete();

    await waitFor(() => expect(errorToast).toHaveBeenCalled());
    expect(String(errorToast.mock.calls[0][0])).toMatch(/o'chirilmadi/);
    expect(remove).not.toHaveBeenCalled();
  });

  it("says the bag is waiting again when the delete fails after the undo", async () => {
    remove.mockRejectedValue(new Error("500"));
    list.mockResolvedValue(page([pkg()]));
    renderList();

    await pressRowDelete();

    await waitFor(() => expect(errorToast).toHaveBeenCalled());
    expect(String(errorToast.mock.calls[0][0])).toMatch(/«Kutilmoqda»/);
    expect(unconfirm).toHaveBeenCalledTimes(1);
  });

  it("refreshes a row the server says has changed, so the next try takes the right path", async () => {
    remove.mockRejectedValue({
      message:
        "Tasdiqlangan yukni o'chirib bo'lmaydi. Avval tasdiqni bekor qiling.",
      status: 409,
    });
    list.mockResolvedValue(
      page([pkg({ status: "expected", confirmed_at: null })]),
    );
    renderList();

    await pressRowDelete();

    await waitFor(() => expect(errorToast).toHaveBeenCalled());
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("deletes another bag while the first delete is still running", async () => {
    const first = deferred<void>();
    remove.mockImplementation((_flight, id) =>
      id === 7 ? first.promise : Promise.resolve(),
    );
    list.mockResolvedValue(
      page([
        pkg({ status: "expected", confirmed_at: null }),
        pkg({ id: 8, client_code: "SS102", status: "expected" }),
      ]),
    );
    renderList();

    await pressRowDelete("SS101");
    await waitFor(() => expect(remove).toHaveBeenCalledWith("OSTATKA.202", 7));
    expect(
      screen.getByRole("button", { name: "SS101: o'chirish" }),
    ).toBeDisabled();

    await pressRowDelete("SS102");
    await waitFor(() => expect(remove).toHaveBeenCalledWith("OSTATKA.202", 8));
    expect(confirmDialog).toHaveBeenCalledTimes(2);
    first.resolve();
  });

  it("leaves another bag's window open when a delete started from a row finishes", async () => {
    const first = deferred<void>();
    remove.mockReturnValue(first.promise);
    list.mockResolvedValue(
      page([
        pkg({ status: "expected", confirmed_at: null }),
        pkg({ id: 8, client_code: "SS102", status: "expected" }),
      ]),
    );
    renderList();

    await pressRowDelete("SS101");
    await waitFor(() => expect(remove).toHaveBeenCalled());
    await openBag("SS102");
    first.resolve();

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Ro'yxatdan o'chirildi"),
    );
    expect(screen.getByRole("dialog", { name: "SS102" })).toBeInTheDocument();
  });

  it("deletes from the bag window too", async () => {
    list.mockResolvedValue(
      page([pkg({ status: "expected", confirmed_at: null })]),
    );
    renderList();

    const rows = await screen.findAllByRole("listitem");
    fireEvent.click(within(rows[0]).getAllByRole("button")[0]);
    const sheet = await screen.findByRole("dialog", { name: "SS101" });
    expect(
      within(sheet).getByRole("button", { name: /tasdiqlash/ }),
    ).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "O'chirish" }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("OSTATKA.202", 7));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("PackagesPreview — the bag window", () => {
  const waiting = { status: "expected" as const, confirmed_at: null };

  it("shows a weight fixed in the photo report and never saves the old one back", async () => {
    // The list keeps answering 5 kg: only the window's own copy knows 7.
    list.mockResolvedValue(page([pkg({ ...waiting, weight_kg: 5 })]));
    bagDetails.mockResolvedValue({
      client_code: "SS101",
      client_name: null,
      source_flight_name: "M262",
      weight_kg: 5,
      cargos: [cargo()],
      other_cargos: [],
    });
    saveCargoWeight.mockResolvedValue({
      cargo: cargo({ weight_kg: 7 }),
      synced_packages: 1,
    });
    updatePackage.mockResolvedValue(
      pkg({ ...waiting, weight_kg: 7, comment: "qopi yirtilgan" }),
    );
    renderList();

    const sheet = await openBag();
    const facts = within(sheet).getByRole("region", { name: "Yuk haqida" });
    expect(facts).toHaveTextContent("5 kg");

    fireEvent.click(
      await within(sheet).findByRole("button", { name: "O'zgartirish" }),
    );
    fireEvent.change(within(sheet).getByLabelText("Og'irlik, kg"), {
      target: { value: "7" },
    });
    fireEvent.click(within(sheet).getByRole("button", { name: "Saqlash" }));
    await waitFor(() =>
      expect(
        within(sheet).getByRole("region", { name: "Yuk haqida" }),
      ).toHaveTextContent("7 kg"),
    );

    fireEvent.click(within(sheet).getByRole("button", { name: "Tahrirlash" }));
    expect(within(sheet).getByLabelText(/Og'irligi \(kg\)/)).toHaveValue("7");
    fireEvent.change(within(sheet).getByLabelText("Izoh"), {
      target: { value: "qopi yirtilgan" },
    });
    fireEvent.click(within(sheet).getByRole("button", { name: "Saqlash" }));

    await waitFor(() =>
      expect(updatePackage).toHaveBeenCalledWith("OSTATKA.202", 7, {
        comment: "qopi yirtilgan",
      }),
    );
    // Saved: the same window, back on the bag's facts as the server has them.
    expect(toast.success).toHaveBeenCalledWith("Saqlandi");
    const after = await screen.findByRole("dialog", { name: "SS101" });
    expect(
      within(after).getByRole("region", { name: "Yuk haqida" }),
    ).toHaveTextContent("qopi yirtilgan");
  });

  it("gives the focus back to the row that opened the window", async () => {
    list.mockResolvedValue(page([pkg({ ...waiting })]));
    renderList();

    const [row] = await screen.findAllByRole("listitem");
    const opener = within(row).getAllByRole("button")[0];
    opener.focus();
    fireEvent.click(opener);
    const sheet = await screen.findByRole("dialog", { name: "SS101" });
    fireEvent.keyDown(sheet, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("keeps an open edit and what was typed when the connection drops", async () => {
    list.mockResolvedValue(page([pkg({ ...waiting })]));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const preview = (isOnline: boolean) => (
      <QueryClientProvider client={client}>
        <PackagesPreview
          flightName="OSTATKA.202"
          editMode={false}
          isOnline={isOnline}
          offlineIndex={{
            astatka_flight_name: "OSTATKA.202",
            packages: [pkg({ ...waiting })],
            synced_at: "2026-10-12T05:00:00Z",
          }}
        />
      </QueryClientProvider>
    );
    const view = render(preview(true));

    const sheet = await openBag();
    fireEvent.click(within(sheet).getByRole("button", { name: "Tahrirlash" }));
    fireEvent.change(within(sheet).getByLabelText("Izoh"), {
      target: { value: "qopi yirtilgan" },
    });
    view.rerender(preview(false));

    expect(within(sheet).getByLabelText("Izoh")).toHaveValue("qopi yirtilgan");
    expect(
      within(sheet).getByRole("button", { name: "Saqlash" }),
    ).toBeDisabled();
    expect(
      within(sheet).getByText(/saqlash uchun internet kerak/),
    ).toBeInTheDocument();
    expect(updatePackage).not.toHaveBeenCalled();
  });

  it("follows the list when the bag changes while its window is open", async () => {
    list
      .mockResolvedValueOnce(page([pkg({ ...waiting })]))
      .mockResolvedValue(
        page([pkg({ ...waiting, comment: "boshqa qurilmada yozildi" })]),
      );
    const client = renderList();

    const sheet = await openBag();
    await client.invalidateQueries({
      queryKey: astatkaPackagesQueryKey("OSTATKA.202"),
    });

    await waitFor(() =>
      expect(
        within(sheet).getByRole("region", { name: "Yuk haqida" }),
      ).toHaveTextContent("boshqa qurilmada yozildi"),
    );
  });
});

describe("PackagesPreview — partner cargo", () => {
  const akbBag = pkg({
    id: 9,
    client_code: "ZZ17",
    source_flight_name: "M200",
    status: "expected",
    confirmed_at: null,
    confirmed_by: null,
    source_company: "AKB",
    source_company_name: "AKB",
    external: {
      flight_name: "M200",
      weight_kg: 12.5,
      price_per_kg: 8,
      rows: 2,
      photo_count: 3,
      comment: null,
      is_sent: false,
      created_at: null,
      updated_at: null,
    },
  });

  it("offers no cargo filter while every bag is ours", async () => {
    list.mockResolvedValue({ ...page([pkg()]), source_companies: [] });
    renderList();

    await screen.findAllByRole("listitem");
    expect(screen.queryByRole("group", { name: "Kargo" })).toBeNull();
    // Undefined: axios leaves it out, so the server lists every cargo.
    expect(list.mock.calls[0][1].source_company).toBeUndefined();
  });

  it("filters by cargo, sending \"\" for our own", async () => {
    list.mockResolvedValue({ ...page([pkg(), akbBag]), source_companies: ["AKB"] });
    renderList();

    const group = await screen.findByRole("group", { name: "Kargo" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Hammasi", "Mandarin", "AKB"]);
    expect(within(group).getByRole("button", { name: "Hammasi" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(within(group).getByRole("button", { name: "Mandarin" }));
    await waitFor(() =>
      expect(list.mock.calls.at(-1)?.[1]).toMatchObject({ source_company: "" }),
    );
    // The chips stay while the filtered page loads.
    expect(screen.getByRole("group", { name: "Kargo" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "AKB" }));
    await waitFor(() =>
      expect(list.mock.calls.at(-1)?.[1]).toMatchObject({ source_company: "AKB" }),
    );
  });

  it("filters the offline copy by cargo too", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <PackagesPreview
          flightName="OSTATKA.202"
          editMode={false}
          isOnline={false}
          offlineIndex={{
            astatka_flight_name: "OSTATKA.202",
            packages: [pkg(), akbBag],
            synced_at: "2026-10-12T05:00:00Z",
          }}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "AKB" }));

    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("ZZ17");
  });

  it("marks a partner's bag and opens its partner data, never our photo report", async () => {
    list.mockResolvedValue({ ...page([akbBag]), source_companies: ["AKB"] });
    renderList();

    const [row] = await screen.findAllByRole("listitem");
    expect(within(row).getAllByTitle("AKB API'dan topildi").length).toBeGreaterThan(0);

    const sheet = await openBag("ZZ17");
    expect(within(sheet).getByRole("region", { name: "AKB ma'lumoti" })).toBeInTheDocument();
    // A saved bag's flight is settled: nothing to pick.
    expect(within(sheet).queryByRole("radiogroup")).toBeNull();
    // No copy of the partner's photos was made: say where they are.
    expect(
      await within(sheet).findByText("3 ta rasm AKB tizimida — bu yerda ko'rinmaydi"),
    ).toBeInTheDocument();
    expect(getAstatkaExternalPhotos).toHaveBeenCalledWith("OSTATKA.202", 9);
    expect(bagDetails).not.toHaveBeenCalled();
  });

  it("confirms a waiting partner's bag as that partner's", async () => {
    vi.mocked(confirmAstatkaPackages).mockResolvedValue([
      {
        idempotency_key: "k",
        outcome: "confirmed",
        package: { ...akbBag, status: "confirmed" },
        message: "Tasdiqlandi",
        warnings: [],
      },
    ]);
    list.mockResolvedValue({ ...page([akbBag]), source_companies: ["AKB"] });
    renderList();

    const sheet = await openBag("ZZ17");
    fireEvent.click(within(sheet).getByRole("button", { name: /tasdiqlash/ }));

    await waitFor(() =>
      expect(confirmAstatkaPackages).toHaveBeenCalledWith("OSTATKA.202", [
        expect.objectContaining({
          client_code: "ZZ17",
          source_flight_name: "M200",
          source_company: "AKB",
        }),
      ]),
    );
  });
});
