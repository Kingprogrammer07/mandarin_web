/**
 * The headline row: four narrow cards and one wide till card.
 *
 * Each narrow card is three stacked bands — icon + label, the value, then a
 * footer under a hairline. The footer is what makes the row scannable: the eye
 * lands on the number, and its provenance ("Xitoy manifesti", "Bugun · real
 * vaqt") sits in a fixed place instead of competing with it.
 *
 * The two flight cards carry weights from different sources and say so. An
 * arrived flight has been on the scale (exact). One still in transit has only
 * what the China manifest declared — shown with a `≈` and its coverage, because
 * a kilogram figure drawn from a third of the parcels is worse than none unless
 * the reader can see it is a third.
 */

import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Banknote,
  CalendarRange,
  CreditCard,
  PlaneLanding,
  PlaneTakeoff,
  TrendingDown,
  UserPlus,
  Wallet,
} from 'lucide-react';

import type { CashierLogSummary } from '@/api/pos';
import type {
  DashboardSummary,
  FlightVolumeSummary,
} from '@/api/services/adminDashboard';
import { formatUzs, formatUzsAmount, formatWeightKg } from '@/lib/format';

import { TileSkeleton } from './DashboardPrimitives';

type Tone = 'brand' | 'success' | 'warn' | 'danger' | 'neutral';

const TONE_CHIP: Record<Tone, string> = {
  brand: 'bg-mc-brand-soft text-mc-brand',
  success: 'bg-mc-success/12 text-mc-success',
  warn: 'bg-mc-warn-soft text-mc-warn',
  danger: 'bg-mc-danger-soft text-mc-danger',
  neutral: 'bg-mc-surface-2 text-mc-text-2',
};

/**
 * One narrow card. `footer` sits under a hairline so it never reads as part of
 * the number above it.
 */
function KpiCard({
  label,
  Icon,
  tone = 'brand',
  footer,
  children,
}: {
  label: string;
  Icon: LucideIcon;
  tone?: Tone;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // `min-w-0`: at one column the row's track is `auto`, whose minimum is this
    // card's min-content — and the flight-name and footer lines cannot wrap, so
    // a long tab name would size the card past the phone rather than ellipsing
    // inside it.
    <div className="flex min-h-[148px] min-w-0 flex-col rounded-mc-lg border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]">
      <div className="flex flex-1 flex-col px-3.5 pt-3.5">
        <div className="mb-2.5 flex items-start gap-2.5">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-md ${TONE_CHIP[tone]}`}
            aria-hidden="true"
          >
            <Icon className="h-[19px] w-[19px]" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1 pt-0.5 text-[12px] font-semibold leading-snug text-mc-text-2">
            {label}
          </span>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {footer && (
        <div className="mt-2 border-t border-mc-border px-3.5 py-2 text-[10px] font-medium text-mc-text-3">
          {/* Kept to one line: "Xitoy manifesti · 1234/5678 kod" wraps at
              four-digit counts, and a taller footer band on one card pushes
              that card's baseline out of line with the other three. */}
          {typeof footer === 'string' ? (
            <span className="block truncate" title={footer}>
              {footer}
            </span>
          ) : (
            footer
          )}
        </div>
      )}
    </div>
  );
}

function Unavailable({ onRetry }: { onRetry?: () => void }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[12px] font-bold text-mc-text-3">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        Yuklanmadi
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-[36px] items-center text-[11px] font-bold text-mc-brand active:scale-95"
        >
          Qayta urinish
        </button>
      )}
    </div>
  );
}

/**
 * Only real payment providers. `wallet` holds signed balance corrections rather
 * than money taken at the counter, and the backend already excludes it from
 * `summary.total`.
 */
const TILL_TILES: {
  key: keyof CashierLogSummary;
  label: string;
  Icon: LucideIcon;
  tone: Tone;
}[] = [
  { key: 'cash', label: 'Naqd', Icon: Banknote, tone: 'success' },
  { key: 'card', label: 'Karta', Icon: CreditCard, tone: 'brand' },
  { key: 'nbu', label: 'NBU', Icon: Wallet, tone: 'warn' },
];

function TillTile({
  label,
  value,
  Icon,
  tone,
}: {
  label: string;
  value: number;
  Icon: LucideIcon;
  tone: Tone;
}) {
  return (
    <div className="min-w-0 rounded-mc-md border border-mc-border bg-mc-surface-2 px-2.5 py-2">
      <span className="flex items-center gap-1.5">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] ${TONE_CHIP[tone]}`}
          aria-hidden="true"
        >
          <Icon className="h-3 w-3" strokeWidth={2.4} />
        </span>
        <span className="truncate text-[11px] font-semibold text-mc-text-2" title={label}>
          {label}
        </span>
      </span>
      {/* An eight-digit till total — a normal cash day — is wider than the
          tile in the 2x2 grid. It ellipses from `sm` up, where the card is wide
          enough that only a freak number overflows; below that the tile is
          ~103px and the unit was being eaten off the end of every amount, so
          the line wraps instead. Truncating a sum of money is the one place a
          `title` fallback is worth nothing on a phone. */}
      <p
        className="mt-1 break-words text-[15px] font-extrabold leading-tight tabular-nums text-mc-text sm:truncate"
        title={`${label}: ${formatUzs(value)}`}
      >
        {formatUzsAmount(value)}
        {/* `nowrap` on the unit alone: the wrap above may drop it to its own
            line, but Chrome will otherwise take the break opportunity the
            typographic apostrophe offers and print "so" over "m". */}
        <span className="ml-1 whitespace-nowrap text-[10px] font-semibold text-mc-text-3">
          so‘m
        </span>
      </p>
    </div>
  );
}

export function KpiRow({
  summary,
  summaryLoading,
  summaryError,
  onSummaryRetry,
  volume,
  volumeLoading,
  volumeError,
  onVolumeRetry,
  till,
  expenseTotal,
  tillLoading,
}: {
  summary: DashboardSummary | undefined;
  summaryLoading: boolean;
  summaryError: boolean;
  onSummaryRetry: () => void;
  volume: FlightVolumeSummary | undefined;
  volumeLoading: boolean;
  volumeError: boolean;
  onVolumeRetry: () => void;
  till: { summary: CashierLogSummary } | undefined;
  expenseTotal: number | null;
  tillLoading: boolean;
}) {
  const registeredToday = summary?.queues.registrations_today;
  const arrived = volume?.last_arrived;
  const transit = volume?.in_transit;

  return (
    // Four equal columns plus a wider fifth: the till card holds a 2x2 grid and
    // would crush its amounts at the same width as the others.
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[repeat(4,minmax(0,1fr))_1.4fr]">
      <KpiCard
        label="Bugun ro‘yxatdan o‘tganlar"
        Icon={UserPlus}
        tone="brand"
        footer={
          <span className="flex items-center gap-1.5">
            Bugun
            <span className="h-1.5 w-1.5 rounded-full bg-mc-success" aria-hidden="true" />
            darhol yangilanadi
          </span>
        }
      >
        {summaryLoading ? (
          <TileSkeleton />
        ) : summaryError || registeredToday === null || registeredToday === undefined ? (
          <Unavailable onRetry={onSummaryRetry} />
        ) : (
          <p className="text-[30px] font-extrabold leading-none tabular-nums text-mc-text">
            {registeredToday}
          </p>
        )}
      </KpiCard>

      <KpiCard
        label="Oxirgi kelgan reys"
        Icon={PlaneLanding}
        tone="success"
        footer={
          arrived ? `Omborda tortilgan · ${arrived.consignments} ta yuk` : undefined
        }
      >
        {volumeLoading ? (
          <TileSkeleton />
        ) : volumeError ? (
          <Unavailable onRetry={onVolumeRetry} />
        ) : !arrived ? (
          <p className="text-[12px] font-medium text-mc-text-3">Hali reys kelmagan</p>
        ) : (
          <>
            {/* A combined tab name ("M190-M191-2025") is wider than the
                card at the 5-column breakpoint. */}
            <p
              className="truncate text-[22px] font-extrabold leading-none text-mc-text"
              title={arrived.flight_name}
            >
              {arrived.flight_name}
            </p>
            <p className="mt-1 text-[16px] font-extrabold tabular-nums text-mc-success">
              {formatWeightKg(arrived.weight_kg)}
            </p>
          </>
        )}
      </KpiCard>

      <KpiCard
        label="Yo‘ldagi reys"
        Icon={PlaneTakeoff}
        tone="warn"
        footer={
          transit && transit.source === 'manifest'
            ? `Xitoy ro‘yxati bo‘yicha · ${transit.track_codes_with_weight}/${transit.track_codes_expected} trek kod`
            : transit
              ? `${transit.track_codes_expected} ta trek kod kutilmoqda`
              : undefined
        }
      >
        {volumeLoading ? (
          <TileSkeleton />
        ) : volumeError ? (
          <Unavailable onRetry={onVolumeRetry} />
        ) : !transit ? (
          <p className="text-[12px] font-medium text-mc-text-3">Yo‘lda reys yo‘q</p>
        ) : (
          <>
            <p
              className="truncate text-[22px] font-extrabold leading-none text-mc-text"
              title={transit.flight_name}
            >
              {transit.flight_name}
            </p>
            {transit.source === 'manifest' ? (
              <p className="mt-1 text-[16px] font-extrabold tabular-nums text-mc-warn">
                ≈ {formatWeightKg(transit.weight_kg)}
              </p>
            ) : (
              <p className="mt-1 text-[13px] font-semibold text-mc-text-3">
                Vazn hali ma’lum emas
              </p>
            )}
          </>
        )}
      </KpiCard>

      <KpiCard
        label="Shu oyda kelgan reyslar"
        Icon={CalendarRange}
        tone="neutral"
        footer={
          // The schedule table is a calendar somebody has to fill in, and in
          // practice it is not — so the planned figure only appears when it
          // actually carries data.
          volume && volume.month_scheduled > 0
            ? `Rejada · ${volume.month_scheduled} ta`
            : 'Omborda qabul qilingan'
        }
      >
        {volumeLoading ? (
          <TileSkeleton />
        ) : volumeError ? (
          <Unavailable onRetry={onVolumeRetry} />
        ) : (
          <p className="text-[30px] font-extrabold leading-none tabular-nums text-mc-text">
            {volume?.month_arrived ?? 0}
            <span className="ml-1.5 text-[13px] font-bold text-mc-text-3">ta reys</span>
          </p>
        )}
      </KpiCard>

      <div className="flex min-h-[148px] min-w-0 flex-col rounded-mc-lg border border-mc-border bg-mc-surface px-3.5 py-3.5 shadow-[var(--mc-shadow-card)] sm:col-span-2 xl:col-span-3 2xl:col-span-1">
        <h3 className="mb-2.5 text-[13px] font-extrabold tracking-tight text-mc-text">
          Kassa — bugungi kun
        </h3>
        {tillLoading ? (
          <div className="grid flex-1 grid-cols-2 gap-2">
            <TileSkeleton />
            <TileSkeleton />
          </div>
        ) : !till ? (
          <Unavailable />
        ) : (
          <>
            <div className="grid flex-1 grid-cols-2 gap-2">
              {TILL_TILES.map((tile) => (
                <TillTile
                  key={tile.key}
                  label={tile.label}
                  value={till.summary[tile.key] ?? 0}
                  Icon={tile.Icon}
                  tone={tile.tone}
                />
              ))}
              <TillTile
                label="Rasxod"
                value={expenseTotal ?? 0}
                Icon={TrendingDown}
                tone="danger"
              />
            </div>
            {expenseTotal !== null && (
              <p className="mt-2 flex items-center justify-between gap-2 border-t border-mc-border pt-2 text-[10px] font-semibold text-mc-text-2">
                {/* Named for exactly what it is. No cost of goods is in it, so
                    it is not profit — Statistics owns that number. */}
                <span className="min-w-0 truncate" title="Qolgan (kassa − rasxod)">
                  Qolgan (kassa − rasxod)
                </span>
                <span
                  className={`shrink-0 text-[12px] font-extrabold tabular-nums ${
                    till.summary.total - expenseTotal < 0
                      ? 'text-mc-danger'
                      : 'text-mc-success'
                  }`}
                >
                  {formatUzs(till.summary.total - expenseTotal)}
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
