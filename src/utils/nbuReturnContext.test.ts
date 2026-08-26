/**
 * Which door the NBU gateway opens through.
 *
 * Inside the Mini App it must open ON TOP of the app (`WebApp.openLink`). It
 * used to replace the app with `location.assign`, and once the webview had
 * navigated to nbu.uz our code was gone — no back control, no way to abandon a
 * payment except killing the app and reopening it.
 *
 * Outside the Mini App (an ordinary browser, the admin console) the plain
 * redirect is still right: Back works there.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearPendingExternalOrders,
  getPendingExternalOrders,
  openNbuUrl,
  prunePendingExternalOrders,
  removePendingExternalOrder,
} from './nbuReturnContext';

const PAYMENT_URL = 'https://nbu.example/pay/abc';

const INPUT = {
  orderId: 'ord-1',
  kind: 'payment' as const,
  paymentUrl: PAYMENT_URL,
};

let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  assign = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, assign, origin: 'https://app.example' },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  localStorage.clear();
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'Telegram');
});

function inMiniApp(openLink: ReturnType<typeof vi.fn>) {
  (window as unknown as Record<string, unknown>).Telegram = {
    WebApp: {
      initData: 'query_id=1&hash=abc',
      openLink,
      isVersionAtLeast: () => true,
    },
  };
}

describe('inside the Mini App', () => {
  it('opens the gateway on top instead of replacing the app', () => {
    const openLink = vi.fn();
    inMiniApp(openLink);

    expect(openNbuUrl(INPUT)).toBe('external');

    expect(openLink).toHaveBeenCalledWith(PAYMENT_URL, { try_instant_view: false });
    expect(assign).not.toHaveBeenCalled();
  });

  it('records the order so the watcher can pick it up after a resume', () => {
    inMiniApp(vi.fn());

    openNbuUrl(INPUT);

    expect(getPendingExternalOrders().map((e) => e.orderId)).toEqual(['ord-1']);
  });

  it('forgets the order once it is cleared', () => {
    inMiniApp(vi.fn());
    openNbuUrl(INPUT);

    clearPendingExternalOrders();

    expect(getPendingExternalOrders()).toEqual([]);
  });
});

describe('outside the Mini App', () => {
  it('falls back to a same-tab redirect', () => {
    // telegram-web-app.js is loaded on every page, so the object exists even in
    // a plain browser — only a non-empty initData proves we are really inside.
    (window as unknown as Record<string, unknown>).Telegram = {
      WebApp: { initData: '', openLink: vi.fn() },
    };

    expect(openNbuUrl(INPUT)).toBe('redirect');

    expect(assign).toHaveBeenCalledWith(PAYMENT_URL);
  });

  it('leaves no pending order behind, so no watcher sheet appears', () => {
    openNbuUrl(INPUT);

    expect(assign).toHaveBeenCalledWith(PAYMENT_URL);
    expect(getPendingExternalOrders()).toEqual([]);
  });
});

describe('a pending order with no surviving context', () => {
  it('is discarded rather than watched forever', () => {
    inMiniApp(vi.fn());
    openNbuUrl(INPUT);

    // The 24h context expired or was cleared; only the hint remains.
    localStorage.removeItem('nbu_return_context:ord-1');
    localStorage.removeItem('nbu_return_context:last');

    expect(getPendingExternalOrders()).toEqual([]);
  });
});

describe('two payments in flight', () => {
  it('keeps both, so the first is not orphaned by the second', () => {
    inMiniApp(vi.fn());
    for (const orderId of ['ord-1', 'ord-2']) {
      localStorage.setItem(
        `nbu_return_context:${orderId}`,
        JSON.stringify({ orderId, kind: 'payment', path: '/user/home', createdAt: Date.now() }),
      );
    }

    openNbuUrl(INPUT);
    openNbuUrl({ ...INPUT, orderId: 'ord-2' });

    // A single slot meant the first order was never polled again. If it had
    // succeeded while the second expired, the user was told the payment failed
    // for money that had already left their card.
    expect(getPendingExternalOrders().map((e) => e.orderId)).toEqual(['ord-1', 'ord-2']);
  });

  it('settles them independently', () => {
    inMiniApp(vi.fn());
    for (const orderId of ['ord-1', 'ord-2']) {
      localStorage.setItem(
        `nbu_return_context:${orderId}`,
        JSON.stringify({ orderId, kind: 'payment', path: '/user/home', createdAt: Date.now() }),
      );
    }
    openNbuUrl(INPUT);
    openNbuUrl({ ...INPUT, orderId: 'ord-2' });

    removePendingExternalOrder('ord-1');

    expect(getPendingExternalOrders().map((e) => e.orderId)).toEqual(['ord-2']);
  });
});

describe('an old Telegram client', () => {
  it('redirects rather than calling an openLink the client cannot honour', () => {
    const openLink = vi.fn();
    (window as unknown as Record<string, unknown>).Telegram = {
      WebApp: { initData: 'query_id=1', openLink, isVersionAtLeast: () => false },
    };

    // The method has existed in telegram-web-app.js far longer than clients
    // have honoured it; on an old client the call is a silent no-op and the
    // user taps Pay and watches nothing happen.
    expect(openNbuUrl(INPUT)).toBe('redirect');
    expect(openLink).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith(PAYMENT_URL);
  });
});

describe('the lock releases itself', () => {
  it('drops an entry older than the client TTL', () => {
    inMiniApp(vi.fn());
    openNbuUrl(INPUT);
    expect(getPendingExternalOrders()).toHaveLength(1);

    // A user who opened the gateway and closed it without paying leaves the row
    // PENDING, and the backend only auto-expires it after an hour
    // (nbu_reconciler AUTO_EXPIRE_SECONDS). Holding every pay button that long
    // is worse than the duplicate it guards against.
    const stored = JSON.parse(localStorage.getItem('nbu_pending_external_orders')!);
    stored[0].openedAt = Date.now() - 16 * 60 * 1000;
    localStorage.setItem('nbu_pending_external_orders', JSON.stringify(stored));

    expect(getPendingExternalOrders()).toEqual([]);
  });

  it('records the kind, so a card binding cannot block a flight payment', () => {
    inMiniApp(vi.fn());
    localStorage.setItem(
      'nbu_return_context:bind-1',
      JSON.stringify({
        orderId: 'bind-1',
        kind: 'card_binding',
        path: '/user/profile',
        createdAt: Date.now(),
      }),
    );

    openNbuUrl({ orderId: 'bind-1', kind: 'card_binding', paymentUrl: PAYMENT_URL });

    const open = getPendingExternalOrders();
    expect(open.map((e) => e.kind)).toEqual(['card_binding']);
    expect(open.some((e) => e.kind === 'payment')).toBe(false);
  });
});

describe('getPendingExternalOrders is pure', () => {
  it('does not write while reading, so it is safe to call during render', () => {
    inMiniApp(vi.fn());
    openNbuUrl(INPUT);
    const stored = JSON.parse(localStorage.getItem('nbu_pending_external_orders')!);
    stored[0].openedAt = Date.now() - 16 * 60 * 1000;
    localStorage.setItem('nbu_pending_external_orders', JSON.stringify(stored));
    const before = localStorage.getItem('nbu_pending_external_orders');

    // Reads as empty...
    expect(getPendingExternalOrders()).toEqual([]);
    // ...but storage is untouched: a getter that wrote here would notify its
    // own subscribers in the middle of the render that called it.
    expect(localStorage.getItem('nbu_pending_external_orders')).toBe(before);

    prunePendingExternalOrders();
    expect(localStorage.getItem('nbu_pending_external_orders')).toBeNull();
  });
});
