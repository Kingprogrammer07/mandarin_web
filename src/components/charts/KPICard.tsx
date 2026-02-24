import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'indigo' | 'emerald' | 'cyan' | 'pink';
}

const colorClasses = {
  blue: 'from-blue-500 to-blue-600',
  green: 'from-green-500 to-green-600',
  purple: 'from-purple-500 to-purple-600',
  orange: 'from-orange-500 to-orange-600',
  red: 'from-red-500 to-red-600',
  indigo: 'from-indigo-500 to-indigo-600',
  emerald: 'from-emerald-500 to-emerald-600',
  cyan: 'from-cyan-500 to-cyan-600',
  pink: 'from-pink-500 to-pink-600'
};

export default function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'blue'
}: KPICardProps) {
  const gradientClass = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-lg transition-all"
    >
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
            className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r ${gradientClass} rounded-lg flex items-center justify-center text-white shrink-0 ml-2`}
          >
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </motion.div>
        )}
      </div>

      {trend && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-2 pt-2 sm:pt-3 border-t border-gray-100"
        >
          <span className={`text-xs sm:text-sm font-medium ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend.value >= 0 ? '↗' : '↘'} {Math.abs(trend.value).toFixed(1)}%
          </span>
          <span className="text-xs sm:text-sm text-gray-500 truncate">{trend.label}</span>
        </motion.div>
      )}
    </motion.div>
  );
}
