import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/**
 * The client code list the cargo form completes codes from, kept on the device
 * so completion is instant and still works offline.
 *
 * Every call swallows storage errors: a private window or a full disk costs
 * the worker only the offline list, never the form.
 */

interface SavedList<T> {
  key: string;
  codes: T;
  savedAt: number;
}

interface ClientCodeIndexDB extends DBSchema {
  lists: { key: string; value: SavedList<string[][]> | SavedList<string[]> };
}

const DB_NAME = "mandarin-client-codes";
const CLIENTS_KEY = "clients";
const flightKey = (flight: string) => `flight:${flight.trim().toUpperCase()}`;

let dbPromise: Promise<IDBPDatabase<ClientCodeIndexDB>> | null = null;

function database(): Promise<IDBPDatabase<ClientCodeIndexDB>> {
  dbPromise ??= openDB<ClientCodeIndexDB>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore("lists", { keyPath: "key" });
    },
  }).catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

async function load<T>(key: string): Promise<SavedList<T> | null> {
  try {
    return ((await (await database()).get("lists", key)) as SavedList<T> | undefined) ?? null;
  } catch {
    return null;
  }
}

async function save(key: string, codes: string[][] | string[]): Promise<void> {
  try {
    await (await database()).put("lists", { key, codes, savedAt: Date.now() } as SavedList<string[]>);
  } catch {
    // Storage refused: the in-memory list still serves this session.
  }
}

export const clientCodeIndexStore = {
  loadClients: () => load<string[][]>(CLIENTS_KEY),
  saveClients: (clients: string[][]) => save(CLIENTS_KEY, clients),
  loadFlightCodes: (flight: string) => load<string[]>(flightKey(flight)),
  saveFlightCodes: (flight: string, codes: string[]) => save(flightKey(flight), codes),
};
