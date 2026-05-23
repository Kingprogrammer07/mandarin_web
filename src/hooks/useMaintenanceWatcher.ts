import { useQuery } from '@tanstack/react-query';
import { systemService } from '@/api/services/systemService';

interface MaintenanceWatcherResult {
  isMaintenance: boolean;
  isAdmin: boolean;
  isLoading: boolean;
}

export function useMaintenanceWatcher(): MaintenanceWatcherResult {
  // Maintenance flips are pushed in real time via the `maintenance.toggled`
  // SSE event (see useGlobalEvents), so this query is now just a safety-net
  // fallback: a slow, visibility-gated poll that catches a missed event or
  // an SSE outage without generating continuous traffic.
  const { data, isLoading, error } = useQuery({
    queryKey: ['maintenance-status'],
    queryFn: systemService.getMaintenanceStatus,
    refetchInterval: () =>
      typeof document !== 'undefined' && document.visibilityState === 'visible'
        ? 5 * 60_000
        : false,
    refetchIntervalInBackground: false,
    retry: false,
  });

  if (error) {
    return { isMaintenance: false, isAdmin: false, isLoading: false };
  }

  return {
    isMaintenance: data?.maintenance === true,
    isAdmin: data?.is_admin === true,
    isLoading,
  };
}
