<<<<<<< HEAD
import { useState, useEffect, useMemo, useCallback } from 'react';
=======
import { useState, useEffect, useMemo } from 'react';
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    X, Search, Trash2, ArrowUpDown, Upload,
    ImageIcon, AlertTriangle, Save, ChevronLeft, Calendar,
    Edit
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { offlineStorage, type FailedItem } from '@/utils/offlineStorage';
import { useTranslation } from 'react-i18next';
import { uploadPhoto } from '@/api/services/cargo';
import MultiPhotoUpload from '@/components/MultiPhotoUpload';

interface OfflineCargoManagerProps {
    onClose: () => void;
    onRefreshHost: () => void; // Callback to refresh parent component
    flightName: string;
}

type SortOrder = 'newest' | 'oldest';

export default function OfflineCargoManager({ onClose, onRefreshHost, flightName }: OfflineCargoManagerProps) {
    const { t } = useTranslation();
    const { toast, ToastRenderer } = useToast();

    const [items, setItems] = useState<FailedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

    // Edit Mode
    const [editingItem, setEditingItem] = useState<FailedItem | null>(null);

<<<<<<< HEAD
    const loadItems = useCallback(async () => {
=======
    // Load items on mount
    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
        try {
            setLoading(true);
            const data = await offlineStorage.getAllItems(flightName);
            setItems(data);
<<<<<<< HEAD
        } catch {
            console.error('Failed to load offline items');
=======
        } catch (error) {
            console.error('Failed to load offline items:', error);
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
            toast({
                title: 'Xatolik',
                description: 'Ma\'lumotlarni yuklashda xatolik yuz berdi',
                variant: 'error'
            });
        } finally {
            setLoading(false);
        }
<<<<<<< HEAD
    }, [flightName, toast]);

    // Load items on mount
    useEffect(() => {
        loadItems();
    }, [loadItems]);
=======
    };

>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
    // Filter & Sort
    const filteredItems = useMemo(() => {
        return items
            .filter(item =>
                item.clientId.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => {
                if (sortOrder === 'newest') return b.timestamp - a.timestamp;
                return a.timestamp - b.timestamp;
            });
    }, [items, searchTerm, sortOrder]);

    // Actions
    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!confirm(t('cargo.messages.deleteConfirm'))) return;

        try {
            await offlineStorage.deleteItem(id);
            setItems(prev => prev.filter(item => item.id !== id));
            toast({ title: 'O\'chirildi', variant: 'success' });
            onRefreshHost();
<<<<<<< HEAD
        } catch {
=======
        } catch (error) {
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
            toast({ title: 'Xatolik', description: 'O\'chirishda xatolik', variant: 'error' });
        }
    };

    const handleClearAll = async () => {
        if (!confirm('Barcha saqlanmagan ma\'lumotlar o\'chiriladi. Ishonchingiz komilmi?')) return;
        try {
            await offlineStorage.deleteItemsByFlight(flightName);
            setItems([]);
            toast({ title: 'Tozalandi', variant: 'success' });
            onRefreshHost();
            onClose();
<<<<<<< HEAD
        } catch {
=======
        } catch (error) {
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
            toast({ title: 'Xatolik', variant: 'error' });
        }
    };

    const handleRetryItem = async (item: FailedItem, e?: React.MouseEvent) => {
        e?.stopPropagation();
        try {
            toast({ title: 'Yuklanmoqda...', description: `${item.clientId} yuklanmoqda` });

            await uploadPhoto(
                item.flightName,
                item.clientId,
                item.photos,
                item.weightKg,
                item.pricePerKg,
                item.comment
            );

            await offlineStorage.deleteItem(item.id);
            setItems(prev => prev.filter(i => i.id !== item.id));

            toast({
                title: 'Yuklandi',
                description: `${item.clientId} muvaffaqiyatli yuklandi`,
                variant: 'success'
            });
            onRefreshHost();
<<<<<<< HEAD
        } catch (error: unknown) {
            console.error(error);
            const msg =
                (typeof error === 'object' && error !== null && 'data' in (error as object) && (error as { data?: { detail?: string } }).data?.detail) ||
                (typeof error === 'object' && error !== null && 'message' in (error as object) && (error as { message?: string }).message) ||
                '';
=======
        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.detail || error.message;
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
            toast({
                title: 'Xatolik',
                description: msg,
                variant: 'error'
            });
        }
    };

    const handleRetryAll = async () => {
        if (!confirm(`Haqiqatan ham ${items.length} ta yukni qayta yubormoqchimisiz?`)) return;

        // Simple iteration for now
        let successCount = 0;
        for (const item of items) {
            try {
                await uploadPhoto(
                    item.flightName,
                    item.clientId,
                    item.photos,
                    item.weightKg,
                    item.pricePerKg,
                    item.comment
                );
                await offlineStorage.deleteItem(item.id);
                successCount++;
            } catch (e) {
                console.error(`Failed to retry ${item.clientId}`, e);
            }
        }

        // Reload remaining
        await loadItems();
        onRefreshHost();

        if (successCount > 0) {
            toast({ title: 'Natija', description: `${successCount} ta yuk muvaffaqiyatli yuklandi`, variant: 'success' });
        }
    };

    // Edit Form Handlers
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
<<<<<<< HEAD
        } catch {
=======
        } catch (e) {
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
            toast({ title: 'Xatolik', description: 'Saqlashda xatolik', variant: 'error' });
        }
    };


    // --- RENDER ---

    if (editingItem) {
        return (
            <EditOfflineItem
                item={editingItem}
                onCancel={() => setEditingItem(null)}
                onSave={handleSaveEdit}
            />
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col animate-in fade-in slide-in-from-bottom-5">
            <ToastRenderer />

            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm flex-none">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-600" />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Oflayn Yuklar</h2>
                        <p className="text-xs text-gray-500">{items.length} ta saqlanmagan</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {items.length > 0 && (
                        <Button
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={handleClearAll}
                        >
                            <Trash2 className="w-4 h-4 mr-2" /> Tozalash
                        </Button>
                    )}
                </div>
            </div>

            {/* Toolbar */}
            <div className="p-4 bg-white border-b border-gray-200 flex flex-col sm:flex-row gap-3 flex-none">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Mijoz kodi bo'yicha qidirish..."
                        className="pl-9"
                    />
                </div>
                <Button
                    variant="outline"
                    onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                    className="min-w-[140px]"
                >
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    {sortOrder === 'newest' ? 'Eng yangi' : 'Eng eski'}
                </Button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                    <div className="flex justify-center p-10"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Ma'lumotlar yo'q</p>
                    </div>
                ) : (
                    filteredItems.map(item => (
                        <OfflineItemCard
                            key={item.id}
                            item={item}
                            onDelete={() => handleDelete(item.id)}
                            onRetry={() => handleRetryItem(item)}
                            onEdit={() => setEditingItem(item)}
                        />
                    ))
                )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
                <div className="bg-white border-t border-gray-200 p-4 flex-none">
                    <Button
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg"
                        onClick={handleRetryAll}
                    >
                        <Upload className="w-5 h-5 mr-2" />
                        Barchasini Yuborish ({items.length})
                    </Button>
                </div>
            )}
        </div>
    );
}

// --- SUB-COMPONENTS ---

function OfflineItemCard({ item, onDelete, onRetry, onEdit }: {
    item: FailedItem,
    onDelete: () => void,
    onRetry: () => void,
    onEdit: () => void
}) {
    const [showPhotos, setShowPhotos] = useState(false);
    const [objectUrls, setObjectUrls] = useState<string[]>([]);

    // Clean up object URLs when hidden or unmounted
    useEffect(() => {
        if (!showPhotos) {
            objectUrls.forEach(url => URL.revokeObjectURL(url));
<<<<<<< HEAD
            queueMicrotask(() => setObjectUrls([]));
        } else {
            // Generate URLs
            const urls = item.photos.map(file => URL.createObjectURL(file));
            queueMicrotask(() => setObjectUrls(urls));
=======
            setObjectUrls([]);
        } else {
            // Generate URLs
            const urls = item.photos.map(file => URL.createObjectURL(file));
            setObjectUrls(urls);
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
        }
        return () => {
            objectUrls.forEach(url => URL.revokeObjectURL(url));
        };
<<<<<<< HEAD
    }, [showPhotos, item.photos, objectUrls]);
=======
    }, [showPhotos, item.photos]);
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in">
            <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <span className="inline-block bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-sm mb-1">
                            {item.clientId}
                        </span>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(item.timestamp).toLocaleString()}
                        </p>
                    </div>
                    <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={onEdit}>
                            <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={onDelete}>
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                    <div><span className="font-medium">Vazn:</span> {item.weightKg || '-'} kg</div>
                    <div><span className="font-medium">Narx:</span> {item.pricePerKg ? `$${item.pricePerKg}` : '-'}</div>
                </div>

                {item.error && (
                    <div className="bg-red-50 text-red-700 text-xs p-2 rounded mb-3">
                        Xatolik: {item.error}
                    </div>
                )}

                <div className="flex gap-2 mt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => setShowPhotos(!showPhotos)}
                    >
                        <ImageIcon className="w-3 h-3 mr-2" />
                        {showPhotos ? 'Yashirish' : `Rasmlar (${item.photos.length})`}
                    </Button>
                    <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={onRetry}
                    >
                        <Upload className="w-3 h-3 mr-2" />
                        Yuborish
                    </Button>
                </div>
            </div>

            {/* Photo Preview Area */}
            {showPhotos && (
                <div className="bg-gray-100 p-3 flex gap-2 overflow-x-auto">
                    {objectUrls.map((url, idx) => (
                        <div key={idx} className="w-20 h-20 flex-none rounded-lg overflow-hidden bg-white border border-gray-200">
                            <img src={url} className="w-full h-full object-cover" alt="preview" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// --- EDIT COMPONENT ---

function EditOfflineItem({ item, onCancel, onSave }: {
    item: FailedItem,
    onCancel: () => void,
    onSave: (item: FailedItem) => void
}) {
    const [clientId, setClientId] = useState(item.clientId);
    const [weightKg, setWeightKg] = useState(item.weightKg?.toString() || '');
    const [pricePerKg, setPricePerKg] = useState(item.pricePerKg?.toString() || '');
    const [comment, setComment] = useState(item.comment || '');
    const [photos, setPhotos] = useState<File[]>(item.photos);

    const handleSave = () => {
        if (!clientId || photos.length === 0 || !weightKg) {
            alert("Iltimos, barcha majburiy maydonlarni to'ldiring");
            return;
        }

        onSave({
            ...item,
            clientId,
            weightKg: Number(weightKg),
            pricePerKg: Number(pricePerKg),
            comment,
            photos,
            timestamp: Date.now()
        });
    };

    return (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-200">
                <Button variant="ghost" size="icon" onClick={onCancel}>
                    <ChevronLeft className="w-6 h-6" />
                </Button>
                <h2 className="text-lg font-bold">Tahrirlash</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Mijoz Kodi</label>
                        <Input value={clientId} onChange={e => setClientId(e.target.value.toUpperCase())} className="text-lg" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Vazn (kg)</label>
                        <Input value={weightKg} type="number" onChange={e => setWeightKg(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Narx ($)</label>
                        <Input value={pricePerKg} type="number" onChange={e => setPricePerKg(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Izoh</label>
                        <textarea
                            className="w-full border border-gray-300 rounded-md p-2"
                            rows={3}
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                        />
                    </div>

                    <div>
                        <MultiPhotoUpload
                            label="Rasmlar"
                            value={photos}
                            onChange={setPhotos}
                            maxPhotos={10}
                        />
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-gray-200">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6" onClick={handleSave}>
                    <Save className="w-5 h-5 mr-2" /> Saqlash
                </Button>
            </div>
        </div>
    );
}
