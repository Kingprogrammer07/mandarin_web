import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ── Fast Entry Queue ───────────────────────────────────────────────────────────

export interface FastEntryQueueItem {
  /** Locally generated UUID — used as React key and for targeted updates. */
  id: string;
  trackCode: string;
  /** Client code resolved via API; empty string means unresolved (user must fill). */
  clientCode: string;
  resolvedClientName: string | null;
  resolvedClientId: number | null;
  /** True when resolve-client returned a match; false when manual or still loading. */
  isResolved: boolean;
  /**
   * True when resolve-client returned 404 — no client found for this track code.
   * The admin must fill in the client code manually.
   */
  notFound: boolean;
  /**
   * True when resolve-client returned 409 — this track code already exists in the
   * expected cargo table (was sent in a previous session).
   */
  isAlreadySent: boolean;
  /** Flight name from the 409 response body — which flight already has this code. */
  alreadySentFlight: string | null;
  /**
   * True when this track code belongs to a client that already has entries in the
   * current session queue AND at least one different client was scanned in between.
   */
  isContinuation: boolean;
  /** How many prior queue items share this same clientCode at the time of scan. */
  priorCountForClient: number;
}

// ── Notification History ───────────────────────────────────────────────────────

export type NotificationType = 'warning' | 'success' | 'error' | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  createdAt: string;
  isRead: boolean;
  navigateTo?: {
    flightName: string;
    clientCode: string;
  };
}

// ── Store Interface ────────────────────────────────────────────────────────────

interface ExpectedCargoState {
  activeFlightName: string | null;
  expandedClientCode: string | null;
  isEditMode: boolean;
  searchQuery: string;
  isFastEntryOpen: boolean;
  /**
   * When true the VirtualizedClientList is hidden and the FastEntryPanel queue
   * list expands to fill the freed space — useful when reviewing duplicate clients.
   * Not persisted (resets on page reload).
   */
  isClientListHidden: boolean;

  flightTabOrder: string[];
  entryQueue: FastEntryQueueItem[];
  notifications: NotificationItem[];

  setActiveFlight: (name: string | null) => void;
  setExpandedClient: (code: string | null) => void;
  toggleEditMode: () => void;
  setEditMode: (value: boolean) => void;
  setSearchQuery: (query: string) => void;
  setFastEntryOpen: (open: boolean) => void;
  setClientListHidden: (hidden: boolean) => void;

  syncFlightTabOrder: (apiFlightNames: string[]) => void;
  setFlightTabOrder: (orderedNames: string[]) => void;

  enqueueEntry: (item: Omit<FastEntryQueueItem, 'id' | 'isContinuation' | 'priorCountForClient' | 'notFound' | 'isAlreadySent' | 'alreadySentFlight'>) => void;
  resolveQueueItemClient: (
    trackCode: string,
    clientCode: string,
    clientName: string | null,
    clientId: number | null,
    isContinuation: boolean,
    priorCountForClient: number,
  ) => void;
  /** Mark an item as not-found (404) — leaves isResolved false, flags for red UI. */
  markQueueItemNotFound: (trackCode: string) => void;
  /** Mark an item as already-sent (409) — the track code is already in the expected cargo table. */
  markQueueItemAlreadySent: (trackCode: string, flight: string | null) => void;
  setQueueItemClientCode: (id: string, clientCode: string) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;

  addNotification: (notification: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'>) => void;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

// ── Store Implementation ───────────────────────────────────────────────────────

export const useExpectedCargoStore = create<ExpectedCargoState>()(
  persist(
    (set, get) => ({
      activeFlightName: null,
      expandedClientCode: null,
      isEditMode: false,
      searchQuery: '',
      isFastEntryOpen: false,
      isClientListHidden: false,
      flightTabOrder: [],
      entryQueue: [],
      notifications: [],

      setActiveFlight: (name) =>
        set({
          activeFlightName: name ? name.toUpperCase() : null,
          expandedClientCode: null,
          searchQuery: '',
        }),

      setExpandedClient: (code) =>
        set((state) => ({
          expandedClientCode: state.expandedClientCode === code ? null : code,
        })),

      toggleEditMode: () =>
        set((state) => ({
          isEditMode: !state.isEditMode,
          expandedClientCode: state.isEditMode ? null : state.expandedClientCode,
        })),

      setEditMode: (value) => set({ isEditMode: value }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setFastEntryOpen: (open) => set({ isFastEntryOpen: open }),
      setClientListHidden: (hidden) => set({ isClientListHidden: hidden }),

      syncFlightTabOrder: (apiFlightNames) => {
        const currentOrder = get().flightTabOrder;
        const apiSet = new Set(apiFlightNames);
        const preserved = currentOrder.filter((name) => apiSet.has(name));
        const preservedSet = new Set(preserved);
        const appended = apiFlightNames.filter((name) => !preservedSet.has(name));
        set({ flightTabOrder: [...preserved, ...appended] });
      },

      setFlightTabOrder: (orderedNames) => set({ flightTabOrder: orderedNames }),

      enqueueEntry: (item) => {
        const id = crypto.randomUUID();
        set((state) => ({
          entryQueue: [
            { ...item, id, isContinuation: false, priorCountForClient: 0, notFound: false, isAlreadySent: false, alreadySentFlight: null },
            ...state.entryQueue,
          ],
        }));
      },

      resolveQueueItemClient: (trackCode, clientCode, clientName, clientId, isContinuation, priorCountForClient) =>
        set((state) => ({
          entryQueue: state.entryQueue.map((item) =>
            item.trackCode === trackCode
              ? {
                  ...item,
                  clientCode,
                  resolvedClientName: clientName,
                  resolvedClientId: clientId,
                  isResolved: true,
                  notFound: false,
                  isContinuation,
                  priorCountForClient,
                }
              : item,
          ),
        })),

      markQueueItemNotFound: (trackCode) =>
        set((state) => ({
          entryQueue: state.entryQueue.map((item) =>
            item.trackCode === trackCode
              ? { ...item, notFound: true, isResolved: false, clientCode: '' }
              : item,
          ),
        })),

      markQueueItemAlreadySent: (trackCode, flight) =>
        set((state) => ({
          entryQueue: state.entryQueue.map((item) =>
            item.trackCode === trackCode
              ? { ...item, isAlreadySent: true, isResolved: false, notFound: false, alreadySentFlight: flight }
              : item,
          ),
        })),

      setQueueItemClientCode: (id, clientCode) =>
        set((state) => ({
          entryQueue: state.entryQueue.map((item) =>
            item.id === id ? { ...item, clientCode, notFound: false } : item,
          ),
        })),

      removeFromQueue: (id) =>
        set((state) => ({
          entryQueue: state.entryQueue.filter((item) => item.id !== id),
        })),

      clearQueue: () => set({ entryQueue: [] }),

      addNotification: (notification) => {
        const id = crypto.randomUUID();
        set((state) => ({
          notifications: [
            { ...notification, id, createdAt: new Date().toISOString(), isRead: false },
            ...state.notifications,
          ].slice(0, 100),
        }));
      },

      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        })),

      dismissNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      clearAllNotifications: () => set({ notifications: [] }),
    }),

    {
      name: 'expected-cargo-store',
      storage: createJSONStorage(() => localStorage),
      // isClientListHidden intentionally excluded — ephemeral UI state
      partialize: (state) => ({
        flightTabOrder: state.flightTabOrder,
        entryQueue: state.entryQueue,
        notifications: state.notifications,
      }),
    },
  ),
);
