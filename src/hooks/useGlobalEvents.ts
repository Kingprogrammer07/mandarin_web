import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/config';
import { isAdminTokenExpired } from '@/lib/adminTokenClock';
import { credentialForPath } from '@/lib/session';
import {
  applyCourierLocation,
  courierDeliveryKey,
  type CourierDelivery,
  type CourierLocationEvent,
} from '@/api/services/courierService';

/**
 * Single app-wide SSE connection that replaces per-resource HTTP polling.
 *
 * The backend pushes semantic domain events (wallet.changed, queue.changed,
 * maintenance.toggled, …) over `/api/v1/events/stream`; this hook maps each
 * event to the React Query keys that need invalidating, so the relevant
 * screens refresh instantly instead of waiting for a poll interval.
 *
 * Auth rides on the query string because EventSource cannot set headers:
 * - admin/worker → `?access_token=<admin JWT>` (localStorage)
 * - client user  → `?token=<session token>`    (sessionStorage)
 *
 * Reconnect is capped + visibility-gated to avoid the infinite-loop and
 * background-tab problems that plagued the old polling hooks.
 */
const MAX_RECONNECT_ATTEMPTS = 10;

type AppEvent = { type: string; [key: string]: unknown };

/**
 * Clear a dead admin session once, and say so.
 *
 * Deliberately NOT called from `buildStreamUrl`. This hook listens for
 * `auth:logout` itself and reconnects on it, so raising the event from inside
 * the URL builder recursed — dispatch is synchronous, the listener called
 * `connect()`, which called the builder again, which dispatched again. Removing
 * the token first is what makes it terminate: the expired branch cannot be
 * taken twice.
 */
function discardExpiredAdminSession(): void {
  const token = localStorage.getItem('access_token');
  if (!token || !isAdminTokenExpired(token)) return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('admin_role');
  // Scoped: this only ever discards the ADMIN session, and an unscoped event
  // would take the client's session down with it.
  window.dispatchEvent(new CustomEvent('auth:logout', { detail: { scope: 'admin' } }));
}

/** Pure — no side effects, so it is safe to call from the reconnect path. */
function buildStreamUrl(): string | null {
  const base = API_BASE_URL.replace(/\/$/, '');
  const adminToken = localStorage.getItem('access_token');
  const userToken = sessionStorage.getItem('access_token');
  // The page picks the stream, as it picks every request's credential: a staff
  // member in the client app gets the client's events (wallet, notifications).
  const credential = credentialForPath(window.location.pathname, { adminToken, userToken });
  if (credential === 'admin' && adminToken) {
    // An expired token would be refused with a 401 that `EventSource` reports
    // as an unreadable connection failure (Firefox even calls it CORS), so it
    // is not worth opening: it only bought ten silent reconnects while the real
    // cause, log in again, stayed invisible. Expiry is read on the server's
    // clock — see lib/adminTokenClock.
    if (isAdminTokenExpired(adminToken)) return null;
    return `${base}/api/v1/events/stream?access_token=${encodeURIComponent(adminToken)}`;
  }
  if (credential === 'client' && userToken) {
    return `${base}/api/v1/events/stream?token=${encodeURIComponent(userToken)}`;
  }
  return null;
}

/**
 * The admin landing dashboard aggregates counts that several of these events
 * already invalidate elsewhere. Refreshing it from the same signals keeps it
 * live without adding a polling timer to the most-opened admin screen.
 */
function refreshAdminDashboard(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: ['admin-dashboard'], refetchType: 'active' });
}

function dispatchEvent(evt: AppEvent, qc: QueryClient): void {
  switch (evt.type) {
    case 'wallet.changed':
      qc.invalidateQueries({ queryKey: ['walletBalance'], refetchType: 'active' });
      break;

    case 'notification.created':
      qc.invalidateQueries({ queryKey: ['notifications'], refetchType: 'active' });
      break;

    case 'queue.changed':
      qc.invalidateQueries({ queryKey: ['pickup_queue'], refetchType: 'active' });
      qc.invalidateQueries({ queryKey: ['pos_pickup_queue'], refetchType: 'active' });
      refreshAdminDashboard(qc);
      break;

    case 'pos_notification.changed':
      qc.invalidateQueries({ queryKey: ['pos-notifications'], refetchType: 'active' });
      qc.invalidateQueries({ queryKey: ['pos-tab-counts'], refetchType: 'active' });
      qc.invalidateQueries({ queryKey: ['cashier-log'], refetchType: 'active' });
      refreshAdminDashboard(qc);
      break;

    case 'maintenance.toggled': {
      // Admin-toggled maintenance is a SEPARATE mechanism from the server-down
      // detector. It is driven entirely by the `maintenance-status` query
      // (see useMaintenanceWatcher → MaintenanceOverlay / admin banner), which
      // we refetch here so every client reacts in real time.
      //
      // We deliberately do NOT touch `useMaintenanceStore`: that store is
      // exclusively the transient "backend unreachable" signal set by the axios
      // interceptor (client.ts) and rendered as the full-screen MaintenancePage
      // ("Texnik ishlar ketmoqda"). Flipping it here made that server-down page
      // wrongly cover the app whenever an admin merely enabled maintenance.
      qc.invalidateQueries({ queryKey: ['maintenance-status'], refetchType: 'active' });
      qc.invalidateQueries({ queryKey: ['system-maintenance'], refetchType: 'active' });
      refreshAdminDashboard(qc);
      break;
    }

    case 'nbu.status.changed':
      qc.invalidateQueries({ queryKey: ['system-nbu'], refetchType: 'active' });
      refreshAdminDashboard(qc);
      break;

    // Published by the backend since the WebApp-only switch shipped
    // (routers/system.py), but nothing listened — the bot-mode chip would have
    // stayed stale until a manual refresh.
    case 'bot.mode.changed':
      refreshAdminDashboard(qc);
      break;

    // The courier's position while driving to this client: patched into the
    // open tracking map in place — a fix arrives every few seconds and a
    // refetch for each would only repeat what the event already says.
    case 'courier.location': {
      const fix = evt as unknown as CourierLocationEvent;
      if (typeof fix.public_id !== 'string') break;
      qc.setQueryData<CourierDelivery>(courierDeliveryKey(fix.public_id), (old) =>
        applyCourierLocation(old, fix),
      );
      break;
    }

    // Set off, delivered, moved to another day: the status, the times and the
    // queue position all change, so the delivery is read again.
    case 'courier.stop':
      qc.invalidateQueries({ queryKey: ['courier-delivery'], refetchType: 'active' });
      break;

    default:
      // Unknown event type — ignore so new backend events don't break old clients.
      break;
  }
}

export function useGlobalEvents(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let es: EventSource | null = null;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      const url = buildStreamUrl();
      if (!url) return; // not authenticated yet

      es = new EventSource(url);

      es.onopen = () => {
        attempt = 0;
      };

      es.onmessage = (e) => {
        if (e.data.startsWith(':')) return; // keep-alive
        let evt: AppEvent;
        try {
          evt = JSON.parse(e.data);
        } catch {
          return;
        }
        dispatchEvent(evt, queryClient);
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (closed) return;
        if (attempt >= MAX_RECONNECT_ATTEMPTS) return;
        // Don't burn reconnect attempts while hidden — the visibility
        // listener restarts the connection when the tab returns.
        if (document.visibilityState !== 'visible') return;
        const delay = Math.min(1000 * 2 ** attempt, 30_000);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !es && !closed) {
        attempt = 0;
        connect();
      }
    };

    // Reconnect with fresh credentials after login/logout.
    const handleAuthChange = () => {
      es?.close();
      es = null;
      attempt = 0;
      connect();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('auth:logout', handleAuthChange);

    // Before the first connection, not inside the URL builder. A stale admin
    // token left in storage cannot be recovered from, and this is the one place
    // that can say so exactly once.
    discardExpiredAdminSession();
    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
      es = null;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('auth:logout', handleAuthChange);
    };
  }, [queryClient]);
}
