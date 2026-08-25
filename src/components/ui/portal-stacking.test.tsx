/**
 * Guards the one rule that made region/district invisible in the manager's
 * "add client" sheet: Radix portals its content to <body>, so that content
 * stacks against the APP's overlays, not against the element it belongs to.
 *
 * The app puts sheets and modals from z-100 (ManagerPage create sheet) up to
 * z-999 (ProhibitedItemsModal, ExtraPassportsModal). Any portalled dropdown
 * below that band renders behind the backdrop — present in the DOM, invisible
 * on screen, which is exactly how it was reported.
 *
 * This asserts the floor, not an exact value, so raising the primitives later
 * does not break the test while lowering them does.
 */

import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { Select, SelectContent, SelectItem, SelectTrigger } from './select';

/** Highest overlay z-index in the app; the floor a portal has to clear. */
const HIGHEST_APP_OVERLAY = 999;

beforeAll(() => {
  // Radix's popper measures and scrolls; jsdom implements neither.
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  Element.prototype.scrollIntoView ??= () => {};
  // jsdom ships no PointerEvent, and Radix feature-detects these.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
});

/** The largest z-index any Tailwind class on the element encodes. */
function zIndexOf(element: Element): number {
  const found = Array.from(element.classList)
    .map((cls) => /^z-\[?(\d+)\]?$/.exec(cls)?.[1])
    .filter((v): v is string => v !== undefined)
    .map(Number);
  return found.length > 0 ? Math.max(...found) : 0;
}

describe('portalled dropdown stacking', () => {
  it('renders select content above every overlay in the app', () => {
    render(
      <Select open>
        <SelectTrigger aria-label="viloyat" />
        <SelectContent>
          <SelectItem value="toshkent_city">Toshkent shahri</SelectItem>
        </SelectContent>
      </Select>,
    );

    const option = screen.getByText('Toshkent shahri');
    const content = option.closest('[data-slot="select-content"]');
    expect(content).not.toBeNull();
    expect(zIndexOf(content as Element)).toBeGreaterThan(HIGHEST_APP_OVERLAY);
  });
});
