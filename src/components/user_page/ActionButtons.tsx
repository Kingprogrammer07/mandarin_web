import { memo } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

type ActionTheme = 'amber' | 'emerald' | 'sky' | 'rose' | 'violet' | 'cyan';
type ActionVariant = 'primary' | 'secondary';

interface ActionItemData {
  id: string;
  icon: ReactNode;
  bgIcon?: ReactNode;
  label: string;
  desc: string;
  badge: string;
  actionLabel: string;
  theme: ActionTheme;
}

const ACCENT_VARS: Record<ActionTheme, string> = {
  amber: `
    [--ab-accent:#d97706] dark:[--ab-accent:#f6c453]
    [--ab-accent-soft:rgba(245,158,11,0.12)] dark:[--ab-accent-soft:rgba(245,158,11,0.12)]
    [--ab-badge-bg:rgba(245,158,11,0.08)] dark:[--ab-badge-bg:rgba(245,158,11,0.09)]
    [--ab-badge-border:rgba(245,158,11,0.18)] dark:[--ab-badge-border:rgba(245,158,11,0.16)]
  `,
  emerald: `
    [--ab-accent:#059669] dark:[--ab-accent:#34d399]
    [--ab-accent-soft:rgba(16,185,129,0.11)] dark:[--ab-accent-soft:rgba(16,185,129,0.10)]
    [--ab-badge-bg:rgba(16,185,129,0.08)] dark:[--ab-badge-bg:rgba(16,185,129,0.08)]
    [--ab-badge-border:rgba(16,185,129,0.16)] dark:[--ab-badge-border:rgba(16,185,129,0.14)]
  `,
  sky: `
    [--ab-accent:#0284c7] dark:[--ab-accent:#7dd3fc]
    [--ab-accent-soft:rgba(14,165,233,0.11)] dark:[--ab-accent-soft:rgba(125,211,252,0.10)]
    [--ab-badge-bg:rgba(14,165,233,0.08)] dark:[--ab-badge-bg:rgba(125,211,252,0.08)]
    [--ab-badge-border:rgba(14,165,233,0.16)] dark:[--ab-badge-border:rgba(125,211,252,0.14)]
  `,
  rose: `
    [--ab-accent:#e11d48] dark:[--ab-accent:#fb7185]
    [--ab-accent-soft:rgba(244,63,94,0.11)] dark:[--ab-accent-soft:rgba(244,63,94,0.10)]
    [--ab-badge-bg:rgba(244,63,94,0.08)] dark:[--ab-badge-bg:rgba(244,63,94,0.08)]
    [--ab-badge-border:rgba(244,63,94,0.16)] dark:[--ab-badge-border:rgba(244,63,94,0.14)]
  `,
  violet: `
    [--ab-accent:#7c3aed] dark:[--ab-accent:#c4b5fd]
    [--ab-accent-soft:rgba(139,92,246,0.10)] dark:[--ab-accent-soft:rgba(196,181,253,0.09)]
    [--ab-badge-bg:rgba(139,92,246,0.08)] dark:[--ab-badge-bg:rgba(196,181,253,0.08)]
    [--ab-badge-border:rgba(139,92,246,0.15)] dark:[--ab-badge-border:rgba(196,181,253,0.13)]
  `,
  cyan: `
    [--ab-accent:#0891b2] dark:[--ab-accent:#22d3ee]
    [--ab-accent-soft:rgba(6,182,212,0.10)] dark:[--ab-accent-soft:rgba(6,182,212,0.09)]
    [--ab-badge-bg:rgba(6,182,212,0.08)] dark:[--ab-badge-bg:rgba(6,182,212,0.08)]
    [--ab-badge-border:rgba(6,182,212,0.15)] dark:[--ab-badge-border:rgba(6,182,212,0.13)]
  `,
};

export const ActionButton = memo(({
  item,
  onClick,
  featured = false,
  variant = 'primary',
}: {
  item: ActionItemData;
  onClick?: () => void;
  featured?: boolean;
  variant?: ActionVariant;
}) => {
  const isSecondary = variant === 'secondary';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group relative w-full overflow-hidden text-left select-none
        border bg-white/90 shadow-[0_1px_2px_rgba(15,23,42,0.06)]
        transition-[transform,border-color,background-color,box-shadow] duration-200
        active:scale-[0.97]
        dark:bg-[#0a0e15]/95 dark:shadow-[0_10px_28px_rgba(0,0,0,0.22)]
        ${ACCENT_VARS[item.theme]}
        ${isSecondary
          ? 'min-h-[68px] rounded-[1.25rem] p-3 flex items-center gap-3 border-gray-200/80 dark:border-white/[0.075] sm:hover:border-orange-200/80 dark:sm:hover:border-orange-400/20'
          : 'min-h-[142px] rounded-3xl p-3.5 border-gray-200/80 dark:border-white/[0.085] sm:hover:-translate-y-0.5 sm:hover:border-orange-200/80 sm:hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] dark:sm:hover:border-orange-400/20 dark:sm:hover:bg-[#0d131d]'
        }
        ${featured
          ? 'md:col-span-3 md:min-h-[156px] md:p-5 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-5 md:border-orange-300/40 md:bg-gradient-to-br md:from-white md:via-orange-50/60 md:to-white dark:md:border-orange-400/22 dark:md:bg-[radial-gradient(circle_at_10%_20%,rgba(245,158,11,0.22),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.025)),#111824]'
          : !isSecondary
            ? 'md:min-h-[92px] md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-3 md:p-4'
            : ''
        }
      `}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-transparent opacity-70 dark:from-white/[0.06]" />
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/10" />
      {featured && (
        <div className="pointer-events-none absolute inset-x-5 top-0 hidden h-px bg-gradient-to-r from-transparent via-orange-200/80 to-transparent dark:via-orange-200/70 md:block" />
      )}

      {item.bgIcon && !isSecondary && (
        <div
          className="pointer-events-none absolute -bottom-4 -right-3 text-[color:var(--ab-accent)] opacity-[0.025] dark:opacity-[0.045]"
          aria-hidden="true"
        >
          {item.bgIcon}
        </div>
      )}

      <div
        className={`
          relative z-10 flex items-center gap-3
          ${isSecondary
            ? 'contents'
            : 'justify-between md:contents'
          }
          ${featured ? 'md:flex md:flex-col md:items-start md:justify-center' : ''}
        `}
      >
        <span
          className={`
            flex shrink-0 items-center justify-center
            bg-gray-100/90 text-[color:var(--ab-accent)] ring-1 ring-black/[0.04]
            dark:bg-white/[0.055] dark:ring-white/[0.07]
            ${isSecondary ? 'h-10 w-10 rounded-[14px]' : 'h-11 w-11 rounded-[15px]'}
            ${featured ? 'md:h-16 md:w-16 md:rounded-[22px] md:bg-[color:var(--ab-accent-soft)] md:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]' : ''}
          `}
        >
          {item.icon}
        </span>

        {!isSecondary && (
          <span
            className={`
              rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest
              text-[color:var(--ab-accent)] md:hidden
              ${featured ? 'md:mt-3 md:inline-flex' : ''}
            `}
            style={{
              backgroundColor: 'var(--ab-badge-bg)',
              borderColor: 'var(--ab-badge-border)',
            }}
          >
            {item.badge}
          </span>
        )}
      </div>

      <div
        className={`
          relative z-10 min-w-0
          ${isSecondary ? 'flex-1' : 'mt-5 md:mt-0'}
          ${featured ? 'md:mt-0' : ''}
        `}
      >
        <h3
          className={`
            font-black leading-tight text-gray-950 dark:text-[#fff8ed]
            ${isSecondary ? 'text-[13px]' : 'text-[15px]'}
            ${featured ? 'md:text-[24px]' : ''}
          `}
        >
          {item.label}
        </h3>
        <p
          className={`
            mt-1 font-semibold leading-snug text-gray-500 dark:text-white/45
            ${isSecondary ? 'text-[10.5px]' : 'text-[11.5px]'}
            ${featured ? 'md:max-w-[340px] md:text-[13px]' : ''}
          `}
        >
          {item.desc}
        </p>
      </div>

      <div
        className={`
          relative z-10 flex items-center justify-between text-[color:var(--ab-accent)]
          ${isSecondary
            ? 'ml-auto'
            : 'mt-3 border-t border-gray-100 pt-2.5 dark:border-white/[0.06] md:m-0 md:border-0 md:p-0'
          }
          ${featured ? 'md:min-h-[54px] md:min-w-[154px] md:rounded-[18px] md:bg-gradient-to-br md:from-orange-500 md:to-amber-300 md:px-5 md:text-[#241406] md:shadow-[0_16px_30px_rgba(245,158,11,0.24)]' : ''}
        `}
      >
        {!isSecondary && (
          <span className={`text-[11px] font-black tracking-wide ${!featured ? 'md:hidden' : ''}`}>
            {item.actionLabel}
          </span>
        )}
        <ChevronRight className={`${isSecondary ? 'h-4 w-4 text-gray-400 dark:text-white/35' : 'h-3.5 w-3.5'}`} />
      </div>
    </button>
  );
});

ActionButton.displayName = 'ActionButton';
export type { ActionItemData, ActionTheme };
