import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
}));

import {
  getAstatkaBagDetails,
  getAstatkaCargoPhotos,
  replaceAstatkaCargoPhotos,
  updateAstatkaCargoWeight,
  type AstatkaBagCargo,
  type AstatkaBagDetails,
} from "@/api/services/astatkaFlights";
import type { BagSummary } from "@/lib/astatkaBagSummary";

import type {
  BagEditChanges,
  BagEditLocks,
  BagEditValues,
} from "./BagEditForm";
import { BagSheet, type BagSheetMode } from "./BagSheet";

const details = vi.mocked(getAstatkaBagDetails);
const photos = vi.mocked(getAstatkaCargoPhotos);
const replacePhotos = vi.mocked(replaceAstatkaCargoPhotos);
const saveWeight = vi.mocked(updateAstatkaCargoWeight);

function cargo(overrides: Partial<AstatkaBagCargo> = {}): AstatkaBagCargo {
  return {
    id: 11,
    flight_name: "M262-M263",
    client_id: "SS KODSIZ",
    photo_count: 2,
    weight_kg: null,
    price_per_kg: 9.5,
    comment: "Qutisi yirtilgan",
    is_sent: true,
    is_sent_date: "2026-10-01T05:00:00Z",
    is_sent_web: false,
    is_sent_web_date: null,
    created_at: "2026-09-30T05:00:00Z",
    updated_at: "2026-09-30T05:00:00Z",
    ...overrides,
  };
}

function bagDetails(
  overrides: Partial<AstatkaBagDetails> = {},
): AstatkaBagDetails {
  return {
    client_code: "SS KODSIZ",
    client_name: null,
    source_flight_name: "M262-M263",
    weight_kg: null,
    cargos: [cargo()],
    other_cargos: [],
    ...overrides,
  };
}

const summary: BagSummary = {
  statusLabel: "Tasdiqlash kerak",
  statusTone: "brand",
  clientCode: "SS KODSIZ",
  clientName: null,
  sourceFlight: "M262-M263",
  weightKg: null,
  weightEdited: false,
  photoReport: "Bor · 1 ta",
  payment: null,
  takenAway: false,
  confirmedBy: null,
  timeIso: null,
  comment: null,
  trackCodes: ["YT100", "YT200"],
  notes: [],
};

const initialEdit: BagEditValues = {
  clientCode: "SS KODSIZ",
  sourceFlight: "M262-M263",
  weightKg: null,
  comment: "",
  trackCodes: ["YT100", "YT200"],
};

interface HarnessProps {
  initialMode?: BagSheetMode;
  onWeightChanged?: (weightKg: number | null) => void;
  onSave?: (changes: BagEditChanges) => void;
  current?: BagEditValues;
  locked?: BagEditLocks;
  disabledReason?: string;
}

/** BagSheet's mode is the caller's state; the harness plays the caller. */
function Harness({
  initialMode = "view",
  onWeightChanged,
  onSave = vi.fn(),
  current = initialEdit,
  locked,
  disabledReason,
}: HarnessProps) {
  const [mode, setMode] = useState<BagSheetMode>(initialMode);
  return (
    <BagSheet
      flightName="OSTATKA.202"
      title="SS KODSIZ"
      summary={summary}
      bag={{ clientCode: "SS KODSIZ", sourceFlight: "M262-M263" }}
      isOnline
      mode={mode}
      onModeChange={setMode}
      onClose={vi.fn()}
      footer={
        <button type="button" onClick={() => setMode("edit")}>
          Tahrirlash
        </button>
      }
      edit={{ current, locked, saving: false, disabledReason, onSave }}
      onWeightChanged={onWeightChanged}
    />
  );
}

/** Renders the sheet; the returned function re-renders it with new props. */
function renderSheet(props: HarnessProps = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
  return (next: HarnessProps) =>
    view.rerender(
      <QueryClientProvider client={client}>
        <Harness {...next} />
      </QueryClientProvider>,
    );
}

beforeEach(() => {
  vi.clearAllMocks();
  photos.mockResolvedValue([
    { index: 0, url: "https://files.example/a.webp", error: null },
    { index: 1, url: null, error: "Rasm havolasini olib bo'lmadi." },
  ]);
});

describe("BagSheet — photo report", () => {
  it("shows the bag's facts, then the photo report's rows, photos and facts", async () => {
    details.mockResolvedValue(bagDetails());
    renderSheet();

    expect(
      screen.getByRole("region", { name: "Yuk haqida" }),
    ).toBeInTheDocument();
    expect(screen.getByText("YT200")).toBeInTheDocument();
    expect(
      await screen.findByText("Foto hisobot yozuvi №11"),
    ).toBeInTheDocument();
    expect(screen.getByText("Qutisi yirtilgan")).toBeInTheDocument();
    expect(screen.getByText("$9.5")).toBeInTheDocument();
    expect(await screen.findByAltText("1-rasm")).toHaveAttribute(
      "src",
      "https://files.example/a.webp",
    );
    expect(
      screen.getByText("Rasm havolasini olib bo'lmadi."),
    ).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Rasmlarni qayta olish" }),
    ).toBeInTheDocument();
  });

  it("saves a typed weight to the photo report and reports the bag's new total", async () => {
    details.mockResolvedValue(
      bagDetails({
        weight_kg: 2,
        cargos: [cargo(), cargo({ id: 12, weight_kg: 2, photo_count: 0 })],
      }),
    );
    saveWeight.mockResolvedValue({
      cargo: cargo({ weight_kg: 12.5 }),
      synced_packages: 1,
    });
    const onWeightChanged = vi.fn();
    renderSheet({ onWeightChanged });

    fireEvent.click(
      await screen.findByRole("button", { name: "Og'irlik kiritish" }),
    );
    const input = screen.getByLabelText("Og'irlik, kg");
    fireEvent.change(input, { target: { value: "12,5" } });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() =>
      expect(saveWeight).toHaveBeenCalledWith("OSTATKA.202", 11, 12.5),
    );
    await waitFor(() => expect(onWeightChanged).toHaveBeenCalledWith(14.5));
  });

  it("re-takes one photo from the full-size view", async () => {
    details.mockResolvedValue(bagDetails());
    replacePhotos.mockResolvedValue({ cargo: cargo(), synced_packages: 0 });
    renderSheet();

    fireEvent.click(
      await screen.findByRole("button", { name: "2-rasmni kattalashtirish" }),
    );
    expect(await screen.findByText("2 / 2")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Shu rasmni qayta olish" }),
    );
    const picker = document.querySelector<HTMLInputElement>(
      'input[type="file"]:not([multiple])',
    );
    expect(picker).not.toBeNull();
    const file = new File(["x"], "new.jpg", { type: "image/jpeg" });
    fireEvent.change(picker!, { target: { files: [file] } });

    await waitFor(() =>
      expect(replacePhotos).toHaveBeenCalledWith("OSTATKA.202", 11, [file], 1),
    );
  });

  it("explains a missing photo report and lists the client's other flights", async () => {
    details.mockResolvedValue(
      bagDetails({
        cargos: [],
        other_cargos: [
          cargo({ id: 5, flight_name: "M250", weight_kg: 3.2, photo_count: 0 }),
        ],
      }),
    );
    renderSheet();

    expect(
      await screen.findByText(
        /M262-M263 reysining foto hisobotida bu mijoz yo'q/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("M250")).toBeInTheDocument();
    expect(screen.getByText("3.2 kg")).toBeInTheDocument();
    expect(screen.getByText("Rasm yo'q")).toBeInTheDocument();
    // Another flight's row is shown for reference, not changed from here.
    expect(screen.queryByRole("button", { name: "O'zgartirish" })).toBeNull();
  });

  it("is a modal dialog", () => {
    details.mockResolvedValue(bagDetails());
    renderSheet();
    expect(screen.getByRole("dialog", { name: "SS KODSIZ" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
  });

  it("gives the focus back to a single photo once its full-size view closes", async () => {
    details.mockResolvedValue(
      bagDetails({ cargos: [cargo({ photo_count: 1 })] }),
    );
    photos.mockResolvedValue([
      { index: 0, url: "https://files.example/a.webp", error: null },
    ]);
    renderSheet();

    const photo = await screen.findByRole("button", {
      name: "1-rasmni kattalashtirish",
    });
    photo.focus();
    fireEvent.click(photo);
    const viewer = await screen.findByRole("dialog", { name: "1 / 1" });
    fireEvent.keyDown(viewer, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "1 / 1" })).toBeNull(),
    );
    await waitFor(() => expect(document.activeElement).toBe(photo));
  });

  it("offers a retry when the photo report cannot be read", async () => {
    details
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(bagDetails());
    renderSheet();

    fireEvent.click(
      await screen.findByRole("button", { name: "Qayta urinish" }),
    );
    expect(
      await screen.findByText("Foto hisobot yozuvi №11"),
    ).toBeInTheDocument();
  });
});

describe("BagSheet — edit mode", () => {
  it("swaps the facts for the form in the same window, and Bekor brings them back", async () => {
    details.mockResolvedValue(bagDetails());
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Tahrirlash" }));
    expect(
      screen.getByRole("dialog", { name: "Tahrirlash · SS KODSIZ" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Yukni tahrirlash" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Yuk haqida" })).toBeNull();
    // Still one window: the photo report stays under the form.
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      await screen.findByText("Foto hisobot yozuvi №11"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bekor qilish" }));
    expect(screen.queryByRole("form", { name: "Yukni tahrirlash" })).toBeNull();
    expect(
      screen.getByRole("region", { name: "Yuk haqida" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "SS KODSIZ" }),
    ).toBeInTheDocument();
  });

  it("opens straight in edit mode and Saqlash hands over only what was changed", async () => {
    details.mockResolvedValue(bagDetails());
    const onSave = vi.fn();
    renderSheet({ initialMode: "edit", onSave });

    fireEvent.change(screen.getByLabelText(/Og'irligi \(kg\)/), {
      target: { value: "4,5" },
    });
    fireEvent.change(screen.getByLabelText("Izoh"), {
      target: { value: " qopi yirtilgan " },
    });
    fireEvent.change(screen.getByLabelText(/Trek kodlar/), {
      target: { value: "yt100\nYT300" },
    });
    // Typed, but back to what it was: not a change.
    fireEvent.change(screen.getByLabelText("Mijoz kodi"), {
      target: { value: "ss kodsiz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        weightKg: 4.5,
        comment: "qopi yirtilgan",
        trackCodes: ["YT100", "YT300"],
      }),
    );
  });

  it("lets an untouched field follow the bag while the form is open, and never saves it", () => {
    details.mockResolvedValue(bagDetails());
    const onSave = vi.fn();
    const rerender = renderSheet({
      initialMode: "edit",
      onSave,
      current: { ...initialEdit, weightKg: 5 },
    });
    expect(screen.getByLabelText(/Og'irligi \(kg\)/)).toHaveValue("5");

    // The weight was fixed in the photo report below the form.
    rerender({ onSave, current: { ...initialEdit, weightKg: 7 } });
    expect(screen.getByLabelText(/Og'irligi \(kg\)/)).toHaveValue("7");

    fireEvent.change(screen.getByLabelText("Izoh"), {
      target: { value: "qopi yirtilgan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(onSave).toHaveBeenCalledWith({ comment: "qopi yirtilgan" });
  });

  it("keeps a typed weight even when the bag's weight changes underneath", () => {
    details.mockResolvedValue(bagDetails());
    const onSave = vi.fn();
    const rerender = renderSheet({
      initialMode: "edit",
      onSave,
      current: { ...initialEdit, weightKg: 5 },
    });

    fireEvent.change(screen.getByLabelText(/Og'irligi \(kg\)/), {
      target: { value: "6" },
    });
    rerender({ onSave, current: { ...initialEdit, weightKg: 7 } });
    expect(screen.getByLabelText(/Og'irligi \(kg\)/)).toHaveValue("6");
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(onSave).toHaveBeenCalledWith({ weightKg: 6 });
  });

  it("keeps the form and what was typed while saving has to wait", () => {
    details.mockResolvedValue(bagDetails());
    const onSave = vi.fn();
    const rerender = renderSheet({ initialMode: "edit", onSave });

    fireEvent.change(screen.getByLabelText("Izoh"), {
      target: { value: "qopi yirtilgan" },
    });
    rerender({ onSave, disabledReason: "Yuk saqlanmoqda" });

    expect(
      screen.getByRole("form", { name: "Yukni tahrirlash" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Izoh")).toHaveValue("qopi yirtilgan");
    const save = screen.getByRole("button", { name: "Saqlash" });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription("Yuk saqlanmoqda");

    rerender({ onSave });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(onSave).toHaveBeenCalledWith({ comment: "qopi yirtilgan" });
  });

  it("says when a field got locked after something was typed into it, and leaves it out", () => {
    details.mockResolvedValue(bagDetails());
    const onSave = vi.fn();
    const rerender = renderSheet({ initialMode: "edit", onSave });

    fireEvent.change(screen.getByLabelText("Mijoz kodi"), {
      target: { value: "SS999" },
    });
    // The bag got confirmed meanwhile.
    rerender({ onSave, locked: { clientCode: true, sourceFlight: true } });

    expect(screen.getByLabelText("Mijoz kodi")).toHaveValue("SS KODSIZ");
    expect(screen.getByLabelText("Mijoz kodi")).toBeDisabled();
    expect(screen.getByText(/«SS999» saqlanmaydi/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(onSave).toHaveBeenCalledWith({});
  });

  it("refuses an empty client code without saving", () => {
    details.mockResolvedValue(bagDetails());
    const onSave = vi.fn();
    renderSheet({ initialMode: "edit", onSave });

    fireEvent.change(screen.getByLabelText("Mijoz kodi"), {
      target: { value: "  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Mijoz kodini yozing.");
    expect(onSave).not.toHaveBeenCalled();
  });
});
