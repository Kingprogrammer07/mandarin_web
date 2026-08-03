import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Eye, Loader2, Pencil, Send, Users } from 'lucide-react';
import {
  campaignService,
  type Campaign,
  type CampaignAudience,
  type CampaignPreview,
  type NotificationChannel,
} from '@/api/services/campaignService';
import { NATIVE_OPTION_CLASS, NATIVE_SELECT_CLASS } from '@/components/ui/select-styles';
import CampaignMonitor, { StatCard } from '@/components/admin/CampaignMonitor';

/**
 * Send cargo notifications for a flight, then watch the run.
 *
 * The operator always previews first: the dry run reports how many clients are
 * reachable, how many were already told about this event (a re-import must not
 * message them twice) and, for SMS, how many billable segments each message
 * costs. Only then does the send button appear.
 */

export default function CampaignSender({ defaultFlight = '' }: { defaultFlight?: string }) {
  const [flightName, setFlightName] = useState(defaultFlight);
  const [channel, setChannel] = useState<NotificationChannel>('telegram');
  const [audience, setAudience] = useState<CampaignAudience>('all');
  // The preview is stored with the inputs it was computed for, so editing the
  // flight or switching channel makes it stale by derivation — no effect, and
  // no window where an old audience count could be sent.
  const [previewState, setPreviewState] = useState<{
    flight: string;
    channel: NotificationChannel;
    audience: CampaignAudience;
    body: string;
    data: CampaignPreview;
  } | null>(null);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  // Empty means "use the stored template". Only a non-empty value is sent,
  // so the default path is untouched by this feature existing.
  const [customBody, setCustomBody] = useState('');
  const [editing, setEditing] = useState(false);

  const body = customBody.trim();
  const preview =
    previewState &&
    previewState.flight === flightName.trim() &&
    previewState.channel === channel &&
    previewState.audience === audience &&
    previewState.body === body
      ? previewState.data
      : null;

  const previewMutation = useMutation({
    mutationFn: () =>
      campaignService.preview({
        source: 'flight',
        flight_name: flightName.trim(),
        channel,
        template_key: 'cargo_in_china',
        custom_body: body || null,
        audience,
      }),
    onSuccess: (data) =>
      setPreviewState({ flight: flightName.trim(), channel, audience, body, data }),
    onError: () => toast.error("Ko'rib chiqishda xatolik"),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      campaignService.createCampaign({
        source: 'flight',
        flight_name: flightName.trim(),
        channel,
        template_key: 'cargo_in_china',
        custom_body: body || null,
        audience,
      }),
    onSuccess: (campaign) => {
      setActiveCampaign(campaign);
      setPreviewState(null);
      toast.success(`Yuborish boshlandi — ${campaign.total} ta mijoz`);
    },
    onError: () => toast.error("Yuborishni boshlab bo'lmadi"),
  });

  const canPreview = flightName.trim().length > 0 && !previewMutation.isPending;
  // Block the send when there is nobody to reach, or when SMS is selected on a
  // deployment with no provider — the server would reject it anyway, and the
  // operator should learn that before writing a campaign row.
  const smsUnavailable = channel === 'sms' && preview?.sms_provider === null;
  const nothingToSend = (preview !== null && preview.reachable === 0) || smsUnavailable;

  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
      <div>
        <h2 className="flex items-center gap-2 text-base font-black text-gray-900 dark:text-white">
          <Send className="h-4 w-4 text-orange-500" />
          Yuk xabarnomasi
        </h2>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-white/45">
          Reys bo'yicha mijozlarga "Xitoy omboriga keldi" xabarini yuboradi
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={flightName}
          onChange={(event) => setFlightName(event.target.value)}
          placeholder="Reys nomi (masalan: M240)"
          className="min-w-[200px] flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <select
          value={channel}
          onChange={(event) => setChannel(event.target.value as NotificationChannel)}
          className={NATIVE_SELECT_CLASS}
        >
          <option className={NATIVE_OPTION_CLASS} value="telegram">Telegram</option>
          <option className={NATIVE_OPTION_CLASS} value="sms">SMS</option>
        </select>
        <select
          value={audience}
          onChange={(event) => setAudience(event.target.value as CampaignAudience)}
          className={NATIVE_SELECT_CLASS}
          title="Kimga yuboriladi"
        >
          <option className={NATIVE_OPTION_CLASS} value="all">Hammaga</option>
          <option className={NATIVE_OPTION_CLASS} value="telegram_unreachable">
            Faqat Telegramga yetmaganlarga
          </option>
        </select>
        <button
          type="button"
          onClick={() => previewMutation.mutate()}
          disabled={!canPreview}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-black text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
        >
          {previewMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          Ko'rib chiqish
        </button>
      </div>

      {preview && (
        <div className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="Topildi" value={preview.total_clients} />
            <StatCard label="Yuboriladi" value={preview.reachable} tone="good" />
            <StatCard
              label="Allaqachon"
              value={preview.already_notified}
              tone={preview.already_notified > 0 ? 'warn' : 'neutral'}
            />
            <StatCard
              label="Yetib bormaydi"
              value={preview.unreachable}
              tone={preview.unreachable > 0 ? 'warn' : 'neutral'}
            />
          </div>

          {preview.already_notified > 0 && (
            <p className="flex items-start gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {preview.already_notified} ta mijozga bu xabar allaqachon yuborilgan — ular
              qayta olmaydi.
            </p>
          )}
          {preview.unreachable > 0 && (
            <p className="flex items-start gap-2 text-xs font-semibold text-gray-500 dark:text-white/45">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {preview.unreachable} ta mijozga bu kanal orqali yetib bo'lmaydi
              {channel === 'sms' ? ' (raqam yo‘q yoki rozilik bermagan).' : ' (botni ochmagan).'}
            </p>
          )}
          {preview.excluded_by_filter > 0 && (
            <p className="flex items-start gap-2 text-xs font-semibold text-gray-500 dark:text-white/45">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {preview.excluded_by_filter} ta mijozga bu kanal orqali yetish mumkin,
              lekin tanlangan auditoriyaga kirmagani uchun yuborilmaydi.
            </p>
          )}
          {channel === 'sms' && preview.sms_daily_limit !== null && (
            <p
              className={`flex items-start gap-2 text-xs font-bold ${
                preview.sms_daily_used !== null &&
                preview.sms_daily_used + preview.reachable > preview.sms_daily_limit
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-white/45'
              }`}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Bugungi SMS limiti: {preview.sms_daily_used ?? '?'} /{' '}
              {preview.sms_daily_limit}
              {preview.sms_daily_used !== null &&
                preview.sms_daily_used + preview.reachable > preview.sms_daily_limit &&
                ' — bu yuborish limitdan oshadi, oxirgilari yuborilmaydi.'}
            </p>
          )}
          {channel === 'sms' && preview.sms_provider === null && (
            <p className="flex items-start gap-2 text-xs font-bold text-red-600 dark:text-red-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              SMS provayder sozlanmagan (SMS_PROVIDER=none) — yuborib bo'lmaydi.
            </p>
          )}
          {/* Two very different facts, previously reported as one number: a
              Mandarin customer with no account is somebody's job, another
              company's code on a shared manifest is routine. */}
          {preview.unknown_count > 0 && (
            <p className="flex items-start gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <b>{preview.unknown_count} ta</b> Mandarin kodi ro'yxatdan
                o'tmagan — mijoz kodi bor, lekin bazada akkaunti yo'q. Ular
                xabar olmaydi.{' '}
                {preview.unknown_count > preview.unknown_codes.length && 'Birinchi 20 tasi: '}
                {preview.unknown_codes.join(', ')}
              </span>
            </p>
          )}
          {preview.foreign_count > 0 && (
            <p className="flex items-start gap-2 text-xs font-semibold text-gray-500 dark:text-white/45">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <b>{preview.foreign_count} ta</b> kod boshqa kargo firmalariga
                tegishli (UzTez, TPP, izi…) — bitta manifestda kelgan, bizning
                mijoz emas. Bu normal holat.{' '}
                {preview.foreign_count > preview.foreign_codes.length && 'Masalan: '}
                {preview.foreign_codes.slice(0, 8).join(', ')}
              </span>
            </p>
          )}

          {preview.sample_message && (
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45">
                  Namuna xabar
                  {preview.sms_segments
                    ? ` · ${preview.sms_segments} SMS (${preview.sms_encoding})`
                    : ''}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    // Seeded from the rendered sample so the operator edits real
                    // text rather than a template full of {placeholders} — the
                    // placeholders still work, they are just already filled in
                    // for one client here.
                    if (!editing) setCustomBody(customBody || preview.sample_message || '');
                    setEditing((current) => !current);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-black text-sky-700 hover:underline dark:text-sky-300"
                >
                  <Pencil className="h-3 w-3" />
                  {editing ? 'Namunaga qaytish' : "Matnni o'zgartirish"}
                </button>
              </div>

              {editing ? (
                <>
                  <textarea
                    value={customBody}
                    onChange={(event) => setCustomBody(event.target.value)}
                    rows={7}
                    className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-[13px] leading-relaxed dark:border-white/10 dark:bg-[#111827] dark:text-white"
                  />
                  <p className="mt-1 text-[11px] font-semibold text-gray-500 dark:text-white/45">
                    O'zgartirilgan matn shablon o'rniga ketadi. Joy egalari
                    ishlayveradi: <code>{'{flight}'}</code> <code>{'{track}'}</code>{' '}
                    <code>{'{item}'}</code> <code>{'{count}'}</code>{' '}
                    <code>{'{client_code}'}</code> <code>{'{name}'}</code>. Yuborishdan
                    oldin yana «Ko'rib chiqish» bosing.
                  </p>
                </>
              ) : (
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-xs text-gray-800 dark:bg-white/5 dark:text-white/80">
                  {preview.sample_message}
                </pre>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => sendMutation.mutate()}
            disabled={nothingToSend || sendMutation.isPending}
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
    </section>
  );
}
