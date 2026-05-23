import { useQuery } from '@tanstack/react-query';
import { systemService } from '@/api/services/systemService';

interface MaintenanceWatcherResult {
  isMaintenance: boolean;
  isAdmin: boolean;
  isLoading: boolean;
}

export function useMaintenanceWatcher(): MaintenanceWatcherResult {
  // Background tabs left open overnight previously polled forever; gating the
  // interval on tab visibility removes a multi-hundred-thousand Edge-Request
  // long tail without weakening the in-foreground UX.
  const { data, isLoading, error } = useQuery({
    queryKey: ['maintenance-status'],
    queryFn: systemService.getMaintenanceStatus,
    refetchInterval: () =>
      typeof document !== 'undefined' && document.visibilityState === 'visible'
        ? 60_000
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
