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
  DeliveryMapPickerLazy: () => null,
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

function paidFlight(name: string, rowId: number): DeliveryFlightState {
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
        qator_raqami: 0,
        vazn: "2.5",
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

function contextData(flights = [paidFlight("M249", 1), paidFlight("M250", 2)]): ClientDeliveryContext {
  return {
    client_code: "STCH330",
    full_name: "Anvar Mijozov",
    phone: "+998901112233",
    may_override: true,
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

function submit(): void {
  fireEvent.click(screen.getByRole("button", { name: /Zayavkani yuborish/ }));
}

function sentPayload(): AdminStandardDeliveryRequest {
  return state.standardMutate.mock.calls[0][0] as AdminStandardDeliveryRequest;
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
    submit();

    expect(state.standardMutate).toHaveBeenCalledTimes(1);
    expect(sentPayload()).toEqual({
      client_code: "STCH330",
      delivery_type: "mandarin",
      flight_names: ["M249"],
      phone_number: "+998935551122",
      recipient_name: "Vali Aliyev",
      caption: undefined,
      latitude: null,
      longitude: null,
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
    const form = state.uzpostMutate.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(form.entries())).toEqual({
      client_code: "STCH330",
      flight_names: JSON.stringify(["M250"]),
      location_id: "77",
      phone_number: "+998901112233",
      recipient_name: "Vali Aliyev",
    });
  });

  it("sends the profile phone and no recipient name for the client's own parcel", () => {
    openFormFor("M250", /Mandarin Dostavka/);
    submit();

    expect(sentPayload().phone_number).toBe("+998901112233");
    expect(sentPayload().recipient_name).toBeUndefined();
    expect(sentPayload().flight_names).toEqual(["M250"]);
  });

  it("does not file when another name was chosen but left empty", () => {
    openFormFor("M249", /Mandarin Dostavka/);

    fireEvent.click(screen.getByRole("button", { name: "Boshqa ism" }));
    submit();

    expect(state.standardMutate).not.toHaveBeenCalled();
    expect(screen.getByText("Qabul qiluvchi ismini kiriting")).toBeInTheDocument();
  });

  it("does not file when the phone was cleared", () => {
    openFormFor("M249", /Mandarin Dostavka/);

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
