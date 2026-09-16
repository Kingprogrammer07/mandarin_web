import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n/config";
import uz from "@/i18n/locales/uz.json";
import ru from "@/i18n/locales/ru.json";
import type {
  CargoItemResponse,
  PublicTrackingStepStatus,
  TrackCodeSearchResponse,
} from "@/api/services/cargo";
import { TrackResultCard } from "./TrackResultCard";

// The owner's wording for what each stage means.
const STAGE_NAMES = [
  "Xitoy omborida",
  "Yo'lda",
  "Bojxonada",
  "Toshkent omborida",
  "Fotohisobot jo'natilgan",
  "Olib ketilgan",
];

// What the backend still sends as titles; the translation has to win.
const BACKEND_TITLES = [
  "Xitoy omborida",
  "Yo'lda",
  "Bojxona navbatida",
  "Saralash bosqichida",
  "Yetkazishga tayyor",
  "Olib ketilgan",
];

const ITEM: CargoItemResponse = {
  id: 1,
  track_code: "79137964364900",
  flight_name: "M277",
  checkin_status: "post",
};

function response(
  statuses: PublicTrackingStepStatus[] | null,
  items: CargoItemResponse[] = [ITEM],
): TrackCodeSearchResponse {
  return {
    found: true,
    track_code: ITEM.track_code,
    items,
    total_count: items.length,
    tracking: statuses && {
      found: true,
      service_type: "cargo",
      progress_percentage: 0,
      steps: statuses.map((status, index) => ({
        step: index + 1,
        title: BACKEND_TITLES[index],
        status,
      })),
    },
  };
}

function legendItems() {
  const legend = screen.getByRole("list", { name: "Yuk bosqichlari" });
  return within(legend).getAllByRole("listitem");
}

describe("TrackResultCard stage names", () => {
  it("names all six stages in order, in the owner's wording", () => {
    render(
      <TrackResultCard
        data={response([
          "available",
          "available",
          "available",
          "available",
          "pending",
          "nodata",
        ])}
      />,
    );

    const items = legendItems();
    expect(items).toHaveLength(6);
    items.forEach((item, index) => {
      expect(item).toHaveTextContent(STAGE_NAMES[index]);
    });
  });

  it("says which stages are done, which is current and which are ahead", () => {
    render(
      <TrackResultCard
        data={response([
          "available",
          "available",
          "available",
          "available",
          "pending",
          "nodata",
        ])}
      />,
    );

    const statuses = legendItems().map(
      (item) => item.textContent?.split(" — ")[1],
    );
    expect(statuses).toEqual([
      "Yakunlangan",
      "Yakunlangan",
      "Yakunlangan",
      "Yakunlangan",
      "Jarayonda",
      "Kutilmoqda",
    ]);
    // The heading names the current stage with the same words as the list.
    expect(
      screen.getByText("Fotohisobot jo'natilgan", { selector: "p" }),
    ).toBeInTheDocument();
  });

  it("marks nothing as current once the parcel is collected", () => {
    render(<TrackResultCard data={response(Array(6).fill("available"))} />);

    const statuses = legendItems().map(
      (item) => item.textContent?.split(" — ")[1],
    );
    expect(statuses).toEqual(Array(6).fill("Yakunlangan"));
    expect(
      screen.getByText("Olib ketilgan", { selector: "p" }),
    ).toBeInTheDocument();
  });

  it("names the stages when the server sent no tracking steps", () => {
    render(
      <TrackResultCard
        data={response(null, [{ ...ITEM, is_sent_web: true }])}
      />,
    );

    const items = legendItems();
    expect(items).toHaveLength(6);
    items.forEach((item, index) => {
      expect(item).toHaveTextContent(STAGE_NAMES[index]);
    });
  });

  it("keeps the numbered icon row out of the accessibility tree", () => {
    const { container } = render(
      <TrackResultCard
        data={response([
          "available",
          "pending",
          "nodata",
          "nodata",
          "nodata",
          "nodata",
        ])}
      />,
    );

    const iconRow = container.querySelector('[data-testid="tracking-step-icons"]');
    expect(iconRow).toHaveAttribute("aria-hidden", "true");
    expect(iconRow).toHaveTextContent("123456");
  });

  it("has every stage name and the list label in both languages", () => {
    for (const locale of [uz, ru]) {
      expect(locale.tracking.stepsLegend).toBeTruthy();
      for (let step = 1; step <= 6; step += 1) {
        const key = `step${step}` as keyof typeof locale.tracking.steps;
        expect(locale.tracking.steps[key]).toBeTruthy();
      }
    }
    expect(Object.values(uz.tracking.steps)).toEqual(STAGE_NAMES);
  });
});
