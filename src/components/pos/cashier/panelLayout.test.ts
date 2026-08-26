import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clampLayoutToSpace,
  clampLayoutValue,
  DEFAULT_LAYOUT,
  HANDLE_WIDTH,
  HISTORY_MIN_HEIGHT,
  isDefaultLayout,
  LAYOUT_LIMITS,
  loadLayout,
  PAYMENT_MIN_WIDTH,
  saveLayout,
} from './panelLayout';

const KEY = 'kassa_panel_layout_v1';

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('clampLayoutValue', () => {
  it('keeps a value that is already in range', () => {
    expect(clampLayoutValue('receiptsWidth', 400)).toBe(400);
  });

  it('never returns below the floor — a panel must stay draggable', () => {
    expect(clampLayoutValue('receiptsWidth', -500)).toBe(
      LAYOUT_LIMITS.receiptsWidth.min,
    );
    expect(clampLayoutValue('topHeight', 0)).toBe(LAYOUT_LIMITS.topHeight.min);
  });

  it('never returns above the ceiling', () => {
    expect(clampLayoutValue('lookupWidth', 99999)).toBe(
      LAYOUT_LIMITS.lookupWidth.max,
    );
  });

  it('rounds, so a fractional drag delta cannot accumulate sub-pixels', () => {
    expect(clampLayoutValue('topHeight', 316.4)).toBe(316);
    expect(clampLayoutValue('topHeight', 316.6)).toBe(317);
  });
});

describe('isDefaultLayout', () => {
  it('recognises the default', () => {
    expect(isDefaultLayout(DEFAULT_LAYOUT)).toBe(true);
  });

  it('reports any single changed dimension as non-default', () => {
    // The reset button hangs off this: missing a changed dimension would hide
    // the only way back.
    expect(isDefaultLayout({ ...DEFAULT_LAYOUT, receiptsWidth: 400 })).toBe(false);
    expect(isDefaultLayout({ ...DEFAULT_LAYOUT, topHeight: 400 })).toBe(false);
    expect(isDefaultLayout({ ...DEFAULT_LAYOUT, lookupWidth: 400 })).toBe(false);
  });
});

describe('loadLayout', () => {
  it('returns the default when nothing is stored', () => {
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
  });

  it('round-trips a saved layout', () => {
    const custom = { receiptsWidth: 420, topHeight: 380, lookupWidth: 520 };
    saveLayout(custom);
    expect(loadLayout()).toEqual(custom);
  });

  it('clamps a stored value that is out of range', () => {
    // Hand-edited in devtools, or saved under older limits. A zero-width panel
    // has no handle to drag back, so this must not survive a reload.
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ receiptsWidth: 0, topHeight: 5, lookupWidth: 99999 }),
    );
    const loaded = loadLayout();
    expect(loaded.receiptsWidth).toBe(LAYOUT_LIMITS.receiptsWidth.min);
    expect(loaded.topHeight).toBe(LAYOUT_LIMITS.topHeight.min);
    expect(loaded.lookupWidth).toBe(LAYOUT_LIMITS.lookupWidth.max);
  });

  it('fills in a missing dimension from the default', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ receiptsWidth: 420 }));
    expect(loadLayout()).toEqual({ ...DEFAULT_LAYOUT, receiptsWidth: 420 });
  });

  it('ignores non-numeric values', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ receiptsWidth: 'wide', topHeight: null, lookupWidth: NaN }),
    );
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
  });

  it('survives a corrupt entry', () => {
    window.localStorage.setItem(KEY, '{not json');
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
  });

  it('survives a stored primitive rather than an object', () => {
    window.localStorage.setItem(KEY, '"372"');
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
  });

  it('survives storage that throws outright', () => {
    // Safari private mode raises on access rather than returning null.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
  });
});

describe('clampLayoutToSpace', () => {
  /** Enough room for anything — the per-key limits should be the only bound. */
  const ROOMY = { outerWidth: 4000, topRowWidth: 3000, leftHeight: 3000 };

  it('leaves a layout alone when there is room for it', () => {
    expect(clampLayoutToSpace(DEFAULT_LAYOUT, ROOMY)).toEqual(DEFAULT_LAYOUT);
  });

  it('ignores unmeasured space rather than squashing a stored layout', () => {
    // Both widths are 0 on the very first render, before the observer reports.
    expect(
      clampLayoutToSpace(DEFAULT_LAYOUT, { outerWidth: 0, topRowWidth: 0, leftHeight: 0 }),
    ).toEqual(DEFAULT_LAYOUT);
  });

  it('always leaves the payment column its minimum on the top row', () => {
    // The payment section is the only flexible item and has no divider of its
    // own: crushed to zero, there is nothing left to drag back.
    const topRowWidth = 900;
    const clamped = clampLayoutToSpace(
      { ...DEFAULT_LAYOUT, lookupWidth: LAYOUT_LIMITS.lookupWidth.max },
      { ...ROOMY, topRowWidth },
    );
    const payment = topRowWidth - HANDLE_WIDTH - clamped.lookupWidth;
    expect(payment).toBeGreaterThanOrEqual(PAYMENT_MIN_WIDTH);
  });

  it('always leaves the payment column its minimum on the outer row', () => {
    const outerWidth = 1100;
    const clamped = clampLayoutToSpace(
      { ...DEFAULT_LAYOUT, receiptsWidth: LAYOUT_LIMITS.receiptsWidth.max },
      { ...ROOMY, outerWidth },
    );
    const leftArea = outerWidth - HANDLE_WIDTH - clamped.receiptsWidth;
    const payment = leftArea - HANDLE_WIDTH - LAYOUT_LIMITS.lookupWidth.min;
    expect(payment).toBeGreaterThanOrEqual(PAYMENT_MIN_WIDTH);
  });

  it('rescues the exact reported case: wide-monitor sizes reopened on a 1366px till', () => {
    // Tuned at 1920 (inner 1568), reopened at 1366 (inner ~1334). Both stored
    // values are within their per-key limits, so nothing else would touch them
    // and the payment column rendered at zero.
    const stored = { receiptsWidth: 620, topHeight: 316, lookupWidth: 700 };
    const clamped = clampLayoutToSpace(stored, {
      outerWidth: 1334,
      topRowWidth: 1334 - HANDLE_WIDTH - 620,
      leftHeight: 3000,
    });
    const leftArea = 1334 - HANDLE_WIDTH - clamped.receiptsWidth;
    const payment = leftArea - HANDLE_WIDTH - clamped.lookupWidth;
    expect(payment).toBeGreaterThanOrEqual(PAYMENT_MIN_WIDTH);
  });

  it('never returns a panel below its own floor, however little space there is', () => {
    const clamped = clampLayoutToSpace(DEFAULT_LAYOUT, {
      outerWidth: 400,
      topRowWidth: 300,
      leftHeight: 3000,
    });
    expect(clamped.receiptsWidth).toBeGreaterThanOrEqual(
      LAYOUT_LIMITS.receiptsWidth.min,
    );
    expect(clamped.lookupWidth).toBeGreaterThanOrEqual(
      LAYOUT_LIMITS.lookupWidth.min,
    );
  });

  it('leaves the height alone when the column is tall enough', () => {
    const clamped = clampLayoutToSpace(
      { ...DEFAULT_LAYOUT, topHeight: 500 },
      { outerWidth: 900, topRowWidth: 600, leftHeight: 3000 },
    );
    expect(clamped.topHeight).toBe(500);
  });

  it('always leaves the history table its minimum height', () => {
    // The history is the flexible item below the top row, so it takes the whole
    // vertical deficit; `topHeight`'s own 760 ceiling is taller than the column
    // ever gets on a 1366x768 till and cannot protect it.
    const leftHeight = 560;
    const clamped = clampLayoutToSpace(
      { ...DEFAULT_LAYOUT, topHeight: LAYOUT_LIMITS.topHeight.max },
      { ...ROOMY, leftHeight },
    );
    const history = leftHeight - HANDLE_WIDTH - clamped.topHeight;
    expect(history).toBeGreaterThanOrEqual(HISTORY_MIN_HEIGHT);
  });

  it('never drops the top row below its own floor, however short the column', () => {
    const clamped = clampLayoutToSpace(DEFAULT_LAYOUT, {
      ...ROOMY,
      leftHeight: 120,
    });
    expect(clamped.topHeight).toBe(LAYOUT_LIMITS.topHeight.min);
  });
});

describe('saveLayout', () => {
  it('does not throw when storage refuses the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    // Losing the preference must never break the drag that produced it.
    expect(() => saveLayout(DEFAULT_LAYOUT)).not.toThrow();
  });
});
