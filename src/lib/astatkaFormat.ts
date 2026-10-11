import { TASHKENT_TZ } from "@/lib/format";

/**
 * Small formatters for the astatka window. Weights are never truncated: a
 * clipped "12.35" reads as a different, wrong weight.
 */

export function formatKg(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const text = value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `${text} kg`;
}

const timeFormat = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: TASHKENT_TZ,
});

const dayFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TASHKENT_TZ,
});

/** "14:05:21" today, "10.10 14:05:21" on another day — Tashkent time. */
export function formatScanTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const time = timeFormat.format(date);
  return dayFormat.format(date) === dayFormat.format(now)
    ? time
    : `${dayFormat.format(date)} ${time}`;
}

export function pluralTa(count: number): string {
  return `${count} ta`;
}

export function paymentLabel(state: string | null | undefined): string | null {
  if (state === "paid") return "To'langan";
  if (state === "partial") return "Qisman to'langan";
  if (state === "pending") return "To'lanmagan";
  return null;
}

const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TASHKENT_TZ,
});

/** "11.10.2026 14:05" in Tashkent time, for records that may be months old. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormat.format(date);
}

/** A typed weight: comma or dot, above zero. `null` when it is not one. */
export function parseWeightInput(text: string): number | null {
  const cleaned = text.trim().replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,3})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 && value <= 100000 ? value : null;
}
