import { useState, useCallback, useEffect, useRef } from 'react';
import { getUnpaidCargo, getUnpaidCargoFlights, type UnpaidCargoItem, type UnpaidCargoApiResponse } from '@/api/verification';
import axios from 'axios';

interface UseUnpaidCargoReturn {
  cargos: UnpaidCargoItem[];
  flights: string[];
  totalCount: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  flightFilter: string | null;
  setFlightFilter: (flight: string | null) => void;
  loadMore: () => void;
  refetch: () => Promise<void>;
}

const LIMIT = 20;

function normalizeError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Tarmoq xatosi';

    const {data} = err.response;

    if (Array.isArray(data?.detail) && data.detail.length > 0) {
      return String(data.detail[0].msg);
    }

    if (typeof data?.message === 'string') {
      return data.message;
    }

    const {status} = err.response;
    if (status === 404) return 'To\'lanmagan yuklar topilmadi';
    if (status >= 500) return 'Server xatosi';

    return 'So\'rov bajarilmadi';
  }

  if (err instanceof Error) return err.message;

  return 'To\'lanmagan yuklarni yuklashda xatolik';
}

export function useUnpaidCargo(clientCode: string | null): UseUnpaidCargoReturn {
  const [cargos, setCargos] = useState<UnpaidCargoItem[]>([]);
  const [flights, setFlights] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const [flightFilter, setFlightFilterState] = useState<string | null>(null);

  const fetchUnpaidCargo = useCallback(async (resetList = true) => {
    if (!clientCode) return;

    setIsLoading(true);
    setError(null);

    try {
      const currentOffset = resetList ? 0 : offsetRef.current;

      // Backend requires ALL filter params
      const response: UnpaidCargoApiResponse = await getUnpaidCargo({
        clientCode,
        filterType: 'pending',  // REQUIRED
        sortOrder: 'desc',  // REQUIRED
        limit: LIMIT,  // REQUIRED
        offset: currentOffset,  // REQUIRED
        flightCode: flightFilter || undefined,  // Optional
      });

      // Guard: items defaulting to []
      const itemsList = response.items || [];

      if (resetList) {
        setCargos(itemsList);
      } else {
        setCargos((prev) => [...prev, ...itemsList]);
      }

      setTotalCount(response.total_count);
      setTotalPages(response.total_pages);

      const currentPage = Math.floor(currentOffset / LIMIT) + 1;
      setHasMore(currentPage < response.total_pages);

      offsetRef.current = currentOffset + itemsList.length;
    } catch (err: unknown) {
      const errorMessage = normalizeError(err);
      setError(errorMessage);
      if (resetList) setCargos([]);
    } finally {
      setIsLoading(false);
    }
  }, [clientCode, flightFilter]);

  // Use dedicated endpoint for unpaid cargo flights
  const fetchFlights = useCallback(async () => {
    if (!clientCode) return;

    try {
      const flightsList = await getUnpaidCargoFlights(clientCode);
      setFlights(flightsList || []);
    } catch {
      // Flights fetch failed, but unpaid cargo is still valid
      setFlights([]);
    }
  }, [clientCode]);

  useEffect(() => {
    if (clientCode) {
      fetchFlights();
      fetchUnpaidCargo(true);
    }
  }, [clientCode, fetchFlights, fetchUnpaidCargo]);

  useEffect(() => {
    if (clientCode) {
      offsetRef.current = 0;
      fetchUnpaidCargo(true);
    }
  }, [flightFilter, clientCode, fetchUnpaidCargo]);

  const setFlightFilter = useCallback((flight: string | null) => {
    setFlightFilterState(flight);
  }, []);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchUnpaidCargo(false);
    }
  }, [isLoading, hasMore, fetchUnpaidCargo]);

  const refetch = useCallback(async () => {
    offsetRef.current = 0;
    await fetchUnpaidCargo(true);
  }, [fetchUnpaidCargo]);

  return {
    cargos,
    flights,
    totalCount,
    totalPages,
    isLoading,
    error,
    hasMore,
    flightFilter,
    setFlightFilter,
    loadMore,
    refetch,
  };
}
