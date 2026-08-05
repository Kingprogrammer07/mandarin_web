/**
 * A spreadsheet, not a table.
 *
 * Rows are virtualised, the header and the totals row never leave the screen,
 * the leading columns stay pinned past horizontal scroll, and every movement is
 * reachable from the keyboard. Columns arrive as data (see ./types) so an admin
 * can build and save layouts without a deploy.
 *
 * What it deliberately does not do: create rows. In a till, a row is a payment
 * and comes from the ledger. Excel would let you type into the next blank line;
 * here there is no blank line to type into.
 */

import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { matchesFilter, parseFilter } from "./filter";
import { copyValue, formatCell, isNumericFormat, sumColumn } from "./format";
import type { CellAddress, GridColumn } from "./types";
import { useGridKeyboard } from "./useGridKeyboard";

const ROW_HEIGHT = 30;
const HEADER_HEIGHT = 34;
const FILTER_HEIGHT = 28;
const FOOTER_HEIGHT = 34;

interface DataGridProps<TRow> {
  columns: GridColumn<TRow>[];
  rows: TRow[];
  /** Stable identity per row; used as the React key. */
  rowKey: (row: TRow, index: number) => string | number;
  loading?: boolean;
  error?: string | null;
  /** Shown in place of the body when there are no rows and no error. */
  emptyMessage?: string;
  /** Called when an editable cell is committed. Absent → the grid is read-only. */
  onCellCommit?: (row: TRow, column: GridColumn<TRow>, raw: string) => void;
  /**
   * Reports how many rows survive the column filters, so the page can warn that
   * the footer total describes a subset. The grid knows the numbers; only the
   * page knows where to put the sentence.
   */
  onFilteredCountChange?: (visible: number, total: number) => void;
  className?: string;
}

export function DataGrid<TRow>({
  columns,
  rows: allRows,
  rowKey,
  loading = false,
  error = null,
  emptyMessage = "Ma'lumot yo'q",
  onCellCommit,
  onFilteredCountChange,
  className,
}: DataGridProps<TRow>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Raw filter text per column key. Kept as typed, operator prefix and all, so
  // the box shows exactly what the operator wrote.
  const [filters, setFilters] = useState<Record<string, string>>({});

  const activeFilters = useMemo(
    () =>
      columns
        .map((column) => ({ column, parsed: parseFilter(filters[column.key] ?? "") }))
        .filter((entry): entry is { column: GridColumn<TRow>; parsed: NonNullable<ReturnType<typeof parseFilter>> } =>
          entry.parsed !== null,
        ),
    [columns, filters],
  );

  // Every filter must pass: separate boxes read as "and", the way a spreadsheet
  // filter row does.
  const rows = useMemo(() => {
    if (activeFilters.length === 0) return allRows;
    return allRows.filter((row) =>
      activeFilters.every(({ column, parsed }) =>
        matchesFilter(column.accessor(row), parsed),
      ),
    );
  }, [activeFilters, allRows]);

  const filteredCountRef = useRef<string>("");
  const countSignature = `${rows.length}/${allRows.length}`;
  if (filteredCountRef.current !== countSignature) {
    filteredCountRef.current = countSignature;
    // Reported during render rather than from an effect so the page's warning
    // and the grid's contents change in the same frame; a one-frame lag here
    // means a "total is partial" notice that flashes after the total does.
    queueMicrotask(() => onFilteredCountChange?.(rows.length, allRows.length));
  }

  // Left offset of every frozen column, so each pins just past the previous one
  // instead of stacking at zero.
  const frozenOffsets = useMemo(() => {
    const offsets: number[] = [];
    let running = 0;
    for (const column of columns) {
      offsets.push(running);
      if (column.frozen) running += column.width;
    }
    return offsets;
  }, [columns]);

  const totalWidth = useMemo(
    () => columns.reduce((sum, c) => sum + c.width, 0),
    [columns],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const isEditable = useCallback(
    ({ row, col }: CellAddress) =>
      Boolean(onCellCommit) &&
      Boolean(columns[col]?.editable) &&
      row >= 0 &&
      row < rows.length,
    [columns, onCellCommit, rows.length],
  );

  const getCopyText = useCallback(
    ({ row, col }: CellAddress) => {
      const column = columns[col];
      const record = rows[row];
      if (!column || record === undefined) return "";
      return copyValue(column.accessor(record), column.format);
    },
    [columns, rows],
  );

  const keyboard = useGridKeyboard({
    rowCount: rows.length,
    colCount: columns.length,
    isEditable,
    onScrollToRow: (row) => virtualizer.scrollToIndex(row, { align: "auto" }),
    getCopyText,
    // Silence here would be the worst outcome: the operator believes the value
    // is on the clipboard, pastes the previous one somewhere, and never learns
    // the copy was refused.
    onCopyResult: (copied) => {
      if (!copied) toast.error("Nusxa olinmadi — brauzer ruxsat bermadi");
    },
    onCommit: ({ row, col }, raw) => {
      const column = columns[col];
      const record = rows[row];
      if (column && record !== undefined) onCellCommit?.(record, column, raw);
    },
  });

  // Footer totals. Computed over every loaded row, not just the visible window —
  // a total that changed as you scrolled would be worse than no total.
  const totals = useMemo(() => {
    return columns.map((column) => {
      if (column.total === "count") return { text: String(rows.length), warn: 0 };
      if (column.total !== "sum" || !isNumericFormat(column.format)) {
        return { text: "", warn: 0 };
      }
      const { total, unreadable } = sumColumn(rows.map(column.accessor));
      return { text: formatCell(total, column.format), warn: unreadable };
    });
  }, [columns, rows]);

  const alignClass = (column: GridColumn<TRow>) =>
    column.align === "right" || isNumericFormat(column.format)
      ? "text-right justify-end"
      : column.align === "center"
        ? "text-center justify-center"
        : "text-left justify-start";

  return (
    <div
      className={cn(
        "flex flex-col border border-gray-200 dark:border-white/[0.08] rounded-xl overflow-hidden bg-white dark:bg-[#141414]",
        className,
      )}
    >
      {/* Scroll container owns both axes so the sticky header and the sticky
          first columns share one coordinate space. */}
      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={keyboard.onKeyDown}
        className="flex-1 overflow-auto outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500/30"
        role="grid"
        aria-rowcount={rows.length}
        aria-colcount={columns.length}
      >
        <div style={{ width: totalWidth, minWidth: "100%" }}>
          {/* Header */}
          <div
            className="sticky top-0 z-20 flex bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/[0.08]"
            style={{ height: HEADER_HEIGHT }}
            role="row"
          >
            {columns.map((column, colIndex) => (
              <div
                key={column.key}
                role="columnheader"
                className={cn(
                  "flex items-center px-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-white/[0.06] select-none",
                  alignClass(column),
                  column.frozen &&
                    "sticky z-10 bg-gray-50 dark:bg-[#1b1b1b] shadow-[1px_0_0_0_rgba(0,0,0,0.06)]",
                )}
                style={{
                  width: column.width,
                  minWidth: column.width,
                  left: column.frozen ? frozenOffsets[colIndex] : undefined,
                }}
                title={column.label}
              >
                <span className="truncate">{column.label}</span>
              </div>
            ))}
          </div>

          {/* Filter row.
              Sticky under the header at the same z-level, so it stays reachable
              on a scrolled list — a filter you have to scroll back up to change
              is one an operator stops using.

              `=` in a box means exact. That single character is the whole answer
              to STCH3 / STCH30 / STCH330: no amount of extra typing narrows a
              substring match down to the shortest of a set of prefixes. */}
          <div
            className="sticky z-20 flex bg-white dark:bg-[#141414] border-b border-gray-200 dark:border-white/[0.08]"
            style={{ top: HEADER_HEIGHT, height: FILTER_HEIGHT }}
            role="row"
          >
            {columns.map((column, colIndex) => {
              const value = filters[column.key] ?? "";
              const disabled = column.filterable === false;
              return (
                <div
                  key={column.key}
                  className={cn(
                    "relative flex items-center border-r border-gray-200 dark:border-white/[0.06]",
                    column.frozen &&
                      "sticky z-10 bg-white dark:bg-[#141414] shadow-[1px_0_0_0_rgba(0,0,0,0.06)]",
                  )}
                  style={{
                    width: column.width,
                    minWidth: column.width,
                    left: column.frozen ? frozenOffsets[colIndex] : undefined,
                  }}
                >
                  {!disabled && (
                    <>
                      <input
                        value={value}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, [column.key]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          // Escape clears this box instead of bubbling to the
                          // grid, where it would only cancel a cell edit.
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            setFilters((prev) => ({ ...prev, [column.key]: "" }));
                          }
                        }}
                        placeholder={isNumericFormat(column.format) ? "> yoki =" : "= aniq"}
                        className={cn(
                          "w-full h-full bg-transparent px-2 pr-5 text-[11px] outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600",
                          value && "font-bold text-orange-600 dark:text-orange-400",
                          isNumericFormat(column.format) ? "text-right" : "text-left",
                        )}
                      />
                      {value && (
                        <button
                          type="button"
                          onClick={() =>
                            setFilters((prev) => ({ ...prev, [column.key]: "" }))
                          }
                          className="absolute right-1 p-0.5 rounded text-gray-400 hover:text-orange-500"
                          title="Tozalash"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Body */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Yuklanmoqda…
            </div>
          ) : error ? (
            <div className="py-16 text-center text-[13px] text-red-500 px-4">{error}</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-gray-400">{emptyMessage}</div>
          ) : (
            <div
              style={{ height: virtualizer.getTotalSize(), position: "relative" }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const record = rows[virtualRow.index];
                if (record === undefined) return null;
                return (
                  <div
                    key={rowKey(record, virtualRow.index)}
                    role="row"
                    className={cn(
                      "absolute left-0 flex border-b border-gray-100 dark:border-white/[0.04]",
                      // Banding: a 40-column row is hard to track across without it.
                      virtualRow.index % 2 === 1 && "bg-gray-50/60 dark:bg-white/[0.015]",
                    )}
                    style={{
                      top: virtualRow.start,
                      height: virtualRow.size,
                      width: totalWidth,
                    }}
                  >
                    {columns.map((column, colIndex) => {
                      const isActive =
                        keyboard.active?.row === virtualRow.index &&
                        keyboard.active?.col === colIndex;
                      const editingHere = isActive && keyboard.editing;
                      const value = column.accessor(record);
                      return (
                        <div
                          key={column.key}
                          role="gridcell"
                          onMouseDown={() =>
                            keyboard.setActive({ row: virtualRow.index, col: colIndex })
                          }
                          onDoubleClick={() =>
                            keyboard.beginEdit({ row: virtualRow.index, col: colIndex })
                          }
                          className={cn(
                            "flex items-center px-2 text-[12px] border-r border-gray-100 dark:border-white/[0.04] text-gray-800 dark:text-gray-200",
                            alignClass(column),
                            isNumericFormat(column.format) && "tabular-nums",
                            column.frozen &&
                              "sticky z-[5] bg-white dark:bg-[#141414] shadow-[1px_0_0_0_rgba(0,0,0,0.06)]",
                            isActive &&
                              "ring-2 ring-inset ring-orange-500 bg-orange-50 dark:bg-orange-500/[0.1]",
                          )}
                          style={{
                            width: column.width,
                            minWidth: column.width,
                            left: column.frozen ? frozenOffsets[colIndex] : undefined,
                          }}
                        >
                          {editingHere ? (
                            <input
                              autoFocus
                              value={keyboard.draft ?? ""}
                              onChange={(e) => keyboard.setDraft(e.target.value)}
                              onBlur={keyboard.commit}
                              className="w-full bg-transparent outline-none text-[12px] font-semibold text-gray-900 dark:text-white"
                            />
                          ) : (
                            <span className="truncate">
                              {formatCell(value, column.format)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Totals. Outside the scroll container so it is pinned to the frame
          rather than to the top of a scrolled list. */}
      <div
        className="flex border-t border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] overflow-hidden"
        style={{ height: FOOTER_HEIGHT }}
      >
        <div className="flex" style={{ width: totalWidth }}>
          {columns.map((column, colIndex) => (
            <div
              key={column.key}
              className={cn(
                "flex items-center px-2 text-[12px] font-bold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-white/[0.06]",
                alignClass(column),
                isNumericFormat(column.format) && "tabular-nums",
              )}
              style={{ width: column.width, minWidth: column.width }}
              title={
                totals[colIndex]?.warn
                  ? `${totals[colIndex]?.warn} ta qiymat raqam emas — jamiga kirmadi`
                  : undefined
              }
            >
              <span className="truncate">{totals[colIndex]?.text}</span>
              {Boolean(totals[colIndex]?.warn) && (
                <span className="ml-1 text-amber-500 shrink-0">*</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
