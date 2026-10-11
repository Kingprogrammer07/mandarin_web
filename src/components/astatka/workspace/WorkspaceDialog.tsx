import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Pinned under the scrolling body: the buttons stay reachable. */
  footer?: ReactNode;
  /** Wider on desktop, for lists with several columns. */
  wide?: boolean;
}

/**
 * The astatka window's dialogs: a bottom sheet on a phone, a centred panel on
 * a desktop. Radix supplies the modal contract — focus trap, Escape, scroll
 * lock, `role="dialog"`, `aria-modal`, and `aria-labelledby` from the title.
 * The body is the only scroller, between a fixed header and footer, so its
 * height never has to be guessed.
 */
export function WorkspaceDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide = false,
}: Props) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-mc-xl border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)] outline-none",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[86dvh] sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-mc-xl",
            wide ? "sm:max-w-3xl" : "sm:max-w-lg",
          )}
        >
          <div className="flex shrink-0 items-start gap-2 border-b border-mc-border px-4 pb-3 pt-4">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="break-words text-[16px] font-extrabold text-mc-text">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-0.5 text-[12px] font-medium text-mc-text-3">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="Yopish"
              className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-2 active:scale-95"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {children}
          </div>
          {footer && (
            <div className="shrink-0 border-t border-mc-border px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:pb-3">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
