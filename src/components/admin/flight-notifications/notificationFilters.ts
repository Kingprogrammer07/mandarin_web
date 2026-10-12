import type { ClientNotificationStatus } from "@/api/services/flightNotifications";

export type NotificationFilter = "all" | "pending" | "sent";

export const NOTIFICATION_FILTERS: ReadonlyArray<{
  key: NotificationFilter;
  label: string;
}> = [
  { key: "all", label: "Hammasi" },
  { key: "pending", label: "Kutmoqda" },
  { key: "sent", label: "Yuborildi" },
];

export const PAGE_SIZE = 30;

/** How much of a list is selected — drives the tri-state "select all" box. */
export type SelectionState = "all" | "some" | "none";

export interface PageSlice<T> {
  items: T[];
  /** The page actually shown, clamped into range. */
  page: number;
  totalPages: number;
}

export function filterClients(
  clients: readonly ClientNotificationStatus[],
  filter: NotificationFilter,
  search: string,
): ClientNotificationStatus[] {
  const needle = search.trim().toLowerCase();
  return clients.filter((client) => {
    if (filter === "sent" && !client.is_sent) return false;
    if (filter === "pending" && client.is_sent) return false;
    return needle === "" || client.client_id.toLowerCase().includes(needle);
  });
}

/**
 * Cut one page out of the list. The requested page is clamped because a
 * background refresh can shrink the list under the operator, and an
 * out-of-range page would render as an empty list that is not really empty.
 */
export function paginate<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize: number = PAGE_SIZE,
): PageSlice<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const wholePage = Number.isFinite(requestedPage)
    ? Math.floor(requestedPage)
    : 1;
  const page = Math.min(Math.max(1, wholePage), totalPages);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    totalPages,
  };
}

/** Every not-yet-notified client of the whole flight, ignoring filter and page. */
export function pendingClientIds(
  clients: readonly ClientNotificationStatus[],
): string[] {
  return clients
    .filter((client) => !client.is_sent)
    .map((client) => client.client_id);
}

/** Drops ids that disappeared from the flight after a refresh. */
export function pruneSelection(
  selected: ReadonlySet<string>,
  clients: readonly ClientNotificationStatus[],
): Set<string> {
  const existing = new Set(clients.map((client) => client.client_id));
  return new Set([...selected].filter((id) => existing.has(id)));
}

export function selectionStateOf(
  clients: readonly ClientNotificationStatus[],
  selected: ReadonlySet<string>,
): SelectionState {
  if (clients.length === 0) return "none";
  const selectedCount = clients.reduce(
    (count, client) => (selected.has(client.client_id) ? count + 1 : count),
    0,
  );
  if (selectedCount === 0) return "none";
  return selectedCount === clients.length ? "all" : "some";
}

export function toggleSelection(
  selected: ReadonlySet<string>,
  clientId: string,
): Set<string> {
  const next = new Set(selected);
  if (next.has(clientId)) next.delete(clientId);
  else next.add(clientId);
  return next;
}

/** Adds (or removes) the given clients while keeping selections made elsewhere. */
export function setClientsSelected(
  selected: ReadonlySet<string>,
  clients: readonly ClientNotificationStatus[],
  isSelected: boolean,
): Set<string> {
  const next = new Set(selected);
  clients.forEach((client) => {
    if (isSelected) next.add(client.client_id);
    else next.delete(client.client_id);
  });
  return next;
}

/** Selected clients that some channel has already notified — they need a re-send warning. */
export function alreadyNotifiedClients(
  clients: readonly ClientNotificationStatus[],
  selected: ReadonlySet<string>,
): ClientNotificationStatus[] {
  return clients.filter(
    (client) =>
      selected.has(client.client_id) &&
      (client.is_sent_bot || client.is_sent_web),
  );
}

export function notifiedChannelsLabel(
  client: ClientNotificationStatus,
): string {
  return [client.is_sent_bot && "Bot", client.is_sent_web && "Web"]
    .filter(Boolean)
    .join("+");
}

export function sendChannelsLabel(
  markWeb: boolean,
  markBot: boolean,
): string | null {
  const channels = [markWeb && "Web", markBot && "Bot"].filter(Boolean);
  return channels.length > 0 ? channels.join(" + ") : null;
}

// Ostatka (A-) flights deliver via the bot to the ostatka group, not per-client.
// The web send path is blocked server-side; the UI disables it too.
export function isOstatkaFlight(flightName: string): boolean {
  return flightName.trim().toUpperCase().startsWith("A-");
}
