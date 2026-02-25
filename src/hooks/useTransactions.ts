import { useState, useCallback, useEffect, useRef } from 'react';
import { getTransactions, type Transaction, type TransactionFilters, type FilterType, type SortOrder } from '@/api/transactions';
import axios from 'axios';

interface UseTransactionsReturn {
  transactions: Transaction[];
  totalCount: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  filters: TransactionFilters;
  flightFilter: string | null;
  filterType: FilterType;
  sortOrder: SortOrder;
  setFlightFilter: (flight: string | undefined | null) => void;
  setFilterType: (type: FilterType) => void;
  setSortOrder: (order: SortOrder) => void;
  setFlightCode: (code: string | undefined) => void;
  loadMore: () => void;
  refetch: () => Promise<void>;
}

const LIMIT = 20;

/** Defensive filter: exclude legacy WALLET_ADJ rows if backend accidentally sends them */
function isRealTransaction(t: Transaction): boolean {
  return !t.reys?.startsWith('WALLET_ADJ');
}

function normalizeError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Tarmoq xatosi';

    const data = err.response.data;

    if (Array.isArray(data?.detail) && data.detail.length > 0) {
      return String(data.detail[0].msg);
    }

    if (typeof data?.message === 'string') {
      return data.message;
    }

    const status = err.response.status;
    if (status === 404) return 'Tranzaksiyalar topilmadi';
    if (status >= 500) return 'Server xatosi';

    return 'So\'rov bajarilmadi';
  }

  if (err instanceof Error) return err.message;

  return 'Tranzaksiyalarni yuklashda xatolik';
}

export function useTransactions(clientCode: string | null): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState<Omit<TransactionFilters, 'offset'>>({
    clientCode: clientCode || '',
    filterType: 'all',
    sortOrder: 'desc',
    limit: LIMIT,
  });

  const offsetRef = useRef(0);

  const fetchTransactions = useCallback(async (resetList = true) => {
    if (!filters.clientCode) return;

    setIsLoading(true);
    setError(null);

    try {
      const currentOffset = resetList ? 0 : offsetRef.current;
      const response = await getTransactions({
        ...filters,
        offset: currentOffset,
      });

      // FIX: Ensure response.transactions is used, default to []
      // Defensive: filter out legacy WALLET_ADJ rows
      const transactionsList = (response.transactions || []).filter(isRealTransaction);

      if (resetList) {
        setTransactions(transactionsList);
      } else {
        setTransactions((prev) => [...prev, ...transactionsList]);
      }
      setTotalCount(response.total_count ?? 0);
      setTotalPages(response.total_pages);

      // Calculate hasMore based on current page vs total pages
      const currentPage = Math.floor(currentOffset / LIMIT) + 1;
      setHasMore(currentPage < response.total_pages);

      offsetRef.current = currentOffset + transactionsList.length;
    } catch (err: unknown) {
      const errorMessage = normalizeError(err);
      setError(errorMessage);
      if (resetList) setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (clientCode) {
      offsetRef.current = 0;
      setFilters((prev) => ({ ...prev, clientCode: clientCode }));
    }
  }, [clientCode]);

  useEffect(() => {
    if (filters.clientCode) {
      offsetRef.current = 0;
      fetchTransactions(true);
    }
  }, [filters.clientCode, filters.filterType, filters.sortOrder, filters.flightCode, fetchTransactions]);

  const setFilterType = useCallback((type: FilterType) => {
    offsetRef.current = 0;
    setFilters((prev) => ({ ...prev, filterType: type }));
  }, []);

  const setSortOrder = useCallback((order: SortOrder) => {
    offsetRef.current = 0;
    setFilters((prev) => ({ ...prev, sortOrder: order }));
  }, []);

  const setFlightCode = useCallback((code: string | undefined | null) => {
    offsetRef.current = 0;
    setFilters((prev) => ({ ...prev, flightCode: code ?? undefined }));
  }, []);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchTransactions(false);
    }
  }, [isLoading, hasMore, fetchTransactions]);

  const refetch = useCallback(async () => {
    offsetRef.current = 0;
    await fetchTransactions(true);
  }, [fetchTransactions]);

  return {
    filters,
    transactions,
    totalCount,
    totalPages,
    isLoading,
    error,
    hasMore,
    flightFilter: filters.flightCode || null,
    setFlightFilter: setFlightCode,
    filterType: filters.filterType || 'all',
    sortOrder: filters.sortOrder || 'desc',
    setFilterType,
    setSortOrder,
    setFlightCode,
    loadMore,
    refetch,
  };
}
