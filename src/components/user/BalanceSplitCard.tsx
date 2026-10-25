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
        <div className="h-[60px] animate-pulse rounded-mc-lg border border-mc-border bg-mc-surface-2" />
      </div>
    );
  }

  const debt = Math.abs(data?.debt ?? 0);
  const balance = data?.wallet_balance ?? 0;
  const unit = t('home.summary.currency', "so'm");

  // Colour only when there is something to say: red for money owed, green for
  // money held. A zero on either side is just a grey zero.
  const cells = [
    { key: 'debt', label: t('profile.debt', 'Qarz'), value: debt, tone: debt > 0 ? 'text-mc-danger' : 'text-mc-text-3' },
    { key: 'balance', label: t('profile.available', 'Mavjud'), value: balance, tone: balance > 0 ? 'text-mc-success' : 'text-mc-text-3' },
  ];

  return (
    <div className="px-4">
      <div className="grid grid-cols-2 divide-x divide-mc-border rounded-mc-lg border border-mc-border bg-mc-surface">
        {cells.map((cell) => (
          <div key={cell.key} className="min-w-0 px-3.5 py-2.5">
            <span className="block text-[11px] font-medium text-mc-text-2">{cell.label}</span>
            <span
              className={`mt-0.5 block whitespace-nowrap text-[clamp(14px,4.4vw,16px)] font-extrabold
                          leading-tight tabular-nums ${cell.tone}`}
            >
              {formatUzsAmount(cell.value)}
              <span className="ml-1 text-[11px] font-bold text-mc-text-2">{unit}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
