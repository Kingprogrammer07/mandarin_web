import { describe, expect, it } from 'vitest';
import { formatAvg, formatDay, formatSeen, hourRange, weekdayOf } from './presence';

describe('formatSeen', () => {
  // 2026-10-25 10:00 in Tashkent
  const now = new Date('2026-10-25T05:00:00Z');

  it('says minutes under an hour', () => {
    expect(formatSeen('2026-10-25T04:59:40Z', now)).toBe('hozir');
    expect(formatSeen('2026-10-25T04:48:00Z', now)).toBe('12 daqiqa oldin');
  });

  it('uses Tashkent calendar days', () => {
    expect(formatSeen('2026-10-24T19:30:00Z', now)).toBe('bugun 00:30');
    expect(formatSeen('2026-10-24T18:30:00Z', now)).toBe('kecha 23:30');
    expect(formatSeen('2026-10-20T09:05:00Z', now)).toBe('20.10.2026 14:05');
  });

  it('shows a dash when never seen', () => {
    expect(formatSeen(null, now)).toBe('—');
  });
});

describe('small formatters', () => {
  it('formats days, hours, weekdays and averages', () => {
    expect(formatDay('2026-10-05')).toBe('05.10.2026');
    expect(hourRange(9)).toBe('09:00–09:59');
    expect(weekdayOf('2026-10-26')).toBe(0); // Monday
    expect(weekdayOf('2026-10-25')).toBe(6); // Sunday
    expect(formatAvg(3)).toBe('3');
    expect(formatAvg(2.25)).toBe('2,3');
  });
});
