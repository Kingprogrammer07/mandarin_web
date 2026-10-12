import { useRef, type ReactNode } from "react";
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
  /** Wider on desktop, for lists with several columns. Same as `size="wide"`. */
  wide?: boolean;
  /** Desktop width; "xl" leaves room for a photo beside its facts. */
  size?: DialogSize;
}

type DialogSize = "default" | "wide" | "xl";

const MAX_WIDTH: Record<DialogSize, string> = {
  default: "sm:max-w-lg",
  wide: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
};

/**
 * The astatka window's dialogs: a bottom sheet on a phone, a centred panel on
 * a desktop. Radix supplies most of the modal contract — focus trap, Escape,
 * scroll lock, `role="dialog"`, `aria-labelledby` from the title, and
 * `aria-hidden` on the page behind. It sets neither `aria-modal` nor a focus
 * return for a dialog opened from state rather than its own Trigger, so both
 * are done here. The body is the only scroller, between a fixed header and
 * footer, so its height never has to be guessed.
 */
export function WorkspaceDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide = false,
  size,
}: Props) {
  /** Whatever had the focus when the dialog opened: a row, a menu button. */
  const openerRef = useRef<HTMLElement | null>(null);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-modal="true"
          // Radix has not moved the focus yet when this runs.
          onOpenAutoFocus={() => {
            const active = document.activeElement;
            openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
          }}
          // With no Trigger, Radix would hand the focus to <body> and a
          // keyboard user would start again from the top of the page. Only a
          // lost focus is put back: the work mode's scan field may already
          // have taken it, and must keep it for the next scan.
          onCloseAutoFocus={(event) => {
            const opener = openerRef.current;
            openerRef.current = null;
            const lost = document.activeElement === null || document.activeElement === document.body;
            if (!lost || !opener?.isConnected) return;
            event.preventDefault();
            opener.focus({ preventScroll: true });
          }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-mc-xl border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)] outline-none",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[86dvh] sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-mc-xl",
            MAX_WIDTH[size ?? (wide ? "wide" : "default")],
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
