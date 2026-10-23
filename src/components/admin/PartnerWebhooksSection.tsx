import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  History,
  KeyRound,
  Loader2,
  Pencil,
  PlugZap,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Send,
  ShieldAlert,
  Truck,
  Webhook,
} from 'lucide-react';
import {
  partnerWebhookService,
  type DeliveryStatus,
  type PartnerWebhook,
  type PartnerWebhookDelivery,
  type PartnerWebhookTestResult,
} from '@/api/services/partnerWebhooks';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useConfirm } from '@/hooks/useConfirm';
import PartnerWebhookGuideDialog from './PartnerWebhookGuideDialog';

/**
 * Partner cargos whose clients' China-import rows are pushed to them.
 *
 * The backend sends only the rows an import adds, signs every request with the
 * partner's secret and retries for a day. The secret is shown exactly once —
 * here, in a dialog, after creating a partner or rotating its key.
 */

const QUERY_KEY = ['partner-webhooks'] as const;

const inputClass =
  'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-[#111827] dark:text-white';
const labelClass =
  'text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45';
const smallButton =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/[0.06]';

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function formatTime(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Colours that read on the courier app's light and dark map alike. */
const COURIER_COLORS = ['#2563EB', '#7C3AED', '#0D9488', '#DB2777', '#CA8A04', '#475569'];

function parsePrefixes(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
}

// ── Form ────────────────────────────────────────────────────────────────────

function PartnerForm({
  partner,
  onDone,
  onCreated,
}: {
  partner?: PartnerWebhook;
  onDone: () => void;
  onCreated: (name: string, secret: string) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(partner?.name ?? '');
  const [prefixes, setPrefixes] = useState(partner?.client_code_prefixes.join(', ') ?? '');
  const [url, setUrl] = useState(partner?.url ?? '');
  const [courier, setCourier] = useState(partner?.courier_enabled ?? false);
  const [color, setColor] = useState(partner?.color ?? COURIER_COLORS[0]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        client_code_prefixes: parsePrefixes(prefixes),
        url: url.trim(),
        courier_enabled: courier,
        color,
      };
      if (partner) {
        await partnerWebhookService.update(partner.id, body);
        return null;
      }
      return partnerWebhookService.create(body);
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      if (created) onCreated(created.name, created.secret);
      else toast.success('Saqlandi');
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error, "Saqlab bo'lmadi")),
  });

  const canSave = name.trim() && parsePrefixes(prefixes).length > 0 && url.trim();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) save.mutate();
      }}
      className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-white/10 dark:bg-white/[0.02]"
    >
      <p className="text-sm font-black text-gray-900 dark:text-white">
        {partner ? `«${partner.name}» ni tahrirlash` : 'Yangi hamkor'}
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <label className="space-y-1">
          <span className={labelClass}>Nomi</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={64}
            placeholder="U kargo"
            className={inputClass}
          />
        </label>
        <label className="space-y-1">
          <span className={labelClass}>Mijoz kodi prefikslari</span>
          <input
            value={prefixes}
            onChange={(event) => setPrefixes(event.target.value)}
            placeholder="U"
            className={`${inputClass} font-mono uppercase`}
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className={labelClass}>Webhook manzili (https)</span>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://api.hamkor.uz/webhooks/mandarin"
            className={`${inputClass} font-mono`}
          />
        </label>
      </div>
      <p className="text-xs text-gray-500 dark:text-white/45">
        Bir nechta prefiksni vergul bilan yozing. Prefiks bizning mijozlarimiz kodiga yoki boshqa
        hamkor prefiksiga mos kelsa, saqlanmaydi.
      </p>
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.02]">
        <label className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm font-bold text-gray-900 dark:text-white">Kuryer API</span>
            <span className="block text-xs text-gray-500 dark:text-white/45">
              Hamkor bizning kuryerga yetkazish zayavkasi yubora oladi. Holatlar shu webhook manziliga
              qaytadi.
            </span>
          </span>
          <Switch checked={courier} onCheckedChange={setCourier} aria-label="Kuryer API" />
        </label>
        <div className="space-y-1.5">
          <span className={labelClass}>Kuryer ilovasidagi rangi</span>
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Rang">
            {COURIER_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                role="radio"
                aria-checked={color === swatch}
                aria-label={swatch}
                onClick={() => setColor(swatch)}
                className={`h-7 w-7 rounded-full ring-offset-2 transition-shadow dark:ring-offset-[#111827] ${
                  color === swatch ? 'ring-2 ring-gray-900 dark:ring-white' : ''
                }`}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!canSave || save.isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Saqlash
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-xl px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 dark:text-white/60 dark:hover:bg-white/[0.06]"
        >
          Bekor qilish
        </button>
      </div>
    </form>
  );
}

// ── Secret, shown once ──────────────────────────────────────────────────────

function SecretDialog({
  secret,
  onClose,
}: {
  secret: { name: string; value: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog
      open={secret !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 text-base font-black">
            <KeyRound className="h-5 w-5 text-orange-500" />
            {secret?.name}: maxfiy kalit
          </DialogTitle>
          <DialogDescription className="text-xs">
            Kalit faqat hozir ko'rinadi, keyin uni qayta ko'rib bo'lmaydi. Hamkorga xavfsiz kanal
            orqali yuboring. Qo'llanma bilan bitta xabarda yubormang.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-stretch gap-2">
          <code className="min-w-0 flex-1 break-all rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-[13px] text-gray-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
            {secret?.value}
          </code>
          <button
            type="button"
            aria-label="Kalitni nusxalash"
            onClick={async () => {
              if (!secret) return;
              try {
                await navigator.clipboard.writeText(secret.value);
                setCopied(true);
              } catch {
                toast.error("Nusxalab bo'lmadi — kalitni qo'lda belgilang");
              }
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gray-900 px-3 text-xs font-black text-white dark:bg-white dark:text-gray-900"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Nusxalandi' : 'Nusxalash'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Delivery history ────────────────────────────────────────────────────────

const STATUS_LABEL: Record<DeliveryStatus, { text: string; className: string }> = {
  sent: {
    text: 'Yetkazildi',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  pending: {
    text: 'Navbatda',
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  },
  failed: {
    text: 'Xato',
    className: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  },
};

function DeliveryRow({ partnerId, row }: { partnerId: number; row: PartnerWebhookDelivery }) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const resend = row.status === 'sent';

  const send = useMutation({
    mutationFn: () =>
      resend
        ? partnerWebhookService.resendDelivery(partnerId, row.id)
        : partnerWebhookService.retryDelivery(partnerId, row.id),
    onSuccess: (answer) => {
      if (answer.ok) {
        setResult({
          ok: true,
          text: resend
            ? `Yangi yuborish sifatida yetkazildi (HTTP ${answer.status_code}).`
            : `Yetkazildi (HTTP ${answer.status_code}).`,
        });
      } else {
        const why = answer.error ?? "noma'lum xato";
        setResult({
          ok: false,
          text: resend
            ? `Yetib bormadi: ${why}. Yangi yuborish navbatga qo'yildi.`
            : `Yetib bormadi: ${why}. Navbatda qoldi, keyingi urinish ${formatTime(answer.delivery.next_attempt_at)}.`,
        });
      }
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error) => {
      setResult({ ok: false, text: errorMessage(error, "Yuborib bo'lmadi") });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const label = STATUS_LABEL[row.status];
  return (
    <div className="space-y-1.5 border-b border-gray-100 px-3 py-2 text-xs last:border-b-0 dark:border-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        {/* Wraps instead of truncating: a cut flight name reads as another flight. */}
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-gray-800 dark:text-white/85">
          <span className="font-mono tabular-nums text-gray-500 dark:text-white/45">
            {formatTime(row.created_at)}
          </span>
          <span className="break-words">
            {row.event === 'courier.status' ? (
              <b className="font-bold">Kuryer holati</b>
            ) : (
              <>
                <b className="font-bold">{row.flight_name ?? 'test'}</b>
                <span className="text-gray-500 dark:text-white/45"> · {row.item_count} qator</span>
              </>
            )}
            {row.attempts > 1 && (
              <span className="text-gray-500 dark:text-white/45"> · {row.attempts} urinish</span>
            )}
          </span>
        </p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${label.className}`}>
          {label.text}
        </span>
      </div>
      {row.status !== 'sent' && row.last_error && (
        <p className="text-[11px] text-red-600 dark:text-red-300">
          {row.last_error}
          {row.status === 'pending' && ` · keyingi urinish ${formatTime(row.next_attempt_at)}`}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          className={smallButton}
          onClick={() => send.mutate()}
          disabled={send.isPending}
        >
          {send.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : resend ? (
            <Send className="h-3.5 w-3.5" />
          ) : (
            <RotateCw className="h-3.5 w-3.5" />
          )}
          {resend ? 'Yana yuborish' : 'Takrorlash'}
        </button>
        {result && (
          <span
            role="status"
            className={`text-[11px] font-semibold ${
              result.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'
            }`}
          >
            {result.text}
          </span>
        )}
      </div>
    </div>
  );
}

function DeliveryHistory({ partnerId }: { partnerId: number }) {
  const query = useInfiniteQuery({
    queryKey: [...QUERY_KEY, partnerId, 'deliveries'],
    queryFn: ({ pageParam }) => partnerWebhookService.deliveries(partnerId, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.next_before_id,
  });
  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isPending) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-gray-500 dark:text-white/45">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Yuklanmoqda…
      </div>
    );
  }
  if (query.isError) {
    return <p className="py-3 text-xs font-semibold text-red-600">Tarixni yuklab bo'lmadi.</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="py-3 text-xs text-gray-500 dark:text-white/45">
        Hali hech narsa yuborilmagan. Xitoy importida shu hamkor mijozlari bo'lsa, shu yerda
        ko'rinadi.
      </p>
    );
  }
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
      {rows.map((row) => (
        <DeliveryRow key={row.id} partnerId={partnerId} row={row} />
      ))}
      {query.hasNextPage && (
        <button
          type="button"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="w-full py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:text-white/60 dark:hover:bg-white/[0.04]"
        >
          {query.isFetchingNextPage ? 'Yuklanmoqda…' : 'Yana'}
        </button>
      )}
    </div>
  );
}

// ── One partner ─────────────────────────────────────────────────────────────

function PartnerCard({
  partner,
  onEdit,
  onSecret,
}: {
  partner: PartnerWebhook;
  onEdit: () => void;
  onSecret: (name: string, secret: string) => void;
}) {
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirm();
  const [showHistory, setShowHistory] = useState(false);
  const [testResult, setTestResult] = useState<PartnerWebhookTestResult | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const toggle = useMutation({
    mutationFn: (active: boolean) => partnerWebhookService.update(partner.id, { is_active: active }),
    onSuccess: (updated) => {
      refresh();
      toast.success(updated.is_active ? 'Yuborish yoqildi' : "Yuborish to'xtatildi");
    },
    onError: (error) => toast.error(errorMessage(error, "O'zgartirib bo'lmadi")),
  });

  const test = useMutation({
    mutationFn: () => partnerWebhookService.test(partner.id),
    onSuccess: setTestResult,
    onError: (error) =>
      setTestResult({ ok: false, status_code: null, error: errorMessage(error, "Yuborib bo'lmadi") }),
  });

  const rotate = useMutation({
    mutationFn: () => partnerWebhookService.rotateSecret(partner.id),
    onSuccess: ({ secret }) => {
      refresh();
      onSecret(partner.name, secret);
    },
    onError: (error) => toast.error(errorMessage(error, "Kalitni yangilab bo'lmadi")),
  });

  const retry = useMutation({
    mutationFn: () => partnerWebhookService.retryFailed(partner.id),
    onSuccess: ({ requeued }) => {
      refresh();
      toast.success(`${requeued} ta yuborish qayta navbatga qo'yildi`);
    },
    onError: (error) => toast.error(errorMessage(error, "Qayta yuborib bo'lmadi")),
  });

  const handleRotate = async () => {
    const ok = await confirm({
      message: 'Maxfiy kalit yangilansinmi?',
      description:
        "Eski kalit shu zahoti ishlamay qoladi. Hamkor yangi kalitni o'rnatmaguncha uning serveri so'rovlarni rad etadi (ular 24 soat davomida qayta yuboriladi).",
      confirmLabel: 'Yangilash',
      variant: 'warning',
    });
    if (ok) rotate.mutate();
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
      <ConfirmDialog />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-gray-900 dark:text-white">{partner.name}</p>
            <span className="text-[11px] font-bold text-gray-400 dark:text-white/40">Prefiks:</span>
            {partner.client_code_prefixes.map((prefix) => (
              <span
                key={prefix}
                className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-gray-700 dark:bg-white/10 dark:text-white/80"
              >
                {prefix}
              </span>
            ))}
            {!partner.is_active && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-black text-gray-500 dark:bg-white/10 dark:text-white/50">
                To'xtatilgan
              </span>
            )}
            {partner.courier_enabled && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-black text-gray-700 dark:bg-white/10 dark:text-white/80">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: partner.color }} />
                Kuryer API · ID {partner.id}
              </span>
            )}
          </div>
          <p className="break-all font-mono text-xs text-gray-500 dark:text-white/45">
            {partner.url}
          </p>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-gray-600 dark:text-white/60">
            <span>Yetkazildi: <b className="text-gray-900 dark:text-white">{partner.sent_count}</b></span>
            <span className={partner.pending_count ? 'text-amber-700 dark:text-amber-300' : ''}>
              Navbatda: <b>{partner.pending_count}</b>
            </span>
            <span className={partner.failed_count ? 'text-red-600 dark:text-red-300' : ''}>
              Xato: <b>{partner.failed_count}</b>
            </span>
            <span>Oxirgi: {formatTime(partner.last_sent_at)}</span>
          </p>
          {partner.last_error && (partner.pending_count > 0 || partner.failed_count > 0) && (
            <p className="flex items-start gap-1.5 text-xs font-semibold text-red-600 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {partner.last_error}
            </p>
          )}
        </div>
        <Switch
          checked={partner.is_active}
          disabled={toggle.isPending}
          onCheckedChange={(checked) => toggle.mutate(checked)}
          aria-label={partner.is_active ? "Yuborishni to'xtatish" : 'Yuborishni yoqish'}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={smallButton} onClick={() => test.mutate()} disabled={test.isPending}>
          {test.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
          Test
        </button>
        <button type="button" className={smallButton} onClick={() => setShowHistory((open) => !open)}>
          <History className="h-3.5 w-3.5" />
          Tarix
        </button>
        <button type="button" className={smallButton} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          Tahrirlash
        </button>
        <button type="button" className={smallButton} onClick={() => void handleRotate()} disabled={rotate.isPending}>
          <KeyRound className="h-3.5 w-3.5" />
          Kalitni yangilash
        </button>
        {partner.failed_count > 0 && (
          <button
            type="button"
            className={`${smallButton} border-red-200 text-red-700 dark:border-red-400/30 dark:text-red-300`}
            onClick={() => retry.mutate()}
            disabled={retry.isPending}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Xatolarni qayta yuborish
          </button>
        )}
      </div>

      {testResult && (
        <p
          className={`mt-2 text-xs font-semibold ${
            testResult.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'
          }`}
        >
          {testResult.ok
            ? `Hamkor serveri qabul qildi (HTTP ${testResult.status_code}).`
            : `Yetib bormadi: ${testResult.error ?? "noma'lum xato"}`}
        </p>
      )}

      {showHistory && <DeliveryHistory partnerId={partner.id} />}
    </div>
  );
}

// ── Section ─────────────────────────────────────────────────────────────────

export default function PartnerWebhooksSection() {
  const [editing, setEditing] = useState<'new' | number | null>(null);
  const [secret, setSecret] = useState<{ name: string; value: string } | null>(null);
  const [guide, setGuide] = useState<'webhook' | 'courier' | null>(null);
  const { data: partners, isPending, isError, error, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => partnerWebhookService.list(),
    retry: (count, err) => errorStatus(err) !== 403 && count < 2,
  });

  const showSecret = (name: string, value: string) => setSecret({ name, value });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5">
          <Webhook className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-gray-900 dark:text-white">Hamkor kargolar</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Xitoy importidagi hamkor mijozlarining yangi qatorlari ularning serveriga avtomatik
            yuboriladi. Narxlar yuborilmaydi.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setGuide('webhook')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/[0.06]"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Qo'llanma
          </button>
          <button
            type="button"
            onClick={() => setGuide('courier')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/[0.06]"
          >
            <Truck className="h-3.5 w-3.5" />
            Kuryer API
          </button>
          {partners && editing !== 'new' && (
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-white hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Hamkor qo'shish
            </button>
          )}
        </div>
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 py-6 text-sm text-gray-500 dark:text-white/45">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda…
        </div>
      ) : isError ? (
        errorStatus(error) === 403 ? (
          <p className="flex items-center gap-2 py-4 text-sm font-semibold text-gray-600 dark:text-white/60">
            <ShieldAlert className="h-4 w-4" />
            Bu bo'lim faqat super-admin uchun.
          </p>
        ) : (
          <div className="py-4">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
              {errorMessage(error, "Ro'yxatni yuklab bo'lmadi.")}
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
        )
      ) : (
        <div className="space-y-3">
          {editing === 'new' && (
            <PartnerForm onDone={() => setEditing(null)} onCreated={showSecret} />
          )}
          {partners.length === 0 && editing !== 'new' && (
            <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-white/10 dark:text-white/45">
              Hali hamkor yo'q. Hamkor serverining HTTPS manzili va mijoz kodlari prefiksi bilan
              qo'shing, keyin «Qo'llanma» ni ularning dasturchisiga yuboring.
            </p>
          )}
          {partners.map((partner) =>
            editing === partner.id ? (
              <PartnerForm
                key={partner.id}
                partner={partner}
                onDone={() => setEditing(null)}
                onCreated={showSecret}
              />
            ) : (
              <PartnerCard
                key={partner.id}
                partner={partner}
                onEdit={() => setEditing(partner.id)}
                onSecret={showSecret}
              />
            ),
          )}
        </div>
      )}

      <SecretDialog secret={secret} onClose={() => setSecret(null)} />
      <PartnerWebhookGuideDialog
        open={guide !== null}
        onOpenChange={(open) => {
          if (!open) setGuide(null);
        }}
        guide={guide ?? 'webhook'}
      />
    </div>
  );
}
