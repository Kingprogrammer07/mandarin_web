/**
 * The manager page's "recent clients" list, kept in localStorage.
 *
 * Only the code and name are kept. The list used to hold each client's whole
 * search result, flights and rows included, and picking a client from it reused
 * that copy as if it were current — days-old payment, collection and request
 * state. The flights are now always read fresh; this list only finds the client.
 */

export interface RecentDeliveryClient {
  client_code: string;
  full_name: string | null;
}

export const RECENT_CLIENTS_STORAGE_KEY = "admin_delivery_search_history";
export const RECENT_CLIENTS_LIMIT = 10;

function isRecentClient(value: unknown): value is { client_code: string; full_name?: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { client_code?: unknown }).client_code === "string" &&
    (value as { client_code: string }).client_code.trim() !== ""
  );
}

/**
 * Reads the stored list, accepting entries saved in the old shape.
 *
 * Storage can be unavailable (private mode) or hold anything, so every failure
 * reads as an empty list rather than breaking the page.
 */
export function readRecentClients(
  storage: Pick<Storage, "getItem"> = localStorage,
): RecentDeliveryClient[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(RECENT_CLIENTS_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentClient).slice(0, RECENT_CLIENTS_LIMIT).map((entry) => ({
      client_code: entry.client_code,
      full_name: typeof entry.full_name === "string" ? entry.full_name : null,
    }));
  } catch {
    return [];
  }
}

/** Puts a client first, without duplicates, keeping the list at its limit. */
export function rememberRecentClient(
  list: RecentDeliveryClient[],
  client: RecentDeliveryClient,
): RecentDeliveryClient[] {
  const rest = list.filter((entry) => entry.client_code !== client.client_code);
  return [
    { client_code: client.client_code, full_name: client.full_name },
    ...rest,
  ].slice(0, RECENT_CLIENTS_LIMIT);
}

/** Stores the list; a full or blocked storage only loses the convenience. */
export function writeRecentClients(
  list: RecentDeliveryClient[],
  storage: Pick<Storage, "setItem" | "removeItem"> = localStorage,
): void {
  try {
    if (list.length === 0) storage.removeItem(RECENT_CLIENTS_STORAGE_KEY);
    else storage.setItem(RECENT_CLIENTS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Quota exceeded or storage disabled: the page works without the list.
  }
}
