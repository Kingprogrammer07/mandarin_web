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
  astatkaPackagesQueryKey: (name: string) => ["astatka-packages", name],
  astatkaStatsQueryKey: ["astatka-flight-stats"],
  getAstatkaBagDetails: vi.fn(),
  getAstatkaCargoPhotos: vi.fn(),
  replaceAstatkaCargoPhotos: vi.fn(),
  updateAstatkaCargoWeight: vi.fn(),
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
  updateAstatkaPackage,
  type AstatkaPackage,
} from "@/api/services/astatkaFlights";
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
) {
  const queue = {
    isOnline: true,
    replacePackage: vi.fn(),
    updateEdits: vi.fn(),
    applyBagWeight: vi.fn(),
  };
  const handlers = {
    onModeChange: vi.fn(),
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    onRemove: vi.fn(),
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
  return { queue, handlers, item, rerender };
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

  it("does not turn a weight fixed in the photo report into a typed one", () => {
    const { queue, item, rerender } = renderSheet("ready", "edit");
    expect(screen.getByLabelText(/Og'irligi \(kg\)/)).toHaveValue("4.5");

    // applyBagWeight: the report's new weight lands on the row's package.
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
