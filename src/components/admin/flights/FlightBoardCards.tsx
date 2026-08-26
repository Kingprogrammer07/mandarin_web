/**
 * The three counts at the top of the Reyslar page.
 *
 * They come from `/flights/board/summary`, which counts the same merged flight
 * sources the table below lists — not the board table's own rows. A board row
 * outlives the flight it names (a renamed worksheet tab, a cleared manifest),
 * and a card that counted those would disagree with the list under it.
 *
 * **Below `sm:` the three cards are one strip that opens on tap.** Stacked on a
 * 320px screen they measure 376px — most of a phone viewport spent before the
 * first flight is on it, when the switches below are the point of the page. The
 * strip is 56px and still states all three numbers, so collapsing costs the
 * captions, not the counts. From `sm:` up nothing changed: three across, open.
 */

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, Eye, EyeOff, Plane } from 'lucide-react';

import type { FlightBoardSummary } from '@/api/services/flightSchedule';
import { triggerSoftHaptic } from '@/utils/haptics';

import { TileSkeleton } from '../dashboard/DashboardPrimitives';

type Tone = 'brand' | 'success' | 'neutral';

const TONE_CHIP: Record<Tone, string> = {
  brand: 'bg-mc-brand-soft text-mc-brand',
  success: 'bg-mc-success/12 text-mc-success',
  neutral: 'bg-mc-surface-2 text-mc-text-2',
};

const TONE_INK: Record<Tone, string> = {
  brand: 'text-mc-brand',
  success: 'text-mc-success',
  neutral: 'text-mc-text',
};

/**
 * Remembered per device, the way the POS pickup preview remembers its own
 * panel. Absent or unreadable storage means collapsed — the phone default.
 */
const EXPANDED_KEY = 'flights_board_summary_expanded';

function loadExpanded(): boolean {
  try {
    return localStorage.getItem(EXPANDED_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveExpanded(value: boolean): void {
  try {
    localStorage.setItem(EXPANDED_KEY, String(value));
  } catch {
    // Private mode denies storage. The strip still opens, it just forgets.
  }
}

function formatCount(value: number | undefined): string {
  // Never a 0 for a number that did not arrive — the whole point of these
  // cards is telling the operator how much is hidden.
  return value === undefined ? '—' : new Intl.NumberFormat('uz-UZ').format(value);
}

interface SummaryEntry {
  key: string;
  label: string;
  /** Fits a third of a 320px strip; the card keeps the full wording. */
  shortLabel: string;
  caption: string;
  value: number | undefined;
  Icon: LucideIcon;
  tone: Tone;
}

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
        <span className="block text-[24px] font-extrabold leading-tight tabular-nums text-mc-text">
          {formatCount(value)}
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
  const [isExpanded, setIsExpanded] = useState<boolean>(loadExpanded);

  if (isLoading && !summary) {
    return (
      <div>
        {/* 56px is the strip's measured height — a skeleton of any other size
            would shift the page under the reader when the counts land. */}
        <div className="h-[56px] animate-pulse rounded-mc-lg border border-mc-border bg-mc-surface-2 sm:hidden" />
        <div className="hidden gap-3 sm:grid sm:grid-cols-3">
          <TileSkeleton />
          <TileSkeleton />
          <TileSkeleton />
        </div>
      </div>
    );
  }

  const entries: SummaryEntry[] = [
    {
      key: 'total',
      label: 'Jami reyslar',
      shortLabel: 'Jami',
      caption: 'Bazadagi barcha reyslar',
      value: summary?.total,
      Icon: Plane,
      tone: 'brand',
    },
    {
      key: 'visible',
      label: 'Ko‘rinayotgan reyslar',
      shortLabel: 'Ko‘rinadi',
      caption: '1- va 2-bo‘limda chiqadi',
      value: summary?.visible,
      Icon: Eye,
      tone: 'success',
    },
    {
      key: 'hidden',
      label: 'Yashirin reyslar',
      shortLabel: 'Yashirin',
      caption: 'Faqat bazada saqlanadi',
      value: summary?.hidden,
      Icon: EyeOff,
      tone: 'neutral',
    },
  ];

  const toggle = () => {
    const next = !isExpanded;
    triggerSoftHaptic();
    setIsExpanded(next);
    saveExpanded(next);
  };

  return (
    <div>
      {/* Phone only. The numbers are inside the button, so a screen reader
          hears the counts before the expand state — no aria-label to override
          them with a shorter story. */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isExpanded}
        aria-controls="flight-board-summary"
        className="flex w-full items-center gap-2 rounded-mc-lg border border-mc-border bg-mc-surface px-3 py-2 text-left shadow-[var(--mc-shadow-card)] transition-transform active:scale-[0.99] sm:hidden"
      >
        <span className="grid min-w-0 flex-1 grid-cols-3 divide-x divide-mc-border">
          {entries.map((entry) => (
            <span key={entry.key} className="flex min-w-0 flex-col items-center px-1">
              <span
                className={`text-[17px] font-extrabold leading-tight tabular-nums ${TONE_INK[entry.tone]}`}
              >
                {formatCount(entry.value)}
              </span>
              <span
                className="mt-0.5 w-full truncate text-center text-[10px] font-extrabold uppercase tracking-[0.06em] text-mc-text-3"
                title={entry.label}
              >
                {entry.shortLabel}
              </span>
            </span>
          ))}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-mc-text-3 transition-transform duration-150 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          strokeWidth={2.4}
          aria-hidden="true"
        />
      </button>

      <div
        id="flight-board-summary"
        className={`gap-3 sm:mt-0 sm:grid sm:grid-cols-3 ${isExpanded ? 'mt-3 grid' : 'hidden'}`}
      >
        {entries.map((entry) => (
          <Card
            key={entry.key}
            label={entry.label}
            value={entry.value}
            caption={entry.caption}
            Icon={entry.Icon}
            tone={entry.tone}
          />
        ))}
      </div>
    </div>
  );
}
