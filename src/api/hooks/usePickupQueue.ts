import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createPosPickupQueue,
  createWarehousePickupQueue,
  getWarehousePickupQueueCount,
  getWarehousePickupQueueList,
  cancelPickupQueue,
  activatePickupQueueTV,
  getPickupQueueTV,
  getPosPickupQueueList,
  updatePosPickupQueue,
  cancelPosPickupQueue,
} from '../pickupQueue';
import type {
  PickupQueueCreateRequest,
  PickupQueueCancelRequest,
  WarehousePickupQueueListParams,
  PickupQueueTVParams,
  PosPickupQueueUpdateRequest,
} from '../pickupQueue';

export const pickupQueueKeys = {
  count: (params: { status?: string; pickup_method?: string }) =>
    ['pickup_queue', 'count', params] as const,
  warehouseList: (params: WarehousePickupQueueListParams) =>
    ['pickup_queue', 'warehouse_list', params] as const,
  detail: (id: number) => ['pickup_queue', 'detail', id] as const,
  tv: (params: PickupQueueTVParams) => ['pickup_queue', 'tv', params] as const,
};

export const useWarehousePickupQueueCount = (params: {
  status?: 'preparing' | 'ready' | 'cancelled' | 'expired';
  pickup_method?: 'self_pickup' | 'yandex' | 'bts' | 'uzpost' | 'mandarin';
  priority?: 'vip' | 'high' | 'normal';
}) => {
  return useQuery({
    queryKey: pickupQueueKeys.count(params),
    queryFn: () => getWarehousePickupQueueCount(params),
    staleTime: 3_000,
    refetchInterval: 3_000,
    placeholderData: (previousData) => previousData,
  });
};

export const useWarehousePickupQueueList = (params: WarehousePickupQueueListParams) => {
  return useQuery({
    queryKey: pickupQueueKeys.warehouseList(params),
    queryFn: () => getWarehousePickupQueueList(params),
    staleTime: 5_000,
    refetchInterval: 5_000,
    placeholderData: (previousData) => previousData,
  });
};

export const useCreatePosPickupQueue = () => {
  return useMutation({
    mutationFn: (data: PickupQueueCreateRequest) => createPosPickupQueue(data),
    onSuccess: (res) => {
      const queue = res as { display_number?: number };
      toast.success(
        queue.display_number
          ? `Navbat muvaffaqiyatli yaratildi (#${queue.display_number})`
          : "Navbat muvaffaqiyatli yaratildi",
      );
    },
    onError: (err: unknown) => {
      const e = err as {
        message?: string;
        status?: number;
        data?: { display_number?: number; detail?: string };
      };
      if (e.status === 409) {
        const displayNumber = e.data?.display_number;
        toast.error(
          displayNumber
            ? `Bu yuklar allaqachon navbatda (#${displayNumber})`
            : "Bu yuklar allaqachon navbatda",
        );
      } else {
        toast.error(e.message ?? "Navbat yaratishda xatolik");
      }
    },
  });
};

export const useCreateWarehousePickupQueue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PickupQueueCreateRequest) => createWarehousePickupQueue(data),
    onSuccess: () => {
      toast.success("Navbat muvaffaqiyatli yaratildi");
      queryClient.invalidateQueries({ queryKey: pickupQueueKeys.count({ status: 'preparing' }) });
      queryClient.invalidateQueries({ queryKey: ['pickup_queue', 'warehouse_list'] });
    },
    onError: (err: unknown) => {
      const e = err as { message?: string; status?: number };
      toast.error(e.message ?? "Navbat yaratishda xatolik");
    },
  });
};

export const useCancelPickupQueue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ queueId, data }: { queueId: number; data: PickupQueueCancelRequest }) =>
      cancelPickupQueue(queueId, data),
    onSuccess: () => {
      toast.success("Navbat bekor qilindi");
      queryClient.invalidateQueries({ queryKey: pickupQueueKeys.count({ status: 'preparing' }) });
      queryClient.invalidateQueries({ queryKey: ['pickup_queue', 'warehouse_list'] });
      queryClient.invalidateQueries({ queryKey: ['pos_pickup_queue', 'list'] });
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message ?? "Bekor qilishda xatolik");
    },
  });
};

export const useActivatePickupQueueTV = () => {
  return useMutation({
    mutationFn: (data: { passcode: string }) => activatePickupQueueTV(data),
    onSuccess: (res) => {
      const payload = { token: res.token, expires_at: res.expires_at };
      localStorage.setItem('pickup_queue_tv', JSON.stringify(payload));
      toast.success("TV faollashtirildi");
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message ?? "Faollashtirishda xatolik");
    },
  });
};

export const usePickupQueueTV = (params: PickupQueueTVParams, token: string | null) => {
  return useQuery({
    queryKey: pickupQueueKeys.tv(params),
    queryFn: () => {
      if (!token) throw new Error('TV token yo\'q');
      return getPickupQueueTV(params, token);
    },
    enabled: !!token,
    staleTime: 3_000,
    refetchInterval: 3_000,
    placeholderData: (previousData) => previousData,
  });
};

export const usePosPickupQueueList = () => {
  return useQuery({
    queryKey: ['pos_pickup_queue', 'list'] as const,
    queryFn: () => getPosPickupQueueList(),
    staleTime: 5_000,
    refetchInterval: 5_000,
    placeholderData: (previousData) => previousData,
  });
};

export const useUpdatePosPickupQueue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ queueId, data }: { queueId: number; data: PosPickupQueueUpdateRequest }) =>
      updatePosPickupQueue(queueId, data),
    onSuccess: () => {
      toast.success('Navbat yangilandi');
      queryClient.invalidateQueries({ queryKey: ['pos_pickup_queue'] });
      queryClient.invalidateQueries({ queryKey: ['pickup_queue'] });
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message ?? 'Yangilashda xatolik');
    },
  });
};

export const useCancelPosPickupQueue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ queueId, reason }: { queueId: number; reason?: string | null }) =>
      cancelPosPickupQueue(queueId, reason),
    onSuccess: () => {
      toast.success('Navbat bekor qilindi');
      queryClient.invalidateQueries({ queryKey: ['pos_pickup_queue'] });
      queryClient.invalidateQueries({ queryKey: ['pickup_queue'] });
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message ?? 'Bekor qilishda xatolik');
    },
  });
};
