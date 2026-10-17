import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getFlightPhotos, deleteCargo, exportFlightCargoExcel, uploadPhoto, type CargoPhoto } from '@/api/services/cargo';
import { getFlightByName, type Flight } from '@/api/services/flight';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Plus, Package, Trash2, Edit2, Search, X,
  ChevronLeft, ChevronRight, Clock, SlidersHorizontal,
  ArrowUpDown, ImageIcon, Download, RefreshCw, AlertTriangle, Lock, LogOut, Send, Scale
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';
import EditCargoModal from '@/components/EditCargoModal';
import CargoComparisonModal from '@/components/CargoComparisonModal';
import WeightComparisonModal from '@/components/WeightComparisonModal';
import { offlineStorage, type FailedItem } from '@/utils/offlineStorage';
import OfflineCargoManager from '@/components/OfflineCargoManager';
import PhotoViewerModal from '@/components/cargo/PhotoViewerModal';
import { getAdminJwtClaims } from '@/api/services/adminManagement';
import { refreshAdminToken } from '@/api/services/adminAuth';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

type FilterStatus = 'all' | 'sent' | 'pending';
type SortOrder = 'newest' | 'oldest';

// ─────────────────────────────────────────
// PhotoCard
// ─────────────────────────────────────────
interface PhotoCardProps {
  photo: CargoPhoto;
  onView: () => void;
  onDelete: () => void;
  onEdit: () => void;
  isDeleting: boolean;
  formatDate: (date: string) => string;
  canEdit: boolean;
  canDelete: boolean;
}

function PhotoCard({ photo, onView, onDelete, onEdit, isDeleting, formatDate, canEdit, canDelete }: PhotoCardProps) {
  const totalPhotos = photo.photo_file_ids.length;

  return (
    <div
      className="bg-white dark:bg-[#0d0a04] rounded-2xl border border-orange-100/60 dark:border-orange-500/10 shadow-sm cursor-pointer hover:border-orange-300/70 dark:hover:border-orange-500/25 hover:shadow-md transition-all overflow-hidden"
      onClick={onView}
    >
      {/* Top accent line */}
      <div className={`h-[2px] ${photo.is_sent ? 'bg-gradient-to-r from-transparent via-green-400/50 dark:via-green-500/30 to-transparent' : 'bg-gradient-to-r from-transparent via-amber-400/50 dark:via-amber-500/30 to-transparent'}`} />

      {/* Row 1: client ID + status + actions */}
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${photo.is_sent ? 'bg-green-500' : 'bg-amber-400'}`} />
        <span className="text-[15px] font-black text-gray-900 dark:text-white font-mono flex-1 min-w-0 truncate tracking-wide">
          {photo.client_id}
        </span>
        {photo.is_sent ? (
          <span className="text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border border-green-200/60 dark:border-green-500/15 px-2 py-0.5 rounded-full shrink-0">
            Yuborilgan
          </span>
        ) : (
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/15 px-2 py-0.5 rounded-full shrink-0">
            Kutilmoqda
          </span>
        )}
      </div>

      {/* Row 2: weight, price, photo count */}
      <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
        {photo.weight_kg ? (
          <span className="text-[12px] font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/[0.06] border border-gray-200/60 dark:border-white/[0.08] px-2.5 py-1 rounded-lg">
            {photo.weight_kg} kg
          </span>
        ) : (
          <span className="text-[12px] text-gray-300 dark:text-gray-600 px-2.5 py-1">—</span>
        )}
        {photo.price_per_kg && (
          <span className="text-[12px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border border-orange-200/60 dark:border-orange-500/20 px-2.5 py-1 rounded-lg">
            ${photo.price_per_kg}/kg
          </span>
        )}
        <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500 flex items-center gap-1.5 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05] px-2.5 py-1 rounded-lg">
          <ImageIcon className="w-3 h-3" />{totalPhotos}
        </span>
        {photo.comment && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500 italic truncate max-w-[120px]">
            {photo.comment}
          </span>
        )}
        <span className="ml-auto text-[10px] text-gray-300 dark:text-gray-600 flex items-center gap-1 shrink-0">
          <Clock className="w-2.5 h-2.5" />{formatDate(photo.created_at)}
        </span>
      </div>

      {/* Divider + action row — only shown when user has at least one action */}
      {(canEdit || canDelete) && (
        <div className="border-t border-gray-50 dark:border-white/[0.04] flex">
          {canEdit && (
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold text-gray-400 dark:text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-500/[0.05] transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Tahrirlash
            </button>
          )}
          {canEdit && canDelete && <div className="w-px bg-gray-50 dark:bg-white/[0.04]" />}
          {canDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              disabled={isDeleting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-500/[0.05] disabled:opacity-50 transition-colors"
            >
              {isDeleting
                ? <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                : <Trash2 className="w-3.5 h-3.5" />}
              {isDeleting ? "O'chirilmoqda" : "O'chirish"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// StatPill
// ─────────────────────────────────────────
const PILL_COLOR: Record<string, string> = {
  gray:  'text-gray-600  dark:text-gray-400  bg-gray-100  dark:bg-white/[0.06]  border-gray-200/60  dark:border-white/[0.08]',
  green: 'text-green-700 dark:text-green-400 bg-green-50  dark:bg-green-500/10  border-green-200/60 dark:border-green-500/15',
  amber: 'text-amber-700 dark:text-amber-400 bg-amber-50  dark:bg-amber-500/10  border-amber-200/60 dark:border-amber-500/15',
  blue:  'text-blue-700  dark:text-blue-400  bg-blue-50   dark:bg-blue-500/10   border-blue-200/60  dark:border-blue-500/15',
};

function StatPill({ label, color }: { label: string; color: keyof typeof PILL_COLOR }) {
  return (
    <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full border ${PILL_COLOR[color]}`}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────
// AccessDenied
// ─────────────────────────────────────────
function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
        <Lock className="w-8 h-8 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[16px] font-bold text-gray-700 dark:text-gray-300">Ruxsat yo'q</p>
        <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
          Sizda ushbu sahifani ko'rish yoki tahrirlash uchun huquq yo'q.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// CargoListPage
// ─────────────────────────────────────────
interface CargoListPageProps {
  flightName: string;
  onBack: () => void;
  onAddCargo: () => void;
  onNavigateToNotifications?: () => void;
  onLogout?: () => void;
}

export default function CargoListPage({ flightName, onBack, onAddCargo, onNavigateToNotifications, onLogout }: CargoListPageProps) {
  const [jwtClaims, setJwtClaims] = useState(() => getAdminJwtClaims());
  const hasPerm = (slug: string) => jwtClaims.isSuperAdmin || jwtClaims.permissions.has(slug);
  const canView   = hasPerm('flights:read');
  const canCreate = hasPerm('flights:create');
  const canUpdate = hasPerm('flights:update');
  const canDelete = hasPerm('flights:delete');
  const canCompareCargo = hasPerm('expected_cargo:manage');
  const [photos, setPhotos] = useState<CargoPhoto[]>([]);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Separate flag for search/page re-fetches — avoids tearing down the DOM
  // (and losing keyboard focus) every time the user types in the search box.
  const [isFetching, setIsFetching] = useState(false);
  const isFirstLoad = useRef(true);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [uniqueClients, setUniqueClients] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingCargo, setEditingCargo] = useState<CargoPhoto | null>(null);
  const [showOfflineManager, setShowOfflineManager] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [viewingPhoto, setViewingPhoto] = useState<CargoPhoto | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [statisitcs, setStatistics] = useState({sent_count: 0, unsent_count: 0});

  const { toast, ToastRenderer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const handleComparisonError = useCallback((message: string) => {
    toast({ title: 'Solishtirishda xatolik', description: message, variant: 'error' });
  }, [toast]);

  const handleComparisonSuccess = useCallback((message: string) => {
    toast({ title: 'Muvaffaqiyatli', description: message, variant: 'success' });
  }, [toast]);

  // Silently refresh the admin token on mount so permissions reflect
  // the latest role assignments without requiring a re-login.
  useEffect(() => {
    let cancelled = false;
    refreshAdminToken()
      .then((data) => {
        if (cancelled) return;
        localStorage.setItem('access_token', data.access_token);
        setJwtClaims(getAdminJwtClaims());
      })
      .catch(() => { /* ignore — keep existing token */ });
    return () => { cancelled = true; };
  }, []);

  const loadData = useCallback(async () => {
    // First load: full-screen spinner. Subsequent fetches (search/pagination):
    // only a subtle indicator so the DOM stays mounted and focus is preserved.
    if (isFirstLoad.current) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }
    // Map UI filter to server-side is_sent param
    const isSentParam = filterStatus === 'all' ? undefined : filterStatus === 'sent';
    try {
      const [flightData, photosData] = await Promise.all([
        getFlightByName(flightName),
        getFlightPhotos(flightName, currentPage, 50, debouncedSearchTerm || undefined, isSentParam),
      ]);
      setStatistics({sent_count: photosData.sent_count, unsent_count: photosData.unsent_count});
      setFlight(flightData);
      setPhotos(photosData.photos);
      setTotalPhotos(photosData.total);
      setUniqueClients(photosData.unique_clients);
      setTotalPages(photosData.total_pages ?? 1);

    } catch {
      toast({ title: "❌ Ma'lumotlarni yuklashda xatolik", description: 'Qayta urinib ko\'ring', variant: 'error' });
    } finally {
      setIsLoading(false);
      setIsFetching(false);
      isFirstLoad.current = false;
    }
  }, [flightName, currentPage, debouncedSearchTerm, filterStatus, toast]);

  // Reset to first page when search query or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterStatus]);

  useEffect(() => {
    loadData();
    const check = async () => {
      try { setFailedItems(await offlineStorage.getAllItems(flightName)); } catch { /* silent */ }
    };
    check();
  }, [flightName, loadData]);

  const handleRetryAll = async () => {
    if (isRetrying || failedItems.length === 0) return;
    setIsRetrying(true);
    let successCount = 0;
    const remainingItems: FailedItem[] = [];
    for (const item of failedItems) {
      try {
        await uploadPhoto(item.flightName, item.clientId, item.photos, item.weightKg, item.pricePerKg, item.comment);
        successCount++;
        await offlineStorage.deleteItem(item.id);
      } catch { remainingItems.push(item); }
    }
    setFailedItems(remainingItems);
    setIsRetrying(false);
    if (successCount > 0) { toast({ title: `✅ ${successCount} ta yuk qayta yuklandi`, description: '', variant: 'success' }); loadData(); }
    if (remainingItems.length > 0) toast({ title: `⚠️ ${remainingItems.length} ta yuk yuklanmadi`, description: "Internetni tekshirib qayta urinib ko'ring", variant: 'warning' });
  };

  // Both search and is_sent filter are server-side; only sort client-side
  const filteredPhotos = useMemo(() => {
    return photos.slice().sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortOrder === 'newest' ? diff : -diff;
    });
  }, [photos, sortOrder]);

  const viewingPhotoIndex = useMemo(() => {
    if (!viewingPhoto) return -1;
    return filteredPhotos.findIndex((photo) => photo.id === viewingPhoto.id);
  }, [filteredPhotos, viewingPhoto]);

  const navigateViewingPhoto = useCallback((direction: 'previous' | 'next') => {
    setViewingPhoto((currentPhoto) => {
      if (!currentPhoto || filteredPhotos.length <= 1) return currentPhoto;

      const currentIndex = filteredPhotos.findIndex((photo) => photo.id === currentPhoto.id);
      if (currentIndex === -1) return currentPhoto;

      const nextIndex = direction === 'next'
        ? (currentIndex + 1) % filteredPhotos.length
        : (currentIndex - 1 + filteredPhotos.length) % filteredPhotos.length;

      return filteredPhotos[nextIndex] ?? currentPhoto;
    });
  }, [filteredPhotos]);

  const showPreviousReport = useCallback(() => {
    navigateViewingPhoto('previous');
  }, [navigateViewingPhoto]);

  const showNextReport = useCallback(() => {
    navigateViewingPhoto('next');
  }, [navigateViewingPhoto]);

  // All hooks called — safe to guard now
  if (!canView) return <AccessDenied />;

  const handleDelete = async (cargoId: string) => {
    const confirmed = await confirm({
      message: "Yukni o'chirmoqchimisiz?",
      description: "Bu amalni ortga qaytarib bo'lmaydi.",
      confirmLabel: "O'chirish",
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      setDeletingId(cargoId);
      await deleteCargo(cargoId);
      setPhotos(prev => prev.filter(p => p.id !== cargoId));
      setTotalPhotos(prev => prev - 1);
      if (viewingPhoto?.id === cargoId) setViewingPhoto(null);
      toast({ title: "✅ Muvaffaqiyatli o'chirildi", description: '', variant: 'success' });
    } catch (error: unknown) {
      toast({ title: "❌ O'chirishda xatolik yuz berdi", description: (error as { message?: string })?.message ?? "Qayta urinib ko'ring", variant: 'error' });
    } finally { setDeletingId(null); }
  };

  const handleEditSuccess = (updatedCargo: CargoPhoto) => {
    setPhotos(prev => prev.map(p => p.id === updatedCargo.id ? updatedCargo : p));
    if (viewingPhoto?.id === updatedCargo.id) setViewingPhoto(updatedCargo);
  };

  const handleExportExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await exportFlightCargoExcel(flightName);
      toast({ title: '✅ Excel fayl yuklab olindi', description: '', variant: 'success' });
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number };
      let msg = "Excel yuklab olishda xatolik yuz berdi";
      if (e.message === 'rate_limit' || e.status === 429) msg = "So'rovlar soni oshib ketdi, biroz kuting";
      else if (e.message === 'no_data' || e.status === 404) msg = "Bu reys uchun ma'lumot topilmadi";
      else if (e.message === 'network_error' || e.status === 0) msg = "Internet aloqasi yo'q";
      else if (e.message && e.message !== 'Export failed') msg = e.message;
      toast({ title: '❌ Excel yuklab olishda xatolik', description: msg, variant: 'error' });
    } finally { setIsExporting(false); }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const hasActiveFilters = filterStatus !== 'all' || debouncedSearchTerm.trim().length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#080604] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-[3px] border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastRenderer />
      <ConfirmDialog />

      <div className="min-h-screen bg-gray-50 dark:bg-[#080604]">
        <div className="container mx-auto px-4 pt-2 pb-8 max-w-6xl">

          {/* Offline Banner */}
          {failedItems.length > 0 && (
            <div className="mb-5 relative bg-white dark:bg-[#0d0a04] border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-200">
              <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 bg-amber-100 dark:bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    {/* Pulsing live indicator */}
                    <span className="absolute -top-1 -right-1 w-3 h-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                    </span>
                  </div>
                  <div>
                    <p className="font-black text-gray-800 dark:text-gray-200 text-sm">Saqlanmagan yuklar</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-0.5">
                      <span className="font-black">{failedItems.length}</span> ta yuk serverga yuborilmagan
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => setShowOfflineManager(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/15 border border-amber-200 dark:border-amber-500/20 px-3 py-2 rounded-xl transition-colors active:scale-95">
                    <SlidersHorizontal className="w-3.5 h-3.5" />Boshqarish
                  </button>
                  <button onClick={handleRetryAll} disabled={isRetrying}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-black text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 disabled:opacity-60 px-3 py-2 rounded-xl transition-all shadow-sm shadow-amber-500/30 active:scale-95">
                    {isRetrying
                      ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Yuklanmoqda</>
                      : <><RefreshCw className="w-3.5 h-3.5" />Yuborish</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showOfflineManager && (
            <OfflineCargoManager flightName={flightName} onClose={() => setShowOfflineManager(false)}
              onRefreshHost={async () => {
                try { setFailedItems(await offlineStorage.getAllItems(flightName)); loadData(); } catch { /* silent */ }
              }} />
          )}

          {/* Header */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <button onClick={onBack}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gray-400 dark:text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors active:scale-95">
                <ArrowLeft className="w-3.5 h-3.5" />Reyslar
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Chiqish"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h1 className="text-[22px] font-black tracking-tight text-gray-900 dark:text-white truncate">
                  {flight?.name}
                </h1>
                {/* Stats pills */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <StatPill label={`${totalPhotos} ta yuk`} color="gray" />
                  <StatPill label={`${statisitcs.sent_count} yuborilgan`} color="green" />
                  <StatPill label={`${statisitcs.unsent_count} kutilmoqda`} color="amber" />
                  <StatPill label={`${uniqueClients} ta mijoz`} color="blue" />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                {canCreate && (
                  <button onClick={onAddCargo}
                    className="flex items-center justify-center gap-1.5 h-9 px-4 text-[12px] font-black text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 active:scale-[0.98] rounded-xl shadow-md shadow-orange-500/25 transition-all border-0 w-full sm:w-auto">
                    <Plus className="w-3.5 h-3.5" />Yuk qo'shish
                  </button>
                )}
                {canCompareCargo && (
                  <button onClick={() => setShowComparisonModal(true)}
                    className="flex items-center justify-center gap-1.5 h-9 px-3 text-[12px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/15 border border-purple-200/60 dark:border-purple-500/20 active:scale-[0.98] rounded-xl transition-all flex-1 sm:flex-initial">
                    <ArrowUpDown className="w-3.5 h-3.5" />Solishtirish
                  </button>
                )}
                {canCompareCargo && flightName && (
                  <button onClick={() => setShowWeightModal(true)}
                    title="Manifest va hisobot og'irliklarini mijoz bo'yicha solishtirish"
                    className="flex items-center justify-center gap-1.5 h-9 px-3 text-[12px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/15 border border-sky-200/60 dark:border-sky-500/20 active:scale-[0.98] rounded-xl transition-all flex-1 sm:flex-initial">
                    <Scale className="w-3.5 h-3.5" />Og'irlik
                  </button>
                )}
                <button onClick={handleExportExcel} disabled={isExporting}
                  className="flex items-center justify-center gap-1.5 h-9 px-3 text-[12px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 border border-emerald-200/60 dark:border-emerald-500/20 active:scale-[0.98] disabled:opacity-60 rounded-xl transition-all flex-1 sm:flex-initial">
                  {isExporting
                    ? <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
                  {isExporting ? 'Yuklanmoqda...' : 'Excel'}
                </button>
                {onNavigateToNotifications && (hasPerm('flights:update') || jwtClaims.isSuperAdmin) && (
                  <button onClick={onNavigateToNotifications}
                    className="flex items-center justify-center gap-1.5 h-9 px-3 text-[12px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/15 border border-blue-200/60 dark:border-blue-500/20 active:scale-[0.98] rounded-xl transition-all flex-1 sm:flex-initial">
                    <Send className="w-3.5 h-3.5" />Bildirishnoma
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Search + Filters */}
          <div className="relative bg-white dark:bg-[#0d0a04] rounded-2xl border border-orange-100/60 dark:border-orange-500/10 shadow-sm p-4 mb-5 overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-orange-400/30 dark:via-orange-500/20 to-transparent" />

            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Mijoz kodi bo'yicha qidirish..."
                className="w-full h-11 pl-10 pr-9 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all" />
              {/* Subtle fetch spinner — keeps search input mounted so focus is never lost */}
              {isFetching ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
              ) : searchTerm ? (
                <button onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-gray-100 dark:bg-white/5 rounded-xl p-0.5">
                {(['all', 'sent', 'pending'] as FilterStatus[]).map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      filterStatus === s
                        ? s === 'sent' ? 'bg-white dark:bg-white/10 text-green-700 dark:text-green-400 shadow-sm'
                          : s === 'pending' ? 'bg-white dark:bg-white/10 text-amber-700 dark:text-amber-400 shadow-sm'
                          : 'bg-white dark:bg-white/10 text-gray-800 dark:text-gray-100 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}>
                    {s === 'all' ? 'Barchasi' : s === 'sent' ? 'Yuborilgan' : 'Kutilmoqda'}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-1.5 bg-gray-100 dark:bg-white/5 rounded-xl px-2.5 py-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                <select value={sortOrder} onChange={e => setSortOrder(e.target.value as SortOrder)}
                  className="bg-transparent border-0 text-xs font-bold text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer">
                  <option value="newest">Eng yangi</option>
                  <option value="oldest">Eng eski</option>
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {filteredPhotos.length} ta natija topildi
                </p>
                {(filterStatus !== 'all' || searchTerm) && (
                  <button onClick={() => { setSearchTerm(''); setFilterStatus('all'); }}
                    className="text-xs text-orange-600 dark:text-orange-400 font-bold hover:text-orange-700 transition-colors">
                    Tozalash
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Grid / Empty states */}
          <div className={isFetching ? 'opacity-50 pointer-events-none transition-opacity duration-150' : 'transition-opacity duration-150'}>
          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-500/5 dark:to-amber-500/5 border border-orange-100 dark:border-orange-500/10 flex items-center justify-center mb-5">
                <Package className="w-10 h-10 text-orange-200 dark:text-orange-500/30" />
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-black text-lg mb-1">Yuklar yo'q</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">Birinchi yukni qo'shing</p>
              {canCreate && (
                <button onClick={onAddCargo}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 rounded-xl shadow-md shadow-orange-500/30 transition-all active:scale-95">
                  <Plus className="w-4 h-4" />Yuk qo'shish
                </button>
              )}
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-5">
                <Search className="w-10 h-10 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-black text-lg">Natija topilmadi</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Boshqa kalit so'z bilan qidiring</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                {filteredPhotos.map(photo => (
                  <PhotoCard key={photo.id} photo={photo}
                    onView={() => setViewingPhoto(photo)}
                    onDelete={() => handleDelete(photo.id)}
                    onEdit={() => setEditingCargo(photo)}
                    isDeleting={deletingId === photo.id}
                    formatDate={formatDate}
                    canEdit={canUpdate}
                    canDelete={canDelete} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 px-1">
                  <Button
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="rounded-xl h-9 px-4 text-[13px] font-semibold border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-orange-300 dark:hover:border-orange-500/30 hover:text-orange-600 dark:hover:text-orange-400 transition-colors disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Oldingi
                  </Button>
                  <span className="text-[13px] font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] px-4 py-1.5 rounded-xl">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={currentPage === totalPages}
                    onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="rounded-xl h-9 px-4 text-[13px] font-semibold border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-orange-300 dark:hover:border-orange-500/30 hover:text-orange-600 dark:hover:text-orange-400 transition-colors disabled:opacity-40"
                  >
                    Keyingi <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </div>

      {viewingPhoto && (
        <PhotoViewerModal photo={viewingPhoto} onClose={() => setViewingPhoto(null)}
          onEdit={() => { setEditingCargo(viewingPhoto); setViewingPhoto(null); }}
          onDelete={() => handleDelete(viewingPhoto.id)}
          isDeleting={deletingId === viewingPhoto.id}
          formatDate={formatDate}
          canNavigateReports={filteredPhotos.length > 1 && viewingPhotoIndex !== -1}
          reportPositionLabel={`${viewingPhotoIndex === -1 ? 1 : viewingPhotoIndex + 1}/${Math.max(filteredPhotos.length, 1)}`}
          onPreviousReport={showPreviousReport}
          onNextReport={showNextReport} />
      )}

      {editingCargo && (
        <EditCargoModal cargo={editingCargo} onClose={() => setEditingCargo(null)} onSuccess={handleEditSuccess} />
      )}

      {showWeightModal && flightName && (
        <WeightComparisonModal
          flightName={flightName}
          onClose={() => setShowWeightModal(false)}
        />
      )}

      <CargoComparisonModal
        open={showComparisonModal}
        currentFlightName={flightName}
        onClose={() => setShowComparisonModal(false)}
        onError={handleComparisonError}
        onSuccess={handleComparisonSuccess}
      />
      {canCreate && (
        <button
          onClick={onAddCargo}
          className="sm:hidden fixed bottom-6 right-5 z-40 flex items-center gap-2 h-12 px-5 text-xs font-black text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-95 active:scale-95 rounded-full shadow-lg shadow-orange-500/40 border border-orange-400/30 backdrop-blur-md transition-all"
          aria-label="Yuk qo'shish"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Yuk qo'shish</span>
        </button>
      )}
    </>
  );
}
