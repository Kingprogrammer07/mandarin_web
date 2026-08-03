import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Type,
} from 'lucide-react';
import {
  systemService,
  type MessageEmoji,
  type MessageEmojiUpdate,
} from '@/api/services/systemService';

/**
 * Premium custom emoji inside message text.
 *
 * The bot's strings keep their ordinary emoji; this map swaps them on the way
 * out, so nothing has to be rewritten and turning the feature off restores the
 * plain text exactly. Telegram's own `<tg-emoji>` syntax carries the fallback
 * character, so an old client still shows the plain emoji.
 *
 * Only private chats are decorated — Telegram does not allow custom emoji from
 * a bot in channels, and staff groups read better plain anyway.
 */

const QUERY_KEY = ['system-message-emoji'] as const;

type Row = { emoji: string; emoji_id: string };

function EmojiForm({ data }: { data: MessageEmoji }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(data.enabled);
  const [rows, setRows] = useState<Row[]>(() =>
    data.entries.map((e) => ({ emoji: e.emoji, emoji_id: e.emoji_id })),
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const mapping: Record<string, string> = {};
      for (const row of rows) {
        const emoji = row.emoji.trim();
        const id = row.emoji_id.trim();
        if (emoji && id) mapping[emoji] = id;
      }
      const body: MessageEmojiUpdate = { enabled, mapping };
      return systemService.updateMessageEmoji(body);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated);
      toast.success('Matn emojilari saqlandi');
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      toast.error(message || "Saqlab bo'lmadi");
    },
  });

  const invalid = rows.filter((r) => r.emoji_id.trim() && !/^\d+$/.test(r.emoji_id.trim()));
  const filled = rows.filter((r) => r.emoji.trim() && r.emoji_id.trim()).length;

  const update = (index: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

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
        {rows.length === 0 && (
          <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-xs font-semibold text-gray-500 dark:bg-white/5 dark:text-white/45">
            Hozircha bo'sh. Pastdagi tugma bilan qator qo'shing.
          </p>
        )}
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={row.emoji}
              onChange={(event) => update(index, { emoji: event.target.value })}
              placeholder="✅"
              className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center text-[15px] dark:border-white/10 dark:bg-[#111827] dark:text-white"
            />
            <input
              value={row.emoji_id}
              onChange={(event) =>
                update(index, { emoji_id: event.target.value.trim() })
              }
              inputMode="numeric"
              placeholder="Emoji ID"
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 font-mono text-[12px] dark:border-white/10 dark:bg-[#111827] dark:text-white"
            />
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              className="rounded-lg p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              aria-label="Qatorni o'chirish"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((current) => [...current, { emoji: '', emoji_id: '' }])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-black text-gray-700 dark:border-white/10 dark:text-white"
      >
        <Plus className="h-3.5 w-3.5" />
        Qator qo'shish
      </button>

      {invalid.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Emoji ID faqat raqamlardan iborat bo'ladi.
        </p>
      )}

      <p className="text-[11px] font-semibold leading-relaxed text-gray-500 dark:text-white/45">
        Xabar matnidagi oddiy emoji shu ro'yxat bo'yicha premium emojiga
        almashtiriladi — matnlarni qayta yozish shart emas. Hozir {filled} ta juft.
        ID ni olish uchun botga <b>/emoji</b> deb yozib, premium emoji yuboring.
        Kanallarga ketadigan xabarlar tegilmaydi (Telegram ruxsat bermaydi),
        eski ilovada esa oddiy emoji ko'rinadi.
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

export default function MessageEmojiSection() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => systemService.getMessageEmoji(),
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5">
          <Type className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-900 dark:text-white">
            Matndagi emojilar
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Xabar matnidagi emojilarni premium emojiga almashtirish
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
                Telegram bu emojilarni qabul qilmadi, shuning uchun avtomatik
                o'chirildi — xabarlar oddiy emoji bilan ketyapti. Odatda sabab:
                bot egasida Premium tugagan.
                {data.auto_disabled_reason ? ` (${data.auto_disabled_reason})` : ''}{' '}
                Sababni tuzatib, «Yoqilgan» holatida qayta saqlang.
              </span>
            </p>
          )}
          <EmojiForm key={data.updated_at ?? 'seed'} data={data} />
        </>
      )}
    </div>
  );
}
