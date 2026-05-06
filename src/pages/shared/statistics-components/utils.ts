export type TabId = 'overview' | 'clients' | 'cargo' | 'finance' | 'operational' | 'analytics';

export const formatMoney = (val: string | number | undefined | null): string => {
  if (val == null) return `0 so'm`;
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return `0 so'm`;
  return `${num.toLocaleString('ru-RU')} so'm`;
};

/** Short money label for chart Y-axis (e.g. "1.2 mln", "450 ming") */
export const formatMoneyShort = (val: string | number): string => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)} mlrd`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)} mln`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)} ming`;
  return `${num}`;
};

/** Integer/large number with space as thousands separator (Russian locale) */
export const formatNum = (val: string | number | undefined | null): string => {
  if (val == null) return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';
  if (Number.isInteger(num)) return num.toLocaleString('ru-RU');
  return num.toLocaleString('ru-RU');
};

/**
 * Formats a decimal number (days, kg averages) using a period as the decimal
 * separator so it cannot be confused with a thousands separator.
 */
export const formatDecimal = (val: string | number | undefined | null, decimals = 1): string => {
  if (val == null) return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';
  if (num >= 1000) return num.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  return num.toFixed(decimals);
};

export const th = 'pb-2 pr-4 font-semibold text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 whitespace-nowrap';
export const tr = 'border-b last:border-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors';
