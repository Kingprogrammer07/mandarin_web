import { ChevronRight, Plane } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReportFlightSummary } from '@/api/services/reportService';
import { formatUzsAmount, formatWeightKg } from '@/lib/format';
import { triggerSoftHaptic } from '@/utils/haptics';

interface ShipmentCardProps {
  flight: ReportFlightSummary;
  onOpen: () => void;
}

/** Tone per payment status, mirroring the labels the list has always used. */
const STATUS_TONE: Record<ReportFlightSummary['payment_status'], string> = {
  new: 'border-mc-warn/25 bg-mc-warn-soft text-mc-warn',
  partial: 'border-mc-warn/25 bg-mc-warn-soft text-mc-warn',
  paid: 'border-mc-success/25 bg-mc-success/12 text-mc-success',
  taken_away: 'border-mc-border bg-mc-surface-2 text-mc-text-2',
};

const MONTHS_UZ = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

/**
 * "23 Avgust, 16:48".
 *
 * Hand-formatted rather than `toLocaleString`: `uz-UZ` month names are not
 * carried by every engine this app runs in — the Telegram WebView on older
 * Android falls back to English — and a date that changes language between
 * devices reads as a bug.
 */
function formatSentAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getDate();
  const month = MONTHS_UZ[date.getMonth()];
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month}, ${hh}:${mm}`;
}

/**
 * One flight in the client's cargo list.
 *
 * The status chip reuses the four states the flight list has always shown
 * (`payment_status`) rather than inventing a delivery stage — the list is built
 * from `flight_cargos`, which carries no transit information of its own.
 */
export function ShipmentCard({ flight, onOpen }: ShipmentCardProps) {
  const { t } = useTranslation();

  const statusLabel = {
    new: t('reports.statusNew', 'Yangi'),
    partial: t('reports.statusPartial', 'Qisman'),
    paid: t('reports.statusPaid', "To'langan"),
    taken_away: t('reports.statusTakenAway', 'Olib ketilgan'),
  }[flight.payment_status];

  const sentAt = formatSentAt(flight.last_sent_web_date);
  const amount = flight.expected_amount || flight.paid_amount + flight.remaining_amount;

  // Second chip, only when there is something left to pay. A collected flight
  // moves to the archive on collection alone, so without this the outstanding
  // balance would have no marker of its own — and 44% of collected flights in
  // production still carry one.
  const hasDebt = (flight.remaining_amount ?? 0) > 0;

  return (
    <div className="px-4">
      <button
        type="button"
        onClick={() => {
          triggerSoftHaptic();
          onOpen();
        }}
        aria-label={
          hasDebt
            ? `${flight.flight_name}, ${statusLabel}, ${t('reports.status.unpaid')}`
            : `${flight.flight_name}, ${statusLabel}`
        }
        className="w-full rounded-mc-lg border border-mc-border bg-mc-surface p-3 text-left
                   shadow-[var(--mc-shadow-card)] transition-transform duration-150
                   active:scale-[0.99]"
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-mc-md
                       bg-mc-brand-soft text-mc-brand"
            aria-hidden="true"
          >
            <Plane className="h-[22px] w-[22px]" strokeWidth={2} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[17px] font-extrabold leading-tight text-mc-text">
                {flight.flight_name}
              </span>
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5
                            text-[11px] font-bold ${STATUS_TONE[flight.payment_status]}`}
              >
                {statusLabel}
              </span>
              {hasDebt && (
                <span
                  className="inline-flex shrink-0 items-center rounded-full border
                             border-mc-danger/25 bg-mc-danger-soft px-2 py-0.5
                             text-[11px] font-bold text-mc-danger"
                >
                  {t('reports.status.unpaid')}
                </span>
              )}
            </span>
            {sentAt && (
              <span className="mt-0.5 block text-[12px] font-medium text-mc-text-2">
                {sentAt}
              </span>
            )}
          </span>

          <ChevronRight
            className="mt-1 h-4 w-4 shrink-0 text-mc-text-3"
            aria-hidden="true"
          />
        </div>

        {/* Weight and amount, split by a hairline as in the design. Both
            columns are min-w-0 so a long sum shrinks its own column instead of
            pushing the divider off the card. */}
        <div className="mt-3 flex items-stretch gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium text-mc-text-2">
              {t('reports.weight', 'Og‘irligi')}
            </span>
            <span className="mt-0.5 block truncate text-[15px] font-extrabold text-mc-text tabular-nums">
              {formatWeightKg(flight.total_weight)}
              <span className="ml-1 text-[11px] font-bold text-mc-text-2">
                {t('reports.kg', 'kg')}
              </span>
            </span>
          </span>

          <span className="w-px shrink-0 bg-mc-border" aria-hidden="true" />

          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium text-mc-text-2">
              {t('reports.totalPrice', 'To‘lov summasi')}
            </span>
            <span className="mt-0.5 block truncate text-[15px] font-extrabold text-mc-danger tabular-nums">
              {formatUzsAmount(amount)}
              <span className="ml-1 text-[11px] font-bold">
                {t('home.summary.currency', "so'm")}
              </span>
            </span>
          </span>
        </div>
      </button>
    </div>
  );
}
