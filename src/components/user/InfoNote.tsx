import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

interface InfoNoteProps {
  title: string;
  children: ReactNode;
}

/**
 * Explanatory note at the foot of a list.
 *
 * `role="note"`, not `alert` or `status`: nothing has happened and nothing is
 * wrong, so it must not interrupt a screen reader mid-list.
 */
export function InfoNote({ title, children }: InfoNoteProps) {
  return (
    <div className="px-4">
      <div
        className="flex items-start gap-3 rounded-mc-lg border border-mc-brand/15
                   bg-mc-brand-soft p-3"
        role="note"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                     border border-mc-brand/30 text-mc-brand"
          aria-hidden="true"
        >
          <Info className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-mc-text">{title}</p>
          <div className="mt-1 space-y-0.5 text-[11px] leading-snug text-mc-text-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
