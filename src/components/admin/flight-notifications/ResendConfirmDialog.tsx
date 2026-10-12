import type { RefObject } from "react";
import { AlertTriangle } from "lucide-react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

import type { ClientNotificationStatus } from "@/api/services/flightNotifications";
import { cn } from "@/lib/utils";

import { notifiedChannelsLabel } from "./notificationFilters";

const BUTTON =
  "flex h-12 w-full items-center justify-center rounded-mc-md px-3 text-center text-[14px] font-extrabold leading-tight transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none";

interface ResendConfirmDialogProps {
  /** Selected clients that were already notified; `null` closes the dialog. */
  clients: readonly ClientNotificationStatus[] | null;
  onConfirm: () => void;
  onCancel: () => void;
  /** The send button: the focus goes back to it on "Bekor qilish". */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Asks before a send reaches clients who already got this flight's report.
 * The list can run to hundreds of codes ("Barchasini tanlash" on a flight
 * that is mostly sent), so it scrolls inside the panel between a fixed header
 * and fixed buttons — the answer is always on screen, down to 320px.
 * Escape, the cancel button and focus all start on "Bekor qilish": a stray
 * Enter must not send the report twice.
 */
export function ResendConfirmDialog({
  clients,
  onConfirm,
  onCancel,
  returnFocusRef,
}: ResendConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root
      open={clients !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      {clients && (
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <AlertDialogPrimitive.Content
            // Radix hides the page with aria-hidden but does not set this itself.
            aria-modal="true"
            onCloseAutoFocus={(event) => {
              const target = returnFocusRef?.current;
              if (!target?.isConnected) return;
              event.preventDefault();
              target.focus({ preventScroll: true });
            }}
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-mc-xl border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
          >
            <div className="flex shrink-0 items-start gap-3 px-5 pb-3 pt-5">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-md bg-mc-warn-soft text-mc-warn"
              >
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <AlertDialogPrimitive.Title className="text-[16px] font-extrabold leading-snug text-mc-text">
                  {`${clients.length} ta mijoz allaqachon yuborilgan`}
                </AlertDialogPrimitive.Title>
                <AlertDialogPrimitive.Description className="mt-1 text-[12px] font-medium leading-relaxed text-mc-text-2">
                  Ularga hisobot qayta yuboriladi. Baribir yuborilsinmi?
                </AlertDialogPrimitive.Description>
              </div>
            </div>

            <ul
              aria-label="Allaqachon yuborilgan mijozlar"
              className="min-h-0 flex-1 divide-y divide-mc-border overflow-y-auto overscroll-contain border-y border-mc-border px-5"
            >
              {clients.map((client) => (
                <li
                  key={client.client_id}
                  className="flex items-baseline justify-between gap-3 py-2 text-[13px]"
                >
                  <span className="min-w-0 break-all font-bold text-mc-text">
                    {client.client_id}
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-mc-text-2">
                    {notifiedChannelsLabel(client)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="grid shrink-0 grid-cols-2 gap-2 px-5 pb-5 pt-4">
              <AlertDialogPrimitive.Cancel
                className={cn(
                  BUTTON,
                  "border border-mc-border bg-mc-surface text-mc-text",
                )}
              >
                Bekor qilish
              </AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action
                onClick={onConfirm}
                className={cn(BUTTON, "bg-mc-warn text-mc-on-warn")}
              >
                Ha, qayta yuborish
              </AlertDialogPrimitive.Action>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      )}
    </AlertDialogPrimitive.Root>
  );
}
