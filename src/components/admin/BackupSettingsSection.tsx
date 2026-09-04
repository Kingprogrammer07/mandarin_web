import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Database,
  Loader2,
  PlugZap,
  Save,
  X,
} from "lucide-react";

import {
  systemService,
  type BackupCheckResult,
  type BackupSettings,
} from "@/api/services/systemService";
import {
  NATIVE_OPTION_CLASS,
  NATIVE_SELECT_CLASS,
} from "@/components/ui/select-styles";

/**
 * Where the nightly database dump goes, and whether it runs.
 *
 * The backup itself is not new — it has been running all along and delivering
 * to the chat named by `BOT_DATABASE_BACKUP_CHANNEL_ID`. What was missing was
 * anywhere to see or change that: moving the channel meant editing `.env` on
 * the server and restarting, and a restart on this deployment discards every
 * Telegram update queued at that moment.
 *
 * The size row is not decoration. A bot cannot upload a document over 50 MB,
 * and this dump is already about half of it. Without the number on screen, the
 * day it crosses the line the backups stop and nothing says so.
 */

const QUERY_KEY = ["system-backup-settings"] as const;

const inputClass =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-[#111827] dark:text-white";
const labelClass =
  "text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatMoment(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The editable half, mounted once the server's values are known.
 *
 * Separate so its state can be seeded from `initial` at mount and then left
 * alone. Seeding inside an effect instead would re-run on every background
 * refetch and overwrite whatever the operator was halfway through typing.
 */
function BackupForm({ initial }: { initial: BackupSettings }) {
  const queryClient = useQueryClient();

  const [channelId, setChannelId] = useState(() =>
    initial.channel_id === null ? "" : String(initial.channel_id),
  );
  const [dailyEnabled, setDailyEnabled] = useState(initial.daily_enabled);
  const [hour, setHour] = useState(initial.hour);
  const [checkResult, setCheckResult] = useState<BackupCheckResult | null>(
    null,
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      systemService.updateBackupSettings({
        channel_id: parsedChannel,
        daily_enabled: dailyEnabled,
        hour,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated);
      toast.success("Backup sozlamalari saqlandi");
    },
    onError: () => toast.error("Saqlab bo‘lmadi"),
  });

  const checkMutation = useMutation({
    mutationFn: (chatId: number) => systemService.checkBackupChannel(chatId),
    onSuccess: (result) => {
      setCheckResult(result);
      if (result.ok) toast.success("Chat tayyor");
      else toast.error("Chat tayyor emas");
    },
    onError: () => toast.error("Tekshirib bo‘lmadi"),
  });

  const runMutation = useMutation({
    mutationFn: () => systemService.runBackupNow(),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      if (result.ok) {
        toast.success(
          result.size_bytes
            ? `Backup yuborildi — ${formatBytes(result.size_bytes)}`
            : "Backup yuborildi",
        );
      } else {
        toast.error(result.error ?? "Backup muvaffaqiyatsiz");
      }
    },
    onError: () => toast.error("Backup olib bo‘lmadi"),
  });

  const trimmed = channelId.trim();
  const parsedChannel = trimmed === "" ? null : Number(trimmed);
  const channelInvalid =
    trimmed !== "" && (!Number.isInteger(parsedChannel) || parsedChannel === 0);

  // Channels and supergroups are negative. A positive id here is almost always
  // a channel id pasted with the minus dropped, which saves cleanly and then
  // fails on every backup.
  const looksPositive =
    !channelInvalid && parsedChannel !== null && parsedChannel > 0;

  const effective = initial.effective_channel_id;
  const usingFallback = initial.channel_id === null && effective !== null;

  const sizeShare =
    initial.last_size != null && initial.size_limit > 0
      ? initial.last_size / initial.size_limit
      : null;

  const checkTarget = parsedChannel ?? effective;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kanal yoki guruh ID">
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
        </Field>

        <Field label="Backup soati (Toshkent)">
          <select
            value={hour}
            onChange={(event) => setHour(Number(event.target.value))}
            className={`w-full ${NATIVE_SELECT_CLASS}`}
          >
            {Array.from({ length: 24 }, (_, index) => (
              <option key={index} className={NATIVE_OPTION_CLASS} value={index}>
                {String(index).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </Field>
      </div>

      {channelInvalid && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">
          ID butun son bo‘lishi kerak.
        </p>
      )}

      {looksPositive && (
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-300">
          Kanal va superguruh ID’si manfiy bo‘ladi (masalan −100…). Minus
          belgisi tushib qolmaganini tekshiring.
        </p>
      )}

      {usingFallback && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Hozir server sozlamasidagi kanal ishlatilyapti ({effective}). Bu yerga
          ID yozsangiz, o‘shanisi ustun bo‘ladi.
        </p>
      )}

      <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 dark:border-white/10">
        <input
          type="checkbox"
          checked={dailyEnabled}
          onChange={(event) => setDailyEnabled(event.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span className="min-w-0">
          <span className="block text-sm font-bold text-gray-900 dark:text-white">
            Har kuni avtomatik olinsin
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            O‘chirilsa, faqat qo‘lda olinadi. Baza yagona nusxada qoladi —
            o‘chirishdan oldin o‘ylab ko‘ring.
          </span>
        </span>
      </label>

      {/* Last attempt. Shown even when it succeeded: "when did this last work"
          is the question asked in the moment it stops working. */}
      <div className="rounded-xl border border-gray-200 p-3 dark:border-white/10">
        <p className={labelClass}>Oxirgi backup</p>
        {initial.last_at === null ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Hali olinmagan.
          </p>
        ) : (
          <div className="mt-1 space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              {initial.last_ok ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <X className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <span className="font-bold text-gray-900 dark:text-white">
                {formatMoment(initial.last_at)}
              </span>
              {initial.last_size != null && (
                <span className="tabular-nums text-gray-500 dark:text-gray-400">
                  {formatBytes(initial.last_size)} /{" "}
                  {formatBytes(initial.size_limit)}
                </span>
              )}
            </p>
            {initial.last_error && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">
                {initial.last_error}
              </p>
            )}
            {sizeShare != null && sizeShare > 0.8 && (
              <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Dump Telegram chegarasiga yaqinlashdi. Chegaradan oshsa backup
                yuborilmay qoladi.
              </p>
            )}
          </div>
        )}
      </div>

      {checkResult && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            checkResult.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
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

        <button
          type="button"
          disabled={runMutation.isPending}
          onClick={() => runMutation.mutate()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-50 dark:border-white/10 dark:text-white"
        >
          {runMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-4 w-4" />
          )}
          Hozir backup olish
        </button>
      </div>

      {runMutation.isPending && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Dump olinyapti va yuborilyapti — bir necha daqiqa ketishi mumkin.
          Sahifani yopmang.
        </p>
      )}
    </div>
  );
}

export default function BackupSettingsSection() {
  const {
    data: settings,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => systemService.getBackupSettings(),
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5">
          <Database className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 dark:text-white">
            Baza zaxirasi
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Kunlik dump qaysi kanalga tushishi va qachon olinishi
          </p>
        </div>
        {settings && (
          <span
            className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${
              settings.daily_enabled
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/50"
            }`}
          >
            {settings.daily_enabled ? "Yoqilgan" : "O‘chiq"}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
          <div className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
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

      {settings && !isLoading && <BackupForm initial={settings} />}
    </div>
  );
}
