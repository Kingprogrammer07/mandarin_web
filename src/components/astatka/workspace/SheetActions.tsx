import { Loader2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type SheetActionTone = "primary" | "neutral" | "warn" | "danger";

export interface SheetAction {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: SheetActionTone;
  onSelect: () => void;
  disabled?: boolean;
  /** Shows a spinner and blocks a second press while the request runs. */
  pending?: boolean;
}

const TONE: Record<SheetActionTone, string> = {
  primary: "bg-mc-brand font-extrabold text-mc-on-brand",
  neutral: "border border-mc-border bg-mc-surface font-bold text-mc-text",
  warn: "border border-mc-border bg-mc-surface font-bold text-mc-warn",
  danger: "border border-mc-border bg-mc-surface font-bold text-mc-danger",
};

/**
 * The bag window's footer buttons. Two to a row on a phone — the main action
 * takes a whole row, and so does a lone last button — one row on a desktop.
 * Labels may wrap to two lines rather than be cut at 320px.
 */
export function SheetActions({ actions }: { actions: SheetAction[] }) {
  const secondary = actions.filter((action) => action.tone !== "primary");
  const lastSecondary =
    secondary.length % 2 === 1 ? secondary.at(-1) : undefined;
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
      {actions.map((action) => {
        const Icon = action.icon;
        const fullRow = action.tone === "primary" || action === lastSecondary;
        return (
          <button
            key={action.key}
            type="button"
            onClick={action.onSelect}
            disabled={action.disabled || action.pending}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 rounded-mc-md px-3 py-1.5 text-center text-[14px] leading-tight active:scale-[0.98] disabled:opacity-60 sm:min-w-40 sm:px-4",
              TONE[action.tone],
              fullRow && "col-span-2",
            )}
          >
            {action.pending ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Icon className="h-4 w-4 shrink-0" />
            )}
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
