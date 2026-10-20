/**
 * The Landing admin form decides what every visitor of mandarincargo.uz sees,
 * so the rules that turn inputs into the API body are pinned here.
 */

import { describe, expect, it, vi } from 'vitest';
import type { LandingAdminData, LandingTier } from '@/api/services/landingAdmin';

// The form only needs the service's constants; the real client needs env vars.
vi.mock('@/api/client', () => ({ apiClient: {} }));

const {
  buildLinks,
  buildOverrides,
  buildTier,
  emptyTierForm,
  parseAmount,
  previewMetric,
  toOverridesForm,
  toTierForm,
} = await import('./landingForm');

const data = {
  founded_year: 2019,
  links: { bot_url: 'https://t.me/mandarincargobot' },
  stat_overrides: { clients: { value: 50000 }, flights: { hidden: true } },
  computed: { clients: 48312, flights: 310 },
  published: {},
  delivery_sample_size: 0,
  computed_at: null,
  base_price_usd: 9.5,
  tiers: [],
  publish_configured: false,
  last_published_at: null,
} as LandingAdminData;

describe('parseAmount', () => {
  it('accepts spaces and a decimal comma', () => {
    expect(parseAmount('50 000')).toBe(50000);
    expect(parseAmount('4,5')).toBe(4.5);
    expect(parseAmount('  ')).toBeNull();
  });

  it('rejects negatives and text', () => {
    expect(parseAmount('-1')).toBe('invalid');
    expect(parseAmount('ko\'p')).toBe('invalid');
  });
});

describe('metric overrides', () => {
  it('seeds the form from saved overrides', () => {
    const form = toOverridesForm(data);
    expect(form.clients).toEqual({ value: '50000', hidden: false });
    expect(form.flights).toEqual({ value: '', hidden: true });
    expect(form.cargo_kg).toEqual({ value: '', hidden: false });
  });

  it('sends every metric, with empty input as null', () => {
    const result = buildOverrides(toOverridesForm(data));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.overrides.clients).toEqual({ value: 50000, hidden: false });
    expect(result.overrides.flights).toEqual({ value: null, hidden: true });
    expect(result.overrides.years).toEqual({ value: null, hidden: false });
  });

  it('names the metric with a bad value', () => {
    const form = toOverridesForm(data);
    form.cargo_kg.value = 'abc';
    expect(buildOverrides(form)).toEqual({ ok: false, key: 'cargo_kg' });
  });

  it('previews hidden, overridden and computed values', () => {
    expect(previewMetric(310, { value: '', hidden: true })).toBeNull();
    expect(previewMetric(48312, { value: '50000', hidden: false })).toBe(50000);
    expect(previewMetric(48312, { value: '', hidden: false })).toBe(48312);
    expect(previewMetric(undefined, { value: '', hidden: false })).toBeNull();
  });
});

describe('links', () => {
  it('turns empty links into null so the landing drops them', () => {
    const result = buildLinks({
      bot_url: ' https://t.me/mandarincargobot ',
      channel_url: '',
      instagram_url: '',
      facebook_url: '',
    });
    expect(result).toEqual({
      ok: true,
      links: {
        bot_url: 'https://t.me/mandarincargobot',
        channel_url: null,
        instagram_url: null,
        facebook_url: null,
      },
    });
  });

  it('refuses plain http and bare names', () => {
    const base = { bot_url: '', channel_url: '', instagram_url: '', facebook_url: '' };
    expect(buildLinks({ ...base, instagram_url: 'http://instagram.com/x' })).toEqual({
      ok: false,
      key: 'instagram_url',
    });
    expect(buildLinks({ ...base, channel_url: 'mandarin_cargo' })).toEqual({
      ok: false,
      key: 'channel_url',
    });
  });
});

describe('tiers', () => {
  const standard: LandingTier = {
    id: 1,
    name: { uz: 'Standart', ru: 'Стандарт' },
    description: { uz: 'Oddiy yuklar' },
    badges: { uz: ['Sug\'urta', 'Kuzatuv'] },
    price_usd: 9.5,
    old_price_usd: null,
    uses_base_price: true,
    is_popular: true,
    is_active: true,
    sort_order: 0,
  };

  it('round-trips a base-price tier without freezing the live price', () => {
    const form = toTierForm(standard);
    expect(form.price).toBe('');
    expect(form.badges.uz).toBe("Sug'urta\nKuzatuv");

    const result = buildTier(form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tier.price_usd).toBeNull();
    expect(result.tier.uses_base_price).toBe(true);
    expect(result.tier.name).toEqual({ uz: 'Standart', ru: 'Стандарт' });
    expect(result.tier.badges).toEqual({ uz: ["Sug'urta", 'Kuzatuv'] });
  });

  it('needs an Uzbek name and a price', () => {
    const form = emptyTierForm(3);
    expect(buildTier(form)).toEqual({ ok: false, error: "O'zbekcha nom majburiy" });
    form.name.uz = 'Brend';
    expect(buildTier(form).ok).toBe(false);
    form.price = '11';
    form.oldPrice = '13';
    const result = buildTier(form);
    expect(result.ok && result.tier).toMatchObject({
      price_usd: 11,
      old_price_usd: 13,
      sort_order: 3,
      is_active: true,
    });
  });

  it('rejects a zero price and too many badges', () => {
    const form = emptyTierForm(0);
    form.name.uz = 'Seriya';
    form.price = '0';
    expect(buildTier(form).ok).toBe(false);
    form.price = '12';
    form.badges.ru = 'a\nb\nc\nd\ne\nf\ng';
    expect(buildTier(form).ok).toBe(false);
  });
});
