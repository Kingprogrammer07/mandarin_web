import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { discardAdminSession } from './adminSession';

describe('discardAdminSession', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears the staff session before announcing the logout', () => {
    // useGlobalEvents reconnects on this event and reads storage right then; a
    // token still stored at that moment would reopen the stream with it.
    localStorage.setItem('access_token', 'jwt');
    localStorage.setItem('admin_role', 'uzpost-label-config');
    const seen: Array<{ token: string | null; role: string | null; scope: unknown }> = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      seen.push({
        token: localStorage.getItem('access_token'),
        role: localStorage.getItem('admin_role'),
        scope: (event as CustomEvent<{ scope?: string }>).detail?.scope,
      });
      return true;
    });

    discardAdminSession({ adminToken: 'jwt', userToken: null });

    expect(seen).toEqual([{ token: null, role: null, scope: 'admin' }]);
  });

  it("removes the switcher's copy of the staff JWT from the client slot", () => {
    sessionStorage.setItem('access_token', 'jwt');

    discardAdminSession({ adminToken: 'jwt', userToken: 'jwt' });

    expect(sessionStorage.getItem('access_token')).toBeNull();
  });

  it('leaves a real client session alone', () => {
    sessionStorage.setItem('access_token', 'client-token');

    discardAdminSession({ adminToken: 'jwt', userToken: 'client-token' });

    expect(sessionStorage.getItem('access_token')).toBe('client-token');
  });
});
