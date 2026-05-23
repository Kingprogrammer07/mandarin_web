import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/config';
import { useMaintenanceStore } from '@/store/useMaintenanceStore';

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

function buildStreamUrl(): string | null {
  const base = API_BASE_URL.replace(/\/$/, '');
  const adminToken = localStorage.getItem('access_token');
  if (adminToken) {
    return `${base}/api/v1/events/stream?access_token=${encodeURIComponent(adminToken)}`;
  }
  const userToken = sessionStorage.getItem('access_token');
  if (userToken) {
    return `${base}/api/v1/events/stream?token=${encodeURIComponent(userToken)}`;
  }
  return null;
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
      break;

    case 'pos_notification.changed':
      qc.invalidateQueries({ queryKey: ['pos-notifications'], refetchType: 'active' });
      qc.invalidateQueries({ queryKey: ['pos-tab-counts'], refetchType: 'active' });
      qc.invalidateQueries({ queryKey: ['cashier-log'], refetchType: 'active' });
      break;

    case 'maintenance.toggled': {
      const value = evt.value === true;
      // Drive the maintenance overlay directly; also refresh the admin
      // settings page query if mounted.
      const store = useMaintenanceStore.getState();
      if (value) {
        store.triggerMaintenance();
      } else {
        store.clearMaintenance();
      }
      qc.invalidateQueries({ queryKey: ['maintenance-status'], refetchType: 'active' });
      qc.invalidateQueries({ queryKey: ['system-maintenance'], refetchType: 'active' });
      break;
    }

    case 'nbu.status.changed':
      qc.invalidateQueries({ queryKey: ['system-nbu'], refetchType: 'active' });
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
