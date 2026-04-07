import { create } from "zustand";

interface ManagerState {
  searchQuery: string;
  page: number;
  size: number;
  selectedClientId: number | null;
  
  setSearchQuery: (query: string) => void;
  setPage: (page: number) => void;
  setSize: (size: number) => void;
  setSelectedClientId: (id: number | null) => void;
  resetFilters: () => void;
}

export const useManagerStore = create<ManagerState>((set) => ({
  searchQuery: "",
  page: 1,
  size: 20,
  selectedClientId: null,

  setSearchQuery: (query) => set({ searchQuery: query, page: 1 }), // Reset to page 1 on new search
  setPage: (page) => set({ page }),
  setSize: (size) => set({ size, page: 1 }), // Reset to page 1 on size change
  setSelectedClientId: (id) => set({ selectedClientId: id }),
  resetFilters: () => set({ searchQuery: "", page: 1, size: 20, selectedClientId: null }),
}));
