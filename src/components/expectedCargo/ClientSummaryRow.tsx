import { Trash2, GripVertical, Edit2 } from 'lucide-react';
import { useLongPress } from '@/hooks/useLongPress';
import type { ClientSummaryItem } from '@/api/services/expectedCargo';

/**
 * Shared CSS Grid template applied to every row in the table —
 * collapsed summary rows and expanded track code rows use identical column
 * widths so the spreadsheet-style "aligned columns" look is preserved without
 * needing a true shared parent grid (which is incompatible with virtualization).
 */
export const TABLE_GRID_COLS = 'grid-cols-[40px_minmax(100px,1fr)_2fr]';

interface ClientSummaryRowProps {
  item: ClientSummaryItem;
  rowNumber: number;
  isExpanded: boolean;
  isEditMode: boolean;
  /**
   * When expanded, this renders the track code rows as bare CSS Grid cells that
   * flow directly into this component's grid container (no wrapper div).
   * When collapsed, this is null.
   */
  expandedContent: React.ReactNode;
  onToggleExpand: () => void;
  onDelete: () => void;
  onRename: () => void;
}

export function ClientSummaryRow({
  item,
  rowNumber,
  isExpanded,
  isEditMode,
  expandedContent,
  onToggleExpand,
  onDelete,
  onRename,
}: ClientSummaryRowProps) {
  const { consumeLongPressClick, ...longPressEventHandlers } = useLongPress(onDelete, 600);

  const handleClick = () => {
    // After a long-press gesture the browser fires a synthetic click.
    // Consume it here so the expand/collapse action doesn't also trigger.
    if (isEditMode && !isExpanded && consumeLongPressClick()) return;
    onToggleExpand();
  };

  return (
    <div
      className={`grid ${TABLE_GRID_COLS} border-b border-zinc-100 dark:border-zinc-800/80 cursor-pointer bg-[#ffffff] dark:bg-[#1a1a1a]`}
      onClick={handleClick}
      {...(isEditMode && !isExpanded ? longPressEventHandlers : {})}
      role="button"
      aria-expanded={isExpanded}
    >
      {isExpanded ? (
        // Expanded state: expandedContent (ExpandedTrackCodeList) renders all
        // grid cells directly — the first trio of cells forms the "header" row
        // showing the client code and first track code in their respective columns.
        expandedContent
      ) : (
        // Collapsed state: single summary row (T/R | client_code | count)
        <>
          {/* Col 1: T/R — row number */}
          <div className="flex items-center justify-center h-12 text-[13px] font-medium text-zinc-500 dark:text-zinc-400 select-none">
            {rowNumber}
          </div>

          {/* Col 2: client code */}
          <div className="flex items-center h-12 px-2 border-l border-zinc-100 dark:border-zinc-800/80 bg-[#ffffff] dark:bg-[#1a1a1a]">
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {item.client_code}
            </span>
          </div>

          {/* Col 3: track code count + optional edit actions */}
          <div className="flex items-center justify-between h-12 px-3 border-l border-zinc-100 dark:border-zinc-800/80 bg-[#ffffff] dark:bg-[#1a1a1a]">
            <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
              {item.total_track_codes}
            </span>

            {isEditMode && (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRename();
                  }}
                  className="p-1.5 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors bg-blue-50 dark:bg-blue-500/10 rounded-md"
                >
                  <Edit2 className="size-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-1.5 text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors bg-red-50 dark:bg-red-500/10 rounded-md"
                >
                  <Trash2 className="size-4" />
                </button>
                <span className="text-zinc-300 dark:text-zinc-600 cursor-grab ml-1">
                  <GripVertical className="size-4" />
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
