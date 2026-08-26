/**
 * Turning a rejected request into something a cashier can act on.
 *
 * Shared because the two screens that need it were each getting it wrong in a
 * different way: one reported every failure as "client not found", the other
 * reported nothing at all.
 *
 * The shape matters. `apiClient` rejects with `{ message, status, data }` where
 * `data` is the raw response body, and this backend sends `detail` in three
 * different shapes:
 *
 *   - `{ error, code }`      — a domain refusal from the POS endpoints
 *   - `"some string"`        — FastAPI's own HTTPException detail
 *   - `[{ code, message }]`  — a request-validation 422 (bot.py:542)
 *
 * The third is the trap: `typeof [] === 'object'`, so a narrowing that only
 * checks `typeof` reads `.code` and `.error` off an array and gets `undefined`
 * for both. What actually keeps that from becoming an empty banner and a
 * silently dead button is the fallback chain in `describeApiFailure` — the
 * message falls through to the transport error and then to a literal, so it
 * can never come back blank. That chain is the fix, and it is what the tests
 * pin; the `Array.isArray` check below only keeps the type predicate honest,
 * since an array is not a `DomainDetail` whatever `typeof` says.
 */

interface DomainDetail {
  error?: string;
  code?: string;
}

interface ApiFailure {
  status?: number;
  message?: string;
  data?: { detail?: unknown };
}

const FALLBACK = 'O‘zgartirishda xatolik yuz berdi';

/**
 * True only for a plain object.
 *
 * Arrays are excluded so the `value is DomainDetail` predicate is not a lie —
 * not because excluding them changes the result, which it does not: reading
 * `.code` off an array yields `undefined` and the caller's fallbacks handle it.
 */
function isDomainDetail(value: unknown): value is DomainDetail {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The refusal code and a message that is never empty.
 *
 * `code` is null whenever the server did not send a domain code — including
 * for a validation 422, where there is nothing the caller can branch on.
 */
export function describeApiFailure(
  err: unknown,
  fallback: string = FALLBACK,
): { code: string | null; message: string } {
  const failure = err as ApiFailure;
  const detail = failure?.data?.detail;

  if (isDomainDetail(detail)) {
    return {
      code: detail.code ?? null,
      message: detail.error ?? failure?.message ?? fallback,
    };
  }

  if (typeof detail === 'string' && detail.trim()) {
    return { code: null, message: detail };
  }

  // A validation array, or anything unrecognised. There is no useful per-field
  // text to show a cashier, so the transport message stands in.
  return { code: null, message: failure?.message?.trim() || fallback };
}

/**
 * Why a client lookup failed, told apart by status.
 *
 * A bare catch used to report all of these as "client not found", which sent
 * the cashier back to re-type a code that was never the problem — and after a
 * QR scan it states something provably false, since the scan just resolved
 * that client against the server.
 */
export function describeSearchFailure(err: unknown, query: string): string {
  const { status } = err as ApiFailure;
  if (status === 404) return `"${query}" bo‘yicha mijoz topilmadi`;
  if (status === 401 || status === 403)
    return 'Sessiya tugagan. Qaytadan kiring.';
  if (status && status >= 500)
    return `Server xatosi (${status}). Biroz kutib, qayta urining.`;
  if (!status) return 'Aloqa yo‘q. Internet yoki server bilan bog‘lanib bo‘lmadi.';
  return `Qidirishda xatolik (${status}).`;
}
