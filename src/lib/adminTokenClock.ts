/**
 * Whether the staff JWT has expired, judged against the server's clock.
 *
 * `exp` is a moment on the SERVER's clock, so comparing it with this device's
 * `Date.now()` is right only while the two agree. A warehouse PC whose timezone
 * is UTC but whose clock was set by hand to Tashkent time runs five hours ahead:
 * an 8-hour token looked expired after three, and the session was thrown away
 * on the next reload although the server would still have accepted it.
 *
 * So the gap is measured once, when the token arrives: `iat` is the server's
 * clock at signing and `Date.now()` is ours a moment later. Expiry is then read
 * as `exp` shifted by that gap. Network latency adds a second or two, which is
 * noise next to a lifetime of hours.
 *
 * One record is kept, for the latest token, keyed by its `jti`. A token that
 * arrived before this existed (no record, or no `iat`) is compared with the
 * device clock directly, exactly as before.
 */

const STORAGE_KEY = 'admin_token_clock';

interface AdminTokenTimes {
  jti: string | null;
  iat: number | null;
  exp: number | null;
}

interface TokenClockRecord {
  jti: string;
  offsetMs: number;
}

function readTokenTimes(token: string): AdminTokenTimes | null {
  try {
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')),
    ) as Record<string, unknown>;
    return {
      jti: typeof payload.jti === 'string' ? payload.jti : null,
      iat: typeof payload.iat === 'number' ? payload.iat : null,
      exp: typeof payload.exp === 'number' ? payload.exp : null,
    };
  } catch {
    return null;
  }
}

function readClockRecord(): TokenClockRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as Partial<TokenClockRecord>;
    if (typeof record.jti !== 'string' || typeof record.offsetMs !== 'number') {
      return null;
    }
    return { jti: record.jti, offsetMs: record.offsetMs };
  } catch {
    return null;
  }
}

/**
 * Record how far this device's clock is from the server's, for a token that
 * has just been issued. Call it with every staff token the server hands out.
 */
export function rememberAdminTokenClock(
  token: string,
  receivedAt: number = Date.now(),
): void {
  const times = readTokenTimes(token);
  if (!times?.jti || times.iat === null) return;
  const record: TokenClockRecord = {
    jti: times.jti,
    offsetMs: receivedAt - times.iat * 1000,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage full or blocked: expiry falls back to the device clock.
  }
}

/**
 * Whether a staff token has expired by the server's clock.
 *
 * Returns false when the token cannot be read: an unreadable token is the
 * server's business, and refusing it here would be worse than letting the
 * server answer 401 once.
 */
export function isAdminTokenExpired(token: string, now: number = Date.now()): boolean {
  const times = readTokenTimes(token);
  if (times?.exp == null) return false;
  const record = readClockRecord();
  const offsetMs = record && record.jti === times.jti ? record.offsetMs : 0;
  return times.exp * 1000 + offsetMs <= now;
}
