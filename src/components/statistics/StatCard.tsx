import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'indigo' | 'cyan' | 'gray';
  delay?: number;
}

const iconBgMaps: Record<string, string> = {
  blue: 'bg-blue-500 dark:bg-blue-500',
  green: 'bg-emerald-500 dark:bg-emerald-500',
  orange: 'bg-orange-500 dark:bg-orange-500',
  purple: 'bg-purple-500 dark:bg-purple-500',
  red: 'bg-rose-500 dark:bg-rose-500',
  indigo: 'bg-indigo-500 dark:bg-indigo-500',
  cyan: 'bg-cyan-500 dark:bg-cyan-500',
  gray: 'bg-gray-500 dark:bg-gray-500',
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'blue',
  delay = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay, ease: [0.23, 1, 0.32, 1] }}
      className={`relative p-4 md:p-5 rounded-2xl md:rounded-3xl border 
        bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl
        shadow-sm dark:shadow-none border-gray-100 dark:border-white/5
        hover:shadow-md transition-shadow duration-300 overflow-hidden flex flex-col justify-between`}
    >
      <div className="flex justify-between items-start mb-3 gap-2">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 leading-snug tracking-wide line-clamp-2 flex-1">
          {title}
        </h3>
        {Icon && (
          <div className={`p-2 rounded-xl flex items-center justify-center text-white shrink-0 ${iconBgMaps[color]} shadow-sm shadow-${color}-500/30`}>
            <Icon className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.5} />
          </div>
        )}
      </div>

      <div className="mt-1">
        <div className="flex flex-col items-start gap-1">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white truncate w-full" title={String(value)}>
            {value}
          </h2>
          {trend && (
            <span className={`inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded-full mt-1 ${trend.isPositive ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' : 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400'}`}>
              {trend.isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {Math.abs(trend.value)}%
            </span>
          )}
        </div>
        
        {(subtitle || (trend && trend.label)) && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium line-clamp-2 md:line-clamp-1" title={subtitle}>
            {subtitle} {trend && trend.label && <span className="ml-1 opacity-70">({trend.label})</span>}
          </p>
        )}
      </div>
    </motion.div>
  );
};
