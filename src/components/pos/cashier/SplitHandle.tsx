/**
 * A draggable divider between two panels.
 *
 * Reports a delta rather than a size, so the parent owns the clamping and this
 * knows nothing about what it is dividing.
 *
 * Keyboard-operable, not mouse-only: it is a `separator` with arrow keys and
 * Home to reset, because a divider that can only be dragged is a control a
 * keyboard user cannot reach at all. `Home` restores the default rather than
 * jumping to a bound, which is the thing someone lost in a layout wants.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const STEP = 16;
const COARSE_STEP = 64;

export function SplitHandle({
  orientation,
  onDelta,
  onReset,
  label,
}: {
  /**
   * Which way the divider runs.
   *
   * `vertical` is a vertical bar between side-by-side panels (drag left/right);
   * `horizontal` is a bar between stacked panels (drag up/down). This matches
   * `aria-orientation` on the separator role.
   */
  orientation: 'vertical' | 'horizontal';
  onDelta: (delta: number) => void;
  onReset: () => void;
  label: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const lastRef = useRef(0);
  const isVertical = orientation === 'vertical';

  const begin = useCallback((position: number) => {
    lastRef.current = position;
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    // Set on <body> for the duration of the drag: without it the cursor flickers
    // back to the default whenever the pointer outruns the handle, and the drag
    // selects text across the whole page.
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = isVertical ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const move = (position: number) => {
      const delta = position - lastRef.current;
      lastRef.current = position;
      if (delta !== 0) onDelta(delta);
    };

    const onPointerMove = (event: PointerEvent) =>
      move(isVertical ? event.clientX : event.clientY);
    const onPointerUp = () => setIsDragging(false);

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isDragging, isVertical, onDelta]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const back = isVertical ? 'ArrowLeft' : 'ArrowUp';
    const forward = isVertical ? 'ArrowRight' : 'ArrowDown';
    const step = event.shiftKey ? COARSE_STEP : STEP;

    if (event.key === back) {
      event.preventDefault();
      onDelta(-step);
    } else if (event.key === forward) {
      event.preventDefault();
      onDelta(step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      onReset();
    }
  };

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
      tabIndex={0}
      title={`${label} — sudrang, yoki strelka tugmalari bilan o‘zgartiring`}
      onPointerDown={(event) => {
        // Only the primary button, and capture so the drag survives the pointer
        // leaving this 8px strip.
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        begin(isVertical ? event.clientX : event.clientY);
      }}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className={`group relative hidden shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none xl:flex ${
        isVertical ? 'w-2 cursor-col-resize self-stretch' : 'h-2 cursor-row-resize w-full'
      } ${isDragging ? 'bg-mc-brand/40' : 'bg-transparent hover:bg-mc-brand/15'}`}
    >
      {/* The grip is a hairline until hovered or focused — a permanent bar
          between every panel would read as a border and clutter four of them. */}
      <span
        aria-hidden="true"
        className={`rounded-full transition-colors ${
          isVertical ? 'h-8 w-[3px]' : 'h-[3px] w-8'
        } ${
          isDragging
            ? 'bg-mc-brand'
            : 'bg-mc-border group-hover:bg-mc-brand group-focus-visible:bg-mc-brand'
        }`}
      />
    </div>
  );
}
