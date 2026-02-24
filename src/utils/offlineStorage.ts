import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface CargoAppDB extends DBSchema {
    'failed_uploads': {
        key: string;
        value: FailedItem;
    };
}

export interface FailedItem {
    id: string; // uuid
    flightName: string;
    clientId: string;
    photos: File[]; // Stored as Blob/File objects
    weightKg?: number;
    pricePerKg?: number;
    comment?: string;
    error: string; // Changed from errorReason to match request
    timestamp: number;
}

const DB_NAME = 'cargo-app-db';
const STORE_NAME = 'failed_uploads';
const DB_VERSION = 1;
const CLEANUP_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let dbPromise: Promise<IDBPDatabase<CargoAppDB>>;

const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<CargoAppDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
};

export const offlineStorage = {
    /**
     * Delete items older than 30 days
     */
    async cleanupOldItems(): Promise<void> {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const now = Date.now();

        let cursor = await store.openCursor();

        while (cursor) {
            const item = cursor.value;
            if (now - item.timestamp > CLEANUP_AGE_MS) {
                await cursor.delete();
            }
            cursor = await cursor.continue();
        }

        await tx.done;
    },

    /**
     * Save a failed item to IndexedDB
     */
    async saveItem(item: FailedItem): Promise<void> {
        const db = await getDB();
        await db.put(STORE_NAME, item);
    },

    /**
     * Get all failed items (triggers cleanup first)
     */
    async getAllItems(flightName?: string): Promise<FailedItem[]> {
        // Auto-cleanup on fetch
        await this.cleanupOldItems();

        const db = await getDB();
        const allItems = await db.getAll(STORE_NAME);

        if (flightName) {
            return allItems.filter(item => item.flightName === flightName);
        }

        return allItems;
    },

    /**
     * Update a specific failed item
     */
    async updateItem(id: string, updates: Partial<FailedItem>): Promise<void> {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const item = await store.get(id);
        if (!item) throw new Error(`Item with id ${id} not found`);

        const updatedItem = {
            ...item,
            ...updates,
            timestamp: Date.now() // Always update timestamp on edit
        };

        await store.put(updatedItem);
        await tx.done;
    },

    /**
     * Delete a specific item by ID
     */
    async deleteItem(id: string): Promise<void> {
        const db = await getDB();
        await db.delete(STORE_NAME, id);
    },

    /**
     * Delete all items for a specific flight
     */
    async deleteItemsByFlight(flightName: string): Promise<void> {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        let cursor = await store.openCursor();

        while (cursor) {
            if (cursor.value.flightName === flightName) {
                await cursor.delete();
            }
            cursor = await cursor.continue();
        }
        await tx.done;
    },

    /**
     * Clear all items (Global)
     */
    async clearAll(): Promise<void> {
        const db = await getDB();
        await db.clear(STORE_NAME);
    },

    /**
     * Count items
     */
    async countItems(): Promise<number> {
        const db = await getDB();
        return db.count(STORE_NAME);
    }
};
