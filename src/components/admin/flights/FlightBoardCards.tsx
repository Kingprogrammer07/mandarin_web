/**
 * The three counts at the top of the Reyslar page.
 *
 * They come from `/flights/board/summary`, which counts the same merged flight
 * sources the table below lists — not the board table's own rows. A board row
 * outlives the flight it names (a renamed worksheet tab, a cleared manifest),
 * and a card that counted those would disagree with the list under it.
 */

import type { LucideIcon } from 'lucide-react';
import { Eye, EyeOff, Plane } from 'lucide-react';

import type { FlightBoardSummary } from '@/api/services/flightSchedule';

import { TileSkeleton } from '../dashboard/DashboardPrimitives';

type Tone = 'brand' | 'success' | 'neutral';

const TONE_CHIP: Record<Tone, string> = {
  brand: 'bg-mc-brand-soft text-mc-brand',
  success: 'bg-mc-success/12 text-mc-success',
  neutral: 'bg-mc-surface-2 text-mc-text-2',
};

function Card({
  label,
  value,
  caption,
  Icon,
  tone,
}: {
  label: string;
  value: number | undefined;
  caption: string;
  Icon: LucideIcon;
  tone: Tone;
}) {
  return (
    <div className="flex items-center gap-3 rounded-mc-lg border border-mc-border bg-mc-surface px-4 py-3.5 shadow-[var(--mc-shadow-card)]">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-md ${TONE_CHIP[tone]}`}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-mc-text-2" title={label}>
          {label}
        </span>
        {/* Never a 0 for a number that did not arrive — the whole point of
            these cards is telling the operator how much is hidden. */}
        <span className="block text-[24px] font-extrabold leading-tight tabular-nums text-mc-text">
          {value === undefined ? '—' : new Intl.NumberFormat('uz-UZ').format(value)}
        </span>
        <span className="block truncate text-[11px] font-medium text-mc-text-3" title={caption}>
          {caption}
        </span>
      </span>
    </div>
  );
}

export function FlightBoardCards({
  summary,
  isLoading,
}: {
  summary: FlightBoardSummary | undefined;
  isLoading: boolean;
}) {
  if (isLoading && !summary) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <TileSkeleton />
        <TileSkeleton />
        <TileSkeleton />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card
        label="Jami reyslar"
        value={summary?.total}
        caption="Bazadagi barcha reyslar"
        Icon={Plane}
        tone="brand"
      />
      <Card
        label="Ko‘rinayotgan reyslar"
        value={summary?.visible}
        caption="1- va 2-bo‘limda chiqadi"
        Icon={Eye}
        tone="success"
      />
      <Card
        label="Yashirin reyslar"
        value={summary?.hidden}
        caption="Faqat bazada saqlanadi"
        Icon={EyeOff}
        tone="neutral"
      />
    </div>
  );
}
