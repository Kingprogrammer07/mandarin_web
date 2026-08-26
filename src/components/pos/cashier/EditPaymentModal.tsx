/**
 * Correcting a payment that has already been posted.
 *
 * Opened from a settled receipt, not from the history table, because the API
 * needs a `notification_id` and that is what a receipt IS. A cashier-log row
 * carries only a transaction id, so editing from there would mean resolving a
 * ledger row back to a notification first — which is exactly the five-layer
 * hand-off the old console did and the reason its edit path was unportable.
 *
 * The ledger is never mutated. An amount change appends compensating
 * `ClientPaymentEvent` rows server-side and recomputes the aggregate, so the
 * audit trail keeps both the original and the correction.
 *
 * `expected_current_amount` is an optimistic lock. Two cashiers looking at the
 * same receipt on two tills would otherwise each write their own correction
 * over the other's; the server answers the second one with STALE_AMOUNT.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronDown, Loader2, Save } from 'lucide-react';

import type { PaymentProvider } from '@/api/pos';
import type { PosNotificationItem } from '@/api/services/posNotificationService';
import { formatCurrencySum } from '@/lib/format';
import { PAYMENT_TYPES } from '@/pages/pos/components/utils';
import { normalizeNumber } from '@/utils/numberFormat';

/** Backend refusal codes, in the words a cashier can act on. */
const CODE_MESSAGES: Record<string, string> = {
  STALE_AMOUNT:
    'Boshqa kassir bu to‘lovni o‘zgartirdi. Yangilab, qayta urining.',
  NBU_EVENT_IMMUTABLE: 'NBU / onlayn to‘lovni tahrirlab bo‘lmaydi.',
  WALLET_FUNDED_NOT_EDITABLE:
    'Hamyondan to‘langan to‘lovni tahrirlab bo‘lmaydi.',
  AMBIGUOUS_MULTI_TX:
    'Bu reysda bir nechta tranzaksiya bor — bu yerdan tahrirlab bo‘lmaydi.',
  MIXED_PROVIDER_NOT_EDITABLE: 'Aralash to‘lov turlari — tahrirlab bo‘lmaydi.',
};

export interface EditPaymentSubmission {
  payment_type: PaymentProvider;
  note: string | null;
  /** Null for a note-only edit; the server then keeps the current total. */
  amount: number | null;
  expected_current_amount: number | null;
  force: boolean;
}

const FIELD =
  'h-11 w-full rounded-mc-sm border border-mc-border bg-mc-surface-2 px-2.5 text-[16px] font-semibold text-mc-text outline-none focus:border-mc-brand';
const LABEL = 'mb-1 block text-[12px] font-semibold text-mc-text-2';
const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function EditPaymentModal({
  item,
  isPending,
  errorCode,
  errorMessage,
  onSubmit,
  onClose,
}: {
  item: PosNotificationItem;
  isPending: boolean;
  /** Refusal code from the last attempt, if the server sent one. */
  errorCode: string | null;
  errorMessage: string | null;
  onSubmit: (submission: EditPaymentSubmission) => void;
  onClose: () => void;
}) {
  /**
   * The ledger figure, untouched.
   *
   * Rounding it would break two things at once. It is the compare-and-swap
   * value for `expected_current_amount`, so a 786,400.50 total sent as 786,401
   * never matches and the server answers STALE_AMOUNT — the modal would then
   * blame a colleague for a mismatch it created itself, on every attempt,
   * forever. And 352 of 4,308 debts in this system end in .5 so'm, so this is
   * the ordinary case, not an edge one.
   */
  const currentAmount = item.amount_paid ?? 0;
  const currentType = (item.payment_type ?? 'cash') as PaymentProvider;

  /**
   * Whether the stored provider is one the edit endpoint accepts.
   *
   * `pos_notifications.payment_type` also holds `online`, `nbu` and `wallet`,
   * none of which are in the request enum. Without an option for it the
   * controlled `<select>` would show "Naqd" while its value was still `online`
   * — the cashier reads a provider that is not what will be sent. The real
   * value gets a disabled option instead, and the server's refusal message
   * (NBU_EVENT_IMMUTABLE / WALLET_FUNDED_NOT_EDITABLE) explains the rest.
   */
  const isEditableType = PAYMENT_TYPES.some(({ id }) => id === currentType);

  const [amountInput, setAmountInput] = useState(
    String(Number(currentAmount.toFixed(2))),
  );
  const [paymentType, setPaymentType] = useState<PaymentProvider>(currentType);
  const [note, setNote] = useState('');

  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  /**
   * The server refused an amount decrease because the cargo has already left
   * the warehouse — lowering it now creates client debt. It will accept the
   * edit with `force`, but only deliberately, and the reason is what lands in
   * the audit trail.
   */
  const needsReason = errorCode === 'CARGO_ALREADY_TAKEN';

  /**
   * Two decimal places, never rounded to whole so'm.
   *
   * `Math.round` here is the documented 2026 incident in reverse: it would make
   * the true fractional total unreachable, so correcting a 786,400.50 payment
   * could only ever write 786,400 or 786,401 and flip a fully collected flight
   * to `partial` over half a so'm.
   */
  const parsedAmount = useMemo(() => {
    const raw = parseFloat(amountInput.replace(/\s/g, ''));
    return Number.isFinite(raw) ? Number(raw.toFixed(2)) : 0;
  }, [amountInput]);

  const amountValid = parsedAmount > 0;
  const amountChanged = amountValid && parsedAmount !== currentAmount;
  const typeChanged = paymentType !== currentType;
  const noteProvided = note.trim().length > 0;
  /**
   * A stored `online` / `nbu` / `wallet` provider is not in the request enum,
   * so it can never be sent. Posting it produces a FastAPI 422 before the
   * endpoint runs — a dead Save button, not the explanatory refusal this modal
   * would otherwise show. The old console guarded exactly this
   * (POSDashboard.tsx:1074); the rewrite dropped the guard and this restores
   * it, as a precondition rather than an error: the cashier has to choose a
   * real provider before anything can be saved.
   */
  const providerReady = isEditableType || typeChanged;
  const hasChange = amountChanged || typeChanged || noteProvided;

  /**
   * Synchronous re-entry guard.
   *
   * `isPending` only disables the button after React re-renders, and this
   * endpoint has no idempotency key and no row lock. The payment path already
   * carries the same guard for the same measured reason — four clicks in one
   * tick produced four POSTs.
   */
  const inFlightRef = useRef(false);
  useEffect(() => {
    // Released once the request settles, so a refused edit can be retried.
    // A ref write, not state — nothing re-renders because of this.
    if (!isPending) inFlightRef.current = false;
  }, [isPending]);

  const submit = (force: boolean) => {
    if (!amountValid || !providerReady) return;
    if (force && !noteProvided) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    // `amount` goes up whenever the type changed too, so the backend
    // re-attributes the cashier-log provider totals rather than leaving the old
    // provider's figure carrying this payment.
    const sendAmount = amountChanged || typeChanged || force;
    onSubmit({
      payment_type: paymentType,
      note: note.trim() || null,
      amount: sendAmount ? parsedAmount : null,
      // Always sent, even for a note-only edit. With it null the server takes
      // the legacy type-only path and writes over whatever another cashier had
      // just corrected, with no conflict raised.
      expected_current_amount: currentAmount,
      force,
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
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
  };

  const banner = needsReason
    ? null
    : errorCode
      ? (CODE_MESSAGES[errorCode] ?? errorMessage)
      : errorMessage;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-payment-title"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-mc-xl border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]"
      >
        <div className="space-y-3.5 p-5">
          <div>
            <h3
              id="edit-payment-title"
              className="text-[17px] font-extrabold text-mc-text"
            >
              To‘lovni tahrirlash
            </h3>
            <p className="mt-0.5 text-[12px] font-medium text-mc-text-2">
              {item.client_code} · {item.flight_name}
            </p>
            <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-mc-text-2">
              Hozirgi summa: {formatCurrencySum(currentAmount)}
            </p>
          </div>

          {banner && (
            <p
              role="alert"
              className="rounded-mc-sm border border-mc-danger/25 bg-mc-danger-soft px-3 py-2 text-[12px] font-semibold text-mc-danger"
            >
              {banner}
            </p>
          )}

          {!isEditableType && (
            <p className="rounded-mc-sm border border-mc-warn/25 bg-mc-warn-soft px-3 py-2 text-[12px] font-semibold text-mc-warn">
              Bu to‘lov “{item.payment_type}” turida yozilgan — bunday tur
              saqlanmaydi. Davom etish uchun quyidan haqiqiy to‘lov turini
              tanlang.
            </p>
          )}

          {needsReason && (
            <div className="rounded-mc-sm border border-mc-warn/30 bg-mc-warn-soft px-3 py-2.5">
              <p className="flex items-start gap-2 text-[12px] font-bold text-mc-warn">
                <AlertTriangle
                  className="mt-px h-4 w-4 shrink-0"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
                Yuk allaqachon olib ketilgan. Summani kamaytirish mijozda qarz
                hosil qiladi.
              </p>
              <p className="mt-1 text-[11px] font-medium text-mc-warn">
                Davom etish uchun quyida sabab yozing.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="edit-amount" className={LABEL}>
              Summa
            </label>
            <input
              id="edit-amount"
              ref={firstFieldRef}
              value={amountInput}
              onChange={(event) => {
                const normalized = normalizeNumber(event.target.value);
                if (normalized !== null) setAmountInput(normalized);
              }}
              inputMode="decimal"
              autoComplete="off"
              className={`${FIELD} tabular-nums`}
            />
            {!amountValid && (
              <p className="mt-1 text-[11px] font-semibold text-mc-danger">
                Summa noldan katta bo‘lishi kerak
              </p>
            )}
          </div>

          <div>
            <label htmlFor="edit-provider" className={LABEL}>
              To‘lov turi
            </label>
            <span className="relative flex items-center">
              <select
                id="edit-provider"
                value={paymentType}
                onChange={(event) =>
                  setPaymentType(event.target.value as PaymentProvider)
                }
                className={`${FIELD} appearance-none pr-8`}
              >
                {!isEditableType && (
                  <option value={currentType} disabled>
                    {(item.payment_type ?? '').toUpperCase()} — o‘zgartirib
                    bo‘lmaydi
                  </option>
                )}
                {PAYMENT_TYPES.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 h-4 w-4 text-mc-text-3"
                strokeWidth={2.2}
                aria-hidden="true"
              />
            </span>
          </div>

          <div>
            <label htmlFor="edit-note" className={LABEL}>
              {needsReason ? 'Sabab (majburiy)' : 'Izoh'}
            </label>
            <textarea
              id="edit-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                needsReason ? 'Nima uchun kamaytirilyapti?' : 'Tuzatish sababi...'
              }
              rows={2}
              maxLength={500}
              className="w-full resize-y rounded-mc-sm border border-mc-border bg-mc-surface-2 px-2.5 py-2 text-[16px] font-medium text-mc-text outline-none placeholder:text-[13px] placeholder:text-mc-text-3 focus:border-mc-brand"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] flex-1 rounded-mc-md border border-mc-border text-[13px] font-semibold text-mc-text-2 transition-transform active:scale-95"
            >
              Bekor
            </button>
            <button
              type="button"
              disabled={
                isPending ||
                !amountValid ||
                !providerReady ||
                (needsReason ? !noteProvided : !hasChange)
              }
              onClick={() => submit(needsReason)}
              className={`flex min-h-[44px] flex-[2] items-center justify-center gap-2 rounded-mc-md text-[13px] font-extrabold transition-transform active:scale-95 disabled:opacity-50 ${
                needsReason
                  ? 'bg-mc-danger text-mc-on-danger'
                  : 'bg-mc-brand text-mc-on-brand'
              }`}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
              )}
              {needsReason ? 'Tasdiqlab, saqlash' : 'Saqlash'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
