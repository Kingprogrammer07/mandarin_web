/**
 * The Tashkent warehouse: how much of the busiest open flight has reached its
 * clients.
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

import { useQuery } from '@tanstack/react-query';
import { Info, RotateCw } from 'lucide-react';

import { getFlightsDashboard } from '@/api/services/flightSchedule';
import { formatTashkentDateTime, formatWeightKg } from '@/lib/format';

import { EmptyNote, SectionCard, TileSkeleton } from './DashboardPrimitives';
import { FlightProgressDonut } from './FlightProgressDonut';

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
  const items = (flights.data?.items ?? [])
    .filter((flight) => (flight.stats.transaction_count ?? 0) > 0)
    .slice(0, 3);
  const [busiest, ...rest] = items;

  return (
    <SectionCard
      title="Toshkent ombori"
      subtitle={
        flights.data ? `Yuki bor reyslar: ${items.length} ta` : 'Eng ko‘p yuk bor reys'
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
      ) : !busiest ? (
        <EmptyNote text="Ochiq reys yo‘q" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] sm:items-center">
            <dl className="min-w-0 space-y-2">
              <div>
                <dt className="text-[11px] font-medium text-mc-text-3">Faol reys</dt>
                {/* The identity column is ~150px in the half-width card; a
                    warehouse tab name like "M214-M215 QOSHIMCHA" does not fit. */}
                <dd
                  className="truncate text-[19px] font-extrabold leading-tight text-mc-text"
                  title={busiest.name}
                >
                  {busiest.name}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-mc-text-3">Umumiy hajm</dt>
                <dd className="text-[16px] font-extrabold tabular-nums text-mc-text">
                  {formatWeightKg(busiest.stats.total_weight_kg)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-mc-text-3">Mijozlar</dt>
                <dd className="text-[14px] font-bold tabular-nums text-mc-text-2">
                  {busiest.stats.client_count} ta
                </dd>
              </div>
              {busiest.last_activity_at && (
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
                    {formatTashkentDateTime(busiest.last_activity_at, language)}
                  </dd>
                </div>
              )}
            </dl>

            <FlightProgressDonut flight={busiest} />
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
