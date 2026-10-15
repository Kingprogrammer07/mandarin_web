import { beforeEach, describe, expect, it } from 'vitest';

import { isAdminTokenExpired, rememberAdminTokenClock } from './adminTokenClock';

const HOUR = 3_600_000;
/** Server clock at signing, in ms. */
const ISSUED = Date.UTC(2026, 9, 15, 3, 0, 0);

/** An unsigned token: only the claims are read, nothing is verified. */
function token(claims: Record<string, unknown>): string {
  const payload = btoa(JSON.stringify(claims))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `x.${payload}.y`;
}

function staffToken(jti: string, lifetimeHours: number): string {
  return token({
    sub: '10',
    jti,
    iat: ISSUED / 1000,
    exp: (ISSUED + lifetimeHours * HOUR) / 1000,
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe('isAdminTokenExpired', () => {
  it('keeps a session on a device whose clock runs five hours fast', () => {
    // The owner's report: logged out after about 3 hours of an 8-hour token.
    const fast = 5 * HOUR;
    const t = staffToken('a', 8);
    rememberAdminTokenClock(t, ISSUED + fast);

    expect(isAdminTokenExpired(t, ISSUED + fast + 3 * HOUR)).toBe(false);
    expect(isAdminTokenExpired(t, ISSUED + fast + 7.9 * HOUR)).toBe(false);
    expect(isAdminTokenExpired(t, ISSUED + fast + 8 * HOUR)).toBe(true);
  });

  it('still lets a twelve-hour warehouse token run its course on a slow clock', () => {
    const slow = -2 * HOUR;
    const t = staffToken('w', 12);
    rememberAdminTokenClock(t, ISSUED + slow);

    expect(isAdminTokenExpired(t, ISSUED + slow + 11.9 * HOUR)).toBe(false);
    expect(isAdminTokenExpired(t, ISSUED + slow + 12 * HOUR)).toBe(true);
  });

  it('reads a token with no record against the device clock, as before', () => {
    const t = staffToken('old', 8);

    expect(isAdminTokenExpired(t, ISSUED + 7 * HOUR)).toBe(false);
    expect(isAdminTokenExpired(t, ISSUED + 8 * HOUR)).toBe(true);
  });

  it("does not apply another token's offset", () => {
    rememberAdminTokenClock(staffToken('a', 8), ISSUED + 5 * HOUR);
    const other = staffToken('b', 8);

    expect(isAdminTokenExpired(other, ISSUED + 8 * HOUR)).toBe(true);
  });

  it('records nothing for a token signed before iat was added', () => {
    rememberAdminTokenClock(
      token({ jti: 'legacy', exp: (ISSUED + 8 * HOUR) / 1000 }),
      ISSUED + 5 * HOUR,
    );

    expect(localStorage.getItem('admin_token_clock')).toBeNull();
  });

  it('leaves an unreadable token to the server', () => {
    expect(isAdminTokenExpired('not-a-jwt', ISSUED + 100 * HOUR)).toBe(false);
    expect(isAdminTokenExpired(token({ jti: 'no-exp' }), ISSUED + 100 * HOUR)).toBe(false);
  });

  it('ignores a corrupted record', () => {
    localStorage.setItem('admin_token_clock', '{not json');
    const t = staffToken('a', 8);

    expect(isAdminTokenExpired(t, ISSUED + 7 * HOUR)).toBe(false);
    expect(isAdminTokenExpired(t, ISSUED + 8 * HOUR)).toBe(true);
  });
});
