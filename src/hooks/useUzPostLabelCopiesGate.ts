import { useCallback, useRef, useState } from "react";
import { useUzPostLabelSettings } from "@/api/hooks/useWarehouse";
import type { UzPostLabelSettings } from "@/api/services/warehouse";

/**
 * Whether to ask, before a UzPost label prints, how many copies it should have.
 *
 * Only the account allowed to decide is asked, and only while nothing has been
 * decided. Everyone else prints exactly as before. Settings that have not
 * loaded, or failed to, never hold a print up: the backend reads the count
 * itself when the label prints, so asking is a convenience, not a gate.
 */
export function shouldAskLabelCopies(
  settings: UzPostLabelSettings | undefined,
): boolean {
  return (
    settings !== undefined && settings.can_configure && settings.copies === null
  );
}

export interface UzPostLabelCopiesGate {
  /** Runs `print` now, or once the question has been answered or skipped. */
  guard: (print: () => void) => void;
  /** Spread onto `<UzPostLabelCopiesDialog mode="ask" />`. */
  dialog: {
    open: boolean;
    currentCopies: number | null;
    onDone: () => void;
    onCancel: () => void;
  };
}

/**
 * Holds a UzPost print back until the copy count is chosen, whenever it should
 * be asked for at all (see {@link shouldAskLabelCopies}).
 *
 * Cancelling the question drops the held print. The form it came from is still
 * on screen, so nothing typed or photographed is lost, and submitting again
 * asks again.
 */
export function useUzPostLabelCopiesGate(): UzPostLabelCopiesGate {
  const { data: settings } = useUzPostLabelSettings();
  // A ref, not state: React treats a function handed to a state setter as an
  // updater and would call it, printing before anyone answered.
  const heldPrint = useRef<(() => void) | null>(null);
  const [open, setOpen] = useState(false);

  const guard = useCallback(
    (print: () => void) => {
      if (!shouldAskLabelCopies(settings)) {
        print();
        return;
      }
      heldPrint.current = print;
      setOpen(true);
    },
    [settings],
  );

  const onDone = useCallback(() => {
    const print = heldPrint.current;
    heldPrint.current = null;
    setOpen(false);
    print?.();
  }, []);

  const onCancel = useCallback(() => {
    heldPrint.current = null;
    setOpen(false);
  }, []);

  return {
    guard,
    dialog: {
      open,
      currentCopies: settings?.copies ?? null,
      onDone,
      onCancel,
    },
  };
}
