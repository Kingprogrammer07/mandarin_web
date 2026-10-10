import { Fragment, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Eye, Loader2, Save, Send } from 'lucide-react';
import { toast } from 'sonner';

import {
  dailyReportService,
  type DailyReportDeliveryResult,
  type DailyReportPreview,
  type DailyReportSettings,
} from '@/api/services/dailyReportService';
import { parseTelegramRichHtml, type RichNode } from '@/lib/telegramHtml';

/**
 * Daily warehouse-vs-cashier report: on/off, time, and which super-admins get
 * it. The report itself is built and sent by the backend; this card only
 * configures it, shows what it would say right now, and can send it once to
 * try the settings out.
 */

const QUERY_KEY = ['system-daily-report'] as const;

const labelClass =
  'text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45';

function formatSentAt(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DeliverySummary({ result }: { result: DailyReportDeliveryResult }) {
  return (
    <div className="space-y-1 text-xs">
      <p className="font-semibold text-gray-700 dark:text-gray-200">
        {result.delivered.length} ta yetdi
        {result.failed.length > 0 && `, ${result.failed.length} ta yetmadi`}
      </p>
      {result.rich_error && (
        <p className="text-amber-700 dark:text-amber-300">
          Telegram jadvalli formatni qabul qilmadi, oddiy matn yuborildi:{' '}
          {result.rich_error}
        </p>
      )}
      {result.failed.map((entry) => (
        <p key={entry.admin_id} className="text-rose-600 dark:text-rose-300">
          {entry.username}: {entry.reason ?? 'noma’lum sabab'}
        </p>
      ))}
    </div>
  );
}

/** Tailwind for each tag the report uses; the rest render as plain wrappers. */
const RICH_CLASSES: Partial<Record<string, string>> = {
  h1: 'text-lg font-black',
  h2: 'text-lg font-black',
  h3: 'text-base font-black',
  h4: 'mt-4 mb-1 text-sm font-black',
  h5: 'mt-3 text-sm font-bold',
  h6: 'mt-3 text-sm font-bold',
  p: 'my-1',
  b: 'font-bold',
  strong: 'font-bold',
  i: 'italic',
  em: 'italic',
  u: 'underline',
  s: 'line-through',
  code: 'font-mono',
  pre: 'my-2 whitespace-pre-wrap font-mono',
  blockquote: 'my-2 border-l-2 border-gray-300 pl-3 dark:border-white/20',
  ul: 'my-1 list-disc pl-5',
  ol: 'my-1 list-decimal pl-5',
  table: 'my-2 w-full border-collapse',
  caption: 'mb-1 text-left text-xs text-gray-500',
  tr: 'even:bg-gray-100/70 dark:even:bg-white/[0.04]',
  th: 'border border-gray-300 px-2 py-1 font-bold dark:border-white/15',
  td: 'border border-gray-300 px-2 py-1 dark:border-white/15',
  details: 'my-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10',
  summary: 'cursor-pointer font-bold',
  footer: 'mt-2 text-xs text-gray-500',
};

function renderRich(nodes: RichNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.kind === 'text') return <Fragment key={index}>{node.text}</Fragment>;
    const children = renderRich(node.children);
    const className = RICH_CLASSES[node.tag];
    switch (node.tag) {
      case 'br':
        return <br key={index} />;
      case 'hr':
        return <hr key={index} className="my-2 border-gray-200 dark:border-white/10" />;
      case 'table':
        return (
          <table key={index} className={className}>
            <tbody>{children}</tbody>
          </table>
        );
      case 'td':
      case 'th': {
        const Cell = node.tag;
        return (
          <Cell
            key={index}
            className={className}
            colSpan={node.colSpan}
            style={node.align ? { textAlign: node.align } : undefined}
          >
            {children}
          </Cell>
        );
      }
      default: {
        const Tag = node.tag;
        return (
          <Tag key={index} className={className}>
            {children}
          </Tag>
        );
      }
    }
  });
}

function ReportPreview({ preview }: { preview: DailyReportPreview }) {
  return (
    <div
      data-testid="daily-report-preview"
      className="max-h-[32rem] overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-[13px] leading-relaxed text-gray-800 dark:border-white/10 dark:bg-black/30 dark:text-gray-100"
    >
      {renderRich(parseTelegramRichHtml(preview.rich_html))}
    </div>
  );
}

function DailyReportForm({ initial }: { initial: DailyReportSettings }) {
  const queryClient = useQueryClient();
  const [sendTime, setSendTime] = useState(initial.send_time);
  const [selected, setSelected] = useState<number[]>(initial.recipient_admin_ids);
  const [preview, setPreview] = useState<DailyReportPreview | null>(null);
  const [sendResult, setSendResult] = useState<DailyReportDeliveryResult | null>(
    null,
  );

  const savedIds = [...initial.recipient_admin_ids].sort((a, b) => a - b);
  const selectedIds = [...selected].sort((a, b) => a - b);
  const dirty =
    sendTime !== initial.send_time ||
    savedIds.join(',') !== selectedIds.join(',');

  const saveMutation = useMutation({
    mutationFn: dailyReportService.update,
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated);
      toast.success('Kunlik hisobot sozlamalari saqlandi');
    },
    onError: () => toast.error('Saqlab bo‘lmadi'),
  });

  const previewMutation = useMutation({
    mutationFn: () => dailyReportService.preview(),
    onSuccess: setPreview,
    onError: () => toast.error('Namunani olib bo‘lmadi'),
  });

  const sendMutation = useMutation({
    mutationFn: () => dailyReportService.sendNow(selected),
    onSuccess: (result) => {
      setSendResult(result);
      if (result.failed.length === 0) toast.success('Hisobot yuborildi');
      else if (result.delivered.length > 0) toast.warning('Hammaga yetmadi');
      else toast.error('Hech kimga yetmadi');
    },
    onError: () => toast.error('Yuborib bo‘lmadi'),
  });

  const toggle = (adminId: number) =>
    setSelected((current) =>
      current.includes(adminId)
        ? current.filter((id) => id !== adminId)
        : [...current, adminId],
    );

  const canEnable = initial.recipient_admin_ids.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-white/[0.03]">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {initial.enabled ? 'Yoqilgan' : 'O‘chiq'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {initial.enabled
              ? `Har kuni ${initial.send_time} da (Toshkent vaqti) yuboriladi`
              : canEnable
                ? 'Yoqilsa, har kuni belgilangan vaqtda yuboriladi'
                : 'Yoqishdan oldin super-adminlarni tanlab saqlang'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={initial.enabled}
          aria-label="Kunlik hisobotni yoqish/o‘chirish"
          onClick={() => saveMutation.mutate({ enabled: !initial.enabled })}
          disabled={saveMutation.isPending || (!initial.enabled && !canEnable)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
            initial.enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/20'
          } disabled:opacity-50`}
        >
          <span
            className={`mt-0.5 inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              initial.enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <label className="block space-y-1">
        <span className={labelClass}>Yuborish vaqti (Toshkent)</span>
        <input
          type="time"
          value={sendTime}
          onChange={(event) => setSendTime(event.target.value)}
          className="w-32 rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-[#111827] dark:text-white"
        />
        <span className="block text-[11px] text-gray-400 dark:text-gray-500">
          Hisobot kun boshidan shu vaqtgacha bo‘lgan ishni oladi. Undan keyingi
          ish ertangi hisobotda alohida qatorda chiqadi.
        </span>
      </label>

      <fieldset className="space-y-2">
        <legend className={labelClass}>Kimga yuboriladi</legend>
        {initial.super_admins.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Faol super-admin topilmadi.
          </p>
        )}
        {initial.super_admins.map((admin) => (
          <label
            key={admin.admin_id}
            className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 dark:border-white/10"
          >
            <input
              type="checkbox"
              checked={selected.includes(admin.admin_id)}
              onChange={() => toggle(admin.admin_id)}
              className="h-4 w-4 accent-emerald-500"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
              {admin.username}
            </span>
            {!admin.can_receive && (
              <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                {admin.problem ?? 'Telegram yo‘q'}
              </span>
            )}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!dirty || saveMutation.isPending || !sendTime}
          onClick={() =>
            saveMutation.mutate({
              send_time: sendTime,
              recipient_admin_ids: selected,
            })
          }
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
          disabled={previewMutation.isPending}
          onClick={() => previewMutation.mutate()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-50 dark:border-white/10 dark:text-white"
        >
          {previewMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          Namuna
        </button>
        <button
          type="button"
          disabled={sendMutation.isPending || selected.length === 0}
          onClick={() => sendMutation.mutate()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          {sendMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Hozir yuborish
        </button>
      </div>

      {sendResult && <DeliverySummary result={sendResult} />}
      {preview && <ReportPreview preview={preview} />}

      <div className="space-y-1 border-t border-gray-100 pt-3 text-[11px] text-gray-400 dark:border-white/5 dark:text-gray-500">
        <p>
          Oxirgi avtomatik yuborish: {formatSentAt(initial.last_sent_at)}
        </p>
        {initial.last_result && <DeliverySummary result={initial.last_result} />}
        <p>
          Premium emojilar “Xabarlar → Xabar emojilari” bo‘limidagi ro‘yxatdan
          olinadi. Telegram rad etsa, hisobot oddiy emojilar bilan yetib boradi.
        </p>
      </div>
    </div>
  );
}

export default function DailyReportSection() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: dailyReportService.get,
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-500/15">
          <ClipboardList className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 dark:text-white">
            Kunlik ombor–kassa hisoboti
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ombordan chiqqan yuklar, kassa tushumi va ularning farqi
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
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
            onClick={() => refetch()}
            className="mt-2 text-xs font-bold text-rose-700 underline dark:text-rose-300"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {data && (
        <DailyReportForm
          key={`${data.enabled}-${data.send_time}-${data.recipient_admin_ids.join(',')}-${data.last_sent_at ?? ''}`}
          initial={data}
        />
      )}
    </div>
  );
}
