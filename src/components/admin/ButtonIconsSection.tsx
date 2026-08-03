import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Loader2,
  Palette,
  Power,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';
import {
  systemService,
  type ButtonIcons,
  type ButtonIconsUpdate,
} from '@/api/services/systemService';
import { NATIVE_OPTION_CLASS, NATIVE_SELECT_CLASS } from '@/components/ui/select-styles';

/**
 * Premium custom emoji on the client home-menu buttons.
 *
 * Deliberately opt-in. The decoration needs the bot owner's Telegram Premium;
 * if that lapses, Telegram rejects the whole keyboard and every `/start` would
 * fail. The bot already retries without icons and switches them off by itself
 * when that happens — this screen is where you see that it did, and turn them
 * back on once the cause is fixed.
 */

const ICONS_QUERY_KEY = ['system-button-icons'] as const;

const STYLE_OPTIONS = [
  { value: '', label: 'Odatiy' },
  { value: 'primary', label: "Ko'k" },
  { value: 'success', label: 'Yashil' },
  { value: 'danger', label: 'Qizil' },
];

function IconsForm({ data }: { data: ButtonIcons }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(data.enabled);
  const [rows, setRows] = useState(() =>
    Object.fromEntries(
      data.buttons.map((b) => [b.key, { emoji_id: b.emoji_id, style: b.style }]),
    ),
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const body: ButtonIconsUpdate = { enabled, icons: rows };
      return systemService.updateButtonIcons(body);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(ICONS_QUERY_KEY, updated);
      toast.success('Tugma bezaklari saqlandi');
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      toast.error(message || "Saqlab bo'lmadi");
    },
  });

  const invalid = data.buttons.filter((b) => {
    const value = (rows[b.key]?.emoji_id ?? '').trim();
    return value.length > 0 && !/^\d+$/.test(value);
  });
  const filled = data.buttons.filter((b) => (rows[b.key]?.emoji_id ?? '').trim()).length;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setEnabled((current) => !current)}
        className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-black ${
          enabled
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
            : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/50'
        }`}
      >
        <Power className="h-4 w-4" />
        {enabled ? 'Yoqilgan' : "O'chirilgan"}
      </button>

      <div className="space-y-2">
        {data.buttons.map((button) => (
          <div key={button.key} className="flex flex-wrap items-center gap-2">
            <span className="min-w-[9.5rem] flex-1 text-[13px] font-bold text-gray-900 dark:text-white">
              {button.label}
            </span>
            <input
              value={rows[button.key]?.emoji_id ?? ''}
              onChange={(event) =>
                setRows((current) => ({
                  ...current,
                  [button.key]: {
                    ...current[button.key],
                    emoji_id: event.target.value.trim(),
                  },
                }))
              }
              inputMode="numeric"
              placeholder="Emoji ID"
              className="w-44 rounded-lg border border-gray-200 px-2 py-1 font-mono text-[12px] dark:border-white/10 dark:bg-[#111827] dark:text-white"
            />
            <select
              value={rows[button.key]?.style ?? ''}
              onChange={(event) =>
                setRows((current) => ({
                  ...current,
                  [button.key]: { ...current[button.key], style: event.target.value },
                }))
              }
              className={`w-28 ${NATIVE_SELECT_CLASS}`}
            >
              {STYLE_OPTIONS.map((option) => (
                <option key={option.value} className={NATIVE_OPTION_CLASS} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {invalid.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Emoji ID faqat raqamlardan iborat bo'ladi:{' '}
          {invalid.map((b) => b.label).join(', ')}
        </p>
      )}

      <p className="text-[11px] font-semibold leading-relaxed text-gray-500 dark:text-white/45">
        ID ni olish uchun botga <b>/emoji</b> deb yozing va ortidan premium
        emojini yuboring — bot ID sini qaytaradi. Hozir {filled} / {data.buttons.length} ta
        to'ldirilgan. Bo'sh qoldirilgan tugma odatdagidek ko'rinadi.
      </p>

      <button
        type="button"
        onClick={() => saveMutation.mutate()}
        disabled={invalid.length > 0 || saveMutation.isPending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-sm font-black text-white disabled:opacity-50"
      >
        {saveMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Saqlash
      </button>
    </div>
  );
}

export default function ButtonIconsSection() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ICONS_QUERY_KEY,
    queryFn: () => systemService.getButtonIcons(),
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5">
          <Palette className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-900 dark:text-white">
            Tugma bezaklari
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Mijoz menyusidagi tugmalarga premium emoji va rang
          </p>
        </div>
        {data?.enabled && !data.auto_disabled && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Sparkles className="h-3 w-3" />
            Yoqilgan
          </span>
        )}
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 py-6 text-sm text-gray-500 dark:text-white/45">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda…
        </div>
      ) : isError || !data ? (
        <div className="py-4">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">
            Sozlamalarni yuklab bo'lmadi.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 dark:border-white/10 dark:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Qayta urinish
          </button>
        </div>
      ) : (
        <>
          {data.auto_disabled && (
            <p className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Telegram bezakni qabul qilmadi, shuning uchun avtomatik
                o'chirildi — menyu oddiy ko'rinishda ishlayapti. Odatda sabab:
                bot egasida Premium tugagan yoki emoji ID noto'g'ri.
                {data.auto_disabled_reason ? ` (${data.auto_disabled_reason})` : ''}{' '}
                Sababni tuzatib, «Yoqilgan» holatida qayta saqlang.
              </span>
            </p>
          )}
          <IconsForm key={data.updated_at ?? 'seed'} data={data} />
        </>
      )}
    </div>
  );
}
