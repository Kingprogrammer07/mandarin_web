import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FastEntryQueueItem } from '@/store/expectedCargoStore';

/**
 * Durable per-item storage for the Expected Cargo scanner queue.
 *
 * Why this exists: warehouse workers scan 1k+ track codes over an 8-hour shift.
 * Losing scans on a power cut, browser crash, or failed save is unacceptable.
 * The previous implementation backed up the whole in-memory array to a single
 * IndexedDB key on a 250ms debounce — a crash in that window dropped recent
 * scans, and the O(n) full-array rewrite scaled badly.
 *
 * Here every scan is its own record (`scan_items`, keyPath `id`) written with an
 * O(1) atomic `put`. The in-memory zustand queue is a render mirror; this store
 * is the source of truth that survives reloads/crashes. The save flow marks
 * items `saving` before pushing so an interrupted save is resumable on reload.
 */

export type ScanItemStatus = 'pending' | 'saving' | 'saved';

/** A queue item plus the durability metadata that is never shown in the UI. */
export interface PersistedScanItem extends FastEntryQueueItem {
  status: ScanItemStatus;
  flightName: string | null;
}

interface LegacyQueueSnapshot {
  id: string;
  items: FastEntryQueueItem[];
  updatedAt: number;
}

interface MetaRow {
  key: string;
  value: unknown;
}

/** One track→client mapping in a flight's offline resolve snapshot. */
export interface ResolveIndexEntryRecord {
  track_code: string;
  client_code: string;
  client_id: number | null;
  client_name: string | null;
}

/** Persisted offline resolve snapshot for one flight (downloaded via Sync). */
export interface ResolveIndexRecord {
  flightName: string;
  entries: ResolveIndexEntryRecord[];
  alreadySent: string[];
  syncedAt: string;
}

interface ExpectedCargoDB extends DBSchema {
  // Legacy v1 store, kept only so v1→v2 migration can read it once.
  queue_snapshots: { key: string; value: LegacyQueueSnapshot };
  scan_items: {
    key: string;
    value: PersistedScanItem;
    indexes: { byStatus: string };
  };
  meta: { key: string; value: MetaRow };
  resolve_index: { key: string; value: ResolveIndexRecord };
}

const DB_NAME = 'expected-cargo-queue-db';
const DB_VERSION = 3;
const LEGACY_STORE = 'queue_snapshots';
const SCAN_STORE = 'scan_items';
const META_STORE = 'meta';
const RESOLVE_INDEX_STORE = 'resolve_index';
const LEGACY_GLOBAL_ID = 'active';
const MIGRATION_FLAG = 'v1_to_v2_migrated';

let dbPromise: Promise<IDBPDatabase<ExpectedCargoDB>> | null = null;
let availability: boolean | null = null;

function openDatabase(): Promise<IDBPDatabase<ExpectedCargoDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ExpectedCargoDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v1 created `queue_snapshots`; preserve it for migration.
        if (oldVersion < 1 && !db.objectStoreNames.contains(LEGACY_STORE)) {
          db.createObjectStore(LEGACY_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SCAN_STORE)) {
          const store = db.createObjectStore(SCAN_STORE, { keyPath: 'id' });
          store.createIndex('byStatus', 'status');
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(RESOLVE_INDEX_STORE)) {
          db.createObjectStore(RESOLVE_INDEX_STORE, { keyPath: 'flightName' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Best-effort one-time import of the legacy single-snapshot queue into the new
 * per-item store. Idempotent via a meta flag; the legacy snapshot is cleared
 * only after a successful import so a crash mid-migration cannot lose data.
 */
async function migrateLegacyIfNeeded(db: IDBPDatabase<ExpectedCargoDB>): Promise<void> {
  const flag = await db.get(META_STORE, MIGRATION_FLAG);
  if (flag?.value === true) return;

  const snapshot = await db.get(LEGACY_STORE, LEGACY_GLOBAL_ID);
  const legacyItems = snapshot?.items ?? [];

  if (legacyItems.length > 0) {
    const tx = db.transaction(SCAN_STORE, 'readwrite');
    await Promise.all(
      legacyItems.map((item) =>
        tx.store.put({ ...item, status: 'pending', flightName: item.flightName ?? null }),
      ),
    );
    await tx.done;
  }

  await db.put(META_STORE, { key: MIGRATION_FLAG, value: true });
  // Drop the legacy snapshot now that it has been imported.
  try {
    await db.delete(LEGACY_STORE, LEGACY_GLOBAL_ID);
  } catch {
    // Non-fatal: the migration flag already prevents re-import.
  }
}

function toPersisted(item: FastEntryQueueItem): PersistedScanItem {
  return {
    ...item,
    status: item.status ?? 'pending',
    flightName: item.flightName ?? null,
  };
}

export const expectedCargoScanStore = {
  /** Returns false when IndexedDB cannot be opened (e.g. private mode). */
  async isAvailable(): Promise<boolean> {
    if (availability !== null) return availability;
    try {
      await openDatabase();
      availability = true;
    } catch {
      availability = false;
    }
    return availability;
  },

  /** Load every persisted item (the queue is a single global working set). */
  async loadItems(): Promise<PersistedScanItem[]> {
    const db = await openDatabase();
    await migrateLegacyIfNeeded(db);
    return db.getAll(SCAN_STORE);
  },

  /** Items left in `saving` from a previous, interrupted save — used to resume. */
  async loadSavingItems(): Promise<PersistedScanItem[]> {
    const db = await openDatabase();
    return db.getAllFromIndex(SCAN_STORE, 'byStatus', 'saving');
  },

  /** Durable write of a single scan. O(1), atomic — call BEFORE touching memory. */
  async putItem(item: FastEntryQueueItem): Promise<void> {
    const db = await openDatabase();
    await db.put(SCAN_STORE, toPersisted(item));
  },

  /** Batch upsert in one transaction (used by the reconcile pass). */
  async putItems(items: FastEntryQueueItem[]): Promise<void> {
    if (items.length === 0) return;
    const db = await openDatabase();
    const tx = db.transaction(SCAN_STORE, 'readwrite');
    await Promise.all(items.map((item) => tx.store.put(toPersisted(item))));
    await tx.done;
  },

  /** Batch delete in one transaction. */
  async deleteItems(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await openDatabase();
    const tx = db.transaction(SCAN_STORE, 'readwrite');
    await Promise.all(ids.map((id) => tx.store.delete(id)));
    await tx.done;
  },

  /** Remove every persisted item (full clear). */
  async clearAll(): Promise<void> {
    const db = await openDatabase();
    await db.clear(SCAN_STORE);
  },

  /** Persist a flight's offline resolve snapshot (keyed by flight name, UPPER). */
  async saveResolveIndex(record: ResolveIndexRecord): Promise<void> {
    const db = await openDatabase();
    await db.put(RESOLVE_INDEX_STORE, {
      ...record,
      flightName: record.flightName.trim().toUpperCase(),
    });
  },

  /** Load a flight's offline resolve snapshot, or null if none was downloaded. */
  async loadResolveIndex(flightName: string): Promise<ResolveIndexRecord | null> {
    const db = await openDatabase();
    const record = await db.get(RESOLVE_INDEX_STORE, flightName.trim().toUpperCase());
    return record ?? null;
  },
};
