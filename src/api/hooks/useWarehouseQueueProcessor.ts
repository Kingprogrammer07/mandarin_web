import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWarehouseQueueStore } from '../../store/useWarehouseQueueStore';
import { bulkMarkTransactionTaken } from '../services/warehouse';
import { warehouseKeys } from './useWarehouse';

/**
 * Initializes the warehouse upload queue and runs a background sequential processor.
 * Call once at the top of WarehousePage ✅ idempotent.
 *
 * Uses toast.promise so the loading → success/error toast transition is handled
 * natively by Sonner (avoids the ID-based update race condition).
 */
export function useWarehouseQueueProcessor() {
  const queryClient = useQueryClient();
  const items = useWarehouseQueueStore((s) => s.items);
  const isLoaded = useWarehouseQueueStore((s) => s.isLoaded);
  const initialize = useWarehouseQueueStore((s) => s.initialize);
  const markUploading = useWarehouseQueueStore((s) => s.markUploading);
  const markError = useWarehouseQueueStore((s) => s.markError);
  const markSuccess = useWarehouseQueueStore((s) => s.markSuccess);

  const processingRef = useRef(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isLoaded || processingRef.current) return;

    const pendingItem = items.find((i) => i.status === 'pending');
    if (!pendingItem) return;

    processingRef.current = true;
    markUploading(pendingItem.id);

    const formData = new FormData();
    formData.append('transaction_ids', pendingItem.transactionIds.join(','));
    formData.append('delivery_method', pendingItem.deliveryMethod);
    if (pendingItem.comment) {
      formData.append('comment', pendingItem.comment);
    }
    pendingItem.photos.forEach((photo) => formData.append('photos', photo));

    // Capture stable values before async operations
    const { id, clientCode } = pendingItem;
    const uploadPromise = bulkMarkTransactionTaken(formData);

    // toast.promise handles loading → success/error transition atomically ✨
    // more reliable than the manual toast.loading + toast.success(id) pattern.
    toast.promise(uploadPromise, {
      loading: `${clientCode} (${pendingItem.transactionIds.length} ta) → yuklanmoqda...`,
      success: `${clientCode} → muvaffaqiyatli ommaviy tasdiqlandi`,
      error: (err: unknown) =>
        (err as { message?: string }).message ?? 'Serverga ulanishda xatolik',
    });

    // Side-effects: update store + cache after the promise settles
    uploadPromise
      .then(() => {
        markSuccess(id);
        queryClient.invalidateQueries({ queryKey: warehouseKeys.allTransactions() });
      })
      .catch((err: unknown) => {
        const message =
          (err as { message?: string }).message ?? 'Serverga ulanishda xatolik';
        markError(id, message);
      })
      .finally(() => {
        processingRef.current = false;
      });
  }, [items, isLoaded, markUploading, markSuccess, markError, queryClient]);
}
