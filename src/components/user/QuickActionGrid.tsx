import type { LucideIcon } from 'lucide-react';
import { triggerSoftHaptic } from '@/utils/haptics';

export interface QuickAction {
  id: string;
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
}

interface QuickActionGridProps {
  actions: QuickAction[];
  /** Section heading rendered above the card. Omit for an unlabelled row. */
  title?: string;
  /**
   * `divided` is the primary row from the design: one card, hairline rules
   * between items. `plain` drops the shadow for the secondary set.
   */
  variant?: 'divided' | 'plain';
  /**
   * Runs the colour ring around the card once on mount. Off for grids that are
   * not the first thing on a screen — two cards sweeping at once cancel each
   * other out as an attention cue.
   */
  sweep?: boolean;
}

/** Four per line at most — beyond that the labels stop fitting on one line. */
const MAX_COLUMNS = 4;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/**
 * A grid of icon + label shortcuts.
 *
 * Laid out row by row rather than as a plain CSS grid so a final short row is
 * centred instead of left-aligned: five actions used to render four across and
 * one stranded in the bottom-left corner. Items keep a fixed 1/columns width in
 * every row, so a centred row still lines its icons up with the row above.
 *
 * The client app only ever renders inside a phone-sized Telegram viewport, so a
 * responsive column count would add a breakpoint nobody would ever see.
 */
export function QuickActionGrid({
  actions,
  title,
  variant = 'divided',
  sweep = false,
}: QuickActionGridProps) {
  if (actions.length === 0) return null;

  const columns = Math.min(MAX_COLUMNS, actions.length);
  const rows = chunk(actions, columns);
  const itemWidth = `${100 / columns}%`;

  return (
    <div className="px-4">
      {title && (
        <h2 className="mb-1.5 px-0.5 text-[12px] font-extrabold tracking-tight text-mc-text">
          {title}
        </h2>
      )}
      {/* p-px is the ring thickness; the inner radius is one pixel smaller so
          the two corners stay concentric. */}
      <div className="relative overflow-hidden rounded-mc-lg p-px">
        {sweep && (
          <span
            aria-hidden="true"
            className="mc-ring-sweep pointer-events-none absolute left-1/2 top-1/2
                       aspect-square w-[190%]"
          />
        )}
        <div
          className={`relative overflow-hidden rounded-[calc(var(--mc-r-lg)-1px)]
                      border border-mc-border bg-mc-surface
                      ${variant === 'divided' ? 'shadow-[var(--mc-shadow-card)]' : ''}`}
        >
          {rows.map((row, rowIndex) => (
            <div
              key={row[0].id}
              className={`flex justify-center ${
                rowIndex > 0 ? 'border-t border-mc-border' : ''
              }`}
            >
              {row.map(({ id, label, Icon, onClick }, index) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    triggerSoftHaptic();
                    onClick();
                  }}
                  style={{ width: itemWidth }}
                  className={`flex min-h-[60px] shrink-0 flex-col items-center justify-center
                              gap-1 px-1 py-2 transition-transform duration-150 active:scale-[0.96]
                              ${index > 0 ? 'border-l border-mc-border' : ''}`}
                >
                  <Icon
                    className="h-[19px] w-[19px] text-mc-brand"
                    strokeWidth={1.9}
                    aria-hidden="true"
                  />
                  {/* Wraps rather than truncates: "Zayafka qoldirish" does not fit
                      on one line at this width, and an ellipsis would hide which
                      action this is. */}
                  <span className="text-center text-[10px] font-semibold leading-[1.2] text-mc-text">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
