/**
 * Tokens the staff session keeps: the refresh cache and the server-clock record.
 *
 * Logout and its body are covered in adminAuth.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('../client', () => ({ apiClient: { post: (...args: unknown[]) => post(...args) } }));

/** An unsigned token: only the claims are read, nothing is verified. */
function token(jti: string): string {
  const now = Math.floor(Date.now() / 1000);
  return `x.${btoa(JSON.stringify({ sub: '10', jti, iat: now, exp: now + 43_200 }))}.y`;
}

/** A fresh module each time: the refresh cache is module state. */
async function loadAdminAuth() {
  vi.resetModules();
  return import('./adminAuth');
}

beforeEach(() => {
  localStorage.clear();
  post.mockReset();
});

describe('refreshAdminToken', () => {
  it('reuses a refresh made moments ago for the same session', async () => {
    const { refreshAdminToken } = await loadAdminAuth();
    const first = token('t1');
    localStorage.setItem('access_token', token('t0'));
    post.mockResolvedValueOnce({ data: { access_token: first, token_type: 'bearer' } });

    await refreshAdminToken();
    // The page stores the new token; the next page to mount sends that one.
    localStorage.setItem('access_token', first);
    const again = await refreshAdminToken();

    expect(post).toHaveBeenCalledTimes(1);
    expect(again.access_token).toBe(first);
  });

  it('never hands a new session the previous one’s token', async () => {
    // Signed out and back in inside the 30s window: the cached token was
    // revoked at logout, and storing it logged the worker straight out again.
    const { refreshAdminToken } = await loadAdminAuth();
    const revoked = token('t1');
    const fresh = token('t3');
    localStorage.setItem('access_token', token('t0'));
    post.mockResolvedValueOnce({ data: { access_token: revoked, token_type: 'bearer' } });
    await refreshAdminToken();

    localStorage.setItem('access_token', token('t2'));
    post.mockResolvedValueOnce({ data: { access_token: fresh, token_type: 'bearer' } });
    const result = await refreshAdminToken();

    expect(post).toHaveBeenCalledTimes(2);
    expect(result.access_token).toBe(fresh);
  });

  it('measures the server clock for the token it receives', async () => {
    const { refreshAdminToken } = await loadAdminAuth();
    localStorage.setItem('access_token', token('t0'));
    post.mockResolvedValueOnce({ data: { access_token: token('t1'), token_type: 'bearer' } });

    await refreshAdminToken();

    expect(JSON.parse(localStorage.getItem('admin_token_clock') ?? '{}').jti).toBe('t1');
  });
});

describe('sign-in and role switch', () => {
  it('measures the server clock for every token they return', async () => {
    const { loginAdminPin, switchAdminRole, webauthnLoginComplete } = await loadAdminAuth();
    const clockJti = () => JSON.parse(localStorage.getItem('admin_token_clock') ?? '{}').jti;

    post.mockResolvedValueOnce({ data: { access_token: token('pin') } });
    await loginAdminPin('Omborchi', '1234', 'test');
    expect(clockJti()).toBe('pin');

    post.mockResolvedValueOnce({ data: { access_token: token('passkey') } });
    await webauthnLoginComplete('Omborchi', {
      id: 'c',
      rawId: 'c',
      type: 'public-key',
      response: { clientDataJSON: '', authenticatorData: '', signature: '', userHandle: null },
    });
    expect(clockJti()).toBe('passkey');

    localStorage.setItem('access_token', token('passkey'));
    post.mockResolvedValueOnce({ data: { access_token: token('switched') } });
    await switchAdminRole('warehouse');
    expect(clockJti()).toBe('switched');
  });
});
