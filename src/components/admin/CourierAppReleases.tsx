import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Smartphone, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { courierAppService, type CourierAppRelease } from '@/api/services/courierService';

/**
 * «Kuryer ilovasi»: publish a new courier app build without Play Market.
 *
 * The server reads the APK itself (package, version) and refuses another app
 * or a build that is not newer. Couriers get «Yangilash» on the next start.
 */

const QUERY_KEY = ['system-courier-app'] as const;

const labelClass =
  'text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45';

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function publishedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ReleaseRow({ release, current }: { release: CourierAppRelease; current: boolean }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900 tabular-nums dark:text-white">
            {release.version_name}
          </span>
          <span className="text-xs text-gray-500 tabular-nums dark:text-gray-400">
            build {release.build}
          </span>
          {current && (
            <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              Joriy
            </span>
          )}
        </span>
        {release.notes && (
          <span className="mt-0.5 block text-xs text-gray-600 dark:text-gray-300">{release.notes}</span>
        )}
      </span>
      <span className="shrink-0 text-right text-xs text-gray-500 tabular-nums dark:text-gray-400">
        {publishedAt(release.published_at)}
        <span className="block">{megabytes(release.size_bytes)}</span>
      </span>
    </li>
  );
}

export default function CourierAppReleases() {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState(0);

  const { data: releases, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => courierAppService.list(),
  });

  const upload = useMutation({
    mutationFn: (chosen: File) => courierAppService.upload(chosen, notes, setProgress),
    onSuccess: (release) => {
      toast.success(`${release.version_name} (build ${release.build}) chiqarildi`);
      setFile(null);
      setNotes('');
      if (input.current) input.current.value = '';
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error: { message?: string }) => toast.error(error?.message || 'Yuklab bo‘lmadi'),
    onSettled: () => setProgress(0),
  });

  const latest = releases?.[0];

  return (
    <div className="mt-6 border-t border-gray-100 pt-5 dark:border-white/10">
      <div className="mb-3 flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
        <p className="text-sm font-bold text-gray-900 dark:text-white">Kuryer ilovasi</p>
        {latest && (
          <span className="ml-auto text-xs text-gray-500 tabular-nums dark:text-gray-400">
            Joriy: {latest.version_name} · build {latest.build}
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Yangi APK yuklang: kuryer ilovani ochganda «Yangilash» chiqadi. Avval{' '}
        <code className="rounded bg-gray-100 px-1 dark:bg-white/10">pubspec.yaml</code> dagi
        versiyani oshiring, ilova doimiy kalit bilan imzolangan bo‘lsin.
      </p>

      <div className="space-y-3">
        <label className="block space-y-1">
          <span className={labelClass}>APK fayl</span>
          <input
            ref={input}
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-700 file:mr-3 file:min-h-[40px] file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:text-sm file:font-bold file:text-gray-800 dark:text-gray-200 dark:file:bg-white/10 dark:file:text-white"
          />
          {file && (
            <span className="block text-xs text-gray-500 tabular-nums dark:text-gray-400">
              {file.name} · {megabytes(file.size)}
            </span>
          )}
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>Nima o‘zgardi (ixtiyoriy)</span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value.slice(0, 500))}
            placeholder="Masalan: tema tanlash, xarita tezroq"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base dark:border-white/10 dark:bg-[#111827] dark:text-white"
          />
        </label>
        <button
          type="button"
          disabled={!file || upload.isPending}
          onClick={() => file && upload.mutate(file)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
        >
          {upload.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Yuklanmoqda… {progress}%
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Chiqarish
            </>
          )}
        </button>
      </div>

      <div className="mt-4">
        <span className={labelClass}>Oxirgi versiyalar</span>
        {isLoading && <div className="mt-2 h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />}
        {isError && !isLoading && (
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 min-h-[44px] rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 dark:border-white/10 dark:text-white"
          >
            Ro‘yxatni o‘qib bo‘lmadi · Qayta urinish
          </button>
        )}
        {releases && releases.length === 0 && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Hali versiya yuklanmagan.</p>
        )}
        {releases && releases.length > 0 && (
          <ul className="mt-1 divide-y divide-gray-100 dark:divide-white/10">
            {releases.map((release, index) => (
              <ReleaseRow key={release.build} release={release} current={index === 0} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
