/**
 * Per-column filtering, with the one operator a cashier actually needs.
 *
 * The problem this exists for: the codes `STCH3`, `STCH30` and `STCH330` all
 * exist. A plain substring filter typed as `STCH3` returns all three, and there
 * is no amount of further typing that narrows it to the first — every longer
 * string stops matching it. So a forgiving default is not enough on its own;
 * there has to be a way to say "this exactly".
 *
 * Excel solves it with an Equals/Contains dropdown per column. A dropdown per
 * column costs a click each time on a screen meant to be driven from the
 * keyboard, so the operator is a prefix instead — one character, typed inline,
 * never leaving the field:
 *
 *   STCH3    → contains   (STCH3, STCH30, STCH330)
 *   =STCH3   → exactly    (STCH3)
 *   >50000   → greater than, numeric columns
 *   <50000   → less than
 *
 * Contains stays the default because it is the forgiving one: a cashier who
 * mistypes gets too many rows, which they can see and fix, rather than zero
 * rows, which looks like the payment is missing.
 */

import type { CellValue } from "./types";

export type FilterOperator = "contains" | "equals" | "gt" | "lt";

export interface ParsedFilter {
  operator: FilterOperator;
  /** The query with its operator prefix removed, trimmed. */
  term: string;
  /** Parsed number for `gt`/`lt`; null when the term was not numeric. */
  numeric: number | null;
}

/** Split a raw filter box value into an operator and its term. */
export function parseFilter(raw: string): ParsedFilter | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const first = trimmed[0];
  const operator: FilterOperator =
    first === "=" ? "equals" : first === ">" ? "gt" : first === "<" ? "lt" : "contains";

  const term = (operator === "contains" ? trimmed : trimmed.slice(1)).trim();
  if (!term) return null;

  // Strip the grouping separators the grid itself prints, so a cashier can
  // retype a number the way they see it (">1 661 730") and still get a match.
  // \s already covers the non-breaking space Intl.NumberFormat emits for uz-UZ.
  const numeric = Number(term.replace(/[\s,]/g, ""));

  return {
    operator,
    term,
    numeric: Number.isFinite(numeric) ? numeric : null,
  };
}

function toComparable(value: CellValue): string {
  return value === null || value === undefined ? "" : String(value).toUpperCase();
}

function toNumber(value: CellValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Whether a cell passes one parsed filter.
 *
 * A `>`/`<` filter against a non-numeric cell excludes the row rather than
 * throwing or silently passing: "greater than 50 000" has no honest answer for
 * a client code, and letting such rows through would make the filter look
 * broken in exactly the case an operator is trying to narrow.
 */
export function matchesFilter(value: CellValue, filter: ParsedFilter): boolean {
  if (filter.operator === "gt" || filter.operator === "lt") {
    if (filter.numeric === null) return false;
    const n = toNumber(value);
    if (n === null) return false;
    return filter.operator === "gt" ? n > filter.numeric : n < filter.numeric;
  }

  const haystack = toComparable(value);
  const needle = filter.term.toUpperCase();
  return filter.operator === "equals"
    ? haystack === needle
    : haystack.includes(needle);
}

/** Human-readable name for the active operator, for the row-count hint. */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: "ichida",
  equals: "aniq",
  gt: "dan katta",
  lt: "dan kichik",
};
