import { useState, useEffect, useCallback, useRef } from 'react';
import type { TouchEvent } from 'react';
import { getCargoImageMetadata, type CargoPhoto } from '@/api/services/cargo';
import { Button } from '@/components/ui/button';
import { Package, Trash2, Edit2, X, ChevronLeft, ChevronRight, CheckCircle, Clock, ImageIcon } from 'lucide-react';

const SWIPE_MIN_DISTANCE = 58;
const SWIPE_MAX_VERTICAL_DRIFT = 90;

interface ImageLightboxProps {
  imageUrls: (string | null)[];
  initialIndex: number;
  clientId: string;
  onClose: () => void;
}

function ImageLightbox({ imageUrls, initialIndex, clientId, onClose }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const totalImages = imageUrls.length;
  const canNavigate = totalImages > 1;
  const currentImageUrl = imageUrls[currentIndex];

  const goPrevious = useCallback(() => {
    if (!canNavigate) return;
    setCurrentIndex((index) => (index - 1 + totalImages) % totalImages);
  }, [canNavigate, totalImages]);

  const goNext = useCallback(() => {
    if (!canNavigate) return;
    setCurrentIndex((index) => (index + 1) % totalImages);
  }, [canNavigate, totalImages]);

  useEffect(() => {
    setCurrentIndex(Math.min(initialIndex, Math.max(totalImages - 1, 0)));
  }, [initialIndex, totalImages]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrevious();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrevious, onClose]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches.item(0);
    if (!touch) return;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches.item(0);
    const startX = touchStartX.current;
    const startY = touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (!touch || startX === null || startY === null || !canNavigate) return;

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE || Math.abs(deltaY) > SWIPE_MAX_VERTICAL_DRIFT) return;

    if (deltaX > 0) goPrevious();
    else goNext();
  };

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose} />
      <div
        className="fixed inset-0 z-[71] flex items-center justify-center p-3 sm:p-6 pointer-events-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="absolute left-3 right-3 top-3 sm:left-5 sm:right-5 sm:top-5 z-10 flex items-center justify-between gap-3 pointer-events-auto">
          <div className="min-w-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
            {clientId} - {currentIndex + 1}/{Math.max(totalImages, 1)}
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 active:scale-95"
            aria-label="Rasmni yopish"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="relative flex h-full w-full max-w-6xl items-center justify-center pointer-events-auto"
          onClick={onClose}
        >
          {currentImageUrl ? (
            <img
              src={currentImageUrl}
              alt={`${clientId} rasmi ${currentIndex + 1}`}
              className="max-h-[88vh] max-w-full rounded-xl object-contain shadow-2xl shadow-black/60"
              draggable={false}
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <div
              className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-8 py-10 text-white/70"
              onClick={(event) => event.stopPropagation()}
            >
              <ImageIcon className="h-12 w-12" />
              <p className="text-sm font-semibold">Rasm ochilmadi</p>
            </div>
          )}

          {canNavigate && (
            <>
              <button
                onClick={(event) => { event.stopPropagation(); goPrevious(); }}
                className="absolute left-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition-colors hover:bg-white/20 active:scale-95 sm:flex"
                aria-label="Oldingi rasm"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={(event) => { event.stopPropagation(); goNext(); }}
                className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition-colors hover:bg-white/20 active:scale-95 sm:flex"
                aria-label="Keyingi rasm"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────
// PhotoViewerModal
// ─────────────────────────────────────────
interface PhotoViewerModalProps {
  photo: CargoPhoto;
  onClose: () => void;
  /** Left out: the edit button is not shown. */
  onEdit?: () => void;
  /** Left out: the delete button is not shown. */
  onDelete?: () => void;
  isDeleting: boolean;
  formatDate: (date: string) => string;
  canNavigateReports: boolean;
  reportPositionLabel: string;
  onPreviousReport: () => void;
  onNextReport: () => void;
}

export default function PhotoViewerModal({
  photo,
  onClose,
  onEdit,
  onDelete,
  isDeleting,
  formatDate,
  canNavigateReports,
  reportPositionLabel,
  onPreviousReport,
  onNextReport,
}: PhotoViewerModalProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [imageUrls, setImageUrls] = useState<(string | null)[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    let isActive = true;
    const fetchImageUrls = async () => {
      try {
        setIsLoadingImages(true);
        setImageUrls([]);
        setCurrentPhotoIndex(0);
        setLightboxIndex(null);
        const metadata = await getCargoImageMetadata(photo.id);
        const urls = metadata.photos.sort((a, b) => a.index - b.index).map(p => p.telegram_url);
        if (!isActive) return;
        setImageUrls(urls);
      } catch {
        if (!isActive) return;
        setImageUrls([]);
      } finally {
        if (isActive) setIsLoadingImages(false);
      }
    };
    fetchImageUrls();
    return () => { isActive = false; };
  }, [photo.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (lightboxIndex !== null) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft' && canNavigateReports) {
        event.preventDefault();
        onPreviousReport();
      }
      if (event.key === 'ArrowRight' && canNavigateReports) {
        event.preventDefault();
        onNextReport();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canNavigateReports, lightboxIndex, onClose, onNextReport, onPreviousReport]);

  const totalPhotos = photo.photo_file_ids.length;
  const canNavigate = totalPhotos > 1;
  const currentImageUrl = imageUrls[currentPhotoIndex];

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches.item(0);
    if (!touch) return;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches.item(0);
    const startX = touchStartX.current;
    const startY = touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (!touch || startX === null || startY === null || !canNavigateReports || lightboxIndex !== null) return;

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE || Math.abs(deltaY) > SWIPE_MAX_VERTICAL_DRIFT) return;

    if (deltaX > 0) onPreviousReport();
    else onNextReport();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in duration-200" onClick={onClose} />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pointer-events-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {canNavigateReports && (
          <>
            <button
              onClick={onPreviousReport}
              className="pointer-events-auto absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-3 text-gray-800 shadow-xl shadow-black/20 transition-all hover:bg-white active:scale-95 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 md:flex"
              aria-label="Oldingi yuk"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={onNextReport}
              className="pointer-events-auto absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-3 text-gray-800 shadow-xl shadow-black/20 transition-all hover:bg-white active:scale-95 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 md:flex"
              aria-label="Keyingi yuk"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
        <div
          className="relative bg-white dark:bg-[#0d0a04] rounded-3xl shadow-2xl shadow-black/40 max-w-lg w-full max-h-[92vh] overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-200 border border-orange-100/80 dark:border-orange-500/15"
          onClick={e => e.stopPropagation()}
        >
          {/* accent bar */}
          <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-orange-500 to-transparent z-10" />

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-6 pb-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black px-3 py-1 rounded-xl text-sm tracking-wide shadow-sm shadow-orange-500/30">
                {photo.client_id}
              </span>
              {canNavigateReports && (
                <span className="hidden rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-500 dark:bg-white/5 dark:text-gray-400 sm:inline-flex">
                  {reportPositionLabel}
                </span>
              )}
              {photo.is_sent ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-400/10 px-2.5 py-1 rounded-full border border-green-200/60 dark:border-green-400/20">
                  <CheckCircle className="w-3 h-3" />Yuborilgan
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-200/60 dark:border-amber-400/20">
                  <Clock className="w-3 h-3" />Kutilmoqda
                </span>
              )}
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Photo */}
          <div className="relative bg-gray-50 dark:bg-black/40 mx-4 rounded-2xl overflow-hidden h-64 flex items-center justify-center">
            {isLoadingImages ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-[3px] border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-xs text-gray-400">Yuklanmoqda...</p>
              </div>
            ) : currentImageUrl ? (
              <button
                type="button"
                onClick={() => setLightboxIndex(currentPhotoIndex)}
                className="flex h-full w-full cursor-zoom-in items-center justify-center"
                aria-label="Rasmni katta ko'rish"
              >
                <img key={currentPhotoIndex} src={currentImageUrl} alt={`Photo ${currentPhotoIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                  draggable={false}
                  onError={e => { e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjwvc3ZnPg=='; }} />
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-300 dark:text-gray-600">
                <Package className="w-12 h-12" /><p className="text-xs">Rasm yo'q</p>
              </div>
            )}
            {totalPhotos > 1 && (
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {currentPhotoIndex + 1}/{totalPhotos}
              </div>
            )}
            {canNavigate && (
              <>
                <button onClick={(event) => { event.stopPropagation(); setCurrentPhotoIndex(p => (p - 1 + totalPhotos) % totalPhotos); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-xl backdrop-blur-sm transition-all active:scale-90">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={(event) => { event.stopPropagation(); setCurrentPhotoIndex(p => (p + 1) % totalPhotos); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-xl backdrop-blur-sm transition-all active:scale-90">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Info */}
          <div className="p-5 space-y-3">
            {(photo.weight_kg || photo.price_per_kg) && (
              <div className="flex items-center gap-2.5">
                {photo.weight_kg && (
                  <div className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">Vazn</p>
                    <p className="text-base font-black text-gray-800 dark:text-gray-100">{photo.weight_kg} kg</p>
                  </div>
                )}
                {photo.price_per_kg && (
                  <div className="flex-1 bg-orange-50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/15 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-orange-400 uppercase tracking-widest font-semibold mb-0.5">Narx/kg</p>
                    <p className="text-base font-black text-orange-600 dark:text-orange-400">${photo.price_per_kg}/kg</p>
                  </div>
                )}
              </div>
            )}
            {photo.comment && (
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-white/5 rounded-xl px-3 py-2.5 border border-gray-100 dark:border-white/5">
                {photo.comment}
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(photo.created_at)}</p>
            {(onEdit || onDelete) && (
              <div className="flex gap-2.5 pt-1">
                {onEdit && (
                  <Button onClick={onEdit}
                    className="flex-1 h-11 bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 active:scale-[0.98] text-white font-bold rounded-xl shadow-md shadow-orange-500/30 border-0 transition-all">
                    <Edit2 className="w-4 h-4 mr-2" />Tahrirlash
                  </Button>
                )}
                {onDelete && (
                  <Button onClick={onDelete} disabled={isDeleting} variant="outline"
                    className="h-11 px-4 rounded-xl border-red-200 dark:border-red-500/20 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all active:scale-95">
                    {isDeleting
                      ? <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {lightboxIndex !== null && (
        <ImageLightbox
          imageUrls={imageUrls}
          initialIndex={lightboxIndex}
          clientId={photo.client_id}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}

