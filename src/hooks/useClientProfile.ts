import { useState, useCallback, useEffect } from 'react';
import { getClientProfile, getClientFlights, normalizeClientProfile, type ClientProfile } from '@/api/verification';
import axios from 'axios';

interface UseClientProfileReturn {
  profile: ClientProfile | null;
  flights: string[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
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
    if (status === 404) return 'Mijoz topilmadi';
    if (status >= 500) return 'Server xatosi';

    return 'So\'rov bajarilmadi';
  }

  if (err instanceof Error) return err.message;

  return 'Mijoz ma\'lumotlarini yuklashda xatolik';
}

export function useClientProfile(clientId: string | number | null): UseClientProfileReturn {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [flights, setFlights] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!clientId) {
      setProfile(null);
      setFlights([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Backend requires client_id (number) for profile endpoint.
      // API function `getClientProfile` handles this.
      const response = await getClientProfile(clientId);
      // Extract and normalize the client data from response
      if (!response?.client) {
        throw new Error('Mijoz ma\'lumotlari topilmadi');
      }

      const normalizedProfile = normalizeClientProfile(response.client);
      setProfile(normalizedProfile);

      // Guard: only fetch flights if client_code exists
      // Flights endpoint requires client_code, NOT client_id
      if (normalizedProfile.client_code) {
        try {
          // Backend requires include_sheets and include_database params
          const flightsList = await getClientFlights(normalizedProfile.client_code, true, true);
          setFlights(Array.isArray(flightsList) ? flightsList : []);
        } catch {
          // Flights fetch failed, but profile is still valid
          setFlights([]);
        }
      } else {
        setFlights([]);
      }
    } catch (err: unknown) {
      const errorMessage = normalizeError(err);
      setError(errorMessage);
      setProfile(null);
      setFlights([]);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, flights, isLoading, error, refetch: fetchProfile };
}
