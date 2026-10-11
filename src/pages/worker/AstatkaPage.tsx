import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Package,
  PackagePlus,
  PackageSearch,
  Users,
  Weight,
} from "lucide-react";

import { listAstatka, type Astatka } from "@/api/services/astatka";
import {
  astatkaPackagesQueryKey,
  astatkaStatsQueryKey,
  getAstatkaFlightStats,
  type AstatkaFlightStats,
} from "@/api/services/astatkaFlights";
import {
  getFlightsDashboard,
  type FlightDashboardItem,
} from "@/api/services/flightSchedule";
import { AstatkaExtractDialog } from "@/components/astatka/AstatkaExtractDialog";
import { AstatkaItemSheet } from "@/components/astatka/AstatkaItemSheet";
import { AstatkaScanner } from "@/components/astatka/AstatkaScanner";
import { isAstatkaFlightName } from "@/lib/astatkaFlight";
import { formatKg } from "@/lib/astatkaFormat";
import { formatWeightKg } from "@/lib/format";
import { astatkaStore, type QueuedItem } from "@/utils/astatkaStore";

/**
 * Astatka — leftover cargo.
 *
 * An astatka flight is an ordinary flight whose name starts with "O", created
 * on the expected-cargo page like any other. This page lists every one of them
 * REGARDLESS of the board's visibility switch: that switch decides whether a
 * flight is offered for photo report and track-code upload, not whether it is
 * an astatka flight.
 *
 * Each flight card opens the astatka window (work mode + saved list); beside
 * it, "Astatka ajratish" pulls untaken bags out of old flights and "Yuborish"
 * opens the same client notification screen a flight's photo page has.
 *
 * Stock-takes recorded before astatka moved onto flights are still listed below
 * (only when there are any), so their parcels stay reachable. New ones are no
 * longer created here.
 *
 * Two views in one page rather than two routes: the worker moves between the
 * list and the scanner constantly, and a route change on a phone means a
 * remount, a refetch and a lost scan field.
 */

/** The API caps a page at 100; astatka flights are a small subset of that. */
const ASTATKA_FLIGHTS_FETCH_SIZE = 100;

interface Props {
  onBack: () => void;
  /**
   * True when rendered inside AdminLayout, which already supplies a header, a
   * bottom navigation bar and its own floating button. A page that also brings
   * `min-h-dvh`, a sticky header and a fixed FAB then fights all three: two
   * headers stack, the FAB lands underneath the nav bar, and the content sits
   * in a tall empty column. Same reason FlightsPage takes this prop.
   */
  embedded?: boolean;
  /** Opens the astatka window of one flight. */
  onOpenAstatka: (flightName: string) => void;
  /** Opens the client notification screen of one flight. */
  onSendAstatka: (flightName: string) => void;
}

export function AstatkaPage({
  onBack,
  embedded = false,
  onOpenAstatka,
  onSendAstatka,
}: Props) {
  const queryClient = useQueryClient();
  const flightsQuery = useQuery({
    // Under the board's key so a visibility change made on /flights, which
    // invalidates ['flights-board'], refreshes the badge here as well.
    queryKey: ["flights-board", "astatka"],
    queryFn: () =>
      getFlightsDashboard({
        page: 1,
        per_page: ASTATKA_FLIGHTS_FETCH_SIZE,
        status: "all",
        type: "ostatka",
        sort: "newest",
      }),
    staleTime: 60_000,
  });

  // `type: "ostatka"` also covers the older `A-` leftover flights; this page
  // shows only the "O" ones.
  const astatkaFlights = useMemo(
    () =>
      (flightsQuery.data?.items ?? []).filter((flight) =>
        isAstatkaFlightName(flight.name),
      ),
    [flightsQuery.data],
  );

  // Secondary list: its own failure stays silent, because the flights above
  // already carry the page's error state for the same lost connection.
  const legacyQuery = useQuery({
    queryKey: ["astatka", "stock-takes"],
    queryFn: listAstatka,
    staleTime: 60_000,
  });
  const legacyStockTakes = legacyQuery.data ?? [];

  // Counts of saved bags per astatka flight. A failure only hides the counts;
  // the cards and their buttons still work.
  const statsQuery = useQuery({
    queryKey: astatkaStatsQueryKey,
    queryFn: getAstatkaFlightStats,
    staleTime: 30_000,
  });
  const statsByFlight = useMemo(() => {
    const map = new Map<string, AstatkaFlightStats>();
    for (const item of statsQuery.data ?? []) {
      map.set(item.astatka_flight_name.trim().toUpperCase(), item);
    }
    return map;
  }, [statsQuery.data]);

  const [extractFor, setExtractFor] = useState<string | null>(null);

  const [active, setActive] = useState<Astatka | null>(null);

  const [editItem, setEditItem] = useState<QueuedItem | null>(null);
  const [editIsNew, setEditIsNew] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const retry = () => {
    void flightsQuery.refetch();
    void legacyQuery.refetch();
  };

  const handleEditItem = useCallback((item: QueuedItem) => {
    setEditItem(item);
    setEditIsNew(false);
  }, []);

  const handleManualEntry = useCallback(
    async (seed: Partial<QueuedItem> & { trackCode: string }) => {
      // The scanner has already persisted the row; re-read it so the sheet
      // edits the stored object rather than a copy that could drift from it.
      const rows = await astatkaStore.listForAstatka(seed.astatkaId ?? 0);
      const stored = rows.find((row) => row.id === seed.id) ?? null;
      if (stored) {
        setEditItem(stored);
        setEditIsNew(true);
      }
    },
    [],
  );

  if (active) {
    // Full screen even when embedded. The scan field has to own the viewport —
    // it must stay under the thumb and keep focus for hundreds of parcels, and
    // a shell header plus a bottom nav bar around it would cost both. The till
    // screens take over the same way and for the same reason.
    return (
      <div className={embedded ? 'fixed inset-0 z-50 bg-mc-bg' : undefined}>
        <AstatkaScanner
          key={active.id}
          astatka={active}
          onBack={() => {
            setActive(null);
            void legacyQuery.refetch();
          }}
          onEditItem={handleEditItem}
          onManualEntry={handleManualEntry}
        />
        <AstatkaItemSheet
          open={editItem !== null}
          item={editItem}
          isNew={editIsNew}
          onClose={() => setEditItem(null)}
          onSaved={() => setRefreshToken((value) => value + 1)}
          key={`sheet-${editItem?.id ?? "none"}-${refreshToken}`}
        />
      </div>
    );
  }

  return (
    <div
      className={
        embedded ? "space-y-3" : "flex h-dvh flex-col bg-mc-bg"
      }
    >
      {/* Embedded, the shell already provides a header and a back path, so this
          is a plain title row. Standalone, it is the page's own sticky chrome. */}
      {embedded ? (
        <div className="min-w-0">
          <h1 className="truncate text-[16px] font-extrabold text-mc-text">
            Astatka
          </h1>
          <p className="mt-0.5 text-[12px] font-medium text-mc-text-3">
            Nomi «O» bilan boshlanadigan reyslar
          </p>
        </div>
      ) : (
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-mc-border bg-mc-surface px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Orqaga"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-2"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[16px] font-extrabold text-mc-text">
              Astatka
            </h1>
            <p className="truncate text-[11px] font-medium text-mc-text-3">
              Nomi «O» bilan boshlanadigan reyslar
            </p>
          </div>
        </header>
      )}

      <main
        className={
          embedded
            ? ""
            : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-4"
        }
      >
        {/* Desktop first, but a list of a handful of cards reads badly at
            1920px wide; it is held to a comfortable column. */}
        <div className={embedded ? undefined : "mx-auto w-full max-w-5xl"}>
        {flightsQuery.isLoading && (
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-[76px] animate-pulse rounded-mc-lg bg-mc-surface-2"
              />
            ))}
          </div>
        )}

        {flightsQuery.isError && (
          <div className="mt-3 rounded-mc-md border border-mc-danger/30 bg-mc-danger-soft p-3">
            <p className="text-[12px] font-semibold text-mc-danger">
              Ro‘yxatni olib bo‘lmadi. Internetni tekshiring.
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-2 h-11 w-full rounded-mc-sm border border-mc-border bg-mc-surface text-[13px] font-bold text-mc-text"
            >
              Qayta urinish
            </button>
          </div>
        )}

        {flightsQuery.isSuccess && astatkaFlights.length === 0 && (
          <div className="mt-12 text-center">
            <PackageSearch
              className="mx-auto h-9 w-9 text-mc-text-3"
              strokeWidth={1.7}
            />
            <p className="mt-3 text-[14px] font-bold text-mc-text-2">
              Hali astatka reysi yo‘q
            </p>
            <p className="mx-auto mt-1 max-w-[280px] text-[12px] font-medium text-mc-text-3">
              Astatka reysi «Kutilayotgan yuklar» sahifasida boshqa reyslar kabi
              yaratiladi. Nomi «O» bilan boshlansin, masalan OSTATKA-11.10.
            </p>
          </div>
        )}

        <ul className="@container mt-3 space-y-2">
          {astatkaFlights.map((flight) => (
            <li key={flight.name}>
              <AstatkaFlightCard
                flight={flight}
                stats={statsByFlight.get(flight.name.trim().toUpperCase()) ?? null}
                onOpen={() => onOpenAstatka(flight.name)}
                onExtract={() => setExtractFor(flight.name)}
                onSend={() => onSendAstatka(flight.name)}
              />
            </li>
          ))}
        </ul>

        {legacyStockTakes.length > 0 && (
          <section className="mt-6">
            <h2 className="px-1 text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
              Oldingi astatka hisoblari
            </h2>
            <ul className="mt-2 space-y-2">
              {legacyStockTakes.map((astatka) => (
                <li key={astatka.id}>
                  <LegacyStockTakeCard
                    astatka={astatka}
                    onOpen={() => setActive(astatka)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
        </div>
      </main>

      {extractFor && (
        <AstatkaExtractDialog
          flightName={extractFor}
          open
          onOpenChange={(open) => !open && setExtractFor(null)}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: astatkaStatsQueryKey });
            void queryClient.invalidateQueries({
              queryKey: astatkaPackagesQueryKey(extractFor),
            });
          }}
        />
      )}
    </div>
  );
}

interface AstatkaFlightCardProps {
  flight: FlightDashboardItem;
  stats: AstatkaFlightStats | null;
  onOpen: () => void;
  onExtract: () => void;
  onSend: () => void;
}

/**
 * One astatka flight. The card itself opens the astatka window; the two
 * buttons beside it pull leftovers in and notify clients. Visibility is
 * switched on the Reyslar board — the chip only reports it.
 */
function AstatkaFlightCard({
  flight,
  stats,
  onOpen,
  onExtract,
  onSend,
}: AstatkaFlightCardProps) {
  const trackCount =
    flight.stats.expected_track_codes || flight.stats.cargo_count;
  const clientCount =
    flight.stats.expected_clients || flight.stats.client_count;
  const isVisible = flight.is_visible === true;

  return (
    <div className="flex flex-col gap-2 rounded-mc-lg border border-mc-border bg-mc-surface p-2 shadow-[var(--mc-shadow-card)] @xl:flex-row @xl:items-center">
      <button
        type="button"
        onClick={onOpen}
        title="Astatka oynasini ochish"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-mc-md p-1.5 text-left active:scale-[0.99]"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            {/* Wrapped, never truncated: the flight name is how the worker
                tells two astatka flights apart. */}
            <span className="min-w-0 flex-1 break-words text-[15px] font-extrabold text-mc-text">
              {flight.name}
            </span>
            <span
              title={
                isVisible
                  ? "Foto hisobot va trek kod bo‘limlarida ko‘rinadi"
                  : "Foto hisobot va trek kod bo‘limlarida ko‘rinmaydi. Reyslar sahifasida yoqiladi."
              }
              className={
                isVisible
                  ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-mc-success/12 px-2 py-0.5 text-[11px] font-bold text-mc-success"
                  : "inline-flex shrink-0 items-center gap-1 rounded-full bg-mc-surface-2 px-2 py-0.5 text-[11px] font-bold text-mc-text-3"
              }
            >
              {isVisible ? (
                <Eye className="h-3.5 w-3.5" strokeWidth={2.2} />
              ) : (
                <EyeOff className="h-3.5 w-3.5" strokeWidth={2.2} />
              )}
              {isVisible ? "Ko‘rinmoqda" : "Yashirin"}
            </span>
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-mc-text-2">
            <span className="inline-flex items-center gap-1">
              <Package className="h-3.5 w-3.5" strokeWidth={2} />
              {trackCount} trek
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" strokeWidth={2} />
              {clientCount} mijoz
            </span>
            {flight.stats.total_weight_kg > 0 && (
              <span className="inline-flex items-center gap-1">
                <Weight className="h-3.5 w-3.5" strokeWidth={2} />
                {formatWeightKg(flight.stats.total_weight_kg)}
              </span>
            )}
          </span>
          {stats && stats.expected + stats.confirmed > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-mc-warn-soft px-2 py-0.5 text-[11px] font-bold tabular-nums text-mc-warn">
                <Clock className="h-3 w-3" />
                {stats.expected} ta kutilmoqda
                {stats.expected_weight_kg > 0 && ` · ${formatKg(stats.expected_weight_kg)}`}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-mc-success/12 px-2 py-0.5 text-[11px] font-bold tabular-nums text-mc-success">
                <CheckCircle2 className="h-3 w-3" />
                {stats.confirmed} ta tasdiqlandi
                {stats.confirmed_weight_kg > 0 && ` · ${formatKg(stats.confirmed_weight_kg)}`}
              </span>
            </span>
          )}
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-mc-text-3" />
      </button>

      <div className="grid grid-cols-2 gap-1.5 @xl:flex @xl:shrink-0">
        <button
          type="button"
          onClick={onExtract}
          title="Eski reyslardan olib ketilmagan yuklarni shu astatkaga qo‘shish"
          className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-mc-md border border-mc-border bg-mc-surface px-2 py-1.5 text-center text-[12px] font-bold leading-tight text-mc-text active:scale-[0.97] @xl:h-11 @xl:min-h-0 @xl:flex-row @xl:gap-1.5 @xl:px-3 @xl:text-[13px]"
        >
          <PackagePlus className="h-4 w-4 shrink-0" />
          Astatka ajratish
        </button>
        <button
          type="button"
          onClick={onSend}
          title="Mijozlarga yuk haqida xabar yuborish"
          className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-mc-md bg-mc-brand px-2 py-1.5 text-center text-[12px] font-extrabold leading-tight text-mc-on-brand active:scale-[0.97] @xl:h-11 @xl:min-h-0 @xl:flex-row @xl:gap-1.5 @xl:px-3 @xl:text-[13px]"
        >
          <Bell className="h-4 w-4 shrink-0" />
          Yuborish
        </button>
      </div>
    </div>
  );
}

function LegacyStockTakeCard({
  astatka,
  onOpen,
}: {
  astatka: Astatka;
  onOpen: () => void;
}) {
  const total = Object.values(astatka.counts).reduce(
    (sum, value) => sum + (value ?? 0),
    0,
  );
  const needsFilling =
    (astatka.counts.needs_data ?? 0) + (astatka.counts.unknown ?? 0);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-mc-lg border border-mc-border bg-mc-surface p-3 text-left active:scale-[0.99]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 flex-1 break-words text-[15px] font-extrabold text-mc-text">
          {astatka.name}
        </span>
        <span className="shrink-0 text-[13px] font-bold text-mc-text-2">
          {total} ta
        </span>
      </div>
      <p className="mt-1 truncate text-[12px] font-medium text-mc-text-3">
        {astatka.flight_names.length > 0
          ? astatka.flight_names.join(", ")
          : "Barcha reyslar"}
      </p>
      {needsFilling > 0 && (
        <p className="mt-1 text-[11px] font-bold text-mc-warn">
          {needsFilling} ta yuk to‘ldirilishi kerak
        </p>
      )}
    </button>
  );
}
