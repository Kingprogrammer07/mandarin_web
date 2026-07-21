import i18n from '@/i18n/config';
import { nbuPaymentService } from '@/api/services/nbuPaymentService';
import { redirectToNbuUrl } from '@/utils/nbuReturnContext';

/**
 * Backend signal (HTTP 409) raised when a saved-card charge failed with an NBU
 * code a re-bind can plausibly fix (3008 token-not-found, 5000 processing error).
 * The card is NOT deleted server-side — the user chooses what to do.
 */
interface CardReauthDetail {
  code: 'card_reauth_suggested';
  nbu_code: number;
  card_id: number;
  request_id?: string | null;
}

/**
 * Error shape after the axios interceptor in `api/client.ts`, which rejects with
 * `{ message, status, data }` where `data` is the raw FastAPI body.
 */
interface NormalizedApiError {
  status?: number;
  data?: { detail?: unknown };
}

function extractReauthDetail(error: unknown): CardReauthDetail | null {
  const err = error as NormalizedApiError | null | undefined;
  if (!err || err.status !== 409) return null;
  const detail = err.data?.detail;
  if (
    detail &&
    typeof detail === 'object' &&
    (detail as CardReauthDetail).code === 'card_reauth_suggested' &&
    typeof (detail as CardReauthDetail).card_id === 'number'
  ) {
    return detail as CardReauthDetail;
  }
  return null;
}

/** Synchronous predicate — true when `error` is the "re-bind suggested" 409. */
export function isCardReauthError(error: unknown): boolean {
  return extractReauthDetail(error) !== null;
}

/**
 * Native confirm dialog (Telegram WebApp when available, `window.confirm`
 * otherwise). Resolves true when the user accepts.
 */
function askConfirm(message: string): Promise<boolean> {
  const tg = window.Telegram?.WebApp as
    | { showConfirm?: (msg: string, cb: (ok: boolean) => void) => void }
    | undefined;
  if (tg?.showConfirm) {
    return new Promise<boolean>((resolve) => {
      try {
        tg.showConfirm!(message, (ok: boolean) => resolve(Boolean(ok)));
      } catch {
        resolve(window.confirm(message));
      }
    });
  }
  return Promise.resolve(window.confirm(message));
}

/**
 * Offer the user a recovery path for a failing saved card: either unbind it and
 * open a fresh NBU bind session now (re-binding usually clears the failure), or
 * dismiss and pay later. Assumes `error` already matched {@link isCardReauthError}.
 *
 * "Re-bind now" deletes the dead card first (NBU-side unbind + local soft-delete
 * via `deleteCard`) so it drops out of the list, then opens the bind page. On
 * "pay later" nothing is changed.
 */
export async function promptCardReauth(error: unknown): Promise<void> {
  const detail = extractReauthDetail(error);
  if (!detail) return;

  const proceed = await askConfirm(
    i18n.t('nbu.reauth.confirm', {
      defaultValue:
        "To'lov amalga oshmadi. Ko'pincha kartani uzib qayta ulash yordam beradi. " +
        'Hozir qayta ulaysizmi? (Bekor qilsangiz, keyinroq to’lashingiz mumkin.)',
    }),
  );
  if (!proceed) return; // user chose "pay later"

  try {
    // Best-effort — remove the dead card so it can't be picked again. Even if
    // this hiccups we still proceed to bind a fresh token.
    await nbuPaymentService.deleteCard(detail.card_id);
  } catch {
    // swallow — binding a new card is the important part
  }

  const bind = await nbuPaymentService.bindCard();
  if (bind.payment_url) {
    redirectToNbuUrl({
      orderId: bind.order_id,
      kind: 'card_binding',
      paymentUrl: bind.payment_url,
    });
  }
}
