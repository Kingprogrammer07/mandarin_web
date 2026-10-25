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
}

/**
 * A card of tappable rows.
 *
 * Rows, not a grid: the profile screen is a list of destinations, and a list
 * reads top-to-bottom at any label length — which matters because these labels
 * are translated and Russian runs 20-30% longer than Uzbek.
 */
export function MenuList({ items }: MenuListProps) {
  if (items.length === 0) return null;

  return (
    <div className="px-4">
      <div className="overflow-hidden rounded-mc-lg border border-mc-border bg-mc-surface">
        {items.map(({ id, label, Icon, value, onClick }, index) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              triggerSoftHaptic();
              onClick();
            }}
            className="flex min-h-[46px] w-full items-center gap-3 pl-3.5 text-left
                       transition-colors duration-150 active:bg-mc-surface-2"
          >
            <Icon
              className="h-[18px] w-[18px] shrink-0 text-mc-text-2"
              strokeWidth={1.8}
              aria-hidden="true"
            />

            {/* The rule starts at the label so the icons read as one column. */}
            <span
              className={`flex min-h-[46px] min-w-0 flex-1 items-center gap-2 pr-3.5
                          ${index > 0 ? 'border-t border-mc-border' : ''}`}
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-mc-text">
                {label}
              </span>

              {value && (
                <span className="shrink-0 truncate text-[12px] text-mc-text-2 tabular-nums">
                  {value}
                </span>
              )}

              <ChevronRight className="h-4 w-4 shrink-0 text-mc-text-3" aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
