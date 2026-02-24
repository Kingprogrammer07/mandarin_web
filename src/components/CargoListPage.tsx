import { useState, useEffect, useCallback, useMemo } from 'react';
import { getFlightPhotos, deleteCargo, getCargoImageMetadata, exportFlightCargoExcel, uploadPhoto, type CargoPhoto } from '@/api/services/cargo';
import { getFlightByName, type Flight } from '@/api/services/flight';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Plus, Package, Trash2, Edit2, Eye, Search, X,
  ChevronLeft, ChevronRight, CheckCircle, Clock, SlidersHorizontal,
  ArrowUpDown, ImageIcon, Download
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import EditCargoModal from '@/components/EditCargoModal';
import { useTranslation } from 'react-i18next';
import { offlineStorage, type FailedItem } from '@/utils/offlineStorage';
import OfflineCargoManager from '@/components/OfflineCargoManager';

// ==================== Custom Hook: useDebounce ====================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ==================== Types ====================

type FilterStatus = 'all' | 'sent' | 'pending';
type SortOrder = 'newest' | 'oldest';

// ==================== PhotoViewerModal ====================

interface PhotoViewerModalProps {
  photo: CargoPhoto;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  formatDate: (date: string) => string;
}

function PhotoViewerModal({ photo, onClose, onEdit, onDelete, isDeleting, formatDate }: PhotoViewerModalProps) {
  const { t } = useTranslation();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [imageUrls, setImageUrls] = useState<(string | null)[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);

  // Fetch image URLs ONLY when modal opens
  useEffect(() => {
    const fetchImageUrls = async () => {
      try {
        setIsLoadingImages(true);
        const metadata = await getCargoImageMetadata(photo.id);
        const urls = metadata.photos
          .sort((a, b) => a.index - b.index)
          .map(p => p.telegram_url);
        setImageUrls(urls);
      } catch (error) {
        console.error('Failed to fetch image metadata:', error);
        setImageUrls([]);
      } finally {
        setIsLoadingImages(false);
      }
    };

    fetchImageUrls();
  }, [photo.id]);

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const totalPhotos = photo.photo_file_ids.length;
  const canNavigate = totalPhotos > 1;
  const currentImageUrl = imageUrls[currentPhotoIndex];

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % totalPhotos);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + totalPhotos) % totalPhotos);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 z-50 animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 text-orange-700 font-bold px-3 py-1 rounded-lg text-sm">
                {photo.client_id}
              </div>
              {photo.is_sent ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  {t('cargo.statusSent')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" />
                  {t('cargo.statusPending')}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Photo Carousel */}
          <div className="relative bg-gray-100 h-80 flex items-center justify-center group">
            {isLoadingImages ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-sm text-gray-500">{t('cargo.loading')}</p>
              </div>
            ) : currentImageUrl ? (
              <img
                key={currentPhotoIndex}
                src={currentImageUrl}
                alt={`${t('cargo.photo')} ${photo.client_id} - ${currentPhotoIndex + 1}/${totalPhotos}`}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                }}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <Package className="w-16 h-16" />
                <p className="text-sm">{t('cargo.noPhotos')}</p>
              </div>
            )}

            {/* Photo counter badge */}
            {totalPhotos > 1 && (
              <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
                {currentPhotoIndex + 1} / {totalPhotos}
              </div>
            )}

            {/* Navigation arrows */}
            {canNavigate && (
              <>
                <button
                  onClick={prevPhoto}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2.5 rounded-full backdrop-blur-sm transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={nextPhoto}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2.5 rounded-full backdrop-blur-sm transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Info & Actions */}
          <div className="p-6 space-y-4">
            {/* Weight / Price row */}
            <div className="flex items-center gap-4">
              {photo.weight_kg && (
                <span className="text-gray-700 font-semibold">{photo.weight_kg} kg</span>
              )}
              {photo.price_per_kg && (
                <span className="text-orange-600 font-semibold">${photo.price_per_kg}/kg</span>
              )}
            </div>

            {photo.comment && (
              <p className="text-sm text-gray-600">{photo.comment}</p>
            )}

            <div className="text-xs text-gray-400">
              {formatDate(photo.created_at)}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={onEdit}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                {t('cargo.editTitle')}
              </Button>
              <Button
                onClick={onDelete}
                disabled={isDeleting}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ==================== PhotoCard (Lightweight — NO API calls) ====================

interface PhotoCardProps {
  photo: CargoPhoto;
  onView: () => void;
  onDelete: () => void;
  onEdit: () => void;
  isDeleting: boolean;
  formatDate: (date: string) => string;
}

function PhotoCard({ photo, onView, onDelete, onEdit, isDeleting, formatDate }: PhotoCardProps) {
  const { t } = useTranslation();
  const totalPhotos = photo.photo_file_ids.length;

  return (
    <div
      className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 cursor-pointer group"
      onClick={onView}
    >
      {/* Top section: Placeholder + status badge */}
      <div className="relative h-40 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 flex flex-col items-center justify-center gap-2">
        <div className="w-14 h-14 rounded-2xl bg-white/80 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
          <ImageIcon className="w-7 h-7 text-gray-400" />
        </div>
        <div className="flex items-center gap-1.5 text-gray-500">
          <Eye className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{totalPhotos} {t('cargo.photos')}</span>
        </div>

        {/* Status badge - top left */}
        <div className="absolute top-3 left-3">
          {photo.is_sent ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full shadow-sm">
              <CheckCircle className="w-3.5 h-3.5" />
              {t('cargo.statusSent')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full shadow-sm">
              <Clock className="w-3.5 h-3.5" />
              {t('cargo.statusPending')}
            </span>
          )}
        </div>

        {/* Action buttons - top right */}
        <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="bg-white/90 hover:bg-blue-500 text-gray-600 hover:text-white p-1.5 rounded-lg shadow-sm transition-all"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            disabled={isDeleting}
            className="bg-white/90 hover:bg-red-500 text-gray-600 hover:text-white p-1.5 rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {isDeleting ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Bottom section: Info */}
      <div className="p-4 space-y-2.5">
        {/* Client ID + Weight row */}
        <div className="flex items-center justify-between">
          <span className="bg-orange-100 text-orange-700 font-bold px-3 py-1 rounded-lg text-sm">
            {photo.client_id}
          </span>
          <div className="flex items-center gap-2 text-sm">
            {photo.weight_kg && (
              <span className="text-gray-600 font-semibold">{photo.weight_kg} kg</span>
            )}
            {photo.price_per_kg && (
              <span className="text-orange-600 font-semibold">${photo.price_per_kg}/kg</span>
            )}
          </div>
        </div>

        {/* Comment */}
        {photo.comment && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
            {photo.comment}
          </p>
        )}

        {/* Date */}
        <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
          {formatDate(photo.created_at)}
        </div>
      </div>
    </div>
  );
}

// ==================== CargoListPage ==

interface CargoListPageProps {
  flightName: string;
  onBack: () => void;
  onAddCargo: () => void;
}

export default function CargoListPage({ flightName, onBack, onAddCargo }: CargoListPageProps) {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<CargoPhoto[]>([]);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [uniqueClients, setUniqueClients] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingCargo, setEditingCargo] = useState<CargoPhoto | null>(null);

  const [showOfflineManager, setShowOfflineManager] = useState(false);

  // Offline recovery
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);

  // Excel export
  const [isExporting, setIsExporting] = useState(false);

  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Filters & Sort
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  // Viewing photo modal
  const [viewingPhoto, setViewingPhoto] = useState<CargoPhoto | null>(null);

  const { toast, ToastRenderer } = useToast();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [flightData, photosData] = await Promise.all([
        getFlightByName(flightName),
        getFlightPhotos(flightName)
      ]);
      setFlight(flightData);
      setPhotos(photosData.photos);
      setTotalPhotos(photosData.total);
      setUniqueClients(photosData.unique_clients);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: `❌ ${t('cargo.messages.uploadError')}`,
        description: t('cargo.loading'),
        variant: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  }, [flightName, toast, t]);


  useEffect(() => {
    loadData();

    // Check for offline items
    const checkOfflineItems = async () => {
      try {
        const items = await offlineStorage.getAllItems(flightName);
        setFailedItems(items);
      } catch (err) {
        console.error("Failed to load offline items", err);
      }
    };
    checkOfflineItems();
  }, [flightName, loadData]); // Added flightName dependency

  const handleRetryAll = async () => {
    if (isRetrying || failedItems.length === 0) return;
    setIsRetrying(true);

    let successCount = 0;
    const remainingItems: FailedItem[] = [];

    // Process sequentially to be safe, or parallel with limit?
    // Sequential is safer for order and rate limits
    for (const item of failedItems) {
      try {
        await uploadPhoto(
          item.flightName,
          item.clientId,
          item.photos,
          item.weightKg,
          item.pricePerKg,
          item.comment
        );
        successCount++;
        await offlineStorage.deleteItem(item.id);
      } catch (error) {
        console.error(`Retry failed for ${item.clientId}`, error);
        remainingItems.push(item);
      }
    }

    setFailedItems(remainingItems);
    setIsRetrying(false);

    if (successCount > 0) {
      toast({
        title: `✅ ${successCount} ta yuk qayta yuklandi`,
        description: "",
        variant: 'success'
      });
      // Refresh the main list
      loadData();
    }

    if (remainingItems.length > 0) {
      toast({
        title: `⚠️ ${remainingItems.length} ta yuk yuklanmadi`,
        description: "Internetni tekshirib qayta urinib ko'ring",
        variant: 'warning'
      });
    }
  };

  // Filtered + sorted photos
  const filteredPhotos = useMemo(() => {
    return photos
      .filter(item => {
        // Search (case insensitive)
        const matchesSearch = !debouncedSearchTerm.trim()
          || item.client_id.toLowerCase().includes(debouncedSearchTerm.trim().toLowerCase());
        // Status filter
        const matchesStatus = filterStatus === 'all'
          ? true
          : filterStatus === 'sent' ? item.is_sent : !item.is_sent;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
      });
  }, [photos, debouncedSearchTerm, filterStatus, sortOrder]);

  const handleDelete = async (cargoId: string) => {
    const confirmed = window.Telegram?.WebApp?.showConfirm
      ? await new Promise<boolean>((resolve) => {
        window.Telegram!.WebApp!.showConfirm(
          t('cargo.messages.deleteConfirm'),
          (result) => resolve(result)
        );
      })
      : window.confirm(t('cargo.messages.deleteConfirm'));

    if (!confirmed) return;

    try {
      setDeletingId(cargoId);
      await deleteCargo(cargoId);

      setPhotos(photos.filter(p => p.id !== cargoId));
      setTotalPhotos(prev => prev - 1);

      if (viewingPhoto?.id === cargoId) {
        setViewingPhoto(null);
      }

      toast({
        title: `✅ ${t('cargo.messages.deleteSuccess')}`,
        description: '',
        variant: 'success'
      });
    } catch (error: unknown) {
      console.error('Failed to delete cargo:', error);
      toast({
        title: `❌ ${t('cargo.messages.deleteError')}`,
        description:
          (typeof error === 'object' && error !== null && 'message' in (error as object) && (error as { message?: string }).message) ||
          t('cargo.messages.deleteError'),

        variant: 'error'
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditSuccess = (updatedCargo: CargoPhoto) => {
    setPhotos(photos.map(p => p.id === updatedCargo.id ? updatedCargo : p));
    if (viewingPhoto?.id === updatedCargo.id) {
      setViewingPhoto(updatedCargo);
    }
  };

  // Excel export handler
  const handleExportExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      await exportFlightCargoExcel(flightName);
      toast({
        title: `✅ ${t('cargo.excelExport.success')}`,
        description: '',
        variant: 'success'
      });
    } catch (err: unknown) {
      let errorMessage = t('cargo.excelExport.error');

      const message = typeof err === 'object' && err !== null && 'message' in (err as object) ? (err as { message?: string }).message : undefined;
      const status = typeof err === 'object' && err !== null && 'status' in (err as object) ? (err as { status?: number }).status : undefined;

      if (message === 'rate_limit' || status === 429) {
        errorMessage = t('cargo.excelExport.rateLimit');
      } else if (message === 'no_data' || status === 404) {
        errorMessage = t('cargo.excelExport.noData');
      } else if (message === 'network_error' || status === 0) {
        errorMessage = t('cargo.excelExport.networkError');
      } else if (message && message !== 'Export failed') {
        errorMessage = message;

      }

      toast({
        title: `❌ ${t('cargo.excelExport.error')}`,
        description: errorMessage,
        variant: 'error'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('uz-UZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Active filter count (for badge)
  const activeFilterCount = (filterStatus !== 'all' ? 1 : 0) + (sortOrder !== 'newest' ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0 || debouncedSearchTerm.trim().length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <ToastRenderer />

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="mb-6">

          {/* OFFLINE WARNING BANNER */}
          {failedItems.length > 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-2">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="bg-amber-100 p-2 rounded-full flex-shrink-0">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">Saqlanmagan yuklar mavjud</h3>
                  <p className="text-xs text-amber-700 leading-tight">
                    {failedItems.length} ta yuk internet yo'qligi sababli oflayn rejimda saqlandi.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  onClick={() => setShowOfflineManager(true)}
                  size="sm"
                  variant="outline"
                  className="flex-1 sm:flex-initial bg-white border-amber-300 text-amber-700 hover:bg-amber-50 text-xs justify-center"
                >
                  <SlidersHorizontal className="w-3 h-3 mr-2" />
                  Boshqarish
                </Button>
                <Button
                  onClick={handleRetryAll}
                  disabled={isRetrying}
                  size="sm"
                  className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-sm text-xs justify-center"
                >
                  {isRetrying ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Yuklanmoqda...</span>
                    </div>
                  ) : (
                    "Barchasini yuborish"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Offline Manager Modal */}
          {showOfflineManager && (
            <OfflineCargoManager
              flightName={flightName}
              onClose={() => setShowOfflineManager(false)}
              onRefreshHost={async () => {
                try {
                  const items = await offlineStorage.getAllItems(flightName);
                  setFailedItems(items);
                  loadData();
                } catch (e) {
                  console.error(e);
                }
              }}
            />
          )}

          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-500 hover:text-orange-600 transition-colors mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">{t('cargo.backToFlights')}</span>
          </button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 mb-1">
                {flight?.name} — {t('cargo.cargoList')}
              </h1>
              <p className="text-sm text-gray-500">
                {t('cargo.total')}: {totalPhotos} {t('cargo.itemsCount')} &middot; {uniqueClients} {t('cargo.clients')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-emerald-500/20 disabled:opacity-60"
              >
                {isExporting ? (
                  <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-5 h-5 mr-2" />
                )}
                {isExporting ? t('cargo.excelExport.downloading') : t('cargo.excelExport.button')}
              </Button>
              <Button
                onClick={onAddCargo}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold shadow-sm"
              >
                <Plus className="w-5 h-5 mr-2" />
                {t('cargo.addCargo')}
              </Button>
            </div>
          </div>
        </div>

        {/* Search + Filters Toolbar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('cargo.searchPlaceholder')}
              className="w-full pl-12 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all placeholder:text-gray-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter & Sort Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter (Segmented Control) */}
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-gray-400 hidden sm:block" />
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterStatus === 'all'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  {t('cargo.statusAll')}
                </button>
                <button
                  onClick={() => setFilterStatus('sent')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${filterStatus === 'sent'
                    ? 'bg-white text-green-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <CheckCircle className="w-3 h-3" />
                  {t('cargo.statusSent')}
                </button>
                <button
                  onClick={() => setFilterStatus('pending')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${filterStatus === 'pending'
                    ? 'bg-white text-amber-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <Clock className="w-3 h-3" />
                  {t('cargo.statusPending')}
                </button>
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 ml-auto">
              <ArrowUpDown className="w-4 h-4 text-gray-400 hidden sm:block" />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="bg-gray-100 border-none rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                <option value="newest">{t('cargo.sortNewest')}</option>
                <option value="oldest">{t('cargo.sortOldest')}</option>
              </select>
            </div>
          </div>

          {/* Results count */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-gray-500">
                {t('cargo.itemsFound', { count: filteredPhotos.length })}
              </p>
              {(filterStatus !== 'all' || searchTerm) && (
                <button
                  onClick={() => { setSearchTerm(''); setFilterStatus('all'); }}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium transition-colors"
                >
                  {t('cargo.statusAll')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Cargo Grid */}
        {photos.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-5">
              <Package className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-gray-500 text-lg mb-2 font-medium">{t('cargo.noPhotos')}</p>
            <p className="text-gray-400 text-sm mb-6">{t('cargo.addFirstPhoto')}</p>
            <Button
              onClick={onAddCargo}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-sm"
            >
              <Plus className="w-5 h-5 mr-2" />
              {t('cargo.addCargo')}
            </Button>
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-5">
              <Search className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-gray-500 text-lg font-medium">{t('cargo.noResults')}</p>
            <p className="text-gray-400 text-sm mt-1">{t('cargo.searchPlaceholder')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPhotos.map((photo) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                onView={() => setViewingPhoto(photo)}
                onDelete={() => handleDelete(photo.id)}
                onEdit={() => setEditingCargo(photo)}
                isDeleting={deletingId === photo.id}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Photo Viewer Modal (on-demand image loading) */}
      {viewingPhoto && (
        <PhotoViewerModal
          photo={viewingPhoto}
          onClose={() => setViewingPhoto(null)}
          onEdit={() => {
            setEditingCargo(viewingPhoto);
            setViewingPhoto(null);
          }}
          onDelete={() => handleDelete(viewingPhoto.id)}
          isDeleting={deletingId === viewingPhoto.id}
          formatDate={formatDate}
        />
      )}

      {/* Edit Modal */}
      {editingCargo && (
        <EditCargoModal
          cargo={editingCargo}
          onClose={() => setEditingCargo(null)}
          onSuccess={handleEditSuccess}
        />
      )}


    </>
  );
}
