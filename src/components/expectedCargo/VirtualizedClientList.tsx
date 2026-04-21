import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Skeleton } from '@/components/ui/skeleton';
import { PackageSearch } from 'lucide-react';
import { ClientSummaryRow, TABLE_GRID_COLS } from './ClientSummaryRow';
import { ExpandedTrackCodeList } from './ExpandedTrackCodeList';
import type { ClientSummaryItem } from '@/api/services/expectedCargo';

const COLLAPSED_ROW_HEIGHT = 48;     // h-12
const TRACK_CODE_ROW_HEIGHT = 40;    // h-10 per expanded track code row
const EDIT_ACTION_BAR_HEIGHT = 32;   // col-span-3 action bar shown in edit mode
const EXPANDED_MAX_VISIBLE = 12;     // cap used to prevent extreme initial estimates

interface VirtualizedClientListProps {
  items: ClientSummaryItem[];
  isLoading: boolean;
  flightName: string;
  expandedClientCode: string | null;
  isEditMode: boolean;
  onToggleExpand: (code: string) => void;
  onDeleteClient: (clientCode: string) => void;
  onRequestReplace: (clientCode: string) => void;
  onRenameClient: (clientCode: string) => void;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-px bg-[#ffffff] dark:bg-[#1a1a1a]">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <Skeleton className="h-4 w-6 rounded" />
          <Skeleton className="h-4 flex-1 rounded" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-400 dark:text-zinc-500 bg-[#ffffff] dark:bg-[#1a1a1a]">
      <PackageSearch className="size-12 opacity-40" />
      <p className="text-sm font-medium">Bu reys uchun ma'lumot yo'q</p>
      <p className="text-xs opacity-70">Yukni qo'shish uchun skaner rejimini oching</p>
    </div>
  );
}

/** Column header row — mirrors the TABLE_GRID_COLS widths used by each data row. */
function ColumnHeader() {
  return (
    <div
      className={`grid ${TABLE_GRID_COLS} border-b-2 border-zinc-200 dark:border-zinc-700 bg-[#ffffff] dark:bg-[#1a1a1a] sticky top-0 z-10 shadow-sm`}
    >
      <div className="flex items-center justify-center h-10 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider select-none">
        T/R
      </div>
      <div className="flex items-center h-10 px-2 border-l border-zinc-100 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider select-none">
        Mijoz kodi
      </div>
      <div className="flex items-center h-10 px-3 border-l border-zinc-100 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider select-none">
        Trek kod / Soni
      </div>
    </div>
  );
}

/**
 * Estimates the rendered height of a row based on expansion state.
 * The virtualizer uses this to pre-allocate scroll space; measureElement corrects
 * the actual height after DOM rendering.
 */
function estimateRowHeight(
  item: ClientSummaryItem,
  expandedClientCode: string | null,
  isEditMode: boolean,
): number {
  if (item.client_code !== expandedClientCode) return COLLAPSED_ROW_HEIGHT;
  const visibleRows = Math.min(item.total_track_codes, EXPANDED_MAX_VISIBLE);
  const editBarHeight = isEditMode ? EDIT_ACTION_BAR_HEIGHT : 0;
  return visibleRows * TRACK_CODE_ROW_HEIGHT + editBarHeight;
}

export function VirtualizedClientList({
  items,
  isLoading,
  flightName,
  expandedClientCode,
  isEditMode,
  onToggleExpand,
  onDeleteClient,
  onRequestReplace,
  onRenameClient,
}: VirtualizedClientListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    // estimateSize is not wrapped in useCallback — useVirtualizer manages its own
    // recalculation cycle and wrapping it causes an incompatible-library lint warning.
    estimateSize: (index: number) =>
      estimateRowHeight(items[index], expandedClientCode, isEditMode),
    overscan: 8,
  });

  // Force re-measure when expansion or edit mode changes so the virtual list
  // recalculates scroll container size after DOM updates settle.
  useEffect(() => {
    rowVirtualizer.measure();
  }, [expandedClientCode, isEditMode, rowVirtualizer]);

  if (isLoading) return <LoadingSkeleton />;
  if (items.length === 0) return <EmptyState />;

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="flex flex-col h-full bg-[#ffffff] dark:bg-[#1a1a1a]">
      <ColumnHeader />

      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: 'relative',
            width: '100%',
          }}
          className="bg-[#ffffff] dark:bg-[#1a1a1a]"
        >
          {virtualItems.map((virtualItem) => {
            const item = items[virtualItem.index];
            const isExpanded = item.client_code === expandedClientCode;

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <ClientSummaryRow
                  item={item}
                  rowNumber={virtualItem.index + 1}
                  isExpanded={isExpanded}
                  isEditMode={isEditMode}
                  onToggleExpand={() => onToggleExpand(item.client_code)}
                  onDelete={() => onDeleteClient(item.client_code)}
                  onRename={() => onRenameClient(item.client_code)}
                  expandedContent={
                    isExpanded ? (
                      <ExpandedTrackCodeList
                        flightName={flightName}
                        clientCode={item.client_code}
                        rowNumber={virtualItem.index + 1}
                        isEditMode={isEditMode}
                        onRequestReplace={onRequestReplace}
                      />
                    ) : null
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
