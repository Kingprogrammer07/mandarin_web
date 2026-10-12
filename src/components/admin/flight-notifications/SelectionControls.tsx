import type { LucideIcon } from "lucide-react";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

export type CheckedState = boolean | "mixed";

/**
 * The drawn box of a checkbox. Purely visual — the control that owns it
 * carries `role="checkbox"` and `aria-checked`, so this stays aria-hidden.
 * A tick (or a dash for "some") is drawn, never colour alone.
 */
export function SelectionMark({
  checked,
  size = "md",
}: {
  checked: CheckedState;
  size?: "sm" | "md";
}) {
  const isOn = checked !== false;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 motion-reduce:transition-none",
        size === "md" ? "h-6 w-6" : "h-5 w-5",
        isOn
          ? "border-mc-brand bg-mc-brand text-mc-on-brand"
          : "border-mc-text-3 bg-mc-surface",
      )}
    >
      {checked === "mixed" ? (
        <Minus
          className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"}
          strokeWidth={3}
        />
      ) : checked ? (
        <Check
          className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"}
          strokeWidth={3}
        />
      ) : null}
    </span>
  );
}

interface ChannelCheckboxProps {
  label: string;
  icon: LucideIcon;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** A send channel (Web / Bot) as a 44px chip that behaves as a checkbox. */
export function ChannelCheckbox({
  label,
  icon: Icon,
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: ChannelCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex h-11 min-w-0 items-center gap-2 rounded-mc-sm border px-3 text-[13px] font-bold transition-transform duration-150 active:scale-[0.97] disabled:opacity-50 motion-reduce:transition-none",
        checked
          ? "border-mc-brand bg-mc-brand-soft text-mc-text"
          : "border-mc-border bg-mc-surface text-mc-text-2",
        className,
      )}
    >
      <SelectionMark checked={checked} size="sm" />
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
