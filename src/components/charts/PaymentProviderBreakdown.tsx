import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { TooltipContentProps } from 'recharts';

import { TrendingUp, TrendingDown, DollarSign, CreditCard, Smartphone, Wallet } from 'lucide-react';
import type { ProviderTotals, ProviderSharePercentages, GrowthMetrics } from '@/api/services/stats';
import { formatCurrencyUz } from '@/lib/format';

interface PaymentProviderBreakdownProps {
  title: string;
  providers: ProviderTotals;
  sharePercentages?: ProviderSharePercentages;
  growth?: GrowthMetrics;
  showDetails?: boolean;
  compact?: boolean;
}

const PROVIDER_COLORS = {
  cash: '#10b981',      // Green
  click: '#3b82f6',     // Blue  
  payme: '#f59e0b',    // Amber
  account: '#8b5cf6'     // Purple
};

const PROVIDER_ICONS = {
  cash: DollarSign,
  click: CreditCard,
  payme: Smartphone,
  account: Wallet
};

const PROVIDER_LABELS = {
  cash: 'Naqd',
  click: 'Click',
  payme: 'Payme',
  account: 'Hisob'
};

export default function PaymentProviderBreakdown({
  title,
  providers,
  sharePercentages,
  growth,
  showDetails = true,
  compact = false
}: PaymentProviderBreakdownProps) {
  const pieData = [
    { name: PROVIDER_LABELS.cash, value: providers.cash, provider: 'cash' },
    { name: PROVIDER_LABELS.click, value: providers.click, provider: 'click' },
    { name: PROVIDER_LABELS.payme, value: providers.payme, provider: 'payme' },
    { name: PROVIDER_LABELS.account, value: providers.account, provider: 'account' }
  ].filter(item => item.value > 0);

  const renderCustomLabel = (entry: { value: number }) => {

    const percent = ((entry.value / providers.total) * 100).toFixed(1);
    return `${percent}%`;
  };

  const CustomTooltip = ({ active, payload }: TooltipContentProps<number, string>) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0]?.payload as { name: string; amount?: number; value: number };

      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-medium text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-600">Summa: {formatCurrencyUz(data.amount || data.value)}</p>
        </div>
      );
    }
    return null;
  };

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:shadow-lg transition-all"
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(PROVIDER_LABELS).map(([key, label]) => {
            const Icon = PROVIDER_ICONS[key as keyof typeof PROVIDER_ICONS];
            const amount = providers[key as keyof ProviderTotals] as number;
            const percent = sharePercentages?.[`${key}_percent` as keyof ProviderSharePercentages] as number;
            
            if (amount === 0) return null;
            
            return (
              <div key={key} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: PROVIDER_COLORS[key as keyof typeof PROVIDER_COLORS] }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrencyUz(amount)}
                  </p>  
                  {percent && (
                    <p className="text-xs text-gray-500">{percent.toFixed(1)}%</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-lg transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-800">{title}</h3>
        {growth && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium">
            {growth.is_new ? (
              <>
                <span className="text-purple-600">Yangi</span>
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </>
            ) : growth.percent && growth.percent >= 0 ? (
              <>
                <span className="text-green-600">+{growth.percent.toFixed(1)}%</span>
                <TrendingUp className="w-4 h-4 text-green-600" />
              </>
            ) : (
              <>
                <span className="text-red-600">{growth.percent?.toFixed(1)}%</span>
                <TrendingDown className="w-4 h-4 text-red-600" />
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        {Object.entries(PROVIDER_LABELS).map(([key, label]) => {
          const Icon = PROVIDER_ICONS[key as keyof typeof PROVIDER_ICONS];
          const amount = providers[key as keyof ProviderTotals] as number;
          const count = providers[`${key}_count` as keyof ProviderTotals] as number;
          const percent = sharePercentages?.[`${key}_percent` as keyof ProviderSharePercentages] as number;
          
          if (amount === 0) return null;
          
          return (
            <motion.div
              key={key}
              whileHover={{ y: -2 }}
              className="bg-gray-50 rounded-lg p-4 border border-gray-100"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: PROVIDER_COLORS[key as keyof typeof PROVIDER_COLORS] }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrencyUz(amount)}
              </p>
              <p className="text-xs text-gray-500">{count} ta to'lov</p>
              {percent && (
                <p className="text-xs font-medium text-blue-600 mt-1">{percent.toFixed(1)}%</p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Pie Chart */}
      {showDetails && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-4">To'lov turlari bo'yicha ulushi</h4>
          <div className="flex justify-center">
            <div className="w-full max-w-md">
              <ResponsiveContainer width="100%" height={270}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={2}
                    dataKey="value"
                    label={renderCustomLabel}
                    labelLine={false}
                    animationDuration={1000}
                  >
                    {pieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={PROVIDER_COLORS[entry.provider as keyof typeof PROVIDER_COLORS]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip content={CustomTooltip} />

                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Total Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">Jami:</span>
          <span className="text-xl font-bold text-gray-900">
            {formatCurrencyUz(providers.total)}
          </span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-sm font-medium text-gray-600">Jami to'lovlar soni:</span>
          <span className="text-lg font-semibold text-gray-800">
            {providers.total_count} ta
          </span>
        </div>
      </div>
    </motion.div>
  );
}
