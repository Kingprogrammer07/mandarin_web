import { create } from "zustand";

type PaymentStatus = "all" | "paid" | "unpaid" | "partial";
type TakenStatus = "all" | "taken" | "not_taken";

interface WarehouseState {
  flightName: string;
  searchQuery: string;
  strictSearch: boolean;
  paymentStatus: PaymentStatus;
  takenStatus: TakenStatus;
  page: number;
  size: number;

  setFlightName: (name: string) => void;
  setSearchQuery: (query: string) => void;
  setStrictSearch: (strict: boolean) => void;
  setPaymentStatus: (status: PaymentStatus) => void;
  setTakenStatus: (status: TakenStatus) => void;
  setPage: (page: number) => void;
  setSize: (size: number) => void;
  resetFilters: () => void;
}

export const useWarehouseStore = create<WarehouseState>((set) => ({
  flightName: "",
  searchQuery: "",
  strictSearch: false,
  paymentStatus: "all",
  takenStatus: "all",
  page: 1,
  size: 50,

  setFlightName: (name) => set({ flightName: name, page: 1 }),
  setSearchQuery: (query) => set({ searchQuery: query, page: 1 }),
  setStrictSearch: (strict) => set({ strictSearch: strict, page: 1 }),
  setPaymentStatus: (status) => set({ paymentStatus: status, page: 1 }),
  setTakenStatus: (status) => set({ takenStatus: status, page: 1 }),
  setPage: (page) => set({ page }),
  setSize: (size) => set({ size, page: 1 }),
  resetFilters: () =>
    set({
      searchQuery: "",
      strictSearch: false,
      paymentStatus: "all",
      takenStatus: "all",
      page: 1,
      size: 50,
    }),
}));
