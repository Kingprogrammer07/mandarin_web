import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BarChart3,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  MessageSquareQuote,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Star,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  LANDING_LANGS,
  LINK_KEYS,
  METRIC_KEYS,
  landingAdminService,
  type LandingAdminData,
  type LandingLang,
  type LandingReviewItem,
  type LandingTier,
  type ReviewStatus,
  type LinkKey,
  type MetricKey,
} from '@/api/services/landingAdmin';
import {
  buildLinks,
  buildOverrides,
  buildTier,
  emptyTierForm,
  previewMetric,
  toLinksForm,
  toOverridesForm,
  toTierForm,
  type OverridesForm,
  type TierForm,
} from './landingForm';

const QUERY_KEY = ['admin-landing'];
const LANDING_URL = 'https://mandarincargo.uz';

const METRIC_META: Record<MetricKey, { label: string; hint: string }> = {
  clients: { label: 'Mijozlar', hint: "Barcha ro'yxatdan o'tganlar" },
  cargo_kg: { label: 'Yuk hajmi, kg', hint: 'Toshkentda tortilgan jami vazn' },
  flights: { label: 'Reyslar', hint: 'Yuk kelgan reyslar soni' },
  delivery_days_median: { label: 'Yetkazish, kun (median)', hint: 'Xitoy omboridan mijoz olib ketguncha' },
  delivery_days_p90: { label: 'Yetkazish, kun (90%)', hint: '10 yukdan 9 tasi shu muddatda' },
  years: { label: 'Faoliyat yili', hint: 'Asos solingan yildan hisoblanadi' },
  channel_subscribers: { label: 'Kanal obunachilari', hint: 'Telegram kanal, bot orqali' },
};

const LINK_LABELS: Record<LinkKey, string> = {
  bot_url: 'Telegram bot',
  channel_url: 'Telegram kanal',
  instagram_url: 'Instagram',
  facebook_url: 'Facebook',
};

const LANG_LABELS: Record<LandingLang, string> = { uz: "O'zb", ru: 'Рус', en: 'Eng', cn: '中文' };

const TABS = [
  { key: 'stats', label: 'Raqamlar', icon: BarChart3 },
  { key: 'tiers', label: 'Tariflar', icon: Tag },
  { key: 'reviews', label: 'Sharhlar', icon: MessageSquareQuote },
  { key: 'general', label: 'Havolalar', icon: Link2 },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-400 disabled:bg-gray-50 disabled:text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:disabled:bg-white/[0.02]';
const labelClass = 'mb-1 block text-xs font-bold text-gray-700 dark:text-white/70';
const cardClass =
  'rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]';
const primaryButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-black text-white disabled:opacity-60';
const ghostButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/5';

const numberFormat = new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 1 });
const formatNumber = (value: number | null | undefined) =>
  value == null ? '—' : numberFormat.format(value);

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const errorText = (error: unknown, fallback: string) =>
  (error as { message?: string })?.message || fallback;

/**
 * Plain checkboxes are invisible in this app (index.css sets `appearance: none`
 * on every input), so on/off settings use a switch button instead.
 */
function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-white/70"
    >
      <span
        className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-orange-500' : 'bg-gray-300 dark:bg-white/15'
        }`}
      >
        <span
          className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
      {label}
    </button>
  );
}

export default function AdminLandingPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: landingAdminService.get,
    staleTime: 60_000,
  });
  const [tab, setTab] = useState<TabKey>('stats');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className={`${cardClass} text-sm text-gray-600 dark:text-white/60`}>
        {errorText(error, "Ma'lumotni yuklab bo'lmadi")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PublishBar data={data} />

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 dark:bg-white/5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-1.5 py-2 text-xs font-bold sm:px-3 sm:text-sm transition-colors ${
              tab === key
                ? 'bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white'
                : 'text-gray-500 hover:text-gray-800 dark:text-white/50 dark:hover:text-white/80'
            }`}
          >
            <Icon className="hidden h-4 w-4 sm:block" />
            {label}
            {key === 'reviews' && data.reviews_pending > 0 && (
              <span className="rounded-full bg-orange-500 px-1.5 text-[11px] font-black leading-5 text-white">
                {data.reviews_pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'stats' && <StatsSection data={data} />}
      {tab === 'tiers' && <TiersSection data={data} />}
      {tab === 'reviews' && <ReviewsSection data={data} />}
      {tab === 'general' && <GeneralSection data={data} />}
    </div>
  );
}

// ─── Publish ─────────────────────────────────────────────────────────────────

function PublishBar({ data }: { data: LandingAdminData }) {
  const queryClient = useQueryClient();
  const publish = useMutation({
    mutationFn: landingAdminService.publish,
    onSuccess: ({ last_published_at }) => {
      queryClient.setQueryData<LandingAdminData>(QUERY_KEY, (prev) =>
        prev ? { ...prev, last_published_at } : prev,
      );
      toast.success('Sayt qayta yig\'ilmoqda, 1–3 daqiqada yangilanadi');
    },
    onError: (err) => toast.error(errorText(err, "Nashr qilib bo'lmadi")),
  });

  return (
    <section className={`${cardClass} flex flex-wrap items-center justify-between gap-4`}>
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-base font-black text-gray-900 dark:text-white">
          <Globe className="h-4 w-4 text-orange-500" />
          Landing sahifa
          <a
            href={LANDING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-orange-500"
          >
            mandarincargo.uz <ExternalLink className="h-3 w-3" />
          </a>
        </h1>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-white/45">
          O'zgarishlar saytga "Saytni yangilash" bosilgandan keyin chiqadi. Oxirgi nashr:{' '}
          <span className="font-semibold text-gray-700 dark:text-white/70">
            {formatDateTime(data.last_published_at)}
          </span>
        </p>
        {!data.publish_configured && (
          <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            Serverda API_LANDING_DEPLOY_HOOK_URL sozlanmagan — nashr tugmasi ishlamaydi.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => publish.mutate()}
        disabled={!data.publish_configured || publish.isPending}
        className={primaryButton}
      >
        {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
        Saytni yangilash
      </button>
    </section>
  );
}

// ─── Stats ───────────────────────────────────────────────────────────────────

function StatsSection({ data }: { data: LandingAdminData }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OverridesForm>(() => toOverridesForm(data));

  const refresh = useMutation({
    mutationFn: landingAdminService.refreshStats,
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated);
      toast.success('Raqamlar qayta hisoblandi');
    },
    onError: (err) => toast.error(errorText(err, "Hisoblab bo'lmadi")),
  });

  const save = useMutation({
    mutationFn: landingAdminService.updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated);
      setForm(toOverridesForm(updated));
      toast.success("Ko'rsatkichlar saqlandi");
    },
    onError: (err) => toast.error(errorText(err, "Saqlab bo'lmadi")),
  });

  const patch = (key: MetricKey, changes: Partial<OverridesForm[MetricKey]>) =>
    setForm((prev) => ({ ...prev, [key]: { ...prev[key], ...changes } }));

  const handleSave = () => {
    const result = buildOverrides(form);
    if (!result.ok) {
      toast.error(`${METRIC_META[result.key].label}: musbat son kiriting`);
      return;
    }
    save.mutate({ stat_overrides: result.overrides });
  };

  return (
    <section className={cardClass}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-black text-gray-900 dark:text-white">Ko'rsatkichlar</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-white/45">
            Bazadan hisoblanadi, 6 soatda bir yangilanadi. Hisoblangan:{' '}
            {formatDateTime(data.computed_at)}. Qiymat kiritsangiz, saytda o'sha chiqadi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className={ghostButton}
        >
          <RefreshCw className={`h-4 w-4 ${refresh.isPending ? 'animate-spin' : ''}`} />
          Qayta hisoblash
        </button>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {METRIC_KEYS.map((key) => {
          const row = form[key];
          const preview = previewMetric(data.computed[key], row);
          const isDelivery = key === 'delivery_days_median' || key === 'delivery_days_p90';
          return (
            <div key={key} className="grid gap-3 py-3 sm:grid-cols-[1fr_8rem_9rem_7rem] sm:items-center">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{METRIC_META[key].label}</p>
                <p className="text-xs text-gray-500 dark:text-white/45">
                  {METRIC_META[key].hint}
                  {isDelivery && data.delivery_sample_size > 0 && ` · ${data.delivery_sample_size} ta olib ketish, 90 kun`}
                </p>
              </div>
              <div className="text-xs text-gray-500 dark:text-white/45 sm:text-right">
                <span className="sm:hidden">Hisoblangan: </span>
                <span className="font-mono text-sm font-semibold text-gray-700 tabular-nums dark:text-white/70">
                  {formatNumber(data.computed[key])}
                </span>
              </div>
              <input
                className={inputClass}
                value={row.value}
                disabled={row.hidden}
                inputMode="decimal"
                placeholder="O'zgartirish"
                aria-label={`${METRIC_META[key].label}: qo'lda qiymat`}
                onChange={(e) => patch(key, { value: e.target.value })}
              />
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <Switch checked={!row.hidden} onChange={(on) => patch(key, { hidden: !on })} label="Ko'rinadi" />
              </div>
              <p className="text-xs text-gray-400 sm:col-span-4 dark:text-white/35">
                Saytda chiqadi:{' '}
                <span className="font-semibold text-gray-700 dark:text-white/70">
                  {preview == null ? 'ko\'rsatilmaydi' : formatNumber(preview)}
                </span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={handleSave} disabled={save.isPending} className={primaryButton}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Saqlash
        </button>
      </div>
    </section>
  );
}

// ─── Tiers ───────────────────────────────────────────────────────────────────

function TiersSection({ data }: { data: LandingAdminData }) {
  const [adding, setAdding] = useState(false);
  const nextOrder = data.tiers.reduce((max, tier) => Math.max(max, tier.sort_order + 1), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500 dark:text-white/45">
          Asosiy narx (bot sozlamalaridan): <span className="font-semibold text-gray-800 dark:text-white/80">
            {data.base_price_usd == null ? '—' : `$${data.base_price_usd}`}
          </span>{' '}
          / kg. "Asosiy narxga bog'langan" tarif shu narxni avtomatik oladi.
        </p>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={ghostButton}>
            <Plus className="h-4 w-4" /> Yangi tarif
          </button>
        )}
      </div>

      {adding && (
        <TierEditor
          initial={emptyTierForm(nextOrder)}
          basePrice={data.base_price_usd}
          onDone={() => setAdding(false)}
        />
      )}
      {data.tiers.map((tier) => (
        <TierEditor key={tier.id} tier={tier} initial={toTierForm(tier)} basePrice={data.base_price_usd} />
      ))}
      {!adding && data.tiers.length === 0 && (
        <p className={`${cardClass} text-sm text-gray-500`}>Tarif yo'q. Saytda tariflar bo'limi bo'sh chiqadi.</p>
      )}
    </div>
  );
}

function TierEditor({
  tier,
  initial,
  basePrice,
  onDone,
}: {
  tier?: LandingTier;
  initial: TierForm;
  basePrice: number | null;
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TierForm>(initial);
  const [lang, setLang] = useState<LandingLang>('uz');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const save = useMutation({
    mutationFn: (body: Parameters<typeof landingAdminService.createTier>[0]) =>
      tier ? landingAdminService.updateTier(tier.id, body) : landingAdminService.createTier(body),
    onSuccess: (saved) => {
      toast.success('Tarif saqlandi');
      if (tier) setForm(toTierForm(saved));
      invalidate();
      onDone?.();
    },
    onError: (err) => toast.error(errorText(err, "Saqlab bo'lmadi")),
  });

  const remove = useMutation({
    mutationFn: () => landingAdminService.deleteTier(tier!.id),
    onSuccess: () => {
      toast.success("Tarif o'chirildi");
      invalidate();
    },
    onError: (err) => toast.error(errorText(err, "O'chirib bo'lmadi")),
  });

  const setText = (field: 'name' | 'description' | 'badges', value: string) =>
    setForm((prev) => ({ ...prev, [field]: { ...prev[field], [lang]: value } }));

  const handleSave = () => {
    const result = buildTier(form);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    save.mutate(result.tier);
  };

  const handleDelete = () => {
    if (window.confirm(`"${form.name.uz || 'Tarif'}" o'chirilsinmi? Buni qaytarib bo'lmaydi.`)) {
      remove.mutate();
    }
  };

  return (
    <section className={`${cardClass} ${form.isActive ? '' : 'opacity-70'}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-black text-gray-900 dark:text-white">
          {tier ? form.name.uz || 'Nomsiz tarif' : 'Yangi tarif'}
          {form.isPopular && (
            <span className="ml-2 rounded-full bg-orange-50 px-2 py-0.5 align-middle text-[11px] font-black text-orange-600 dark:bg-orange-500/10 dark:text-orange-300">
              Mashhur
            </span>
          )}
        </h2>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-white/5" role="tablist" aria-label="Til">
          {LANDING_LANGS.map((code) => (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={lang === code}
              onClick={() => setLang(code)}
              className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                lang === code
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white'
                  : 'text-gray-500 dark:text-white/50'
              }`}
            >
              {LANG_LABELS[code]}
              {code !== 'uz' && !form.name[code].trim() && <span className="ml-0.5 text-amber-500">•</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Nomi{lang === 'uz' ? ' *' : ''}</label>
            <input
              className={inputClass}
              value={form.name[lang]}
              maxLength={80}
              onChange={(e) => setText('name', e.target.value)}
              placeholder={lang === 'uz' ? 'Standart' : ''}
            />
          </div>
          <div>
            <label className={labelClass}>Tavsif</label>
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={form.description[lang]}
              maxLength={600}
              onChange={(e) => setText('description', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Belgilar (har biri alohida qatorda, 6 tagacha)</label>
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={form.badges[lang]}
              onChange={(e) => setText('badges', e.target.value)}
              placeholder={'Sug\'urta\nTez yetkazish'}
            />
          </div>
        </div>

        <div className="space-y-3">
          <Switch
            checked={form.usesBasePrice}
            onChange={(on) => setForm((prev) => ({ ...prev, usesBasePrice: on }))}
            label="Asosiy narxga bog'lash"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Narx, $ / kg</label>
              <input
                className={inputClass}
                inputMode="decimal"
                disabled={form.usesBasePrice}
                value={form.usesBasePrice ? (basePrice ?? '').toString() : form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="11"
              />
            </div>
            <div>
              <label className={labelClass}>Eski narx (chizilgan)</label>
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.oldPrice}
                onChange={(e) => setForm((prev) => ({ ...prev, oldPrice: e.target.value }))}
                placeholder="—"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Tartib (kichigi oldinda)</label>
            <input
              className={`${inputClass} w-28`}
              inputMode="numeric"
              value={form.sortOrder}
              onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
            />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            <Switch
              checked={form.isPopular}
              onChange={(on) => setForm((prev) => ({ ...prev, isPopular: on }))}
              label="Mashhur deb belgilash"
            />
            <Switch
              checked={form.isActive}
              onChange={(on) => setForm((prev) => ({ ...prev, isActive: on }))}
              label="Saytda ko'rsatish"
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {tier ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={remove.isPending}
            className={`${ghostButton} text-red-600 dark:text-red-400`}
          >
            <Trash2 className="h-4 w-4" /> O'chirish
          </button>
        ) : (
          <button type="button" onClick={onDone} className={ghostButton}>
            Bekor qilish
          </button>
        )}
        <button type="button" onClick={handleSave} disabled={save.isPending} className={primaryButton}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Saqlash
        </button>
      </div>
    </section>
  );
}

// ─── Links and founding year ─────────────────────────────────────────────────

function GeneralSection({ data }: { data: LandingAdminData }) {
  const queryClient = useQueryClient();
  const [links, setLinks] = useState(() => toLinksForm(data));
  const [year, setYear] = useState(String(data.founded_year));

  const save = useMutation({
    mutationFn: landingAdminService.updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated);
      setLinks(toLinksForm(updated));
      setYear(String(updated.founded_year));
      toast.success('Saqlandi');
    },
    onError: (err) => toast.error(errorText(err, "Saqlab bo'lmadi")),
  });

  const handleSave = () => {
    const foundedYear = Number(year);
    if (!Number.isInteger(foundedYear) || foundedYear < 1990 || foundedYear > new Date().getFullYear()) {
      toast.error("Asos solingan yil noto'g'ri");
      return;
    }
    const result = buildLinks(links);
    if (!result.ok) {
      toast.error(`${LINK_LABELS[result.key]}: https:// bilan boshlanadigan to'liq havola kiriting`);
      return;
    }
    save.mutate({ founded_year: foundedYear, links: result.links });
  };

  return (
    <section className={cardClass}>
      <h2 className="text-base font-black text-gray-900 dark:text-white">Havolalar va asosiy ma'lumot</h2>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-white/45">
        Bo'sh qoldirilgan havola saytda ko'rsatilmaydi. Manzil va telefonlar "Sozlamalar → Ofis"dan olinadi.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className={labelClass}>Asos solingan yil</label>
          <input
            className={`${inputClass} w-28`}
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-white/35">
            "Faoliyat yili" ko'rsatkichi shundan hisoblanadi.
          </p>
        </div>
        {LINK_KEYS.map((key) => (
          <div key={key}>
            <label className={labelClass}>{LINK_LABELS[key]}</label>
            <input
              className={inputClass}
              value={links[key]}
              inputMode="url"
              placeholder="https://"
              onChange={(e) => setLinks((prev) => ({ ...prev, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={handleSave} disabled={save.isPending} className={primaryButton}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Saqlash
        </button>
      </div>
    </section>
  );
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

const REVIEW_FILTERS: { key: ReviewStatus | 'all'; label: string }[] = [
  { key: 'pending', label: 'Kutilmoqda' },
  { key: 'approved', label: 'Saytda' },
  { key: 'rejected', label: 'Rad etilgan' },
  { key: 'all', label: 'Barchasi' },
];

const STATUS_BADGE: Record<ReviewStatus, { label: string; className: string }> = {
  pending: {
    label: 'Kutilmoqda',
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  },
  approved: {
    label: 'Saytda',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  rejected: {
    label: 'Rad etilgan',
    className: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/60',
  },
};

const PAGE_SIZE = 30;

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${
            n <= rating ? 'fill-orange-400 text-orange-400' : 'text-gray-300 dark:text-white/20'
          }`}
        />
      ))}
    </span>
  );
}

function ReviewsSection({ data }: { data: LandingAdminData }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ReviewStatus | 'all'>('pending');
  const [withText, setWithText] = useState(true);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const params = { status: filter === 'all' ? undefined : filter, with_text: withText || undefined, limit };
  const { data: list, isLoading, isFetching } = useQuery({
    queryKey: [...QUERY_KEY, 'reviews', params],
    queryFn: () => landingAdminService.listReviews(params),
    placeholderData: (previous) => previous,
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => landingAdminService.updateSettings({ review_prompts_enabled: enabled }),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated);
      toast.success(updated.review_prompts_enabled ? "Bot sharh so'raydi" : "Bot sharh so'ramaydi");
    },
    onError: (err) => toast.error(errorText(err, "Saqlab bo'lmadi")),
  });

  return (
    <div className="space-y-4">
      <section className={`${cardClass} flex flex-wrap items-center justify-between gap-4`}>
        <div className="min-w-0">
          <p className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900 tabular-nums dark:text-white">
              {data.rating_average == null ? '—' : data.rating_average.toFixed(1)}
            </span>
            <Stars rating={Math.round(data.rating_average ?? 0)} />
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-white/45">
            {data.rating_count} ta baho. O'rtacha barcha baholardan olinadi; saytga faqat siz tasdiqlagan
            izohlar chiqadi.
          </p>
        </div>
        <div className="max-w-xs">
          <Switch
            checked={data.review_prompts_enabled}
            onChange={(on) => toggle.mutate(on)}
            label="Bot sharh so'rasin"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-white/35">
            Yuk olib ketilgandan 3 kun keyin, kunduzi, bir mijozga 60 kunda bir marta.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-white/5">
          {REVIEW_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFilter(key);
                setLimit(PAGE_SIZE);
              }}
              className={`whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-bold sm:px-2.5 ${
                filter === key
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white'
                  : 'text-gray-500 dark:text-white/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Switch checked={withText} onChange={setWithText} label="Faqat izohlilar" />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
        </div>
      ) : !list || list.items.length === 0 ? (
        <p className={`${cardClass} text-sm text-gray-500 dark:text-white/45`}>Bu bo'limda sharh yo'q.</p>
      ) : (
        <>
          {list.items.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
          {list.items.length < list.total && (
            <button
              type="button"
              onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
              disabled={isFetching}
              className={`${ghostButton} w-full`}
            >
              {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
              Yana ko'rsatish ({list.total - list.items.length})
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: LandingReviewItem }) {
  const queryClient = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(review.author_name);

  const update = useMutation({
    mutationFn: (body: { status?: ReviewStatus; author_name?: string }) =>
      landingAdminService.updateReview(review.id, body),
    onSuccess: () => {
      setEditingName(false);
      // Counts in the header and the list filters both change.
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err) => toast.error(errorText(err, "Saqlab bo'lmadi")),
  });

  const badge = STATUS_BADGE[review.status];
  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Ism bo'sh bo'lmasin");
      return;
    }
    update.mutate({ author_name: trimmed });
  };

  return (
    <article className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Stars rating={review.rating} />
          {editingName ? (
            <span className="flex items-center gap-1.5">
              <input
                className={`${inputClass} h-9 w-40`}
                value={name}
                maxLength={80}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                aria-label="Saytdagi ism"
              />
              <button type="button" onClick={saveName} className="text-xs font-bold text-orange-600">
                Saqlash
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="inline-flex items-center gap-1 text-sm font-bold text-gray-900 dark:text-white"
              title="Saytdagi ismni o'zgartirish"
            >
              {review.author_name}
              <Pencil className="h-3 w-3 text-gray-400" />
            </button>
          )}
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${badge.className}`}>{badge.label}</span>
      </div>

      <p className="mt-1 text-xs text-gray-500 dark:text-white/45">
        {review.client_code}
        {review.flight_name && ` · ${review.flight_name}`} · {formatDateTime(review.created_at)} ·{' '}
        {review.language.toUpperCase()}
      </p>

      {review.text ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-800 dark:text-white/85">
          {review.text}
        </p>
      ) : (
        <p className="mt-3 text-sm italic text-gray-400 dark:text-white/35">Faqat baho, izoh yozilmagan.</p>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {review.status !== 'rejected' && (
          <button
            type="button"
            onClick={() => update.mutate({ status: 'rejected' })}
            disabled={update.isPending}
            className={ghostButton}
          >
            {review.status === 'approved' ? 'Saytdan olish' : 'Rad etish'}
          </button>
        )}
        {review.status !== 'approved' && (
          <button
            type="button"
            onClick={() => update.mutate({ status: 'approved' })}
            disabled={update.isPending || !review.text}
            title={review.text ? undefined : 'Izohsiz sharh saytga chiqmaydi'}
            className={primaryButton}
          >
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Saytga chiqarish
          </button>
        )}
      </div>
    </article>
  );
}
