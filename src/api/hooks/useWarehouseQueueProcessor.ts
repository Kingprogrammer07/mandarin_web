import { useEffect, useRef, useState } from 'react';
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

  // Page Visibility API: pause uploads when app is backgrounded
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);

  useEffect(() => {
    const handler = () => setIsPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isLoaded || processingRef.current || !isPageVisible) return;

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
    if (pendingItem.force) {
      formData.append('force', 'true');
    }
    pendingItem.photos.forEach((photo) => formData.append('photos', photo));

    // Capture stable values before async operations
    const { id, clientCode } = pendingItem;
    const uploadPromise = bulkMarkTransactionTaken(formData);

    // toast.promise handles loading → success/error transition atomically ✨
    // more reliable than the manual toast.loading + toast.success(id) pattern.
    toast.promise(uploadPromise, {
      loading: `${clientCode} (${pendingItem.transactionIds.length} ta) → yuklanmoqda...`,
      success: (response) => {
        if (response.uzpost_order_number) {
          return `${clientCode} → UzPost ${response.uzpost_order_number} yaratildi`;
        }
        return response.message || `${clientCode} → muvaffaqiyatli ommaviy tasdiqlandi`;
      },
      error: (err: unknown) =>
        (err as { message?: string }).message ?? 'Serverga ulanishda xatolik',
    });

    // Side-effects: update store + cache after the promise settles
    uploadPromise
      .then(() => {
        markSuccess(id);
        // Prefix-based invalidation with `refetchType: 'active'` collapses
        // the seven previous concurrent refetches into refetches only for
        // queries actually mounted on the current page.
        queryClient.invalidateQueries({
          queryKey: warehouseKeys.allTransactions(),
          refetchType: 'active',
        });
        queryClient.invalidateQueries({
          queryKey: warehouseKeys.flights(),
          refetchType: 'active',
        });
        queryClient.invalidateQueries({
          queryKey: ['pickup_queue'],
          refetchType: 'active',
        });
        queryClient.invalidateQueries({
          queryKey: ['warehouse_uzpost_orders'],
          refetchType: 'active',
        });
      })
      .catch((err: unknown) => {
        const message =
          (err as { message?: string }).message ?? 'Serverga ulanishda xatolik';
        markError(id, message);
      })
      .finally(() => {
        processingRef.current = false;
      });
  }, [items, isLoaded, isPageVisible, markUploading, markSuccess, markError, queryClient]);
}
