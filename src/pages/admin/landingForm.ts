/**
 * Form logic for the admin Landing page, kept apart from the JSX so it can be
 * tested without rendering.
 */

import {
  LANDING_LANGS,
  LINK_KEYS,
  METRIC_KEYS,
  type LandingAdminData,
  type LandingTier,
  type LandingTierInput,
  type LinkKey,
  type MetricKey,
  type MetricOverride,
} from '@/api/services/landingAdmin';

// ─── Metrics ─────────────────────────────────────────────────────────────────

export interface OverrideRow {
  /** Raw input text; empty = use the computed number. */
  value: string;
  hidden: boolean;
}

export type OverridesForm = Record<MetricKey, OverrideRow>;

export function toOverridesForm(data: LandingAdminData): OverridesForm {
  const form = {} as OverridesForm;
  for (const key of METRIC_KEYS) {
    const rule = data.stat_overrides[key];
    form[key] = {
      value: rule?.value != null ? String(rule.value) : '',
      hidden: Boolean(rule?.hidden),
    };
  }
  return form;
}

/** Parses "50 000" or "4,5" as a non-negative number; null when empty. */
export function parseAmount(raw: string): number | null | 'invalid' {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000) return 'invalid';
  return value;
}

/** Builds the PUT body, or returns the key of the first bad input. */
export function buildOverrides(
  form: OverridesForm,
): { ok: true; overrides: Record<MetricKey, MetricOverride> } | { ok: false; key: MetricKey } {
  const overrides = {} as Record<MetricKey, MetricOverride>;
  for (const key of METRIC_KEYS) {
    const value = parseAmount(form[key].value);
    if (value === 'invalid') return { ok: false, key };
    overrides[key] = { value, hidden: form[key].hidden };
  }
  return { ok: true, overrides };
}

/** What the landing will show for a metric with the current, unsaved form. */
export function previewMetric(
  computed: number | null | undefined,
  row: OverrideRow,
): number | null {
  if (row.hidden) return null;
  const value = parseAmount(row.value);
  if (typeof value === 'number') return value;
  return computed ?? null;
}

// ─── Links ───────────────────────────────────────────────────────────────────

export type LinksForm = Record<LinkKey, string>;

export function toLinksForm(data: LandingAdminData): LinksForm {
  const form = {} as LinksForm;
  for (const key of LINK_KEYS) form[key] = data.links[key] ?? '';
  return form;
}

/** Empty links become null (removed); anything else must be https. */
export function buildLinks(
  form: LinksForm,
): { ok: true; links: Record<LinkKey, string | null> } | { ok: false; key: LinkKey } {
  const links = {} as Record<LinkKey, string | null>;
  for (const key of LINK_KEYS) {
    const value = form[key].trim();
    if (!value) {
      links[key] = null;
      continue;
    }
    if (!/^https:\/\/[^\s]+\.[^\s]+/i.test(value)) return { ok: false, key };
    links[key] = value;
  }
  return { ok: true, links };
}

// ─── Tiers ───────────────────────────────────────────────────────────────────

type LangText = Record<(typeof LANDING_LANGS)[number], string>;

export interface TierForm {
  name: LangText;
  description: LangText;
  /** One badge per line, per language. */
  badges: LangText;
  price: string;
  oldPrice: string;
  usesBasePrice: boolean;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: string;
}

const emptyLangText = (): LangText => ({ uz: '', ru: '', en: '', cn: '' });

export function emptyTierForm(sortOrder: number): TierForm {
  return {
    name: emptyLangText(),
    description: emptyLangText(),
    badges: emptyLangText(),
    price: '',
    oldPrice: '',
    usesBasePrice: false,
    isPopular: false,
    isActive: true,
    sortOrder: String(sortOrder),
  };
}

export function toTierForm(tier: LandingTier): TierForm {
  const form = emptyTierForm(tier.sort_order);
  for (const lang of LANDING_LANGS) {
    form.name[lang] = tier.name[lang] ?? '';
    form.description[lang] = tier.description[lang] ?? '';
    form.badges[lang] = (tier.badges[lang] ?? []).join('\n');
  }
  // A base-price tier's price is the live price, not something to edit.
  form.price = tier.uses_base_price || tier.price_usd == null ? '' : String(tier.price_usd);
  form.oldPrice = tier.old_price_usd == null ? '' : String(tier.old_price_usd);
  form.usesBasePrice = tier.uses_base_price;
  form.isPopular = tier.is_popular;
  form.isActive = tier.is_active;
  return form;
}

function parsePrice(raw: string): number | null | 'invalid' {
  const value = parseAmount(raw);
  if (value === 'invalid' || value === 0 || (typeof value === 'number' && value > 1000)) {
    return 'invalid';
  }
  return value;
}

/** Builds the tier body, or an Uzbek error for the first problem found. */
export function buildTier(form: TierForm): { ok: true; tier: LandingTierInput } | { ok: false; error: string } {
  if (!form.name.uz.trim()) return { ok: false, error: "O'zbekcha nom majburiy" };

  const price = parsePrice(form.price);
  const oldPrice = parsePrice(form.oldPrice);
  if (price === 'invalid' || oldPrice === 'invalid') {
    return { ok: false, error: "Narx 0 dan katta va 1000 dan oshmasligi kerak" };
  }
  if (!form.usesBasePrice && price == null) {
    return { ok: false, error: 'Narxni kiriting yoki "Asosiy narxga bog\'lash"ni yoqing' };
  }
  const sortOrder = Number(form.sortOrder || 0);
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000) {
    return { ok: false, error: "Tartib raqami 0–1000 oralig'ida butun son bo'lsin" };
  }

  const name: LandingTierInput['name'] = {};
  const description: LandingTierInput['description'] = {};
  const badges: LandingTierInput['badges'] = {};
  for (const lang of LANDING_LANGS) {
    if (form.name[lang].trim()) name[lang] = form.name[lang].trim();
    if (form.description[lang].trim()) description[lang] = form.description[lang].trim();
    const lines = form.badges[lang]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length > 6) return { ok: false, error: `${lang.toUpperCase()}: 6 tadan ko'p belgi bo'lmasin` };
    if (lines.length) badges[lang] = lines;
  }

  return {
    ok: true,
    tier: {
      name,
      description,
      badges,
      price_usd: form.usesBasePrice ? null : price,
      old_price_usd: oldPrice,
      uses_base_price: form.usesBasePrice,
      is_popular: form.isPopular,
      is_active: form.isActive,
      sort_order: sortOrder,
    },
  };
}
