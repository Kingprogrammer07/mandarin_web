import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("@/api/services/astatkaFlights", () => ({
  astatkaBagQueryKey: (name: string, ref: object) => ["astatka-bag", name, JSON.stringify(ref)],
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
} from "@/api/services/astatkaFlights";
import { BagDetailsDialog } from "./BagDetailsDialog";

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

function renderDialog(onWeightChanged = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BagDetailsDialog
        flightName="OSTATKA.202"
        bag={{ clientCode: "SS KODSIZ", sourceFlight: "M262-M263" }}
        title="SS KODSIZ"
        isOnline
        onClose={vi.fn()}
        onWeightChanged={onWeightChanged}
      />
    </QueryClientProvider>,
  );
  return onWeightChanged;
}

beforeEach(() => {
  vi.clearAllMocks();
  photos.mockResolvedValue([
    { index: 0, url: "https://files.example/a.webp", error: null },
    { index: 1, url: null, error: "Rasm havolasini olib bo'lmadi." },
  ]);
});

describe("BagDetailsDialog", () => {
  it("shows the photo report's rows, photos and facts", async () => {
    details.mockResolvedValue({
      client_code: "SS KODSIZ",
      client_name: null,
      source_flight_name: "M262-M263",
      weight_kg: null,
      cargos: [cargo()],
      other_cargos: [],
    });
    renderDialog();

    expect(await screen.findByText("Foto hisobot yozuvi №11")).toBeInTheDocument();
    expect(screen.getByText("Qutisi yirtilgan")).toBeInTheDocument();
    expect(screen.getByText("$9.5")).toBeInTheDocument();
    expect(await screen.findByAltText("1-rasm")).toHaveAttribute(
      "src",
      "https://files.example/a.webp",
    );
    expect(screen.getByText("Rasm havolasini olib bo'lmadi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rasmlarni qayta olish" })).toBeInTheDocument();
  });

  it("saves a typed weight to the photo report and reports the bag's new total", async () => {
    details.mockResolvedValue({
      client_code: "SS KODSIZ",
      client_name: null,
      source_flight_name: "M262-M263",
      weight_kg: 2,
      cargos: [cargo(), cargo({ id: 12, weight_kg: 2, photo_count: 0 })],
      other_cargos: [],
    });
    saveWeight.mockResolvedValue({ cargo: cargo({ weight_kg: 12.5 }), synced_packages: 1 });
    const onWeightChanged = renderDialog();

    fireEvent.click(await screen.findByRole("button", { name: "Og'irlik kiritish" }));
    const input = screen.getByLabelText("Og'irlik, kg");
    fireEvent.change(input, { target: { value: "12,5" } });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(saveWeight).toHaveBeenCalledWith("OSTATKA.202", 11, 12.5));
    await waitFor(() => expect(onWeightChanged).toHaveBeenCalledWith(14.5));
  });

  it("re-takes one photo from the full-size view", async () => {
    details.mockResolvedValue({
      client_code: "SS KODSIZ",
      client_name: null,
      source_flight_name: "M262-M263",
      weight_kg: null,
      cargos: [cargo()],
      other_cargos: [],
    });
    replacePhotos.mockResolvedValue({ cargo: cargo(), synced_packages: 0 });
    renderDialog();

    fireEvent.click(await screen.findByRole("button", { name: "2-rasmni kattalashtirish" }));
    fireEvent.click(screen.getByRole("button", { name: "Shu rasmni qayta olish" }));
    const picker = document.querySelector<HTMLInputElement>('input[type="file"]:not([multiple])');
    expect(picker).not.toBeNull();
    const file = new File(["x"], "new.jpg", { type: "image/jpeg" });
    fireEvent.change(picker!, { target: { files: [file] } });

    await waitFor(() =>
      expect(replacePhotos).toHaveBeenCalledWith("OSTATKA.202", 11, [file], 1),
    );
  });

  it("explains a missing photo report and lists the client's other flights", async () => {
    details.mockResolvedValue({
      client_code: "SS KODSIZ",
      client_name: null,
      source_flight_name: "M262-M263",
      weight_kg: null,
      cargos: [],
      other_cargos: [cargo({ id: 5, flight_name: "M250", weight_kg: 3.2, photo_count: 0 })],
    });
    renderDialog();

    expect(
      await screen.findByText(/M262-M263 reysining foto hisobotida bu mijoz yo'q/),
    ).toBeInTheDocument();
    expect(screen.getByText("M250")).toBeInTheDocument();
    expect(screen.getByText("3.2 kg")).toBeInTheDocument();
    // Another flight's row is shown for reference, not changed from here.
    expect(screen.queryByRole("button", { name: "O'zgartirish" })).toBeNull();
  });
});
