/**
 * The paths that are a cashier console.
 *
 * Unrelated modules used to hard-code the literal `'/pos'`, each for its own
 * reason, and every one of them silently breaks a console served from any
 * other path:
 *
 * - `usePaymentNotifications` gates its query on the path, so a second console
 *   would fetch no notifications at all — and show an empty list rather than an
 *   error, which is the worst way to fail.
 * - `TelegramWebAppGuard` skips Telegram initData validation here, without
 *   which a browser-opened console hangs on the validation screen forever.
 *
 * Declaring the set once means adding a console is one edit, not several, and
 * a missed one cannot fail quietly. (The maintenance-screen exemption that used
 * to live here now covers every staff page — see `maintenanceScope`.)
 *
 * `/pos` itself is permanent regardless of what replaces it: printed receipts
 * already in customers' hands carry a QR pointing at `{BASE}/pos?receipt=<id>`
 * (backend `nbu_payment.py`, `payments_nbu.py`). Retire the component behind
 * the path, never the path.
 *
 * `/kassa` is the rebuilt console. It is listed here for the same reason `/pos`
 * is: a cashier opens it in an ordinary browser, so it must skip the Telegram
 * Mini App guard.
 */
export const POS_PATHS = ['/pos', '/kassa'] as const;

/** True when `pathname` is a cashier console. Exact match. */
export function isPosPath(pathname: string): boolean {
  return (POS_PATHS as readonly string[]).includes(pathname);
}
