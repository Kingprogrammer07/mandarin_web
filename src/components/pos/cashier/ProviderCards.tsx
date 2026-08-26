/**
 * "Bugun tasdiqlangan summalar" — six providers, each with its own sparkline.
 *
 * `wallet` is deliberately absent. It holds signed balance corrections, not
 * money taken at the counter, and a card summing it would make the row
 * disagree with the day's takings — occasionally by a negative number.
 *
 * `online` is excluded too, by the owner's decision. It is real money, so the
 * six cards sum to LESS than the history table below them — an accepted gap,
 * not an oversight.
 *
 * The card total and its sparkline come from ONE response (`/cashier-log/series`
 * returns both `totals` and `buckets`), which is also the union the history
 * table reads. Three views of the same money, one query, so they cannot drift.
 */

import type { LucideIcon } from 'lucide-react';
import { Banknote, CreditCard, Landmark, Smartphone, Terminal, Wallet } from 'lucide-react';

import type { ProviderSeriesResponse } from '@/api/pos';
import { formatUzsAmount } from '@/lib/format';
import { triggerSoftHaptic } from '@/utils/haptics';

import { ProviderSparkline } from './ProviderSparkline';

type Tone = 'brand' | 'success';

const PROVIDERS: {
  key: string;
  label: string;
  Icon: LucideIcon;
  tone: Tone;
}[] = [
  { key: 'nbu', label: 'NBU', Icon: Landmark, tone: 'brand' },
  { key: 'cash', label: 'NAQD', Icon: Banknote, tone: 'success' },
  { key: 'card', label: 'KARTA', Icon: CreditCard, tone: 'brand' },
  { key: 'payme', label: 'PAYME', Icon: Smartphone, tone: 'success' },
  { key: 'click', label: 'CLICK', Icon: Wallet, tone: 'brand' },
  { key: 'terminal', label: 'TERMINAL', Icon: Terminal, tone: 'success' },
];

const TONE_CHIP: Record<Tone, string> = {
  brand: 'bg-mc-brand-soft text-mc-brand',
  success: 'bg-mc-success/12 text-mc-success',
};

function CardSkeleton() {
  return (
    <div className="h-[92px] animate-pulse rounded-mc-lg border border-mc-border bg-mc-surface-2" />
  );
}

export function ProviderCards({
  series,
  isLoading,
  isError,
  onRetry,
  activeProvider,
  onSelectProvider,
}: {
  series: ProviderSeriesResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** The provider the history table below is filtered to, if any. */
  activeProvider: string | null;
  /** Selecting the active one again clears the filter. */
  onSelectProvider: (provider: string | null) => void;
}) {
  if (isLoading && !series) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {PROVIDERS.map((provider) => (
          <CardSkeleton key={provider.key} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-mc-lg border border-mc-border bg-mc-surface px-4 py-6 text-center">
        <p className="text-[12px] font-semibold text-mc-text-3">
          Summalar yuklanmadi
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex min-h-[44px] items-center text-[12px] font-bold text-mc-brand active:scale-95"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {PROVIDERS.map(({ key, label, Icon, tone }) => {
        const amount = series?.totals[key] ?? 0;
        const points = series?.buckets.map((bucket) => bucket.providers[key] ?? 0) ?? [];
        const isActive = activeProvider === key;
        return (
          /*
            A card is a filter, not a readout. Tapping one narrows the history
            table below to that provider — the question a total invites is
            "which payments made that up", and the answer was already on the
            screen, just not reachable. Tapping the active one clears it.
          */
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            title={
              isActive
                ? `${label} filtri — bekor qilish`
                : `${label} bo‘yicha tarixni filtrlash`
            }
            onClick={() => {
              triggerSoftHaptic();
              onSelectProvider(isActive ? null : key);
            }}
            className={`flex flex-col rounded-mc-lg border p-2.5 text-left shadow-[var(--mc-shadow-card)] transition-colors active:scale-[0.98] ${
              isActive
                ? 'border-mc-brand bg-mc-brand-soft'
                : 'border-mc-border bg-mc-surface hover:border-mc-brand/40'
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-mc-sm ${TONE_CHIP[tone]}`}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="truncate text-[11px] font-extrabold uppercase tracking-[0.08em] text-mc-text-2">
                {label}
              </span>
            </span>

            <p
              className="mt-1.5 truncate text-[17px] font-extrabold leading-tight tabular-nums text-mc-text"
              title={`${label}: ${formatUzsAmount(amount)} so‘m`}
            >
              {formatUzsAmount(amount)}
              <span className="ml-1 text-[10px] font-semibold text-mc-text-2">so‘m</span>
            </p>

            <div className="mt-1.5">
              <ProviderSparkline points={points} tone={tone} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
