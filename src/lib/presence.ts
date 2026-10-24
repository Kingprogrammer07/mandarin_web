/** Wording for presence times. Exact clock times; relative only under an hour. */

import { TASHKENT_TZ, getTashkentDateIso } from '@/lib/format';

export const WEEKDAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
export const WEEKDAYS_SHORT = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

const pad = (n: number) => String(n).padStart(2, '0');

/** "14:00–14:59" — the hour bucket the backend counts in. */
export const hourRange = (h: number) => `${pad(h)}:00–${pad(h)}:59`;

const clock = (d: Date) =>
  new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: TASHKENT_TZ }).format(d);

const dayMonth = (d: Date) =>
  new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TASHKENT_TZ }).format(d);

/** Full exact time, for tooltips: "25.10.2026 14:05:31". */
export const exactTime = (iso: string) => {
  const d = new Date(iso);
  const sec = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: TASHKENT_TZ,
  }).format(d);
  return `${dayMonth(d)} ${sec}`;
};

/**
 * "hozir" / "12 daqiqa oldin" / "bugun 14:05" / "kecha 09:12" / "12.10.2026 14:05".
 * Days are Tashkent calendar days.
 */
export function formatSeen(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const minutes = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (minutes < 1) return 'hozir';
  if (minutes < 60) return `${minutes} daqiqa oldin`;
  const day = getTashkentDateIso(d);
  if (day === getTashkentDateIso(now)) return `bugun ${clock(d)}`;
  if (day === getTashkentDateIso(new Date(now.getTime() - 86_400_000))) return `kecha ${clock(d)}`;
  return `${dayMonth(d)} ${clock(d)}`;
}

/** "25.10.2026" from a "2026-10-25" calendar day. */
export const formatDay = (day: string) => {
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y}`;
};

/** Weekday (0 = Monday) of a "YYYY-MM-DD" calendar day. */
export const weekdayOf = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;

/** Averages keep at most one decimal, and say "0" rather than "0.0". */
export const formatAvg = (v: number) =>
  Number.isInteger(v) ? String(v) : v.toLocaleString('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
