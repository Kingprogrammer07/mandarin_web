import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("@/lib/astatkaPendingPhotos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/astatkaPendingPhotos")>()),
  savePendingPhotos: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), message: vi.fn() },
}));

import type { AstatkaPackage, AstatkaPackagePhotosResult } from "@/api/services/astatkaFlights";
import { PendingPhotosError, savePendingPhotos } from "@/lib/astatkaPendingPhotos";

import { useAstatkaPendingPhotos } from "./useAstatkaPendingPhotos";

const save = vi.mocked(savePendingPhotos);

const ours = {
  id: 55,
  astatka_flight_name: "OSTATKA.202",
  already_in_astatka: null,
  source_company: null,
} as unknown as AstatkaPackage;
const result = { package: ours, photos: [] } as unknown as AstatkaPackagePhotosResult;
const shot = (name: string) => new File([name], `${name}.jpg`, { type: "image/jpeg" });

function renderPending() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useAstatkaPendingPhotos("OSTATKA.202"), { wrapper });
}

beforeEach(() => vi.clearAllMocks());

describe("useAstatkaPendingPhotos", () => {
  it("sends a row's photos to its bag once the confirm saved it, then forgets them", async () => {
    save.mockResolvedValue({ result, saved: 2, skipped: 0 });
    const { result: hook } = renderPending();
    const taken = [shot("a"), shot("b")];

    act(() => hook.current.add("r1", taken));
    expect(hook.current.entries.get("r1")?.files).toEqual(taken);
    act(() => hook.current.saveFor("r1", ours));

    expect(save).toHaveBeenCalledWith("OSTATKA.202", 55, taken);
    await waitFor(() => expect(hook.current.entries.has("r1")).toBe(false));
  });

  it("keeps what did not land, and sends it again on retry", async () => {
    save.mockRejectedValueOnce(new PendingPhotosError(new Error("network"), 1));
    const { result: hook } = renderPending();
    const [first, second] = [shot("a"), shot("b")];

    act(() => hook.current.add("r1", [first, second]));
    act(() => hook.current.saveFor("r1", ours));
    await waitFor(() => expect(hook.current.entries.get("r1")?.status).toBe("failed"));
    expect(hook.current.entries.get("r1")).toMatchObject({ files: [second], packageId: 55 });

    save.mockResolvedValueOnce({ result, saved: 1, skipped: 0 });
    act(() => hook.current.retry("r1"));
    expect(save).toHaveBeenLastCalledWith("OSTATKA.202", 55, [second]);
    await waitFor(() => expect(hook.current.entries.has("r1")).toBe(false));
  });

  it("does not put photos on a bag saved elsewhere", () => {
    const { result: hook } = renderPending();

    act(() => hook.current.add("r1", [shot("a")]));
    act(() => hook.current.saveFor("r1", { ...ours, astatka_flight_name: "OSTATKA.9" }));

    expect(save).not.toHaveBeenCalled();
    expect(hook.current.entries.get("r1")?.status).toBe("failed");
  });

  it("moves the photos of a row folded into another", () => {
    const { result: hook } = renderPending();
    const [mine, theirs] = [shot("a"), shot("b")];

    act(() => {
      hook.current.add("kept", [mine]);
      hook.current.add("gone", [theirs]);
    });
    act(() => hook.current.moveRow("gone", "kept"));

    expect(hook.current.entries.has("gone")).toBe(false);
    expect(hook.current.entries.get("kept")?.files).toEqual([mine, theirs]);
  });
});
