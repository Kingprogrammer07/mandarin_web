// Timezone constant - Asia/Tashkent is the business timezone
export const TASHKENT_TZ = 'Asia/Tashkent';

export const getLocaleFromLanguage = (language?: string) => {
  if (language === 'ru') {
    return 'ru-RU';
  }
  return 'uz-UZ';
};

export const formatNumberLocalized = (value: number, language?: string) => {
  const locale = getLocaleFromLanguage(language);
  return new Intl.NumberFormat(locale).format(value);
};

export const formatCurrencySum = (value: number, language?: string, currency?: string) => {
  const locale = getLocaleFromLanguage(language);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  
  return `${formatted} ${currency || 'so\'m'}`;
};

export const formatCurrencyUz = (value: number) => {
  const formatted = new Intl.NumberFormat('uz-UZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
  return `${formatted} so'm`;
};

/**
 * The one money formatter for client-facing screens.
 *
 * The user side currently renders sums through 22 raw `toLocaleString` calls
 * across three different locales — `UserReportsPage.tsx:334` prints so'm in
 * `en-US`, so the same amount reads "2,300,000.00 so'm" on one tab and
 * "2 300 000 so'm" on the next. Currency is the number a cargo client checks
 * twice; two spellings of it read as a bug in the totals.
 *
 * Always uz-UZ and always whole so'm: tiyin are not used in this business, and
 * a trailing ".00" only widens the number. Pair with `tabular-nums` so digits
 * stay in their columns as amounts change.
 */
/**
 * Cargo weight in kilograms.
 *
 * Parcels are weighed down to grams, so a fixed single decimal turned 0.001 kg
 * into "0.0" — which reads as "not weighed" rather than "very light", and hid
 * exactly the rows a client would query. Three decimals covers a gram, and
 * trailing zeros are trimmed so a whole number still reads "1" and not
 * "1.000". The same precision the detail view prints, so the list and the
 * drawer never disagree about the same parcel.
 */
export const formatWeightKg = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '—';

  let text = value.toFixed(3);
  if (text.includes('.')) {
    // Only after a decimal point: trimming blindly would turn 100 into 1.
    text = text.replace(/0+$/, '').replace(/\.$/, '');
  }
  // Below a gram there is nothing left to round to, but the row still has a
  // weight — saying so beats printing a zero.
  return text === '0' ? '<0.001' : text;
};

export const formatUzsAmount = (value: number): string => {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('uz-UZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(safe));
};

/**
 * The amount with its unit. Split from `formatUzsAmount` because the summary
 * tiles set the unit in a smaller weight than the number — rendering one
 * string there would force the whole thing to the same size, and "so'm" is the
 * part a reader can afford to have quieter.
 */
export const formatUzs = (value: number): string => `${formatUzsAmount(value)} so'm`;

export const formatTashkentDate = (
  dateInput: string | Date,
  language?: string,
  options?: Intl.DateTimeFormatOptions
) => {
  const locale = getLocaleFromLanguage(language);
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const baseOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: TASHKENT_TZ
  };
  return new Intl.DateTimeFormat(locale, { ...baseOptions, ...options }).format(date);
};

// Format date as short format (e.g., "15 yan" or "15 янв")
export const formatTashkentDateShort = (
  dateInput: string | Date,
  language?: string
) => {
  const locale = getLocaleFromLanguage(language);
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: TASHKENT_TZ
  }).format(date);
};

// Format date with time in Tashkent timezone
export const formatTashkentDateTime = (
  dateInput: string | Date,
  language?: string
) => {
  const locale = getLocaleFromLanguage(language);
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TASHKENT_TZ
  }).format(date);
};

export const getTashkentDateIso = (date: Date = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TASHKENT_TZ
  }).format(date);
};

// Get current date in Tashkent timezone as Date object
export const getTashkentNow = (): Date => {
  const now = new Date();
  const tashkentStr = now.toLocaleString('en-US', { timeZone: TASHKENT_TZ });
  return new Date(tashkentStr);
};

// Format percentage with sign
export const formatPercent = (value: number, showSign = true): string => {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

// Format compact number (e.g., 1.2M, 500K)
export const formatCompactNumber = (value: number, language?: string): string => {
  const locale = getLocaleFromLanguage(language);
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
};

