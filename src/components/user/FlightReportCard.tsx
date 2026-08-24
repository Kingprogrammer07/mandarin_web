import { Plane } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReportResponse } from '@/api/services/reportService';
import { formatUzsAmount, formatWeightKg } from '@/lib/format';

interface FlightReportCardProps {
  report: ReportResponse;
}

const MONTHS_UZ = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

/** "23 Avgust, 16:48" — see ShipmentCard for why this is not `toLocaleString`. */
function formatSentAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${MONTHS_UZ[date.getMonth()]}, ${hh}:${mm}`;
}

/**
 * The report summary at the top of a flight's detail screen.
 *
 * Two chips, matching the list: delivery state and, when money is still owed,
 * an unpaid marker. The dollar figure sits under the so'm one because the
 * client pays in so'm — the USD total is the reference the warehouse quoted,
 * not the amount due.
 */
export function FlightReportCard({ report }: FlightReportCardProps) {
  const { t } = useTranslation();

  const sentAt = formatSentAt(report.is_sent_web_date);
  const remaining = Math.max(0, (report.expected_amount ?? 0) - (report.paid_amount ?? 0));
  const amount = report.total_price_uzs || report.expected_amount || 0;

  const stateLabel = report.is_taken_away
    ? t('reports.takenAway', 'Olib ketilgan')
    : t('reports.statusNew', 'Yangi');

  return (
    <div className="px-4">
      <div className="rounded-mc-lg border border-mc-border bg-mc-surface p-3 shadow-[var(--mc-shadow-card)]">
        <div className="flex items-start gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-mc-md
                       bg-mc-brand-soft text-mc-brand"
            aria-hidden="true"
          >
            <Plane className="h-[22px] w-[22px]" strokeWidth={2} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[17px] font-extrabold leading-tight text-mc-text">
                {t('reports.cargoReport', 'Yuk hisoboti')}
              </span>
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5
                            text-[11px] font-bold ${
                              report.is_taken_away
                                ? 'border-mc-border bg-mc-surface-2 text-mc-text-2'
                                : 'border-mc-warn/25 bg-mc-warn-soft text-mc-warn'
                            }`}
              >
                {stateLabel}
              </span>
              {remaining > 0 && (
                <span
                  className="inline-flex shrink-0 items-center rounded-full border
                             border-mc-danger/25 bg-mc-danger-soft px-2 py-0.5
                             text-[11px] font-bold text-mc-danger"
                >
                  {t('reports.status.unpaid')}
                </span>
              )}
            </div>
            {sentAt && (
              <p className="mt-0.5 text-[12px] font-medium text-mc-text-2">{sentAt}</p>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-stretch gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-mc-text-2">
              {t('reports.weight', 'Og‘irligi')}
            </p>
            <p className="mt-0.5 truncate text-[16px] font-extrabold text-mc-text tabular-nums">
              {formatWeightKg(report.total_weight)}
              <span className="ml-1 text-[11px] font-bold text-mc-text-2">
                {t('reports.kg', 'kg')}
              </span>
            </p>
          </div>

          <span className="w-px shrink-0 bg-mc-border" aria-hidden="true" />

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-mc-text-2">
              {t('reports.totalPrice', 'To‘lov summasi')}
            </p>
            <p className="mt-0.5 truncate text-[16px] font-extrabold text-mc-danger tabular-nums">
              {formatUzsAmount(amount)}
              <span className="ml-1 text-[11px] font-bold">
                {t('home.summary.currency', "so'm")}
              </span>
            </p>
            {report.total_price_usd > 0 && (
              <p className="mt-0.5 truncate text-[12px] font-medium text-mc-text-3 tabular-nums">
                ${report.total_price_usd.toFixed(2)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
