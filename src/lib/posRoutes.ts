/**
 * The paths that are a cashier console.
 *
 * Four unrelated modules used to hard-code the literal `'/pos'`, each for its
 * own reason, and every one of them silently breaks a console served from any
 * other path:
 *
 * - `usePaymentNotifications` gates its query on the path, so a second console
 *   would fetch no notifications at all — and show an empty list rather than an
 *   error, which is the worst way to fail.
 * - `client.ts` exempts these paths from the full-screen maintenance takeover,
 *   so a transient 502 would bury a cashier mid-payment.
 * - `App.tsx` mirrors that exemption for the in-app maintenance screen.
 * - `TelegramWebAppGuard` skips Telegram initData validation here, without
 *   which a browser-opened console hangs on the validation screen forever.
 *
 * Declaring the set once means adding a console is one edit, not four, and a
 * missed one cannot fail quietly.
 *
 * `/pos` itself is permanent regardless of what replaces it: printed receipts
 * already in customers' hands carry a QR pointing at `{BASE}/pos?receipt=<id>`
 * (backend `nbu_payment.py`, `payments_nbu.py`). Retire the component behind
 * the path, never the path.
 */
export const POS_PATHS = ['/pos', '/pos2'] as const;

/**
 * Other operator consoles that share the POS's maintenance exemption.
 *
 * Same rule, different reason: a warehouse or expected-cargo screen is staff
 * tooling in the middle of physical work, and a maintenance banner there costs
 * more than it protects.
 */
export const OPERATIONAL_PATHS = ['/admin/warehouse', '/admin/expected-cargo'] as const;

/** True when `pathname` is a cashier console. Exact match — see {@link isOperationalPath}. */
export function isPosPath(pathname: string): boolean {
  return (POS_PATHS as readonly string[]).includes(pathname);
}

/**
 * True when `pathname` is any console exempt from the maintenance takeover.
 *
 * Prefix match, unlike {@link isPosPath}: warehouse and expected-cargo screens
 * have sub-routes, and `/pos` is matched by prefix here too so a future
 * `/pos/receipt/...` keeps the exemption rather than losing it on a deep link.
 */
export function isOperationalPath(pathname: string): boolean {
  return [...POS_PATHS, ...OPERATIONAL_PATHS].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
