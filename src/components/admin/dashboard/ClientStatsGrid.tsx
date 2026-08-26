/**
 * The client base at a glance.
 *
 * Two labels here deliberately do not match what a mockup might call them,
 * because the backend definitions are different from the obvious reading:
 *
 * * "passiv" is **60 days**, not one month — that is the threshold the existing
 *   query uses (`client_stats.py`), and relabelling it would make the tile lie.
 * * `zombie_clients` counts clients who have **never ordered any cargo**, not
 *   clients inactive for six months. It is a different set entirely.
 *
 * VIP is a frozen threshold rather than a percentile: the top 5% of any
 * population is always 5% of it, so that version could never move no matter
 * what customers did. The bar is shown in the caption so the number is
 * auditable.
 */

import {
  Crown,
  Info,
  RotateCw,
  ShoppingBag,
  UserMinus,
  UserPlus,
  Users,
  UserX,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ClientStatsResponse } from '@/api/services/stats';
import { formatUzs } from '@/lib/format';

import { triggerSoftHaptic } from '@/utils/haptics';

import { LegendDot, TileSkeleton } from './DashboardPrimitives';

type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger';

const TONE_INK: Record<Tone, string> = {
  neutral: 'text-mc-text',
  brand: 'text-mc-brand',
  success: 'text-mc-success',
  warn: 'text-mc-warn',
  danger: 'text-mc-danger',
};

function Tile({
  label,
  value,
  caption,
  Icon,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  /** `undefined` means the backend did not send it — never render it as 0. */
  value: number | undefined;
  caption?: string;
  Icon: LucideIcon;
  tone?: Tone;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  const body =
    value === undefined ? (
      <>
        <p className="mt-1 text-[13px] font-bold text-mc-text-3">—</p>
        <p
          className="truncate text-[10px] font-medium text-mc-text-3"
          title="Bu raqam serverdan kelmadi"
        >
          Bu raqam serverdan kelmadi
        </p>
      </>
    ) : (
      <>
        <p className="mt-1 flex items-center gap-1.5">
          <Icon className={`h-4 w-4 shrink-0 ${TONE_INK[tone]}`} strokeWidth={2.2} />
          <span className={`text-[20px] font-extrabold leading-none tabular-nums ${TONE_INK[tone]}`}>
            {new Intl.NumberFormat('uz-UZ').format(value)}
          </span>
        </p>
        {caption && (
          <p
            className="mt-1 truncate text-[10px] font-medium text-mc-text-3"
            title={caption}
          >
            {caption}
          </p>
        )}
      </>
    );

  return (
    <Tag
      {...(onClick
        ? {
            type: 'button' as const,
            onClick: () => {
              triggerSoftHaptic();
              onClick();
            },
          }
        : {})}
      className={`min-h-[84px] w-full rounded-mc-md border border-mc-border bg-mc-surface-2 p-2.5 text-left transition-transform ${
        onClick ? 'active:scale-[0.98]' : ''
      }`}
    >
      {/* Label first, value second — the mockup's reading order, and it keeps
          the numbers on one baseline across the grid. */}
      <span
        className="block truncate text-[11px] font-medium text-mc-text-2"
        title={label}
      >
        {label}
      </span>
      {body}
    </Tag>
  );
}

export function ClientStatsGrid({
  stats,
  isLoading,
  isError,
  onRetry,
  periodLabel,
}: {
  stats: ClientStatsResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  periodLabel: string;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2.5 @[30rem]:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <TileSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-6 text-center">
        <p className="text-[12px] font-semibold text-mc-text-3">Yuklanmadi</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-[11px] font-bold text-mc-brand active:scale-95"
        >
          <RotateCw className="h-3 w-3" strokeWidth={2.2} />
          Qayta urinish
        </button>
      </div>
    );
  }

  const { overview, retention } = stats;

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 @[30rem]:grid-cols-4">
      <Tile
        label="Jami mijozlar"
        value={overview.total_clients}
        caption="Ro‘yxatdan o‘tganlar"
        Icon={Users}
      />
      <Tile
        label="Faol mijozlar"
        value={overview.active_clients}
        caption="So‘nggi 45 kunda yuk yuborgan"
        Icon={UserPlus}
        tone="success"
      />
      <Tile
        label="Yangi mijozlar"
        value={overview.new_clients}
        caption={`${periodLabel}da ro‘yxatdan o‘tgan`}
        Icon={UserPlus}
        tone="brand"
      />
      <Tile
        label="Qayta yuk yuborganlar"
        value={retention.repeat_clients}
        caption="Bir martadan ko‘p yuk yuborgan"
        Icon={ShoppingBag}
        tone="brand"
      />
      <Tile
        label="Uzoq vaqt yuk yubormaganlar"
        value={overview.passive_clients}
        caption="So‘nggi 60 kunda yuk yubormagan"
        Icon={UserMinus}
        tone="warn"
      />
      <Tile
        label="Umuman yuk yubormaganlar"
        value={overview.zombie_clients}
        caption="Ro‘yxatdan o‘tgan, lekin hali yuk yubormagan"
        Icon={UserX}
        tone="warn"
      />
      <Tile
        label="VIP mijozlar"
        value={overview.vip_clients}
        caption={
          overview.vip_threshold !== undefined
            ? `Jami ${formatUzs(overview.vip_threshold)} dan ko‘p to‘lagan`
            : undefined
        }
        Icon={Crown}
        tone="brand"
      />
      <Tile
        label="Qarzdor mijozlar"
        value={overview.debtor_clients}
        caption="To‘lanmagan qarzi bor"
        Icon={Wallet}
        tone="danger"
      />
      </div>

      {/* The tiles use colour as a second signal, so the strip says what each
          hue means rather than leaving it to be inferred. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-mc-border pt-2.5">
        <Info className="h-3.5 w-3.5 shrink-0 text-mc-text-3" strokeWidth={2} />
        <LegendDot dotClass="bg-mc-success" label="Faol mijozlar" />
        <LegendDot dotClass="bg-mc-brand" label="Yangi, qayta yuborgan, VIP" />
        <LegendDot dotClass="bg-mc-warn" label="Yuk yubormaganlar" />
        <LegendDot dotClass="bg-mc-danger" label="Qarzdor" />
      </div>
    </>
  );
}
