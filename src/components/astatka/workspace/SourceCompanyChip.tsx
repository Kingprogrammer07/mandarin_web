import { Link2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  /** The partner's name, or its code ("AKB"). */
  label: string;
  /**
   * "AKB · API" where the bag was just found through the partner's API; the
   * saved list only names the cargo.
   */
  api?: boolean;
  className?: string;
}

/**
 * Marks a bag that came from a partner cargo's API, not from our database.
 * Outlined and neutral, so it never reads as one of the filled state chips
 * beside it; the same height as they are (1px border + 1px padding).
 */
export function SourceCompanyChip({ label, api = true, className }: Props) {
  const sentence = `${label} API'dan topildi`;
  return (
    <span
      title={sentence}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border border-mc-border bg-mc-surface px-2 py-px text-[11px] font-bold text-mc-text-2",
        className,
      )}
    >
      <Link2 className="h-3 w-3 shrink-0" aria-hidden />
      <span aria-hidden className="break-words">
        {api ? `${label} · API` : label}
      </span>
      <span className="sr-only">{sentence}</span>
    </span>
  );
}
