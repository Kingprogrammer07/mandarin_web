import { cn } from '@/lib/utils';
import { formatCurrencySum } from '@/lib/format';
import { TrendingDown, TrendingUp, CheckCircle } from 'lucide-react';

interface BalanceCardProps {
  balance: number;
  status: 'debt' | 'balanced' | 'overpaid';
  className?: string;
}

export function BalanceCard({ balance, status, className }: BalanceCardProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'debt':
        return {
          bgColor: 'bg-red-50 border-red-200',
          textColor: 'text-red-700',
          iconColor: 'text-red-500',
          icon: TrendingDown,
          label: 'Qarz',
          prefix: '-',
        };
      case 'overpaid':
        return {
          bgColor: 'bg-green-50 border-green-200',
          textColor: 'text-green-700',
          iconColor: 'text-green-500',
          icon: TrendingUp,
          label: 'Ortiqcha to\'lov',
          prefix: '+',
        };
      case 'balanced':
      default:
        return {
          bgColor: 'bg-gray-50 border-gray-200',
          textColor: 'text-gray-700',
          iconColor: 'text-gray-500',
          icon: CheckCircle,
          label: 'Balans',
          prefix: '',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const displayBalance = Math.abs(balance);

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all',
        config.bgColor,
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('rounded-full p-2', config.bgColor)}>
          <Icon className={cn('h-5 w-5', config.iconColor)} />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{config.label}</p>
          <p className={cn('text-xl font-semibold', config.textColor)}>
            {status === 'balanced'
              ? 'Hisob-kitob bajarilgan'
              : `${config.prefix}${formatCurrencySum(displayBalance)}`}
          </p>
        </div>
      </div>
    </div>
  );
}
