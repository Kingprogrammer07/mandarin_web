import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import {
  courierSettingsService,
  type CourierSettings,
  type CourierSettingsUpdate,
} from '@/api/services/courierService';
import { formatUzsAmount } from '@/lib/format';

import CourierAppReleases from './CourierAppReleases';

/**
 * «Yetkazish xizmati»: the courier delivery fee and how it may be paid.
 *
 * Cash and card are taken by the courier at the door; online goes through NBU
 * once the courier presses «Yetib keldim». With "ask the client" off the client
 * gets no payment question and the courier simply records cash or card.
 */

const QUERY_KEY = ['system-courier-settings'] as const;
/** NBU refuses less (backend `courier_payment.NBU_MIN_UZS`). */
const NBU_MIN_UZS = 1000;
const FEE_MAX = 1_000_000;

const inputClass =
  'w-full rounded-xl border border-gray-200 px-3 py-2 text-base tabular-nums dark:border-white/10 dark:bg-[#111827] dark:text-white';
const labelClass =
  'text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45';

function formatChangedAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Toggle({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  hint: string;
}) {
  return (
    <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-white/10">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-gray-900 dark:text-white">{title}</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-6 w-11 shrink-0 rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-emerald-500 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400 dark:bg-white/15 dark:peer-checked:bg-emerald-500"
      />
    </label>
  );
}

function CourierSettingsForm({ initial }: { initial: CourierSettings }) {
  const queryClient = useQueryClient();
  const [fee, setFee] = useState(() => String(initial.fee_uzs));
  const [askClient, setAskClient] = useState(initial.ask_client);
  const [cash, setCash] = useState(initial.cash_enabled);
  const [card, setCard] = useState(initial.card_enabled);
  const [online, setOnline] = useState(initial.online_enabled);

  const feeValue = fee.trim() === '' ? NaN : Number(fee);
  const feeInvalid = !Number.isInteger(feeValue) || feeValue < 0 || feeValue > FEE_MAX;
  const noMethod = !feeInvalid && feeValue > 0 && !cash && !card && !online;
  const onlineTooSmall = !feeInvalid && feeValue > 0 && online && feeValue < NBU_MIN_UZS;
  const blocked = feeInvalid || noMethod || onlineTooSmall;

  const save = useMutation({
    mutationFn: (body: CourierSettingsUpdate) => courierSettingsService.update(body),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated);
      toast.success('Kuryer sozlamalari saqlandi');
    },
    onError: (error: { message?: string }) => toast.error(error?.message || 'Saqlab bo‘lmadi'),
  });

  const changedAt = formatChangedAt(initial.updated_at);

  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className={labelClass}>Yetkazish narxi, so'm</span>
        <input
          value={fee}
          onChange={(event) => setFee(event.target.value.replace(/[^\d]/g, ''))}
          inputMode="numeric"
          placeholder="30000"
          className={inputClass}
        />
        {!feeInvalid && (
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            {feeValue === 0
              ? 'Bepul: mijozdan pul olinmaydi.'
              : `Mijoz ko‘radi: ${formatUzsAmount(feeValue)} so'm`}
          </span>
        )}
      </label>

      {feeInvalid && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">
          Narx 0 dan {formatUzsAmount(FEE_MAX)} so'mgacha butun son bo‘lsin.
        </p>
      )}

      <div className="space-y-2">
        <span className={labelClass}>To‘lov usullari</span>
        <Toggle
          checked={cash}
          onChange={setCash}
          title="Naqd"
          hint="Kuryer naqd pul oladi va «Yetkazdim»da belgilaydi"
        />
        <Toggle
          checked={card}
          onChange={setCard}
          title="Karta"
          hint="Kuryer terminal yoki o‘tkazma orqali oladi"
        />
        <Toggle
          checked={online}
          onChange={setOnline}
          title="Onlayn (NBU)"
          hint="Kuryer «Yetib keldim»ni bosgach, mijoz Mini App’da to‘laydi"
        />
      </div>

      <div className="space-y-2">
        <span className={labelClass}>Mijozdan so‘rash</span>
        <Toggle
          checked={askClient}
          onChange={setAskClient}
          title="«Yetib keldim»da to‘lov usulini so‘rash"
          hint={
            askClient
              ? 'Mijozga Telegram’da tugmalar boradi: naqd, karta, onlayn'
              : 'Mijozdan so‘ralmaydi, kuryer o‘zi naqd yoki karta oladi'
          }
        />
        {!askClient && online && (
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-300">
            So‘rash o‘chiq bo‘lsa, onlayn to‘lov mijozga taklif qilinmaydi.
          </p>
        )}
      </div>

      {noMethod && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">
          Kamida bitta to‘lov usulini yoqing.
        </p>
      )}
      {onlineTooSmall && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">
          Onlayn to‘lov uchun narx kamida {formatUzsAmount(NBU_MIN_UZS)} so'm bo‘lsin.
        </p>
      )}
      {!cash && !card && online && feeValue > 0 && (
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-300">
          Naqd va karta o‘chiq: mijoz onlayn to‘lamaguncha kuryer «Yetkazdim»ni bosa olmaydi.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={save.isPending || blocked}
          onClick={() =>
            save.mutate({
              fee_uzs: feeValue,
              ask_client: askClient,
              cash_enabled: cash,
              card_enabled: card,
              online_enabled: online,
            })
          }
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Saqlash
        </button>
        {changedAt && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Oxirgi o‘zgarish: {changedAt}
            {initial.updated_by ? ` · ${initial.updated_by}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

export default function CourierSettingsSection() {
  const { data: settings, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => courierSettingsService.get(),
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-500/15">
          <Bike className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 dark:text-white">Kuryer xizmati</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Mandarin kuryeri bilan yetkazish narxi va to‘lov usullari
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
          <div className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
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
            className="mt-2 min-h-[44px] rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 dark:border-white/10 dark:text-white"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {settings && !isLoading && (
        <CourierSettingsForm key={settings.updated_at ?? 'new'} initial={settings} />
      )}

      <CourierAppReleases />
    </div>
  );
}
