/**
 * The trend line inside a provider card.
 *
 * A line, not bars: at this size — roughly 160 by 28 pixels — twenty-four bars
 * are two pixels wide each and read as noise. A line carries the same shape and
 * survives being small, which is the only thing this graphic has to do; the
 * exact figure is the number printed above it.
 *
 * Drawn as plain SVG. Recharts is 372 kB raw and was taken off the critical
 * path once already; six of these on one screen is not a reason to bring it
 * back.
 *
 * The scale is per card, not shared. NBU takes five times what CLICK does, and
 * a shared scale would flatten every smaller provider into a straight line —
 * hiding exactly the shape each card exists to show. Comparison between
 * providers is what the printed totals are for.
 */

const VIEW_W = 100;
const VIEW_H = 22;

export function ProviderSparkline({
  points,
  tone,
}: {
  points: number[];
  tone: 'brand' | 'success';
}) {
  const stroke = tone === 'brand' ? 'stroke-mc-brand' : 'stroke-mc-success';

  // One point cannot make a line, and an all-zero window has no shape to draw.
  const peak = Math.max(...points, 0);
  if (points.length < 2 || peak <= 0) {
    return (
      <div className="flex h-5 items-center" aria-hidden="true">
        <span className="h-px w-full bg-mc-border" />
      </div>
    );
  }

  const step = VIEW_W / (points.length - 1);
  const path = points
    .map((value, index) => {
      const x = index * step;
      // A 1px floor keeps the line off the very edge, so a zero bucket is
      // visibly ON the baseline rather than merged into the card's border.
      const y = VIEW_H - 1 - (value / peak) * (VIEW_H - 2);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-5 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        className={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        // Under preserveAspectRatio="none" the stroke is scaled by both axes;
        // this keeps the line an even weight however wide the card gets.
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
