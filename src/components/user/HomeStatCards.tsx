import { CreditCard, Package, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatUzs, formatUzsAmount } from '@/lib/format';
import { triggerSoftHaptic } from '@/utils/haptics';

export interface HomeSummary {
  /** Cargo registered but not yet arrived at the Tashkent warehouse. */
  activeCargoCount: number;
  /** Everything the client still owes, across all flights. */
  unpaidTotal: number;
  /** How many flights that total is spread over. */
  unpaidFlightCount: number;
}

interface HomeStatCardsProps {
  summary?: HomeSummary;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onActiveCargoClick: () => void;
  onUnpaidClick: () => void;
}

/**
 * Step the value down as the number grows.
 *
 * Two tiles share a phone width, which leaves about 110px for the text column.
 * A sum in the millions does not fit there at heading size, and truncating the
 * amount is the one thing this tile must never do — the digits are the whole
 * message. Shrinking the type keeps it whole instead.
 */
function amountSizeClass(formatted: string): string {
  // uz-UZ groups with U+00A0, so a hundred-million sum is 11 characters:
  // "999 999 999". Measured against the ~110px text column at Manrope's
  // tabular advance, 13px clears it with room. The 11px tier is a backstop for
  // anything wider still — a longer unit string in another locale, or a
  // fallback face with wider digits — so the number always survives whole.
  if (formatted.length > 11) return 'text-[11px]';
  if (formatted.length > 9) return 'text-[13px]';
  if (formatted.length > 7) return 'text-[15px]';
  return 'text-[16px]';
}

/**
 * One tile: icon on the left, label / value / caption stacked beside it.
 *
 * No chevron. The design has one, but reserving its column left too little
 * room for the amount, and the whole tile is already a button whose
 * `aria-label` says where it leads — so the arrow was costing real width to
 * repeat something the control already communicates.
 */
function StatTile({
  tone,
  Icon,
  title,
  caption,
  onClick,
  label,
  children,
}: {
  tone: 'brand' | 'danger';
  Icon: typeof Package;
  title: string;
  caption: string;
  onClick?: () => void;
  label?: string;
  children: React.ReactNode;
}) {
  const isBrand = tone === 'brand';
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      {...(onClick
        ? {
            type: 'button' as const,
            onClick: () => {
              triggerSoftHaptic();
              onClick();
            },
            'aria-label': label,
          }
        : {})}
      className={`flex min-h-[68px] w-full items-center gap-2 rounded-mc-lg border p-2.5
                  text-left transition-transform duration-150
                  ${onClick ? 'active:scale-[0.985]' : ''}
                  ${
                    isBrand
                      ? 'bg-mc-brand-soft border-mc-brand/10'
                      : 'bg-mc-danger-soft border-mc-danger/10'
                  }`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-mc-sm bg-mc-surface/70"
        aria-hidden="true"
      >
        <Icon
          className={`h-[18px] w-[18px] ${isBrand ? 'text-mc-brand' : 'text-mc-danger'}`}
          strokeWidth={2}
        />
      </span>

      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="block truncate text-[11px] font-medium text-mc-text-2">
          {title}
        </span>
        {children}
        <span className="block truncate text-[10px] font-medium text-mc-text-3">
          {caption}
        </span>
      </span>
    </Tag>
  );
}

function SkeletonCard() {
  return (
    <div className="h-[68px] animate-pulse rounded-mc-lg border border-mc-border bg-mc-surface-2" />
  );
}

/**
 * The two summary tiles: cargo in transit, and money owed.
 *
 * They are the only place on the home screen that answers "is anything waiting
 * for me?", so they carry all three async states rather than collapsing to
 * nothing on failure — a silently empty tile reads as "you owe nothing", which
 * is the most expensive thing this screen could get wrong.
 */
export function HomeStatCards({
  summary,
  isLoading,
  isError,
  onRetry,
  onActiveCargoClick,
  onUnpaidClick,
}: HomeStatCardsProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2.5 px-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="px-4">
        <div
          className="flex items-center justify-between gap-3 rounded-mc-lg border
                     border-mc-border bg-mc-surface p-2.5"
          role="alert"
        >
          <p className="text-[12px] font-medium text-mc-text-2">
            {t('home.summary.error', "Ma'lumotni yuklab bo'lmadi")}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="flex h-10 items-center gap-1.5 rounded-mc-sm bg-mc-surface-2 px-3
                       text-[12px] font-bold text-mc-text"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            {t('common.retry', 'Qayta urinish')}
          </button>
        </div>
      </div>
    );
  }

  const hasDebt = summary.unpaidTotal > 0;
  const amount = formatUzsAmount(summary.unpaidTotal);

  return (
    <div className="grid grid-cols-2 gap-2.5 px-4">
      <StatTile
        tone="brand"
        Icon={Package}
        title={t('home.summary.activeTitle', 'Faol yuklar')}
        caption={t('home.summary.activeCaption', 'ta yuk harakatda')}
        onClick={onActiveCargoClick}
        label={t('home.summary.activeAria', {
          count: summary.activeCargoCount,
          defaultValue: `Faol yuklar: ${summary.activeCargoCount} ta`,
        })}
      >
        <span className="block text-[17px] font-extrabold leading-tight text-mc-brand tabular-nums">
          {summary.activeCargoCount}
        </span>
      </StatTile>

      <StatTile
        tone="danger"
        Icon={CreditCard}
        title={t('home.summary.unpaidTitle', "To'lov kutilmoqda")}
        caption={
          hasDebt
            ? t('home.summary.unpaidCaption', {
                count: summary.unpaidFlightCount,
                defaultValue: `${summary.unpaidFlightCount} ta yuk uchun`,
              })
            : t('home.summary.unpaidNone', 'Qarzdorlik yo‘q')
        }
        onClick={hasDebt ? onUnpaidClick : undefined}
        label={t('home.summary.unpaidAria', {
          amount: formatUzs(summary.unpaidTotal),
          defaultValue: `To'lov kutilmoqda: ${formatUzs(summary.unpaidTotal)}`,
        })}
      >
        {/* The unit is a quieter span so the digits keep the larger size, and
            `whitespace-nowrap` stops "so'm" dropping to its own line. */}
        <span
          className={`block whitespace-nowrap font-extrabold leading-tight text-mc-danger
                      tabular-nums ${amountSizeClass(amount)}`}
        >
          {amount}
          <span className="ml-0.5 text-[10px] font-bold">
            {t('home.summary.currency', "so'm")}
          </span>
        </span>
      </StatTile>
    </div>
  );
}
