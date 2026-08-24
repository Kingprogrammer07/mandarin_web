import { ArrowRight, CheckCircle2, PenSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { triggerSoftHaptic } from '@/utils/haptics';

interface FlightActionDockProps {
  /** Every report row in this flight has been collected. */
  isTakenAway: boolean;
  /** Outstanding balance across the flight. */
  remaining: number;
  onPay: () => void;
  /** Absent when the app shell has nowhere to send a delivery request. */
  onDeliveryRequest?: () => void;
}

/**
 * Sticky action bar for the flight detail screen.
 *
 * Three states, not one. The design shows only "To'lov qilish", but a client
 * who has already paid needs the delivery-request route from exactly here, and
 * a collected flight needs neither — dropping the other two would leave paying
 * clients with no way to ask for their cargo.
 *
 * Sits above the tab bar rather than over it: `--mc-nav-h` plus the safe-area
 * inset is the same clearance App.tsx pads content by.
 */
export function FlightActionDock({
  isTakenAway,
  remaining,
  onPay,
  onDeliveryRequest,
}: FlightActionDockProps) {
  const { t } = useTranslation();

  const hasDebt = remaining > 0;
  if (isTakenAway && !hasDebt) {
    return (
      <div className="fixed inset-x-0 bottom-[calc(var(--mc-nav-h)+env(safe-area-inset-bottom))] z-30">
        <div className="mx-auto max-w-lg px-4 pb-3">
          <div
            className="flex items-center justify-center gap-2 rounded-mc-lg border
                       border-mc-success/25 bg-mc-success/12 py-3 text-[14px]
                       font-bold text-mc-success"
          >
            <CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
            {t('reports.takenAway', 'Olib ketilgan')}
          </div>
        </div>
      </div>
    );
  }

  const isPay = hasDebt;
  const handler = isPay ? onPay : onDeliveryRequest;
  if (!handler) return null;

  const Icon = isPay ? ArrowRight : PenSquare;

  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--mc-nav-h)+env(safe-area-inset-bottom))] z-30">
      {/* Fades the list out under the dock instead of letting a card end
          abruptly behind it. */}
      <div
        className="h-6 bg-gradient-to-t from-mc-bg to-transparent"
        aria-hidden="true"
      />
      <div className="bg-mc-bg px-4 pb-3">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={() => {
              triggerSoftHaptic();
              handler();
            }}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-mc-lg
                       bg-gradient-to-r from-mc-brand to-mc-brand-strong px-4
                       text-[16px] font-extrabold text-mc-on-brand
                       shadow-[var(--mc-shadow-cta)] transition-transform duration-150
                       active:scale-[0.98]"
          >
            <span className="flex-1 text-center">
              {isPay
                ? t('reports.payAll', "Barchasiga to'lov qilish")
                : t('reports.requestDelivery', 'Zayafka qoldirish')}
            </span>
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                         bg-mc-on-brand/20"
              aria-hidden="true"
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
