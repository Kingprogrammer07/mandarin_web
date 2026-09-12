import { beforeEach, describe, expect, it } from "vitest";
import {
  RECENT_CLIENTS_LIMIT,
  RECENT_CLIENTS_STORAGE_KEY,
  readRecentClients,
  rememberRecentClient,
  writeRecentClients,
} from "./adminDeliveryRecentClients";

beforeEach(() => {
  localStorage.clear();
});

describe("readRecentClients", () => {
  it("keeps only the code and name of entries saved in the old shape", () => {
    localStorage.setItem(
      RECENT_CLIENTS_STORAGE_KEY,
      JSON.stringify([
        {
          client_code: "STCH330",
          full_name: "Anvar Mijozov",
          phone: "+998901112233",
          wallet_balance: 0,
          flights: [{ flight_name: "M249", transactions: [{ id: 1 }] }],
        },
      ]),
    );

    expect(readRecentClients()).toEqual([
      { client_code: "STCH330", full_name: "Anvar Mijozov" },
    ]);
  });

  it("drops entries without a usable code", () => {
    localStorage.setItem(
      RECENT_CLIENTS_STORAGE_KEY,
      JSON.stringify([{ full_name: "Kodsiz" }, { client_code: "  " }, null, { client_code: "M1" }]),
    );

    expect(readRecentClients()).toEqual([{ client_code: "M1", full_name: null }]);
  });

  it("reads corrupt or non-list storage as an empty list", () => {
    localStorage.setItem(RECENT_CLIENTS_STORAGE_KEY, "{not json");
    expect(readRecentClients()).toEqual([]);

    localStorage.setItem(RECENT_CLIENTS_STORAGE_KEY, JSON.stringify({ client_code: "M1" }));
    expect(readRecentClients()).toEqual([]);
  });

  it("reads a blocked storage as an empty list", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readRecentClients(blocked)).toEqual([]);
  });
});

describe("rememberRecentClient", () => {
  it("moves a known client to the front without duplicating it", () => {
    const list = [
      { client_code: "A1", full_name: "A" },
      { client_code: "B2", full_name: "B" },
    ];

    expect(rememberRecentClient(list, { client_code: "B2", full_name: "B yangi" })).toEqual([
      { client_code: "B2", full_name: "B yangi" },
      { client_code: "A1", full_name: "A" },
    ]);
  });

  it("keeps the list at its limit", () => {
    const list = Array.from({ length: RECENT_CLIENTS_LIMIT }, (_, i) => ({
      client_code: `C${i}`,
      full_name: null,
    }));

    const next = rememberRecentClient(list, { client_code: "NEW", full_name: null });

    expect(next).toHaveLength(RECENT_CLIENTS_LIMIT);
    expect(next[0].client_code).toBe("NEW");
    expect(next.map((c) => c.client_code)).not.toContain(`C${RECENT_CLIENTS_LIMIT - 1}`);
  });
});

describe("writeRecentClients", () => {
  it("round-trips through storage and clears it when empty", () => {
    writeRecentClients([{ client_code: "M1", full_name: "Mijoz" }]);
    expect(readRecentClients()).toEqual([{ client_code: "M1", full_name: "Mijoz" }]);

    writeRecentClients([]);
    expect(localStorage.getItem(RECENT_CLIENTS_STORAGE_KEY)).toBeNull();
  });

  it("does not throw when storage refuses the write", () => {
    const full = {
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(() => writeRecentClients([{ client_code: "M1", full_name: null }], full)).not.toThrow();
  });
});
