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
        className="flex items-start gap-3 rounded-mc-lg border border-mc-border bg-mc-surface p-3"
        role="note"
      >
        <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-mc-text-3" strokeWidth={1.9} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-mc-text">{title}</p>
          <div className="mt-0.5 space-y-0.5 text-[12px] leading-snug text-mc-text-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
