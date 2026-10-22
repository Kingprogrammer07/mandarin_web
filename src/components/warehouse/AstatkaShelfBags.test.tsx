import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("../../api/services/warehouse", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/services/warehouse")>()),
  handOutAstatkaBag: vi.fn(),
  undoAstatkaHandOut: vi.fn(),
}));

import {
  handOutAstatkaBag,
  undoAstatkaHandOut,
  type AstatkaShelfBag,
  type ClientGroup,
  type FlightGroup,
} from "../../api/services/warehouse";
import GroupedTransactionsList from "./GroupedTransactionsList";

const handOutApi = vi.mocked(handOutAstatkaBag);
const undoApi = vi.mocked(undoAstatkaHandOut);

const ASTATKA = "OSTATKA-21.10.2026";

function shelfBag(overrides: Partial<AstatkaShelfBag> = {}): AstatkaShelfBag {
  return {
    package_id: 7,
    astatka_flight_name: ASTATKA,
    state: "left_behind",
    weight_kg: 1.5,
    track_codes: ["YT020"],
    photos: ["https://s3.test/a.webp", "https://s3.test/b.webp"],
    confirmed_at: "2026-10-21T07:00:00Z",
    handed_out_at: null,
    handed_out_by: null,
    handout_photos: [],
    handout_comment: null,
    ...overrides,
  };
}

function flight(bags: AstatkaShelfBag[]): FlightGroup {
  return {
    flight_name: "M300",
    total_weight_kg: 1.5,
    total_amount: 98750,
    total_remaining_amount: 0,
    flight_cargo_photos: [],
    available_delivery_methods: [],
    delivery_request_id: null,
    delivery_request_type: null,
    delivery_request_status: null,
    // Given at the counter with a proof, before the item was found on the shelf.
    transactions: [
      {
        id: 31,
        qator_raqami: 0,
        vazn: "1.5",
        summa: 98750,
        payment_status: "paid",
        remaining_amount: 0,
        is_taken_away: true,
        taken_away_date: "2026-10-20T07:00:00Z",
        comment: null,
        has_proof: true,
        available_delivery_methods: [],
        delivery_request_id: null,
        delivery_request_type: null,
        delivery_request_status: null,
      },
    ],
    astatka_flight_name: bags.some((b) => b.state === "left_behind") ? ASTATKA : null,
    astatka_bags: bags,
  };
}

function client(code: string, bags: AstatkaShelfBag[]): ClientGroup {
  return {
    client_code: code,
    full_name: null,
    phone: null,
    wallet_balance: 0,
    debt: 0,
    total_unpaid_amount: 0,
    flights: [flight(bags)],
  };
}

function renderList(items: ClientGroup[], canMarkTaken = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <GroupedTransactionsList
        items={items}
        isLoading={false}
        onMarkTaken={vi.fn()}
        canMarkTaken={canMarkTaken}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  handOutApi.mockReset();
  undoApi.mockReset();
});

describe("GroupedTransactionsList — «Ostatkadan berish»", () => {
  it("keeps a proved client with a bag left on the shelf, and shows its shelf photos", () => {
    renderList([client("SS300", [shelfBag()]), client("SS200", [shelfBag({ state: "taken" })])]);
    // SS200's bag was given from the shelf: fully proved, hidden as before.
    expect(screen.queryByText("SS200")).not.toBeInTheDocument();
    const shelf = screen.getByRole("region", { name: `Ostatka ${ASTATKA}` });
    expect(within(shelf).getByText("Javonda qolgan")).toBeInTheDocument();
    expect(within(shelf).getAllByRole("button", { name: /Ostatkada olingan rasmlar/ })).toHaveLength(2);
    expect(within(shelf).getByRole("button", { name: "Ostatkadan berish" })).toBeInTheDocument();
  });

  it("asks for a photo, then gives the bag with it", async () => {
    handOutApi.mockResolvedValue({
      bag: shelfBag({ state: "handed_out" }),
      message: "Yuk ostatkadan berildi.",
      telegram_notified: true,
    });
    renderList([client("SS300", [shelfBag()])]);
    fireEvent.click(screen.getByRole("button", { name: "Ostatkadan berish" }));
    const dialog = screen.getByRole("dialog", { name: "Ostatkadan berish" });

    fireEvent.click(within(dialog).getByRole("button", { name: /Javondan berildi/ }));
    expect(await within(dialog).findByText("Kamida bitta rasm yuklang")).toBeInTheDocument();
    expect(handOutApi).not.toHaveBeenCalled();

    const photo = new File(["x"], "berildi.jpg", { type: "image/jpeg" });
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [photo] } });
    fireEvent.change(within(dialog).getByLabelText("Izoh (ixtiyoriy)"), {
      target: { value: "paketdan tushib qolgan" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /Javondan berildi/ }));

    await waitFor(() =>
      expect(handOutApi).toHaveBeenCalledWith(7, [photo], "paketdan tushib qolgan"),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("hides a client whose bag was given from the shelf, like any proved client", () => {
    renderList([client("SS300", [shelfBag({ state: "handed_out" })])]);
    expect(screen.queryByText("SS300")).not.toBeInTheDocument();
  });

  it("shows a bag given from the shelf, and lets the warehouse take it back", async () => {
    undoApi.mockResolvedValue({
      bag: shelfBag(),
      message: "Ostatkadan berish bekor qilindi: yuk yana javonda.",
      telegram_notified: false,
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const given = shelfBag({
      state: "handed_out",
      handed_out_at: "2026-10-22T10:40:00Z",
      handed_out_by: "ombor1",
      handout_comment: "1 ta paket",
      handout_photos: ["https://s3.test/h.webp"],
    });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <GroupedTransactionsList
          items={[client("SS300", [given])]}
          isLoading={false}
          onMarkTaken={vi.fn()}
          canMarkTaken
          showProved
        />
      </QueryClientProvider>,
    );
    const shelf = screen.getByRole("region", { name: `Ostatka ${ASTATKA}` });
    expect(within(shelf).getByText("Ostatkadan berilgan")).toBeInTheDocument();
    expect(within(shelf).getByText(/ombor1/)).toBeInTheDocument();
    expect(within(shelf).getByText("“1 ta paket”")).toBeInTheDocument();
    expect(within(shelf).queryByRole("button", { name: "Ostatkadan berish" })).not.toBeInTheDocument();
    fireEvent.click(within(shelf).getByRole("button", { name: "Bekor" }));
    await waitFor(() => expect(undoApi).toHaveBeenCalledWith(7));
  });

  it("offers nothing to a worker who may not give bags", () => {
    renderList([client("SS300", [shelfBag()])], false);
    expect(screen.getByText("Javonda qolgan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ostatkadan berish" })).not.toBeInTheDocument();
  });
});
