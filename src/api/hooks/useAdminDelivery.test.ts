import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/api/services/adminDeliveryService", () => ({
  adminCreateStandardDelivery: vi.fn(async () => ({
    message: "ok",
    delivery_request_id: 1,
    queue_created: true,
  })),
  adminCreateUzpostDelivery: vi.fn(async () => ({ message: "ok", delivery_request_id: 2 })),
  getClientDeliveryContext: vi.fn(),
}));

import {
  deliveryErrorText,
  useAdminCreateStandardDelivery,
  useAdminCreateUzpostDelivery,
} from "./useAdminDelivery";

function withQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { invalidate, wrapper };
}

describe("deliveryErrorText", () => {
  it("shows the backend's own Uzbek reason", () => {
    expect(
      deliveryErrorText(
        {
          message: "Ma'lumot topilmadi.",
          data: { detail: "Qabul qiluvchi ismi juda uzun: ko'pi bilan 120 belgi." },
        },
        "Zayavka yuborishda xatolik",
      ),
    ).toBe("Qabul qiluvchi ismi juda uzun: ko'pi bilan 120 belgi.");
  });

  it("does not hand a validation array to the toast", () => {
    expect(
      deliveryErrorText(
        {
          message: "Ma'lumotlar noto'g'ri",
          data: { detail: [{ code: "validation_error", message: "One or more fields failed validation." }] },
        },
        "Zayavka yuborishda xatolik",
      ),
    ).toBe("Ma'lumotlar noto'g'ri");
  });

  it("falls back when nothing usable came back", () => {
    expect(deliveryErrorText({ data: { detail: "   " } }, "Zayavka yuborishda xatolik")).toBe(
      "Zayavka yuborishda xatolik",
    );
    expect(deliveryErrorText(null, "Zayavka yuborishda xatolik")).toBe(
      "Zayavka yuborishda xatolik",
    );
  });
});

describe("filing refreshes what the page shows next", () => {
  it("refetches the client's context and the lookup after a courier request", async () => {
    const { invalidate, wrapper } = withQueryClient();
    const { result } = renderHook(() => useAdminCreateStandardDelivery(), { wrapper });

    act(() => {
      result.current.mutate({
        client_code: "STCH330",
        delivery_type: "mandarin",
        flight_names: ["M249"],
        phone_number: "+998901112233",
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin-delivery-context"] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["warehouse_grouped_transaction_search"],
    });
  });

  it("does the same after a UzPost request", async () => {
    const { invalidate, wrapper } = withQueryClient();
    const { result } = renderHook(() => useAdminCreateUzpostDelivery(), { wrapper });

    act(() => {
      result.current.mutate(new FormData());
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin-delivery-context"] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["warehouse_grouped_transaction_search"],
    });
  });
});
