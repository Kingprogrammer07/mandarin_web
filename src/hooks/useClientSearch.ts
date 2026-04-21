import { useState, useCallback, useRef, useEffect } from 'react';
import { apiClient } from '@/api/client';
import type { ClientSearchResult, ClientSearchApiResponse } from '@/api/verification';
import { normalizeSearchResult } from '@/api/verification';
import axios from 'axios';

interface UseClientSearchReturn {
  results: ClientSearchResult[];
  isLoading: boolean;
  error: string | null;
  search: (query: string) => void;
  reset: () => void;
}

const DEBOUNCE_MS = 350;

function normalizeError(err: unknown): string {
  if (axios.isCancel(err)) return '';

  // Interceptor tomonidan qaytarilgan custom xatolik obyekti
  // { message: string, status: number, data: any }
  if (err && typeof err === 'object' && 'status' in err) {
    const errorObj = err as { message: string; status: number };
    if (errorObj.status === 404) return 'Mijoz topilmadi';
    if (errorObj.status === 0) return 'Tarmoq xatosi'; // status: 0 from client.ts
    return errorObj.message || 'Xatolik yuz berdi';
  }

  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Tarmoq xatosi';

    const {status} = err.response;
    if (status === 404) return 'Mijoz topilmadi';

    const {data} = err.response;

    // FastAPI validation error
    if (Array.isArray(data?.detail) && data.detail.length > 0) {
      return String(data.detail[0].msg);
    }

    if (typeof data?.message === 'string') {
      return data.message;
    }

    if (status >= 500) return 'Server xatosi';

    return 'So‘rov bajarilmadi';
  }

  if (err instanceof Error) return err.message;

  return "Noma'lum xatolik";
}

export function useClientSearch(): UseClientSearchReturn {
  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const executeSearch = useCallback(async (query: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<{ client: ClientSearchApiResponse['client'] }>( // API returns { client: ... }
        '/api/v1/verification/search',
        {
          params: { q: query },
          signal: abortControllerRef.current.signal,
        }
      );

      const {data} = response;

      // FIX: Backend returns single client object in wrapper, NOT array
      if (data && data.client) {
        // Backend returns ClientSearchResult directly, but check if we need to normalize additional fields?
        // The API interface says it returns ClientSearchResult structure directly inside 'client'.
        // Let's use the normalize function just to be safe if types mismatch slightly on optional fields.
        // Actually, ClientSearchResult in api/verification.ts is the UI model.
        // And we have normalizeSearchResult which takes ClientSearchApiResponse['client'].
        // Let's cast correct types first.
        const clientData = data.client;
        const normalized = normalizeSearchResult(clientData);
        setResults([normalized]);
      } else {
        setResults([]);
      }
    } catch (err: unknown) {
      if (axios.isCancel(err)) {
        return;
      }

      const errorMessage = normalizeError(err);
      setError(errorMessage);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const search = useCallback((query: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(trimmedQuery);
    }, DEBOUNCE_MS);
  }, [executeSearch]);

  const reset = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setResults([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return { results, isLoading, error, search, reset };
}
