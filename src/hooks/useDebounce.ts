import { useCallback, useEffect, useRef } from 'react';

/**
 * Debounce a callback, keeping one stable identity for the component's life.
 *
 * Two things changed from the previous version:
 *
 * - **No `any`.** Inferring the argument tuple from the callback types the
 *   returned function exactly, with no cast on the way out.
 * - **A pending timer is cleared on unmount.** There was no cleanup, so a
 *   debounced call scheduled just before the component went away still fired —
 *   in the one caller that means a preview request for an editor that is no
 *   longer open.
 *
 * The latest callback is read through a ref, so the returned function never
 * changes identity even when the caller passes an inline arrow (all of them
 * do), and it still runs the current closure rather than the mount-time one.
 */
export function useDebounce<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number,
): (...args: Args) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const delayRef = useRef(delay);

  useEffect(() => {
    callbackRef.current = callback;
    delayRef.current = delay;
  }, [callback, delay]);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    },
    [],
  );

  return useCallback((...args: Args) => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delayRef.current);
  }, []);
}
