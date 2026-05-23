import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FastEntryQueueItem } from '@/store/expectedCargoStore';

interface ExpectedCargoQueueSnapshot {
  id: string;
  items: FastEntryQueueItem[];
  updatedAt: number;
}

interface ExpectedCargoQueueDB extends DBSchema {
  queue_snapshots: {
    key: string;
    value: ExpectedCargoQueueSnapshot;
  };
}

const DB_NAME = 'expected-cargo-queue-db';
const STORE_NAME = 'queue_snapshots';
const DB_VERSION = 1;
const GLOBAL_QUEUE_ID = 'active';

let dbPromise: Promise<IDBPDatabase<ExpectedCargoQueueDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ExpectedCargoQueueDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export const expectedCargoQueueStorage = {
  async loadQueue(): Promise<FastEntryQueueItem[]> {
    const db = await getDB();
    const snapshot = await db.get(STORE_NAME, GLOBAL_QUEUE_ID);
    return snapshot?.items ?? [];
  },

  async saveQueue(items: FastEntryQueueItem[]): Promise<void> {
    const db = await getDB();
    await db.put(STORE_NAME, {
      id: GLOBAL_QUEUE_ID,
      items,
      updatedAt: Date.now(),
    });
  },

  async clearQueue(): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, GLOBAL_QUEUE_ID);
  },

  async countQueue(): Promise<number> {
    const items = await this.loadQueue();
    return items.length;
  },
};
