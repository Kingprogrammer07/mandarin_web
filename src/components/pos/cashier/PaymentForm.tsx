/**
 * "To'lov ma'lumotlari" — how much arrived, how, and against what.
 *
 * Laid out as the mockup's narrow labelled column: flight, amount, payment
 * type, note, then the two actions. The cargo rows the flight resolves to, the
 * wallet and the card picker are not in the mockup because the mockup treats a
 * flight as one line — but they decide where real money is booked, so they sit
 * where they belong in the sequence rather than being dropped.
 *
 * Native `<select>`, not a custom listbox. On iPhone it opens the system wheel,
 * which is a better control at a counter than anything rendered in the page,
 * and it needs no portal and no z-index fight with the app's overlays.
 *
 * The card picker only appears for `card`, because "which card" is a question
 * only that provider asks; showing it for cash was a field the cashier had to
 * read past on every payment.
 */

import { ChevronDown, CreditCard, Loader2, Pencil, Wallet } from 'lucide-react';

import { formatCurrencySum } from '@/lib/format';
import { formatCard, PAYMENT_TYPES } from '@/pages/pos/components/utils';
import { triggerSoftHaptic } from '@/utils/haptics';
import { normalizeNumber } from '@/utils/numberFormat';

import { ALL_FLIGHTS_VALUE } from './useCashierPayment';
import type {
  CardWithBalance,
  FlightGroup,
  PaymentProvider,
} from './useCashierPayment';

/* `--mc-text-3` is documented at 3.25:1 on surface — below the 4.5:1 AA floor,
   and 11px is nowhere near the large-text exemption. It is for the 10px
   uppercase meta in the type scale, not for the label of a control that
   decides where money goes. */
const LABEL = 'mb-1 block text-[12px] font-semibold text-mc-text-2';
/* 44px, not 40: these four controls decide how much is taken and where it is
   booked, and a missed tap at the counter lands on the amount field.
   16px font on every one — below that iOS zooms the page on focus and does not
   zoom back, leaving the whole till magnified. */
const FIELD =
  'h-11 w-full rounded-mc-sm border border-mc-border bg-mc-surface-2 px-2.5 text-[16px] font-semibold text-mc-text outline-none focus:border-mc-brand';

/**
 * Which option the flight dropdown should show for the current selection.
 *
 * Still derived rather than stored. The dropdown is now the only control that
 * sets the selection, so the two cannot disagree — but the selection is also
 * cleared from outside (a new client, a posted payment), and a stored value
 * would then name a flight nothing is selected on.
 */
function deriveFlightValue(
  groups: FlightGroup[],
  selectedIds: Set<number>,
  totalCargoCount: number,
): string {
  if (selectedIds.size === 0) return '';
  if (selectedIds.size === totalCargoCount && totalCargoCount > 0)
    return ALL_FLIGHTS_VALUE;
  const whole = groups.find(
    (group) =>
      group.items.length === selectedIds.size &&
      group.items.every((item) => selectedIds.has(item.cargo_id)),
  );
  return whole ? whole.flightName : '';
}

function SummaryRow({
  label,
  value,
  tone = 'muted',
}: {
  label: string;
  value: string;
  tone?: 'muted' | 'strong' | 'success' | 'warn';
}) {
  const valueTone = {
    muted: 'text-mc-text-2',
    strong: 'text-mc-text',
    success: 'text-mc-success',
    warn: 'text-mc-warn',
  }[tone];

  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="min-w-0 truncate text-[11px] font-medium text-mc-text-2">
        {label}
      </span>
      <span
        className={`shrink-0 text-[12px] font-extrabold tabular-nums ${valueTone}`}
      >
        {value}
      </span>
    </div>
  );
}

export function PaymentForm({
  groups,
  selectedIds,
  totalCargoCount,
  cargoLoading,
  cargoError,
  onRetryCargo,
  onSelectFlight,
  paymentType,
  onPaymentType,
  cards,
  cardsLoading,
  cardsError,
  onRetryCards,
  selectedCardId,
  onSelectCard,
  useWallet,
  onToggleWallet,
  walletBalance,
  walletDeduction,
  totalOwed,
  netAfterWallet,
  receivedInput,
  onReceivedInput,
  receivedAmount,
  change,
  shortfall,
  note,
  onNote,
  selectedCount,
  selectedWeight,
  isPaying,
  onSubmit,
  onOpenProfile,
}: {
  groups: FlightGroup[];
  selectedIds: Set<number>;
  totalCargoCount: number;
  cargoLoading: boolean;
  cargoError: boolean;
  onRetryCargo: () => void;
  onSelectFlight: (value: string) => void;
  paymentType: PaymentProvider;
  onPaymentType: (provider: PaymentProvider) => void;
  cards: CardWithBalance[];
  cardsLoading: boolean;
  cardsError: boolean;
  onRetryCards: () => void;
  selectedCardId: number | null;
  onSelectCard: (id: number | null) => void;
  useWallet: boolean;
  onToggleWallet: () => void;
  walletBalance: number;
  walletDeduction: number;
  totalOwed: number;
  netAfterWallet: number;
  receivedInput: string;
  onReceivedInput: (value: string) => void;
  receivedAmount: number;
  change: number;
  shortfall: number;
  note: string;
  onNote: (value: string) => void;
  selectedCount: number;
  selectedWeight: number;
  isPaying: boolean;
  onSubmit: () => void;
  onOpenProfile: () => void;
}) {
  const flightValue = deriveFlightValue(groups, selectedIds, totalCargoCount);
  const walletAvailable = walletBalance > 0;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="kassa-flight" className={LABEL}>
          Reys
        </label>
        {cargoLoading ? (
          <div className="h-10 animate-pulse rounded-mc-sm bg-mc-surface-2" />
        ) : cargoError ? (
          <div className="rounded-mc-sm border border-mc-danger/25 bg-mc-danger-soft px-2.5 py-2">
            <p className="text-[11px] font-semibold text-mc-danger">
              Yuklar ro‘yxati yuklanmadi
            </p>
            <button
              type="button"
              onClick={onRetryCargo}
              className="mt-0.5 min-h-[32px] text-[11px] font-bold text-mc-danger underline active:scale-95"
            >
              Qayta urinish
            </button>
          </div>
        ) : groups.length === 0 ? (
          <p className="rounded-mc-sm border border-mc-border bg-mc-surface-2 px-2.5 py-2.5 text-[11px] font-medium text-mc-text-3">
            To‘lanmagan yuk yo‘q
          </p>
        ) : (
          <span className="relative flex items-center">
            <select
              id="kassa-flight"
              value={flightValue}
              onChange={(event) => onSelectFlight(event.target.value)}
              className={`${FIELD} appearance-none pr-8`}
            >
              <option value="" disabled>
                Reysni tanlang
              </option>
              <option value={ALL_FLIGHTS_VALUE}>
                Barcha reyslar ({totalCargoCount} ta yuk)
              </option>
              {groups.map((group) => (
                <option key={group.flightName} value={group.flightName}>
                  {group.flightName} · {group.items.length} ta ·{' '}
                  {formatCurrencySum(group.totalAmount)}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 h-4 w-4 text-mc-text-3"
              strokeWidth={2.2}
              aria-hidden="true"
            />
          </span>
        )}
      </div>

      <div>
        <label htmlFor="kassa-received" className={LABEL}>
          Qabul qilinadigan summa
        </label>
        <span className="relative flex items-center">
          <input
            id="kassa-received"
            value={receivedInput}
            onChange={(event) => {
              // `replace(/[^\d.]/g, '')` keeps every dot, and a cashier typing
              // 1.500.000 with dots as thousands separators would then have
              // parseFloat read it as 1.5 — a 1,499,998.5 so'm shortfall booked
              // as client debt. normalizeNumber returns null for a second dot,
              // so the keystroke is dropped and the last valid value stands.
              const normalized = normalizeNumber(event.target.value);
              if (normalized !== null) onReceivedInput(normalized);
            }}
            placeholder="Summani kiriting"
            inputMode="decimal"
            autoComplete="off"
            className={`${FIELD} pr-12 tabular-nums placeholder:text-[13px] placeholder:font-medium placeholder:text-mc-text-3`}
          />
          <span
            className="pointer-events-none absolute right-2.5 text-[11px] font-semibold text-mc-text-3"
            aria-hidden="true"
          >
            so‘m
          </span>
        </span>
      </div>

      <div>
        <label htmlFor="kassa-provider" className={LABEL}>
          To‘lov turi
        </label>
        <span className="relative flex items-center">
          <select
            id="kassa-provider"
            value={paymentType}
            onChange={(event) => {
              const next = event.target.value as PaymentProvider;
              onPaymentType(next);
              // Leaving `card` must drop the card too. A card id left behind
              // would be sent with a cash payment and book it against a card
              // that took no money.
              if (next !== 'card') onSelectCard(null);
            }}
            className={`${FIELD} appearance-none pr-8`}
          >
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

      {paymentType === 'card' && (
        <div>
          <label htmlFor="kassa-card" className={LABEL}>
            Qaysi kartaga tushdi?
          </label>
          {cardsLoading ? (
            <div className="h-11 animate-pulse rounded-mc-sm bg-mc-surface-2" />
          ) : cardsError ? (
            /*
              A failed request must not read as "there are no cards". It sent
              the cashier to settings to add a card that already existed, while
              the payment they were taking could not be booked to any of them.
            */
            <div className="rounded-mc-sm border border-mc-danger/25 bg-mc-danger-soft px-2.5 py-2">
              <p className="text-[11px] font-semibold text-mc-danger">
                Kartalar ro‘yxati yuklanmadi
              </p>
              <button
                type="button"
                onClick={onRetryCards}
                className="mt-0.5 min-h-[32px] text-[11px] font-bold text-mc-danger underline active:scale-95"
              >
                Qayta urinish
              </button>
            </div>
          ) : cards.length === 0 ? (
            <p className="rounded-mc-sm border border-mc-warn/25 bg-mc-warn-soft px-2.5 py-2 text-[11px] font-semibold text-mc-warn">
              Karta ro‘yxati bo‘sh — sozlamalardan karta qo‘shing
            </p>
          ) : (
            <span className="relative flex items-center">
              <select
                id="kassa-card"
                value={selectedCardId ?? ''}
                onChange={(event) =>
                  onSelectCard(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                className={`${FIELD} appearance-none pr-8`}
              >
                <option value="" disabled>
                  Kartani tanlang
                </option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {formatCard(card.card_number)} · {card.full_name}
                    {card.is_active ? '' : ' · nofaol'}
                  </option>
                ))}
              </select>
              <CreditCard
                className="pointer-events-none absolute right-2.5 h-4 w-4 text-mc-text-3"
                strokeWidth={2.2}
                aria-hidden="true"
              />
            </span>
          )}
        </div>
      )}

      {/*
        Only rendered when there IS a balance to spend. A permanently disabled
        row saying "no funds in the wallet" is a line of dead weight in the
        middle of the money path — most clients have nothing there, and the
        control is only ever relevant to the ones who do.
      */}
      {walletAvailable && (
      <button
        type="button"
        role="switch"
        aria-checked={useWallet}
        onClick={() => {
          triggerSoftHaptic();
          onToggleWallet();
        }}
        className={`flex min-h-[44px] w-full items-center gap-2 rounded-mc-sm border px-2.5 py-2 text-left transition-colors ${
          useWallet
            ? 'border-mc-success/30 bg-mc-success/10'
            : 'border-mc-border bg-mc-surface-2'
        }`}
      >
        <Wallet
          className={`h-4 w-4 shrink-0 ${useWallet ? 'text-mc-success' : 'text-mc-text-3'}`}
          strokeWidth={2.2}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold text-mc-text">
            Hamyondan yechish
          </span>
          <span className="block truncate text-[11px] font-semibold tabular-nums text-mc-text-2">
            {formatCurrencySum(walletBalance)}
          </span>
        </span>
        <span
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
            useWallet ? 'bg-mc-success' : 'bg-mc-border'
          }`}
          aria-hidden="true"
        >
          {/* A fixed light knob, not a token: it rides on both the success fill
              and the neutral border fill, and must stay legible on either. */}
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#FFFFFF] shadow-sm transition-transform ${
              useWallet ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </span>
      </button>
      )}

      <div>
        <label htmlFor="kassa-note" className={LABEL}>
          Izoh
        </label>
        <textarea
          id="kassa-note"
          value={note}
          onChange={(event) => onNote(event.target.value)}
          placeholder="Izoh kiriting..."
          rows={2}
          maxLength={500}
          className="w-full resize-y rounded-mc-sm border border-mc-border bg-mc-surface-2 px-2.5 py-2 text-[16px] font-medium text-mc-text outline-none placeholder:text-[13px] placeholder:text-mc-text-3 focus:border-mc-brand"
        />
      </div>

      {selectedCount > 0 && (
        <div className="space-y-1 rounded-mc-sm border border-mc-border bg-mc-surface-2 px-2.5 py-2">
          <SummaryRow
            label={`${selectedCount} ta yuk · ${selectedWeight.toFixed(1)} kg`}
            value={formatCurrencySum(totalOwed)}
            tone="strong"
          />
          {walletDeduction > 0 && (
            <SummaryRow
              label="Hamyondan"
              value={`−${formatCurrencySum(walletDeduction)}`}
              tone="success"
            />
          )}
          <SummaryRow
            label="To‘lanishi kerak"
            value={formatCurrencySum(netAfterWallet)}
          />
          {change > 0 && (
            <SummaryRow
              label="Ortiqcha — hamyonga qo‘shiladi"
              value={`+${formatCurrencySum(change)}`}
              tone="success"
            />
          )}
          {shortfall > 0 && (
            <SummaryRow
              label="Yetishmayapti — qarz qoladi"
              value={formatCurrencySum(shortfall)}
              tone="warn"
            />
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            triggerSoftHaptic();
            onOpenProfile();
          }}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-mc-sm border border-mc-brand/40 px-2 text-[12px] font-bold text-mc-brand transition-transform active:scale-95"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
          Hisobni tahrirlash
        </button>

        <button
          type="button"
          disabled={selectedCount === 0 || isPaying}
          onClick={() => {
            triggerSoftHaptic();
            onSubmit();
          }}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-mc-sm bg-mc-success px-2 text-[12px] font-extrabold text-mc-on-success transition-transform active:scale-95 disabled:opacity-50"
        >
          {isPaying ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} />
          ) : null}
          {selectedCount === 0
            ? 'Yuk tanlang'
            : `Tasdiqlash · ${formatCurrencySum(receivedAmount)}`}
        </button>
      </div>
    </div>
  );
}
