import { useState } from 'react';
import { ChevronDown, ChevronUp, ScanLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CargoItemDetail } from '@/api/services/reportService';
import { formatUzsAmount, formatWeightKg } from '@/lib/format';
import { triggerSoftHaptic } from '@/utils/haptics';

interface TrackCodeListProps {
  /** Per-parcel rows. Preferred over `fallbackCodes` when present. */
  items: CargoItemDetail[];
  /** Bare codes, used when the flight has no itemised rows. */
  fallbackCodes: string[];
  onTrackClick: (code: string) => void;
}

/** How many rows are visible before the list has to be expanded. */
const COLLAPSED_COUNT = 3;

/**
 * The flight's track codes.
 *
 * `track_code_2` wins over `track_code` when both exist: the import can carry a
 * corrected code in a second column, and it is the corrected one the client
 * will have been given.
 */
export function TrackCodeList({ items, fallbackCodes, onTrackClick }: TrackCodeListProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const rows = items.length
    ? items.map((item) => ({
        code: item.track_code_2 || item.track_code,
        weight: item.weight_kg,
        amount: item.total_payment_uzs,
      }))
    : fallbackCodes.map((code) => ({ code, weight: null, amount: null }));

  const visible = isExpanded ? rows : rows.slice(0, COLLAPSED_COUNT);
  const hidden = rows.length - visible.length;

  return (
    <div className="px-4">
      <div className="rounded-mc-lg border border-mc-border bg-mc-surface p-3 shadow-[var(--mc-shadow-card)]">
        <h2 className="text-[14px] font-extrabold text-mc-text">
          {t('reports.trackCodes', 'Trek-kod')}
        </h2>

        {rows.length === 0 ? (
          // Dashed rather than a plain card: an empty bordered box reads as a
          // slot waiting to be filled, which is exactly the state — the code is
          // assigned later, nothing has gone wrong.
          <div
            className="mt-2 flex items-center justify-center gap-2 rounded-mc-md border
                       border-dashed border-mc-border px-3 py-5 text-[13px] font-medium
                       text-mc-text-3"
          >
            <ScanLine className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            {t('reports.noTrackCode', 'Trek-kod hali biriktirilmagan')}
          </div>
        ) : (
          <>
            <ul className="mt-2 space-y-1.5">
              {visible.map((row) => (
                <li key={row.code}>
                  <button
                    type="button"
                    onClick={() => {
                      triggerSoftHaptic();
                      onTrackClick(row.code);
                    }}
                    className="flex w-full items-center gap-3 rounded-mc-md bg-mc-surface-2
                               px-3 py-2.5 text-left transition-transform duration-150
                               active:scale-[0.99]"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-mc-text">
                      {row.code}
                    </span>
                    {row.weight != null && (
                      <span className="shrink-0 text-[11px] font-medium text-mc-text-2 tabular-nums">
                        {formatWeightKg(row.weight)} {t('reports.kg', 'kg')}
                      </span>
                    )}
                    {row.amount != null && row.amount > 0 && (
                      <span className="shrink-0 text-[11px] font-bold text-mc-text tabular-nums">
                        {formatUzsAmount(row.amount)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            {(hidden > 0 || isExpanded) && (
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="mt-2 flex w-full items-center justify-center gap-1 py-1.5
                           text-[12px] font-bold text-mc-brand"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    {t('reports.showLessTracks', 'Kamroq ko‘rsatish')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    {t('reports.showMoreTracks', {
                      count: hidden,
                      defaultValue: 'Yana {{count}} ta ko‘rsatish',
                    })}
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
