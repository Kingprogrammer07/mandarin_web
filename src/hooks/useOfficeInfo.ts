import { useQuery } from '@tanstack/react-query';
import { officeService } from '@/api/services/officeService';

/**
 * Office card (address, hours, phones) shared by the address modal, the
 * cash-payment screen and the home card — one fetch, cached for five minutes.
 */
export function useOfficeInfo() {
  return useQuery({
    queryKey: ['office-info'],
    queryFn: officeService.get,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
