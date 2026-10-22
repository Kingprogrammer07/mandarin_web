import { triggerSoftHaptic } from "@/utils/haptics";

interface FilterSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Short word shown next to the switch. */
  label: string;
  /** What the switch does, read out by screen readers. */
  ariaLabel: string;
}

/**
 * On/off chip for a search toolbar.
 *
 * A switch, not a checkbox: a 14px tick box is a poor target for someone
 * holding a scanner, and the state reads at a glance from across the bench.
 * The whole chip is the target, not just the switch.
 */
export default function FilterSwitch({ checked, onChange, label, ariaLabel }: FilterSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => {
        triggerSoftHaptic();
        onChange(!checked);
      }}
      className={`flex items-center gap-2 shrink-0 px-2.5 h-[42px] rounded-xl border select-none transition-colors ${
        checked
          ? "bg-orange-50 border-orange-300 dark:bg-orange-500/[0.08] dark:border-orange-500/30"
          : "bg-white border-gray-200 dark:bg-white/[0.04] dark:border-white/[0.08]"
      }`}
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 ${
          checked ? "bg-orange-500" : "bg-gray-200 dark:bg-white/[0.12]"
        }`}
        aria-hidden="true"
      >
        <span
          className="inline-block rounded-full bg-white shadow transition-transform duration-150"
          style={{
            height: 15,
            width: 15,
            transform: `translateX(${checked ? 18 : 3}px)`,
          }}
        />
      </span>
      <span
        className={`text-[11px] font-bold transition-colors ${
          checked ? "text-orange-600 dark:text-orange-400" : "text-gray-600 dark:text-gray-300"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
