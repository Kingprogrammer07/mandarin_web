import { isAxiosError } from "axios";

/**
 * Turn an unknown thrown value into a user-facing message.
 *
 * Priority:
 *  1. The backend's `detail` field (FastAPI raises HTTPException with a clear
 *     Uzbek message for 404/409/422 — e.g. "Bu reys allaqachon to'liq
 *     tasdiqlangan"). Showing it lets the cashier understand *why* an action
 *     was rejected instead of seeing a generic error that looks like a crash.
 *  2. No response at all → network/offline.
 *  3. 5xx → a real server error, worded distinctly so it never gets confused
 *     with an expected 4xx business rejection.
 *  4. Anything else → the caller's fallback.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();

    if (!error.response) {
      return "Internet aloqasi yo'q. Qayta urinib ko'ring.";
    }
    if (error.response.status >= 500) {
      return "Server xatosi. Birozdan so'ng qayta urinib ko'ring.";
    }
  }
  return fallback;
}
