import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, PlugZap, Save, Truck } from 'lucide-react';
import { toast } from 'sonner';

import {
  systemService,
  type ManagerDeliveryChannelCheckResult,
  type ManagerDeliveryChannelSettings,
} from '@/api/services/systemService';

const QUERY_KEY = ['system-manager-delivery-channel'] as const;

const inputClass =
  'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-[#111827] dark:text-white';
const labelClass =
  'text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45';

function ManagerDeliveryChannelForm({
  initial,
}: {
  initial: ManagerDeliveryChannelSettings;
}) {
  const queryClient = useQueryClient();
  const [channelId, setChannelId] = useState(() =>
    initial.channel_id === null ? '' : String(initial.channel_id),
  );
  const [checkResult, setCheckResult] =
    useState<ManagerDeliveryChannelCheckResult | null>(null);

  const trimmed = channelId.trim();
  const parsedChannel = trimmed === '' ? null : Number(trimmed);
  const channelInvalid =
    trimmed !== '' && (!Number.isInteger(parsedChannel) || parsedChannel === 0);
  const looksPositive =
    !channelInvalid && parsedChannel !== null && parsedChannel > 0;
  const checkTarget = parsedChannel ?? initial.effective_channel_id;
  const usingFallback =
    initial.channel_id === null && initial.effective_channel_id !== null;

  const saveMutation = useMutation({
    mutationFn: () =>
      systemService.updateManagerDeliveryChannel({ channel_id: parsedChannel }),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated);
      toast.success('Manager zayavka guruhi saqlandi');
    },
    onError: () => toast.error('Saqlab bo‘lmadi'),
  });

  const checkMutation = useMutation({
    mutationFn: (chatId: number) =>
      systemService.checkManagerDeliveryChannel(chatId),
    onSuccess: (result) => {
      setCheckResult(result);
      if (result.ok) toast.success('Chat tayyor');
      else toast.error('Chat tayyor emas');
    },
    onError: () => toast.error('Tekshirib bo‘lmadi'),
  });

  return (
    <div className="space-y-4">
      <label className="space-y-1">
        <span className={labelClass}>Manager guruhi ID</span>
        <input
          value={channelId}
          onChange={(event) => {
            setChannelId(event.target.value);
            setCheckResult(null);
          }}
          inputMode="numeric"
          placeholder="-1001234567890"
          className={inputClass}
        />
      </label>

      {channelInvalid && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">
          ID butun son bo‘lishi kerak.
        </p>
      )}

      {looksPositive && (
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-300">
          Kanal va superguruh ID’si odatda manfiy bo‘ladi. Minus belgisi tushib
          qolmaganini tekshiring.
        </p>
      )}

      {usingFallback && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Hozir alohida manager guruhi sozlanmagan. UzPost uchun eski kanal
          ishlayapti ({initial.effective_channel_id}); boshqa delivery turlari
          ham o‘z eski kanallariga tushadi.
        </p>
      )}

      {initial.channel_id !== null && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          User zayavkalari eski kanallarda qoladi. Bu sozlama faqat manager
          sahifasidan yaratilgan zayavkalarga ta’sir qiladi.
        </p>
      )}

      {checkResult && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            checkResult.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200'
          }`}
        >
          {checkResult.detail}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saveMutation.isPending || channelInvalid}
          onClick={() => saveMutation.mutate()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Saqlash
        </button>

        <button
          type="button"
          disabled={
            checkMutation.isPending || channelInvalid || checkTarget === null
          }
          onClick={() => {
            if (checkTarget !== null) checkMutation.mutate(checkTarget);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-50 dark:border-white/10 dark:text-white"
        >
          {checkMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PlugZap className="h-4 w-4" />
          )}
          Tekshirish
        </button>
      </div>
    </div>
  );
}

export default function ManagerDeliveryChannelSection() {
  const {
    data: settings,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => systemService.getManagerDeliveryChannel(),
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/15">
          <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 dark:text-white">
            Manager zayavka guruhi
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Manager sahifasidan yaratilgan zayavkalar qaysi guruhga tushadi
          </p>
        </div>
        {settings && (
          <span className="ml-auto shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
            {settings.channel_id === null ? 'Fallback' : 'Alohida'}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
          <div className="h-10 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/20 dark:bg-rose-500/10">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            Sozlamalarni o‘qib bo‘lmadi.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 dark:border-white/10 dark:text-white"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {settings && !isLoading && (
        <ManagerDeliveryChannelForm initial={settings} />
      )}
    </div>
  );
}
