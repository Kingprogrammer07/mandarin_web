import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ── Fast Entry Queue ───────────────────────────────────────────────────────────

export interface FastEntryQueueItem {
  /** Locally generated UUID — used as React key and for targeted updates. */
  id: string;
  scannedAt?: string;
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
  /** Client code from the already-sent 409 response, if backend provides it. */
  alreadySentClientCode: string | null;
  /** Flight name from the 409 response body — which flight already has this code. */
  alreadySentFlight: string | null;
  /**
   * True for a temporary warning row when scanning switches away after a 2+ item
   * run from another client. Cleared automatically if the new client continues.
   */
  isContinuation: boolean;
  /** Length of the previous different-client run that triggered the warning. */
  priorCountForClient: number;
  /**
   * True when the track code was found in DB but belongs to a different client
   * than the one the admin explicitly entered (client-first entry mode).
   */
  isWrongClient: boolean;
  /** The actual owning client code when isWrongClient is true. */
  conflictClientCode: string | null;
  /** Local admin checklist state; helps operators mark rows as manually reviewed. */
  isReviewed?: boolean;
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
  selectedQueueItemIds: string[];
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
  replaceEntryQueue: (items: FastEntryQueueItem[]) => void;
  toggleQueueItemSelected: (id: string) => void;
  setQueueItemsSelected: (ids: string[], selected: boolean) => void;
  clearQueueSelection: () => void;
  bulkSetSelectedClientCode: (clientCode: string) => number;

  enqueueEntry: (
    item: Omit<FastEntryQueueItem, 'id' | 'isContinuation' | 'priorCountForClient' | 'notFound' | 'isAlreadySent' | 'alreadySentClientCode' | 'alreadySentFlight' | 'isWrongClient' | 'conflictClientCode'> &
      Partial<Pick<FastEntryQueueItem, 'isWrongClient' | 'conflictClientCode' | 'isAlreadySent' | 'alreadySentClientCode' | 'alreadySentFlight' | 'notFound'>>,
  ) => void;
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
  markQueueItemAlreadySent: (trackCode: string, flight: string | null, clientCode?: string | null) => void;
  /** Move a wrong-client row to its real owner and make it safe to save. */
  acceptQueueItemConflictOwner: (id: string) => void;
  /** Bring all rows for one client next to each other in the scanner table. */
  mergeClientQueueGroup: (clientCode: string) => void;
  toggleQueueItemReviewed: (id: string) => void;
  setQueueItemClientCode: (id: string, clientCode: string) => void;
  removeLatestQueueItem: () => void;
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
      selectedQueueItemIds: [],
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

      replaceEntryQueue: (items) =>
        set((state) => {
          const itemIds = new Set(items.map((item) => item.id));
          return {
            entryQueue: items,
            selectedQueueItemIds: state.selectedQueueItemIds.filter((id) => itemIds.has(id)),
          };
        }),

      toggleQueueItemSelected: (id) =>
        set((state) => ({
          selectedQueueItemIds: state.selectedQueueItemIds.includes(id)
            ? state.selectedQueueItemIds.filter((selectedId) => selectedId !== id)
            : [...state.selectedQueueItemIds, id],
        })),

      setQueueItemsSelected: (ids, selected) =>
        set((state) => {
          const next = new Set(state.selectedQueueItemIds);
          for (const id of ids) {
            if (selected) next.add(id);
            else next.delete(id);
          }
          return { selectedQueueItemIds: Array.from(next) };
        }),

      clearQueueSelection: () => set({ selectedQueueItemIds: [] }),

      bulkSetSelectedClientCode: (clientCode) => {
        const normalized = clientCode.trim().toUpperCase();
        if (!normalized) return 0;

        let updatedCount = 0;
        set((state) => {
          const selectedIds = new Set(state.selectedQueueItemIds);
          return {
            entryQueue: state.entryQueue.map((item) => {
              if (!selectedIds.has(item.id) || item.isAlreadySent) return item;
              updatedCount += 1;
              return {
                ...item,
                clientCode: normalized,
                notFound: false,
                isWrongClient: false,
                conflictClientCode: null,
              };
            }),
            selectedQueueItemIds: [],
          };
        });
        return updatedCount;
      },

      enqueueEntry: (item) => {
        const id = crypto.randomUUID();
        set((state) => ({
          entryQueue: [
            {
              ...item,
              id,
              scannedAt: new Date().toISOString(),
              isContinuation: false,
              priorCountForClient: 0,
              notFound: item.notFound ?? false,
              isAlreadySent: item.isAlreadySent ?? false,
              alreadySentClientCode: item.alreadySentClientCode ?? null,
              alreadySentFlight: item.alreadySentFlight ?? null,
              isWrongClient: item.isWrongClient ?? false,
              conflictClientCode: item.conflictClientCode ?? null,
              isReviewed: false,
            },
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
        : item.isContinuation
          ? {
              ...item,
              isContinuation: false,
              priorCountForClient: 0,
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

      markQueueItemAlreadySent: (trackCode, flight, clientCode) =>
        set((state) => ({
          entryQueue: state.entryQueue.map((item) =>
            item.trackCode === trackCode
              ? {
                  ...item,
                  clientCode: clientCode?.trim().toUpperCase() || item.clientCode,
                  isAlreadySent: true,
                  isResolved: false,
                  notFound: false,
                  alreadySentClientCode: clientCode?.trim().toUpperCase() || null,
                  alreadySentFlight: flight,
                }
              : item,
          ),
        })),

      acceptQueueItemConflictOwner: (id) =>
        set((state) => ({
          entryQueue: state.entryQueue.map((item) =>
            item.id === id && item.conflictClientCode
              ? {
                  ...item,
                  clientCode: item.conflictClientCode,
                  isResolved: true,
                  notFound: false,
                  isWrongClient: false,
                  conflictClientCode: null,
                }
              : item,
          ),
        })),

      mergeClientQueueGroup: (clientCode) =>
        set((state) => {
          const normalized = clientCode.trim().toUpperCase();
          if (!normalized) return state;

          const baseTime = Date.now();
          const matchingItems = state.entryQueue
            .filter((item) => item.clientCode.trim().toUpperCase() === normalized)
            .sort((a, b) => {
              const bTime = b.scannedAt ? Date.parse(b.scannedAt) : 0;
              const aTime = a.scannedAt ? Date.parse(a.scannedAt) : 0;
              return bTime - aTime;
            });

          const nextScannedAtById = new Map(
            matchingItems.map((item, index) => [
              item.id,
              new Date(baseTime - index).toISOString(),
            ]),
          );

          return {
            entryQueue: state.entryQueue.map((item) => {
              const scannedAt = nextScannedAtById.get(item.id);
              return scannedAt ? { ...item, scannedAt } : item;
            }),
          };
        }),

      setQueueItemClientCode: (id, clientCode) =>
        set((state) => ({
          entryQueue: state.entryQueue.map((item) =>
            item.id === id
              ? {
                  ...item,
                  clientCode: clientCode.trim().toUpperCase(),
                  notFound: false,
                  isWrongClient: false,
                  conflictClientCode: null,
                }
              : item,
          ),
        })),

      toggleQueueItemReviewed: (id) =>
        set((state) => ({
          entryQueue: state.entryQueue.map((item) =>
            item.id === id ? { ...item, isReviewed: !item.isReviewed } : item,
          ),
        })),

      removeLatestQueueItem: () =>
        set((state) => {
          const latest = state.entryQueue
            .filter((item) => !item.isReviewed)
            .sort((a, b) => {
              const bTime = b.scannedAt ? Date.parse(b.scannedAt) : 0;
              const aTime = a.scannedAt ? Date.parse(a.scannedAt) : 0;
              return bTime - aTime;
            })[0];

          if (!latest) return state;
          return {
            entryQueue: state.entryQueue.filter((item) => item.id !== latest.id),
          };
        }),

      removeFromQueue: (id) =>
        set((state) => ({
          entryQueue: state.entryQueue.filter((item) => item.id !== id),
          selectedQueueItemIds: state.selectedQueueItemIds.filter((selectedId) => selectedId !== id),
        })),

      clearQueue: () => set({ entryQueue: [], selectedQueueItemIds: [] }),

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
        activeFlightName: state.activeFlightName,
        flightTabOrder: state.flightTabOrder,
        notifications: state.notifications,
      }),
    },
  ),
);
