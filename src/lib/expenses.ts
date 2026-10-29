/**
 * Money and time rules of the «Rasxodlar» page, kept apart from the UI so
 * they can be tested.
 *
 * Amounts: expenses are whole so'm. The input groups digits as they are typed
 * ("12 000 000"), and a pasted decimal part is refused instead of guessed at,
 * because "1500.50" read as 150 050 would be a hundredfold error.
 *
 * Time: `expense_date` has always been saved as the typed Tashkent date and
 * time with a "Z" suffix (the Excel file and the edit history read it that
 * way), so it is shown by reading the string, never by converting a zone.
 * `created_at` is a real moment and is shown in Tashkent time.
 */

/** Numeric(12,2) in the database: ten digits before the point. */
export const MAX_EXPENSE_AMOUNT = 9_999_999_999;

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5, no daylight saving

// ── Amounts ──────────────────────────────────────────────────────────────────

/** "12000000" → "12 000 000". Digits only. */
function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** A decimal tail like ",50" or ".5": tiyin, which this form does not take. */
const DECIMAL_TAIL = /[.,]\d{1,2}\s*$/;

/**
 * What the amount field shows after a keystroke or a paste.
 *
 * Spaces, commas and dots between digit groups are grouping ("12,000,000",
 * "1.500.000"). A decimal tail is left untouched so `parseAmountText` can
 * refuse it visibly; everything else non-digit is dropped.
 */
export function formatAmountInput(raw: string): string {
  if (DECIMAL_TAIL.test(raw.trim())) return raw;
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 10);
  return groupDigits(digits);
}

export type AmountCheck =
  | { ok: true; value: number }
  | { ok: false; error: string };

export function parseAmountText(text: string): AmountCheck {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'Summani kiriting' };
  if (DECIMAL_TAIL.test(trimmed)) {
    return { ok: false, error: "Tiyinsiz, butun so'mda kiriting" };
  }
  const digits = trimmed.replace(/[\s\u00a0\u202f.,]/g, '');
  if (!/^\d+$/.test(digits)) return { ok: false, error: 'Faqat raqam kiriting' };
  const value = Number(digits);
  if (value <= 0) return { ok: false, error: "Summa 0 so'mdan katta bo'lsin" };
  if (value > MAX_EXPENSE_AMOUNT) return { ok: false, error: 'Summa juda katta' };
  return { ok: true, value };
}

/** "12 000 000" or "1 500,5" — never rounds an amount that has tiyin. */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('uz-UZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Sum in tiyin, so a column of floats adds up to what the rows show. */
export function sumAmounts(amounts: number[]): number {
  return amounts.reduce((cents, a) => cents + Math.round(a * 100), 0) / 100;
}

const ONES = ['', 'bir', 'ikki', 'uch', "to'rt", 'besh', 'olti', 'yetti', 'sakkiz', "to'qqiz"];
const TENS = ['', "o'n", 'yigirma', "o'ttiz", 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakson', "to'qson"];
const SCALES = ['', 'ming', 'million', 'milliard'];

function triple(n: number): string[] {
  const words: string[] = [];
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  if (h) words.push(ONES[h], 'yuz');
  if (t) words.push(TENS[t]);
  if (o) words.push(ONES[o]);
  return words;
}

/**
 * 12 000 000 → "o'n ikki million so'm": read back under the field so an
 * extra or missing zero is seen before saving. Whole so'm only.
 */
export function amountInWords(amount: number): string {
  let n = Math.floor(amount);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n === 0) return "nol so'm";
  const words: string[] = [];
  for (let scale = 0; n > 0 && scale < SCALES.length; scale += 1) {
    const chunk = n % 1000;
    if (chunk) words.unshift(...triple(chunk), ...(SCALES[scale] ? [SCALES[scale]] : []));
    n = Math.floor(n / 1000);
  }
  return `${words.join(' ')} so'm`;
}

// ── Dates ────────────────────────────────────────────────────────────────────

export interface WallClock {
  /** "2026-10-24", the value of an <input type="date"> */
  ymd: string;
  /** "14:32", the value of an <input type="time"> */
  hm: string;
}

/** Now on a Tashkent clock, whatever zone the computer is set to. */
export function tashkentNow(now: number = Date.now()): WallClock {
  const iso = new Date(now + TASHKENT_OFFSET_MS).toISOString();
  return { ymd: iso.slice(0, 10), hm: iso.slice(11, 16) };
}

/** A real moment (created_at) as Tashkent wall-clock time. */
export function tashkentClock(iso: string): WallClock | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return tashkentNow(ms);
}

/** expense_date as it was typed: the first 16 characters of the string. */
export function wallClockOf(iso: string): WallClock | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return m ? { ymd: m[1], hm: m[2] } : null;
}

/** What the API stores for a typed date and time (see the note at the top). */
export function expenseDateIso(ymd: string, hm: string): string {
  return `${ymd}T${hm}:00.000Z`;
}

/** The date and time a row shows: when the money was spent, else when it was entered. */
export function spentAt(expense: { expense_date: string | null; created_at: string }): WallClock | null {
  return (expense.expense_date && wallClockOf(expense.expense_date)) || tashkentClock(expense.created_at);
}

/** "2026-10-24" → "24.10.2026" */
export function dmy(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}.${m}.${y}`;
}

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

/**
 * "2026-10-30" → "30-oktyabr 2026, juma". A browser set to English shows the
 * date field as 10/30/2026; spelled out, 10 November can't pass for 11 October.
 */
export function dateInWords(ymd: string, today?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return '';
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const words = `${d}-${MONTHS[mo - 1]} ${y}, ${WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]}`;
  if (today && ymd === today) return `Bugun, ${words}`;
  if (today && ymd === shiftYmd(today, -1)) return `Kecha, ${words}`;
  return words;
}

/** Edit and delete stay open for a day after entry (super-admin always). */
export function within24h(createdAt: string, now: number = Date.now()): boolean {
  return now - Date.parse(createdAt) < 24 * 60 * 60 * 1000;
}

function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export interface DateRange {
  from?: string;
  to?: string;
}

export interface RangePreset extends DateRange {
  key: string;
  label: string;
}

/** Quick ranges on the Tashkent calendar, weeks starting on Monday. */
export function rangePresets(today: string): RangePreset[] {
  const [y, m, d] = today.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthEnd = shiftYmd(monthStart, -1);
  return [
    { key: 'today', label: 'Bugun', from: today, to: today },
    { key: 'yesterday', label: 'Kecha', from: shiftYmd(today, -1), to: shiftYmd(today, -1) },
    { key: 'week', label: 'Bu hafta', from: shiftYmd(today, -((weekday + 6) % 7)), to: today },
    { key: 'month', label: 'Bu oy', from: monthStart, to: today },
    { key: 'last-month', label: "O'tgan oy", from: `${lastMonthEnd.slice(0, 7)}-01`, to: lastMonthEnd },
    { key: 'all', label: 'Barcha vaqt' },
  ];
}

export function rangeLabel(range: DateRange): string {
  if (!range.from && !range.to) return 'Barcha vaqt';
  if (range.from && range.to && range.from === range.to) return dmy(range.from);
  return `${range.from ? dmy(range.from) : '…'} – ${range.to ? dmy(range.to) : '…'}`;
}
