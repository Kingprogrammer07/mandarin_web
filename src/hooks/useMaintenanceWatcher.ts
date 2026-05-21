import { useQuery } from '@tanstack/react-query';
import { systemService } from '@/api/services/systemService';

interface MaintenanceWatcherResult {
  isMaintenance: boolean;
  isAdmin: boolean;
  isLoading: boolean;
}

export function useMaintenanceWatcher(): MaintenanceWatcherResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['maintenance-status'],
    queryFn: systemService.getMaintenanceStatus,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
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
