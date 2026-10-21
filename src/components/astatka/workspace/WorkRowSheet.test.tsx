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
  astatkaPackagePhotosQueryKey: (id: number) => ["astatka-package-photos", id],
  astatkaPackagesQueryKey: (name: string) => ["astatka-packages", name],
  astatkaStatsQueryKey: ["astatka-flight-stats"],
  getAstatkaBagDetails: vi.fn(),
  getAstatkaCargoPhotos: vi.fn(),
  getAstatkaExternalPhotos: vi.fn(),
  getAstatkaPackagePhotos: vi.fn(),
  replaceAstatkaPackagePhotos: vi.fn(),
  updateAstatkaPackage: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
  },
}));

import {
  getAstatkaBagDetails,
  getAstatkaExternalPhotos,
  getAstatkaPackagePhotos,
  updateAstatkaPackage,
  type AstatkaExternalBag,
  type AstatkaPackage,
} from "@/api/services/astatkaFlights";
import type { PendingPhotos } from "@/hooks/useAstatkaPendingPhotos";
import type { WorkRow, WorkRowState } from "@/lib/astatkaWorkQueue";

import type { BagSheetMode } from "./BagSheet";
import { WorkRowSheet } from "./WorkRowSheet";

const update = vi.mocked(updateAstatkaPackage);

const pkg: AstatkaPackage = {
  id: 7,
  astatka_flight_name: "OSTATKA.202",
  client_code: "SS101",
  client_name: null,
  source_flight_name: "M262",
  track_codes: ["YT1", "YT2"],
  track_count: 2,
  weight_kg: 4.5,
  weight_edited: false,
  bags: 1,
  has_photo: false,
  status: "expected",
  origin: "auto",
  comment: null,
  taken_away: false,
  payment_state: null,
  already_in_astatka: null,
  scanned_at: null,
  confirmed_at: null,
  confirmed_by: null,
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
    pkg: state === "confirmed" ? { ...pkg, status: "confirmed" } : pkg,
    edits: {},
    confirmKey: null,
    warnings: [],
    fromIndex: false,
    origin: "scan",
    otherAstatka: null,
  };
}

function renderSheet(
  state: WorkRowState | WorkRow,
  mode: BagSheetMode = "view",
  onScreen = true,
  isOnline = true,
  waitingPhotos: Map<string, PendingPhotos> = new Map(),
) {
  const queue = {
    isOnline,
    replacePackage: vi.fn(),
    updateEdits: vi.fn(),
  };
  const pendingPhotos = {
    entries: waitingPhotos,
    add: vi.fn(),
    remove: vi.fn(),
    retry: vi.fn(),
  };
  const handlers = {
    onModeChange: vi.fn(),
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    onRemove: vi.fn(),
    onRecheck: vi.fn(),
  };
  const item = typeof state === "string" ? row(state) : state;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const sheet = (current: WorkRow, visible: boolean) => (
    <QueryClientProvider client={client}>
      <WorkRowSheet
        flightName="OSTATKA.202"
        queue={queue}
        pendingPhotos={pendingPhotos}
        row={current}
        onScreen={visible}
        mode={mode}
        {...handlers}
      />
    </QueryClientProvider>
  );
  const view = render(sheet(item, onScreen));
  /** The queue changed the row while the window was open. */
  const rerender = (next: WorkRow, visible = true) =>
    view.rerender(sheet(next, visible));
  return { queue, pendingPhotos, handlers, item, rerender };
}

function footerButtons(): string[] {
  const dialog = screen.getByRole("dialog");
  return within(dialog)
    .queryAllByRole("button")
    .map((button) => button.textContent?.trim() ?? "")
    .filter((label) =>
      ["Tasdiqlash", "Tahrirlash", "Ekrandan olib tashlash"].includes(label),
    );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAstatkaPackagePhotos).mockResolvedValue([]);
  vi.mocked(getAstatkaBagDetails).mockResolvedValue({
    client_code: "SS101",
    client_name: null,
    source_flight_name: "M262",
    weight_kg: 4.5,
    cargos: [],
    other_cargos: [],
  });
});

describe("WorkRowSheet", () => {
  it("offers what the row offers: confirm, edit, take off the screen", () => {
    const { handlers, item } = renderSheet("ready");

    expect(footerButtons()).toEqual([
      "Tasdiqlash",
      "Tahrirlash",
      "Ekrandan olib tashlash",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Tasdiqlash" }));
    expect(handlers.onConfirm).toHaveBeenCalledWith(item);
    fireEvent.click(screen.getByRole("button", { name: "Tahrirlash" }));
    expect(handlers.onModeChange).toHaveBeenCalledWith("edit");
  });

  it("takes a confirmed row off the screen and closes", () => {
    const { handlers, item } = renderSheet("confirmed");

    expect(footerButtons()).toEqual(["Tahrirlash", "Ekrandan olib tashlash"]);
    fireEvent.click(
      screen.getByRole("button", { name: "Ekrandan olib tashlash" }),
    );
    expect(handlers.onRemove).toHaveBeenCalledWith(item);
    expect(handlers.onClose).toHaveBeenCalled();
  });

  it.each<WorkRowState>(["saving", "queued"])(
    "offers nothing on a %s row",
    (state) => {
      renderSheet(state);
      expect(footerButtons()).toEqual([]);
    },
  );

  it("offers nothing once the row has left the screen", () => {
    renderSheet("ready", "view", false);
    expect(footerButtons()).toEqual([]);
  });

  it("saves only the changed field of a confirmed bag on the server, then shows the bag", async () => {
    const saved = {
      ...pkg,
      status: "confirmed" as const,
      weight_kg: 6,
      weight_edited: true,
    };
    update.mockResolvedValue(saved);
    const { queue, handlers } = renderSheet("confirmed", "edit");

    fireEvent.change(screen.getByLabelText(/Og'irligi \(kg\)/), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("OSTATKA.202", 7, { weight_kg: 6 }),
    );
    await waitFor(() =>
      expect(queue.replacePackage).toHaveBeenCalledWith("r1", saved),
    );
    expect(handlers.onModeChange).toHaveBeenCalledWith("view");
    expect(handlers.onClose).not.toHaveBeenCalled();
    expect(queue.updateEdits).not.toHaveBeenCalled();
  });

  it("replaces a confirmed bag's track codes on the server", async () => {
    const saved = {
      ...pkg,
      status: "confirmed" as const,
      track_codes: ["YT1", "YT9"],
    };
    update.mockResolvedValue(saved);
    const { queue } = renderSheet("confirmed", "edit");

    fireEvent.change(screen.getByLabelText(/Trek kodlar/), {
      target: { value: "YT1\nYT9" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("OSTATKA.202", 7, {
        track_codes: ["YT1", "YT9"],
      }),
    );
    await waitFor(() =>
      expect(queue.replacePackage).toHaveBeenCalledWith("r1", saved),
    );
  });

  it("keeps an unconfirmed row's edit on the screen, then shows the row", () => {
    const { queue, handlers } = renderSheet("ready", "edit");

    fireEvent.change(screen.getByLabelText("Mijoz kodi"), {
      target: { value: "ss202" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(update).not.toHaveBeenCalled();
    expect(queue.updateEdits).toHaveBeenCalledWith("r1", {
      clientCode: "SS202",
    });
    expect(handlers.onModeChange).toHaveBeenCalledWith("view");
    expect(handlers.onClose).not.toHaveBeenCalled();
  });

  it("does not turn a weight the server changed meanwhile into a typed one", () => {
    const { queue, item, rerender } = renderSheet("ready", "edit");
    expect(screen.getByLabelText(/Og'irligi \(kg\)/)).toHaveValue("4.5");

    // The saved bag came back from the server with a new weight.
    rerender({ ...item, pkg: { ...pkg, weight_kg: 7 } });
    fireEvent.change(screen.getByLabelText("Izoh"), {
      target: { value: "qopi yirtilgan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(queue.updateEdits).toHaveBeenCalledWith("r1", {
      comment: "qopi yirtilgan",
    });
  });

  it("keeps what the server resolved while the form was open", () => {
    const waiting: WorkRow = {
      ...row("waiting_net"),
      pkg: null,
      kind: null,
    };
    const { queue, rerender } = renderSheet(waiting, "edit");

    fireEvent.change(screen.getByLabelText("Mijoz kodi"), {
      target: { value: "SS999" },
    });
    // The network came back and the scan resolved: flight and weight known.
    rerender({ ...waiting, state: "ready", pkg });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(queue.updateEdits).toHaveBeenCalledWith("r1", {
      clientCode: "SS999",
    });
  });

  it("marks codes typed before the bag was named as written against no bag", () => {
    const waiting: WorkRow = { ...row("waiting_net"), pkg: null, kind: null };
    const { queue, rerender } = renderSheet(waiting, "edit");

    fireEvent.change(screen.getByLabelText(/Trek kodlar/), {
      target: { value: "YT1\nYT9" },
    });
    // The answer names a confirmed bag while the form is still open.
    rerender({ ...waiting, state: "ready", pkg: { ...pkg, status: "confirmed" } });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(queue.updateEdits).toHaveBeenCalledWith("r1", {
      trackCodes: ["YT1", "YT9"],
      trackCodesBase: null,
    });
  });

  it("ties codes typed over the named bag's list to that bag", () => {
    const { queue } = renderSheet("ready", "edit");

    fireEvent.change(screen.getByLabelText(/Trek kodlar/), {
      target: { value: "YT1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(queue.updateEdits).toHaveBeenCalledWith("r1", {
      trackCodes: ["YT1"],
      trackCodesBase: pkg.id,
    });
  });

  it("keeps a list typed blind blind when it is fixed again", () => {
    const typed: WorkRow = {
      ...row("ready"),
      edits: { trackCodes: ["YT1", "YT9"], trackCodesBase: null },
    };
    const { queue } = renderSheet(typed, "edit");

    fireEvent.change(screen.getByLabelText(/Trek kodlar/), {
      target: { value: "YT1\nYT9\nYT10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(queue.updateEdits).toHaveBeenCalledWith("r1", {
      trackCodes: ["YT1", "YT9", "YT10"],
      trackCodesBase: null,
    });
  });

  it("keeps the edit open while the row is being sent, and saves once it is confirmed", async () => {
    const saved = { ...pkg, status: "confirmed" as const, comment: "yirtiq" };
    update.mockResolvedValue(saved);
    const { item, rerender } = renderSheet("ready", "edit");

    fireEvent.change(screen.getByLabelText("Izoh"), {
      target: { value: "yirtiq" },
    });
    rerender({ ...item, state: "saving" });

    expect(screen.getByLabelText("Izoh")).toHaveValue("yirtiq");
    expect(screen.getByRole("button", { name: "Saqlash" })).toBeDisabled();
    expect(screen.getByText(/Yuk saqlanmoqda/)).toBeInTheDocument();

    rerender({
      ...item,
      state: "confirmed",
      pkg: { ...pkg, status: "confirmed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("OSTATKA.202", 7, {
        comment: "yirtiq",
      }),
    );
  });

  it("drops back to the bag's facts once the row has left the screen", () => {
    const { item, rerender } = renderSheet("ready", "edit");
    expect(
      screen.getByRole("form", { name: "Yukni tahrirlash" }),
    ).toBeInTheDocument();

    rerender(item, false);

    expect(screen.queryByRole("form", { name: "Yukni tahrirlash" })).toBeNull();
    expect(
      screen.getByRole("region", { name: "Yuk haqida" }),
    ).toBeInTheDocument();
  });
});

describe("WorkRowSheet — Qayta tekshirish", () => {
  const unknown = (): WorkRow => ({
    ...row("not_found"),
    pkg: null,
    kind: "not_found",
    message: "AKB bilan aloqa bo'lmadi. Keyinroq qayta tekshiring.",
  });

  it("asks the server again about a code it could not find", () => {
    const { handlers, item } = renderSheet(unknown());

    fireEvent.click(screen.getByRole("button", { name: "Qayta tekshirish" }));

    expect(handlers.onRecheck).toHaveBeenCalledWith(item);
  });

  it("waits for the internet", () => {
    renderSheet(unknown(), "view", true, false);
    expect(screen.getByRole("button", { name: "Qayta tekshirish" })).toBeDisabled();
  });

  it("is not offered on a found bag", () => {
    renderSheet("ready");
    expect(screen.queryByRole("button", { name: "Qayta tekshirish" })).toBeNull();
  });
});

describe("WorkRowSheet — a partner cargo's bag", () => {
  function external(overrides: Partial<AstatkaExternalBag> = {}): AstatkaExternalBag {
    return {
      flight_name: "M200",
      weight_kg: 12.5,
      price_per_kg: 8,
      rows: 2,
      photo_count: 3,
      comment: null,
      is_sent: false,
      created_at: "2026-10-01T05:00:00Z",
      updated_at: null,
      ...overrides,
    };
  }
  const m200 = external();
  const m199 = external({ flight_name: "M199", weight_kg: 7, rows: 1, photo_count: 0 });

  function partnerRow(state: WorkRowState = "ready"): WorkRow {
    return {
      ...row(state),
      trackCode: "AK001",
      scannedCodes: ["AK001"],
      kind: "new",
      pkg: {
        ...pkg,
        id: null,
        client_code: "ZZ17",
        source_flight_name: "M200",
        track_codes: ["AK001"],
        weight_kg: 12.5,
        status: state === "confirmed" ? "confirmed" : null,
        source_company: "AKB",
        source_company_name: "AKB",
        external: m200,
      },
      externalOptions: [m200, m199],
      externalFlightKnown: false,
    };
  }

  it("shows the partner's data and never reads our photo report for it", async () => {
    renderSheet(partnerRow());

    expect(screen.getByRole("region", { name: "AKB ma'lumoti" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Foto hisobot" })).toBeNull();
    // Give a stray query the chance to fire before saying it did not.
    await waitFor(() => expect(screen.getByText(/eng oxirgi reys tanlandi/)).toBeInTheDocument());
    expect(getAstatkaBagDetails).not.toHaveBeenCalled();
  });

  it("puts the picked flight on the row", () => {
    const { queue } = renderSheet(partnerRow());

    fireEvent.click(screen.getByRole("radio", { name: /M199/ }));

    expect(queue.updateEdits).toHaveBeenCalledWith("r1", { sourceFlight: "M199" });
  });

  it("keeps what else was edited on the row when a flight is picked", () => {
    const { queue } = renderSheet({ ...partnerRow(), edits: { comment: "yirtiq" } });

    fireEvent.click(screen.getByRole("radio", { name: /M199/ }));

    expect(queue.updateEdits).toHaveBeenCalledWith("r1", {
      comment: "yirtiq",
      sourceFlight: "M199",
    });
  });

  it("shows the picked flight's facts", () => {
    renderSheet({ ...partnerRow(), edits: { sourceFlight: "M199" } });

    expect(screen.getByRole("radio", { name: /M199/ })).toBeChecked();
    const facts = screen.getByRole("region", { name: "Yuk haqida" });
    expect(facts).toHaveTextContent("M199");
    expect(facts).toHaveTextContent("7 kg");
  });

  it("offers no choice of flight once the bag is confirmed", () => {
    renderSheet(partnerRow("confirmed"));
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByRole("region", { name: "AKB ma'lumoti" })).toBeInTheDocument();
  });

  it("locks the client and the flight in the edit form; the weight stays editable", () => {
    const { queue } = renderSheet(partnerRow(), "edit");

    expect(screen.getByLabelText("Mijoz kodi")).toBeDisabled();
    expect(screen.getByLabelText("Qaysi reysdan")).toBeDisabled();
    expect(screen.getByText(/bo'limida tanlanadi/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Og'irligi \(kg\)/), {
      target: { value: "13" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(queue.updateEdits).toHaveBeenCalledWith("r1", { weightKg: 13 });
  });

  it("reads a saved bag's photo copies through the astatka that holds it", async () => {
    vi.mocked(getAstatkaExternalPhotos).mockResolvedValue({
      photos: [{ index: 0, url: "https://s3.example/a.webp", error: null }],
      pending: 0,
    });
    const saved = partnerRow("confirmed");
    renderSheet({
      ...saved,
      pkg: {
        ...saved.pkg!,
        id: 42,
        astatka_flight_name: "OSTATKA.199",
        external: { ...m200, photo_urls: [], stored_photos: 1 },
      },
    });

    expect(
      await screen.findAllByRole("button", { name: /rasmni kattalashtirish/ }),
    ).toHaveLength(1);
    expect(getAstatkaExternalPhotos).toHaveBeenCalledWith("OSTATKA.199", 42);
  });
});

describe("WorkRowSheet — a code a partner cargo may own", () => {
  function unsureRow(): WorkRow {
    return {
      ...row("not_found"),
      kind: "not_found",
      pkg: null,
      message: "AKB bilan aloqa bo'lmadi.",
      partnerState: "unavailable",
    };
  }

  it("does not let a client be typed for it, and says why", () => {
    renderSheet(unsureRow(), "edit");

    expect(screen.getByLabelText("Mijoz kodi")).toBeDisabled();
    expect(screen.getByLabelText("Qaysi reysdan")).toBeDisabled();
    expect(
      screen.getByText(/boshqa kargoniki bo'lishi mumkin/),
    ).toBeInTheDocument();
  });
});

describe("WorkRowSheet — photos before the bag is saved here", () => {
  /** A bag the photo report knows, not saved in this astatka yet. */
  const unsaved = (): WorkRow => ({ ...row("ready"), pkg: { ...pkg, id: null } });
  const photo = new File(["x"], "bag.jpg", { type: "image/jpeg" });

  it("takes photos in the app's camera and keeps them for the confirm", async () => {
    const { pendingPhotos } = renderSheet(unsaved());

    const section = screen.getByRole("region", { name: "Astatka rasmlari" });
    expect(within(section).getByText("Hali rasm olinmagan.")).toBeInTheDocument();
    fireEvent.click(within(section).getByRole("button", { name: "Rasm olish" }));

    const camera = await screen.findByRole("dialog", { name: "Rasm olish" });
    await within(camera).findByRole("button", { name: /Galereyadan tanlash/ });
    const picker = camera.querySelector<HTMLInputElement>('input[type="file"][multiple]');
    fireEvent.change(picker!, { target: { files: [photo] } });
    fireEvent.click(within(camera).getByRole("button", { name: "Tayyor" }));

    expect(pendingPhotos.add).toHaveBeenCalledWith("r1", [photo], null);
  });

  it("shows the waiting photos and takes one off", () => {
    const waiting = new Map<string, PendingPhotos>([
      ["r1", { files: [photo], status: "waiting", error: null, packageId: null }],
    ]);
    const { pendingPhotos } = renderSheet(unsaved(), "view", true, true, waiting);

    expect(screen.getByAltText("1-rasm")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "1-rasmni o'chirish" }));
    expect(pendingPhotos.remove).toHaveBeenCalledWith("r1", 0);
  });

  it("offers to send again photos that did not reach the confirmed bag", () => {
    const failed = new Map<string, PendingPhotos>([
      ["r1", { files: [photo], status: "failed", error: "Internet yo'q", packageId: 7 }],
    ]);
    const { pendingPhotos } = renderSheet("confirmed", "view", true, true, failed);

    expect(screen.getByText("Internet yo'q")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Qayta yuborish" }));
    expect(pendingPhotos.retry).toHaveBeenCalledWith("r1");
  });

  it("offers no waiting photos for a bag already saved here", () => {
    renderSheet("ready");
    expect(screen.queryByText(/Yuk tasdiqlanganda shu yukka saqlanadi/)).toBeNull();
  });
});
