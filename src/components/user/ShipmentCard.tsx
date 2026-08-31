import { ChevronRight, Plane } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ShipmentItem } from '@/api/services/shipmentService';
import { formatUzsAmount, formatWeightKg } from '@/lib/format';
import { triggerSoftHaptic } from '@/utils/haptics';

interface ShipmentCardProps {
  shipment: ShipmentItem;
  onOpen: () => void;
}

/** Where the cargo physically is. Three steps, because that is all the data
 *  can honestly support: listed in China, scanned into Tashkent, collected. */
const STAGES = 3;

const MONTHS_UZ = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

/**
 * "23 Avgust, 16:48".
 *
 * Hand-rolled rather than `toLocaleString`: the Telegram webview reports the
 * device locale, so a Russian phone would render an Uzbek screen's dates in
 * Russian.
 */
function formatMoment(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
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
 * Carries both names when they differ. The same shipment is written `M257` in
 * the China manifest and `M257-M258` in the billing, and a client who tracked
 * the parcel out of China would not otherwise recognise the row. The large
 * label is the billing one — that is what the payment screen and the bot's
 * messages use, so it is the name they can act on.
 */
export function ShipmentCard({ shipment, onOpen }: ShipmentCardProps) {
  const { t } = useTranslation();

  const reached = shipment.is_taken_away ? 3 : shipment.is_scanned ? 2 : 1;

  const stageLabel = shipment.is_taken_away
    ? t('shipments.stageCollected', 'Olib ketilgan')
    : shipment.is_scanned
      ? t('shipments.stageWarehouse', 'Toshkent omborida')
      : t('shipments.stageTransit', 'Yo‘lda');

  const stageTone = shipment.is_taken_away
    ? 'border-mc-border bg-mc-surface-2 text-mc-text-2'
    : shipment.is_scanned
      ? 'border-mc-success/25 bg-mc-success/12 text-mc-success'
      : 'border-mc-warn/25 bg-mc-warn-soft text-mc-warn';

  // A second chip only when money is still owed. A flight reaches the archive
  // on collection alone — 44% of collected flights in production still carry a
  // balance — so without this the debt would have no marker of its own.
  const hasDebt = (shipment.remaining_amount ?? 0) > 0;

  const amount =
    shipment.total_amount ??
    ((shipment.paid_amount ?? 0) + (shipment.remaining_amount ?? 0) || null);

  const moment = formatMoment(
    shipment.taken_away_date ?? shipment.scanned_at ?? shipment.last_update,
  );

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
            ? `${shipment.flight_name}, ${stageLabel}, ${t('reports.status.unpaid')}`
            : `${shipment.flight_name}, ${stageLabel}`
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
                {shipment.flight_name}
              </span>
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5
                            text-[11px] font-bold ${stageTone}`}
              >
                {stageLabel}
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

            {shipment.manifest_flight_name && (
              <span className="mt-0.5 block truncate text-[11px] font-semibold text-mc-text-3">
                {t('shipments.manifestName', 'Xitoyda: {{name}}', {
                  name: shipment.manifest_flight_name,
                })}
              </span>
            )}

            {moment && (
              <span className="mt-0.5 block text-[12px] font-medium text-mc-text-2">
                {moment}
              </span>
            )}
          </span>

          <ChevronRight
            className="mt-1 h-4 w-4 shrink-0 text-mc-text-3"
            aria-hidden="true"
          />
        </div>

        {/* Three segments rather than a row of labels: at 320px a worded
            timeline either wraps to three lines or truncates to nothing. */}
        <div
          className="mt-3 flex items-center gap-1"
          role="img"
          aria-label={`${stageLabel}, ${reached}/${STAGES}`}
        >
          {Array.from({ length: STAGES }, (_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i < reached ? 'bg-mc-brand' : 'bg-mc-surface-2'
              }`}
            />
          ))}
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
              {formatWeightKg(shipment.total_weight)}
              <span className="ml-1 text-[11px] font-bold text-mc-text-2">
                {t('reports.kg', 'kg')}
              </span>
            </span>
          </span>

          <span className="w-px shrink-0 bg-mc-border" aria-hidden="true" />

          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium text-mc-text-2">
              {amount === null
                ? t('shipments.parcels', 'Yuklar')
                : t('reports.totalPrice', 'To‘lov summasi')}
            </span>
            <span
              className={`mt-0.5 block truncate text-[15px] font-extrabold tabular-nums ${
                amount === null ? 'text-mc-text' : 'text-mc-danger'
              }`}
            >
              {/* No report yet means no price exists — showing "0 so'm" would
                  read as "nothing to pay", which is a different claim. */}
              {amount === null ? shipment.total_count : formatUzsAmount(amount)}
              <span className="ml-1 text-[11px] font-bold">
                {amount === null
                  ? t('shipments.pcs', 'ta')
                  : t('home.summary.currency', "so'm")}
              </span>
            </span>
          </span>
        </div>
      </button>
    </div>
  );
}
