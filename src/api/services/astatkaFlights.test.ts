import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.hoisted(() =>
  vi.fn<(url: string, config?: { params?: object }) => Promise<{ data: unknown }>>(),
);
vi.mock("@/api/client", () => ({ apiClient: { get }, apiClientFormData: {} }));

import { getAstatkaPackages } from "./astatkaFlights";

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { items: [] } });
});

describe("getAstatkaPackages — cargo filter", () => {
  it('passes "" through: it means our own cargo, not every cargo', async () => {
    await getAstatkaPackages("OSTATKA.202", { source_company: "", page: 1 });

    expect(get).toHaveBeenCalledWith("/api/v1/astatka-flights/OSTATKA.202/packages", {
      params: { source_company: "", page: 1 },
    });
    // Axios writes an empty value instead of dropping it.
    expect(axios.getUri({ url: "/packages", params: { source_company: "" } })).toBe(
      "/packages?source_company=",
    );
  });

  it("leaves the filter out when every cargo is wanted", () => {
    expect(axios.getUri({ url: "/packages", params: { source_company: undefined } })).toBe(
      "/packages",
    );
  });
});
