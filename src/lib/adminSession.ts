/**
 * Drop a stored staff session that can no longer be served.
 *
 * Lives outside App.tsx so its order can be tested. Storage is cleared BEFORE
 * `auth:logout` is dispatched: useGlobalEvents reconnects its stream on that
 * event and reads the token at that moment, so clearing afterwards would
 * reconnect with the dropped token.
 *
 * The client slot is cleared only when it holds a copy of the staff JWT — the
 * role switcher writes one there when a client token exists. A real client
 * session is left alone.
 */
export function discardAdminSession(sessions: {
  adminToken: string | null;
  userToken: string | null;
}): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('admin_role');
  if (sessions.userToken && sessions.userToken === sessions.adminToken) {
    sessionStorage.removeItem('access_token');
  }
  window.dispatchEvent(new CustomEvent('auth:logout', { detail: { scope: 'admin' } }));
}
