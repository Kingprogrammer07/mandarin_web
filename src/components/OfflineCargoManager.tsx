import { useState, useEffect, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import {
  X, Search, Trash2, ArrowUpDown, Upload,
  ImageIcon, AlertTriangle, Save, ChevronLeft,
  Calendar, Edit, RefreshCw, WifiOff,
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';
import { offlineStorage, type FailedItem } from '@/utils/offlineStorage';
import { uploadPhoto } from '@/api/services/cargo';
import MultiPhotoUpload from '@/components/MultiPhotoUpload';

interface OfflineCargoManagerProps {
  onClose: () => void;
  onRefreshHost: () => void;
  flightName: string;
}

type SortOrder = 'newest' | 'oldest';

export default function OfflineCargoManager({ onClose, onRefreshHost, flightName }: OfflineCargoManagerProps) {
  const { toast, ToastRenderer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [items, setItems] = useState<FailedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [editingItem, setEditingItem] = useState<FailedItem | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setItems(await offlineStorage.getAllItems(flightName));
    } catch {
      toast({ title: 'Xatolik', description: "Ma'lumotlarni yuklashda xatolik", variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [flightName, toast]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filteredItems = useMemo(() => {
    return items
      .filter(item => item.clientId.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => sortOrder === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
  }, [items, searchTerm, sortOrder]);

  const handleDelete = async (id: string) => {
    if (!await confirm({ message: "Yukni o'chirmoqchimisiz?", confirmLabel: "O'chirish", variant: 'danger' })) return;
    try {
      await offlineStorage.deleteItem(id);
      setItems(prev => prev.filter(item => item.id !== id));
      toast({ title: "O'chirildi", variant: 'success' });
      onRefreshHost();
    } catch {
      toast({ title: 'Xatolik', description: "O'chirishda xatolik", variant: 'error' });
    }
  };

  const handleClearAll = async () => {
    if (!await confirm({ message: "Barchasini o'chirmoqchimisiz?", description: "Barcha saqlanmagan yuklar o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.", confirmLabel: "O'chirish", variant: 'danger' })) return;
    try {
      await offlineStorage.deleteItemsByFlight(flightName);
      setItems([]);
      toast({ title: 'Tozalandi', variant: 'success' });
      onRefreshHost();
      onClose();
    } catch {
      toast({ title: 'Xatolik', variant: 'error' });
    }
  };

  const handleRetryItem = async (item: FailedItem) => {
    if (retryingId) return;
    setRetryingId(item.id);
    try {
      await uploadPhoto(item.flightName, item.clientId, item.photos, item.weightKg, item.pricePerKg, item.comment);
      await offlineStorage.deleteItem(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast({ title: 'Yuklandi', description: `${item.clientId} muvaffaqiyatli yuklandi`, variant: 'success' });
      onRefreshHost();
    } catch (error: unknown) {
      const msg = (error as { data?: { detail?: string }; message?: string })?.data?.detail
        ?? (error as { message?: string })?.message ?? '';
      toast({ title: 'Xatolik', description: msg, variant: 'error' });
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAll = async () => {
    if (!await confirm({ message: `${items.length} ta yukni yubormoqchimisiz?`, description: "Barcha saqlanmagan yuklar serverga yuboriladi.", confirmLabel: "Yuborish", variant: 'warning' })) return;
    setIsRetryingAll(true);
    let successCount = 0;
    for (const item of items) {
      try {
        await uploadPhoto(item.flightName, item.clientId, item.photos, item.weightKg, item.pricePerKg, item.comment);
        await offlineStorage.deleteItem(item.id);
        successCount++;
      } catch { /* continue */ }
    }
    await loadItems();
    onRefreshHost();
    setIsRetryingAll(false);
    if (successCount > 0) toast({ title: 'Natija', description: `${successCount} ta yuk muvaffaqiyatli yuklandi`, variant: 'success' });
  };

  const handleSaveEdit = async (updatedItem: FailedItem) => {
    try {
      await offlineStorage.updateItem(updatedItem.id, {
        clientId: updatedItem.clientId,
        weightKg: updatedItem.weightKg,
        pricePerKg: updatedItem.pricePerKg,
        comment: updatedItem.comment,
        photos: updatedItem.photos
      });
      setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
      setEditingItem(null);
      toast({ title: 'Saqlandi', variant: 'success' });
    } catch {
      toast({ title: 'Xatolik', description: 'Saqlashda xatolik', variant: 'error' });
    }
  };

  if (editingItem) {
    return (
      <EditOfflineItem item={editingItem} onCancel={() => setEditingItem(null)} onSave={handleSaveEdit} />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-[#080604] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
      <ToastRenderer />
      <ConfirmDialog />

      {/* Header */}
      <div className="relative flex-none bg-white dark:bg-[#0d0a04] border-b border-orange-100/60 dark:border-orange-500/10 px-4 py-4 overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 transition-colors active:scale-90">
              <X className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-500" />
                <h2 className="text-base font-black text-gray-800 dark:text-gray-100">Oflayn Yuklar</h2>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                {items.length} ta saqlanmagan
              </p>
            </div>
          </div>
          {items.length > 0 && (
            <button onClick={handleClearAll}
              className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/15 border border-red-200 dark:border-red-500/20 px-3 py-2 rounded-xl transition-colors active:scale-95">
              <Trash2 className="w-3.5 h-3.5" />Tozalash
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex-none bg-white dark:bg-[#0d0a04] border-b border-gray-100 dark:border-white/5 px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Mijoz kodi bo'yicha qidirish..."
              className="pl-9 h-10 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl text-sm dark:text-gray-200 placeholder:text-gray-400 focus-visible:ring-orange-500/30 focus-visible:border-orange-500" />
          </div>
          <button onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center gap-1.5 h-10 px-3 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl transition-colors whitespace-nowrap">
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortOrder === 'newest' ? 'Eng yangi' : 'Eng eski'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-[3px] border-orange-200 border-t-orange-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-400 font-medium">Yuklanmoqda...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-3xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-semibold">Ma'lumotlar yo'q</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredItems.map(item => (
                <OfflineItemCard key={item.id} item={item}
                  onDelete={() => handleDelete(item.id)}
                  onRetry={() => handleRetryItem(item)}
                  onEdit={() => setEditingItem(item)}
                  isRetrying={retryingId === item.id} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      {items.length > 0 && (
        <div className="flex-none bg-white dark:bg-[#0d0a04] border-t border-orange-100/60 dark:border-orange-500/10 p-4 space-y-2">
          <div className="max-w-3xl mx-auto space-y-2">
          {isRetryingAll && (
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Yuborilmoqda...
              </p>
              <p className="text-xs font-black text-orange-500">
                {items.length} ta qoldi
              </p>
            </div>
          )}
          <button onClick={handleRetryAll} disabled={isRetryingAll}
            className="w-full flex items-center justify-center gap-2.5 h-14 text-base font-black text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 active:scale-[0.99] disabled:opacity-60 rounded-2xl shadow-lg shadow-orange-500/30 transition-all border-0">
            {isRetryingAll ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Yuklanmoqda...</>
            ) : (
              <><Upload className="w-5 h-5" />Barchasini Yuborish ({items.length})</>
            )}
          </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// OfflineItemCard
// ─────────────────────────────────────────
function OfflineItemCard({ item, onDelete, onRetry, onEdit, isRetrying }: {
  item: FailedItem;
  onDelete: () => void;
  onRetry: () => void;
  onEdit: () => void;
  isRetrying: boolean;
}) {
  const [showPhotos, setShowPhotos] = useState(false);
  const [objectUrls, setObjectUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!showPhotos) {
      objectUrls.forEach(url => URL.revokeObjectURL(url));
      setObjectUrls([]);
    } else {
      const urls = item.photos.map(file => URL.createObjectURL(file));
      setObjectUrls(urls);
    }
    return () => { objectUrls.forEach(url => URL.revokeObjectURL(url)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPhotos, item.photos]);

  return (
    <div className={`relative bg-white dark:bg-[#0d0a04] rounded-2xl border shadow-sm overflow-hidden animate-in fade-in duration-200 transition-colors ${
      isRetrying
        ? 'border-emerald-200 dark:border-emerald-500/20'
        : 'border-orange-100/60 dark:border-orange-500/10'
    }`}>
      <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent to-transparent ${
        isRetrying ? 'via-emerald-400/60 dark:via-emerald-500/40' : 'via-amber-400/50 dark:via-amber-500/30'
      }`} />

      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="min-w-0 flex-1 mr-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black px-2.5 py-0.5 rounded-lg text-sm tracking-wide shadow-sm shadow-orange-500/20">
                {item.clientId}
              </span>
              {isRetrying && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                  <div className="w-2 h-2 border border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  Yuborilmoqda
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 font-medium">
              <Calendar className="w-3 h-3 shrink-0" />
              {new Date(item.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={onEdit} disabled={isRetrying}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/15 text-blue-600 dark:text-blue-400 transition-colors active:scale-90 disabled:opacity-40">
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} disabled={isRetrying}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/15 text-red-500 dark:text-red-400 transition-colors active:scale-90 disabled:opacity-40">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl px-3 py-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Vazn</p>
            <p className="text-sm font-black text-gray-800 dark:text-gray-100">{item.weightKg || '—'} kg</p>
          </div>
          <div className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl px-3 py-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Narx</p>
            <p className="text-sm font-black text-gray-800 dark:text-gray-100">{item.pricePerKg ? `$${item.pricePerKg}` : '—'}</p>
          </div>
        </div>

        {/* Error message — shown only when there's a last-known error */}
        {item.error && !isRetrying && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/15 text-red-600 dark:text-red-400 text-xs font-medium p-2.5 rounded-xl mb-3">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{item.error}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => setShowPhotos(!showPhotos)}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-colors border border-gray-200 dark:border-white/10 active:scale-95">
            <ImageIcon className="w-3.5 h-3.5" />
            {showPhotos ? 'Yashirish' : `Rasmlar (${item.photos.length})`}
          </button>
          <button onClick={onRetry} disabled={isRetrying}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-black text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 active:scale-95 disabled:opacity-60 rounded-xl transition-all shadow-sm shadow-emerald-500/25 border-0">
            {isRetrying
              ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Yuklanmoqda</>
              : <><RefreshCw className="w-3.5 h-3.5" />Yuborish</>}
          </button>
        </div>
      </div>

      {showPhotos && (
        <div className="bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-white/5 p-3 flex gap-2 overflow-x-auto">
          {objectUrls.map((url, idx) => (
            <div key={idx} className="w-20 h-20 flex-none rounded-xl overflow-hidden bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm">
              <img src={url} className="w-full h-full object-cover" alt="preview" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// EditOfflineItem
// ─────────────────────────────────────────
function EditOfflineItem({ item, onCancel, onSave }: {
  item: FailedItem;
  onCancel: () => void;
  onSave: (item: FailedItem) => void;
}) {
  const [clientId, setClientId] = useState(item.clientId);
  const [weightKg, setWeightKg] = useState(item.weightKg?.toString() || '');
  const [pricePerKg, setPricePerKg] = useState(item.pricePerKg?.toString() || '');
  const [comment, setComment] = useState(item.comment || '');
  const [photos, setPhotos] = useState<File[]>(item.photos);

  const INPUT_CLS = "h-11 rounded-xl bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:border-orange-500 focus-visible:ring-offset-0 transition-all";

  const handleSave = () => {
    if (!clientId || photos.length === 0 || !weightKg) {
      alert("Iltimos, barcha majburiy maydonlarni to'ldiring");
      return;
    }
    onSave({ ...item, clientId, weightKg: Number(weightKg), pricePerKg: Number(pricePerKg), comment, photos, timestamp: Date.now() });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-gray-50 dark:bg-[#080604] flex flex-col animate-in slide-in-from-right duration-200">

      {/* Header */}
      <div className="relative flex-none bg-white dark:bg-[#0d0a04] border-b border-orange-100/60 dark:border-orange-500/10 px-4 py-4 overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={onCancel}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 transition-colors active:scale-90">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-black text-gray-800 dark:text-gray-100">Tahrirlash</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{item.clientId}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-xl mx-auto">
        <div className="relative bg-white dark:bg-[#0d0a04] rounded-3xl border border-orange-100/80 dark:border-orange-500/15 shadow-xl overflow-hidden p-6 space-y-5">
          <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.022] dark:opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(249,115,22) 1px, transparent 0)', backgroundSize: '28px 28px' }} />

          <div className="relative space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1.5">Mijoz Kodi *</label>
              <Input value={clientId} onChange={e => setClientId(e.target.value.toUpperCase())}
                className={`${INPUT_CLS} text-lg uppercase font-mono tracking-widest`} />
            </div>

            <div>
              <MultiPhotoUpload label="Rasmlar" value={photos} onChange={setPhotos} maxPhotos={10} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1.5">Vazn (kg) *</label>
                <Input value={weightKg} type="number" onChange={e => setWeightKg(e.target.value)}
                  placeholder="0.0" className={INPUT_CLS} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1.5">Narx ($)</label>
                <Input value={pricePerKg} type="number" onChange={e => setPricePerKg(e.target.value)}
                  placeholder="0.0" className={INPUT_CLS} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1.5">Izoh</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
                placeholder="Izoh (ixtiyoriy)..."
                className="w-full h-auto px-3 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all resize-none" />
            </div>
          </div>
        </div>
        </div>
      </div>

      <div className="flex-none bg-white dark:bg-[#0d0a04] border-t border-orange-100/60 dark:border-orange-500/10 p-4">
        <div className="max-w-xl mx-auto">
          <button onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 h-14 text-base font-black text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 active:scale-[0.99] rounded-2xl shadow-lg shadow-orange-500/30 transition-all border-0">
            <Save className="w-5 h-5" />Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}