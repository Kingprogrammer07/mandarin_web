/**
 * Where a flight's weight stands: paid, unpaid, and how much of the unpaid is
 * still sitting in the warehouse.
 *
 * **Two rings, because the three numbers are not three slices.** Paid and
 * unpaid partition the flight and fill the outer ring. "Ostatka" — cargo whose
 * client has neither paid nor collected — is a SUBSET of unpaid, so drawing it
 * as a third slice would double-count. It gets an inner ring instead, measured
 * against the same total, which is exactly what it is: a part of the whole
 * highlighted inside it.
 *
 * All four figures come from `client_transaction_data`, one population, so the
 * percentages add up. `total_weight_kg` (from `flight_cargos`) is deliberately
 * not mixed in: different table, different cardinality.
 *
 * Interactive rather than a picture. Hovering or focusing a segment — or its
 * legend row — thickens that arc and moves its own figure into the centre, so
 * the reader gets the exact kilogram without a tooltip that a touch device
 * would never show.
 *
 * Drawn as SVG: three arcs need no chart library, and Recharts was only just
 * taken off the critical path.
 */

import { useState } from 'react';

import type { FlightDashboardItem } from '@/api/services/flightSchedule';
import { formatWeightKg } from '@/lib/format';

type Segment = 'paid' | 'unpaid' | 'unclaimed';

const OUTER_R = 44;
const INNER_R = 29;
const OUTER_C = 2 * Math.PI * OUTER_R;
const INNER_C = 2 * Math.PI * INNER_R;

/** Visual break between the two outer arcs so they read as separate quantities. */
const GAP = 3;

const SEGMENT_META: Record<Segment, { label: string; stroke: string; dot: string; ink: string }> = {
  paid: {
    label: 'To‘langan',
    stroke: 'stroke-mc-success',
    dot: 'bg-mc-success',
    ink: 'text-mc-success',
  },
  unpaid: {
    label: 'To‘lanmagan',
    stroke: 'stroke-mc-warn',
    dot: 'bg-mc-warn',
    ink: 'text-mc-warn',
  },
  unclaimed: {
    label: 'Ostatka',
    stroke: 'stroke-mc-danger',
    dot: 'bg-mc-danger',
    ink: 'text-mc-danger',
  },
};

export function FlightProgressDonut({ flight }: { flight: FlightDashboardItem }) {
  const [active, setActive] = useState<Segment | null>(null);

  const total = flight.stats.transaction_weight_kg ?? 0;
  const values: Record<Segment, number> = {
    paid: flight.stats.paid_weight_kg ?? 0,
    unpaid: flight.stats.unpaid_weight_kg ?? 0,
    unclaimed: flight.stats.unclaimed_weight_kg ?? 0,
  };

  // An older backend does not send these yet; a ring drawn from zeros would be
  // a confident-looking lie.
  const hasData = total > 0;
  const share = (value: number) => (hasData ? value / total : 0);
  const pct = (value: number) => Math.round(share(value) * 100);

  const paidArc = Math.max(0, share(values.paid) * OUTER_C - GAP);
  const unpaidArc = Math.max(0, share(values.unpaid) * OUTER_C - GAP);
  const unclaimedArc = share(values.unclaimed) * INNER_C;

  const centre: Segment | null = active;

  return (
    // The ring is a fixed 124px, so the legend beside it needs ~24rem of panel
    // before "Ostatka (to‘lamagan, olib ketmagan)" fits on its line — under
    // that it collapses toward ~40px and every row reads "To‘l…". Below 24rem
    // the ring goes above and the legend takes the full width. Measured against
    // the PANEL (`@container` on the card body), never the viewport: this card
    // is a half column on a wide screen, where the viewport says nothing about
    // how much room it actually has.
    <div className="flex min-w-0 flex-col gap-3 @[24rem]:flex-row @[24rem]:items-center @[24rem]:gap-4">
      <div className="relative h-[124px] w-[124px] shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r={OUTER_R}
            fill="none"
            strokeWidth="12"
            className="stroke-mc-border"
          />
          {hasData && (
            <>
              <Arc
                r={OUTER_R}
                circumference={OUTER_C}
                length={paidArc}
                offset={0}
                segment="paid"
                active={active}
                onActivate={setActive}
              />
              <Arc
                r={OUTER_R}
                circumference={OUTER_C}
                length={unpaidArc}
                offset={-(share(values.paid) * OUTER_C)}
                segment="unpaid"
                active={active}
                onActivate={setActive}
              />
              <circle
                cx="50"
                cy="50"
                r={INNER_R}
                fill="none"
                strokeWidth="6"
                className="stroke-mc-border"
                opacity={0.5}
              />
              <Arc
                r={INNER_R}
                circumference={INNER_C}
                length={unclaimedArc}
                offset={0}
                segment="unclaimed"
                active={active}
                onActivate={setActive}
                thin
              />
            </>
          )}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          {!hasData ? (
            <span className="text-[10px] font-semibold text-mc-text-3">
              Ma’lumot yetarli emas
            </span>
          ) : centre ? (
            <>
              <span
                className={`text-[17px] font-extrabold leading-none tabular-nums ${SEGMENT_META[centre].ink}`}
              >
                {pct(values[centre])}%
              </span>
              <span className="mt-0.5 text-[10px] font-bold tabular-nums text-mc-text">
                {formatWeightKg(values[centre])}
              </span>
              <span className="text-[9px] font-semibold text-mc-text-3">
                {SEGMENT_META[centre].label}
              </span>
            </>
          ) : (
            <>
              <span className="text-[21px] font-extrabold leading-none tabular-nums text-mc-text">
                {pct(values.paid)}%
              </span>
              <span className="mt-0.5 text-[10px] font-semibold text-mc-text-3">
                to‘langan
              </span>
            </>
          )}
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1">
        {(['paid', 'unpaid', 'unclaimed'] as Segment[]).map((segment) => (
          <li key={segment}>
            <button
              type="button"
              // Hover for a mouse, focus for a keyboard, tap for a phone — the
              // same highlight for all three, so no reader is left without it.
              onMouseEnter={() => setActive(segment)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(segment)}
              onBlur={() => setActive(null)}
              onClick={() => setActive((current) => (current === segment ? null : segment))}
              aria-pressed={active === segment}
              // 44px while the legend is stacked and finger-sized; back to the
              // mockup's 36px rows once it sits beside the ring, where it is a
              // caption next to a chart rather than a list of controls.
              className={`flex min-h-[44px] w-full items-center gap-2 rounded-mc-sm px-1.5 text-left transition-colors @[24rem]:min-h-[36px] ${
                active === segment ? 'bg-mc-surface-2' : ''
              }`}
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${SEGMENT_META[segment].dot}`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                {/* The legend column is ~96px on a phone, so the parenthetical
                    — the one thing that stops the three rows reading as a sum —
                    is exactly what gets cut. It is repeated in `title` rather
                    than dropped. */}
                <span
                  className="block truncate text-[11px] font-medium text-mc-text-2"
                  title={
                    segment === 'unclaimed'
                      ? `${SEGMENT_META[segment].label} (to‘lamagan va olib ketmagan)`
                      : SEGMENT_META[segment].label
                  }
                >
                  {SEGMENT_META[segment].label}
                  {segment === 'unclaimed' && (
                    // Stated in the label itself: without this the three rows
                    // look like they should sum to the total, and they do not.
                    <span className="ml-1 text-[9px] text-mc-text-3">
                      (to‘lamagan, olib ketmagan)
                    </span>
                  )}
                </span>
                {/* Without `truncate` a long kilogram figure overflowed the
                    column with no ellipsis to show it had. */}
                <span
                  className="block truncate text-[13px] font-extrabold tabular-nums text-mc-text"
                  title={formatWeightKg(values[segment])}
                >
                  {formatWeightKg(values[segment])}
                </span>
              </span>
              <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-mc-text-3">
                {hasData ? `${pct(values[segment])}%` : '—'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Arc({
  r,
  circumference,
  length,
  offset,
  segment,
  active,
  onActivate,
  thin = false,
}: {
  r: number;
  circumference: number;
  length: number;
  offset: number;
  segment: Segment;
  active: Segment | null;
  onActivate: (segment: Segment | null) => void;
  thin?: boolean;
}) {
  if (length <= 0) return null;
  const isActive = active === segment;
  const base = thin ? 6 : 12;

  return (
    <circle
      cx="50"
      cy="50"
      r={r}
      fill="none"
      // Thickening rather than scaling: a transform on one arc would visibly
      // shift it off the shared centre.
      strokeWidth={isActive ? base + 3 : base}
      strokeLinecap="round"
      strokeDasharray={`${length} ${circumference - length}`}
      strokeDashoffset={offset}
      className={`${SEGMENT_META[segment].stroke} cursor-pointer transition-[stroke-width] duration-150`}
      opacity={active && !isActive ? 0.45 : 1}
      onMouseEnter={() => onActivate(segment)}
      onMouseLeave={() => onActivate(null)}
    />
  );
}
