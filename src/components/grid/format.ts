/**
 * One formatter per column format, shared by the screen and any export.
 *
 * Kept apart from the grid so a value shown on screen and the same value in a
 * downloaded file cannot drift — the two disagreeing about a money column is
 * exactly the kind of thing that ends in a phone call about a receipt.
 */

import type { CellValue, ColumnFormat } from "./types";

const MONEY = new Intl.NumberFormat("uz-UZ", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PLAIN = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 3 });

/** Pinned to Tashkent: the till closes on Tashkent hours regardless of what
 *  timezone the counter PC believes it is in. */
const TZ = "Asia/Tashkent";

const DATE = new Intl.DateTimeFormat("uz-UZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TZ,
});

const DATETIME = new Intl.DateTimeFormat("uz-UZ", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

function asNumber(v: CellValue): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Render a value for display.
 *
 * Returns an empty string for null rather than "0" or "-": a missing weight and
 * a zero weight are different facts, and a grid that prints 0 for both invites
 * the reader to sum them.
 */
export function formatCell(value: CellValue, format: ColumnFormat): string {
  if (value === null || value === undefined || value === "") return "";

  switch (format) {
    case "money": {
      const n = asNumber(value);
      return n === null ? String(value) : MONEY.format(n);
    }
    case "number": {
      const n = asNumber(value);
      return n === null ? String(value) : PLAIN.format(n);
    }
    case "weight": {
      const n = asNumber(value);
      return n === null ? String(value) : `${PLAIN.format(n)} kg`;
    }
    case "date":
    case "datetime": {
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) return String(value);
      return (format === "date" ? DATE : DATETIME).format(d);
    }
    case "code":
      return String(value).toUpperCase();
    default:
      return String(value);
  }
}

/** Whether a column can meaningfully be summed. */
export function isNumericFormat(format: ColumnFormat): boolean {
  return format === "money" || format === "number" || format === "weight";
}

/**
 * Sum the readable values in a column, and count the ones that were not.
 *
 * The unreadable count is returned rather than swallowed because these columns
 * really do contain junk: `cargo_items.weight_kg` is a text column holding the
 * Chinese header "重量/KG" in 7,353 rows and the string "nan" in 5,069 more. A
 * total that silently skipped them would be quietly wrong.
 */
export function sumColumn(values: CellValue[]): {
  total: number;
  unreadable: number;
} {
  let total = 0;
  let unreadable = 0;
  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    const n = asNumber(v);
    if (n === null) unreadable += 1;
    else total += n;
  }
  return { total, unreadable };
}

/** Clipboard form: raw and unformatted, so pasting into Excel yields numbers. */
export function copyValue(value: CellValue, format: ColumnFormat): string {
  if (value === null || value === undefined) return "";
  if (isNumericFormat(format)) {
    const n = asNumber(value);
    return n === null ? String(value) : String(n);
  }
  return String(value);
}
