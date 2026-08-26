import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BackPriority,
  __resetBackStack,
  canGoBack,
  pushBackHandler,
  runBack,
  setRouterDepth,
  subscribeBackStack,
} from './backStack';

const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => {});

beforeEach(() => {
  __resetBackStack();
  historyBack.mockClear();
});

afterEach(() => {
  __resetBackStack();
});

describe('resolution order', () => {
  it('runs the highest priority first, regardless of registration order', () => {
    const order: string[] = [];
    pushBackHandler(() => {
      order.push('overlay');
      return true;
    }, BackPriority.OVERLAY);
    pushBackHandler(() => {
      order.push('view');
      return true;
    }, BackPriority.VIEW);

    runBack();

    // The view registered LAST but the overlay sits above it, so mount order
    // must not decide this — that is the whole reason priorities exist.
    expect(order).toEqual(['overlay']);
  });

  it('breaks ties within a priority by most-recently-registered', () => {
    const order: string[] = [];
    pushBackHandler(() => {
      order.push('first');
      return true;
    }, BackPriority.MODAL);
    pushBackHandler(() => {
      order.push('second');
      return true;
    }, BackPriority.MODAL);

    runBack();

    expect(order).toEqual(['second']);
  });

  it('falls through every handler that declines', () => {
    const order: string[] = [];
    pushBackHandler(() => {
      order.push('bottom');
      return true;
    }, BackPriority.VIEW);
    pushBackHandler(() => {
      order.push('middle');
      return false;
    }, BackPriority.MODAL);
    pushBackHandler(() => {
      order.push('top');
      return false;
    }, BackPriority.OVERLAY);

    expect(runBack()).toBe(true);
    expect(order).toEqual(['top', 'middle', 'bottom']);
  });
});

describe('router floor', () => {
  it('pops history only after every handler declines', () => {
    setRouterDepth(2);
    pushBackHandler(() => true, BackPriority.MODAL);

    runBack();
    expect(historyBack).not.toHaveBeenCalled();
  });

  it('pops history when nothing claimed the press', () => {
    setRouterDepth(1);

    expect(runBack()).toBe(true);
    expect(historyBack).toHaveBeenCalledTimes(1);
  });

  it('reports an unconsumed press at the root so the host can close the app', () => {
    setRouterDepth(0);

    expect(runBack()).toBe(false);
    expect(historyBack).not.toHaveBeenCalled();
  });
});

describe('unregistering', () => {
  it('removes the right entry when handlers are popped out of order', () => {
    const order: string[] = [];
    const removeA = pushBackHandler(() => {
      order.push('a');
      return true;
    }, BackPriority.MODAL);
    pushBackHandler(() => {
      order.push('b');
      return true;
    }, BackPriority.MODAL);

    // 'a' unregisters first even though 'b' is on top — a stale index or a
    // plain pop() would drop the wrong handler here.
    removeA();
    runBack();

    expect(order).toEqual(['b']);
  });

  it('is idempotent', () => {
    const remove = pushBackHandler(() => true);
    remove();
    remove();

    expect(canGoBack()).toBe(false);
  });
});

describe('canGoBack', () => {
  it('is false with no handlers and no router depth', () => {
    expect(canGoBack()).toBe(false);
  });

  it('is true from a handler alone', () => {
    pushBackHandler(() => true);
    expect(canGoBack()).toBe(true);
  });

  it('is true from router depth alone', () => {
    setRouterDepth(1);
    expect(canGoBack()).toBe(true);
  });

  it('clamps a negative depth to zero', () => {
    setRouterDepth(-3);
    expect(canGoBack()).toBe(false);
  });
});

describe('subscription', () => {
  it('notifies on register, unregister and depth change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBackStack(listener);

    const remove = pushBackHandler(() => true);
    expect(listener).toHaveBeenCalledTimes(1);

    remove();
    expect(listener).toHaveBeenCalledTimes(2);

    setRouterDepth(1);
    expect(listener).toHaveBeenCalledTimes(3);

    // Same value — the button would not change, so no re-render should be asked for.
    setRouterDepth(1);
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    pushBackHandler(() => true);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});

describe('haptics', () => {
  it('fires once when a handler consumes the press', () => {
    const impact = vi.spyOn(window.Telegram!.WebApp!.HapticFeedback, 'impactOccurred');
    pushBackHandler(() => true);

    runBack();

    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith('light');
    impact.mockRestore();
  });

  it('fires when the router pops', () => {
    const impact = vi.spyOn(window.Telegram!.WebApp!.HapticFeedback, 'impactOccurred');
    setRouterDepth(1);

    runBack();

    expect(impact).toHaveBeenCalledTimes(1);
    impact.mockRestore();
  });

  it('stays silent at the root, where the press closes the app', () => {
    const impact = vi.spyOn(window.Telegram!.WebApp!.HapticFeedback, 'impactOccurred');

    expect(runBack()).toBe(false);

    expect(impact).not.toHaveBeenCalled();
    impact.mockRestore();
  });
});
