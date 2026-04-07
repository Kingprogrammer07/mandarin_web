import { create } from 'zustand';
import {
  warehouseOfflineStorage,
  type WarehousePendingItem,
} from '../utils/warehouseOfflineStorage';

export type QueueItemStatus = 'pending' | 'uploading' | 'error';

export interface WarehouseQueueItem {
  id: string;
  transactionId: number;
  clientCode: string;
  flightName: string;
  deliveryMethod: string;
  photos: File[];
  status: QueueItemStatus;
  error?: string;
  timestamp: number;
}

interface WarehouseQueueState {
  items: WarehouseQueueItem[];
  isLoaded: boolean;
  /** Load persisted items from IndexedDB on app start. */
  initialize: () => Promise<void>;
  /** Add a new item to the queue (saves to IDB + in-memory). */
  enqueue: (
    payload: Omit<WarehouseQueueItem, 'id' | 'status' | 'timestamp'>,
  ) => Promise<string>;
  markUploading: (id: string) => void;
  markError: (id: string, error: string) => Promise<void>;
  markSuccess: (id: string) => Promise<void>;
  /** Reset a failed item back to pending so it is retried. */
  retryItem: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

export const useWarehouseQueueStore = create<WarehouseQueueState>((set, get) => ({
  items: [],
  isLoaded: false,

  async initialize() {
    if (get().isLoaded) return;
    const stored = await warehouseOfflineStorage.getAllItems();
    // Items interrupted mid-upload (status='uploading') revert to pending on reload.
    const items: WarehouseQueueItem[] = stored.map((item: WarehousePendingItem) => ({
      ...item,
      status: item.status === 'uploading' ? 'pending' : item.status,
    }));
    set({ items, isLoaded: true });
  },

  async enqueue(payload) {
    const id = crypto.randomUUID();
    const item: WarehouseQueueItem = {
      ...payload,
      id,
      status: 'pending',
      timestamp: Date.now(),
    };
    await warehouseOfflineStorage.saveItem({ ...item, status: 'pending' });
    set((s) => ({ items: [...s.items, item] }));
    return id;
  },

  markUploading(id) {
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, status: 'uploading' } : i)),
    }));
  },

  async markError(id, error) {
    await warehouseOfflineStorage.updateItem(id, { status: 'error', error });
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, status: 'error', error } : i,
      ),
    }));
  },

  async markSuccess(id) {
    await warehouseOfflineStorage.deleteItem(id);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  async retryItem(id) {
    await warehouseOfflineStorage.updateItem(id, { status: 'pending', error: undefined });
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, status: 'pending', error: undefined } : i,
      ),
    }));
  },

  async deleteItem(id) {
    await warehouseOfflineStorage.deleteItem(id);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },
}));
