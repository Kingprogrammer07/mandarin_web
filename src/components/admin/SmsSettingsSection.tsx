import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Check,
  KeyRound,
  Loader2,
  MessageSquare,
  PlugZap,
  RefreshCw,
  Save,
  Smartphone,
} from 'lucide-react';
import {
  systemService,
  type SmsCheckResult,
  type SmsSettings,
  type SmsSettingsUpdate,
} from '@/api/services/systemService';
import { NATIVE_OPTION_CLASS, NATIVE_SELECT_CLASS } from '@/components/ui/select-styles';

/**
 * SMS gateway configuration, editable without a redeploy.
 *
 * The person who needs to change this — swap the SIM phone, drop the daily
 * limit, switch SMS off during an incident — is the office owner, not whoever
 * can ship a container.
 *
 * The password is write-only by design: the API reports whether one is stored
 * but never returns it, so this form shows "saqlangan" and only sends a value
 * when the operator actually types a new one.
 */

const SETTINGS_QUERY_KEY = ['system-sms-settings'] as const;

const inputClass =
  'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-[#111827] dark:text-white';
const labelClass =
  'text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

/** Seeded per loaded row via `key`, so the form never fights the server copy. */
function SmsSettingsForm({ settings }: { settings: SmsSettings }) {
  const queryClient = useQueryClient();

  const [provider, setProvider] = useState(settings.provider);
  const [mode, setMode] = useState(settings.mode);
  const [baseUrl, setBaseUrl] = useState(settings.base_url);
  const [username, setUsername] = useState(settings.username);
  const [password, setPassword] = useState('');
  const [deviceId, setDeviceId] = useState(settings.device_id);
  const [simNumber, setSimNumber] = useState(
    settings.sim_number === null ? '' : String(settings.sim_number),
  );
  const [activeWithin, setActiveWithin] = useState(String(settings.active_within_hours));
  const [dailyLimit, setDailyLimit] = useState(String(settings.daily_limit));
  const [ttl, setTtl] = useState(String(settings.message_ttl_seconds));

  const saveMutation = useMutation({
    mutationFn: () => {
      const body: SmsSettingsUpdate = {
        provider,
        mode,
        base_url: baseUrl.trim(),
        username: username.trim(),
        device_id: deviceId.trim(),
        sim_number: simNumber === '' ? null : Number(simNumber),
        active_within_hours: Number(activeWithin),
        daily_limit: Number(dailyLimit),
        message_ttl_seconds: Number(ttl),
      };
      // Only send the password when one was typed — otherwise the stored value
      // stays, which is what "leave the field empty" has to mean.
      if (password) body.password = password;
      return systemService.updateSmsSettings(body);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, updated);
      setPassword('');
      toast.success('SMS sozlamalari saqlandi');
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      toast.error(message || "Saqlab bo'lmadi");
    },
  });

  // Deliberately its own action, not part of Saqlash: the operator needs to be
  // able to ask "is it working right now" without changing anything, and the
  // probe sends no SMS so it can be pressed as often as they like.
  const [checkResult, setCheckResult] = useState<SmsCheckResult | null>(null);
  const checkMutation = useMutation({
    mutationFn: () => systemService.checkSmsGateway(),
    onSuccess: (result) => {
      setCheckResult(result);
      if (result.ok) {
        toast.success(result.detail);
      } else {
        toast.error(result.detail);
      }
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      setCheckResult({ ok: false, detail: message || "Tekshirib bo'lmadi", devices: [] });
      toast.error(message || "Tekshirib bo'lmadi");
    },
  });

  const clearPasswordMutation = useMutation({
    mutationFn: () => systemService.updateSmsSettings({ clear_password: true }),
    onSuccess: (updated) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, updated);
      toast.success("Parol o'chirildi");
    },
    onError: () => toast.error("Parolni o'chirib bo'lmadi"),
  });

  const isOff = provider === 'none';

  // The two modes speak different paths, so a mode/URL mix-up 404s on every
  // send. Caught here because the server cannot tell a mistake from a private
  // deployment on an unusual host.
  const url = baseUrl.trim().toLowerCase();
  const looksCloudUrl = url.includes('api.sms-gate.app');
  const looksLocalUrl = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?/.test(url);
  const mismatch =
    mode === 'local' && looksCloudUrl
      ? "Rejim «Lokal», lekin manzil bulutli server — telefonning IP manzilini yozing (masalan http://192.168.1.8:8080)."
      : mode === 'cloud' && looksLocalUrl
        ? "Rejim «Bulutli», lekin manzil lokal IP — telefondagi server uchun «Lokal» rejimini tanlang."
        : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Provayder">
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as SmsSettings['provider'])}
            className={`w-full ${NATIVE_SELECT_CLASS}`}
          >
            <option className={NATIVE_OPTION_CLASS} value="none">
              O'chirilgan
            </option>
            <option className={NATIVE_OPTION_CLASS} value="smsgate">
              SMS Gate (Android telefon)
            </option>
          </select>
        </Field>

        <Field label="Server turi">
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as SmsSettings['mode'])}
            className={`w-full ${NATIVE_SELECT_CLASS}`}
          >
            <option className={NATIVE_OPTION_CLASS} value="cloud">
              Bulutli / o'z serveri
            </option>
            <option className={NATIVE_OPTION_CLASS} value="local">
              Lokal (telefonning o'zi)
            </option>
          </select>
        </Field>

        <Field label="Server manzili">
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder={
              mode === 'local' ? 'http://192.168.1.8:8080' : 'https://api.sms-gate.app'
            }
            className={inputClass}
          />
        </Field>

        <Field label="Login">
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="off"
            className={inputClass}
          />
        </Field>

        <Field label={settings.password_set ? 'Parol (saqlangan)' : 'Parol'}>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder={
              settings.password_set ? "O'zgartirmasangiz — bo'sh qoldiring" : 'Parol'
            }
            className={inputClass}
          />
        </Field>

        {/* Choosing between phones and asking "was any phone online lately"
            only mean something when a server fronts several devices. In local
            mode the device is the server, so both fields are hidden rather
            than shown as settings that quietly do nothing. */}
        {mode === 'cloud' && (
          <Field label="Qurilma ID (ixtiyoriy)">
            <input
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              placeholder="Bo'sh = istalgan telefon"
              className={inputClass}
            />
          </Field>
        )}

        <Field label="SIM slot (ixtiyoriy)">
          <input
            type="number"
            min={1}
            max={3}
            value={simNumber}
            onChange={(event) => setSimNumber(event.target.value)}
            placeholder="Bo'sh = telefon o'zi tanlaydi"
            className={inputClass}
          />
        </Field>

        {mode === 'cloud' && (
          <Field label="Telefon onlinelik oynasi (soat)">
            <input
              type="number"
              min={0}
              value={activeWithin}
              onChange={(event) => setActiveWithin(event.target.value)}
              className={inputClass}
            />
          </Field>
        )}

        <Field label="Kunlik limit">
          <input
            type="number"
            min={0}
            value={dailyLimit}
            onChange={(event) => setDailyLimit(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Xabar yaroqlilik muddati (soniya)">
          <input
            type="number"
            min={0}
            value={ttl}
            onChange={(event) => setTtl(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      {mismatch && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {mismatch}
        </p>
      )}

      <div className="space-y-1.5 text-[11px] font-semibold leading-relaxed text-gray-500 dark:text-white/45">
        {mode === 'local' ? (
          <p>
            <b>Lokal server:</b> telefondagi SMS Gate ilovasida <b>Local server</b>{' '}
            yoqilgan va pastdagi tugma <b>ONLINE</b> holatda bo'lishi shart. Manzil,
            login va parol o'sha ekranda yoziladi. Server bilan telefon bir xil
            Wi-Fi/tarmoqda bo'lishi kerak — internet orqali ishlamaydi.
          </p>
        ) : (
          <p>
            <b>Bulutli server:</b> ilovadagi <b>Cloud server</b> bo'limidagi login va
            parol. Manzil — <code>https://api.sms-gate.app</code>. Telefon internetga
            ulangan bo'lsa yetadi, bir tarmoqda bo'lish shart emas.
          </p>
        )}
        <p>
          <b>Onlinelik oynasi:</b> shu vaqt ichida telefon ko'rinmagan bo'lsa,
          shlyuz xabarni qabul qilmaydi. 0 — tekshiruvsiz, xabarlar o'chgan
          telefonga yig'ilib qoladi.
        </p>
        <p>
          <b>Kunlik limit:</b> qattiq chegara. 0 bo'lsa SMS umuman ketmaydi.
        </p>
        {Number(dailyLimit) === 0 && !isOff && (
          <p className="font-bold text-amber-600 dark:text-amber-300">
            Limit 0 — provayder yoqilgan bo'lsa ham hech qanday SMS yuborilmaydi.
          </p>
        )}
      </div>

      {checkResult && (
        <div
          className={`space-y-1 rounded-xl px-3 py-2 text-xs font-bold ${
            checkResult.ok
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
              : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
          }`}
        >
          <p className="flex items-start gap-2">
            {checkResult.ok ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            {checkResult.detail}
          </p>
          {checkResult.devices.map((device) => (
            <p key={device.id} className="pl-5 font-semibold opacity-80">
              📱 {device.name || device.id}
              {device.last_seen
                ? ` · oxirgi faollik: ${new Date(device.last_seen).toLocaleString('uz-UZ')}`
                : ''}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => checkMutation.mutate()}
          disabled={checkMutation.isPending || isOff}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-black text-gray-700 disabled:opacity-50 dark:border-white/10 dark:text-white"
        >
          {checkMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PlugZap className="h-3.5 w-3.5" />
          )}
          Aloqani tekshirish
        </button>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-black text-white disabled:opacity-50"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Saqlash
        </button>
        {settings.password_set && (
          <button
            type="button"
            onClick={() => clearPasswordMutation.mutate()}
            disabled={clearPasswordMutation.isPending}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-red-200 px-3 text-xs font-black text-red-600 disabled:opacity-50 dark:border-red-500/30 dark:text-red-400"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Parolni o'chirish
          </button>
        )}
      </div>

      {settings.updated_at && (
        <p className="text-[11px] font-semibold text-gray-400 dark:text-white/30">
          Oxirgi o'zgarish: {new Date(settings.updated_at).toLocaleString('uz-UZ')}
          {settings.updated_by ? ` · ${settings.updated_by}` : ''}
        </p>
      )}
    </div>
  );
}

export default function SmsSettingsSection() {
  const {
    data: settings,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => systemService.getSmsSettings(),
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5">
          <MessageSquare className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-900 dark:text-white">
            SMS shlyuzi
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Android telefon orqali SMS yuborish sozlamalari
          </p>
        </div>
        {settings && (
          <span
            className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${
              settings.provider === 'none'
                ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/50'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
            }`}
          >
            {settings.provider === 'none' ? (
              'O‘chiq'
            ) : (
              <>
                <Smartphone className="h-3 w-3" />
                Yoqilgan
              </>
            )}
          </span>
        )}
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 py-6 text-sm text-gray-500 dark:text-white/45">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda…
        </div>
      ) : isError || !settings ? (
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
          {settings.password_unreadable && (
            <p className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Saqlangan parolni o'qib bo'lmayapti (server maxfiy kaliti
              o'zgargan). Parolni qaytadan kiriting — busiz SMS ishlamaydi.
            </p>
          )}
          {settings.provider !== 'none' && settings.password_set && !settings.password_unreadable && (
            <p className="mb-3 flex items-start gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Sozlangan. Yuborishdan oldin "Qo'lda xabar yuborish" bo'limidan
              o'zingizga sinov yuboring.
            </p>
          )}
          <SmsSettingsForm key={settings.updated_at ?? 'seed'} settings={settings} />
        </>
      )}
    </div>
  );
}
