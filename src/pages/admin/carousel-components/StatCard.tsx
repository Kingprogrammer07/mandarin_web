import { memo } from 'react';
import type { ReactNode } from 'react';

interface StatCardProps {
  icon:   ReactNode;
  label:  string;
  value:  string | number;
  accent: string;
}

export const StatCard = memo(({ icon, label, value, accent }: StatCardProps) => (
  <div className="bg-white dark:bg-[#111] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.06]">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${accent}`}>
      {icon}
    </div>
    <p className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
    <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
  </div>
));
StatCard.displayName = 'StatCard';
