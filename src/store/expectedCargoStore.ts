import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ── Fast Entry Queue ───────────────────────────────────────────────────────────

export interface FastEntryQueueItem {
  /** Locally generated UUID — used as React key and for targeted updates. */
  id: string;
  trackCode: string;
  /** Client code resolved via API 7; empty string means unresolved (user must fill). */
  clientCode: string;
  resolvedClientName: string | null;
  resolvedClientId: number | null;
  /** True when /resolve-client returned a match; false when manual or still loading. */
  isResolved: boolean;
}

// ── Store Interface ────────────────────────────────────────────────────────────

interface ExpectedCargoState {
  // ── Navigation & View State ─────────────────────────────────────────────────
  /** The flight whose client summary is currently displayed in the main list. */
  activeFlightName: string | null;
  /** The client code whose track codes are expanded (accordion — only one at a time). */
  expandedClientCode: string | null;
  /** When true, rows show delete / replace controls. */
  isEditMode: boolean;
  /** Client-side filter applied to the summary list (matches against client_code). */
  searchQuery: string;
  /** Whether the fast-entry scanning panel is visible. */
  isFastEntryOpen: boolean;

  // ── Persisted Tab Ordering ──────────────────────────────────────────────────
  /**
   * User-defined ordering of flight tabs (flight_name strings).
   * Persisted to localStorage so custom order survives page reloads.
   * New flights fetched from the API are appended at the end.
   * Flights no longer returned by the API are pruned automatically.
   */
  flightTabOrder: string[];

  // ── Fast Entry Queue ────────────────────────────────────────────────────────
  /** Scanned items waiting to be bulk-saved. NOT persisted — ephemeral per session. */
  entryQueue: FastEntryQueueItem[];

  // ── Actions ─────────────────────────────────────────────────────────────────
  setActiveFlight: (name: string | null) => void;
  setExpandedClient: (code: string | null) => void;
  toggleEditMode: () => void;
  setEditMode: (value: boolean) => void;
  setSearchQuery: (query: string) => void;
  setFastEntryOpen: (open: boolean) => void;

  /**
   * Merges incoming API flight names with the stored order.
   * Keeps stored order for known flights; appends newly seen ones; drops removed ones.
   */
  syncFlightTabOrder: (apiFlightNames: string[]) => void;
  setFlightTabOrder: (orderedNames: string[]) => void;

  enqueueEntry: (item: Omit<FastEntryQueueItem, 'id'>) => void;
  /** Update the client resolution data for a queued item identified by trackCode. */
  resolveQueueItemClient: (
    trackCode: string,
    clientCode: string,
    clientName: string | null,
    clientId: number | null,
  ) => void;
  /** Override client_code for items where auto-resolution failed. */
  setQueueItemClientCode: (id: string, clientCode: string) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
}

// ── Store Implementation ───────────────────────────────────────────────────────

export const useExpectedCargoStore = create<ExpectedCargoState>()(
  persist(
    (set, get) => ({
      // ── Initial state ─────────────────────────────────────────────────────
      activeFlightName: null,
      expandedClientCode: null,
      isEditMode: false,
      searchQuery: '',
      isFastEntryOpen: false,
      flightTabOrder: [],
      entryQueue: [],

      // ── View actions ──────────────────────────────────────────────────────

      setActiveFlight: (name) =>
        set({
          // Always store and send flight names in uppercase for consistency
          activeFlightName: name ? name.toUpperCase() : null,
          // Reset accordion and search when switching flights
          expandedClientCode: null,
          searchQuery: '',
        }),

      setExpandedClient: (code) =>
        set((state) => ({
          // Toggle: clicking an already-open row collapses it
          expandedClientCode: state.expandedClientCode === code ? null : code,
        })),

      toggleEditMode: () =>
        set((state) => ({
          isEditMode: !state.isEditMode,
          // Exiting edit mode collapses any open accordion row
          expandedClientCode: state.isEditMode ? null : state.expandedClientCode,
        })),

      setEditMode: (value) => set({ isEditMode: value }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      setFastEntryOpen: (open) => set({ isFastEntryOpen: open }),

      // ── Tab ordering ──────────────────────────────────────────────────────

      syncFlightTabOrder: (apiFlightNames) => {
        const currentOrder = get().flightTabOrder;
        const apiSet = new Set(apiFlightNames);

        // Keep stored positions for known flights; drop removed ones
        const preserved = currentOrder.filter((name) => apiSet.has(name));
        const preservedSet = new Set(preserved);

        // Append flights not yet in the stored order
        const appended = apiFlightNames.filter((name) => !preservedSet.has(name));

        const merged = [...preserved, ...appended];
        set({ flightTabOrder: merged });
      },

      setFlightTabOrder: (orderedNames) => set({ flightTabOrder: orderedNames }),

      // ── Queue actions ─────────────────────────────────────────────────────

      enqueueEntry: (item) => {
        const id = crypto.randomUUID();
        set((state) => ({
          entryQueue: [...state.entryQueue, { ...item, id }],
        }));
      },

      resolveQueueItemClient: (trackCode, clientCode, clientName, clientId) =>
        set((state) => ({
          entryQueue: state.entryQueue.map((item) =>
            item.trackCode === trackCode
              ? {
                  ...item,
                  clientCode,
                  resolvedClientName: clientName,
                  resolvedClientId: clientId,
                  isResolved: true,
                }
              : item,
          ),
        })),

      setQueueItemClientCode: (id, clientCode) =>
        set((state) => ({
          entryQueue: state.entryQueue.map((item) =>
            item.id === id ? { ...item, clientCode } : item,
          ),
        })),

      removeFromQueue: (id) =>
        set((state) => ({
          entryQueue: state.entryQueue.filter((item) => item.id !== id),
        })),

      clearQueue: () => set({ entryQueue: [] }),
    }),

    {
      name: 'expected-cargo-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist the user-defined tab ordering — everything else is ephemeral UI state.
      partialize: (state) => ({ flightTabOrder: state.flightTabOrder }),
    },
  ),
);
