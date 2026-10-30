import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

import {
  cardTransferService,
  type CardTransferSettings,
} from '@/api/services/cardTransferService';
import { formatTashkentDateTime } from '@/lib/format';

/**
 * The switch for the bot's own booking of card transfers (CardXabar credits
 * that pay a «Kartaga o'tkazma» request), and what it did with the credits of
 * the last week. The checks live in the backend; switching on only lets the
 * bot book the credits that pass them all. Prod runs switched off first: it
 * goes on once every «would book» credit was confirmed by an admin for that
 * same request.
 */

const QUERY_KEY = ['system-card-transfer'] as const;

const ENABLE_CONFIRM =
  'Bot so‘rovdagi aniq summa 30 daqiqa ichida kelgan kartaga o‘tkazmalarni o‘zi qabul qiladi.\n\n' +
  'Har bir avto-tasdiq ostida «↩️ Bekor qilish» tugmasi bo‘ladi. Yoqasizmi?';

function Panel({ data }: { data: CardTransferSettings }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (enabled: boolean) => cardTransferService.setAutoApprove(enabled),
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

  const { stats } = data;
  const unconfirmed = stats.would - stats.would_confirmed;
  const tiles = [
    { label: 'Topildi', value: stats.found, hint: 'Aniq summa so‘rovga mos kelgan' },
    {
      label: 'Qabul qilardi',
      value: stats.would,
      hint: `Tugma o‘chiq edi; admin tasdiqlagani: ${stats.would_confirmed}`,
    },
    { label: 'Bot qabul qildi', value: stats.booked, hint: 'Hozir ham kuchda' },
    { label: 'Bekor qilindi', value: stats.undone, hint: 'Admin qaytarib olgan' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-white/[0.03]">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {on ? 'Yoqilgan' : 'O‘chiq'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {on
              ? 'Shartlardan o‘tgan o‘tkazmalarni bot o‘zi qabul qiladi'
              : 'Bot faqat guruhdagi xabar ostiga nima qilishini yozadi, tasdiqni admin bosadi'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Kartaga o‘tkazma avto-tasdiqni yoqish/o‘chirish"
          onClick={toggle}
          disabled={mutation.isPending}
          className="-my-2.5 -mr-1.5 inline-flex h-11 w-14 flex-shrink-0 items-center justify-center disabled:opacity-50"
        >
          {/* A 44 pt tap target around the 24 pt track. */}
          <span
            className={`inline-flex h-6 w-11 rounded-full transition-colors ${
              on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/20'
            }`}
          >
            <span
              className={`mt-0.5 inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                on ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </span>
        </button>
      </div>

      {!data.reader_active && (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            CardXabar o‘quvchisi 5 daqiqadan beri ishlamayapti: kirimlar ko‘rinmayapti,
            mijozlarga kartaga o‘tkazma taklif qilinmaydi.
          </p>
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45">
          So‘nggi {stats.days} kun
        </p>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-xl border border-gray-200 px-3 py-2.5 dark:border-white/10"
            >
              <dt className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                {tile.label}
              </dt>
              <dd className="mt-0.5 text-xl font-black tabular-nums text-gray-900 dark:text-white">
                {tile.value}
              </dd>
              <dd className="text-[11px] leading-snug text-gray-400 dark:text-gray-500">
                {tile.hint}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {!on && unconfirmed > 0 && (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Bot qabul qilardi degan {unconfirmed} ta o‘tkazmani admin shu so‘rovga
            tasdiqlamagan. Yoqishdan oldin ularni hisobotda tekshiring.
          </p>
        </div>
      )}

      {stats.reasons.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45">
            Adminga qolganlari
          </p>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-white/5 dark:border-white/10">
            {stats.reasons.map((reason) => (
              <li
                key={reason.code}
                className="flex items-baseline justify-between gap-3 px-3 py-2 text-xs"
              >
                <span className="min-w-0 text-gray-600 dark:text-gray-300">{reason.label}</span>
                <span className="shrink-0 font-bold tabular-nums text-gray-900 dark:text-white">
                  {reason.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1 border-t border-gray-100 pt-3 text-[11px] text-gray-400 dark:border-white/5 dark:text-gray-500">
        <p>
          Faqat so‘rovdagi kartaga, aniq summa, 30 daqiqa ichida kelgan va so‘rovdan beri
          reysi o‘zgarmagan o‘tkazmalar qabul qilinadi. Yaxlit, kam, kech va so‘rovsiz
          kirimlarni admin hal qiladi.
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

export default function CardTransferAutoApproveSection() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: cardTransferService.get,
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/15">
          <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 dark:text-white">
            Kartaga o‘tkazma avto-tasdiq
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            CardXabar kirimini mijoz so‘rovi bilan solishtirib, aniq mos kelganini qabul qilish
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
