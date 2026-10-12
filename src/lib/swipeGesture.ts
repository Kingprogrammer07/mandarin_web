/**
 * When a vertical drag on a full-screen photo should close the viewer, the
 * way the iOS Photos app decides it: a long pull, or a short quick flick.
 * Up and down both count; only the size and the speed of the drag matter.
 */

/** A pull this far (in CSS pixels) closes on release. */
export const SWIPE_DISMISS_DISTANCE_PX = 90;
/** A release this fast (px/s) is a flick… */
export const SWIPE_DISMISS_VELOCITY_PX_S = 600;
/** …but only once the photo has moved this far, so a shaky tap is no flick. */
export const SWIPE_FLICK_MIN_DISTANCE_PX = 24;

export interface VerticalSwipe {
  /** How far the pointer moved from where it was pressed; down is positive. */
  offsetY: number;
  /** Pointer speed at release in px/s; down is positive. */
  velocityY: number;
}

export function shouldDismissVerticalSwipe({ offsetY, velocityY }: VerticalSwipe): boolean {
  if (!Number.isFinite(offsetY) || !Number.isFinite(velocityY)) return false;
  const distance = Math.abs(offsetY);
  const fast = Math.abs(velocityY) > SWIPE_DISMISS_VELOCITY_PX_S;
  // A finger that pulled the photo away and is throwing it back towards the
  // middle has changed its mind: the release direction wins over the distance.
  const throwingBack = fast && distance > 0 && Math.sign(velocityY) !== Math.sign(offsetY);
  if (throwingBack) return false;
  if (distance > SWIPE_DISMISS_DISTANCE_PX) return true;
  return fast && distance > SWIPE_FLICK_MIN_DISTANCE_PX;
}
