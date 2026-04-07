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

