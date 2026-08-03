import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BellOff,
  CalendarClock,
  Eye,
  Loader2,
  Megaphone,
  RefreshCw,
  Send,
  SendHorizontal,
  Users,
} from 'lucide-react';
import {
  campaignService,
  type AudienceSource,
  type Campaign,
  type CampaignKind,
  type CampaignPreview,
  type NotificationChannel,
  type Segment,
} from '@/api/services/campaignService';
import CampaignMonitor, { StatCard } from '@/components/admin/CampaignMonitor';
import { NATIVE_OPTION_CLASS, NATIVE_SELECT_CLASS } from '@/components/ui/select-styles';
import { askConfirm } from '@/utils/askConfirm';
import { regions } from '@/lib/validation';
import { useTranslation } from 'react-i18next';

/**
 * Write a message and send it to a chosen group of clients.
 *
 * Distinct from the flight sender: that one reacts to an import and its
 * audience is decided by the data. Here a human decides both — a win-back
 * letter, a payment reminder, a news post — so the screen is built around
 * seeing *who* will receive it, and who deliberately will not, before anything
 * is sent.
 */

const PLACEHOLDERS = ['name', 'client_code', 'region', 'channel'] as const;

/**
 * Starting text for a consent campaign.
 *
 * Offered rather than imposed: the wording is the part staff will want to
 * adjust, but an empty box next to "attach the consent button" invites a
 * one-line message that explains nothing about what is being agreed to.
 */
const SMS_CONSENT_TEXT = `Assalomu alaykum, {name}!

Yukingiz haqidagi xabarlarni Telegramdan tashqari <b>SMS</b> orqali ham yuborishimiz mumkin — Telegramga kira olmagan paytingizda ham xabardor bo'lasiz.

Buning uchun quyidagi tugmani bosing. Istalgan vaqtda bekor qilishingiz mumkin.`;

const KIND_OPTIONS: Array<{ value: CampaignKind; label: string; hint: string }> = [
  {
    value: 'promotional',
    label: 'Yangilik / reklama',
    hint: '7 kunlik chek qo’llanadi va rad etganlarga ketmaydi',
  },
  {
    value: 'transactional',
    label: 'Xizmat xabari',
    hint: 'Har doim yetkaziladi — chek qo’llanmaydi. Faqat zarur bo’lsa.',
  },
];

export default function BroadcastComposer() {
  const { t } = useTranslation();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [source, setSource] = useState<AudienceSource>('segment');
  const [recipients, setRecipients] = useState('');
  const [segmentKey, setSegmentKey] = useState('');
  const [paramValue, setParamValue] = useState<string>('');
  const [channel, setChannel] = useState<NotificationChannel>('telegram');
  const [kind, setKind] = useState<CampaignKind>('promotional');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [testTarget, setTestTarget] = useState('');
  const [attachSmsOptIn, setAttachSmsOptIn] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);

  const {
    data: segments,
    isPending: segmentsLoading,
    isError: segmentsFailed,
    refetch: refetchSegments,
  } = useQuery({
    queryKey: ['notification-segments'],
    queryFn: () => campaignService.listSegments(),
  });

  const segment: Segment | undefined = segments?.find((s) => s.key === segmentKey);
  const params = segment?.param
    ? { [segment.param.name]: segment.param.kind === 'number' ? Number(paramValue) : paramValue }
    : {};
  const paramReady = !segment?.param || paramValue.trim().length > 0;

  // One spec drives the dry run and the real send, so the number the operator
  // approves is produced by exactly the request that later sends.
  const isManual = source === 'manual';
  const audienceSpec = isManual
    ? { source: 'manual' as const, recipients }
    : { source: 'segment' as const, segment: segmentKey, segment_params: params };
  const audienceLabel = isManual ? "Tanlangan mijozlar" : (segment?.label ?? segmentKey);
  const audienceReady = isManual ? recipients.trim().length > 0 : segmentKey.length > 0 && paramReady;

  // Stored with the inputs it was computed for, so any edit makes it stale by
  // derivation — there is no window in which an old count could be sent.
  const [previewState, setPreviewState] = useState<{
    signature: string;
    data: CampaignPreview;
  } | null>(null);

  const signature = JSON.stringify({ audienceSpec, channel, kind, body });
  const preview = previewState?.signature === signature ? previewState.data : null;

  const previewMutation = useMutation({
    mutationFn: () =>
      campaignService.preview({
        ...audienceSpec,
        channel,
        kind,
        template_key: null,
        custom_body: body,
      }),
    onSuccess: (data) => setPreviewState({ signature, data }),
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      toast.error(message || "Ko'rib chiqishda xatolik");
    },
  });

  // Follows the selected channel: a test that always went to Telegram would
  // "pass" for a broadcast that is about to go out as SMS.
  const testMutation = useMutation({
    mutationFn: () =>
      campaignService.testSend({
        channel,
        body: preview?.sample_message || body,
        target: testTarget.trim(),
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error || 'Sinov xabari yetib bormadi');
        return;
      }
      const where =
        result.channel === 'sms'
          ? result.resolved_phone
          : result.resolved_telegram_id
            ? `ID ${result.resolved_telegram_id}`
            : null;
      toast.success(
        `Sinov ${result.channel === 'sms' ? 'SMS' : 'Telegram'} yuborildi${where ? ` → ${where}` : ''}`,
      );
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      toast.error(message || "Sinov xabarini yuborib bo'lmadi");
    },
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      campaignService.createCampaign({
        ...audienceSpec,
        channel,
        kind,
        template_key: null,
        custom_body: body,
        title: title.trim() || audienceLabel,
        // The backend rejects an attachment on SMS rather than dropping it, so
        // only offer it where it can actually be delivered.
        attach: channel === 'telegram' && attachSmsOptIn ? 'sms_opt_in' : null,
      }),
    onSuccess: (campaign) => {
      setActiveCampaign(campaign);
      setPreviewState(null);
      toast.success(`Yuborish boshlandi — ${campaign.total} ta mijoz`);
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      toast.error(message || "Yuborishni boshlab bo'lmadi");
    },
  });

  const insertPlaceholder = (name: string) => {
    const textarea = bodyRef.current;
    const token = `{${name}}`;
    if (!textarea) {
      setBody(body + token);
      return;
    }
    const start = textarea.selectionStart ?? body.length;
    const end = textarea.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const handleSend = async () => {
    if (!preview) return;
    const confirmed = await askConfirm(
      `${preview.reachable} ta mijozga xabar yuborilsinmi? Yuborilganini qaytarib bo'lmaydi.`,
    );
    if (confirmed) sendMutation.mutate();
  };

  const canPreview =
    audienceReady && body.trim().length > 0 && !previewMutation.isPending;
  const smsUnavailable = channel === 'sms' && preview?.sms_provider === null;
  const nothingToSend = preview !== null && preview.reachable === 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
          <Megaphone className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-900 dark:text-white">
            Qo'lda xabar yuborish
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Sog'inch xati, eslatma, yangilik — kimga yuborishni o'zingiz tanlaysiz
          </p>
        </div>
      </div>

      {segmentsLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-gray-500 dark:text-white/45">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda…
        </div>
      ) : segmentsFailed || !segments ? (
        <div className="py-4">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">
            Auditoriyalarni yuklab bo'lmadi.
          </p>
          <button
            type="button"
            onClick={() => void refetchSegments()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 dark:border-white/10 dark:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Qayta urinish
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── 1. Kimga ── */}
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45">
              1. Kimga
            </p>

            <div className="flex gap-1.5">
              {(
                [
                  ['segment', 'Auditoriya bo‘yicha'],
                  ['manual', 'Aniq mijozlarga'],
                ] as Array<[AudienceSource, string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSource(value)}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-black transition-colors ${
                    source === value
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-white/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {isManual ? (
              <>
                <textarea
                  value={recipients}
                  onChange={(event) => setRecipients(event.target.value)}
                  rows={4}
                  placeholder={'SS1234, GG55\n+998901112233\n901112233'}
                  className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 font-mono text-[12px] dark:border-white/10 dark:bg-[#111827] dark:text-white"
                />
                <p className="text-xs font-medium text-gray-500 dark:text-white/45">
                  Mijoz kodi yoki telefon raqam — aralash bo'lsa ham bo'ladi.
                  Vergul, bo'sh joy yoki yangi qatordan ajrating. Topilmaganlari
                  ko'rib chiqishda alohida ko'rsatiladi.
                </p>
              </>
            ) : (
              <>
            <select
              value={segmentKey}
              onChange={(event) => {
                setSegmentKey(event.target.value);
                const next = segments.find((s) => s.key === event.target.value);
                setParamValue(next?.param?.default != null ? String(next.param.default) : '');
              }}
              className={`w-full ${NATIVE_SELECT_CLASS}`}
            >
              <option className={NATIVE_OPTION_CLASS} value="">
                Auditoriyani tanlang…
              </option>
              {segments.map((item) => (
                <option key={item.key} className={NATIVE_OPTION_CLASS} value={item.key}>
                  {item.label}
                  {item.count !== null ? ` — ${item.count} ta` : ''}
                </option>
              ))}
            </select>

            {segment && (
              <p className="text-xs font-medium text-gray-500 dark:text-white/45">
                {segment.description}
              </p>
            )}

            {segment?.param?.kind === 'number' && (
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-white/70">
                {segment.param.label}:
                <input
                  type="number"
                  min={1}
                  value={paramValue}
                  onChange={(event) => setParamValue(event.target.value)}
                  className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-white/10 dark:bg-[#111827] dark:text-white"
                />
              </label>
            )}
            {segment?.param?.kind === 'region' && (
              <select
                value={paramValue}
                onChange={(event) => setParamValue(event.target.value)}
                className={`w-full ${NATIVE_SELECT_CLASS}`}
              >
                <option className={NATIVE_OPTION_CLASS} value="">
                  Viloyatni tanlang…
                </option>
                {regions.map((region) => (
                  <option key={region.value} className={NATIVE_OPTION_CLASS} value={region.value}>
                    {t(region.label)}
                  </option>
                ))}
              </select>
            )}
              </>
            )}
          </div>

          {/* ── 2. Turi va kanal ── */}
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45">
              2. Turi va kanal
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as CampaignKind)}
                className={`flex-1 ${NATIVE_SELECT_CLASS}`}
              >
                {KIND_OPTIONS.map((option) => (
                  <option key={option.value} className={NATIVE_OPTION_CLASS} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={channel}
                onChange={(event) => setChannel(event.target.value as NotificationChannel)}
                className={NATIVE_SELECT_CLASS}
              >
                <option className={NATIVE_OPTION_CLASS} value="telegram">Telegram</option>
                <option className={NATIVE_OPTION_CLASS} value="sms">SMS</option>
              </select>
            </div>
            <p className="text-xs font-medium text-gray-500 dark:text-white/45">
              {KIND_OPTIONS.find((option) => option.value === kind)?.hint}
            </p>
            {kind === 'transactional' && (
              <p className="flex items-start gap-2 text-xs font-bold text-amber-600 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Xizmat xabari chastota chekini chetlab o'tadi. Reklama uchun
                ishlatmang — mijozlar botni bloklaydi.
              </p>
            )}
          </div>

          {/* ── 3. Matn ── */}
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45">
              3. Matn
            </p>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Nomi (faqat siz ko'rasiz, tarixda chiqadi)"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-[#111827] dark:text-white"
            />
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={6}
              placeholder="Assalomu alaykum, {name}! ..."
              className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-[13px] leading-relaxed dark:border-white/10 dark:bg-[#111827] dark:text-white"
            />
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => insertPlaceholder(name)}
                  className="rounded-lg bg-gray-100 px-2 py-1 font-mono text-[11px] font-bold text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-white/80"
                >
                  {`{${name}}`}
                </button>
              ))}
            </div>

            {/* Consent cannot be granted from the panel, only by the client.
                A button under the message is the difference between a request
                people act on and one they mean to get around to. */}
            {channel === 'telegram' && (
              <div className="space-y-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-400/10">
                <label className="flex items-start gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <input
                    type="checkbox"
                    checked={attachSmsOptIn}
                    onChange={(event) => setAttachSmsOptIn(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
                  />
                  <span>
                    Xabar ostiga «🔔 SMS xabarnomani yoqish» tugmasi qo'shilsin —
                    mijoz bir marta bosadi va rozilik yoziladi.
                  </span>
                </label>
                {attachSmsOptIn && !body.trim() && (
                  <button
                    type="button"
                    onClick={() => setBody(SMS_CONSENT_TEXT)}
                    className="rounded-lg border border-amber-300 px-2.5 py-1 text-[11px] font-black text-amber-900 dark:border-amber-400/40 dark:text-amber-200"
                  >
                    Tayyor matnni qo'yish
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => previewMutation.mutate()}
            disabled={!canPreview}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gray-900 text-sm font-black text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
          >
            {previewMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            Ko'rib chiqish
          </button>

          {/* ── 4. Natija ── */}
          {preview && (
            <div className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatCard label="Tanlandi" value={preview.total_clients} />
                <StatCard label="Yuboriladi" value={preview.reachable} tone="good" />
                <StatCard
                  label="Yetib bormaydi"
                  value={preview.unreachable}
                  tone={preview.unreachable > 0 ? 'warn' : 'neutral'}
                  hint="Telegramni ochmagan yoki SMS uchun raqami/roziligi yo'q"
                />
                <StatCard
                  label="Yubormaymiz"
                  value={preview.opted_out + preview.too_soon}
                  tone={preview.opted_out + preview.too_soon > 0 ? 'warn' : 'neutral'}
                />
              </div>

              {/* "0 yuboriladi" on its own is a dead end — name the cause and
                  what would fix it, since the remedies are different. */}
              {preview.unreachable_no_consent > 0 && (
                <p className="flex items-start gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <BellOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {preview.unreachable_no_consent} ta mijoz SMS xabarnomaga rozilik
                  bermagan. Mijoz botdagi «🔔 SMS xabarnoma» tugmasidan o'zi yoqadi —
                  rozilik bo'lmasa SMS yuborilmaydi.
                </p>
              )}
              {preview.unreachable_no_phone > 0 && (
                <p className="flex items-start gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {preview.unreachable_no_phone} ta mijozning telefon raqami bazada
                  yo'q.
                </p>
              )}
              {preview.unreachable_no_telegram > 0 && (
                <p className="flex items-start gap-2 text-xs font-semibold text-gray-600 dark:text-white/55">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {preview.unreachable_no_telegram} ta mijoz botni ochmagan — Telegram
                  orqali yetib bormaydi.
                </p>
              )}
              {preview.opted_out > 0 && (
                <p className="flex items-start gap-2 text-xs font-semibold text-gray-600 dark:text-white/55">
                  <BellOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {preview.opted_out} ta mijoz reklama xabarlarini rad etgan.
                </p>
              )}
              {preview.too_soon > 0 && (
                <p className="flex items-start gap-2 text-xs font-semibold text-gray-600 dark:text-white/55">
                  <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {preview.too_soon} ta mijoz oxirgi 7 kunda allaqachon xabar olgan —
                  ular bu safar chetda qoladi.
                </p>
              )}
              {preview.truncated && (
                <p className="flex items-start gap-2 text-xs font-bold text-amber-600 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Auditoriya juda katta — xavfsizlik chegarasigacha qisqartirildi.
                  Torroq segment tanlang.
                </p>
              )}
              {channel === 'sms' && preview.sms_daily_limit !== null && (
                <p className="flex items-start gap-2 text-xs font-bold text-gray-600 dark:text-white/55">
                  <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Bugungi SMS limiti: {preview.sms_daily_used ?? '?'} /{' '}
                  {preview.sms_daily_limit}
                  {preview.sms_segments
                    ? ` · har xabar ${preview.sms_segments} segment (${preview.sms_encoding})`
                    : ''}
                </p>
              )}
              {smsUnavailable && (
                <p className="flex items-start gap-2 text-xs font-bold text-red-600 dark:text-red-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  SMS provayder sozlanmagan — yuborib bo'lmaydi.
                </p>
              )}

              {preview.sample_message && (
                <div>
                  <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45">
                    Namuna — aynan shu ketadi
                  </p>
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-xs text-gray-800 dark:bg-white/5 dark:text-white/80">
                    {preview.sample_message}
                  </pre>
                </div>
              )}

              {/* Test send: cheap insurance against a typo reaching thousands. */}
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 p-2.5 dark:bg-sky-400/10">
                <span className="text-xs font-bold text-sky-800 dark:text-sky-200">
                  Avval o'zingizga {channel === 'sms' ? 'SMS' : 'Telegram'} yuboring:
                </span>
                <input
                  value={testTarget}
                  onChange={(event) => setTestTarget(event.target.value)}
                  placeholder="Telegram ID, telefon yoki mijoz kodi"
                  className="min-w-[13rem] flex-1 rounded-lg border border-sky-200 px-2 py-1 text-sm dark:border-sky-400/30 dark:bg-[#111827] dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => testMutation.mutate()}
                  disabled={!testTarget.trim() || testMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 px-2.5 py-1 text-xs font-black text-sky-800 disabled:opacity-50 dark:border-sky-400/30 dark:text-sky-200"
                >
                  {testMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <SendHorizontal className="h-3.5 w-3.5" />
                  )}
                  Sinov
                </button>
                <p className="w-full text-[11px] font-semibold text-sky-800/70 dark:text-sky-200/60">
                  Faqat admin akkauntiga ketadi
                  {channel === 'sms' ? ' — SMS shu akkauntning raqamiga' : ''}.
                  Mijozga yuborish uchun «Tanlangan mijozlar» auditoriyasidan
                  foydalaning.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={nothingToSend || smsUnavailable || sendMutation.isPending}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-sm font-black text-white disabled:opacity-50"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {smsUnavailable
                  ? 'SMS sozlanmagan'
                  : nothingToSend
                    ? 'Yuboriladigan mijoz yo‘q'
                    : `${preview.reachable} ta mijozga yuborish`}
              </button>
            </div>
          )}

          {activeCampaign && <CampaignMonitor campaignId={activeCampaign.id} />}
        </div>
      )}
    </div>
  );
}
