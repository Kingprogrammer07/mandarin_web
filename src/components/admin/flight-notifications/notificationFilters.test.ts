import { describe, expect, it } from "vitest";

import {
  alreadyNotifiedClients,
  filterClients,
  isOstatkaFlight,
  notifiedChannelsLabel,
  paginate,
  pendingClientIds,
  pruneSelection,
  selectionStateOf,
  sendChannelsLabel,
  setClientsSelected,
  toggleSelection,
} from "./notificationFilters";
import { makeClient } from "./testData";

const clients = [
  makeClient({ client_id: "M001" }),
  makeClient({ client_id: "M002", is_sent: true, is_sent_bot: true }),
  makeClient({ client_id: "SS-7", is_sent: true, is_sent_web: true }),
  makeClient({ client_id: "m010" }),
];

const ids = (list: { client_id: string }[]) => list.map((c) => c.client_id);

describe("filterClients", () => {
  it("keeps everyone for 'all' and splits on is_sent for the other modes", () => {
    expect(ids(filterClients(clients, "all", ""))).toEqual([
      "M001",
      "M002",
      "SS-7",
      "m010",
    ]);
    expect(ids(filterClients(clients, "pending", ""))).toEqual([
      "M001",
      "m010",
    ]);
    expect(ids(filterClients(clients, "sent", ""))).toEqual(["M002", "SS-7"]);
  });

  it("matches the client code case-insensitively and ignores surrounding spaces", () => {
    expect(ids(filterClients(clients, "all", "  01 "))).toEqual([
      "M001",
      "m010",
    ]);
    expect(ids(filterClients(clients, "all", "M01"))).toEqual(["m010"]);
    expect(ids(filterClients(clients, "sent", "ss"))).toEqual(["SS-7"]);
    expect(filterClients(clients, "pending", "SS")).toEqual([]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 65 }, (_, index) => index);

  it("cuts pages of the given size", () => {
    expect(paginate(items, 1, 30)).toEqual({
      items: items.slice(0, 30),
      page: 1,
      totalPages: 3,
    });
    expect(paginate(items, 3, 30).items).toEqual([60, 61, 62, 63, 64]);
  });

  it("clamps a page that fell out of range after the list shrank", () => {
    expect(paginate(items, 9, 30).page).toBe(3);
    expect(paginate(items, 0, 30).page).toBe(1);
    expect(paginate(items, Number.NaN, 30).page).toBe(1);
  });

  it("reports one empty page for an empty list", () => {
    expect(paginate([], 4, 30)).toEqual({ items: [], page: 1, totalPages: 1 });
  });

  it("defaults to 30 rows a page", () => {
    expect(paginate(items, 1).items).toHaveLength(30);
  });
});

describe("selection helpers", () => {
  it("selects the pending clients of the whole flight", () => {
    expect(pendingClientIds(clients)).toEqual(["M001", "m010"]);
    expect(pendingClientIds([])).toEqual([]);
  });

  it("prunes ids that left the flight", () => {
    const pruned = pruneSelection(new Set(["M001", "GONE", "SS-7"]), clients);
    expect([...pruned]).toEqual(["M001", "SS-7"]);
  });

  it("reports none / some / all for the visible list", () => {
    expect(selectionStateOf([], new Set(["M001"]))).toBe("none");
    expect(selectionStateOf(clients, new Set())).toBe("none");
    expect(selectionStateOf(clients, new Set(["M001"]))).toBe("some");
    expect(selectionStateOf(clients, new Set(ids(clients)))).toBe("all");
  });

  it("adds or removes a block of clients without touching other selections", () => {
    const visible = clients.slice(0, 2);
    const added = setClientsSelected(new Set(["X9"]), visible, true);
    expect([...added].sort()).toEqual(["M001", "M002", "X9"]);
    const removed = setClientsSelected(added, visible, false);
    expect([...removed]).toEqual(["X9"]);
  });

  it("toggles one client", () => {
    const on = toggleSelection(new Set(), "M001");
    expect(on.has("M001")).toBe(true);
    expect(toggleSelection(on, "M001").has("M001")).toBe(false);
  });
});

describe("re-send warning", () => {
  it("lists only selected clients some channel already reached", () => {
    const warned = alreadyNotifiedClients(
      clients,
      new Set(["M001", "M002", "SS-7"]),
    );
    expect(ids(warned)).toEqual(["M002", "SS-7"]);
    expect(warned.map(notifiedChannelsLabel)).toEqual(["Bot", "Web"]);
    expect(
      notifiedChannelsLabel(
        makeClient({ is_sent_bot: true, is_sent_web: true }),
      ),
    ).toBe("Bot+Web");
  });

  it("names the chosen send channels", () => {
    expect(sendChannelsLabel(true, true)).toBe("Web + Bot");
    expect(sendChannelsLabel(false, true)).toBe("Bot");
    expect(sendChannelsLabel(false, false)).toBeNull();
  });
});

describe("isOstatkaFlight", () => {
  it("recognises A- flights regardless of case and padding", () => {
    expect(isOstatkaFlight(" a-202 ")).toBe(true);
    expect(isOstatkaFlight("A-OSTATKA")).toBe(true);
    expect(isOstatkaFlight("M284")).toBe(false);
    expect(isOstatkaFlight("MA-1")).toBe(false);
  });
});
