import { describe, expect, it } from 'vitest';

import {
  amountInWords,
  dateInWords,
  expenseDateIso,
  formatAmountInput,
  parseAmountText,
  rangeLabel,
  rangePresets,
  spentAt,
  sumAmounts,
  tashkentNow,
  wallClockOf,
  within24h,
} from './expenses';

describe('amount field', () => {
  it('groups digits as they are typed', () => {
    expect(formatAmountInput('12000000')).toBe('12 000 000');
    expect(formatAmountInput('12 000 0001')).toBe('120 000 001');
    expect(formatAmountInput('00150')).toBe('150');
    expect(formatAmountInput('')).toBe('');
  });

  it('reads pasted group separators as grouping', () => {
    expect(formatAmountInput('12,000,000')).toBe('12 000 000');
    expect(formatAmountInput('1.500.000')).toBe('1 500 000');
    expect(formatAmountInput('12 000 so\'m')).toBe('12 000');
    // A separator still being typed is dropped, not taken for tiyin.
    expect(formatAmountInput('1500,')).toBe('1 500');
  });

  it('never guesses a decimal part', () => {
    expect(formatAmountInput('1500.50')).toBe('1500.50');
    expect(parseAmountText('1500.50')).toEqual({ ok: false, error: "Tiyinsiz, butun so'mda kiriting" });
    expect(parseAmountText('1 500,5')).toMatchObject({ ok: false });
  });

  it('accepts only a positive amount the database can hold', () => {
    expect(parseAmountText('12 000 000')).toEqual({ ok: true, value: 12_000_000 });
    expect(parseAmountText('9 999 999 999')).toEqual({ ok: true, value: 9_999_999_999 });
    expect(parseAmountText('10 000 000 000')).toMatchObject({ ok: false, error: 'Summa juda katta' });
    expect(parseAmountText('0')).toMatchObject({ ok: false });
    expect(parseAmountText('')).toMatchObject({ ok: false, error: 'Summani kiriting' });
    // The field caps at ten digits, so the eleventh never reaches the parser.
    expect(formatAmountInput('123456789012')).toBe('1 234 567 890');
  });

  it('reads the amount back in words', () => {
    expect(amountInWords(12_000_000)).toBe("o'n ikki million so'm");
    expect(amountInWords(150_000)).toBe("bir yuz ellik ming so'm");
    expect(amountInWords(3_500_000)).toBe("uch million besh yuz ming so'm");
    expect(amountInWords(1_001)).toBe("bir ming bir so'm");
    expect(amountInWords(9_999_999_999)).toBe(
      "to'qqiz milliard to'qqiz yuz to'qson to'qqiz million to'qqiz yuz to'qson to'qqiz ming to'qqiz yuz to'qson to'qqiz so'm",
    );
  });

  it('adds money in tiyin, not in floats', () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
    expect(sumAmounts([12_000_000, 150_000.5, 400_000])).toBe(12_550_000.5);
    expect(sumAmounts([])).toBe(0);
  });
});

describe('dates', () => {
  it('takes today and the time from a Tashkent clock', () => {
    // 20:30 UTC is already the next day in Tashkent.
    expect(tashkentNow(Date.parse('2026-10-24T20:30:00Z'))).toEqual({ ymd: '2026-10-25', hm: '01:30' });
  });

  it('shows expense_date as typed and created_at in Tashkent time', () => {
    const typed = expenseDateIso('2026-10-24', '14:32');
    expect(typed).toBe('2026-10-24T14:32:00.000Z');
    // The API answers with "Z" or "+00:00"; both read back as typed.
    expect(wallClockOf('2026-10-24T14:32:00Z')).toEqual({ ymd: '2026-10-24', hm: '14:32' });
    expect(spentAt({ expense_date: '2026-10-24T14:32:00+00:00', created_at: '2026-10-24T09:40:00Z' }))
      .toEqual({ ymd: '2026-10-24', hm: '14:32' });
    expect(spentAt({ expense_date: null, created_at: '2026-10-24T09:40:00Z' }))
      .toEqual({ ymd: '2026-10-24', hm: '14:40' });
  });

  it('locks edits a day after entry', () => {
    const now = Date.parse('2026-10-25T10:00:00Z');
    expect(within24h('2026-10-24T10:30:00Z', now)).toBe(true);
    expect(within24h('2026-10-24T09:59:00Z', now)).toBe(false);
  });

  it('builds quick ranges on the Tashkent calendar', () => {
    const presets = Object.fromEntries(rangePresets('2026-10-29').map((p) => [p.key, p]));
    expect(presets.today).toMatchObject({ from: '2026-10-29', to: '2026-10-29' });
    expect(presets.yesterday).toMatchObject({ from: '2026-10-28', to: '2026-10-28' });
    expect(presets.week).toMatchObject({ from: '2026-10-26', to: '2026-10-29' }); // Thursday → Monday
    expect(presets.month).toMatchObject({ from: '2026-10-01', to: '2026-10-29' });
    expect(presets['last-month']).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
    expect(presets.all.from).toBeUndefined();
    // A Sunday belongs to the week that started six days earlier.
    expect(rangePresets('2026-11-01').find((p) => p.key === 'week')).toMatchObject({ from: '2026-10-26' });
    expect(rangePresets('2026-03-15').find((p) => p.key === 'last-month')).toMatchObject({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('spells the chosen date out', () => {
    expect(dateInWords('2026-10-30')).toBe('30-oktyabr 2026, juma');
    expect(dateInWords('2026-10-30', '2026-10-30')).toBe('Bugun, 30-oktyabr 2026, juma');
    expect(dateInWords('2026-10-29', '2026-10-30')).toBe('Kecha, 29-oktyabr 2026, payshanba');
    expect(dateInWords('2026-11-10')).toBe('10-noyabr 2026, seshanba');
    expect(dateInWords('')).toBe('');
  });

  it('labels a range', () => {
    expect(rangeLabel({ from: '2026-10-24', to: '2026-10-24' })).toBe('24.10.2026');
    expect(rangeLabel({ from: '2026-10-01', to: '2026-10-24' })).toBe('01.10.2026 – 24.10.2026');
    expect(rangeLabel({})).toBe('Barcha vaqt');
  });
});
