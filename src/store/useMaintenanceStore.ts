import { create } from "zustand";

interface MaintenanceState {
  isMaintenanceMode: boolean;
  triggerMaintenance: () => void;
  clearMaintenance: () => void;
}

export const useMaintenanceStore = create<MaintenanceState>((set) => ({
  isMaintenanceMode: false,
  triggerMaintenance: () => set({ isMaintenanceMode: true }),
  clearMaintenance: () => set({ isMaintenanceMode: false }),
}));
