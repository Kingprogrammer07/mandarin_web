import { useCallback, useRef } from 'react';

/** Fires Telegram haptic feedback if the WebApp API is available. */
function triggerHapticFeedback(style: 'light' | 'medium' | 'heavy' = 'medium'): void {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
  } catch {
    // Not in a Telegram context or haptic API unavailable — safe to ignore.
  }
}

interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  /**
   * Call this at the top of an onClick handler to know whether the event was
   * produced by a long-press gesture (and should therefore be ignored).
   *
   * Returns true and resets the flag when long-press was the trigger, so the
   * caller can return early instead of executing the normal click action.
   *
   * This is necessary because removing e.preventDefault() from pointerdown
   * (required to keep clicks working on mobile/Telegram WebView) means the
   * browser still dispatches a synthetic click after a long-press gesture.
   */
  consumeLongPressClick: () => boolean;
}

/**
 * Returns pointer-event handlers that fire `callback` after the user holds
 * a pointer down for `durationMs` milliseconds.
 *
 * Uses pointer events (not touch events) for cross-device compatibility inside
 * the Telegram WebView.  Triggers `HapticFeedback.impactOccurred` when the
 * long-press threshold is reached.
 *
 * ### Why no e.preventDefault() on pointerdown?
 * Calling e.preventDefault() on pointerdown blocks the subsequent click event
 * on mobile browsers and the Telegram WebView, making all taps non-functional.
 * Desktop browsers historically tolerated it, which masked the bug.
 * To prevent the synthetic click that follows a long-press from triggering the
 * element's normal click handler, use `consumeLongPressClick()` instead.
 */
export function useLongPress(
  callback: () => void,
  durationMs = 500,
): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const start = useCallback(
    (e: React.PointerEvent) => {
      // Only primary button (left click / touch)
      if (e.button !== 0 && e.pointerType !== 'touch') return;

      // NOTE: e.preventDefault() is intentionally NOT called here.
      // Calling it on pointerdown blocks the click event on mobile / Telegram WebView.
      // Use consumeLongPressClick() in the onClick handler instead.

      longPressFiredRef.current = false;

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        longPressFiredRef.current = true;
        triggerHapticFeedback('medium');
        callback();
      }, durationMs);
    },
    [callback, durationMs],
  );

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const consumeLongPressClick = useCallback(() => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return true;
    }
    return false;
  }, []);

  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    consumeLongPressClick,
  };
}
