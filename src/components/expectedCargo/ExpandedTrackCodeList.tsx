import { Fragment } from 'react';
import { Trash2, RefreshCw, Loader2, PackageX } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  searchExpectedCargo,
  type ExpectedCargoItem,
} from '@/api/services/expectedCargo';

interface ExpandedTrackCodeListProps {
  flightName: string;
  clientCode: string;
  /** Row number from the parent virtualizer — rendered in col 1 of every track code row. */
  rowNumber: number;
  isEditMode: boolean;
  onRequestReplace: (clientCode: string) => void;
}

/**
 * Renders as bare CSS Grid cells (no outer wrapper div) so it flows directly
 * into the parent ClientSummaryRow grid container.
 *
 * Layout for each track code row:
 *   Col 1 (40px)             : row number — same value repeated for every row
 *   Col 2 (minmax(100px,1fr)): client code — shown only on the first row,
 *                              empty on subsequent rows (merged-cell illusion)
 *   Col 3 (2fr)              : track code + optional delete button
 *
 * Loading / error / empty states use `col-span-3` to fill the full grid width.
 */
export function ExpandedTrackCodeList({
  flightName,
  clientCode,
  rowNumber,
  isEditMode,
  onRequestReplace,
}: ExpandedTrackCodeListProps) {
  const queryClient = useQueryClient();
  const queryKey = ['expectedCargo', 'trackCodes', flightName, clientCode];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () =>
      searchExpectedCargo({
        flight_name: flightName,
        client_code: clientCode,
        size: 500,
        page: 1,
      }),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ trackCode }: { id: number; trackCode: string }) =>
      // Individual track code deletion is implemented as a replace-all with the
      // target code omitted — the backend has no single-code DELETE endpoint.
      searchExpectedCargo({ flight_name: flightName, client_code: clientCode, size: 500 }).then(
        (current) => {
          const remaining = current.items
            .map((i) => i.track_code)
            .filter((code) => code !== trackCode);
          return import('@/api/services/expectedCargo').then(({ replaceTrackCodes }) =>
            replaceTrackCodes({
              flight_name: flightName,
              client_code: clientCode,
              new_track_codes: remaining,
            }),
          );
        },
      ),
    onSuccess: () => {
      toast.success("Trek kodi o'chirildi");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({
        queryKey: ['expectedCargo', 'summary', flightName],
      });
    },
    onError: () => {
      toast.error("O'chirishda xatolik yuz berdi");
    },
  });

  // ── Loading state ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="col-span-3 px-4 py-3 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded" />
        ))}
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="col-span-3 px-4 py-3 text-xs text-red-500 dark:text-red-400">
        Ma'lumotlarni yuklashda xatolik yuz berdi
      </div>
    );
  }

  const items: ExpectedCargoItem[] = data?.items ?? [];

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <div className="col-span-3 flex flex-col items-center py-6 gap-2 text-zinc-400 dark:text-zinc-500">
        <PackageX className="size-7 opacity-50" />
        <p className="text-xs">Hech qanday trek kodi topilmadi</p>
      </div>
    );
  }

  // ── Normal state: track code rows as grid cells ──────────────────────────────

  return (
    <>
      {/* Edit mode action bar — spans all 3 columns */}
      {isEditMode && (
        <div className="col-span-3 flex items-center justify-between px-3 py-1.5 bg-orange-50/60 dark:bg-orange-950/20 border-t border-orange-100 dark:border-orange-900/30">
          <span className="text-[11px] text-orange-600 dark:text-orange-400 font-medium">
            {items.length} ta trek kodi
          </span>
          <div className="flex items-center gap-2">
            {deleteMutation.isPending && (
              <Loader2 className="size-3.5 text-zinc-400 animate-spin" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRequestReplace(clientCode);
              }}
              className="flex items-center gap-1 text-[11px] text-orange-500 hover:text-orange-600 dark:text-orange-400 font-medium"
            >
              <RefreshCw className="size-3" />
              Almashtirish
            </button>
          </div>
        </div>
      )}

      {/* One group of 3 grid cells per track code */}
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {/* Col 1: row number — identical for all expanded rows of this client */}
          <div className="flex items-center justify-center h-10 border-t border-zinc-100 dark:border-zinc-800 text-[13px] font-medium text-zinc-500 dark:text-zinc-400 select-none bg-[#ffffff] dark:bg-[#1a1a1a]">
            {rowNumber}
          </div>

          {/* Col 2: client code — only visible on the first track code row,
              giving the "merged cell" look for all subsequent rows */}
          <div className="flex items-center h-10 border-t border-l border-zinc-100 dark:border-zinc-800 px-2 bg-[#ffffff] dark:bg-[#1a1a1a]">
            {index === 0 && (
              <span className="text-sm font-bold text-orange-600 dark:text-orange-500 truncate">
                {clientCode}
              </span>
            )}
          </div>

          {/* Col 3: track code + optional per-row delete button */}
          <div className="flex items-center justify-between h-10 border-t border-l border-zinc-100 dark:border-zinc-800 px-3 bg-[#ffffff] dark:bg-[#1a1a1a]">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
              {item.track_code}
            </span>
            {isEditMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate({ id: item.id, trackCode: item.track_code });
                }}
                className="flex-shrink-0 p-1 text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors bg-red-50 dark:bg-red-500/10 rounded-md"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </Fragment>
      ))}
    </>
  );
}
