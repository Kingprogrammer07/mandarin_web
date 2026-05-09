/**
 * Quick-date preset helpers for cashier logs and payment-notification filters.
 *
 * All dates are returned as YYYY-MM-DD strings in the *local* (Tashkent) timezone
 * so they match the <input type="date"> value format.
 */

export interface DatePreset {
  label: string;
  dateFrom: string;
  dateTo: string;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildDatePresets(): DatePreset[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const wd = now.getDay(); // 0 = Sunday

  // Yesterday
  const yesterday = new Date(y, m, d - 1);

  // Start of this week (Monday-based)
  const mondayOffset = wd === 0 ? 6 : wd - 1;
  const weekStart = new Date(y, m, d - mondayOffset);

  // Start / end of this month
  const monthStart = new Date(y, m, 1);
  const monthEnd = new Date(y, m + 1, 0);

  const today = toISO(now);

  return [
    { label: "Bugun", dateFrom: today, dateTo: today },
    { label: "Kecha", dateFrom: toISO(yesterday), dateTo: toISO(yesterday) },
    {
      label: "Bu hafta",
      dateFrom: toISO(weekStart),
      dateTo: today,
    },
    {
      label: "Bu oy",
      dateFrom: toISO(monthStart),
      dateTo: toISO(monthEnd),
    },
  ];
}
