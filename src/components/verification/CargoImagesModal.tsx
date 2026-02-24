import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCargoImages, type CargoImageType } from '@/hooks/useCargoImages';
import { ImageIcon, X, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

interface CargoImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: number | null;
  title?: string;
  type?: CargoImageType;
}

export function CargoImagesModal({
  isOpen,
  onClose,
  transactionId,
  type = 'standard',
}: CargoImagesModalProps) {
  const { images, isLoading, error } = useCargoImages(isOpen ? transactionId : null, type);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handlePrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex !== null && selectedIndex < images.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const handleClose = () => {
    setSelectedIndex(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-full h-[90vh] p-0 flex flex-col gap-0 border-0 sm:border rounded-none sm:rounded-lg overflow-hidden bg-black/95">
        <DialogHeader className="bg-white/10 backdrop-blur-md p-4 absolute top-0 w-full z-20 flex flex-row items-center justify-between border-b border-white/10">
          <div className="text-left">
            <DialogTitle className="text-white">Yuk rasmlari</DialogTitle>
            <DialogDescription className="text-white/60 text-xs">
              {images.length} ta rasm
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white/80 hover:text-white hover:bg-white/10"
            onClick={handleClose}
          >
            <X className="h-6 w-6" />
          </Button>
        </DialogHeader>

        <div className="flex-1 relative flex items-center justify-center bg-black min-h-0">
          {isLoading ? (
            <Loader2 className="h-10 w-10 animate-spin text-white/50" />
          ) : error ? (
            <div className="text-center p-4">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
              <p className="text-white">{error}</p>
            </div>
          ) : images.length === 0 ? (
            <div className="text-center p-4">
              <ImageIcon className="h-12 w-12 text-white/20 mx-auto mb-2" />
              <p className="text-white/40">Rasmlar yo'q</p>
            </div>
          ) : selectedIndex === null ? (
            <div className="w-full h-full overflow-y-auto p-4 pt-20 grid grid-cols-3 gap-1 content-start">
              {images.map((image, index) => (
                <button
                  key={image.file_id}
                  onClick={() => setSelectedIndex(index)}
                  className="aspect-square relative overflow-hidden bg-white/5 hover:opacity-80 transition-opacity"
                >
                  {image.telegram_url ? (
                    <img
                      src={image.telegram_url}
                      alt={`Rasm ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-white/20" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              {images[selectedIndex].telegram_url ? (
                <img
                  src={images[selectedIndex].telegram_url}
                  alt={`Rasm ${selectedIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-white/50">Rasm yo'q</div>
              )}

              {/* Navigation Overlays */}
              <button
                onClick={(e) => { e.stopPropagation(); handlePrev() }}
                disabled={selectedIndex === 0}
                className="absolute left-0 top-0 bottom-0 w-1/4 flex items-center justify-start pl-4 hover:bg-white/5 transition-colors disabled:opacity-0"
              >
                <div className="p-2 rounded-full bg-black/50 text-white backdrop-blur-sm">
                  <ChevronLeft className="h-6 w-6" />
                </div>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); handleNext() }}
                disabled={selectedIndex === images.length - 1}
                className="absolute right-0 top-0 bottom-0 w-1/4 flex items-center justify-end pr-4 hover:bg-white/5 transition-colors disabled:opacity-0"
              >
                <div className="p-2 rounded-full bg-black/50 text-white backdrop-blur-sm">
                  <ChevronRight className="h-6 w-6" />
                </div>
              </button>

              <Button
                variant="secondary"
                size="sm"
                className="absolute bottom-6 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/10"
                onClick={() => setSelectedIndex(null)}
              >
                Galereyaga qaytish
              </Button>

              <div className="absolute top-20 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-white text-xs">
                {selectedIndex + 1} / {images.length}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
