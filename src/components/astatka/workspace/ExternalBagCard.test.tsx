import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  getAstatkaExternalPhotos,
  type AstatkaExternalBag,
} from "@/api/services/astatkaFlights";

// Hand-built: the real module reads the API base URL at import.
vi.mock("@/api/services/astatkaFlights", () => ({
  astatkaExternalPhotosRootKey: ["astatka-external-photos"],
  astatkaExternalPhotosQueryKey: (packageId: number) => ["astatka-external-photos", packageId],
  getAstatkaExternalPhotos: vi.fn(),
}));

import { ExternalBagCard, type ExternalBagCardProps } from "./ExternalBagCard";

function bag(overrides: Partial<AstatkaExternalBag> = {}): AstatkaExternalBag {
  return {
    flight_name: "M200",
    weight_kg: 12.5,
    price_per_kg: 8,
    rows: 2,
    photo_count: 3,
    comment: "Qopi yirtilgan",
    is_sent: false,
    created_at: "2026-10-01T05:00:00Z",
    updated_at: null,
    ...overrides,
  };
}

const m200 = bag();
const m199 = bag({ flight_name: "M199", weight_kg: 7, rows: 1, photo_count: 0 });

function renderCard(props: Partial<ExternalBagCardProps> = {}) {
  return render(<ExternalBagCard companyName="AKB" bag={m200} {...props} />);
}

function renderStored(saved: AstatkaExternalBag) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ExternalBagCard
        companyName="AKB"
        bag={saved}
        storedPhotos={{ flightName: "OSTATKA.1", packageId: 42 }}
      />
    </QueryClientProvider>,
  );
}

/** A fact's value: the <dd> right after its <dt>. */
function fact(label: string): string {
  return screen.getByText(label, { selector: "dt" }).nextElementSibling?.textContent ?? "";
}

describe("ExternalBagCard", () => {
  it("shows the partner's facts under its own title and API chip", () => {
    renderCard();

    const section = screen.getByRole("region", { name: "AKB ma'lumoti" });
    expect(within(section).getByText("AKB · API")).toBeInTheDocument();
    expect(fact("Reys")).toBe("M200");
    expect(fact("Og'irligi")).toBe("12.5 kg");
    expect(fact("1 kg narxi")).toBe("$8.00");
    expect(fact("Foto hisobot qatorlari")).toBe("2 ta");
    expect(fact("Mijozga yuborilganmi")).toBe("Yo'q");
    expect(fact("Yaratilgan vaqti")).toBe("01.10.2026, 10:00");
    expect(screen.getByText("Qopi yirtilgan")).toBeInTheDocument();
  });

  it("only counts photos the partner keeps to itself", () => {
    renderCard();
    expect(fact("Rasmlar")).toBe("3 ta rasm AKB tizimida — bu yerda ko'rinmaydi");
    expect(screen.queryByRole("button", { name: /rasmni kattalashtirish/ })).toBeNull();
  });

  it("says so when the bag has no photos", () => {
    renderCard({ bag: bag({ photo_count: 0, photo_urls: [] }) });
    expect(fact("Rasmlar")).toBe("Rasm yo'q");
  });

  it("shows the photos the partner's API linked, each opening full size", () => {
    renderCard({
      bag: bag({
        photo_count: 2,
        photo_urls: ["https://partner.example/a.jpg", "https://partner.example/b.jpg"],
      }),
    });

    expect(screen.getByText("Rasmlar · 2 ta", { selector: "dt" })).toBeInTheDocument();
    expect(screen.queryByText(/tizimida/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "2-rasmni kattalashtirish" }));

    const viewer = screen.getByRole("dialog", { name: "2 / 2" });
    expect(within(viewer).getByAltText("2-rasm")).toHaveAttribute(
      "src",
      "https://partner.example/b.jpg",
    );
    // The partner's photos are not ours to re-take.
    expect(within(viewer).queryByRole("button", { name: "Shu rasmni qayta olish" })).toBeNull();
  });

  it("lets the worker pick the bag's flight among the client's partner flights", () => {
    const onPickFlight = vi.fn();
    renderCard({
      options: [m200, m199],
      selectedFlight: "M200",
      flightKnown: true,
      onPickFlight,
    });

    const group = screen.getByRole("radiogroup", { name: "Qaysi reysdan · 2 ta" });
    expect(within(group).getByRole("radio", { name: /M200/ })).toBeChecked();
    expect(within(group).getByRole("radio", { name: /M199/ })).not.toBeChecked();
    // Known flight: nothing to warn about.
    expect(screen.queryByText(/eng oxirgi reys tanlandi/)).toBeNull();

    fireEvent.click(within(group).getByRole("radio", { name: /M199/ }));
    expect(onPickFlight).toHaveBeenCalledWith("M199");
  });

  it("warns when the partner did not say which flight the code is in", () => {
    renderCard({
      options: [m200, m199],
      selectedFlight: "M200",
      flightKnown: false,
      onPickFlight: vi.fn(),
    });
    expect(
      screen.getByText(
        "Kod qaysi reysga tegishli ekanini AKB aytmadi — eng oxirgi reys tanlandi. Qopdagi yozuvga qarab tekshiring.",
      ),
    ).toBeInTheDocument();
  });

  it("offers no choice once the bag is saved, or when there is only one flight", () => {
    const { rerender } = renderCard({ options: [m200, m199], flightKnown: false });
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByText(/eng oxirgi reys tanlandi/)).toBeNull();

    rerender(
      <ExternalBagCard companyName="AKB" bag={m200} options={[m200]} onPickFlight={vi.fn()} />,
    );
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("shows a saved bag's photos from the copies in our storage", async () => {
    vi.mocked(getAstatkaExternalPhotos).mockResolvedValue({
      photos: [
        { index: 0, url: "https://s3.example/a.webp", error: null },
        { index: 1, url: "https://s3.example/b.webp", error: null },
      ],
      pending: 0,
    });
    renderStored(bag({ photo_urls: [], stored_photos: 2 }));

    expect(
      await screen.findAllByRole("button", { name: /rasmni kattalashtirish/ }),
    ).toHaveLength(2);
    expect(getAstatkaExternalPhotos).toHaveBeenCalledWith("OSTATKA.1", 42);
    expect(screen.getByText("Rasmlar · 2 ta", { selector: "dt" })).toBeInTheDocument();
  });

  it("asks a bag confirmed a moment ago for its copies while they are made", async () => {
    vi.mocked(getAstatkaExternalPhotos).mockReset();
    vi.mocked(getAstatkaExternalPhotos)
      .mockResolvedValueOnce({ photos: [], pending: 3 })
      .mockResolvedValue({
        photos: [{ index: 0, url: "https://s3.example/a.webp", error: null }],
        pending: 0,
      });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      // The view came with the confirm, before the copy ran: stored_photos 0.
      renderStored(bag({ photo_urls: [], stored_photos: 0 }));
      expect(await screen.findByText("Rasmlar nusxalanmoqda…")).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(3100);
      expect(
        await screen.findAllByRole("button", { name: /rasmni kattalashtirish/ }),
      ).toHaveLength(1);
      expect(getAstatkaExternalPhotos).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops asking after a minute and leaves a button to ask again", async () => {
    vi.mocked(getAstatkaExternalPhotos).mockReset();
    vi.mocked(getAstatkaExternalPhotos).mockResolvedValue({ photos: [], pending: 3 });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderStored(bag({ photo_urls: [], stored_photos: 0 }));
      expect(await screen.findByText("Rasmlar nusxalanmoqda…")).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(61_000);
      expect(await screen.findByText("Rasmlar hali nusxalanmadi.")).toBeInTheDocument();
      const asked = vi.mocked(getAstatkaExternalPhotos).mock.calls.length;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(getAstatkaExternalPhotos).toHaveBeenCalledTimes(asked);

      vi.mocked(getAstatkaExternalPhotos).mockResolvedValue({
        photos: [{ index: 0, url: "https://s3.example/a.webp", error: null }],
        pending: 0,
      });
      fireEvent.click(screen.getByRole("button", { name: "Yangilash" }));
      expect(
        await screen.findAllByRole("button", { name: /rasmni kattalashtirish/ }),
      ).toHaveLength(1);
      expect(screen.queryByText("Rasmlar hali nusxalanmadi.")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("says the photos stay with the partner when no copy exists", async () => {
    vi.mocked(getAstatkaExternalPhotos).mockReset();
    vi.mocked(getAstatkaExternalPhotos).mockResolvedValue({ photos: [], pending: 0 });
    renderStored(bag({ photo_urls: [], stored_photos: 0 }));
    expect(
      await screen.findByText("3 ta rasm AKB tizimida — bu yerda ko'rinmaydi"),
    ).toBeInTheDocument();
  });

  it("does not ask for photos a bag does not have", () => {
    vi.mocked(getAstatkaExternalPhotos).mockReset();
    renderCard({
      bag: bag({ photo_urls: [], stored_photos: 0, photo_count: 0 }),
      storedPhotos: { flightName: "OSTATKA.1", packageId: 42 },
    });
    expect(fact("Rasmlar")).toBe("Rasm yo'q");
    expect(getAstatkaExternalPhotos).not.toHaveBeenCalled();
  });

  it("says when a saved bag kept no partner data", () => {
    renderCard({ bag: null });
    expect(screen.getByText("AKB ma'lumoti bu yuk bilan saqlanmagan.")).toBeInTheDocument();
  });
});
