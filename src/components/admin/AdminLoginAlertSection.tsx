import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, PlugZap, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import {
  systemService,
  type AdminLoginAlertCheckResult,
  type AdminLoginAlertSettings,
} from '@/api/services/systemService';

/**
 * Where the super-admin login notices go: "admin logged in from a new device"
 * and the warning after a 4th wrong PIN.
 *
 * They used to reach every super-admin as private messages, so each event
 * landed in several chats at once. With the group mode on each is posted once
 * to one group instead. The admin who logged in still gets their own personal
 * warning either way — that one is about their account, not a log.
 */

const QUERY_KEY = ['system-admin-login-alert'] as const;

// 16px on phones: a smaller input makes iOS zoom the page on focus.
const inputClass =
  'w-full rounded-xl border border-gray-200 px-3 py-2 text-base sm:text-sm dark:border-white/10 dark:bg-[#111827] dark:text-white';
const labelClass =
  'text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45';

function AdminLoginAlertForm({ initial }: { initial: AdminLoginAlertSettings }) {
  const queryClient = useQueryClient();
  const [chatId, setChatId] = useState(() =>
    initial.chat_id === null ? '' : String(initial.chat_id),
  );
  const [toGroup, setToGroup] = useState(initial.to_group);
  const [checkResult, setCheckResult] =
    useState<AdminLoginAlertCheckResult | null>(null);

  const trimmed = chatId.trim();
  const parsedChat = trimmed === '' ? null : Number(trimmed);
  const chatInvalid =
    trimmed !== '' && (!Number.isInteger(parsedChat) || parsedChat === 0);
  const looksPositive = !chatInvalid && parsedChat !== null && parsedChat > 0;
  const groupMissing = toGroup && parsedChat === null;

  const saveMutation = useMutation({
    mutationFn: () =>
      systemService.updateAdminLoginAlert({
        chat_id: parsedChat,
        to_group: toGroup,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated);
      toast.success('Admin kirish xabarlari sozlamasi saqlandi');
    },
    onError: () => toast.error('Saqlab bo‘lmadi'),
  });

  const checkMutation = useMutation({
    mutationFn: (target: number) =>
      systemService.checkAdminLoginAlertChat(target),
    onSuccess: (result) => {
      setCheckResult(result);
      if (result.ok) toast.success('Guruh tayyor');
      else toast.error('Guruh tayyor emas');
    },
    onError: () => toast.error('Tekshirib bo‘lmadi'),
  });

  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className={labelClass}>Guruh ID</span>
        <input
          value={chatId}
          onChange={(event) => {
            setChatId(event.target.value);
            setCheckResult(null);
          }}
          inputMode="numeric"
          placeholder="-1001234567890"
          className={inputClass}
        />
      </label>

      {chatInvalid && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">
          ID butun son bo‘lishi kerak.
        </p>
      )}

      {looksPositive && (
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-300">
          Guruh ID’si odatda manfiy bo‘ladi. Minus belgisi tushib qolmaganini
          tekshiring.
        </p>
      )}

      <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 dark:border-white/10">
        <input
          type="checkbox"
          checked={toGroup}
          onChange={(event) => setToGroup(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span className="min-w-0">
          <span className="block text-sm font-bold text-gray-900 dark:text-white">
            Guruhga yuborilsin
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            Yoqilsa, yangi qurilmadan kirish va 4 marta xato PIN xabarlari har
            bir super-adminga alohida emas, shu guruhga bir marta boradi. O‘chiq
            bo‘lsa, avvalgidek super-adminlarga shaxsan boradi.
          </span>
        </span>
      </label>

      {groupMissing && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">
          Guruhga yuborish uchun guruh ID kiriting.
        </p>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Kirgan adminning o‘ziga boradigan shaxsiy ogohlantirish o‘zgarmaydi.
        Guruh xabarni qabul qilmasa (masalan, bot guruhdan chiqarilgan bo‘lsa),
        xabar yo‘qolmaydi — super-adminlarga shaxsan yuboriladi.
      </p>

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
          disabled={saveMutation.isPending || chatInvalid || groupMissing}
          onClick={() => saveMutation.mutate()}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
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
          disabled={checkMutation.isPending || chatInvalid || parsedChat === null}
          onClick={() => {
            if (parsedChat !== null) checkMutation.mutate(parsedChat);
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-50 dark:border-white/10 dark:text-white"
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

export default function AdminLoginAlertSection() {
  const {
    data: settings,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => systemService.getAdminLoginAlert(),
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-500/15">
          <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 dark:text-white">
            Admin kirish xabarlari
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Yangi qurilmadan kirish va 4 marta xato PIN xabarlari qayerga boradi
          </p>
        </div>
        {settings && (
          <span
            className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${
              settings.to_group
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/50'
            }`}
          >
            {settings.to_group ? 'Guruhga' : 'Adminlarga'}
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

      {settings && !isLoading && <AdminLoginAlertForm initial={settings} />}
    </div>
  );
}
