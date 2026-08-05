/**
 * Spreadsheet keyboard behaviour, kept out of the render code.
 *
 * The cashiers this replaces work in Excel all day, so the muscle memory is the
 * specification: arrows move, Tab moves right and wraps, Enter commits and
 * drops down a row, F2 opens the cell, Escape abandons the edit, typing a
 * printable character starts one. Anything that forces a hand onto the mouse is
 * a regression against the tool they already have.
 */

import { useCallback, useRef, useState } from "react";

import { writeClipboard } from "./clipboard";
import type { CellAddress } from "./types";

interface Options {
  rowCount: number;
  colCount: number;
  /** True when the cell at (row, col) accepts typing. */
  isEditable: (address: CellAddress) => boolean;
  /** Called when an edit is confirmed. */
  onCommit?: (address: CellAddress, raw: string) => void;
  /** Called to put a cell in view; the virtualizer owns the scrolling. */
  onScrollToRow?: (row: number) => void;
  /** Clipboard text for the active cell. */
  getCopyText?: (address: CellAddress) => string;
  /** Reports whether a copy actually landed, so the UI can say when it did not. */
  onCopyResult?: (copied: boolean) => void;
}

export interface GridKeyboard {
  active: CellAddress | null;
  editing: boolean;
  /** Draft text while a cell is open; null when not editing. */
  draft: string | null;
  setDraft: (value: string) => void;
  setActive: (address: CellAddress | null) => void;
  beginEdit: (address: CellAddress, seed?: string) => void;
  commit: () => void;
  cancel: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

/** A single printable character, i.e. the user started typing over a cell. */
function isPrintable(event: React.KeyboardEvent): boolean {
  return (
    event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
  );
}

export function useGridKeyboard({
  rowCount,
  colCount,
  isEditable,
  onCommit,
  onScrollToRow,
  getCopyText,
  onCopyResult,
}: Options): GridKeyboard {
  const [active, setActiveState] = useState<CellAddress | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  // Mirrors `active` for the commit path, which runs from event handlers that
  // would otherwise close over a stale address between render and keystroke.
  const activeRef = useRef<CellAddress | null>(null);

  const setActive = useCallback(
    (address: CellAddress | null) => {
      activeRef.current = address;
      setActiveState(address);
      if (address) onScrollToRow?.(address.row);
    },
    [onScrollToRow],
  );

  const move = useCallback(
    (dRow: number, dCol: number) => {
      const current = activeRef.current ?? { row: 0, col: 0 };
      let row = current.row + dRow;
      let col = current.col + dCol;

      // Horizontal overflow wraps to the neighbouring row, as Tab does in a
      // spreadsheet. Vertical overflow clamps — there is no row to wrap to.
      if (col >= colCount) {
        col = 0;
        row += 1;
      } else if (col < 0) {
        col = colCount - 1;
        row -= 1;
      }
      row = Math.max(0, Math.min(rowCount - 1, row));
      col = Math.max(0, Math.min(colCount - 1, col));
      if (rowCount === 0 || colCount === 0) return;
      setActive({ row, col });
    },
    [colCount, rowCount, setActive],
  );

  const beginEdit = useCallback(
    (address: CellAddress, seed?: string) => {
      if (!isEditable(address)) return;
      setActive(address);
      setDraft(seed ?? "");
    },
    [isEditable, setActive],
  );

  const cancel = useCallback(() => setDraft(null), []);

  const commit = useCallback(() => {
    const address = activeRef.current;
    if (address && draft !== null) onCommit?.(address, draft);
    setDraft(null);
  }, [draft, onCommit]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (rowCount === 0 || colCount === 0) return;
      const current = activeRef.current;

      if (draft !== null) {
        // Editing: only the keys that end an edit are handled here; everything
        // else belongs to the input.
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        } else if (event.key === "Enter") {
          event.preventDefault();
          commit();
          move(1, 0);
        } else if (event.key === "Tab") {
          event.preventDefault();
          commit();
          move(0, event.shiftKey ? -1 : 1);
        }
        return;
      }

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          move(-1, 0);
          return;
        case "ArrowDown":
          event.preventDefault();
          move(1, 0);
          return;
        case "ArrowLeft":
          event.preventDefault();
          move(0, -1);
          return;
        case "ArrowRight":
          event.preventDefault();
          move(0, 1);
          return;
        case "Tab":
          event.preventDefault();
          move(0, event.shiftKey ? -1 : 1);
          return;
        case "Enter":
          event.preventDefault();
          // Enter opens an editable cell and otherwise behaves as "next row",
          // which is what a cashier tabbing down a column expects.
          if (current && isEditable(current)) beginEdit(current);
          else move(1, 0);
          return;
        case "F2":
          event.preventDefault();
          if (current) beginEdit(current);
          return;
        case "Home":
          event.preventDefault();
          setActive({ row: event.ctrlKey ? 0 : (current?.row ?? 0), col: 0 });
          return;
        case "End":
          event.preventDefault();
          setActive({
            row: event.ctrlKey ? rowCount - 1 : (current?.row ?? 0),
            col: colCount - 1,
          });
          return;
        case "PageDown":
          event.preventDefault();
          move(20, 0);
          return;
        case "PageUp":
          event.preventDefault();
          move(-20, 0);
          return;
        default:
          break;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        if (current && getCopyText) {
          void writeClipboard(getCopyText(current)).then((ok) =>
            onCopyResult?.(ok),
          );
        }
        return;
      }

      // Typing over a cell replaces its contents, as in Excel.
      if (isPrintable(event) && current && isEditable(current)) {
        event.preventDefault();
        beginEdit(current, event.key);
      }
    },
    [
      beginEdit,
      cancel,
      colCount,
      commit,
      draft,
      getCopyText,
      isEditable,
      move,
      onCopyResult,
      rowCount,
      setActive,
    ],
  );

  return {
    active,
    editing: draft !== null,
    draft,
    setDraft,
    setActive,
    beginEdit,
    commit,
    cancel,
    onKeyDown,
  };
}
