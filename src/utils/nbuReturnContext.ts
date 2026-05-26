export type NbuReturnKind = 'payment' | 'card_binding';

interface NbuReturnContext {
  orderId: string;
  kind: NbuReturnKind;
  path: string;
  flightName?: string;
  createdAt: number;
}

interface SaveNbuReturnContextInput {
  orderId: string;
  kind: NbuReturnKind;
  paymentUrl: string;
  flightName?: string | null;
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

export function redirectToNbuUrl(input: SaveNbuReturnContextInput): void {
  safeWrite({
    orderId: input.orderId,
    kind: input.kind,
    path: currentAppPath(),
    flightName: input.flightName ?? undefined,
    createdAt: Date.now(),
  });

  window.location.assign(input.paymentUrl);
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
