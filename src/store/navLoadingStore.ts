import { create } from 'zustand';

interface NavLoadingStore {
  isLoading: boolean;
  setLoading: (v: boolean) => void;
}

export const useNavLoadingStore = create<NavLoadingStore>((set) => ({
  isLoading: false,
  setLoading: (v) => set({ isLoading: v }),
}));
