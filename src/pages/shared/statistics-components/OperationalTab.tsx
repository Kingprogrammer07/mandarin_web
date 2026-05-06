import { motion } from 'framer-motion';
import { Package, Activity, Zap } from 'lucide-react';
import { StatCard } from '@/components/statistics/StatCard';
import type { OperationalStatsResponse } from '@/api/services/stats';
import { SectionHeader, TableBlock } from './shared';
import { formatNum, formatDecimal, th, tr } from './utils';

interface OperationalTabProps {
  opData: OperationalStatsResponse | null;
  exporting: string | null;
  onTabExport: (tab: 'cargo' | 'clients' | 'finance' | 'operational') => void;
}

export function OperationalTab({ opData, exporting, onTabExport }: OperationalTabProps) {
  return (
    <motion.div key="operational" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      <div className="space-y-6">
        <SectionHeader title="Jarayon statistikasi" tab="operational" exporting={exporting} onExport={onTabExport} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Tahlil qilingan yuklar" value={formatNum(opData?.total_cargos_analyzed)} subtitle="Bu statistika uchun ko'rib chiqilgan umumiy yuklar soni" icon={Package} color="blue" />
          <StatCard title="Eng sekin bosqich" value={opData?.bottlenecks[0]?.stage_name || "Ma'lumot yo'q"} subtitle={opData?.bottlenecks[0] ? `O'rtacha ${formatDecimal(opData.bottlenecks[0].avg_days)} kun kechikmoqda` : undefined} icon={Activity} color="red" />
          <StatCard title="Keng tarqalgan yetkazish" value={`${formatDecimal(opData?.delivery_types[0]?.percentage)}%`} subtitle={opData?.delivery_types[0]?.delivery_type ?? "Ma'lumot yo'q"} icon={Zap} color="green" />
        </div>

        {opData?.stages && opData.stages.length > 0 && (
          <TableBlock title="Har bir bosqich uchun o'rtacha vaqt (kunlarda)">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className={th}>Bosqich nomi</th>
                  <th className={`${th} text-right`}>O'rtacha vaqt</th>
                </tr>
              </thead>
              <tbody>
                {opData.stages.map((s, i) => (
                  <tr key={i} className={tr}>
                    <td className="py-2.5 pr-4 font-medium text-sm">{s.stage_name}</td>
                    <td className="py-2.5 pr-4 text-right text-sm font-semibold text-indigo-600 dark:text-indigo-400">{formatDecimal(s.avg_days)} kun</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableBlock>
        )}

        {opData?.delivery_types && opData.delivery_types.length > 0 && (
          <TableBlock title="Yetkazib berish turlari taqsimoti">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className={th}>Yetkazish turi</th>
                  <th className={`${th} text-right`}>Buyurtmalar soni</th>
                  <th className={`${th} text-right`}>Ulushi (%)</th>
                </tr>
              </thead>
              <tbody>
                {opData.delivery_types.map((d, i) => (
                  <tr key={i} className={tr}>
                    <td className="py-2.5 pr-4 font-medium text-sm">{d.delivery_type}</td>
                    <td className="py-2.5 pr-4 text-right text-sm font-semibold">{formatNum(d.count)} ta</td>
                    <td className="py-2.5 pr-4 text-right text-sm font-semibold text-indigo-600 dark:text-indigo-400">{formatDecimal(d.percentage)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableBlock>
        )}

        {opData?.bottlenecks && opData.bottlenecks.length > 0 && (
          <TableBlock title="Kechikayotgan bosqichlar (muammo nuqtalari)">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className={th}>Kechikayotgan bosqich</th>
                  <th className={`${th} text-right`}>O'rtacha kechikish</th>
                </tr>
              </thead>
              <tbody>
                {opData.bottlenecks.map((b, i) => (
                  <tr key={i} className={tr}>
                    <td className="py-2.5 pr-4 font-medium text-sm">{b.stage_name}</td>
                    <td className="py-2.5 pr-4 text-right text-sm font-bold text-rose-600 dark:text-rose-400">{formatDecimal(b.avg_days)} kun</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableBlock>
        )}
      </div>
    </motion.div>
  );
}
