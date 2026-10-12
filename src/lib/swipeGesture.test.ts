import { describe, expect, it } from "vitest";

import {
  SWIPE_DISMISS_DISTANCE_PX,
  SWIPE_DISMISS_VELOCITY_PX_S,
  SWIPE_FLICK_MIN_DISTANCE_PX,
  shouldDismissVerticalSwipe,
} from "./swipeGesture";

describe("shouldDismissVerticalSwipe", () => {
  it("closes on a long slow pull, up or down", () => {
    expect(shouldDismissVerticalSwipe({ offsetY: 120, velocityY: 50 })).toBe(true);
    expect(shouldDismissVerticalSwipe({ offsetY: -120, velocityY: -50 })).toBe(true);
    expect(shouldDismissVerticalSwipe({ offsetY: 140, velocityY: 0 })).toBe(true);
  });

  it("keeps the photo open for a short slow pull", () => {
    expect(shouldDismissVerticalSwipe({ offsetY: 40, velocityY: 100 })).toBe(false);
    expect(shouldDismissVerticalSwipe({ offsetY: -SWIPE_DISMISS_DISTANCE_PX, velocityY: 0 })).toBe(
      false,
    );
  });

  it("closes on a short quick flick in either direction", () => {
    expect(shouldDismissVerticalSwipe({ offsetY: 40, velocityY: 900 })).toBe(true);
    expect(shouldDismissVerticalSwipe({ offsetY: -40, velocityY: -900 })).toBe(true);
  });

  it("ignores a fast jitter that barely moved the photo", () => {
    expect(
      shouldDismissVerticalSwipe({
        offsetY: SWIPE_FLICK_MIN_DISTANCE_PX - 4,
        velocityY: SWIPE_DISMISS_VELOCITY_PX_S * 2,
      }),
    ).toBe(false);
    expect(shouldDismissVerticalSwipe({ offsetY: 0, velocityY: 2000 })).toBe(false);
  });

  it("stays open when the photo is thrown back towards the middle", () => {
    expect(shouldDismissVerticalSwipe({ offsetY: 150, velocityY: -900 })).toBe(false);
    expect(shouldDismissVerticalSwipe({ offsetY: -150, velocityY: 900 })).toBe(false);
  });

  it("still closes a long pull that drifts back slowly", () => {
    expect(shouldDismissVerticalSwipe({ offsetY: 150, velocityY: -200 })).toBe(true);
  });

  it("never closes on a broken measurement", () => {
    expect(shouldDismissVerticalSwipe({ offsetY: Number.NaN, velocityY: 900 })).toBe(false);
    expect(
      shouldDismissVerticalSwipe({ offsetY: 200, velocityY: Number.POSITIVE_INFINITY }),
    ).toBe(false);
  });
});
