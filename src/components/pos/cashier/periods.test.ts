/**
 * Period maths for the cashier screen.
 *
 * Worth pinning because every failure here is invisible: an off-by-one day or a
 * window built from the browser's clock produces a plausible-looking total that
 * is simply for the wrong hours, and nothing on screen says so.
 */

import { describe, expect, it } from 'vitest';

import { describeRange, rangeFromDays, resolvePeriod, tashkentToday } from './periods';

/** 23:30 UTC on 25 Aug is already 04:30 on 26 Aug in Tashkent. */
const LATE_EVENING_UTC = new Date('2026-08-25T23:30:00Z');
const MIDDAY_UTC = new Date('2026-08-25T09:00:00Z');

describe('tashkentToday', () => {
  it('rolls over at Tashkent midnight, not at UTC midnight', () => {
    expect(tashkentToday(MIDDAY_UTC)).toBe('2026-08-25');
    // The bug this guards: after 19:00 Tashkent the UTC date is still
    // yesterday, so a till scoped by `toISOString()` reports an empty evening.
    expect(tashkentToday(LATE_EVENING_UTC)).toBe('2026-08-26');
  });
});

describe('resolvePeriod', () => {
  it('scopes today to one Tashkent day', () => {
    expect(resolvePeriod('today', MIDDAY_UTC)).toEqual({
      from: '2026-08-25T00:00:00+05:00',
      to: '2026-08-25T23:59:59+05:00',
    });
  });

  it('scopes yesterday to the day before, not to 24 hours ago', () => {
    expect(resolvePeriod('yesterday', MIDDAY_UTC)).toEqual({
      from: '2026-08-24T00:00:00+05:00',
      to: '2026-08-24T23:59:59+05:00',
    });
  });

  it('counts seven days INCLUDING today, not eight', () => {
    const week = resolvePeriod('week', MIDDAY_UTC);
    expect(week.from).toBe('2026-08-19T00:00:00+05:00');
    expect(week.to).toBe('2026-08-25T23:59:59+05:00');
  });

  it('counts thirty days including today', () => {
    expect(resolvePeriod('month', MIDDAY_UTC).from).toBe('2026-07-27T00:00:00+05:00');
  });

  it('crosses a month boundary correctly', () => {
    const firstOfMonth = new Date('2026-09-01T09:00:00Z');
    expect(resolvePeriod('week', firstOfMonth).from).toBe('2026-08-26T00:00:00+05:00');
  });

  it('uses the Tashkent day even late in the UTC evening', () => {
    expect(resolvePeriod('today', LATE_EVENING_UTC).from).toBe('2026-08-26T00:00:00+05:00');
  });
});

describe('rangeFromDays', () => {
  it('covers the whole last day, not up to its midnight', () => {
    // `to: '...T00:00:00'` would make a one-day range match only the midnight
    // instant — the zero-width window that once emptied the provider
    // breakdown on the admin dashboard.
    expect(rangeFromDays('2026-08-25', '2026-08-25').to).toBe('2026-08-25T23:59:59+05:00');
  });
});

describe('describeRange', () => {
  it('prints one date for a single day', () => {
    expect(describeRange('2026-08-25T00:00:00+05:00', '2026-08-25T23:59:59+05:00')).toBe(
      '25.08.2026',
    );
  });

  it('prints both ends for a longer window', () => {
    expect(describeRange('2026-08-19T00:00:00+05:00', '2026-08-25T23:59:59+05:00')).toBe(
      '19.08.2026 — 25.08.2026',
    );
  });
});
