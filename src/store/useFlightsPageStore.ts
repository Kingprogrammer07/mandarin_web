import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  getFlightsDashboard,
  type FlightDashboardItem,
  type FlightDashboardParams,
} from '@/api/services/flightSchedule';

type FlightTypeFilter = NonNullable<FlightDashboardParams['type']>;
type FlightSort = NonNullable<FlightDashboardParams['sort']>;

interface FlightsPageState {
  flights: FlightDashboardItem[];
  featuredFlights: FlightDashboardItem[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
  searchQuery: string;
  typeFilter: FlightTypeFilter;
  showCompleted: boolean;
  sort: FlightSort;
  isLoading: boolean;
  isRefreshing: boolean;
  isFeaturedLoading: boolean;
  error: string | null;

  fetchFlights: (options?: { page?: number; quiet?: boolean }) => Promise<void>;
  fetchFeaturedFlights: () => Promise<void>;
  setPage: (page: number) => void;
  setPerPage: (count: number) => void;
  setSearchQuery: (query: string) => void;
  setTypeFilter: (type: FlightTypeFilter) => void;
  setShowCompleted: (showCompleted: boolean) => void;
  setSort: (sort: FlightSort) => void;
  refresh: () => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Reyslarni yuklashda xatolik';
}

export const useFlightsPageStore = create<FlightsPageState>()(
  persist(
    (set, get) => ({
      flights: [],
      featuredFlights: [],
      total: 0,
      totalPages: 1,
      page: 1,
      perPage: 5,
      searchQuery: '',
      typeFilter: 'all',
      showCompleted: false,
      sort: 'newest',
      isLoading: false,
      isRefreshing: false,
      isFeaturedLoading: false,
      error: null,

      fetchFlights: async (options = {}) => {
        const state = get();
        const page = options.page ?? state.page;
        if (!options.quiet) set({ isLoading: true });
        set({ error: null });

        try {
          const res = await getFlightsDashboard({
            page,
            per_page: state.perPage,
            search: state.searchQuery.trim() || undefined,
            type: state.typeFilter,
            status: state.showCompleted ? 'all' : 'active',
            sort: state.sort,
          });
          set({
            flights: res.items,
            total: res.total,
            totalPages: res.total_pages,
            page: res.page,
            isLoading: false,
            isRefreshing: false,
            error: null,
          });
        } catch (error) {
          set({
            error: getErrorMessage(error),
            isLoading: false,
            isRefreshing: false,
          });
        }
      },

      fetchFeaturedFlights: async () => {
        set({ isFeaturedLoading: true });
        try {
          const res = await getFlightsDashboard({
            page: 1,
            per_page: 5,
            status: 'active',
            type: 'all',
            sort: 'newest',
          });
          set({
            featuredFlights: res.items,
            isFeaturedLoading: false,
          });
        } catch {
          set({ isFeaturedLoading: false });
        }
      },

      setPage: (page: number) => {
        set({ page });
        void get().fetchFlights({ page, quiet: true });
      },

      setPerPage: (count: number) => {
        set({ perPage: count, page: 1 });
        void get().fetchFlights({ page: 1, quiet: true });
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query, page: 1 });
        void get().fetchFlights({ page: 1, quiet: true });
      },

      setTypeFilter: (type: FlightTypeFilter) => {
        set({ typeFilter: type, page: 1 });
        void get().fetchFlights({ page: 1, quiet: true });
      },

      setShowCompleted: (showCompleted: boolean) => {
        set({ showCompleted, page: 1 });
        void get().fetchFlights({ page: 1, quiet: true });
      },

      setSort: (sort: FlightSort) => {
        set({ sort, page: 1 });
        void get().fetchFlights({ page: 1, quiet: true });
      },

      refresh: async () => {
        set({ isRefreshing: true });
        await Promise.all([
          get().fetchFlights({ page: get().page, quiet: true }),
          get().fetchFeaturedFlights(),
        ]);
        set({ isRefreshing: false });
      },
    }),
    {
      name: 'flights-page-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        page: state.page,
        perPage: state.perPage,
        searchQuery: state.searchQuery,
        typeFilter: state.typeFilter,
        showCompleted: state.showCompleted,
        sort: state.sort,
      }),
    },
  ),
);
