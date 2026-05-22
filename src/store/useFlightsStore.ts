import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getFlights, type Flight } from '@/api/services/flight';
import { getFlightList, type FlightListItem } from '@/api/services/expectedCargo';
import { getAdminJwtClaims } from '@/api/services/adminManagement';

interface FlightsState {
  // Cached data
  flights: Flight[];
  expectedFlights: FlightListItem[];
  lastUpdated: string | null;   // ISO timestamp for regular flights
  expectedLastUpdated: string | null;

  // UI state
  isLoading: boolean;           // true only when BOTH are empty
  isLoadingRegular: boolean;    // true when fetching Google Sheets flights
  isRefreshing: boolean;
  error: string | null;

  // Actions
  fetchExpectedFlights: (options?: { force?: boolean }) => Promise<void>;
  fetchRegularFlights: (options?: { force?: boolean; silent?: boolean }) => Promise<void>;
  fetchAll: () => Promise<void>;
  refreshAll: () => Promise<void>;
  clearFlights: () => void;
}

const CACHE_STALE_MS = 5 * 60 * 1000; // 5 minutes

function isStale(lastUpdated: string | null): boolean {
  if (!lastUpdated) return true;
  return Date.now() - new Date(lastUpdated).getTime() > CACHE_STALE_MS;
}

export const useFlightsStore = create<FlightsState>()(
  persist(
    (set, get) => ({
      flights: [],
      expectedFlights: [],
      lastUpdated: null,
      expectedLastUpdated: null,
      isLoading: false,
      isLoadingRegular: false,
      isRefreshing: false,
      error: null,

      /** Fetch expected flights (DB) — FAST */
      fetchExpectedFlights: async (options = {}) => {
        const { force = false } = options;
        const state = get();

        // Skip if cached and not stale
        if (!force && state.expectedFlights.length > 0 && !isStale(state.expectedLastUpdated)) {
          return;
        }

        const { isSuperAdmin, permissions } = getAdminJwtClaims();
        const hasAccess = isSuperAdmin || permissions.has('expected_cargo:manage');
        if (!hasAccess) return;

        try {
          const res = await getFlightList();
          set({
            expectedFlights: res.items,
            expectedLastUpdated: new Date().toISOString(),
          });
        } catch (err: any) {
          // Expected cargo is non-critical, silent fail
          console.warn('Expected flights fetch failed:', err);
        }
      },

      /** Fetch regular flights (Google Sheets) — SLOW */
      fetchRegularFlights: async (options = {}) => {
        const { force = false, silent = false } = options;
        const state = get();

        // Skip if cached and not stale
        if (!force && state.flights.length > 0 && !isStale(state.lastUpdated)) {
          return;
        }

        if (!silent) set({ isLoadingRegular: true });
        set({ error: null });

        try {
          const res = await getFlights(5);
          const ordered = res.flights.reverse();
          set({
            flights: ordered,
            lastUpdated: new Date().toISOString(),
            error: null,
          });
        } catch (err: any) {
          set({ error: err?.message || 'Reyslarni yuklashda xatolik' });
        } finally {
          set({ isLoadingRegular: false, isRefreshing: false });
        }
      },

      /** Fetch both: expected first (fast), then regular (slow) */
      fetchAll: async () => {
        const state = get();
        const hasAnyData = state.expectedFlights.length > 0 || state.flights.length > 0;

        // Show loading only if completely empty
        if (!hasAnyData) set({ isLoading: true });

        // 1. Fetch expected flights FIRST (fast, from DB)
        await get().fetchExpectedFlights({ force: false });

        // 2. Then fetch regular flights (slow, from Google Sheets)
        await get().fetchRegularFlights({ force: false, silent: hasAnyData });

        set({ isLoading: false });
      },

      /** Force refresh both */
      refreshAll: async () => {
        set({ isRefreshing: true });
        await get().fetchExpectedFlights({ force: true });
        await get().fetchRegularFlights({ force: true, silent: true });
        set({ isRefreshing: false });
      },

      clearFlights: () => {
        set({
          flights: [],
          expectedFlights: [],
          lastUpdated: null,
          expectedLastUpdated: null,
          isLoading: false,
          isLoadingRegular: false,
          isRefreshing: false,
          error: null,
        });
      },
    }),
    {
      name: 'flights-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        flights: state.flights,
        expectedFlights: state.expectedFlights,
        lastUpdated: state.lastUpdated,
        expectedLastUpdated: state.expectedLastUpdated,
      }),
    }
  )
);
