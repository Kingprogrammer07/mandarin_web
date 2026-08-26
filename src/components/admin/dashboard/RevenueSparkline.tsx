/**
 * A compact daily bar chart drawn as plain SVG.
 *
 * Deliberately not Recharts. That bundle is 372 kB raw / 110 kB gzip and was
 * only just taken off the critical path; pulling it back for the landing page —
 * the first screen a super-admin opens, every time — would undo the saving for
 * a chart that needs one rectangle per day and no axes.
 *
 * **Linear scale, on purpose.** Real billing here runs about 541:1 between the
 * busiest and quietest day, so most days are genuinely tiny next to the peak. A
 * sqrt or log scale would make the chart look livelier by making a 4× day look
 * 2× — on a money chart that is a lie. Three things keep the honest scale
 * readable instead:
 *
 * 1. A baseline runs the full width, so a zero day reads as "zero billed", not
 *    as a gap where the chart failed to draw.
 * 2. Any day with real money gets at least `MIN_BAR` px, so 131 000 so'm is
 *    visible rather than rounding to nothing.
 * 3. Leading empty days are dropped. The window is a fixed 30 days; when the
 *    first week of it predates any data, a quarter of the chart was blank.
 *
 * The read-out sits in a fixed row above the bars rather than in a floating
 * tooltip. A tooltip that only appears on hover is invisible on a phone, and
 * this screen is opened on both.
 */

import { useMemo, useState } from 'react';

import type { DailyRevenuePoint } from '@/api/services/adminDashboard';
import { formatTashkentDate, formatTashkentDateShort, formatUzs } from '@/lib/format';

const VIEW_W = 300;
const VIEW_H = 40;
const GAP_RATIO = 0.3;
/** Smallest bar that still reads as a bar rather than as the baseline. */
const MIN_BAR = 3;

export function RevenueSparkline({
  points,
  language,
}: {
  points: DailyRevenuePoint[];
  language?: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const { bars, visible, peak, peakIndex, total, activeDays, trimmed } = useMemo(() => {
    // Only leading zeros go. A zero at the END is today, or yesterday, and
    // "nothing billed yet today" is exactly the fact the reader came for.
    const firstReal = points.findIndex((p) => p.revenue > 0);
    const shown = firstReal > 0 ? points.slice(firstReal) : points;

    const values = shown.map((p) => p.revenue);
    const max = Math.max(...values, 0);
    const slot = shown.length > 0 ? VIEW_W / shown.length : VIEW_W;
    const width = slot * (1 - GAP_RATIO);

    return {
      visible: shown,
      peak: max,
      peakIndex: values.reduce((best, v, i) => (v > values[best] ? i : best), 0),
      total: values.reduce((sum, v) => sum + v, 0),
      activeDays: values.filter((v) => v > 0).length,
      trimmed: firstReal > 0 ? firstReal : 0,
      bars: shown.map((point, index) => {
        const height =
          max > 0 && point.revenue > 0
            ? Math.max(MIN_BAR, (point.revenue / max) * VIEW_H)
            : 0;
        return {
          key: point.period,
          x: index * slot + (slot - width) / 2,
          y: VIEW_H - height,
          width,
          height,
          slot,
          point,
          index,
        };
      }),
    };
  }, [points]);

  if (visible.length === 0) return null;

  const shownPoint = active !== null ? visible[active] : null;

  return (
    <div>
      <div className="mb-1.5 flex min-h-[30px] flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        {shownPoint ? (
          <>
            <span className="text-[15px] font-extrabold tabular-nums text-mc-brand">
              {formatUzs(shownPoint.revenue)}
            </span>
            <span className="text-[10px] font-semibold text-mc-text-2">
              {formatTashkentDate(shownPoint.period, language, {
                day: 'numeric',
                month: 'long',
                weekday: 'short',
              })}
            </span>
          </>
        ) : (
          <>
            <span
              className="text-[15px] font-extrabold tabular-nums text-mc-text"
              title={`${formatUzs(total)} — ${visible.length} kunlik jami`}
            >
              {formatUzs(total)}
            </span>
            <span className="text-[10px] font-medium text-mc-text-3">
              {visible.length} kundan {activeDays} tasida hisob bo‘lgan
            </span>
          </>
        )}
      </div>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-10 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${visible.length} kunlik hisoblangan summa, jami ${formatUzs(total)}, eng ko‘p bo‘lgan kun ${visible[peakIndex].period}`}
        onMouseLeave={() => setActive(null)}
      >
        {/* Drawn as a rect, not a line: under preserveAspectRatio="none" a
            stroke is scaled by both axes, so a 1-unit line thickens with the
            container. A rect's height only follows the (unscaled) y axis. */}
        <rect x={0} y={VIEW_H - 1} width={VIEW_W} height={1} className="fill-mc-border" />

        {bars.map((bar) => (
          <g key={bar.key}>
            {bar.height > 0 && (
              <rect
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                className="pointer-events-none fill-mc-brand"
                opacity={
                  active === bar.index
                    ? 1
                    : active !== null
                      ? 0.3
                      : bar.point.revenue === peak && peak > 0
                        ? 1
                        : 0.6
                }
              />
            )}
            {/* A full-height transparent band so the pointer catches a quiet
                day whose bar is three pixels tall. */}
            <rect
              x={bar.x - (bar.slot - bar.width) / 2}
              y={0}
              width={bar.slot}
              height={VIEW_H}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setActive(bar.index)}
              onClick={() =>
                setActive((current) => (current === bar.index ? null : bar.index))
              }
            >
              <title>
                {`${formatTashkentDateShort(bar.point.period, language)} — ${formatUzs(bar.point.revenue)}`}
              </title>
            </rect>
          </g>
        ))}
      </svg>

      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold text-mc-text-3">
        <span
          title={
            trimmed > 0
              ? `Boshidagi ${trimmed} kunda hech narsa hisoblanmagani uchun ko‘rsatilmadi`
              : undefined
          }
        >
          {formatTashkentDateShort(visible[0].period, language)}
          {trimmed > 0 && (
            <span className="ml-1 font-medium text-mc-text-3">(−{trimmed} kun)</span>
          )}
        </span>
        <span className="truncate" title={`Eng ko‘p bo‘lgan kun — ${formatUzs(peak)}`}>
          eng ko‘p {formatTashkentDateShort(visible[peakIndex].period, language)}
        </span>
        <span>{formatTashkentDateShort(visible[visible.length - 1].period, language)}</span>
      </div>
    </div>
  );
}
