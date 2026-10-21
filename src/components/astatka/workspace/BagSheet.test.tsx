import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("@/api/services/astatkaFlights", () => ({
  astatkaBagQueryKey: (name: string, ref: object) => [
    "astatka-bag",
    name,
    JSON.stringify(ref),
  ],
  astatkaCargoPhotosQueryKey: (id: number) => ["astatka-cargo-photos", id],
  astatkaPackagePhotosQueryKey: (id: number) => ["astatka-package-photos", id],
  astatkaPackagesQueryKey: (name: string) => ["astatka-packages", name],
  astatkaStatsQueryKey: ["astatka-flight-stats"],
  getAstatkaBagDetails: vi.fn(),
  getAstatkaCargoPhotos: vi.fn(),
  getAstatkaPackagePhotos: vi.fn(),
  replaceAstatkaPackagePhotos: vi.fn(),
}));

import {
  getAstatkaBagDetails,
  getAstatkaCargoPhotos,
  getAstatkaPackagePhotos,
  replaceAstatkaPackagePhotos,
  type AstatkaBagCargo,
  type AstatkaBagDetails,
  type AstatkaBagRef,
  type AstatkaPackage,
} from "@/api/services/astatkaFlights";
import type { BagSummary } from "@/lib/astatkaBagSummary";

import type {
  BagEditChanges,
  BagEditHints,
  BagEditLocks,
  BagEditValues,
} from "./BagEditForm";
import { BagSheet, type BagSheetMode } from "./BagSheet";

const details = vi.mocked(getAstatkaBagDetails);
const photos = vi.mocked(getAstatkaCargoPhotos);
const ownPhotos = vi.mocked(getAstatkaPackagePhotos);
const retakeOwnPhotos = vi.mocked(replaceAstatkaPackagePhotos);

const SCAN_BAG: AstatkaBagRef = { clientCode: "SS KODSIZ", sourceFlight: "M262-M263" };

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
  sourceCompany: "",
  sourceCompanyName: "",
  astatkaSent: null,
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
  bag?: AstatkaBagRef;
  onPackageChanged?: (pkg: AstatkaPackage) => void;
  onSave?: (changes: BagEditChanges) => void;
  current?: BagEditValues;
  locked?: BagEditLocks;
  hints?: BagEditHints;
  codesBase?: number | null;
  disabledReason?: string;
}

/** BagSheet's mode is the caller's state; the harness plays the caller. */
function Harness({
  initialMode = "view",
  bag = SCAN_BAG,
  onPackageChanged,
  onSave = vi.fn(),
  current = initialEdit,
  locked,
  hints,
  codesBase,
  disabledReason,
}: HarnessProps) {
  const [mode, setMode] = useState<BagSheetMode>(initialMode);
  return (
    <BagSheet
      flightName="OSTATKA.202"
      title="SS KODSIZ"
      summary={summary}
      bag={bag}
      isOnline
      mode={mode}
      onModeChange={setMode}
      onClose={vi.fn()}
      footer={
        <button type="button" onClick={() => setMode("edit")}>
          Tahrirlash
        </button>
      }
      edit={{ current, locked, hints, codesBase, saving: false, disabledReason, onSave }}
      onPackageChanged={onPackageChanged}
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
  it("shows the bag's facts, then the old flight's photo report, read-only", async () => {
    details.mockResolvedValue(bagDetails());
    renderSheet();

    expect(
      screen.getByRole("region", { name: "Yuk haqida" }),
    ).toBeInTheDocument();
    expect(screen.getByText("YT200")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Eski reys (M262-M263) foto hisoboti" }),
    ).toBeInTheDocument();
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
    // The server opens only this bag's rows, so the photos ask with the bag.
    expect(photos).toHaveBeenCalledWith("OSTATKA.202", 11, SCAN_BAG);
    // Nothing on the old flight's record can be changed from the astatka.
    expect(screen.queryByRole("button", { name: /Rasm/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Og'irlik kiritish" })).toBeNull();
    expect(screen.queryByLabelText("Og'irlik, kg")).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("has no full-size re-take for the old flight's photos", async () => {
    details.mockResolvedValue(bagDetails());
    renderSheet();

    fireEvent.click(
      await screen.findByRole("button", { name: "2-rasmni kattalashtirish" }),
    );
    expect(await screen.findByText("2 / 2")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Shu rasmni qayta olish" }),
    ).toBeNull();
  });

  it("offers no own photos for a bag that is not saved yet", async () => {
    details.mockResolvedValue(bagDetails());
    renderSheet();
    await screen.findByText("Foto hisobot yozuvi №11");
    expect(screen.queryByRole("region", { name: "Astatka rasmlari" })).toBeNull();
    expect(ownPhotos).not.toHaveBeenCalled();
  });
});

describe("BagSheet — the astatka's own photos", () => {
  const savedBag: AstatkaBagRef = { packageId: 41 };

  it("takes the first photos of a saved bag and hands the bag back", async () => {
    details.mockResolvedValue(bagDetails());
    ownPhotos.mockResolvedValue([]);
    const updated = { id: 41, own_photo_count: 1 } as AstatkaPackage;
    retakeOwnPhotos.mockResolvedValue({
      package: updated,
      photos: [{ index: 0, url: "https://files.example/own.webp", error: null }],
    });
    const onPackageChanged = vi.fn();
    renderSheet({ bag: savedBag, onPackageChanged });

    const own = screen.getByRole("region", { name: "Astatka rasmlari" });
    expect(
      await within(own).findByText(/Hali rasm olinmagan/),
    ).toBeInTheDocument();
    fireEvent.click(within(own).getByRole("button", { name: "Rasm olish" }));
    // The in-app camera opens; jsdom has none, so it offers the gallery.
    const camera = await screen.findByRole("dialog", { name: "Rasm olish" });
    expect(
      await within(camera).findByRole("button", { name: /Galereyadan tanlash/ }),
    ).toBeInTheDocument();
    const picker = camera.querySelector<HTMLInputElement>('input[type="file"][multiple]');
    expect(picker).not.toBeNull();
    const file = new File(["x"], "new.jpg", { type: "image/jpeg" });
    fireEvent.change(picker!, { target: { files: [file] } });
    expect(retakeOwnPhotos).not.toHaveBeenCalled();
    fireEvent.click(within(camera).getByRole("button", { name: "Tayyor" }));

    await waitFor(() =>
      expect(retakeOwnPhotos).toHaveBeenCalledWith("OSTATKA.202", 41, [file], undefined),
    );
    await waitFor(() => expect(onPackageChanged).toHaveBeenCalledWith(updated));
    expect(await within(own).findByAltText("1-rasm")).toHaveAttribute(
      "src",
      "https://files.example/own.webp",
    );
  });

  it("re-takes one of the bag's own photos from the full-size view", async () => {
    details.mockResolvedValue(bagDetails());
    ownPhotos.mockResolvedValue([
      { index: 0, url: "https://files.example/o1.webp", error: null },
      { index: 1, url: "https://files.example/o2.webp", error: null },
    ]);
    retakeOwnPhotos.mockResolvedValue({
      package: { id: 41 } as AstatkaPackage,
      photos: [],
    });
    renderSheet({ bag: savedBag });

    const own = screen.getByRole("region", { name: "Astatka rasmlari" });
    fireEvent.click(
      await within(own).findByRole("button", { name: "2-rasmni kattalashtirish" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Shu rasmni qayta olish" }),
    );
    const camera = await screen.findByRole("dialog", { name: "2-rasmni qayta olish" });
    const picker = camera.querySelector<HTMLInputElement>(
      'input[type="file"]:not([multiple])',
    );
    expect(picker).not.toBeNull();
    const file = new File(["x"], "new.jpg", { type: "image/jpeg" });
    fireEvent.change(picker!, { target: { files: [file] } });

    await waitFor(() =>
      expect(retakeOwnPhotos).toHaveBeenCalledWith("OSTATKA.202", 41, [file], 1),
    );
  });
});

describe("BagSheet — photo report, other flights", () => {
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
        trackCodesBase: null,
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
    rerender({
      onSave,
      locked: { clientCode: true, sourceFlight: true, byConfirm: true },
    });

    expect(screen.getByLabelText("Mijoz kodi")).toHaveValue("SS KODSIZ");
    expect(screen.getByLabelText("Mijoz kodi")).toBeDisabled();
    expect(
      screen.getByText(/Yuk tasdiqlandi — «SS999» saqlanmaydi/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(onSave).toHaveBeenCalledWith({});
  });

  it("blames the partner, not a confirm, when a code turns out to be a partner's", () => {
    details.mockResolvedValue(bagDetails());
    const onSave = vi.fn();
    const rerender = renderSheet({
      initialMode: "edit",
      onSave,
      current: { ...initialEdit, clientCode: "" },
    });

    fireEvent.change(screen.getByLabelText("Mijoz kodi"), {
      target: { value: "SS999" },
    });
    // The check came back: the code may be another cargo's.
    rerender({
      onSave,
      current: { ...initialEdit, clientCode: "" },
      locked: { clientCode: true, sourceFlight: true },
      hints: { clientCode: "Bu kod boshqa kargoniki bo'lishi mumkin." },
    });

    expect(screen.queryByText(/Yuk tasdiqlandi/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "«SS999» saqlanmaydi. Bu kod boshqa kargoniki bo'lishi mumkin.",
      ),
    ).toBeInTheDocument();
  });

  it("saves a comment on a bag whose client is locked and still empty", () => {
    details.mockResolvedValue(bagDetails());
    const onSave = vi.fn();
    renderSheet({
      initialMode: "edit",
      onSave,
      current: { ...initialEdit, clientCode: "" },
      locked: { clientCode: true, sourceFlight: true },
    });

    fireEvent.change(screen.getByLabelText("Izoh"), {
      target: { value: "qopi yirtilgan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onSave).toHaveBeenCalledWith({ comment: "qopi yirtilgan" });
  });

  it("lets a confirmed bag's codes be replaced", () => {
    details.mockResolvedValue(bagDetails());
    const onSave = vi.fn();
    renderSheet({
      initialMode: "edit",
      onSave,
      locked: { clientCode: true, sourceFlight: true },
    });

    fireEvent.change(screen.getByLabelText(/Trek kodlar/), {
      target: { value: "YT100\nYT999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onSave).toHaveBeenCalledWith({ trackCodes: ["YT100", "YT999"], trackCodesBase: null });
  });

  it("says which saved bag's list the codes were typed over, as it was when typing began", () => {
    details.mockResolvedValue(bagDetails());
    const onSave = vi.fn();
    // Nothing named yet when the worker starts typing the label's codes …
    const rerender = renderSheet({ initialMode: "edit", onSave, codesBase: null });
    fireEvent.change(screen.getByLabelText(/Trek kodlar/), {
      target: { value: "YT100\nYT999" },
    });
    // … then the answer names bag 7 while the form is still open.
    rerender({
      initialMode: "edit",
      onSave,
      codesBase: 7,
      current: { ...initialEdit, trackCodes: ["YT100", "YT200", "YT300"] },
    });
    fireEvent.change(screen.getByLabelText(/Trek kodlar/), {
      target: { value: "YT100\nYT999\nYT555" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(onSave).toHaveBeenCalledWith({
      trackCodes: ["YT100", "YT999", "YT555"],
      trackCodesBase: null,
    });
  });

  it("ties codes typed over a saved bag's list to that bag", () => {
    details.mockResolvedValue(bagDetails());
    const onSave = vi.fn();
    renderSheet({ initialMode: "edit", onSave, codesBase: 7 });
    fireEvent.change(screen.getByLabelText(/Trek kodlar/), {
      target: { value: "YT100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(onSave).toHaveBeenCalledWith({ trackCodes: ["YT100"], trackCodesBase: 7 });
  });

  it("refuses to save a bag with every code deleted", () => {
    details.mockResolvedValue(bagDetails());
    const onSave = vi.fn();
    renderSheet({ initialMode: "edit", onSave });

    fireEvent.change(screen.getByLabelText(/Trek kodlar/), {
      target: { value: "  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kamida bitta trek kod yozing.",
    );
    expect(onSave).not.toHaveBeenCalled();
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

describe("BagSheet — a partner cargo's bag", () => {
  it("shows the partner's data instead of our photo report, and never reads ours", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <BagSheet
          flightName="OSTATKA.202"
          title="ZZ17"
          summary={{
            ...summary,
            clientCode: "ZZ17",
            sourceFlight: "M200",
            sourceCompany: "AKB",
            sourceCompanyName: "AKB",
          }}
          bag={null}
          partner={{
            companyName: "AKB",
            bag: {
              flight_name: "M200",
              weight_kg: 12.5,
              price_per_kg: 8,
              rows: 2,
              photo_count: 3,
              comment: null,
              is_sent: true,
              created_at: null,
              updated_at: null,
            },
          }}
          isOnline
          mode="view"
          onModeChange={vi.fn()}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("region", { name: "AKB ma'lumoti" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Foto hisobot" })).toBeNull();
    expect(details).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "ZZ17" })).toHaveAccessibleDescription(
      "AKB · M200",
    );
    const facts = screen.getByRole("region", { name: "Yuk haqida" });
    expect(within(facts).getByText("AKB · API")).toBeInTheDocument();
    // Our payment rows know nothing about the partner's bag.
    expect(within(facts).queryByText("To'lov")).toBeNull();
    expect(within(facts).queryByText("Olib ketilganmi")).toBeNull();
  });
});
