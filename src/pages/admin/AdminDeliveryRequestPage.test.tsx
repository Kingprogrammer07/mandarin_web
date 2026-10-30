import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AdminStandardDeliveryRequest,
  ClientDeliveryContext,
  DeliveryFlightState,
} from "@/api/services/adminDeliveryService";
import type { UzpostBranch } from "@/types/uzpostBranch";

const state = vi.hoisted(() => ({
  context: {
    data: undefined as ClientDeliveryContext | undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  standardMutate: vi.fn(),
  uzpostMutate: vi.fn(),
  branch: {
    id: 77,
    name: "Chilonzor filiali",
    index: 100115,
    address: "Chilonzor 1",
    longitude: 69.2,
    latitude: 41.3,
    workdays: null,
    lunch: null,
    saturday: null,
    dayOff: null,
    otherScheduleNotes: null,
  } as UzpostBranch,
}));

vi.mock("@/api/hooks/useAdminDelivery", () => ({
  useClientDeliveryContext: () => state.context,
  useAdminCreateStandardDelivery: () => ({ mutate: state.standardMutate, isPending: false }),
  useAdminCreateUzpostDelivery: () => ({ mutate: state.uzpostMutate, isPending: false }),
}));
vi.mock("@/api/hooks/useWarehouse", () => ({
  useGroupedWarehouseSearch: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@/hooks/useUzPostLabelCopiesGate", () => ({
  useUzPostLabelCopiesGate: () => ({
    guard: (print: () => void) => print(),
    dialog: { open: false, currentCopies: null, onDone: () => {}, onCancel: () => {} },
  }),
}));
vi.mock("@/components/warehouse/UzPostLabelCopiesDialog", () => ({ default: () => null }));
// The branch picker (virtualised list, suggestions query) is not under test here;
// a stand-in that picks a branch lets the page build its UzPost request.
vi.mock("@/components/admin/delivery/UzpostDeliveryForm", () => ({
  default: ({ onBranchChange }: { onBranchChange: (branch: UzpostBranch) => void }) => (
    <button type="button" onClick={() => onBranchChange(state.branch)}>
      Filialni tanlash
    </button>
  ),
}));
vi.mock("@/components/delivery/DeliveryMapPickerLazy", () => ({
  DeliveryMapPickerLazy: ({
    onConfirm,
  }: {
    onConfirm: (loc: { latitude: number; longitude: number }) => void;
  }) => (
    <>
      <button type="button" onClick={() => onConfirm({ latitude: 41.2856, longitude: 69.2034 })}>
        Pin Chilonzor
      </button>
      <button type="button" onClick={() => onConfirm({ latitude: 39.654, longitude: 66.975 })}>
        Pin Samarqand
      </button>
    </>
  ),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

// Animations are not under test, and AnimatePresence's exit delays would make
// every step change asynchronous. Motion elements render as plain elements.
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const motionProps = new Set(["initial", "animate", "exit", "transition", "layout"]);
  const cache = new Map<string, unknown>();
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        if (!cache.has(tag)) {
          cache.set(
            tag,
            React.forwardRef<HTMLElement, Record<string, unknown>>(
              function MotionStub(props, ref) {
                const domProps = Object.fromEntries(
                  Object.entries(props).filter(([key]) => !motionProps.has(key)),
                );
                return React.createElement(tag, { ...domProps, ref });
              },
            ),
          );
        }
        return cache.get(tag);
      },
    },
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

import AdminDeliveryRequestPage from "./AdminDeliveryRequestPage";
import { RECENT_CLIENTS_STORAGE_KEY } from "@/lib/adminDeliveryRecentClients";

function paidFlight(
  name: string,
  rowId: number,
  weight = "2.5",
  isWeightSource = true,
): DeliveryFlightState {
  return {
    flight: name,
    cargo_count: 1,
    total_amount: 50000,
    paid_amount: 50000,
    payment_status: "paid",
    is_taken_away: false,
    taken_count: 0,
    rows: [
      {
        id: rowId,
        qator_raqami: rowId,
        vazn: weight,
        weight_kg: Number(weight),
        is_weight_source: isWeightSource,
        total_amount: 50000,
        paid_amount: 50000,
        remaining_amount: 0,
        payment_status: "paid",
        is_taken_away: false,
      },
    ],
    active_requests: [],
  };
}

/** One flight carrying several cargo rows, some possibly already collected. */
function flightWithRows(
  name: string,
  rows: Array<{ id: number; weight: string; taken?: boolean }>,
): DeliveryFlightState {
  const flight = paidFlight(name, rows[0].id);
  return {
    ...flight,
    cargo_count: rows.length,
    taken_count: rows.filter((row) => row.taken).length,
    rows: rows.map((row) => ({
      ...flight.rows[0],
      id: row.id,
      qator_raqami: row.id,
      vazn: row.weight,
      weight_kg: Number(row.weight),
      is_taken_away: Boolean(row.taken),
    })),
  };
}

function contextData(
  flights = [paidFlight("M249", 1), paidFlight("M250", 2)],
  mayOverride = true,
): ClientDeliveryContext {
  return {
    client_code: "STCH330",
    full_name: "Anvar Mijozov",
    phone: "+998901112233",
    may_override: mayOverride,
    flights,
    total_requests: 0,
    filed_by_user: 0,
    filed_by_admin: 0,
    filed_unknown: 0,
    recent: [],
  };
}

function openClient() {
  const view = render(<AdminDeliveryRequestPage />);
  fireEvent.click(screen.getByRole("button", { name: /Anvar Mijozov/ }));
  return view;
}

/** Client from the recent list → one flight → a delivery type → the form step. */
function openFormFor(flightName: string, type: RegExp) {
  const view = openClient();
  fireEvent.click(screen.getByRole("button", { name: new RegExp(flightName) }));
  fireEvent.click(screen.getByRole("button", { name: /Davom etish/ }));
  fireEvent.click(screen.getByRole("button", { name: type }));
  return view;
}

function pin(place: "Chilonzor" | "Samarqand"): void {
  fireEvent.click(screen.getByRole("button", { name: `Pin ${place}` }));
}

function submit(): void {
  fireEvent.click(screen.getByRole("button", { name: /Zayavkani yuborish/ }));
}

function sentPayload(): AdminStandardDeliveryRequest {
  return state.standardMutate.mock.calls[0][0] as AdminStandardDeliveryRequest;
}

function sentUzpostForm(): FormData {
  return state.uzpostMutate.mock.calls[0][0] as FormData;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    RECENT_CLIENTS_STORAGE_KEY,
    JSON.stringify([{ client_code: "STCH330", full_name: "Anvar Mijozov" }]),
  );
  state.context.data = contextData();
  state.context.isLoading = false;
  state.context.isError = false;
  state.context.refetch.mockReset();
  state.standardMutate.mockReset();
  state.uzpostMutate.mockReset();
});

describe("AdminDeliveryRequestPage", () => {
  it("files a request for another recipient, then offers the next one for the same client", () => {
    openFormFor("M249", /Mandarin Dostavka/);

    expect(screen.getByText("Anvar Mijozov")).toBeInTheDocument();
    expect(screen.getByLabelText("Telefon")).toHaveValue("+998901112233");

    fireEvent.click(screen.getByRole("button", { name: "Boshqa ism" }));
    fireEvent.change(screen.getByPlaceholderText("Qabul qiluvchining ism-familiyasi"), {
      target: { value: "  Vali   Aliyev " },
    });
    fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: "+998935551122" } });
    pin("Chilonzor");
    submit();

    expect(state.standardMutate).toHaveBeenCalledTimes(1);
    expect(sentPayload()).toEqual({
      client_code: "STCH330",
      delivery_type: "mandarin",
      flight_names: ["M249"],
      phone_number: "+998935551122",
      recipient_name: "Vali Aliyev",
      caption: undefined,
      latitude: 41.2856,
      longitude: 69.2034,
    });

    const { onSuccess } = state.standardMutate.mock.calls[0][1] as {
      onSuccess: (res: { message: string; delivery_request_id: number }) => void;
    };
    act(() => onSuccess({ message: "ok", delivery_request_id: 4242 }));
    expect(screen.getByText("Zayavka yuborildi!")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Boshqa qabul qiluvchi uchun yana zayavka/ }),
    );

    // Same client, nothing carried over from the previous recipient.
    expect(screen.getByRole("button", { name: /M249/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Davom etish/ })).toBeDisabled();
  });

  it("builds the UzPost request with the branch, the phone and the typed recipient", () => {
    openFormFor("M250", /^UzPost/);

    fireEvent.click(screen.getByRole("button", { name: "Filialni tanlash" }));
    fireEvent.click(screen.getByRole("button", { name: "Boshqa ism" }));
    fireEvent.change(screen.getByPlaceholderText("Qabul qiluvchining ism-familiyasi"), {
      target: { value: "Vali Aliyev" },
    });
    submit();

    expect(state.uzpostMutate).toHaveBeenCalledTimes(1);
    const { submission_id: submissionId, ...fields } = Object.fromEntries(
      sentUzpostForm().entries(),
    );
    // 2.5 kg: one parcel, so no bags even for a manager with the override.
    expect(fields).toEqual({
      client_code: "STCH330",
      flight_names: JSON.stringify(["M250"]),
      location_id: "77",
      phone_number: "+998901112233",
      recipient_name: "Vali Aliyev",
    });
    expect(String(submissionId).length).toBeGreaterThan(8);
  });

  it("splits a parcel over 10 kg into the fewest even bags", () => {
    state.context.data = contextData([paidFlight("M300", 30, "45")]);
    openFormFor("M300", /^UzPost/);

    fireEvent.click(screen.getByRole("button", { name: "Filialni tanlash" }));
    submit();

    expect(state.uzpostMutate).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(sentUzpostForm().get("bags")))).toEqual([
      { sequence_no: 1, weight_kg: 9 },
      { sequence_no: 2, weight_kg: 9 },
      { sequence_no: 3, weight_kg: 9 },
      { sequence_no: 4, weight_kg: 9 },
      { sequence_no: 5, weight_kg: 9 },
    ]);
  });

  it("lets the manager send an 11.56 kg parcel as one bag", () => {
    state.context.data = contextData([paidFlight("M300", 30, "11.56")]);
    openFormFor("M300", /^UzPost/);

    fireEvent.click(screen.getByRole("button", { name: "Filialni tanlash" }));
    fireEvent.click(screen.getByRole("button", { name: "1 qop" }));
    submit();

    expect(state.uzpostMutate).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(sentUzpostForm().get("bags")))).toEqual([
      { sequence_no: 1, weight_kg: 11.56 },
    ]);
  });

  it("files several small items as one parcel, not one bag each", () => {
    state.context.data = contextData([
      flightWithRows("M300", [
        { id: 31, weight: "0.3" },
        { id: 32, weight: "0.4" },
        { id: 33, weight: "1.2" },
      ]),
    ]);
    openFormFor("M300", /^UzPost/);

    // The planner is offered, starting from one bag, which files as before.
    expect(screen.getByText(/1 ta qop/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filialni tanlash" }));
    submit();

    expect(state.uzpostMutate).toHaveBeenCalledTimes(1);
    expect(sentUzpostForm().has("bags")).toBe(false);
  });

  it("lets the manager split a light parcel into bags of any weight", () => {
    state.context.data = contextData([
      flightWithRows("M300", [
        { id: 31, weight: "3" },
        { id: 32, weight: "4" },
      ]),
    ]);
    openFormFor("M300", /^UzPost/);

    fireEvent.click(screen.getByRole("button", { name: /Qop qo'shish/ }));
    fireEvent.change(screen.getAllByLabelText("Qop vazni")[0], { target: { value: "2" } });
    fireEvent.change(screen.getAllByLabelText("Qop vazni")[1], { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Filialni tanlash" }));
    submit();

    expect(state.uzpostMutate).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(sentUzpostForm().get("bags")))).toEqual([
      { sequence_no: 1, weight_kg: 2 },
      { sequence_no: 2, weight_kg: 5 },
    ]);
  });

  it("leaves cargo that was already collected out of the bags", () => {
    state.context.data = contextData([
      flightWithRows("M300", [
        { id: 31, weight: "30", taken: true },
        { id: 32, weight: "8" },
        { id: 33, weight: "7" },
      ]),
    ]);
    openFormFor("M300", /^UzPost/);

    expect(screen.getByText(/Yuk 15\.00 kg/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filialni tanlash" }));
    submit();

    expect(JSON.parse(String(sentUzpostForm().get("bags")))).toEqual([
      { sequence_no: 1, weight_kg: 7.5 },
      { sequence_no: 2, weight_kg: 7.5 },
    ]);
  });

  it("blocks submit when edited bag weights no longer add up to the parcel", () => {
    state.context.data = contextData([paidFlight("M300", 30, "20")]);
    openFormFor("M300", /^UzPost/);

    fireEvent.click(screen.getByRole("button", { name: "Filialni tanlash" }));
    fireEvent.change(screen.getAllByLabelText("Qop vazni")[0], {
      target: { value: "9" },
    });

    expect(screen.getByText(/qoldi 1\.00 kg/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Zayavkani yuborish/ })).toBeDisabled();
    submit();
    expect(state.uzpostMutate).not.toHaveBeenCalled();

    // A new bag takes the unbagged kilogram, and the request can go.
    fireEvent.click(screen.getByRole("button", { name: "Qop qo'shish" }));
    submit();
    expect(JSON.parse(String(sentUzpostForm().get("bags")))).toEqual([
      { sequence_no: 1, weight_kg: 9 },
      { sequence_no: 2, weight_kg: 10 },
      { sequence_no: 3, weight_kg: 1 },
    ]);
  });

  it("sends the same filing id again for the same request, and a new one once it changes", () => {
    openFormFor("M250", /^UzPost/);
    fireEvent.click(screen.getByRole("button", { name: "Filialni tanlash" }));

    submit();
    submit();
    fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: "+998935551122" } });
    submit();

    const ids = state.uzpostMutate.mock.calls.map((call) =>
      (call[0] as FormData).get("submission_id"),
    );
    expect(ids).toHaveLength(3);
    expect(ids[1]).toBe(ids[0]);
    expect(ids[2]).not.toBe(ids[0]);
  });

  it("does not show or send bag split data for non-override admins", () => {
    state.context.data = contextData([paidFlight("M300", 30, "40")], false);
    openFormFor("M300", /^UzPost/);

    expect(screen.queryByText("Qoplarga ajratish")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Filialni tanlash" }));
    submit();

    expect(state.uzpostMutate).toHaveBeenCalledTimes(1);
    expect(sentUzpostForm().has("bags")).toBe(false);
  });

  it("a Mandarin request waits for a pin inside Tashkent", () => {
    openFormFor("M249", /Mandarin Dostavka/);
    const send = () => screen.getByRole("button", { name: /Zayavkani yuborish/ });

    expect(send()).toBeDisabled();
    expect(screen.getByText("Mandarin kuryeri uchun xaritada aniq joyni belgilang")).toBeInTheDocument();

    pin("Samarqand");
    expect(send()).toBeDisabled();
    expect(screen.getByText("Nuqta Toshkent shahri ichida bo'lishi kerak")).toBeInTheDocument();

    pin("Chilonzor");
    expect(send()).toBeEnabled();
  });

  it("sends the profile phone and no recipient name for the client's own parcel", () => {
    openFormFor("M250", /Mandarin Dostavka/);
    pin("Chilonzor");
    submit();

    expect(sentPayload().phone_number).toBe("+998901112233");
    expect(sentPayload().recipient_name).toBeUndefined();
    expect(sentPayload().flight_names).toEqual(["M250"]);
  });

  it("does not file when another name was chosen but left empty", () => {
    openFormFor("M249", /Mandarin Dostavka/);
    pin("Chilonzor");

    fireEvent.click(screen.getByRole("button", { name: "Boshqa ism" }));
    submit();

    expect(state.standardMutate).not.toHaveBeenCalled();
    expect(screen.getByText("Qabul qiluvchi ismini kiriting")).toBeInTheDocument();
  });

  it("does not file when the phone was cleared", () => {
    openFormFor("M249", /Mandarin Dostavka/);
    pin("Chilonzor");

    fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: " " } });
    submit();

    expect(state.standardMutate).not.toHaveBeenCalled();
    expect(screen.getByText("Qabul qiluvchi telefonini kiriting")).toBeInTheDocument();
  });

  it("says so and blocks submit when a refetch no longer returns the chosen flight", () => {
    const view = openFormFor("M249", /Mandarin Dostavka/);

    state.context.data = contextData([paidFlight("M250", 2)]);
    view.rerender(<AdminDeliveryRequestPage />);

    expect(screen.getByText(/Tanlangan reyslar endi mijozda yo'q/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Zayavkani yuborish/ })).toBeDisabled();
  });

  it("reads the client's flights again whenever the flights step opens", () => {
    openClient();

    expect(state.context.refetch).toHaveBeenCalledWith({ cancelRefetch: false });
  });

  it("offers a jump to «Davom etish» while it is out of sight", () => {
    let report: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          report = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      openClient();
      expect(screen.queryByRole("button", { name: /Pastga/ })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "M249" }));
      act(() => report?.([{ isIntersecting: false }]));
      fireEvent.click(screen.getByRole("button", { name: /1 ta reys · Pastga/ }));
      expect(scrollIntoView).toHaveBeenCalled();

      act(() => report?.([{ isIntersecting: true }]));
      expect(screen.queryByRole("button", { name: /Pastga/ })).toBeNull();
    } finally {
      vi.unstubAllGlobals();
      Element.prototype.scrollIntoView = original;
    }
  });

  it("selects every shown flight, then clears them", () => {
    openClient();

    fireEvent.click(screen.getByRole("button", { name: "Barchasini tanlash" }));
    expect(screen.getByRole("button", { name: "M249" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "M250" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Barchasini bekor qilish" }));
    expect(screen.getByRole("button", { name: "M249" })).toHaveAttribute("aria-pressed", "false");
  });

  it("says when the flights could not be loaded and retries on request", () => {
    state.context.data = undefined;
    state.context.isError = true;

    openClient();
    expect(screen.getByText("Reyslarni yuklab bo'lmadi")).toBeInTheDocument();

    state.context.refetch.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Qayta urinish/ }));
    expect(state.context.refetch).toHaveBeenCalled();
  });

  it("remembers the client by code and name only", () => {
    openClient();

    expect(JSON.parse(localStorage.getItem(RECENT_CLIENTS_STORAGE_KEY) ?? "[]")).toEqual([
      { client_code: "STCH330", full_name: "Anvar Mijozov" },
    ]);
  });
});
