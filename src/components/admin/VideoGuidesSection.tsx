import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  PlayCircle,
  RefreshCw,
  Save,
} from 'lucide-react';
import { systemService, type VideoGuides } from '@/api/services/systemService';

/**
 * Paste a Telegram post link per guide; the bot then offers it at that moment.
 *
 * A guide with no link is not an error state — videos are recorded one at a
 * time and the bot must look finished throughout, so an empty field simply
 * means the button never appears. That is why every guide is always listed:
 * the admin needs to see what *could* be filled in, not only what already is.
 *
 * Only `https://t.me/...` links are accepted, and the server enforces it too:
 * this value becomes a button shown to every customer.
 */

const GUIDES_QUERY_KEY = ['system-video-guides'] as const;

const TME_LINK = /^https:\/\/t\.me\/(c\/)?[A-Za-z0-9_+-]+(\/\d+)*\/?$/;

function GuidesForm({ data }: { data: VideoGuides }) {
  const queryClient = useQueryClient();
  const [links, setLinks] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.guides.map((guide) => [guide.key, guide.url])),
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const cleaned = Object.fromEntries(
        Object.entries(links).map(([key, value]) => [key, value.trim()]),
      );
      return systemService.updateVideoGuides(cleaned);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(GUIDES_QUERY_KEY, updated);
      toast.success('Video havolalar saqlandi');
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      toast.error(message || "Saqlab bo'lmadi");
    },
  });

  // Client-side check mirrors the server's, so a typo is caught before the
  // round trip. The server remains the authority.
  const invalid = data.guides
    .filter((guide) => {
      const value = (links[guide.key] ?? '').trim();
      return value.length > 0 && !TME_LINK.test(value);
    })
    .map((guide) => guide.label);

  const isDirty = data.guides.some(
    (guide) => (links[guide.key] ?? '').trim() !== guide.url,
  );
  const filled = data.guides.filter((guide) => (links[guide.key] ?? '').trim()).length;

  return (
    <div className="space-y-3">
      {data.guides.map((guide) => {
        const value = links[guide.key] ?? '';
        const isBad = value.trim().length > 0 && !TME_LINK.test(value.trim());
        return (
          <div key={guide.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-black text-gray-900 dark:text-white">
                {guide.label}
              </span>
              {guide.url && (
                <a
                  href={guide.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-sky-700 dark:text-sky-300"
                >
                  <ExternalLink className="h-3 w-3" />
                  Ochish
                </a>
              )}
            </div>
            <p className="text-[11px] font-semibold text-gray-500 dark:text-white/45">
              {guide.placement}
            </p>
            <input
              value={value}
              onChange={(event) =>
                setLinks((current) => ({ ...current, [guide.key]: event.target.value }))
              }
              placeholder="https://t.me/mandarin_cargo/3342"
              className={`w-full rounded-xl border px-3 py-2 font-mono text-[12px] dark:bg-[#111827] dark:text-white ${
                isBad
                  ? 'border-red-300 dark:border-red-500/40'
                  : 'border-gray-200 dark:border-white/10'
              }`}
            />
          </div>
        );
      })}

      {invalid.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Faqat Telegram havolasi qabul qilinadi (https://t.me/…):{' '}
          {invalid.join(', ')}
        </p>
      )}

      <p className="text-[11px] font-semibold text-gray-500 dark:text-white/45">
        Bo'sh qoldirilgan qo'llanma botda umuman ko'rinmaydi — buzilgan tugma
        chiqmaydi. Hozir {filled} / {data.guides.length} ta to'ldirilgan.
      </p>

      <button
        type="button"
        onClick={() => saveMutation.mutate()}
        disabled={!isDirty || invalid.length > 0 || saveMutation.isPending}
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

export default function VideoGuidesSection() {
  const {
    data,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: GUIDES_QUERY_KEY,
    queryFn: () => systemService.getVideoGuides(),
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5">
          <PlayCircle className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-900 dark:text-white">
            Video qo'llanmalar
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Kanalga joylagan videoning havolasini qo'ying — bot kerakli joyda
            ko'rsatadi
          </p>
        </div>
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 py-6 text-sm text-gray-500 dark:text-white/45">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda…
        </div>
      ) : isError || !data ? (
        <div className="py-4">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">
            Havolalarni yuklab bo'lmadi.
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
        /* Remounted when the server copy changes, so the form is seeded rather
           than synced by an effect. */
        <GuidesForm key={data.updated_at ?? 'seed'} data={data} />
      )}
    </div>
  );
}
