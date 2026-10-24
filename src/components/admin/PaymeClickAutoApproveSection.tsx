import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bot } from 'lucide-react';
import { toast } from 'sonner';

import {
  paymentCheckService,
  type PaymentCheckSettings,
  type PaymentCheckStats,
} from '@/api/services/paymentCheckService';
import { formatTashkentDateTime } from '@/lib/format';

/**
 * The switch for the bot's own approval of Payme / Click receipts, and what it
 * did with the receipts of the last week. The checks themselves live in the
 * backend; switching on only lets the bot act on receipts that pass them all.
 */

const QUERY_KEY = ['system-payment-check'] as const;

const ENABLE_CONFIRM =
  'Bot aniq summali Payme va Click cheklarini o‘zi tasdiqlaydi.\n\n' +
  'Har bir avto-tasdiq ostida «↩️ Bekor qilish» tugmasi bo‘ladi. Yoqasizmi?';

const STATS: { key: Exclude<keyof PaymentCheckStats, 'days'>; label: string; hint: string }[] =
  [
    { key: 'checked', label: 'Tekshirildi', hint: 'Bot ko‘rib chiqqan cheklar' },
    {
      key: 'would_approve',
      label: 'Tasdiqlanardi',
      hint: 'Hamma shartdan o‘tgan, lekin admin hal qilgan',
    },
    { key: 'bot_approved', label: 'Bot tasdiqladi', hint: 'Hozir ham kuchda' },
    { key: 'undone', label: 'Bekor qilindi', hint: 'Admin qaytarib olgan' },
  ];

function Panel({ data }: { data: PaymentCheckSettings }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (enabled: boolean) => paymentCheckService.setAutoApprove(enabled),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated);
      toast.success(
        updated.auto_approve ? 'Avto-tasdiq yoqildi' : 'Avto-tasdiq o‘chirildi',
      );
    },
    onError: () => toast.error('Saqlab bo‘lmadi'),
  });

  const on = data.auto_approve;
  const toggle = () => {
    if (!on && !window.confirm(ENABLE_CONFIRM)) return;
    mutation.mutate(!on);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-white/[0.03]">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {on ? 'Yoqilgan' : 'O‘chiq'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {on
              ? 'Shartlardan o‘tgan cheklarni bot o‘zi tasdiqlaydi'
              : 'Bot faqat chek ostiga nima qilishini yozadi, tasdiqni admin bosadi'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Payme / Click avto-tasdiqni yoqish/o‘chirish"
          onClick={toggle}
          disabled={mutation.isPending}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
            on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/20'
          } disabled:opacity-50`}
        >
          <span
            className={`mt-0.5 inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              on ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {!data.reader_active && (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Payme / Click o‘quvchi boti ishlamayapti: cheklar tekshirilmayapti,
            tugma hozir hech narsani o‘zgartirmaydi.
          </p>
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45">
          So‘nggi {data.stats.days} kun
        </p>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.key}
              className="rounded-xl border border-gray-200 px-3 py-2.5 dark:border-white/10"
            >
              <dt className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                {stat.label}
              </dt>
              <dd className="mt-0.5 text-xl font-black tabular-nums text-gray-900 dark:text-white">
                {data.stats[stat.key]}
              </dd>
              <dd className="text-[11px] leading-snug text-gray-400 dark:text-gray-500">
                {stat.hint}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="space-y-1 border-t border-gray-100 pt-3 text-[11px] text-gray-400 dark:border-white/5 dark:text-gray-500">
        <p>
          Faqat summasi reys qarziga to‘liq teng, bitta mos to‘lov topilgan va
          kassada hali yozilmagan cheklar tasdiqlanadi. Qolganini admin hal qiladi.
        </p>
        {data.updated_by && (
          <p>
            Oxirgi o‘zgartirish: {data.updated_by}
            {data.updated_at && ` · ${formatTashkentDateTime(data.updated_at)}`}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PaymeClickAutoApproveSection() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: paymentCheckService.get,
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/15">
          <Bot className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 dark:text-white">
            Payme / Click avto-tasdiq
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Guruhga kelgan to‘lov xabari bilan chekni solishtirib, aniq mos
            kelganini tasdiqlash
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
          <div className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/20 dark:bg-rose-500/10">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            Sozlamani o‘qib bo‘lmadi.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 text-xs font-bold text-rose-700 underline dark:text-rose-300"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {data && <Panel data={data} />}
    </div>
  );
}
