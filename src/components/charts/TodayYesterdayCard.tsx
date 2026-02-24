import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TodayYesterdayCardProps {
  title: string;
  todayValue: number | string;
  yesterdayValue: number | string;
  difference: number;
  percentChange: number;
  isGrowth: boolean;
  todayDate?: string;
  yesterdayDate?: string;
  icon?: LucideIcon;
  valueFormatter?: (value: number | string) => string;
  compact?: boolean;
  colorScheme?: 'default' | 'revenue' | 'activity';
}

export default function TodayYesterdayCard({
  title,
  todayValue,
  yesterdayValue,
  difference,
  percentChange,
  isGrowth,
  todayDate,
  yesterdayDate,
  icon: Icon,
  valueFormatter = (v) => String(v),
  compact = false,
  colorScheme = 'default'
}: TodayYesterdayCardProps) {
  const { t } = useTranslation();

  const getColorClasses = () => {
    switch (colorScheme) {
      case 'revenue':
        return {
          gradient: 'from-violet-500 to-violet-600',
          todayBg: 'bg-violet-50',
          todayText: 'text-violet-700',
          todayValue: 'text-violet-900'
        };
      case 'activity':
        return {
          gradient: 'from-emerald-500 to-emerald-600',
          todayBg: 'bg-emerald-50',
          todayText: 'text-emerald-700',
          todayValue: 'text-emerald-900'
        };
      default:
        return {
          gradient: 'from-blue-500 to-blue-600',
          todayBg: 'bg-blue-50',
          todayText: 'text-blue-700',
          todayValue: 'text-blue-900'
        };
    }
  };

  const colors = getColorClasses();

  const getTrendIcon = () => {
    if (difference === 0) return <Minus className="w-4 h-4" />;
    return isGrowth ? (
      <TrendingUp className="w-4 h-4" />
    ) : (
      <TrendingDown className="w-4 h-4" />
    );
  };

  const getTrendColor = () => {
    if (difference === 0) return 'text-gray-500 bg-gray-100';
    return isGrowth
      ? 'text-green-700 bg-green-100'
      : 'text-red-700 bg-red-100';
  };

  const formatPercentChange = () => {
    const sign = percentChange > 0 ? '+' : '';
    return `${sign}${percentChange.toFixed(1)}%`;
  };

  if (compact) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="bg-white/60 backdrop-blur-md rounded-xl shadow-lg p-4 border border-white/20"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {Icon && (
              <div className={`w-8 h-8 bg-gradient-to-r ${colors.gradient} rounded-lg flex items-center justify-center text-white`}>
                <Icon className="w-4 h-4" />
              </div>
            )}
            <h4 className="text-sm font-medium text-gray-700">{title}</h4>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTrendColor()}`}>
            {getTrendIcon()}
            {formatPercentChange()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className={`p-2 rounded-lg ${colors.todayBg}`}>
            <p className={`text-xs ${colors.todayText}`}>{t('stats.periods.today')}</p>
            <p className={`text-lg font-bold ${colors.todayValue}`}>
              {valueFormatter(todayValue)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-600">{t('stats.periods.yesterday')}</p>
            <p className="text-lg font-bold text-gray-700">
              {valueFormatter(yesterdayValue)}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="bg-white/60 backdrop-blur-md rounded-xl shadow-lg p-4 sm:p-6 border border-white/20"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={`w-10 h-10 bg-gradient-to-r ${colors.gradient} rounded-lg flex items-center justify-center text-white`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-500">
              {t('stats.periods.todayVsYesterday')}
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${getTrendColor()}`}>
          {getTrendIcon()}
          <span className="text-sm font-semibold">{formatPercentChange()}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className={`p-4 rounded-xl ${colors.todayBg}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${colors.todayText}`}>
              {t('stats.periods.today')}
            </span>
            {todayDate && (
              <span className="text-xs text-gray-500">{todayDate}</span>
            )}
          </div>
          <p className={`text-2xl sm:text-3xl font-bold ${colors.todayValue}`}>
            {valueFormatter(todayValue)}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              {t('stats.periods.yesterday')}
            </span>
            {yesterdayDate && (
              <span className="text-xs text-gray-500">{yesterdayDate}</span>
            )}
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-700">
            {valueFormatter(yesterdayValue)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center pt-3 border-t border-gray-100">
        <div className="text-center">
          <span className="text-sm text-gray-500 mr-2">{t('stats.periods.difference')}:</span>
          <span className={`text-lg font-bold ${isGrowth ? 'text-green-600' : difference < 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {difference > 0 ? '+' : ''}{valueFormatter(difference)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
