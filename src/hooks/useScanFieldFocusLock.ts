import { useCallback, useEffect, type RefObject } from "react";

/** Open overlays own the focus while they are up. */
const OVERLAY_SELECTOR = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  "[data-radix-popper-content-wrapper]",
].join(", ");

function isTextEntry(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  // A switch or checkbox is a click, not somewhere to type.
  return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(
    element.type,
  );
}

/**
 * Whether the scan field may take the focus back now. It never takes it from
 * another field the worker is typing in, from an open dialog or menu, or
 * while text is selected (a worker copying a code would lose the selection).
 */
export function mayRefocusScanField(field: HTMLElement): boolean {
  if (!field.isConnected) return false;
  const active = document.activeElement;
  if (active === field) return false;
  if (active && active !== document.body && isTextEntry(active)) return false;
  if (document.querySelector(OVERLAY_SELECTOR)) return false;
  const selection = window.getSelection?.();
  if (selection && !selection.isCollapsed && selection.toString().trim()) return false;
  return true;
}

/**
 * Keeps the track-code field focused wherever the worker clicks or taps, so
 * the next scan always lands in it.
 *
 * Focus comes back after any tap or click, when the field loses focus to
 * nothing, when the browser window is re-entered, and when a dialog or menu
 * closes. Keyboard navigation is left alone: Tab still reaches the buttons.
 */
export function useScanFieldFocusLock(
  fieldRef: RefObject<HTMLInputElement | null>,
  enabled = true,
): () => void {
  const refocus = useCallback(() => {
    const field = fieldRef.current;
    if (!field || !mayRefocusScanField(field)) return;
    field.focus({ preventScroll: true });
  }, [fieldRef]);

  useEffect(() => {
    if (!enabled) return;
    // After the click's own handlers ran and any dialog it opened is mounted.
    let frame = 0;
    const later = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(refocus);
    };

    const field = fieldRef.current;
    const onFieldBlur = (event: FocusEvent) => {
      // Focus moved to another control (Tab, a click): that control keeps
      // it until the pointer handler decides. Lost to nothing: take it back.
      if (event.relatedTarget === null) later();
    };

    // Radix portals mount and unmount as direct children of <body>.
    const overlays = new MutationObserver(later);
    overlays.observe(document.body, { childList: true });

    document.addEventListener("pointerup", later);
    window.addEventListener("focus", later);
    field?.addEventListener("blur", onFieldBlur);
    later();

    return () => {
      window.cancelAnimationFrame(frame);
      overlays.disconnect();
      document.removeEventListener("pointerup", later);
      window.removeEventListener("focus", later);
      field?.removeEventListener("blur", onFieldBlur);
    };
  }, [enabled, fieldRef, refocus]);

  return refocus;
}
