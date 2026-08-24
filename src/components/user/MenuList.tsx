import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { triggerSoftHaptic } from '@/utils/haptics';

export interface MenuItem {
  id: string;
  label: string;
  Icon: LucideIcon;
  /** Secondary text on the right, e.g. a masked phone number. */
  value?: string;
  onClick: () => void;
}

interface MenuListProps {
  items: MenuItem[];
  /** Larger icon chips, used for the contact rows in the design. */
  variant?: 'plain' | 'chip';
}

/**
 * A card of tappable rows.
 *
 * Rows, not a grid: the profile screen is a list of destinations, and a list
 * reads top-to-bottom at any label length — which matters because these labels
 * are translated and Russian runs 20-30% longer than Uzbek.
 */
export function MenuList({ items, variant = 'plain' }: MenuListProps) {
  if (items.length === 0) return null;

  return (
    <div className="px-4">
      <div className="overflow-hidden rounded-mc-lg border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]">
        {items.map(({ id, label, Icon, value, onClick }, index) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              triggerSoftHaptic();
              onClick();
            }}
            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left
                        transition-colors duration-150
                        ${index > 0 ? 'border-t border-mc-border' : ''}`}
          >
            {variant === 'chip' ? (
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-mc-sm
                           bg-mc-brand-soft text-mc-brand"
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
            ) : (
              <Icon
                className="h-[18px] w-[18px] shrink-0 text-mc-brand"
                strokeWidth={1.9}
                aria-hidden="true"
              />
            )}

            <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-mc-text">
              {label}
            </span>

            {value && (
              <span className="shrink-0 truncate text-[12px] font-medium text-mc-text-2">
                {value}
              </span>
            )}

            <ChevronRight className="h-4 w-4 shrink-0 text-mc-text-3" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
