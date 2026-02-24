import { useState, useCallback, useEffect } from 'react';
import { getCargoImages, getCargoImagesUnpaid, type CargoImage } from '@/api/verification';

export type CargoImageType = 'standard' | 'unpaid';

interface UseCargoImagesReturn {
  images: CargoImage[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCargoImages(transactionId: number | null, type: CargoImageType = 'standard'): UseCargoImagesReturn {
  const [images, setImages] = useState<CargoImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchImages = useCallback(async () => {
    if (!transactionId) {
      setImages([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await (type === 'unpaid'
        ? getCargoImagesUnpaid(transactionId)
        : getCargoImages(transactionId));
      setImages(response.images);
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Rasmlarni yuklashda xatolik';
      setError(errorMessage);
      setImages([]);
    } finally {
      setIsLoading(false);
    }
  }, [transactionId, type]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  return { images, isLoading, error, refetch: fetchImages };
}
