import { useTranslation } from 'react-i18next';
import { formatUzsAmount } from '@/lib/format';

interface PaymentSummaryCardProps {
  total: number;
  remaining: number;
  /** Omitted when nothing has been paid yet — a zero row adds no information. */
  paid?: number;
}

function Row({ label, value, tone }: { label: string; value: string; tone: 'text' | 'danger' }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[13px] font-medium text-mc-text-2">{label}</span>
      <span
        className={`shrink-0 text-[14px] font-extrabold tabular-nums ${
          tone === 'danger' ? 'text-mc-danger' : 'text-mc-text'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Totals for the flight.
 *
 * The outstanding balance is the only figure in danger colour — the gross total
 * is neutral information, and colouring both would make the one number the
 * client has to act on indistinguishable from the one they do not.
 */
export function PaymentSummaryCard({ total, remaining, paid }: PaymentSummaryCardProps) {
  const { t } = useTranslation();
  const unit = t('home.summary.currency', "so'm");

  return (
    <div className="px-4">
      <div className="rounded-mc-lg border border-mc-border bg-mc-surface p-3 shadow-[var(--mc-shadow-card)]">
        <h2 className="mb-1 text-[14px] font-extrabold text-mc-text">
          {t('reports.paymentInfo', 'To‘lov ma‘lumotlari')}
        </h2>
        <Row
          label={t('reports.totalAmountShort', 'Jami')}
          value={`${formatUzsAmount(total)} ${unit}`}
          tone="text"
        />
        {paid != null && paid > 0 && (
          <Row
            label={t('reports.paidAmountShort', 'To‘langan')}
            value={`${formatUzsAmount(paid)} ${unit}`}
            tone="text"
          />
        )}
        <Row
          label={t('reports.remainingAmountShort', 'Qoldiq')}
          value={`${formatUzsAmount(remaining)} ${unit}`}
          tone={remaining > 0 ? 'danger' : 'text'}
        />
      </div>
    </div>
  );
}
