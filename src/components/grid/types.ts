/**
 * Column definitions for the spreadsheet-style console.
 *
 * These are deliberately plain data, not JSX: an admin will build layouts from
 * a catalogue and save them, so a column has to survive a round trip through
 * JSON. Anything that cannot — a render function, a component — belongs in the
 * formatter registry keyed by `format`, not on the column.
 */

/** What a cell can hold once read off a row. */
export type CellValue = string | number | boolean | null | undefined;

/** How a value is drawn and aligned. Drives both the screen and the export. */
export type ColumnFormat =
  | "text"
  | "code" // monospace, upper-case: client and track codes
  | "money" // grouped digits, 2 decimals, right-aligned
  | "number"
  | "weight" // kg, 2 decimals
  | "date"
  | "datetime"
  | "status"; // rendered as a coloured chip

/** What the always-visible footer shows for this column. */
export type ColumnTotal = "sum" | "count" | "none";

export interface GridColumn<TRow> {
  /** Stable identifier. Persisted in saved layouts, so it must not change. */
  key: string;
  /** Header text, in Uzbek. */
  label: string;
  /** Pixel width. Fixed rather than fractional: a spreadsheet's columns must
   *  not resize themselves when the data changes, or the eye loses its place. */
  width: number;
  format: ColumnFormat;
  align?: "left" | "right" | "center";
  /** Pinned to the left, past horizontal scroll. Only the leading columns. */
  frozen?: boolean;
  total?: ColumnTotal;
  /** Reads the value off a row. The only place a column knows the row shape. */
  accessor: (row: TRow) => CellValue;
  /**
   * Whether a cell may be typed into.
   *
   * Editability is a property of the *backend*, never of the layout: a saved
   * template must not be able to make a read-only field writable. The page
   * decides this from the field catalogue and the cashier's permissions.
   */
  editable?: boolean;
  /**
   * Whether the column gets a filter box. Defaults to true.
   *
   * Set false only where filtering is meaningless (a row-number gutter), not
   * to reduce clutter — an unfilterable column in a spreadsheet reads as a
   * broken one.
   */
  filterable?: boolean;
}

/** The cell the keyboard is currently on. */
export interface CellAddress {
  row: number;
  col: number;
}

/** A column plus the runtime state the grid keeps for it. */
export interface GridState {
  active: CellAddress | null;
  editing: boolean;
}
