/**
 * The last screen before money is posted.
 *
 * Shared by the old `/pos` console and the new `/kassa` one, so a change here
 * lands on the live till. Two things were wrong and both are fixed rather than
 * worked around, because both are reachable during an ordinary shift:
 *
 * 1. The Enter shortcut was bound to `window`. Nothing moved focus into the
 *    dialog, so focus stayed on whatever was behind it — on the new screen,
 *    the client-search input. A cashier pressing Enter to submit that search,
 *    or to dismiss the iOS keyboard, posted a real payment without reading
 *    this panel. Focus now lands on the confirm button and the shortcut is
 *    plain native button activation: pressing Enter on open still confirms
 *    (the counter's speed is unchanged), but an Enter meant for something else
 *    can no longer reach it, because focus is no longer out there.
 *
 * 2. It was built from raw palette classes on an otherwise tokenised screen,
 *    and the confirm button was `text-white` on a green gradient — about
 *    2.5:1, on the one control that commits money.
 */

import { useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { CheckCheck, Loader2, Package } from 'lucide-react';

import { formatCurrencySum } from '@/lib/format';
import { translatePayment, formatCard } from './utils';
import type { PaymentProvider, CardWithBalance } from '@/api/pos';
import type { UnpaidCargoItem } from '@/api/verification';

export interface ConfirmPayload {
  cargos: UnpaidCargoItem[];
  amounts: number[];
  paymentType: PaymentProvider;
  useWallet: boolean;
  received: number;
  walletDeduction: number;
  selectedCard: CardWithBalance | null;
  clientCode: string;
  /**
   * Idempotency key for this confirmation, minted when the payload is built.
   *
   * It lives on the payload rather than being generated at submit time so that
   * every retry of the same confirmation reuses it — a double-click or a
   * resent POST must not become a second ledger row.
   */
  idempotencyKey: string;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function ConfirmModal({
  payload,
  onConfirm,
  onCancel,
  isPending,
}: {
  payload: ConfirmPayload;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const netCash = payload.received - payload.walletDeduction;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  /**
   * Move focus in on mount and give it back on close.
   *
   * This is what makes the Enter shortcut safe: while the dialog is open there
   * is no focused control behind it for a stray keystroke to reach.
   */
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  /** Escape closes; Tab cycles inside the panel instead of walking out of it. */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onCancel],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-payment-title"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-mc-xl border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]"
      >
        <div className="h-1 bg-mc-brand" />
        <div className="space-y-4 p-5">
          <div>
            <h3
              id="confirm-payment-title"
              className="text-[17px] font-extrabold text-mc-text"
            >
              To‘lovni tasdiqlash
            </h3>
            <p className="text-[12px] font-semibold tabular-nums text-mc-text-2">
              {payload.clientCode}
            </p>
          </div>

          <div className="overflow-hidden rounded-mc-md bg-mc-surface-2">
            {payload.cargos.map((cargo, index) => (
              <div
                key={cargo.cargo_id}
                className="flex items-center justify-between gap-2 border-b border-mc-border px-4 py-2.5 last:border-b-0"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Package
                    className="h-3.5 w-3.5 shrink-0 text-mc-text-3"
                    aria-hidden="true"
                  />
                  <span className="truncate text-[12px] font-semibold text-mc-text-2">
                    #{cargo.row_number} · {cargo.flight_name}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-bold tabular-nums text-mc-text">
                  {formatCurrencySum(payload.amounts[index] ?? 0)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[12px]">
              <span className="text-mc-text-2">To‘lov usuli</span>
              <span className="font-semibold text-mc-text">
                {translatePayment(payload.paymentType)}
              </span>
            </div>
            {payload.walletDeduction > 0 && (
              <div className="flex justify-between text-[12px]">
                <span className="text-mc-success">Hamyon</span>
                <span className="font-semibold tabular-nums text-mc-success">
                  −{formatCurrencySum(payload.walletDeduction)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-mc-border pt-2 text-[14px] font-extrabold">
              <span className="text-mc-text-2">Naqd/karta:</span>
              <span className="tabular-nums text-mc-brand">
                {formatCurrencySum(netCash > 0 ? netCash : payload.received)}
              </span>
            </div>
          </div>

          {payload.paymentType === 'card' && payload.selectedCard && (
            <div className="rounded-mc-md border border-mc-border bg-mc-surface-2 p-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-mc-text-2">
                Bank kartasi
              </p>
              <p className="text-[15px] font-extrabold tracking-widest tabular-nums text-mc-text">
                {formatCard(payload.selectedCard.card_number)}
              </p>
              <p className="mt-0.5 text-[11px] text-mc-text-2">
                {payload.selectedCard.full_name}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] flex-1 rounded-mc-md border border-mc-border text-[13px] font-semibold text-mc-text-2 transition-transform active:scale-95"
            >
              Bekor
            </button>
            <motion.button
              ref={confirmRef}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onConfirm}
              disabled={isPending}
              className="flex min-h-[44px] flex-[2] items-center justify-center gap-2 rounded-mc-md bg-mc-success text-[14px] font-extrabold text-mc-on-success disabled:opacity-60"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCheck className="h-4 w-4" aria-hidden="true" />
              )}
              HA, TO‘LASH
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
