import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { AstatkaPhoto, AstatkaStatus } from "@/api/services/astatka";

/**
 * Offline store for the astatka stock-take.
 *
 * The owner's requirement was blunt: *"internet muammosi server muammosi yokida
 * boshqa muammolarni deb workerlar qayta va qayta ishlamasligi kerak"* — a
 * network or server problem must never make a worker redo work. So every parcel
 * is written to disk BEFORE any attempt to send it, and stays there until the
 * server has confirmed it.
 *
 * That ordering is the whole point. A queue that sends first and stores on
 * failure loses everything the moment the page is closed mid-request, which in
 * a warehouse — phone in one hand, parcel in the other — happens constantly.
 *
 * Modelled on `expectedCargoScanStore`, which already solved this shape for the
 * expected-cargo scanner. The one thing this adds is photo blobs: a leftover
 * parcel with no billing row is photographed on the spot, and those bytes have
 * to survive offline too.
 */

/** Where a queued parcel is in its journey to the server. */
export type AstatkaQueueStatus =
  /** On disk, not yet sent. The only state that survives a crash meaningfully. */
  | "pending"
  /** A request is in flight. Reset to `pending` on load — see `recoverStuck`. */
  | "saving"
  /** The server confirmed it. Safe to drop, but kept briefly so the worker can
   *  still see what they just did. */
  | "saved";

export interface QueuedPhoto {
  /** Local id, referenced by a queued item until the blob has been uploaded. */
  id: string;
  astatkaId: number;
  /** Compressed before it ever gets here — see `utils/imageCompression`. */
  blob: Blob;
  createdAt: number;
}

export interface QueuedItem {
  /** Also the server-side idempotency key. Minted once, never regenerated. */
  id: string;
  astatkaId: number;
  status: AstatkaQueueStatus;
  trackCode: string | null;
  clientCode: string | null;
  sourceFlightName: string | null;
  weightKg: string | null;
  pricePerKg: string | null;
  comment: string | null;
  scanStatus: AstatkaStatus;
  sourceFlightCargoId: number | null;
  /** Photos already living on the server (copied from the billing row). */
  photos: AstatkaPhoto[];
  /** Local photo ids still waiting to be uploaded. */
  localPhotoIds: string[];
  enteredManually: boolean;
  /** When the worker scanned it, which is not when it will reach the server. */
  scannedAt: number;
  /** Failed attempts so far, used to back off rather than hammer a dead link. */
  attempts: number;
  lastError: string | null;
}

/** One row of the offline lookup index, so a scan resolves with no network. */
export interface ResolveEntry {
  trackCode: string;
  clientCode: string | null;
  flightName: string | null;
}

export interface ResolveIndexRecord {
  flightName: string;
  entries: ResolveEntry[];
  updatedAt: number;
}

interface MetaRow {
  key: string;
  value: unknown;
}

interface AstatkaDB extends DBSchema {
  items: {
    key: string;
    value: QueuedItem;
    indexes: { byAstatka: number; byStatus: string };
  };
  photos: { key: string; value: QueuedPhoto; indexes: { byAstatka: number } };
  resolve_index: { key: string; value: ResolveIndexRecord };
  meta: { key: string; value: MetaRow };
}

const DB_NAME = "astatka-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AstatkaDB>> | null = null;
let available: boolean | null = null;

function openDatabase(): Promise<IDBPDatabase<AstatkaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AstatkaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("items")) {
          const store = db.createObjectStore("items", { keyPath: "id" });
          store.createIndex("byAstatka", "astatkaId");
          store.createIndex("byStatus", "status");
        }
        if (!db.objectStoreNames.contains("photos")) {
          const store = db.createObjectStore("photos", { keyPath: "id" });
          store.createIndex("byAstatka", "astatkaId");
        }
        if (!db.objectStoreNames.contains("resolve_index")) {
          db.createObjectStore("resolve_index", { keyPath: "flightName" });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Is IndexedDB usable at all?
 *
 * Private browsing and locked-down devices can refuse it outright. The scanner
 * must still work in that case — it just cannot promise anything survives a
 * refresh, and the UI says so rather than pretending.
 */
export async function isAvailable(): Promise<boolean> {
  if (available !== null) return available;
  try {
    await openDatabase();
    available = true;
  } catch {
    available = false;
  }
  return available;
}

function normaliseTrackCode(code: string): string {
  return code.trim().toUpperCase();
}

export const astatkaStore = {
  /**
   * Persist a parcel before anything is sent.
   *
   * Called on the scan itself, not after a successful request. If the phone
   * dies one millisecond later the parcel is still counted.
   */
  async enqueue(item: QueuedItem): Promise<void> {
    const db = await openDatabase();
    await db.put("items", item);
  },

  async update(id: string, patch: Partial<QueuedItem>): Promise<void> {
    const db = await openDatabase();
    const existing = await db.get("items", id);
    if (!existing) return;
    await db.put("items", { ...existing, ...patch });
  },

  async listForAstatka(astatkaId: number): Promise<QueuedItem[]> {
    const db = await openDatabase();
    const rows = await db.getAllFromIndex("items", "byAstatka", astatkaId);
    // Newest first: the worker looks at what they just scanned, not at row one.
    return rows.sort((a, b) => b.scannedAt - a.scannedAt);
  },

  /** Everything still owed to the server, oldest first so order is preserved. */
  async pending(astatkaId: number): Promise<QueuedItem[]> {
    const rows = await this.listForAstatka(astatkaId);
    return rows
      .filter((row) => row.status !== "saved")
      .sort((a, b) => a.scannedAt - b.scannedAt);
  },

  async countPending(astatkaId: number): Promise<number> {
    return (await this.pending(astatkaId)).length;
  },

  /**
   * Put `saving` rows back to `pending` on startup.
   *
   * A row is `saving` only while a request is in flight, so finding one at load
   * time means the tab died mid-send. The safe reading is "we do not know if it
   * arrived" — and re-sending is free, because the idempotency key makes a
   * duplicate impossible. Leaving them as `saving` would strand them forever,
   * which is precisely the "worker redoes the work" outcome to avoid.
   */
  async recoverStuck(astatkaId: number): Promise<number> {
    const db = await openDatabase();
    const rows = await db.getAllFromIndex("items", "byAstatka", astatkaId);
    const stuck = rows.filter((row) => row.status === "saving");
    for (const row of stuck) {
      await db.put("items", { ...row, status: "pending" });
    }
    return stuck.length;
  },

  /** Drop confirmed rows, keeping the most recent for the on-screen list. */
  async pruneSaved(astatkaId: number, keep = 200): Promise<void> {
    const db = await openDatabase();
    const rows = (await db.getAllFromIndex("items", "byAstatka", astatkaId))
      .filter((row) => row.status === "saved")
      .sort((a, b) => b.scannedAt - a.scannedAt);
    for (const row of rows.slice(keep)) {
      await db.delete("items", row.id);
    }
  },

  // ── Photos ───────────────────────────────────────────────────────────────

  /**
   * Store a photo's bytes locally.
   *
   * Compress before calling this. At 1280px/0.82 a phone photo lands around
   * 200 KB, so a 200-parcel shift is roughly 40 MB — fine. The same shift at
   * full resolution would be closer to 600 MB and would start failing writes.
   */
  async putPhoto(photo: QueuedPhoto): Promise<void> {
    const db = await openDatabase();
    await db.put("photos", photo);
  },

  async getPhoto(id: string): Promise<QueuedPhoto | undefined> {
    const db = await openDatabase();
    return db.get("photos", id);
  },

  async deletePhoto(id: string): Promise<void> {
    const db = await openDatabase();
    await db.delete("photos", id);
  },

  async photoCount(astatkaId: number): Promise<number> {
    const db = await openDatabase();
    return (await db.getAllFromIndex("photos", "byAstatka", astatkaId)).length;
  },

  // ── Offline resolve index ────────────────────────────────────────────────

  /**
   * Cache one flight's track codes so a scan resolves with no network.
   *
   * This is what lets an offline scan still name the client and the flight. It
   * cannot supply a weight — those live in the billing table, which is not
   * indexed here — so an offline scan lands on `needs_data` and the worker types
   * the numbers. That is a deliberate limit, not an oversight: the billing table
   * covers 18 flights against the manifest's 129, so caching it would add a lot
   * of bytes to answer a minority of scans.
   */
  async putResolveIndex(record: ResolveIndexRecord): Promise<void> {
    const db = await openDatabase();
    await db.put("resolve_index", record);
  },

  async getResolveIndex(
    flightName: string,
  ): Promise<ResolveIndexRecord | undefined> {
    const db = await openDatabase();
    return db.get("resolve_index", flightName);
  },

  async indexedFlights(): Promise<string[]> {
    const db = await openDatabase();
    return (await db.getAll("resolve_index")).map((row) => row.flightName);
  },

  /**
   * Look a code up in whatever has been cached.
   *
   * Searches every cached flight rather than only the stock-take's own, so a
   * parcel from a flight the worker did not select is still identified — and
   * can be reported as out of scope instead of as an unknown code. Telling a
   * worker "this is from M265, not this astatka" is a far more useful answer
   * than "no idea".
   */
  async resolveOffline(trackCode: string): Promise<ResolveEntry | null> {
    const db = await openDatabase();
    const wanted = normaliseTrackCode(trackCode);
    const records = await db.getAll("resolve_index");
    for (const record of records) {
      const hit = record.entries.find(
        (entry) => normaliseTrackCode(entry.trackCode) === wanted,
      );
      if (hit) return hit;
    }
    return null;
  },

  // ── Meta ─────────────────────────────────────────────────────────────────

  async setMeta(key: string, value: unknown): Promise<void> {
    const db = await openDatabase();
    await db.put("meta", { key, value });
  },

  async getMeta<T>(key: string): Promise<T | undefined> {
    const db = await openDatabase();
    const row = await db.get("meta", key);
    return row?.value as T | undefined;
  },
};
