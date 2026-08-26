/**
 * The Tashkent warehouse: how much of one open flight has reached its clients.
 *
 * WHICH flight is the operator's choice, because the two useful answers differ
 * and the panel cannot show both. "Eng ko'p qolgan" ranks by how much is still
 * to hand over; "Oxirgi reys" follows the flight that landed last, the same
 * `last_arrived` the KPI row above states, so the two never disagree.
 *
 * The default stays "eng ko'p qolgan". Worth knowing when reading the numbers:
 * the backend orders `remaining_desc` by remaining CARGO COUNT first and only
 * then by weight, while this card displays weight — so the figure on screen is
 * not the figure the ranking used. M260-M261 (499 cargos, 222 kg left) outranks
 * M262-M263 (316 cargos, 316 kg left), which reads as a bug until you know.
 *
 * Three columns — the flight's identity, the ring, and its legend — so the
 * numbers read left to right without the donut having to carry labels. Below a
 * hairline, a status strip states when the figures were last refreshed, because
 * a dashboard that looks live and is not is the worst of both.
 *
 * Built on `/flights/dashboard` alone. An earlier version also read the flight
 * schedule for a "next flights" strip, but that table is a calendar somebody
 * has to maintain and in practice holds a single row — the strip was
 * permanently empty, which reads as a broken panel rather than an unused one.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Info, RotateCw } from 'lucide-react';

import { getFlightVolumeSummary } from '@/api/services/adminDashboard';
import { getFlightsDashboard } from '@/api/services/flightSchedule';
import { formatTashkentDateTime, formatWeightKg } from '@/lib/format';

import { EmptyNote, SectionCard, TileSkeleton } from './DashboardPrimitives';
import { FlightProgressDonut } from './FlightProgressDonut';

type PanelMode = 'busiest' | 'latest';

const MODE_KEY = 'admin_warehouse_panel_mode';

const MODES: { value: PanelMode; label: string }[] = [
  { value: 'busiest', label: "Eng ko‘p qolgan" },
  { value: 'latest', label: 'Oxirgi reys' },
];

/** Anything unreadable or unrecognised means the default. */
function loadMode(): PanelMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'latest' ? 'latest' : 'busiest';
  } catch {
    return 'busiest';
  }
}

function saveMode(mode: PanelMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // A private window is not a reason to break the panel.
  }
}

export function WarehousePanel({
  onNavigate,
  language,
}: {
  onNavigate: (page: string) => void;
  language?: string;
}) {
  const flights = useQuery({
    queryKey: ['admin-dashboard', 'flights-heaviest'],
    // per_page is large on purpose. `status: 'active'` also admits `new` —
    // flights that exist only in the expected-cargo manifest and carry all-zero
    // stats — and the backend ranks those FIRST, before `remaining_desc` is
    // consulted. Measured here: 33 of them sit ahead of the first flight that
    // actually has cargo, so a small page returns nothing usable. Filtering
    // happens below; the endpoint is cached for five minutes and never polled.
    queryFn: () =>
      getFlightsDashboard({ status: 'active', sort: 'remaining_desc', per_page: 50 }),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Only a flight with transactions behind it can carry a handed-over ratio;
  // the manifest-only ones would render a fabricated 0%.
  // Same query key as AdminDashboardPage's, so this shares its cache entry and
  // costs no extra request. Only `last_arrived.flight_name` is read.
  const volume = useQuery({
    queryKey: ['admin-dashboard', 'flight-volume'],
    queryFn: getFlightVolumeSummary,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const [mode, setMode] = useState<PanelMode>(loadMode);

  const ranked = (flights.data?.items ?? []).filter(
    (flight) => (flight.stats.transaction_count ?? 0) > 0,
  );

  const latestName = volume.data?.last_arrived?.flight_name?.trim().toUpperCase();
  const latest = latestName
    ? ranked.find((flight) => flight.name.trim().toUpperCase() === latestName)
    : undefined;

  // The last-arrived flight can be missing from this list — it is filtered to
  // open flights that carry transactions, and a freshly landed one may have
  // neither yet. Fall back rather than empty the panel, and say so below.
  const selected = mode === 'latest' ? (latest ?? ranked[0]) : ranked[0];
  const latestUnavailable = mode === 'latest' && !latest;
  const rest = ranked.filter((flight) => flight !== selected).slice(0, 2);

  return (
    <SectionCard
      title="Toshkent ombori"
      subtitle={
        flights.data
          ? `Yuki bor reyslar: ${ranked.length} ta`
          : 'Eng ko‘p yuk bor reys'
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-medium text-mc-text-3">
          <span className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            Raqamlar omborda tortilgan yuklardan olingan
          </span>
          {flights.dataUpdatedAt > 0 && (
            <span className="tabular-nums">
              Oxirgi yangilanish:{' '}
              {formatTashkentDateTime(new Date(flights.dataUpdatedAt), language)}
            </span>
          )}
        </div>
      }
    >
      {flights.isLoading ? (
        <TileSkeleton />
      ) : flights.isError ? (
        <div className="rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-6 text-center">
          <p className="text-[12px] font-semibold text-mc-text-3">Yuklanmadi</p>
          <button
            type="button"
            onClick={() => void flights.refetch()}
            className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-[11px] font-bold text-mc-brand active:scale-95"
          >
            <RotateCw className="h-3 w-3" strokeWidth={2.2} />
            Qayta urinish
          </button>
        </div>
      ) : !selected ? (
        <EmptyNote text="Ochiq reys yo‘q" />
      ) : (
        <>
          {/* Which flight this panel is about. Two answers are both correct
              and they disagree, so the operator picks. */}
          <div
            role="group"
            aria-label="Qaysi reys ko‘rsatilsin"
            className="mb-3 flex w-full gap-1 rounded-mc-md bg-mc-surface-2 p-1"
          >
            {MODES.map((option) => {
              const isActive = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setMode(option.value);
                    saveMode(option.value);
                  }}
                  className={`min-h-[36px] flex-1 rounded-mc-sm px-2 text-[11px] font-bold transition-colors ${
                    isActive
                      ? 'bg-mc-surface text-mc-text shadow-[var(--mc-shadow-card)]'
                      : 'text-mc-text-3'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {latestUnavailable && (
            <p className="mb-3 text-[11px] font-medium text-mc-text-3">
              Oxirgi kelgan reysda hali tortilgan yuk yo‘q — eng ko‘p qolgani
              ko‘rsatilmoqda.
            </p>
          )}

          {/* `grid-cols-1` below `sm`, not an implicit `auto` column: the ring
              and its legend cannot wrap, so an auto column took their combined
              min-content (~380px) and hung the panel off the side of a phone. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] sm:items-center">
            <dl className="min-w-0 space-y-2">
              <div>
                <dt className="text-[11px] font-medium text-mc-text-3">
                  {mode === 'latest' && latest ? 'Oxirgi kelgan reys' : 'Faol reys'}
                </dt>
                {/* The identity column is ~150px in the half-width card; a
                    warehouse tab name like "M214-M215 QOSHIMCHA" does not fit. */}
                <dd
                  className="truncate text-[19px] font-extrabold leading-tight text-mc-text"
                  title={selected.name}
                >
                  {selected.name}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-mc-text-3">Umumiy hajm</dt>
                <dd className="text-[16px] font-extrabold tabular-nums text-mc-text">
                  {formatWeightKg(selected.stats.total_weight_kg)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-mc-text-3">Mijozlar</dt>
                <dd className="text-[14px] font-bold tabular-nums text-mc-text-2">
                  {selected.stats.client_count} ta
                </dd>
              </div>
              {selected.last_activity_at && (
                <div>
                  {/* The mockup labels this row "Reys kelgan sana". The API has
                      no arrival date — `/flights/dashboard` returns only
                      `last_activity_at` — and calling a last-touched timestamp
                      an arrival date would be a number the warehouse could not
                      reconcile. Labelled for what it actually is. */}
                  <dt className="text-[11px] font-medium text-mc-text-3">
                    Oxirgi harakat
                  </dt>
                  <dd className="truncate text-[13px] font-bold tabular-nums text-mc-text-2">
                    {formatTashkentDateTime(selected.last_activity_at, language)}
                  </dd>
                </div>
              )}
            </dl>

            <FlightProgressDonut flight={selected} />
          </div>

          {rest.length > 0 && (
            <div className="mt-3 border-t border-mc-border pt-3">
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-mc-text-3">
                Qolgan yuki ko‘p keyingi reyslar
              </p>
              {rest.map((flight) => (
                <button
                  key={flight.name}
                  type="button"
                  onClick={() => onNavigate('flights')}
                  className="flex min-h-[40px] w-full items-center justify-between gap-3 text-left active:scale-[0.99]"
                >
                  <span
                    className="min-w-0 truncate text-[13px] font-bold text-mc-text"
                    title={flight.name}
                  >
                    {flight.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2.5 text-[11px] font-semibold tabular-nums text-mc-text-2">
                    <span>{flight.stats.remaining_cargos} ta</span>
                    <span className="text-mc-text-3">
                      {formatWeightKg(flight.stats.remaining_weight_kg)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
