import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("@/api/services/uzpostBranches", () => ({ getAddedUzpostBranches: vi.fn() }));

import { getAddedUzpostBranches } from "@/api/services/uzpostBranches";
import { useUzpostBranches } from "./useUzpostBranches";

const added = vi.mocked(getAddedUzpostBranches);

const catalogue = [
  {
    ID: 5218,
    Name: "Toshkent Pochtamt",
    Index: 100000,
    Address: "Toshkent, Yunusobod, Shahrisabz, 7",
    Longitude: 69.283869,
    Latitude: 41.31665,
  },
];

function serveCatalogue() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify(catalogue),
    }),
  );
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useUzpostBranches", () => {
  it("lists added branches first, marked, alongside the file", async () => {
    serveCatalogue();
    added.mockResolvedValue([
      {
        ID: 900001,
        Name: "Yangi bo'lim",
        Index: 199999,
        Address: "Toshkent, Yangi ko'cha 1",
        Longitude: 69.2,
        Latitude: 41.3,
        Workdays: null,
        Custom: true,
      },
    ]);

    const { result } = renderHook(() => useUzpostBranches(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.map((branch) => branch.id)).toEqual([900001, 5218]);
    expect(result.current.data?.[0].isCustom).toBe(true);
    expect(result.current.data?.[1].isCustom).toBe(false);
  });

  it("still lists the file when the added branches cannot be read", async () => {
    serveCatalogue();
    added.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useUzpostBranches(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.map((branch) => branch.id)).toEqual([5218]);
  });
});
