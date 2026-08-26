/**
 * Sections 1 and 2 of the Reyslar page: the flights an operator is currently
 * working on, listed twice for two different jobs.
 *
 * Both list exactly the flights switched on in section 3, in the order set
 * there — that is the whole point of the toggle. Before this they listed "the
 * newest five active flights", which meant the board rearranged itself
 * whenever a manifest arrived and there was no way to pin the two flights
 * actually being processed.
 *
 * One component, two configurations, because the difference between them is
 * the meta line and the destination — not the structure.
 */

import type { LucideIcon } from 'lucide-react';
import { ChevronRight, RotateCw } from 'lucide-react';

import type { FlightDashboardItem } from '@/api/services/flightSchedule';
import { triggerSoftHaptic } from '@/utils/haptics';

import {
  EmptyNote,
  SectionCard,
  SectionFooterLink,
  TileSkeleton,
} from '../dashboard/DashboardPrimitives';

export interface FlightMeta {
  Icon: LucideIcon;
  text: string;
  title?: string;
}

export function FlightUploadSection({
  title,
  subtitle,
  flights,
  isLoading,
  isError,
  onRetry,
  onSelect,
  renderMeta,
  footerLabel,
  onFooterClick,
}: {
  title: string;
  subtitle: string;
  flights: FlightDashboardItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelect: (flightName: string) => void;
  renderMeta: (flight: FlightDashboardItem) => FlightMeta[];
  footerLabel: string;
  onFooterClick: () => void;
}) {
  return (
    <SectionCard
      title={title}
      subtitle={subtitle}
      footer={
        <div className="flex items-center">
          <SectionFooterLink label={footerLabel} onClick={onFooterClick} />
        </div>
      }
    >
      {isLoading && flights.length === 0 ? (
        <div className="space-y-2">
          <TileSkeleton />
          <TileSkeleton />
        </div>
      ) : isError ? (
        <div className="rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-5 text-center">
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
        // Not "nothing found": the list is empty because nobody switched a
        // flight on, and the reader needs to be told where that switch is.
        <EmptyNote text="Yoqilgan reys yo‘q — pastdagi jadvaldan yoqing" />
      ) : (
        <ul className="space-y-1.5">
          {flights.map((flight) => (
            <li key={flight.name}>
              <button
                type="button"
                onClick={() => {
                  triggerSoftHaptic();
                  onSelect(flight.name);
                }}
                className="flex w-full items-center gap-3 rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-2.5 text-left transition-transform active:scale-[0.99]"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="truncate text-[14px] font-extrabold text-mc-text"
                      title={flight.name}
                    >
                      {flight.name}
                    </span>
                    <span className="shrink-0 rounded-full border border-mc-success/25 bg-mc-success/12 px-1.5 py-0.5 text-[10px] font-extrabold text-mc-success">
                      Ko‘rinmoqda
                    </span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {renderMeta(flight).map(({ Icon, text, title: metaTitle }) => (
                      <span
                        key={text}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums text-mc-text-2"
                        title={metaTitle ?? text}
                      >
                        <Icon
                          className="h-3.5 w-3.5 shrink-0 text-mc-text-3"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        {text}
                      </span>
                    ))}
                  </span>
                </span>
                {/* Always visible. The old row revealed its arrow on
                    `group-hover`, which never fires on a touch screen. */}
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-mc-text-3"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
