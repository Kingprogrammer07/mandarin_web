/**
 * Reyslar — the flight board.
 *
 * Three sections, and the third one drives the other two: a flight appears in
 * "Foto hisobot" and "Trek kod" only once it is switched on below, in the order
 * set there. Before this the two lists showed "the newest five active flights",
 * so the board rearranged itself whenever a manifest landed and there was no
 * way to pin the flights actually being worked on.
 *
 * **The whole list is fetched once and filtered in the browser.** The previous
 * version issued a request per keystroke with no debounce and no cancellation,
 * so a slow response for "M2" could land after "M26" and repaint the older
 * result. There are 49 flights; one request of at most 100 removes the race
 * rather than papering over it with a timer. If the count ever passes what one
 * page can hold, the footer says so instead of silently truncating.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  FileImage,
  LogOut,
  Package,
  Plus,
  ShieldAlert,
  Users,
  Weight,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { getAdminJwtClaims } from '@/api/services/adminManagement';
import { createEmptyFlight } from '@/api/services/expectedCargo';
import {
  getFlightBoardSummary,
  getFlightsDashboard,
  setFlightBoardOrder,
  setFlightVisibility,
  type FlightDashboardItem,
} from '@/api/services/flightSchedule';
import { FlightBoardCards } from '@/components/admin/flights/FlightBoardCards';
import { FlightBoardTable } from '@/components/admin/flights/FlightBoardTable';
import {
  FlightUploadSection,
  type FlightMeta,
} from '@/components/admin/flights/FlightUploadSection';
import {
  boardStatusOf,
  compareBoardOrder,
  lastImportLabel,
  type BoardStatus,
} from '@/components/admin/flights/boardStatus';
import { formatWeightKg } from '@/lib/format';
import { useExpectedCargoStore } from '@/store/expectedCargoStore';

/** The API caps a page at 100; the board is read in one request. */
const BOARD_FETCH_SIZE = 100;
const ROWS_PER_PAGE = 12;

interface FlightsPageProps {
  onSelectFlight: (flightName: string) => void;
  onLogout?: () => void;
  onNavigate?: (page: string) => void;
  /** True when AdminLayout already supplies the header, sidebar and account menu. */
  embedded?: boolean;
}

function AccessDenied() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-mc-lg bg-mc-surface-2">
        <ShieldAlert className="h-8 w-8 text-mc-text-3" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[16px] font-bold text-mc-text">Ruxsat yo‘q</p>
        <p className="mt-1 max-w-xs text-[13px] text-mc-text-3">
          Sizda bu sahifani ochish uchun huquq yo‘q.
        </p>
      </div>
    </div>
  );
}

/**
 * Add-flight sheet.
 *
 * Written with the modal rules this project already states and the old one
 * ignored: Escape closes it, focus is trapped inside, the page behind stops
 * scrolling, and it announces itself as a dialog.
 */
function AddFlightModal({
  onClose,
  onCreate,
  isCreating,
  error,
}: {
  onClose: () => void;
  onCreate: (name: string) => void;
  isCreating: boolean;
  error: string | null;
}) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-flight-title"
        className="relative w-full max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-mc-xl border border-mc-border bg-mc-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[var(--mc-shadow-card)] sm:max-w-md sm:rounded-mc-xl sm:pb-4"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="add-flight-title" className="text-[16px] font-extrabold text-mc-text">
            Kutilayotgan reys qo‘shish
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-3"
          >
            <X className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) onCreate(name.trim());
          }}
        >
          <label
            htmlFor="add-flight-name"
            className="mb-1.5 block text-[12px] font-semibold text-mc-text-2"
          >
            Reys nomi
          </label>
          <input
            id="add-flight-name"
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Masalan: M266"
            className="h-11 w-full rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 text-[16px] font-medium text-mc-text placeholder:text-mc-text-3 focus:border-mc-brand focus:outline-none"
          />
          {error && (
            <p className="mt-1.5 text-[12px] font-semibold text-mc-danger">{error}</p>
          )}
          <p className="mt-1.5 text-[11px] font-medium text-mc-text-3">
            Reys bazaga qo‘shiladi. Yuqoridagi bo‘limlarda chiqishi uchun jadvaldan
            KO‘RSATISH tugmasini yoqing.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-mc-md border border-mc-border text-[13px] font-bold text-mc-text-2"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="h-11 flex-1 rounded-mc-md bg-mc-brand text-[13px] font-extrabold text-mc-on-brand disabled:opacity-50"
            >
              {isCreating ? 'Saqlanmoqda…' : 'Qo‘shish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FlightsPage({
  onSelectFlight,
  onLogout,
  onNavigate,
  embedded = false,
}: FlightsPageProps) {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const queryClient = useQueryClient();

  const claims = useMemo(() => getAdminJwtClaims(), []);
  const canView = claims.isSuperAdmin || claims.permissions.has('flights:read');
  const canManage = claims.isSuperAdmin || claims.permissions.has('flights:update');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BoardStatus>('all');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingFlight, setPendingFlight] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ['flights-board', 'summary'],
    queryFn: getFlightBoardSummary,
    enabled: canView,
    staleTime: 60_000,
  });

  const board = useQuery({
    queryKey: ['flights-board', 'all'],
    queryFn: () =>
      getFlightsDashboard({
        page: 1,
        per_page: BOARD_FETCH_SIZE,
        status: 'all',
        type: 'all',
        sort: 'newest',
      }),
    enabled: canView,
    staleTime: 60_000,
  });

  const visible = useQuery({
    queryKey: ['flights-board', 'visible'],
    queryFn: () =>
      getFlightsDashboard({
        page: 1,
        per_page: BOARD_FETCH_SIZE,
        status: 'all',
        type: 'all',
        visible_only: true,
      }),
    enabled: canView,
    staleTime: 60_000,
  });

  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['flights-board'] });
  }, [queryClient]);

  const toggleVisibility = useMutation({
    mutationFn: (flight: FlightDashboardItem) =>
      setFlightVisibility(flight.name, !flight.is_visible),
    onMutate: (flight) => setPendingFlight(flight.name),
    onSuccess: (_data, flight) => {
      toast.success(
        flight.is_visible
          ? `${flight.name} yashirildi`
          : `${flight.name} yoqildi`,
      );
      refreshAll();
    },
    onError: () => toast.error('Ko‘rinishni o‘zgartirib bo‘lmadi'),
    onSettled: () => setPendingFlight(null),
  });

  const reorder = useMutation({
    mutationFn: (names: string[]) => setFlightBoardOrder(names),
    onSuccess: refreshAll,
    onError: () => {
      toast.error('Tartibni saqlab bo‘lmadi');
      refreshAll();
    },
  });

  const createFlight = useMutation({
    mutationFn: (flightName: string) => createEmptyFlight({ flight_name: flightName }),
    onSuccess: (_data, flightName) => {
      setAddOpen(false);
      setCreateError(null);
      toast.success(`${flightName} qo‘shildi`);
      refreshAll();
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message)
          : 'Reys qo‘shib bo‘lmadi';
      setCreateError(message);
    },
  });

  const allFlights = useMemo(() => board.data?.items ?? [], [board.data]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const serverIndex = new Map(allFlights.map((flight, index) => [flight.name, index]));
    return allFlights
      .filter((flight) => {
        if (query && !flight.name.toLowerCase().includes(query)) return false;
        if (statusFilter !== 'all' && boardStatusOf(flight) !== statusFilter) return false;
        return true;
      })
      .sort(compareBoardOrder(serverIndex));
  }, [allFlights, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  // Clamped rather than reset in an effect: a filter that shrinks the list to
  // one page must not leave the reader staring at an empty page 3, and clearing
  // the filter then returns them to where they were.
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  /**
   * Move one flight and renumber the WHOLE filtered list.
   *
   * The table shows twelve rows at a time; sending only those would leave
   * positions on other pages untouched and colliding. Sending everything makes
   * the order explicit for every row in one write — there are at most a
   * hundred names, so the cost is a single small request.
   */
  const handleReorder = useCallback(
    (from: number, to: number) => {
      const names = filtered.map((flight) => flight.name);
      if (to < 0 || to >= names.length || from === to) return;
      const next = [...names];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      reorder.mutate(next);
    },
    [filtered, reorder],
  );

  /**
   * Open the track-code page ON the flight that was clicked.
   *
   * The route is a bare `/admin/expected-cargo` with no flight in it, and the
   * page takes no flight prop — it reads `activeFlightName` from its own store
   * and auto-selects the first tab when that is empty. Setting the store before
   * navigating is therefore the only way to land on a chosen flight; without it
   * every row in this section opened whatever tab happened to be first, which
   * is indistinguishable from the click being ignored.
   *
   * If the name has no tab on that page (its list comes from
   * `expected_flight_cargos` alone), the page falls back to its first tab —
   * which is what it did before, so nothing regresses.
   */
  const openTrackImport = useCallback(
    (flightName: string) => {
      useExpectedCargoStore.getState().setActiveFlight(flightName);
      onNavigate?.('expected-cargo');
    },
    [onNavigate],
  );

  const visibleFlights = visible.data?.items ?? [];

  const photoMeta = useCallback(
    (flight: FlightDashboardItem): FlightMeta[] => [
      {
        Icon: Weight,
        text: formatWeightKg(flight.stats.total_weight_kg),
        title: 'Omborda tortilgan vazn',
      },
      { Icon: Users, text: `${flight.stats.client_count} mijoz` },
      {
        Icon: Package,
        text: `${flight.stats.expected_track_codes || flight.stats.cargo_count} trek`,
      },
    ],
    [],
  );

  const trackMeta = useCallback(
    (flight: FlightDashboardItem): FlightMeta[] => [
      {
        Icon: Package,
        text: `${flight.stats.expected_track_codes || flight.stats.cargo_count} trek`,
      },
      { Icon: FileImage, text: lastImportLabel(flight, language) },
    ],
    [language],
  );

  if (!canView) return <AccessDenied />;

  const truncated = (board.data?.total ?? 0) > allFlights.length;

  return (
    <div className={embedded ? 'space-y-4' : 'mx-auto max-w-6xl space-y-4 px-4 py-4'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-mc-text">
            Reyslar
          </h1>
          <p className="mt-0.5 text-[12px] font-medium text-mc-text-2">
            Toshkent omboriga kelgan yuklar uchun reyslarni boshqarish
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setAddOpen(true);
              }}
              className="inline-flex h-11 items-center gap-1.5 rounded-mc-md bg-mc-brand px-4 text-[13px] font-extrabold text-mc-on-brand transition-transform active:scale-95"
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              Reys qo‘shish
            </button>
          )}
          {/* Only when the shell is absent. AdminLayout carries logout in its
              account menu; a worker gets this page and nothing else, so without
              it there is no way out of the app at all. */}
          {!embedded && onLogout && (
            <button
              type="button"
              onClick={onLogout}
              aria-label="Chiqish"
              title="Chiqish"
              className="flex h-11 w-11 items-center justify-center rounded-mc-md border border-mc-border text-mc-text-2 transition-transform active:scale-95"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <FlightBoardCards summary={summary.data} isLoading={summary.isLoading} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <FlightUploadSection
            title="1. Foto hisobot yuklash"
            subtitle="Omborga kelgan yuklar uchun foto hisobot"
            flights={visibleFlights}
            isLoading={visible.isLoading}
            isError={visible.isError}
            onRetry={refreshAll}
            onSelect={onSelectFlight}
            renderMeta={photoMeta}
            footerLabel="Ko‘rinayotganlarni boshqarish"
            // Filters the table below to exactly what this section lists, so
            // the link leads somewhere. `setStatusFilter('all')` was a no-op
            // whenever the filter was already "all", which is its default.
            onFooterClick={() => setStatusFilter('visible')}
          />
          <FlightUploadSection
            title="2. Trek kod yuklash"
            subtitle="Trek kodlarni yuklash va bazaga kiritish"
            flights={visibleFlights}
            isLoading={visible.isLoading}
            isError={visible.isError}
            onRetry={refreshAll}
            onSelect={openTrackImport}
            renderMeta={trackMeta}
            footerLabel="Kutilayotgan yuklar"
            onFooterClick={() => onNavigate?.('expected-cargo')}
          />
        </div>

        <div className="space-y-2">
          <FlightBoardTable
            flights={rows}
            firstRowIndex={(safePage - 1) * ROWS_PER_PAGE}
            total={filtered.length}
            page={safePage}
            totalPages={totalPages}
            isLoading={board.isLoading}
            isError={board.isError}
            onRetry={refreshAll}
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onPageChange={setPage}
            onToggleVisibility={(flight) => toggleVisibility.mutate(flight)}
            onReorder={handleReorder}
            pendingFlight={pendingFlight}
            canManage={canManage}
          />
          {truncated && (
            // Never a silent cut: the reader has to know the table is not the
            // whole database before they conclude a flight is missing.
            <p className="px-1 text-[11px] font-medium text-mc-warn">
              {board.data?.total} reysdan birinchi {allFlights.length} tasi
              ko‘rsatilmoqda.
            </p>
          )}
        </div>
      </div>

      {addOpen && (
        <AddFlightModal
          onClose={() => setAddOpen(false)}
          onCreate={(name) => createFlight.mutate(name)}
          isCreating={createFlight.isPending}
          error={createError}
        />
      )}
    </div>
  );
}
