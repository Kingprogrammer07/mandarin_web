import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2, Plus, Eye, MousePointerClick, Image,
  Layers, BarChart2, ArrowLeft,
} from 'lucide-react';
import { motion } from 'framer-motion';

import {
  getCarouselStats,
  createCarouselItem,
  updateCarouselItem,
  deleteCarouselItem,
} from '../../api/services/adminCarousel';
import type {
  CarouselItemStatsResponse,
  CarouselItemCreateRequest,
} from '../../api/services/adminCarousel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '../../components/ui/drawer';
import { Skeleton } from '../../components/ui/skeleton';

import { useIsDesktop, formatNumber } from './carousel-components/utils';
import { UPLOAD_IDLE, type UploadState } from './carousel-components/types';
import { StatCard } from './carousel-components/StatCard';
import { CarouselCard } from './carousel-components/CarouselCard';
import { GlobalUploadBadge } from './carousel-components/GlobalUploadBadge';
import { CarouselForm } from './carousel-components/CarouselForm';
import type { CarouselFormValues } from './carousel-components/types';

// ─── Main page ─────────────────────────────────────────────────────────────────

interface AdminCarouselPageProps {
  /** When provided the page renders standalone (no AdminLayout) with a back button. */
  onBack?: () => void;
}

export default function AdminCarouselPage({ onBack }: AdminCarouselPageProps) {
  const queryClient = useQueryClient();
  const isDesktop   = useIsDesktop();

  const [isFormOpen,       setIsFormOpen]       = useState(false);
  const [editingItem,      setEditingItem]       = useState<CarouselItemStatsResponse | null>(null);
  const [confirmDeleteId,  setConfirmDeleteId]   = useState<number | null>(null);
  const [togglingId,       setTogglingId]        = useState<number | null>(null);
  const [deletingId,       setDeletingId]        = useState<number | null>(null);
  const [sortBy,           setSortBy]            = useState<'order' | 'views' | 'clicks'>('order');
  const [sortDir,          setSortDir]           = useState<'asc' | 'desc'>('asc');
  /** Tracks active upload state from the form for the global floating badge. */
  const [globalUpload,     setGlobalUpload]      = useState<UploadState>(UPLOAD_IDLE);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: statsItems, isLoading } = useQuery<CarouselItemStatsResponse[]>({
    queryKey: ['admin-carousel-stats'],
    queryFn: getCarouselStats,
  });

  // ── Derived stats ─────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    if (!statsItems) return { total: 0, active: 0, views: 0, clicks: 0 };
    return {
      total:  statsItems.length,
      active: statsItems.filter((i) => i.is_active).length,
      views:  statsItems.reduce((s, i) => s + i.total_views, 0),
      clicks: statsItems.reduce((s, i) => s + i.total_clicks, 0),
    };
  }, [statsItems]);

  const sortedItems = useMemo(() => {
    if (!statsItems) return [];
    return [...statsItems].sort((a, b) => {
      const va = sortBy === 'order' ? a.order : sortBy === 'views' ? a.total_views : a.total_clicks;
      const vb = sortBy === 'order' ? b.order : sortBy === 'views' ? b.total_views : b.total_clicks;
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [statsItems, sortBy, sortDir]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('desc'); }
  };

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMut = useMutation({
    mutationFn: createCarouselItem,
    onSuccess: () => {
      toast.success("Karusel elementi yaratildi");
      queryClient.invalidateQueries({ queryKey: ['admin-carousel-stats'] });
      setIsFormOpen(false);
      setEditingItem(null);
      setGlobalUpload(UPLOAD_IDLE);
    },
    onError: () => toast.error("Yaratishda xatolik yuz berdi"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CarouselItemCreateRequest }) =>
      updateCarouselItem(id, data),
    onSuccess: () => {
      toast.success("Element yangilandi");
      queryClient.invalidateQueries({ queryKey: ['admin-carousel-stats'] });
      setIsFormOpen(false);
      setEditingItem(null);
      setGlobalUpload(UPLOAD_IDLE);
    },
    onError: () => toast.error("Yangilashda xatolik yuz berdi"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCarouselItem,
    onSuccess: () => {
      toast.success("Element o'chirildi");
      queryClient.invalidateQueries({ queryKey: ['admin-carousel-stats'] });
      setConfirmDeleteId(null);
      setDeletingId(null);
    },
    onError: () => {
      toast.error("O'chirishda xatolik yuz berdi");
      setDeletingId(null);
    },
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      updateCarouselItem(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-carousel-stats'] });
    },
    onError: () => toast.error("Holat o'zgartirishda xatolik"),
    onSettled: () => setTogglingId(null),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFormSubmit = useCallback(
    (data: CarouselItemCreateRequest) => {
      if (editingItem) {
        updateMut.mutate({ id: editingItem.id, data });
      } else {
        createMut.mutate(data);
      }
    },
    [editingItem, createMut, updateMut],
  );

  const handleEdit = useCallback((item: CarouselItemStatsResponse) => {
    setEditingItem(item);
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback((id: number) => {
    setDeletingId(id);
    deleteMut.mutate(id);
  }, [deleteMut]);

  const handleToggleActive = useCallback(
    (item: CarouselItemStatsResponse) => {
      setTogglingId(item.id);
      toggleActiveMut.mutate({ id: item.id, is_active: !item.is_active });
    },
    [toggleActiveMut],
  );

  const handleModalClose = useCallback((open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditingItem(null);
      setGlobalUpload(UPLOAD_IDLE);
    }
  }, []);

  const formDefaultValues: CarouselFormValues | undefined = editingItem
    ? {
        type:         editingItem.type,
        title:        editingItem.title ?? '',
        sub_title:    editingItem.sub_title ?? '',
        media_type:   editingItem.media_type,
        media_url:    editingItem.media_url,
        media_s3_key: editingItem.media_s3_key ?? '',
        action_url:   editingItem.action_url ?? '',
        text_color:   editingItem.text_color,
        gradient:     editingItem.gradient ?? '',
        order:        editingItem.order,
        is_active:    editingItem.is_active,
      }
    : undefined;

  const isPending  = createMut.isPending || updateMut.isPending;
  const isUploading = globalUpload.status === 'uploading';
  const modalTitle = editingItem ? 'Elementni tahrirlash' : "Yangi element qo'shish";

  const renderSortButton = (col: typeof sortBy, label: string) => (
    <button
      key={col}
      onClick={() => toggleSort(col)}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
        sortBy === col
          ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
      }`}
    >
      {label}
      {sortBy === col && (
        sortDir === 'asc'
          ? <span>▲</span>
          : <span>▼</span>
      )}
    </button>
  );

  const SubmitButton = (
    <motion.button
      type="submit"
      form="carousel-form"
      disabled={isPending || isUploading}
      whileTap={{ scale: 0.97 }}
      className="w-full flex justify-center items-center gap-2 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-semibold text-[14px] shadow-lg shadow-orange-500/20 disabled:opacity-60 transition-all"
    >
      {isPending ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isUploading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Yuklanmoqda… {globalUpload.progress}%
        </>
      ) : (
        'Saqlash'
      )}
    </motion.button>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const content = (
    <div className="space-y-6">

      {/* Floating upload progress badge */}
      <GlobalUploadBadge uploadState={globalUpload} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">
            Karusel boshqaruvi
          </h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-500 mt-1">
            Reklama va yangilik bannerlarini boshqaring
          </p>
        </div>
        <motion.button
          onClick={() => { setEditingItem(null); setIsFormOpen(true); }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-2.5 rounded-xl text-[13px] font-semibold shadow-lg shadow-orange-500/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Yangi element</span>
        </motion.button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl dark:bg-white/[0.04]" />
          ))
        ) : (
          <>
            <StatCard
              icon={<Layers          className="w-4 h-4 text-blue-500" />}
              label="Jami elementlar"
              value={summary.total}
              accent="bg-blue-100 dark:bg-blue-500/20"
            />
            <StatCard
              icon={<span className="w-4 h-4 text-emerald-500 font-bold text-[10px] flex items-center justify-center">ON</span>}
              label="Faol elementlar"
              value={summary.active}
              accent="bg-emerald-100 dark:bg-emerald-500/20"
            />
            <StatCard
              icon={<Eye             className="w-4 h-4 text-purple-500" />}
              label="Jami ko'rishlar"
              value={formatNumber(summary.views)}
              accent="bg-purple-100 dark:bg-purple-500/20"
            />
            <StatCard
              icon={<MousePointerClick className="w-4 h-4 text-orange-500" />}
              label="Jami bosishlar"
              value={formatNumber(summary.clicks)}
              accent="bg-orange-100 dark:bg-orange-500/20"
            />
          </>
        )}
      </div>

      {/* Sort controls */}
      {!isLoading && statsItems && statsItems.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
            Saralash:
          </span>
          {renderSortButton('order',  'Tartib')}
          {renderSortButton('views',  "Ko'rishlar")}
          {renderSortButton('clicks', 'Bosishlar')}
          {summary.views > 0 && (
            <div className="ml-auto flex items-center gap-1.5 text-[12px] text-orange-500 font-medium">
              <BarChart2 className="w-3.5 h-3.5" />
              Umumiy CTR: {((summary.clicks / summary.views) * 100).toFixed(2)}%
            </div>
          )}
        </div>
      )}

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-[20px] overflow-hidden border border-gray-100 dark:border-white/[0.06]">
              <Skeleton className="h-36 w-full rounded-none dark:bg-white/[0.04]" />
              <div className="p-4 space-y-2 bg-white dark:bg-[#111]">
                <Skeleton className="h-3 w-3/4 rounded dark:bg-white/[0.04]" />
                <Skeleton className="h-3 w-1/2 rounded dark:bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600 bg-white dark:bg-white/[0.02] rounded-[20px] border-2 border-dashed border-gray-200 dark:border-white/[0.08]">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center mb-4">
            <Image className="w-7 h-7 text-gray-300 dark:text-gray-700" strokeWidth={1.5} />
          </div>
          <p className="text-[15px] font-semibold">Karusel elementlari yo'q</p>
          <p className="text-[13px] mt-1">Birinchi elementni qo'shing</p>
          <motion.button
            onClick={() => setIsFormOpen(true)}
            whileTap={{ scale: 0.95 }}
            className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[13px] font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Qo'shish
          </motion.button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
          {sortedItems.map((item) => (
            <CarouselCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
              isTogglingId={togglingId}
              isDeletingId={deletingId}
              confirmDeleteId={confirmDeleteId}
              onConfirmDelete={setConfirmDeleteId}
              onCancelDelete={() => setConfirmDeleteId(null)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {isDesktop ? (
        <Dialog open={isFormOpen} onOpenChange={handleModalClose}>
          <DialogContent className="sm:max-w-[540px] flex flex-col gap-0 max-h-[90vh] p-0 overflow-hidden">
            <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-gray-100 dark:border-white/[0.06]">
              <DialogTitle>{modalTitle}</DialogTitle>
              <DialogDescription className="sr-only">
                Karusel elementi ma'lumotlarini kiriting.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <CarouselForm
                key={editingItem?.id ?? 'new'}
                defaultValues={formDefaultValues}
                defaultMediaItems={editingItem?.media_items}
                onSubmit={handleFormSubmit}
                onUploadStateChange={setGlobalUpload}
              />
            </div>
            <div className="shrink-0 px-6 pb-6 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
              {SubmitButton}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={isFormOpen} onOpenChange={handleModalClose}>
          <DrawerContent className="flex flex-col max-h-[92vh]">
            <DrawerHeader className="shrink-0 text-left px-4 pt-4 pb-3 border-b border-gray-100 dark:border-white/[0.06]">
              <DrawerTitle>{modalTitle}</DrawerTitle>
              <DrawerDescription className="sr-only">
                Karusel elementi ma'lumotlarini kiriting.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-4 py-5">
              <CarouselForm
                key={editingItem?.id ?? 'new'}
                defaultValues={formDefaultValues}
                defaultMediaItems={editingItem?.media_items}
                onSubmit={handleFormSubmit}
                onUploadStateChange={setGlobalUpload}
              />
            </div>
            <div className="shrink-0 px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-white/[0.06]">
              {SubmitButton}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );

  // ── Standalone wrap (manager view) ────────────────────────────────────────
  if (onBack) {
    return (
      <div className="min-h-screen bg-[#f5f5f4] dark:bg-[#09090b]">
        {/* Sticky back-button header */}
        <div className="sticky top-0 z-20 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-white/[0.08]">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
              title="Orqaga"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                <Layers className="w-4 h-4 text-orange-500" />
              </div>
              <h1 className="text-[15px] font-bold text-gray-900 dark:text-white leading-tight">
                Karusel boshqaruvi
              </h1>
            </div>
          </div>
        </div>
        {/* Page content with padding */}
        <div className="max-w-5xl mx-auto px-4 py-5">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
