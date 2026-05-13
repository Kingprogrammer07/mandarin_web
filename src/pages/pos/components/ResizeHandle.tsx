"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ResizeHandleProps {
  onResize: (delta: number) => void;
}

export function ResizeHandle({ onResize }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);
      startX.current = e.clientX;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setDragging(true);
      startX.current = e.touches[0].clientX;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [],
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

  return (
    <div
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      className={`
        hidden lg:flex w-1.5 shrink-0 cursor-col-resize z-10
        items-center justify-center self-stretch
        transition-colors
        ${dragging ? "bg-orange-500/60" : "bg-gray-200/50 hover:bg-gray-300/50 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"}
      `}
      title="Ustun kengligini o'zgartirish"
    >
      <div
        className={`w-px h-6 rounded-full ${dragging ? "bg-white" : "bg-gray-400 dark:bg-gray-600"}`}
      />
    </div>
  );
}
