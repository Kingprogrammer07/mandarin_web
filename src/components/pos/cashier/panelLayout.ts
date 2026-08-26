/**
 * The cashier's own panel sizes.
 *
 * Three draggable dividers size four panels, because the panels nest rather
 * than sit in a flat grid:
 *
 *   [ lookup | payment ]  [ receipts ]
 *   [     history      ]  [ receipts ]
 *
 * `receiptsWidth` splits the whole screen, `topHeight` splits the left area,
 * and `lookupWidth` splits the top row. Every panel therefore has a divider
 * that changes it, and no divider changes something the cashier did not grab.
 *
 * Sizes are per-browser, in `localStorage`. They are a workstation preference —
 * the till at the counter and the accountant's laptop want different shapes —
 * not something to sync to an account.
 */

export interface PanelLayout {
  /** Width of the receipt column, in px. */
  receiptsWidth: number;
  /** Height of the lookup + payment row, in px. */
  topHeight: number;
  /** Width of the client lookup inside that row, in px. */
  lookupWidth: number;
}

/**
 * Defaults chosen so nothing is cut off before the cashier touches anything.
 *
 * `topHeight` in particular is sized to show the client table with a row in it
 * — the first attempt fitted the screen by squeezing this until not one record
 * was visible, which is not a layout, it is a hidden panel.
 */
export const DEFAULT_LAYOUT: PanelLayout = {
  receiptsWidth: 372,
  topHeight: 316,
  lookupWidth: 468,
};

/** Floors and ceilings, so a panel can be shrunk but never lost. */
export const LAYOUT_LIMITS: Record<keyof PanelLayout, { min: number; max: number }> = {
  receiptsWidth: { min: 288, max: 620 },
  topHeight: { min: 200, max: 760 },
  lookupWidth: { min: 300, max: 860 },
};

const STORAGE_KEY = 'kassa_panel_layout_v1';

/** Width of a `SplitHandle` (`w-2`), which the sized panels have to leave room for. */
export const HANDLE_WIDTH = 8;

/**
 * The narrowest the payment column may become.
 *
 * It is the ONLY flexible item in both rows, so it absorbs every deficit — and
 * it has no divider of its own, so once it is crushed there is nothing to drag
 * back. At 360px its controls still fit; below that the amount field, the card
 * picker and the confirm button clip and the cashier cannot take a payment at
 * all.
 */
export const PAYMENT_MIN_WIDTH = 360;

/**
 * The shortest the history table may become.
 *
 * The top row is `shrink-0` at its set height and the history is the flexible
 * item below it, so the history absorbs the whole vertical deficit and its own
 * floor is zero. `topHeight`'s 760px ceiling is taller than the panel row ever
 * gets on a 1366×768 till, so the ceiling alone could not stop the table being
 * dragged out of existence.
 *
 * 220px is a header, three rows and the pager — enough to see that the table is
 * there and what it holds.
 */
export const HISTORY_MIN_HEIGHT = 220;

export function clampLayoutValue(key: keyof PanelLayout, value: number): number {
  const { min, max } = LAYOUT_LIMITS[key];
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** What the container can actually offer, measured rather than assumed. */
export interface LayoutSpace {
  /** Inner width of the outer row: left area + handle + receipts. */
  outerWidth: number;
  /** Inner width of the top row: lookup + handle + payment. */
  topRowWidth: number;
  /** Inner height of the left column: top row + handle + history. */
  leftHeight: number;
}

/**
 * Clamp against the space that exists, not only against fixed ceilings.
 *
 * The per-key limits alone cannot protect the payment column: `receiptsWidth`
 * at its 620 maximum plus `lookupWidth` at its 860 maximum is 1496px, and the
 * page is capped at a 1568px inner width — so even on a 4K monitor the payment
 * column is left 72px, and on a 1366px till it is left nothing.
 *
 * The dangerous version of this arrives with no drag at all: sizes persist per
 * browser, so a layout tuned on a wide monitor reopens on the narrow till the
 * next morning with the payment column at zero.
 *
 * Widths of 0 mean "not measured yet" and are ignored, so the first render
 * before the observer reports never squashes a stored layout.
 */
export function clampLayoutToSpace(
  layout: PanelLayout,
  space: LayoutSpace,
): PanelLayout {
  let { receiptsWidth, lookupWidth } = layout;

  if (space.outerWidth > 0) {
    // The left area must still hold a payment column plus whatever the lookup
    // takes; the receipts column gives way first because it is the outer split.
    const maxReceipts =
      space.outerWidth - HANDLE_WIDTH - HANDLE_WIDTH - LAYOUT_LIMITS.lookupWidth.min - PAYMENT_MIN_WIDTH;
    if (maxReceipts >= LAYOUT_LIMITS.receiptsWidth.min) {
      receiptsWidth = Math.min(receiptsWidth, maxReceipts);
    } else {
      receiptsWidth = LAYOUT_LIMITS.receiptsWidth.min;
    }
  }

  if (space.topRowWidth > 0) {
    const maxLookup = space.topRowWidth - HANDLE_WIDTH - PAYMENT_MIN_WIDTH;
    if (maxLookup >= LAYOUT_LIMITS.lookupWidth.min) {
      lookupWidth = Math.min(lookupWidth, maxLookup);
    } else {
      lookupWidth = LAYOUT_LIMITS.lookupWidth.min;
    }
  }

  let { topHeight } = layout;
  if (space.leftHeight > 0) {
    // The history is the flexible item below the top row, so it takes the whole
    // vertical deficit and has no floor of its own. `topHeight`'s own ceiling is
    // taller than this column ever gets on a 1366×768 till, so it cannot be the
    // thing that protects the table.
    const maxTop = space.leftHeight - HANDLE_WIDTH - HISTORY_MIN_HEIGHT;
    if (maxTop >= LAYOUT_LIMITS.topHeight.min) {
      topHeight = Math.min(topHeight, maxTop);
    } else {
      topHeight = LAYOUT_LIMITS.topHeight.min;
    }
  }

  return {
    receiptsWidth: clampLayoutValue('receiptsWidth', receiptsWidth),
    topHeight: clampLayoutValue('topHeight', topHeight),
    lookupWidth: clampLayoutValue('lookupWidth', lookupWidth),
  };
}

export function isDefaultLayout(layout: PanelLayout): boolean {
  return (
    layout.receiptsWidth === DEFAULT_LAYOUT.receiptsWidth &&
    layout.topHeight === DEFAULT_LAYOUT.topHeight &&
    layout.lookupWidth === DEFAULT_LAYOUT.lookupWidth
  );
}

/**
 * Read the stored layout, falling back to the default for anything missing or
 * out of range.
 *
 * Clamped on the way in as well as on the way out: a value saved under an older
 * set of limits, or hand-edited in devtools, must not be able to render a panel
 * at zero width with no way to drag it back.
 */
export function loadLayout(): PanelLayout {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_LAYOUT;

    const source = parsed as Partial<Record<keyof PanelLayout, unknown>>;
    const read = (key: keyof PanelLayout): number => {
      const value = source[key];
      return typeof value === 'number' && Number.isFinite(value)
        ? clampLayoutValue(key, value)
        : DEFAULT_LAYOUT[key];
    };

    return {
      receiptsWidth: read('receiptsWidth'),
      topHeight: read('topHeight'),
      lookupWidth: read('lookupWidth'),
    };
  } catch {
    // Private mode, cleared site data, or a corrupt value — the default is
    // always a usable screen.
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(layout: PanelLayout): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage can throw outright (Safari private mode). Losing the preference
    // is not worth breaking the drag that produced it.
  }
}


/**
 * Height of the history panel when it is collapsed to its header bar.
 *
 * Used to work out how much the top row grows by: collapsing the table is only
 * worth doing if the space it vacates goes to the client lookup and the payment
 * form, rather than just making the page shorter.
 */
export const HISTORY_BAR_HEIGHT = 52;

const HISTORY_OPEN_KEY = 'kassa_history_open_v1';

/** Collapsed by default: the counter's work is the top row, not the ledger. */
export function loadHistoryOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(HISTORY_OPEN_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveHistoryOpen(isOpen: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_OPEN_KEY, String(isOpen));
  } catch {
    // Losing the preference is not worth breaking the click that set it.
  }
}
