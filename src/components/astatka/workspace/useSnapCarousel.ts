import { useCallback, useRef, useState, type KeyboardEvent, type RefObject } from "react";

interface Options {
  count: number;
  /** The slide shown first. It is placed without a glide: a jump to the
   *  tapped photo must not read as a swipe through the ones before it. */
  initialIndex?: number;
  /** Jump instead of glide between slides. */
  reduceMotion?: boolean;
}

export interface SnapCarousel {
  /** The `ref` of the scrolling track. */
  attachTrack: (node: HTMLDivElement | null) => void;
  /** The track itself, for effects and handlers. */
  trackRef: RefObject<HTMLDivElement | null>;
  /** The slide in view, always within `0 … count - 1`. */
  active: number;
  goTo: (index: number) => void;
  /** ArrowLeft / ArrowRight move one slide; put it on the carousel's wrapper. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  /** Spread onto the scrolling track. */
  trackProps: {
    onScroll: () => void;
    onPointerDown: () => void;
    onWheel: () => void;
    onScrollEnd: () => void;
  };
}

function clampIndex(index: number, count: number): number {
  return Math.max(0, Math.min(count - 1, index));
}

/**
 * A native CSS scroll-snap carousel (`snap-x snap-mandatory`, one slide per
 * view): a phone swipe is the browser's own scroll with its momentum, and the
 * visible slide is read back from the scroll position. Buttons and arrow keys
 * scroll the same track, so every way of moving agrees on one index.
 */
export function useSnapCarousel({
  count,
  initialIndex = 0,
  reduceMotion = false,
}: Options): SnapCarousel {
  const trackRef = useRef<HTMLDivElement>(null);
  const [openingIndex] = useState(() => clampIndex(initialIndex, count));
  const [current, setCurrent] = useState(openingIndex);
  // Where a button or a key sent the track. Positions passed on the way are
  // ignored, otherwise a glide over three photos flickers the counter through
  // each of them — and a second key press mid-glide would start from a stale
  // slide instead of the one the first press asked for.
  const targetRef = useRef<number | null>(null);

  // Placed the moment the track exists — inside a Radix portal that is a
  // render later than this hook's first commit, too late for a layout effect.
  const attachTrack = useCallback(
    (node: HTMLDivElement | null) => {
      trackRef.current = node;
      if (node && node.clientWidth > 0) node.scrollLeft = node.clientWidth * openingIndex;
    },
    [openingIndex],
  );

  const active = clampIndex(current, count);

  const goTo = useCallback(
    (index: number) => {
      const next = clampIndex(index, count);
      setCurrent(next);
      const track = trackRef.current;
      if (!track || track.clientWidth === 0) return;
      const left = track.clientWidth * next;
      if (Math.abs(track.scrollLeft - left) < 1) {
        targetRef.current = null;
        return;
      }
      targetRef.current = next;
      if (typeof track.scrollTo === "function") {
        track.scrollTo({ left, behavior: reduceMotion ? "auto" : "smooth" });
      } else {
        track.scrollLeft = left;
      }
    },
    [count, reduceMotion],
  );

  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const inView = clampIndex(Math.round(track.scrollLeft / track.clientWidth), count);
    if (targetRef.current !== null) {
      if (inView !== targetRef.current) return;
      targetRef.current = null;
    }
    setCurrent(inView);
  }, [count]);

  // A finger or a wheel on the track takes over from a button's glide.
  const releaseTarget = useCallback(() => {
    targetRef.current = null;
  }, []);

  // Wherever the scroll came to rest is the truth, even if a glide was cut
  // short on the way (a resize, a re-snap). Browsers without `scrollend`
  // rely on reaching the target or on the next touch.
  const onScrollEnd = useCallback(() => {
    targetRef.current = null;
    onScroll();
  }, [onScroll]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      // The track would also scroll itself by a few pixels on the same key.
      event.preventDefault();
      // Mid-glide, step on from where the glide is going, not from the slide
      // the scroll has not left yet.
      const from = targetRef.current ?? active;
      goTo(from + (event.key === "ArrowRight" ? 1 : -1));
    },
    [active, goTo],
  );

  return {
    attachTrack,
    trackRef,
    active,
    goTo,
    onKeyDown,
    trackProps: { onScroll, onPointerDown: releaseTarget, onWheel: releaseTarget, onScrollEnd },
  };
}
