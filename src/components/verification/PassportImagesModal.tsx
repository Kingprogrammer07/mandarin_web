import { useState, useEffect, useCallback } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ImageIcon, ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { getPassportImagesMetadata, type PassportImageMetadata } from '@/api/services/client';

interface PassportImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number | null;
}

export function PassportImagesModal({
  isOpen,
  onClose,
  clientId,
}: PassportImagesModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [images, setImages] = useState<PassportImageMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch passport images metadata when modal opens

  const fetchPassportImages = useCallback(async () => {

    if (!clientId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getPassportImagesMetadata(clientId, true);
      setImages(response.images);
      setSelectedIndex(0);
    } catch (err: unknown) {
      console.error('Failed to fetch passport images:', err);
      const message =
        (typeof err === 'object' && err !== null && 'message' in (err as object) && (err as { message?: string }).message) ||
        'Pasport rasmlarini yuklashda xatolik yuz berdi';
      setError(message);

      setImages([]);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (isOpen && clientId) {
      fetchPassportImages();
    }
  }, [isOpen, clientId, fetchPassportImages]);


  const handlePrev = () => {
    if (selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex < images.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const handleClose = () => {
    setSelectedIndex(0);
    setImages([]);
    setError(null);
    onClose();
  };

  const getImageLabel = (index: number) => {
    if (index === 0) return 'Old tomoni';
    if (index === 1) return 'Orqa tomoni';
    return `Rasm ${index + 1}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pasport rasmlari</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="h-12 w-12 text-orange-500 animate-spin mb-4" />
            <p className="text-muted-foreground">Yuklanmoqda...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-red-700 mb-4">{error}</p>
            <Button onClick={fetchPassportImages} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Qayta urinish
            </Button>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Pasport rasmlari mavjud emas</p>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center justify-center">
              {images.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 z-10"
                  onClick={handlePrev}
                  disabled={selectedIndex === 0}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              )}

              <div className="relative max-h-[60vh] flex flex-col items-center justify-center">
                {images[selectedIndex]?.telegram_url ? (
                  <img
                    src={images[selectedIndex].telegram_url!}
                    alt={getImageLabel(selectedIndex)}
                    className="max-h-[55vh] max-w-full object-contain rounded-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div
                  className={cn(
                    'w-64 h-64 flex flex-col items-center justify-center bg-muted rounded-lg',
                    images[selectedIndex]?.telegram_url ? 'hidden' : ''
                  )}
                >
                  <ImageIcon className="h-16 w-16 text-muted-foreground mb-2" />
                  {images[selectedIndex]?.error && (
                    <p className="text-sm text-red-500 px-4 text-center">
                      {images[selectedIndex].error}
                    </p>
                  )}
                </div>
                <p className="mt-4 text-center font-medium">{getImageLabel(selectedIndex)}</p>
                {images[selectedIndex]?.is_regenerated && (
                  <p className="text-xs text-orange-600 mt-1">
                    (Qayta yaratilgan)
                  </p>
                )}
              </div>

              {images.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 z-10"
                  onClick={handleNext}
                  disabled={selectedIndex === images.length - 1}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedIndex(index)}
                    className={cn(
                      'w-2 h-2 rounded-full transition-colors',
                      index === selectedIndex ? 'bg-orange-500' : 'bg-gray-300'
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
