import { useEffect, useRef, useState, type RefObject } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AlertCircle,
  Download,
  Loader2,
  RefreshCw,
  WifiOff,
  X,
} from "lucide-react";

import type { SendTaskState } from "@/api/services/flightNotifications";
import { exportFlightCargoExcel } from "@/api/services/cargo";
import { cn } from "@/lib/utils";

import { errorMessage, sendProgress } from "./sendTask";

const BUTTON =
  "flex h-12 w-full items-center justify-center gap-2 rounded-mc-md text-[14px] font-extrabold transition-transform duration-150 active:scale-[0.98] disabled:opacity-60 motion-reduce:transition-none";

interface SendProgressDialogProps {
  /** Open while a task is tracked; `null` closes the dialog. */
  taskState: SendTaskState | null;
  flightName: string;
  isCancelling: boolean;
  /** Progress polls stopped answering — the numbers on screen may be stale. */
  pollFailed: boolean;
  onCancel: () => void;
  onRetryPolling: () => void;
  onClose: () => void;
  /**
   * Where the focus lands once the dialog is gone. It is opened from state,
   * not from a Radix Trigger, so without this the focus is left on <body>.
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Bulk-send progress. While the task runs the dialog cannot be dismissed —
 * Escape and taps outside are swallowed — because closing it would hide a
 * send that is still going out; it closes normally once the task is done.
 * When progress polls stop answering it can be closed early, but the caller
 * only hides it: the send stays tracked, and no second one can start.
 */
export function SendProgressDialog({
  taskState,
  onClose,
  ...rest
}: SendProgressDialogProps) {
  return (
    <DialogPrimitive.Root
      open={taskState !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {taskState && (
        <ProgressContent taskState={taskState} onClose={onClose} {...rest} />
      )}
    </DialogPrimitive.Root>
  );
}

function ProgressContent({
  taskState,
  flightName,
  isCancelling,
  pollFailed,
  onCancel,
  onRetryPolling,
  onClose,
  returnFocusRef,
}: SendProgressDialogProps & { taskState: SendTaskState }) {
  const [now, setNow] = useState(() => Date.now());
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const isRunning = taskState.status === "running";
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const progress = sendProgress(taskState, now);
  const canDismiss = progress.isDone || pollFailed;

  const title = !progress.isDone
    ? "Yuborilmoqda..."
    : progress.wasCancelled
      ? "Yuborish to'xtatildi"
      : // "Yakunlandi" over a run that reached no one read as a send that went out.
        taskState.sent === 0 && taskState.total > 0
        ? "Hech kimga yuborilmadi"
        : "Yuborish yakunlandi";

  const blockWhileRunning = (event: Event) => {
    if (!canDismiss) event.preventDefault();
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      await exportFlightCargoExcel(flightName);
    } catch (error) {
      const message = errorMessage(error, "Yuklab bo'lmadi");
      setExportError(
        message === "rate_limit" ? "1 daqiqa kuting (limit)" : message,
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        ref={contentRef}
        // Radix hides the page with aria-hidden but does not set this itself.
        aria-modal="true"
        // Radix would focus the first button — "To'xtatish" while running — so a
        // stray Enter could start stopping the send. The panel itself takes focus.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef?.current;
          if (!target?.isConnected) return;
          event.preventDefault();
          target.focus({ preventScroll: true });
        }}
        onEscapeKeyDown={blockWhileRunning}
        onInteractOutside={blockWhileRunning}
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-mc-xl border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)] outline-none focus-visible:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <div className="flex shrink-0 items-start gap-2 px-5 pb-2 pt-5">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="text-[17px] font-extrabold leading-tight text-mc-text">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 break-words text-[12px] font-medium text-mc-text-2">
              {flightName} · {taskState.total} ta mijozga bildirishnoma
            </DialogPrimitive.Description>
          </div>
          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-2 active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">
          <div
            role="progressbar"
            aria-label="Yuborish jarayoni"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
            className="h-2 w-full overflow-hidden rounded-full bg-mc-surface-2"
          >
            <div
              className={cn(
                "h-full w-full origin-left rounded-full transition-transform duration-500 motion-reduce:transition-none",
                progress.isDone && taskState.failed > 0
                  ? "bg-mc-danger"
                  : "bg-mc-brand",
              )}
              style={{ transform: `scaleX(${progress.percent / 100})` }}
            />
          </div>

          <p
            aria-live="polite"
            aria-atomic="true"
            className="text-center text-[13px] font-bold tabular-nums text-mc-text-2"
          >
            {progress.percent}% — {progress.processed}/{taskState.total}
          </p>

          <dl className="grid grid-cols-3 gap-2">
            <Counter
              label="Yuborildi"
              value={taskState.sent}
              className="bg-mc-success/12 text-mc-success"
            />
            <Counter
              label="Xato"
              value={taskState.failed}
              className="bg-mc-danger-soft text-mc-danger"
            />
            <Counter
              label="O'tkazildi"
              value={taskState.skipped}
              className="bg-mc-surface-2 text-mc-text-2"
            />
          </dl>

          {taskState.errors.length > 0 && (
            <ul
              aria-label="Xatolar"
              className="max-h-32 space-y-1.5 overflow-y-auto overscroll-contain rounded-mc-md border border-mc-border bg-mc-danger-soft p-3"
            >
              {taskState.errors.map((item, index) => (
                <li
                  key={`${item.client_id}-${index}`}
                  className="flex items-start gap-2 text-[12px] text-mc-text"
                >
                  <AlertCircle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mc-danger"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words">
                    <span className="font-bold">{item.client_id}:</span>{" "}
                    {item.error}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {pollFailed && !progress.isDone && (
            <div
              role="alert"
              className="space-y-2 rounded-mc-md bg-mc-warn-soft p-3"
            >
              <p className="flex items-start gap-2 text-[12px] font-bold text-mc-warn">
                <WifiOff
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                Yuborish holatini olib bo'lmadi. Internet aloqasini tekshiring —
                yuborish serverda davom etmoqda.
              </p>
              <button
                type="button"
                onClick={onRetryPolling}
                className={cn(
                  BUTTON,
                  "h-11 border border-mc-border bg-mc-surface text-[13px] text-mc-text",
                )}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Qayta tekshirish
              </button>
            </div>
          )}

          {!progress.isDone && (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-1">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-mc-text-2">
                  <Loader2
                    className="h-4 w-4 motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                  {isCancelling ? "To'xtatilmoqda..." : "Yuborilmoqda..."}
                </p>
                {progress.etaText && (
                  <p className="text-[12px] font-bold text-mc-brand">
                    {progress.etaText}
                  </p>
                )}
              </div>
              {confirmingCancel && !isCancelling ? (
                <div className="space-y-2 rounded-mc-md border border-mc-border p-3">
                  <p className="text-center text-[13px] font-bold text-mc-text">
                    Yuborish to'xtatilsinmi? Qolgan mijozlarga yuborilmaydi.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingCancel(false)}
                      className={cn(
                        BUTTON,
                        "h-11 border border-mc-border bg-mc-surface text-[13px] text-mc-text",
                      )}
                    >
                      Davom etish
                    </button>
                    <button
                      type="button"
                      onClick={onCancel}
                      className={cn(
                        BUTTON,
                        "h-11 bg-mc-danger-fill text-[13px] text-mc-on-danger",
                      )}
                    >
                      Ha, to'xtatish
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  disabled={isCancelling}
                  className={cn(
                    BUTTON,
                    "h-11 border border-mc-danger/40 bg-mc-surface text-[13px] text-mc-danger",
                  )}
                >
                  {isCancelling ? (
                    <Loader2
                      className="h-4 w-4 motion-safe:animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <X className="h-4 w-4" aria-hidden="true" />
                  )}
                  To'xtatish
                </button>
              )}
            </div>
          )}

          {progress.isDone && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className={cn(BUTTON, "bg-mc-success text-mc-on-success")}
              >
                {isExporting ? (
                  <Loader2
                    className="h-4 w-4 motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
                {isExporting ? "Yuklanmoqda..." : "Excel yuklab olish"}
              </button>
              {exportError && (
                <p
                  role="alert"
                  className="flex items-center justify-center gap-1.5 text-center text-[12px] font-bold text-mc-danger"
                >
                  <AlertCircle
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  {exportError}
                </p>
              )}
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  BUTTON,
                  "border border-mc-border bg-mc-surface text-mc-text",
                )}
              >
                Yopish
              </button>
            </div>
          )}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function Counter({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse items-center rounded-mc-md px-1 py-2",
        className,
      )}
    >
      <dt className="text-[11px] font-semibold">{label}</dt>
      <dd className="text-[17px] font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}
