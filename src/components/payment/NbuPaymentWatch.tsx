/**
 * Watches an NBU payment opened in Telegram's in-app browser.
 *
 * `openNbuUrl` no longer replaces the Mini App with the gateway — it opens the
 * gateway on top, so the app is still running underneath and the user can
 * dismiss the browser at any point. That leaves one gap: nothing navigates back
 * to tell us how the payment went. This fills it by polling
 * `payment-status-public/{orderId}`, which reconciles against NBU on demand
 * while the row is still pending.
 *
 * Three things this deliberately does NOT do:
 *
 * - It does not navigate on success. The user never left the screen they
 *   started on, so there is nowhere to send them back to; they need the data on
 *   that screen refreshed, not a route change.
 * - It does not claim the back button. It is a status strip, not a dialog.
 *   Claiming back made the FIRST press after returning from the bank silently
 *   drop the pending order — no toast, no refresh, a stale balance left on
 *   screen — because on the main payment path this renders over MakePaymentModal
 *   and the user could not see what they had just dismissed.
 * - It does not sit on the bottom edge. `BottomNav` is there, and a ~68px strip
 *   over a 58px tab bar blocks navigation for as long as the payment is
 *   unresolved — which, once the poll gives up, is until the user finds the ✕.
 */

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';

import {
  nbuPaymentService,
  type PublicNbuPaymentStatus,
} from '@/api/services/nbuPaymentService';
import { usePendingNbuOrders } from '@/hooks/usePendingNbuOrders';
import { removePendingExternalOrder } from '@/utils/nbuReturnContext';
import { triggerSoftHaptic, triggerSuccessHaptic } from '@/utils/haptics';

/** Same ladder the success page uses: 2s, doubling, capped at 10s. */
const POLL_BASE_MS = 2_000;
const POLL_MAX_MS = 10_000;
const MAX_ATTEMPTS = 12;
/** After the visible ladder gives up, keep checking at a background pace. */
const IDLE_POLL_MS = 60_000;

const delayFor = (attempt: number): number =>
  Math.min(POLL_BASE_MS * 2 ** Math.max(0, attempt - 1), POLL_MAX_MS);

function formatUzs(value: number): string {
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 }).format(value);
}

export function NbuPaymentWatch() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const pending = usePendingNbuOrders();
  /**
   * Orders the user has waved away.
   *
   * Dismiss HIDES the strip; it does not release the lock. Removing the order
   * from the pending list on a ✕ tap re-armed every pay button while the
   * payment was still unresolved — which is the double-charge window this lock
   * exists to close, reopened by a control labelled only "Yopish". The entry
   * still expires on its own (PENDING_TTL_MS) and still settles if the poll
   * catches a terminal status.
   */
  const [hidden, setHidden] = useState<string[]>([]);

  // One at a time, oldest first: the next takes over the moment this settles.
  // Note this ignores `hidden` — dismissing must not stop the POLLING, only the
  // strip. Stopping the poll meant the payment never settled: no toast, no
  // refresh, and the lock held until its TTL instead of until the outcome.
  const orderId = pending[0]?.orderId ?? null;
  const isHidden = orderId !== null && hidden.includes(orderId);

  const [info, setInfo] = useState<PublicNbuPaymentStatus | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [pollKey, setPollKey] = useState(0);

  const settle = useCallback(
    (status: PublicNbuPaymentStatus) => {
      if (status.status === 'SUCCESS') {
        triggerSuccessHaptic();
        toast.success(
          status.purpose === 'CARD_BINDING'
            ? t('nbuWatch.boundToast', 'Karta muvaffaqiyatli ulandi')
            : t('nbuWatch.paidToast', "To'lov qabul qilindi"),
        );
      } else if (status.status === 'REFUNDED') {
        // Terminal, but the money came back. Announcing it as a failed payment
        // would send the user to pay again for something already refunded.
        toast.info(t('nbuWatch.refundedToast', "To'lov qaytarildi"));
      } else if (status.status === 'EXPIRED') {
        toast.error(t('nbuWatch.expiredToast', "To'lov muddati tugadi"));
      } else {
        toast.error(t('nbuWatch.failedToast', "To'lov amalga oshmadi"));
      }

      // Default `refetchType` is 'active', so this refetches only what is
      // mounted — the balances, debts and card lists the user is looking at.
      // Everything else is merely marked stale.
      void queryClient.invalidateQueries();
      removePendingExternalOrder(status.order_id);
      setHidden((ids) => ids.filter((id) => id !== status.order_id));
      setInfo(null);
      setExhausted(false);
    },
    [queryClient, t],
  );

  const dismiss = useCallback(() => {
    if (!orderId) return;
    setHidden((ids) => (ids.includes(orderId) ? ids : [...ids, orderId]));
    setInfo(null);
    setExhausted(false);
  }, [orderId]);

  /** One effect owns the ladder; `pollKey` restarts it. */
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    let attempt = 0;
    let timer: number | null = null;

    const tick = async () => {
      if (cancelled) return;
      attempt += 1;
      try {
        const status = await nbuPaymentService.getPublicStatus(orderId);
        if (cancelled) return;
        setInfo(status);
        if (status.is_terminal) {
          settle(status);
          return;
        }
      } catch {
        // A failed check is not a failed payment — keep waiting and let the
        // attempt cap decide when to stop.
      }
      if (cancelled) return;
      if (attempt >= MAX_ATTEMPTS) {
        setExhausted(true);
        // Keep asking, just quietly. Stopping entirely left the pay buttons
        // locked until the app was backgrounded and brought back, even though
        // the backend settles the row on its own within the hour.
      }
      timer = window.setTimeout(
        () => {
          void tick();
        },
        attempt >= MAX_ATTEMPTS ? IDLE_POLL_MS : delayFor(attempt),
      );
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [orderId, pollKey, settle]);

  /**
   * The in-app browser closing reaches us as the app regaining visibility — the
   * single best moment to ask, because the payment has just finished one way or
   * the other.
   */
  useEffect(() => {
    if (!orderId) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setExhausted(false);
      setPollKey((k) => k + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [orderId]);

  const retry = useCallback(() => {
    triggerSoftHaptic();
    setExhausted(false);
    setPollKey((k) => k + 1);
  }, []);

  if (!orderId || isHidden) return null;

  const amount = info && info.amount_uzs > 0 ? formatUzs(info.amount_uzs) : null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      // Above MakePaymentModal (z-10000) and its inner drawer: on the main
      // payment path that modal is still open behind the gateway, and a status
      // strip nobody can see is worse than no strip at all.
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--mc-nav-h,0px)+env(safe-area-inset-bottom)+0.5rem)] z-[10050] px-3"
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-md items-start gap-2.5 rounded-mc-lg border border-mc-border bg-mc-surface p-3 shadow-[var(--mc-shadow-card)]">
        {!exhausted && (
          <Loader2
            className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-mc-brand motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-mc-text">
            {exhausted
              ? t('nbuWatch.slowTitle', "To'lov hali tasdiqlanmadi")
              : t('nbuWatch.waitTitle', "To'lov tekshirilmoqda")}
          </p>
          {/* Wraps rather than truncates. At 320px this row also carries the
              Retry button, and a clipped amount reads as a different number. */}
          <p className="text-[11px] font-medium leading-snug text-mc-text-3">
            {exhausted
              ? t('nbuWatch.slowHint', 'Keyinroq tekshiring yoki qaytadan urinib ko‘ring')
              : amount
                ? t('nbuWatch.waitHintAmount', '{{amount}} so‘m · bankda ochildi', { amount })
                : t('nbuWatch.waitHint', 'Bank oynasida yakunlang')}
          </p>

          {exhausted && (
            <button
              type="button"
              onClick={retry}
              className="mt-1 inline-flex min-h-[44px] items-center text-[12px] font-bold text-mc-brand active:scale-95"
            >
              {t('nbuWatch.retry', 'Tekshirish')}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label={t('nbuWatch.dismiss', 'Yopish')}
          className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-3 active:scale-95"
        >
          <X className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
