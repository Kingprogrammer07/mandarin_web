import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FlightItem } from '../api/services/deliveryService';

interface DeliveryState {
  paidFlights: FlightItem[] | null;
  cachedAt: number | null;
  ttlMs: number;

  /** Save freshly fetched flights into the cache. */
  setPaidFlights: (flights: FlightItem[]) => void;
  /** Return cached flights if they haven't expired; otherwise null. */
  getCachedFlights: () => FlightItem[] | null;
  /** Purge the cache manually (e.g. on explicit refresh). */
  clearCache: () => void;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const useDeliveryStore = create<DeliveryState>()(
  persist(
    (set, get) => ({
      paidFlights: null,
      cachedAt: null,
      ttlMs: DEFAULT_TTL_MS,

      setPaidFlights(flights) {
        set({ paidFlights: flights, cachedAt: Date.now() });
      },

      getCachedFlights() {
        const { paidFlights, cachedAt, ttlMs } = get();
        if (!paidFlights || !cachedAt) return null;
        if (Date.now() - cachedAt > ttlMs) return null;
        return paidFlights;
      },

      clearCache() {
        set({ paidFlights: null, cachedAt: null });
      },
    }),
    {
      name: 'delivery-store-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        paidFlights: state.paidFlights,
        cachedAt: state.cachedAt,
        ttlMs: state.ttlMs,
      }),
    },
  ),
);
