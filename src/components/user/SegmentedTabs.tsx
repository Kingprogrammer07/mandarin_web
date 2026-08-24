import { triggerSoftHaptic } from '@/utils/haptics';

export interface SegmentedTab<T extends string> {
  id: T;
  label: string;
  /** Rendered as a pill beside the label. Omit to show no counter. */
  count?: number;
}

interface SegmentedTabsProps<T extends string> {
  tabs: SegmentedTab<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Announced as the group's purpose, e.g. "Yuklarni filtrlash". */
  label: string;
}

/**
 * Two-up segmented control with counters.
 *
 * `role="tablist"` rather than a radio group: these switch which list is shown
 * without submitting anything, which is what a tab is. The count lives inside
 * the button so a screen reader reads "Faol, 3" as one name instead of leaving
 * the number stranded beside it.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: SegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex flex-1 gap-1 rounded-mc-lg border border-mc-border bg-mc-surface p-1"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              if (isActive) return;
              triggerSoftHaptic();
              onChange(tab.id);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-mc-md
                        px-3 py-2 text-[13px] font-bold transition-colors duration-150
                        ${
                          isActive
                            ? 'border border-mc-brand/25 bg-mc-brand-soft text-mc-brand'
                            : 'border border-transparent text-mc-text-2'
                        }`}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full
                            px-1.5 text-[11px] font-extrabold tabular-nums
                            ${
                              isActive
                                ? 'bg-mc-brand text-mc-on-brand'
                                : 'bg-mc-surface-2 text-mc-text-2'
                            }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
