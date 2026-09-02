/**
 * Which stored session serves a given route.
 *
 * Two independent sessions can exist side by side in one browser: a staff JWT in
 * `localStorage` (`access_token` + `admin_role`) and a client token in
 * `sessionStorage` (`access_token`). Inside Telegram's WebView they share one
 * storage context, so a staff member who is also a customer holds both at once.
 *
 * The rule lived inline in `App.tsx`'s auth effect, tangled with `setState`,
 * `applyRoute` and an `await`. Pulled out here it is a pure function with a
 * table of cases, which is the only way to state — and test — what is supposed
 * to happen when both tokens are present.
 *
 * This module decides WHICH session applies. Whether that session is still
 * valid is a separate question: the client token is proven by `/auth/me`, the
 * staff JWT by the next call carrying `X-Admin-Authorization`.
 */

export interface StoredSessions {
  /** Staff JWT from `localStorage`. */
  adminToken: string | null;
  /** Staff role name stored beside it. Both are needed for a staff session. */
  adminRole: string | null;
  /** Client token from `sessionStorage`. */
  userToken: string | null;
}

export interface RouteKind {
  /** Reachable with no session at all — `/pickup-tv`, the NBU return pages. */
  isPublic: boolean;
  /** A page a client account opens: `/user/*`, saved cards, referral. */
  isUserPage: boolean;
}

export type SessionChoice =
  /** No session needed. `role` is whatever we happen to know, for display only. */
  | { kind: 'public'; role: string | null }
  /** Serve as staff. The role is known without a round trip. */
  | { kind: 'admin'; role: string }
  /** A client token exists but has not been proven — the caller must verify it. */
  | { kind: 'client' }
  /** Nothing usable for this route. */
  | { kind: 'guest' };

/**
 * Pick the session for a route.
 *
 * Order matters and is the whole point:
 *
 * 1. A public route needs nothing, so it never rejects anyone.
 * 2. A `/user/*` route is the client app and is served by the client session
 *    ALONE, even when a staff session is also stored. It used to be taken by
 *    the staff session, and `checkAccess` would then find the page missing from
 *    that role's allow-list and rewrite the URL to the admin dashboard — so a
 *    staff member who opened the panel once inside Telegram could never reach
 *    the client app again from that WebView, where both sessions share one
 *    storage context. Being a staff member is not a reason to stop being a
 *    customer.
 * 3. Otherwise a staff session takes the route when one is stored.
 * 4. Otherwise a client token is used, once verified by the caller.
 * 5. Otherwise the visitor is a guest.
 */
export function pickSession(
  sessions: StoredSessions,
  route: RouteKind,
): SessionChoice {
  const { adminToken, adminRole, userToken } = sessions;
  const hasAdmin = Boolean(adminToken && adminRole);

  if (route.isPublic) {
    return { kind: 'public', role: hasAdmin ? (adminRole as string) : null };
  }

  if (route.isUserPage) {
    return userToken ? { kind: 'client' } : { kind: 'guest' };
  }

  if (hasAdmin) {
    return { kind: 'admin', role: adminRole as string };
  }

  if (userToken) {
    return { kind: 'client' };
  }

  return { kind: 'guest' };
}

/**
 * URL prefixes that belong to the client app.
 *
 * Needed outside the router too: the axios interceptor has to pick WHICH
 * credential to send, and it only knows the URL. It used to attach the staff
 * JWT whenever one was stored, so a client screen's requests went out with
 * `X-Admin-Authorization` and no client credential at all — a 401, and then a
 * logout, for a staff member simply looking at their own parcels.
 *
 * `/payment/nbu/cards` is the saved-cards screen; it is a client page despite
 * living outside `/user`.
 */
const CLIENT_PATH_PREFIXES = ['/user/', '/payment/nbu/cards'] as const;

/** Is this URL path part of the client app rather than a staff console? */
export function isClientPath(pathname: string): boolean {
  return CLIENT_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

/**
 * Which stored credential a request from this page should carry.
 *
 * Same rule as {@link pickSession}, applied to a request rather than a route:
 * a client page uses the client token, everything else prefers the staff JWT.
 * Returning `null` means send neither — the request goes out unauthenticated
 * and the server decides.
 */
export function credentialForPath(
  pathname: string,
  sessions: Pick<StoredSessions, 'adminToken' | 'userToken'>,
): 'admin' | 'client' | null {
  const { adminToken, userToken } = sessions;
  if (isClientPath(pathname)) {
    return userToken ? 'client' : null;
  }
  if (adminToken) return 'admin';
  return userToken ? 'client' : null;
}

/**
 * URL prefixes that belong to a staff console.
 *
 * Most of them are NOT under `/admin`, which is the trap: a prefix test on
 * `/admin` leaves a cashier on `/kassa`, an operator on `/import` and anyone
 * editing a client behind the Telegram Mini App guard, while their
 * `/admin/...` twins pass. `/warehouse` is a second URL for the same page as
 * `/admin/warehouse`.
 */
const STAFF_PATH_PREFIXES = [
  '/admin',
  '/astatka',
  '/flights',
  '/statistics',
  '/import',
  '/client/add',
  '/client/edit/',
  '/warehouse',
  '/pos',
  '/kassa',
] as const;

/** Is this URL path a staff console rather than the client app? */
export function isStaffPath(pathname: string): boolean {
  return STAFF_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(prefix),
  );
}
