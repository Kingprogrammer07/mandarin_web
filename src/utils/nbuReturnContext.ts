export type NbuReturnKind = 'payment' | 'card_binding';

interface NbuReturnContext {
  orderId: string;
  kind: NbuReturnKind;
  path: string;
  flightName?: string;
  /** Where the success page's "home" button should land (e.g. a history page). */
  homePath?: string;
  createdAt: number;
}

interface SaveNbuReturnContextInput {
  orderId: string;
  kind: NbuReturnKind;
  paymentUrl: string;
  flightName?: string | null;
  /** Where the success page's "home" button should land (e.g. a history page). */
  homePath?: string | null;
}

const KEY_PREFIX = 'nbu_return_context:';
const LAST_KEY = 'nbu_return_context:last';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function currentAppPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function safeRead(key: string): NbuReturnContext | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NbuReturnContext>;
    if (!parsed.orderId || !parsed.kind || !parsed.path || !parsed.createdAt) {
      return null;
    }
    if (Date.now() - parsed.createdAt > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return {
      orderId: parsed.orderId,
      kind: parsed.kind,
      path: parsed.path,
      flightName: parsed.flightName,
      homePath: parsed.homePath,
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

function safeWrite(context: NbuReturnContext): void {
  try {
    const payload = JSON.stringify(context);
    localStorage.setItem(`${KEY_PREFIX}${context.orderId}`, payload);
    localStorage.setItem(LAST_KEY, payload);
  } catch {
    // Return context is a convenience only; the payment redirect itself must continue.
  }
}

function safeSameOriginPath(path: string): URL | null {
  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url;
  } catch {
    return null;
  }
}

/** How the gateway was reached, so the caller knows whether it still exists. */
export type NbuOpenMode = 'external' | 'redirect';

const PENDING_KEY = 'nbu_pending_external_orders';

/**
 * Orders opened in the in-app browser and not yet settled.
 *
 * A LIST, not one slot. A single slot meant a second payment overwrote the
 * first: the first was then never polled and never announced, and if it had
 * succeeded while the second expired the user was told "to'lov amalga oshmadi"
 * for money that had in fact left their card.
 */
export interface PendingNbuOrder {
  orderId: string;
  kind: NbuReturnKind;
  /** When the gateway was opened, for the client-side release below. */
  openedAt: number;
  /**
   * The gateway URL, so the SAME session can be reopened.
   *
   * 60% of sessions end EXPIRED: the user taps Pay, lands in the bank page,
   * leaves, and wants back in. Reopening this URL continues the session they
   * already have — starting a fresh one would leave two payable sessions for
   * the same debt, which is the only way to actually get charged twice.
   */
  paymentUrl?: string;
}

/**
 * How long a gateway session keeps a pay button locked.
 *
 * The lock exists to stop a second charge for the same thing while the first is
 * unresolved — but a user who opens the gateway and closes it WITHOUT paying
 * leaves the row PENDING, and the backend only auto-expires it after 3600s
 * (nbu_reconciler.py AUTO_EXPIRE_SECONDS). Holding every pay button for an hour
 * because someone changed their mind is worse than the risk it guards. Fifteen
 * minutes is far longer than a real card payment and far shorter than that.
 */
const PENDING_TTL_MS = 15 * 60 * 1000;

function readPending(): PendingNbuOrder[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): PendingNbuOrder[] => {
      if (typeof entry !== 'object' || entry === null) return [];
      const { orderId, kind, openedAt, paymentUrl } = entry as Partial<PendingNbuOrder>;
      if (typeof orderId !== 'string' || !orderId) return [];
      if (kind !== 'payment' && kind !== 'card_binding') return [];
      return [
        {
          orderId,
          kind,
          openedAt: typeof openedAt === 'number' ? openedAt : 0,
          paymentUrl: typeof paymentUrl === 'string' ? paymentUrl : undefined,
        },
      ];
    });
  } catch {
    return [];
  }
}

function writePending(orders: PendingNbuOrder[]): void {
  try {
    if (orders.length === 0) localStorage.removeItem(PENDING_KEY);
    else localStorage.setItem(PENDING_KEY, JSON.stringify(orders));
  } catch {
    // Best effort; the watcher degrades to "nothing pending".
  }
  for (const listener of pendingListeners) listener();
}

const pendingListeners = new Set<() => void>();

/** Lets a pay button disable itself while a gateway session is open. */
export function subscribePendingNbuOrders(listener: () => void): () => void {
  pendingListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === PENDING_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    pendingListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Send the user to the NBU gateway.
 *
 * Inside the Mini App this opens Telegram's in-app browser ON TOP of the app
 * (`WebApp.openLink`) instead of replacing it. Replacing it was the whole
 * problem: once the webview navigated to nbu.uz our code was gone, nothing was
 * left to show a back control, and a user who changed their mind had to kill
 * the app and reopen it.
 *
 * `target="_blank"` is not the alternative — a Mini App webview has no tabs and
 * ignores it. `openLink` is the platform's own answer.
 *
 * The outcome no longer depends on NBU redirecting back to us: NbuPaymentWatch
 * polls `payment-status-public/{orderId}`, which reconciles against NBU when the
 * row is still pending. Outside the Mini App (an ordinary browser, the admin
 * console) nothing changes — a plain same-tab redirect, where Back already works.
 */
export function openNbuUrl(input: SaveNbuReturnContextInput): NbuOpenMode {
  safeWrite({
    orderId: input.orderId,
    kind: input.kind,
    path: currentAppPath(),
    flightName: input.flightName ?? undefined,
    homePath: input.homePath ?? undefined,
    createdAt: Date.now(),
  });

  const webApp = window.Telegram?.WebApp;
  // Three separate things, all required:
  //  - `initData` is the only reliable "really inside Telegram" signal; the
  //    object itself exists on any page that loaded telegram-web-app.js.
  //  - the method exists.
  //  - the CLIENT supports it. telegram-web-app.js has defined `openLink` since
  //    long before older clients could honour it, so presence proves nothing —
  //    on one of those the call is a silent no-op and the user taps Pay and
  //    watches nothing happen. `web_app_open_link` is Bot API 6.1.
  const supportsOpenLink =
    Boolean(webApp?.initData) &&
    typeof webApp?.openLink === 'function' &&
    webApp.isVersionAtLeast?.('6.1') !== false;

  if (supportsOpenLink) {
    const pending = readPending();
    if (!pending.some((entry) => entry.orderId === input.orderId)) {
      writePending([
        ...pending,
        {
          orderId: input.orderId,
          kind: input.kind,
          openedAt: Date.now(),
          paymentUrl: input.paymentUrl,
        },
      ]);
    }
    webApp.openLink(input.paymentUrl, { try_instant_view: false });
    return 'external';
  }

  window.location.assign(input.paymentUrl);
  return 'redirect';
}

/**
 * Orders still awaiting an outcome, newest last.
 *
 * Self-pruning: an order whose 24h return context has expired is dropped, so a
 * gateway session the user abandoned days ago cannot keep a pay button locked
 * or a status strip on screen forever.
 */
/**
 * Orders still awaiting an outcome, oldest first.
 *
 * PURE — it prunes nothing. It is read from React render (via
 * `usePendingNbuOrders`), and a getter that wrote to storage would notify its
 * own subscribers mid-render. {@link prunePendingExternalOrders} does the
 * writing, from an effect.
 */
export function getPendingExternalOrders(): PendingNbuOrder[] {
  const now = Date.now();
  return readPending().filter((entry) => {
    if (now - entry.openedAt > PENDING_TTL_MS) return false;
    return safeRead(`${KEY_PREFIX}${entry.orderId}`)?.orderId === entry.orderId;
  });
}

/** Drop entries the getter above already ignores. Call from an effect. */
export function prunePendingExternalOrders(): void {
  const stored = readPending();
  const alive = getPendingExternalOrders();
  if (alive.length !== stored.length) writePending(alive);
}

export function removePendingExternalOrder(orderId: string): void {
  writePending(readPending().filter((entry) => entry.orderId !== orderId));
}

export function clearPendingExternalOrders(): void {
  writePending([]);
}

/**
 * Reopen a gateway session the user walked away from.
 *
 * Same URL, same order — NBU keeps the session payable for its whole timeout,
 * so this resumes rather than duplicates. Returns false when there is nothing
 * to reopen (an older pending entry saved before the URL was recorded).
 */
export function reopenNbuUrl(orderId: string): boolean {
  const entry = readPending().find((candidate) => candidate.orderId === orderId);
  const webApp = window.Telegram?.WebApp;
  if (!entry?.paymentUrl) return false;

  if (
    Boolean(webApp?.initData) &&
    typeof webApp?.openLink === 'function' &&
    webApp.isVersionAtLeast?.('6.1') !== false
  ) {
    webApp.openLink(entry.paymentUrl, { try_instant_view: false });
    return true;
  }

  window.location.assign(entry.paymentUrl);
  return true;
}

/**
 * The "home" target the success page should land on after this payment — set at
 * redirect time (e.g. the payment-history page). Same-origin validated. Null when
 * none was stored (caller falls back to its default home).
 */
export function getNbuHomePath(orderId: string): string | null {
  const exact = orderId ? safeRead(`${KEY_PREFIX}${orderId}`) : null;
  const fallback = safeRead(LAST_KEY);
  const context = exact ?? (fallback?.orderId === orderId ? fallback : null);
  if (!context?.homePath) return null;

  const url = safeSameOriginPath(context.homePath);
  if (!url) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function getNbuReturnPath(orderId: string): string | null {
  const exact = orderId ? safeRead(`${KEY_PREFIX}${orderId}`) : null;
  const fallback = safeRead(LAST_KEY);
  const context = exact ?? (fallback?.orderId === orderId ? fallback : null);
  if (!context) return null;

  const url = safeSameOriginPath(context.path);
  if (!url) return null;

  url.searchParams.set('nbuReturn', context.kind === 'payment' ? 'payment' : 'cards');
  url.searchParams.set('nbuOrderId', context.orderId);
  if (context.flightName) {
    url.searchParams.set('nbuFlight', context.flightName);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function clearNbuReturnParams(): void {
  const url = new URL(window.location.href);
  const keys = ['nbuReturn', 'nbuOrderId', 'nbuFlight'];
  let changed = false;
  for (const key of keys) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
}
