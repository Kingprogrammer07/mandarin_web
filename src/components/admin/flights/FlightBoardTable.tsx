/**
 * Section 3: every flight in the database, and the switch that decides whether
 * it appears in the two sections above.
 *
 * **Reordering is written by hand rather than with a drag library.** The two
 * obvious candidates both fail here: HTML5 drag-and-drop does not fire on
 * touch, and this product is opened on phones; `dnd-kit` fixes that for ~10 kB
 * gzip on a page that needs one list reordered. Pointer events cover mouse,
 * pen and touch in one code path.
 *
 * Dragging is never the only way to move a row. A pointer gesture is invisible
 * to a keyboard and to a screen reader, so every row also carries up/down
 * buttons that do the same thing and say so.
 */

import { useCallback, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, RotateCw, Search } from 'lucide-react';

import type { FlightDashboardItem } from '@/api/services/flightSchedule';
import { triggerSoftHaptic } from '@/utils/haptics';

import { BOARD_STATUS_FILTERS, boardStatusOf, type BoardStatus } from './boardStatus';

import { EmptyNote, SectionCard, TileSkeleton } from '../dashboard/DashboardPrimitives';

const STATUS_META: Record<BoardStatus, { label: string; chip: string }> = {
  visible: {
    label: 'Ko‘rinmoqda',
    chip: 'border-mc-success/25 bg-mc-success/12 text-mc-success',
  },
  new: {
    label: 'Yangi',
    chip: 'border-mc-brand/25 bg-mc-brand-soft text-mc-brand',
  },
  archived: {
    label: 'Arxiv',
    chip: 'border-mc-border bg-mc-surface-2 text-mc-text-2',
  },
};

function VisibilityToggle({
  flightName,
  isOn,
  isBusy,
  onToggle,
}: {
  flightName: string;
  isOn: boolean;
  isBusy: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={`${flightName} — taxtada ko‘rsatish`}
      disabled={isBusy}
      onClick={() => {
        triggerSoftHaptic();
        onToggle();
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 disabled:opacity-50 ${
        isOn ? 'bg-mc-brand' : 'bg-mc-surface-2 border border-mc-border'
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow transition-transform duration-150 ${
          isOn ? 'translate-x-[22px]' : 'translate-x-[3px]'
        }`}
        style={{ height: 18, width: 18 }}
        aria-hidden="true"
      />
    </button>
  );
}

export function FlightBoardTable({
  flights,
  total,
  page,
  totalPages,
  isLoading,
  isError,
  onRetry,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onPageChange,
  onToggleVisibility,
  onReorder,
  firstRowIndex,
  pendingFlight,
  canManage,
}: {
  flights: FlightDashboardItem[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: 'all' | BoardStatus;
  onStatusFilterChange: (value: 'all' | BoardStatus) => void;
  onPageChange: (page: number) => void;
  onToggleVisibility: (flight: FlightDashboardItem) => void;
  /** Global positions in the full filtered list, not page-local ones. */
  onReorder: (from: number, to: number) => void;
  /** Index of this page's first row inside the full filtered list. */
  firstRowIndex: number;
  /** Name of the flight whose toggle is in flight, so only that row disables. */
  pendingFlight: string | null;
  canManage: boolean;
}) {
  const [dragging, setDragging] = useState<string | null>(null);

  const names = flights.map((f) => f.name);

  // Page-local index in, global index out: the board is paginated but its order
  // is not, so moving row 1 of page 2 must land at position 13, not 1.
  const move = useCallback(
    (fromRow: number, toRow: number) => {
      if (toRow < 0 || toRow >= names.length || fromRow === toRow) return;
      triggerSoftHaptic();
      onReorder(firstRowIndex + fromRow, firstRowIndex + toRow);
    },
    [firstRowIndex, names.length, onReorder],
  );

  const startDrag = useCallback(
    (event: React.PointerEvent, index: number) => {
      if (!canManage) return;
      event.preventDefault();
      const name = names[index];
      setDragging(name);
      const rows = Array.from(
        (event.currentTarget as HTMLElement)
          .closest('[data-board-rows]')
          ?.querySelectorAll('[data-board-row]') ?? [],
      ) as HTMLElement[];

      let target = index;

      const onMove = (moveEvent: PointerEvent) => {
        const hit = rows.findIndex((row) => {
          const box = row.getBoundingClientRect();
          return moveEvent.clientY >= box.top && moveEvent.clientY <= box.bottom;
        });
        if (hit >= 0) target = hit;
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        setDragging(null);
        move(index, target);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [canManage, move, names],
  );

  return (
    <SectionCard
      title="Reyslar bazasi va ko‘rinish nazorati"
      subtitle="Yuqoridagi 1- va 2-bo‘limda qaysi reys chiqishi shu yerda boshqariladi"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tabular-nums text-mc-text-3">
            Jami {total} ta reys
          </span>
          {totalPages > 1 && (
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                aria-label="Oldingi sahifa"
                className="flex h-9 w-9 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text-2 disabled:opacity-40"
              >
                ‹
              </button>
              <span className="min-w-[36px] rounded-mc-sm bg-mc-brand px-2 py-1.5 text-center text-[12px] font-extrabold tabular-nums text-mc-on-brand">
                {page}
              </span>
              <button
                type="button"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                aria-label="Keyingi sahifa"
                className="flex h-9 w-9 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text-2 disabled:opacity-40"
              >
                ›
              </button>
            </span>
          )}
        </div>
      }
    >
      <p className="mb-3 flex items-start gap-2 rounded-mc-md border border-mc-brand/15 bg-mc-brand-soft px-3 py-2 text-[11px] font-medium text-mc-text-2">
        <span aria-hidden="true">ℹ</span>
        Reys qo‘shilganda avtomatik bazaga tushadi. Yuqorida chiqishi uchun
        KO‘RSATISH tugmasini yoqing.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="relative min-w-[180px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mc-text-3"
            strokeWidth={2}
            aria-hidden="true"
          />
          {/* 16px, not 13px: below that iOS zooms the page on focus and does
              not zoom back out. */}
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Reys nomi bo‘yicha qidirish"
            aria-label="Reys nomi bo‘yicha qidirish"
            className="h-11 w-full rounded-mc-md border border-mc-border bg-mc-surface-2 pl-9 pr-3 text-[16px] font-medium text-mc-text placeholder:text-mc-text-3 focus:border-mc-brand focus:outline-none"
          />
        </span>
        <select
          value={statusFilter}
          onChange={(event) =>
            onStatusFilterChange(event.target.value as 'all' | BoardStatus)
          }
          aria-label="Holat bo‘yicha filtr"
          className="h-11 rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 text-[16px] font-medium text-mc-text focus:border-mc-brand focus:outline-none"
        >
          {BOARD_STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRetry}
          aria-label="Yangilash"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-md border border-mc-border text-mc-text-2 transition-transform active:scale-95"
        >
          <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={2} />
        </button>
      </div>

      {isLoading && flights.length === 0 ? (
        <div className="space-y-2">
          <TileSkeleton />
          <TileSkeleton />
          <TileSkeleton />
        </div>
      ) : isError ? (
        <div className="rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-6 text-center">
          <p className="text-[12px] font-semibold text-mc-text-3">Yuklanmadi</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-[11px] font-bold text-mc-brand active:scale-95"
          >
            <RotateCw className="h-3 w-3" strokeWidth={2.2} />
            Qayta urinish
          </button>
        </div>
      ) : flights.length === 0 ? (
        <EmptyNote text="Bu filtr bo‘yicha reys topilmadi" />
      ) : (
        <>
          <div className="hidden px-2 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-mc-text-3 sm:flex">
            <span className="flex-1">Reys nomi</span>
            <span className="w-[110px]">Holat</span>
            <span className="w-[90px] text-right">Treklar</span>
            <span className="w-[92px] text-right">Ko‘rsatish</span>
          </div>

          <ul className="space-y-1" data-board-rows>
            {flights.map((flight, index) => {
              const status = boardStatusOf(flight);
              const meta = STATUS_META[status];
              const trackCount =
                flight.stats.expected_track_codes || flight.stats.cargo_count || 0;
              return (
                <li
                  key={flight.name}
                  data-board-row
                  /*
                    A grabbed row has to look picked up, not merely tinted. The
                    previous version changed only the border and background,
                    which at a glance is indistinguishable from hover — the
                    complaint was not being able to tell whether the grab had
                    taken at all.

                    Elevation and a ring, never a transform: a scaled row would
                    become the containing block for any `position: fixed`
                    descendant, which is exactly the bug that broke the admin
                    overlays. The other rows dim so the moving one is the only
                    thing at full contrast.
                  */
                  className={`relative flex items-center gap-2 rounded-mc-md border px-2 py-2 transition-[background-color,border-color,box-shadow,opacity] duration-150 ${
                    dragging === flight.name
                      ? 'z-10 border-mc-brand bg-mc-brand-soft shadow-[var(--mc-shadow-cta)] ring-2 ring-mc-brand/30'
                      : dragging
                        ? 'border-mc-border bg-mc-surface-2 opacity-55'
                        : 'border-mc-border bg-mc-surface-2'
                  }`}
                >
                  {canManage && (
                    <span
                      onPointerDown={(event) => startDrag(event, index)}
                      className={`flex h-9 w-6 shrink-0 touch-none items-center justify-center transition-colors ${
                        dragging === flight.name
                          ? 'cursor-grabbing text-mc-brand'
                          : 'cursor-grab text-mc-text-3 hover:text-mc-text-2'
                      }`}
                      aria-hidden="true"
                    >
                      <GripVertical
                        className="h-4 w-4"
                        strokeWidth={dragging === flight.name ? 2.6 : 2}
                      />
                    </span>
                  )}

                  <span
                    className="min-w-0 flex-1 truncate text-[13px] font-bold text-mc-text"
                    title={flight.name}
                  >
                    {flight.name}
                  </span>

                  <span className="w-[110px] shrink-0">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${meta.chip}`}
                    >
                      {meta.label}
                    </span>
                  </span>

                  <span className="w-[90px] shrink-0 text-right text-[11px] font-semibold tabular-nums text-mc-text-2">
                    {trackCount} trek
                  </span>

                  <span className="flex w-[92px] shrink-0 items-center justify-end gap-1">
                    {canManage && (
                      <span className="flex flex-col">
                        {/* Drag is invisible to a keyboard; these are not. */}
                        <button
                          type="button"
                          onClick={() => move(index, index - 1)}
                          disabled={index === 0}
                          aria-label={`${flight.name} — yuqoriga`}
                          className="flex h-5 w-5 items-center justify-center text-mc-text-3 disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.4} />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, index + 1)}
                          disabled={index === flights.length - 1}
                          aria-label={`${flight.name} — pastga`}
                          className="flex h-5 w-5 items-center justify-center text-mc-text-3 disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.4} />
                        </button>
                      </span>
                    )}
                    <VisibilityToggle
                      flightName={flight.name}
                      isOn={Boolean(flight.is_visible)}
                      isBusy={!canManage || pendingFlight === flight.name}
                      onToggle={() => onToggleVisibility(flight)}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </SectionCard>
  );
}
