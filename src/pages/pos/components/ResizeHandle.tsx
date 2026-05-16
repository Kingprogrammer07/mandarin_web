"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  /** Whether to show a collapse toggle button on the handle. */
  showToggle?: boolean;
  /** Whether the panel is currently collapsed. */
  isCollapsed?: boolean;
  /** Called when the toggle button is clicked. */
  onToggle?: () => void;
}

export function ResizeHandle({
  onResize,
  showToggle = false,
  isCollapsed = false,
  onToggle,
}: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isCollapsed) return;
      e.preventDefault();
      setDragging(true);
      startX.current = e.clientX;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [isCollapsed],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isCollapsed) return;
      setDragging(true);
      startX.current = e.touches[0].clientX;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [isCollapsed],
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (clientX: number) => {
      const delta = clientX - startX.current;
      startX.current = clientX;
      if (delta !== 0) onResize(delta);
    };

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      onMove(e.touches[0].clientX);
    };

    const onUp = () => {
      setDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging, onResize]);

  // ── Collapsed state: floating expand button at screen edge ──────────────
  if (isCollapsed) {
    return (
      <div className="hidden lg:flex w-1 shrink-0 self-stretch bg-transparent relative z-[999]">
        <button
          onClick={onToggle}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-[9999] flex items-center justify-center w-7 h-12 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 rounded-lg shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:border-emerald-400 dark:hover:border-emerald-400 transition-colors"
          title="Chap panelni ochish"
        >
          <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </button>
      </div>
    );
  }

  // ── Expanded state: resize handle + bookmark toggle ─────────────────────
  return (
    <div
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      className={`
        hidden lg:flex w-1.5 shrink-0 cursor-col-resize z-10
        items-center justify-center self-stretch
        transition-colors relative
        ${dragging ? "bg-orange-500/60" : "bg-gray-200/50 hover:bg-gray-300/50 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"}
      `}
      title="Ustun kengligini o'zgartirish"
    >
      <div
        className={`w-px h-6 rounded-full ${dragging ? "bg-white" : "bg-gray-400 dark:bg-gray-600"}`}
      />

      {/* Bookmark toggle — leans into left panel, never overflows center */}
      {showToggle && onToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[70%] z-20 group"
          title="Chap panelni yopish"
        >
          <div className="w-5 h-14 bg-white dark:bg-[#1a1a1a] border-r border-t border-b border-emerald-400 rounded-r-md flex items-center justify-center group-hover:border-emerald-500 transition-colors shadow-sm">
            <ChevronLeft className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mr-0.5" />
          </div>
        </button>
      )}
    </div>
  );
}
