import type { Ref } from "react";
import { AlertCircle, ChevronRight, Loader2, Send } from "lucide-react";

import { cn } from "@/lib/utils";

import { sendChannelsLabel } from "./notificationFilters";

interface SendBarProps {
  selectedCount: number;
  markWeb: boolean;
  markBot: boolean;
  isOstatka: boolean;
  isSending: boolean;
  /**
   * A send is still running on the server while its progress dialog is
   * closed: the bar says so and offers the dialog back instead of a new send.
   */
  onShowRunningSend?: () => void;
  onSend: () => void;
  sendButtonRef?: Ref<HTMLButtonElement>;
  /**
   * Pinned to the viewport instead of closing a flex column. Used when the
   * page lives inside the app's document scroll, where `sticky` cannot work
   * (an ancestor clips overflow).
   */
  floating: boolean;
}

/** The primary action, always under the thumb: what is selected and how it goes out. */
export function SendBar({
  selectedCount,
  markWeb,
  markBot,
  isOstatka,
  isSending,
  onShowRunningSend,
  onSend,
  sendButtonRef,
  floating,
}: SendBarProps) {
  const channels = sendChannelsLabel(markWeb, markBot);

  let hint = <span>Kanal: {channels}</span>;
  if (isOstatka) {
    hint = <span>Ostatka reyslar bot orqali yuboriladi</span>;
  } else if (!channels) {
    hint = (
      <span className="inline-flex items-center gap-1 text-mc-danger">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Kanal tanlanmagan
      </span>
    );
  }

  return (
    <div
      className={cn(
        "border-t border-mc-border bg-mc-surface",
        floating ? "fixed inset-x-0 bottom-0 z-30" : "shrink-0",
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5">
        {onShowRunningSend ? (
          <button
            type="button"
            onClick={onShowRunningSend}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-mc-sm text-left transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-extrabold text-mc-text">
                Yuborish davom etmoqda
              </span>
              <span className="block text-[11px] font-semibold text-mc-brand">
                Holatini ko'rish
              </span>
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-mc-text-3"
              aria-hidden="true"
            />
          </button>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold tabular-nums text-mc-text">
              {selectedCount > 0
                ? `${selectedCount} ta tanlandi`
                : "Mijoz tanlanmagan"}
            </p>
            <p className="text-[11px] font-semibold text-mc-text-2">{hint}</p>
          </div>
        )}
        <button
          ref={sendButtonRef}
          type="button"
          onClick={onSend}
          disabled={isSending || selectedCount === 0 || isOstatka}
          className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-mc-md bg-mc-brand px-4 text-[14px] font-extrabold text-mc-on-brand shadow-[var(--mc-shadow-cta)] transition-transform duration-150 active:scale-[0.97] disabled:opacity-50 disabled:shadow-none motion-reduce:transition-none"
        >
          {isSending ? (
            <Loader2
              className="h-4 w-4 motion-safe:animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          {selectedCount > 0 ? `Yuborish (${selectedCount})` : "Yuborish"}
        </button>
      </div>
    </div>
  );
}
