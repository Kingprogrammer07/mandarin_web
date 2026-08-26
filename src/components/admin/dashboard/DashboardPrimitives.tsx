/**
 * The small pieces the admin dashboard is built from, on `--mc-*` tokens.
 *
 * Written fresh rather than reused from `components/statistics/`: `StatCard`
 * and its siblings are raw palette (`bg-white dark:bg-gray-900`, hardcoded
 * `#6366f1`) and carry hover-only affordances, both of which the frontend
 * guide forbids. The geometry below follows `components/user/HomeStatCards.tsx`
 * so the admin panel reads like the client app.
 */

import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';

import { triggerSoftHaptic } from '@/utils/haptics';

export type Tone = 'quiet' | 'brand' | 'warn' | 'danger' | 'success';

const TONE_GROUND: Record<Tone, string> = {
  quiet: 'bg-mc-surface-2 border-mc-border',
  brand: 'bg-mc-brand-soft border-mc-brand/10',
  warn: 'bg-mc-warn-soft border-mc-warn/10',
  danger: 'bg-mc-danger-soft border-mc-danger/10',
  success: 'bg-mc-success/12 border-mc-success/15',
};

const TONE_INK: Record<Tone, string> = {
  quiet: 'text-mc-text-2',
  brand: 'text-mc-brand',
  warn: 'text-mc-warn',
  danger: 'text-mc-danger',
  success: 'text-mc-success',
};

export function TileSkeleton() {
  return (
    <div className="h-[72px] animate-pulse rounded-mc-lg border border-mc-border bg-mc-surface-2" />
  );
}

/** A pill that states a runtime flag in words, not only in colour. */
export function StatusChip({
  label,
  state,
  tone,
  Icon,
}: {
  label: string;
  state: string;
  tone: Tone;
  Icon: LucideIcon;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[11px] font-extrabold ${TONE_GROUND[tone]} ${TONE_INK[tone]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
      <span className="font-semibold text-mc-text-2">{label}</span>
      <span>{state}</span>
    </span>
  );
}

/**
 * A titled block.
 *
 * `action` puts a link in the header; `footer` puts a full-width strip under a
 * hairline. They are not interchangeable — the header slot is for a short
 * "go to the real screen" link, the footer for a status line or a wide
 * call-to-action, and a panel should use one or the other, never both.
 */
export function SectionCard({
  title,
  subtitle,
  action,
  footer,
  bodyClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
  footer?: React.ReactNode;
  /** Escape hatch for panels whose body needs its own grid. */
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-mc-lg border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]">
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <div className="min-w-0">
          <h2
            className="truncate text-[15px] font-extrabold tracking-tight text-mc-text"
            title={title}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-[11px] font-medium text-mc-text-3">{subtitle}</p>
          )}
        </div>
        {action && (
          <button
            type="button"
            onClick={() => {
              triggerSoftHaptic();
              action.onClick();
            }}
            className="flex min-h-[44px] shrink-0 items-center rounded-mc-sm px-2 text-[11px] font-bold text-mc-brand transition-transform active:scale-95"
          >
            {action.label}
          </button>
        )}
      </div>

      {/* `@container` so the grids inside a panel size themselves against the
          PANEL, not the viewport. Half of these panels sit in a two-column row
          where a viewport `xl:grid-cols-4` resolves to 110px tiles — the media
          query is true, the space is not there. */}
      <div className={`@container ${bodyClassName ?? 'flex-1 px-4 pb-4 pt-3'}`}>
        {children}
      </div>

      {footer && (
        <div className="border-t border-mc-border px-4 py-2.5">{footer}</div>
      )}
    </section>
  );
}

/** The right-aligned "see everything" link the mockup puts under a panel. */
export function SectionFooterLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        triggerSoftHaptic();
        onClick();
      }}
      className="ml-auto flex min-h-[36px] items-center gap-1.5 text-[12px] font-bold text-mc-brand transition-transform active:scale-95"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
    </button>
  );
}

/** A dot + label pair for the legend strips under the stat panels. */
export function LegendDot({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold text-mc-text-3">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
      {label}
    </span>
  );
}

/** A label/value row for the money and flight blocks. */
export function MetricRow({
  label,
  value,
  tone = 'quiet',
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span
        className="min-w-0 truncate text-[12px] font-medium text-mc-text-2"
        title={label}
      >
        {label}
      </span>
      <span className={`shrink-0 text-[13px] font-extrabold tabular-nums ${TONE_INK[tone]}`}>
        {value}
      </span>
    </div>
  );
}

/** Shared empty state so a quiet section never looks like a broken one. */
export function EmptyNote({ text }: { text: string }) {
  return (
    <p className="rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-4 text-center text-[12px] font-medium text-mc-text-3">
      {text}
    </p>
  );
}
