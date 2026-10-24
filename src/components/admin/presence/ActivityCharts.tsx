/**
 * Small charts for client activity. One series each, one hue (brand), on the
 * dashboard tokens. Hover, tap or focus a mark and the readout line above the
 * chart states the exact value, so nothing is read off bar heights alone.
 */

import { useState } from 'react';

interface BarsProps {
  values: number[];
  /** Axis label under each bar; '' leaves the slot empty. */
  ticks: string[];
  /** Exact sentence for one bar, shown in the readout. */
  describe: (index: number) => string;
  /** Said when nothing is hovered. */
  idle: string;
  /** Indices to mark (e.g. the peak); drawn at full strength, the rest lighter. */
  marked?: number[];
  height?: number;
  ariaLabel: string;
}

export function Bars({ values, ticks, describe, idle, marked = [], height = 120, ariaLabel }: BarsProps) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...values, 0);
  return (
    <figure className="min-w-0">
      <p className="min-h-[18px] text-[12px] font-semibold text-mc-text-2" aria-live="polite">
        {active === null ? idle : describe(active)}
      </p>
      <div
        role="list"
        aria-label={ariaLabel}
        className="mt-2 flex items-end gap-[2px]"
        style={{ height }}
        onPointerLeave={() => setActive(null)}
      >
        {values.map((v, i) => {
          const pct = max > 0 ? (v / max) * 100 : 0;
          const strong = active === i || marked.includes(i);
          return (
            <button
              key={i}
              type="button"
              role="listitem"
              aria-label={describe(i)}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(i)}
              className="group relative flex h-full min-w-0 flex-1 items-end focus:outline-none"
            >
              <span
                className={`block w-full rounded-t-[4px] transition-colors ${
                  strong ? 'bg-mc-brand' : 'bg-mc-brand/40'
                } group-focus-visible:ring-2 group-focus-visible:ring-mc-brand`}
                style={{ height: v > 0 ? `max(${pct}%, 2px)` : 0 }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[2px] border-t border-mc-border pt-1" aria-hidden>
        {ticks.map((t, i) => (
          <span key={i} className="min-w-0 flex-1 text-center text-[10px] font-medium tabular-nums text-mc-text-3">
            {t}
          </span>
        ))}
      </div>
    </figure>
  );
}

interface HeatmapProps {
  /** rows × 24 */
  values: number[][];
  rowLabels: string[];
  describe: (row: number, hour: number) => string;
  idle: string;
}

/** Weekday × hour. Darker = more clients; empty cells mean nobody. */
export function Heatmap({ values, rowLabels, describe, idle }: HeatmapProps) {
  const [active, setActive] = useState<[number, number] | null>(null);
  const max = Math.max(0, ...values.flat());
  return (
    <figure className="min-w-0">
      <p className="min-h-[18px] text-[12px] font-semibold text-mc-text-2" aria-live="polite">
        {active ? describe(active[0], active[1]) : idle}
      </p>
      <div className="mc-no-scrollbar mt-2 overflow-x-auto">
        <div className="min-w-[520px]" onPointerLeave={() => setActive(null)}>
          {values.map((row, r) => (
            <div key={r} className="flex items-center gap-[2px] py-[1px]">
              <span className="w-7 shrink-0 text-[10px] font-bold text-mc-text-3">{rowLabels[r]}</span>
              {row.map((v, h) => {
                const level = max > 0 ? v / max : 0;
                const on = active?.[0] === r && active?.[1] === h;
                return (
                  <button
                    key={h}
                    type="button"
                    aria-label={describe(r, h)}
                    onPointerEnter={() => setActive([r, h])}
                    onFocus={() => setActive([r, h])}
                    onClick={() => setActive([r, h])}
                    className={`h-6 min-w-0 flex-1 rounded-[3px] focus:outline-none focus-visible:ring-2 focus-visible:ring-mc-brand ${
                      v > 0 ? '' : 'bg-mc-surface-2'
                    } ${on ? 'ring-2 ring-mc-text' : ''}`}
                    style={
                      v > 0
                        ? {
                            backgroundColor: 'var(--mc-brand)',
                            opacity: 0.12 + 0.88 * level,
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          ))}
          <div className="flex gap-[2px] pt-1" aria-hidden>
            <span className="w-7 shrink-0" />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="min-w-0 flex-1 text-center text-[10px] tabular-nums text-mc-text-3">
                {h % 3 === 0 ? h : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] font-medium text-mc-text-3" aria-hidden>
        <span>Kam</span>
        {[0.12, 0.34, 0.56, 0.78, 1].map((o) => (
          <span key={o} className="h-2.5 w-4 rounded-[2px]" style={{ backgroundColor: 'var(--mc-brand)', opacity: o }} />
        ))}
        <span>Ko‘p</span>
        <span className="ml-1 inline-block h-2.5 w-4 rounded-[2px] bg-mc-surface-2" />
        <span>Hech kim</span>
      </div>
    </figure>
  );
}

/** 24 cells for one day; filled = the client was active in that hour. */
export function HourStrip({ hours, label }: { hours: number[]; label: string }) {
  const set = new Set(hours);
  return (
    <div className="flex gap-[2px]" role="img" aria-label={label}>
      {Array.from({ length: 24 }, (_, h) => (
        <span
          key={h}
          className={`h-3 min-w-0 flex-1 rounded-[2px] ${set.has(h) ? 'bg-mc-brand' : 'bg-mc-surface-2'}`}
        />
      ))}
    </div>
  );
}
