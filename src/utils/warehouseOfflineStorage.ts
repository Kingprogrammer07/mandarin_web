import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface WarehouseOfflineDB extends DBSchema {
  warehouse_pending: {
    key: string;
    value: WarehousePendingItem;
  };
}

export interface WarehousePendingItem {
  id: string;
  transactionIds: number[];
  clientCode: string;
  flightName: string;
  deliveryMethod: string;
  comment?: string;
  /** Compressed File objects (structured-cloneable, safe to store in IDB). */
  photos: File[];
  status: 'pending' | 'uploading' | 'error';
  error?: string;
  timestamp: number;
}

const DB_NAME = 'warehouse-offline-db';
const STORE_NAME = 'warehouse_pending';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<WarehouseOfflineDB>>;

function getDB(): Promise<IDBPDatabase<WarehouseOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WarehouseOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export const warehouseOfflineStorage = {
  async saveItem(item: WarehousePendingItem): Promise<void> {
    const db = await getDB();
    await db.put(STORE_NAME, item);
  },

  async getAllItems(): Promise<WarehousePendingItem[]> {
    const db = await getDB();
    return db.getAll(STORE_NAME);
  },

  async updateItem(id: string, updates: Partial<WarehousePendingItem>): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const existing = await store.get(id);
    if (!existing) return;
    await store.put({ ...existing, ...updates });
    await tx.done;
  },

  async deleteItem(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
  },

  async countItems(): Promise<number> {
    const db = await getDB();
    return db.count(STORE_NAME);
  },
};
