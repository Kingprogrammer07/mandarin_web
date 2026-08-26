/**
 * The system back button must close a running tour, not what is underneath it.
 *
 * A tour runs on top of a surface that has its own back handler —
 * MakePaymentModal, the card-binding page. Before this, the press went straight
 * past the tour and dismissed that surface instead, leaving driver.js
 * highlighting an element it had just unmounted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BackPriority,
  __resetBackStack,
  canGoBack,
  pushBackHandler,
  runBack,
} from '@/lib/backStack';
import { resetAllTours, runTourOnce } from './tour';

const TOUR_ID = 'test-tour';

function mountAnchor(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-tour', 'anchor');
  document.body.appendChild(el);
  return el;
}

function startTour() {
  runTourOnce({
    id: TOUR_ID,
    force: true,
    steps: [
      {
        element: '[data-tour="anchor"]',
        popover: { title: 'Salom', description: 'Qadam' },
      },
    ],
    nextBtnText: 'Keyingi',
    prevBtnText: 'Oldingi',
    doneBtnText: 'Tugadi',
  });
}

beforeEach(() => {
  __resetBackStack();
  resetAllTours();
  document.body.replaceChildren();
});

afterEach(() => {
  __resetBackStack();
  document.body.replaceChildren();
});

describe('a running tour and the back button', () => {
  it('claims the press and leaves the surface underneath alone', () => {
    const closeSurface = vi.fn(() => true);
    // The modal the tour is running on top of registers first, as it would.
    pushBackHandler(closeSurface, BackPriority.MODAL);

    mountAnchor();
    startTour();

    expect(runBack()).toBe(true);
    expect(closeSurface).not.toHaveBeenCalled();
  });

  it('releases the handler once it is over, so the next press reaches the surface', () => {
    const closeSurface = vi.fn(() => true);
    pushBackHandler(closeSurface, BackPriority.MODAL);

    mountAnchor();
    startTour();

    runBack(); // closes the tour
    runBack(); // now the modal's turn

    expect(closeSurface).toHaveBeenCalledTimes(1);
  });

  it('registers nothing when the tour never starts', () => {
    // No anchor in the DOM: runTourOnce bails at its first-element guard. A
    // handler left behind here would swallow the press forever — which is
    // exactly the shape of the dead `profile` tour, whose three targets are
    // selectors with no matching markup.
    startTour();

    expect(canGoBack()).toBe(false);
    expect(runBack()).toBe(false);
  });
});
