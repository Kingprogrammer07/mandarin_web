import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { buildMergedOrderKeys, clearMergedOrder } from '@/lib/expectedCargoQueueOrder';

// ── Fast Entry Queue ───────────────────────────────────────────────────────────

export interface FastEntryQueueItem {
  /** Locally generated UUID — used as React key and for targeted updates. */
  id: string;
  /** Real scan time. Sent to the server on save, so merge must never rewrite it. */
  scannedAt?: string;
  /**
   * Table position (epoch ms) set when the row's client is merged into one
   * block; rows without it are placed by `scannedAt`.
   */
  orderAt?: number;
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
   * True when the already-sent match is in a DIFFERENT flight (not the one being
   * scanned). Rendered green with an info note instead of an orange error, but
   * still excluded from saving because the track code is globally unique.
   */
  isCrossFlight?: boolean;
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
  /**
   * Durability lifecycle, persisted to IndexedDB (never shown in the UI):
   *   'pending' — scanned, not yet saved to the server.
   *   'saving'  — a save request is in flight; resumable on crash/reload.
   *   'saved'   — confirmed by the server (transient; row is then removed).
   */
  status?: 'pending' | 'saving' | 'saved';
  /** Active flight the item was scanned under. Informational / future per-flight load. */
  flightName?: string | null;
  /**
   * The client's codes that were already SAVED in this flight before this scan
   * (earlier batch). Set only on the client's first row in the queue, so the
   * worker learns the client has more parcels than the table shows.
   */
  savedInFlight?: SavedFlightTrack[];
  /** The saved codes are shown as read-only rows together with the client's rows. */
  isSavedMerged?: boolean;
}

/** A track code already saved to the server for the same client and flight. */
export interface SavedFlightTrack {
  trackCode: string;
  /** Save time (ISO); null when only the offline snapshot knew the code. */
  savedAt: string | null;
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
  /** Flight the notification belongs to; the panel shows only the active flight's. */
  flightName?: string | null;
  navigateTo?: {
    flightName: string;
    clientCode: string;
  };
}

const NOTIFICATIONS_PER_FLIGHT = 100;

/** Upper-cased flight of a notification; older entries only carry it in `navigateTo`. */
export function getNotificationFlight(item: NotificationItem): string | null {
  const flight = (item.flightName ?? item.navigateTo?.flightName ?? '').trim().toUpperCase();
  return flight || null;
}

export function isNotificationForFlight(item: NotificationItem, flightName: string | null): boolean {
  return getNotificationFlight(item) === (flightName?.trim().toUpperCase() || null);
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
  /**
   * Scanner resolve source: 'online' calls the API per scan (default); 'offline'
   * resolves from a downloaded per-flight index (no per-scan network). Persisted.
   */
  scannerMode: 'online' | 'offline';
  /** Merge a client's rows into one block whenever the scanner switches owner. Persisted. */
  isAutoMergeEnabled: boolean;

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
  setScannerMode: (mode: 'online' | 'offline') => void;
  setAutoMergeEnabled: (enabled: boolean) => void;

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
  /**
   * Prepend a batch of fully-built items (ids + durability fields already set)
   * in a single state update. Used by the scanner drain loop to coalesce a burst
   * of scans into one render instead of one per code.
   */
  enqueueRawItems: (items: FastEntryQueueItem[]) => void;
  /** Mark items 'saving' before a save request (durably persisted, resumable). */
  markItemsSaving: (ids: string[]) => void;
  /** Reset items to 'pending' after a failed or aborted save. */
  markItemsPending: (ids: string[]) => void;
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
  markQueueItemAlreadySent: (
    trackCode: string,
    flight: string | null,
    clientCode?: string | null,
    crossFlight?: boolean,
  ) => void;
  /** Move a wrong-client row to its real owner and make it safe to save. */
  acceptQueueItemConflictOwner: (id: string) => void;
  /** Bring all rows for one client next to each other in the scanner table. */
  mergeClientQueueGroup: (clientCode: string) => void;
  /** Undo a merge: put the client's rows back where they were scanned. */
  unmergeClientQueueGroup: (clientCode: string) => void;
  /** Attach the client's earlier-saved codes to a row (ignored if the row changed owner). */
  setQueueItemSavedInFlight: (trackCode: string, clientCode: string, saved: SavedFlightTrack[]) => void;
  /** Show or hide the earlier-saved codes next to the client's rows. */
  setQueueItemSavedMerged: (id: string, merged: boolean) => void;
  toggleQueueItemReviewed: (id: string) => void;
  setQueueItemClientCode: (id: string, clientCode: string) => void;
  removeLatestQueueItem: () => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;

  addNotification: (notification: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'>) => void;
  /** Mark read / clear only the given flight's notifications. */
  markAllNotificationsRead: (flightName: string | null) => void;
  dismissNotification: (id: string) => void;
  clearAllNotifications: (flightName: string | null) => void;
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
      scannerMode: 'online',
      isAutoMergeEnabled: false,
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
      setScannerMode: (mode) => set({ scannerMode: mode }),
      setAutoMergeEnabled: (enabled) => set({ isAutoMergeEnabled: enabled }),

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
              status: 'pending',
              flightName: state.activeFlightName,
            },
            ...state.entryQueue,
          ],
        }));
      },

      enqueueRawItems: (items) =>
        set((state) =>
          items.length === 0
            ? state
            : { entryQueue: [...items, ...state.entryQueue] },
        ),

      markItemsSaving: (ids) =>
        set((state) => {
          const idSet = new Set(ids);
          return {
            entryQueue: state.entryQueue.map((item) =>
              idSet.has(item.id) ? { ...item, status: 'saving' } : item,
            ),
          };
        }),

      markItemsPending: (ids) =>
        set((state) => {
          const idSet = new Set(ids);
          return {
            entryQueue: state.entryQueue.map((item) =>
              idSet.has(item.id) ? { ...item, status: 'pending' } : item,
            ),
          };
        }),

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

      markQueueItemAlreadySent: (trackCode, flight, clientCode, crossFlight = false) =>
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
                  isCrossFlight: crossFlight,
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
          const orderKeys = buildMergedOrderKeys(state.entryQueue, clientCode, Date.now());
          if (orderKeys.size === 0) return state;

          return {
            entryQueue: state.entryQueue.map((item) => {
              const orderAt = orderKeys.get(item.id);
              return orderAt === undefined ? item : { ...item, orderAt };
            }),
          };
        }),

      unmergeClientQueueGroup: (clientCode) =>
        set((state) => {
          const entryQueue = clearMergedOrder(state.entryQueue, clientCode);
          return entryQueue ? { entryQueue } : state;
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

      setQueueItemSavedInFlight: (trackCode, clientCode, saved) =>
        set((state) => ({
          entryQueue: state.entryQueue.map((item) =>
            item.trackCode === trackCode
              && item.clientCode.trim().toUpperCase() === clientCode.trim().toUpperCase()
              ? { ...item, savedInFlight: saved }
              : item,
          ),
        })),

      setQueueItemSavedMerged: (id, merged) =>
        set((state) => ({
          entryQueue: state.entryQueue.map((item) =>
            item.id === id ? { ...item, isSavedMerged: merged } : item,
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
        set((state) => {
          const created: NotificationItem = {
            ...notification,
            id,
            createdAt: new Date().toISOString(),
            isRead: false,
          };
          // Cap per flight, so a busy flight cannot push another flight's history out.
          const perFlight = new Map<string, number>();
          const notifications = [created, ...state.notifications].filter((n) => {
            const key = getNotificationFlight(n) ?? '';
            const count = (perFlight.get(key) ?? 0) + 1;
            perFlight.set(key, count);
            return count <= NOTIFICATIONS_PER_FLIGHT;
          });
          return { notifications };
        });
      },

      markAllNotificationsRead: (flightName) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            isNotificationForFlight(n, flightName) ? { ...n, isRead: true } : n,
          ),
        })),

      dismissNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      clearAllNotifications: (flightName) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => !isNotificationForFlight(n, flightName)),
        })),
    }),

    {
      name: 'expected-cargo-store',
      storage: createJSONStorage(() => localStorage),
      // isClientListHidden intentionally excluded — ephemeral UI state
      partialize: (state) => ({
        activeFlightName: state.activeFlightName,
        flightTabOrder: state.flightTabOrder,
        notifications: state.notifications,
        scannerMode: state.scannerMode,
        isAutoMergeEnabled: state.isAutoMergeEnabled,
      }),
    },
  ),
);
