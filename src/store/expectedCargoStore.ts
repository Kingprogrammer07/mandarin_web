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
   * True when this track code belongs to a client that already has entries in the
   * current session queue — signals a "continuation" scan pattern worth flagging.
   */
  isContinuation: boolean;
  /**
   * How many prior queue items share this same clientCode at the time of scan.
   * Stored so the warning toast and tooltip can show the exact count.
   */
  priorCountForClient: number;
}

// ── Notification History ───────────────────────────────────────────────────────

export type NotificationType = 'warning' | 'success' | 'error' | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  /** ISO timestamp of when the notification was created. */
  createdAt: string;
  /** Whether the user has viewed this notification in the panel. */
  isRead: boolean;
  /**
   * Optional payload to navigate to a specific client when the user taps the
   * notification. Both fields must be present together.
   */
  navigateTo?: {
    flightName: string;
    clientCode: string;
  };
}

// ── Store Interface ────────────────────────────────────────────────────────────

interface ExpectedCargoState {
  // ── Navigation & View State ─────────────────────────────────────────────────
  activeFlightName: string | null;
  expandedClientCode: string | null;
  isEditMode: boolean;
  searchQuery: string;
  isFastEntryOpen: boolean;

  // ── Persisted Tab Ordering ──────────────────────────────────────────────────
  flightTabOrder: string[];

  // ── Fast Entry Queue ────────────────────────────────────────────────────────
  /** Persisted to localStorage so a page reload doesn't lose unsubmitted items. */
  entryQueue: FastEntryQueueItem[];

  // ── Notification History ────────────────────────────────────────────────────
  /** Persisted log of in-session notifications. Capped to last 100 entries. */
  notifications: NotificationItem[];

  // ── Actions ─────────────────────────────────────────────────────────────────
  setActiveFlight: (name: string | null) => void;
  setExpandedClient: (code: string | null) => void;
  toggleEditMode: () => void;
  setEditMode: (value: boolean) => void;
  setSearchQuery: (query: string) => void;
  setFastEntryOpen: (open: boolean) => void;

  syncFlightTabOrder: (apiFlightNames: string[]) => void;
  setFlightTabOrder: (orderedNames: string[]) => void;

  enqueueEntry: (item: Omit<FastEntryQueueItem, 'id' | 'isContinuation' | 'priorCountForClient'>) => void;
  resolveQueueItemClient: (
    trackCode: string,
    clientCode: string,
    clientName: string | null,
    clientId: number | null,
    isContinuation: boolean,
    priorCountForClient: number,
  ) => void;
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
      // ── Initial state ─────────────────────────────────────────────────────
      activeFlightName: null,
      expandedClientCode: null,
      isEditMode: false,
      searchQuery: '',
      isFastEntryOpen: false,
      flightTabOrder: [],
      entryQueue: [],
      notifications: [],

      // ── View actions ──────────────────────────────────────────────────────

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

      // ── Tab ordering ──────────────────────────────────────────────────────

      syncFlightTabOrder: (apiFlightNames) => {
        const currentOrder = get().flightTabOrder;
        const apiSet = new Set(apiFlightNames);
        const preserved = currentOrder.filter((name) => apiSet.has(name));
        const preservedSet = new Set(preserved);
        const appended = apiFlightNames.filter((name) => !preservedSet.has(name));
        set({ flightTabOrder: [...preserved, ...appended] });
      },

      setFlightTabOrder: (orderedNames) => set({ flightTabOrder: orderedNames }),

      // ── Queue actions ─────────────────────────────────────────────────────

      enqueueEntry: (item) => {
        const id = crypto.randomUUID();
        set((state) => ({
          entryQueue: [
            ...state.entryQueue,
            { ...item, id, isContinuation: false, priorCountForClient: 0 },
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
                  isContinuation,
                  priorCountForClient,
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

      // ── Notification actions ──────────────────────────────────────────────

      addNotification: (notification) => {
        const id = crypto.randomUUID();
        const newItem: NotificationItem = {
          ...notification,
          id,
          createdAt: new Date().toISOString(),
          isRead: false,
        };
        set((state) => ({
          // Keep most recent 100 notifications
          notifications: [newItem, ...state.notifications].slice(0, 100),
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
      // Persist tab ordering, the unsaved entry queue, and notification history
      partialize: (state) => ({
        flightTabOrder: state.flightTabOrder,
        entryQueue: state.entryQueue,
        notifications: state.notifications,
      }),
    },
  ),
);
