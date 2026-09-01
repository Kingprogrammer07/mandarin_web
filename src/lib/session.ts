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
 * 2. A staff session takes the route when one is stored.
 * 3. Otherwise a client token is used, once verified by the caller.
 * 4. Otherwise the visitor is a guest.
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

  if (hasAdmin) {
    return { kind: 'admin', role: adminRole as string };
  }

  if (userToken) {
    return { kind: 'client' };
  }

  return { kind: 'guest' };
}
