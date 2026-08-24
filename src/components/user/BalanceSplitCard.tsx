import { CreditCard, Wallet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { walletService } from '@/api/services/walletService';
import { formatUzsAmount } from '@/lib/format';

/**
 * Debt and wallet balance, side by side.
 *
 * Both come from the same call, so they are one card split by a hairline rather
 * than two cards: they are two halves of one answer to "where do I stand", and
 * splitting them would let one render while the other was still loading.
 */
export function BalanceSplitCard() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['walletBalance'],
    queryFn: walletService.getWalletBalance,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="px-4">
        <div className="h-[76px] animate-pulse rounded-mc-lg border border-mc-border bg-mc-surface-2" />
      </div>
    );
  }

  const debt = Math.abs(data?.debt ?? 0);
  const balance = data?.wallet_balance ?? 0;
  const unit = t('home.summary.currency', "so'm");

  return (
    <div className="px-4">
      <div className="flex items-stretch gap-3 rounded-mc-lg border border-mc-border bg-mc-surface p-3 shadow-[var(--mc-shadow-card)]">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                       bg-mc-danger-soft text-mc-danger"
            aria-hidden="true"
          >
            <CreditCard className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <span className="min-w-0 overflow-hidden">
            <span className="block text-[11px] font-medium text-mc-text-2">
              {t('profile.debt', 'Qarz')}
            </span>
            <span className="block truncate text-[15px] font-extrabold leading-tight text-mc-danger tabular-nums">
              {formatUzsAmount(debt)}
              <span className="ml-1 text-[11px] font-bold">{unit}</span>
            </span>
          </span>
        </div>

        <span className="w-px shrink-0 bg-mc-border" aria-hidden="true" />

        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                       bg-mc-success/12 text-mc-success"
            aria-hidden="true"
          >
            <Wallet className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <span className="min-w-0 overflow-hidden">
            <span className="block text-[11px] font-medium text-mc-text-2">
              {t('profile.available', 'Mavjud')}
            </span>
            <span className="block truncate text-[15px] font-extrabold leading-tight text-mc-success tabular-nums">
              {formatUzsAmount(balance)}
              <span className="ml-1 text-[11px] font-bold">{unit}</span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
