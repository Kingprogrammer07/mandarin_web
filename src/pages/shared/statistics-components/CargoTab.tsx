import { motion } from 'framer-motion';
import { Users, Package, Activity, Zap, DollarSign } from 'lucide-react';
import { StatCard } from '@/components/statistics/StatCard';
import { ModernAreaChart } from '@/components/statistics/ModernAreaChart';
import type { CargoStatsResponse, AnalyticsStatsResponse } from '@/api/services/stats';
import { SectionHeader, TableBlock } from './shared';
import { formatNum, formatDecimal, th, tr } from './utils';

interface CargoTabProps {
  cargoData: CargoStatsResponse | null;
  rawAnalyticsData: AnalyticsStatsResponse | null;
  exporting: string | null;
  onTabExport: (tab: 'cargo' | 'clients' | 'finance' | 'operational') => void;
}

export function CargoTab({ cargoData, rawAnalyticsData, exporting, onTabExport }: CargoTabProps) {
  return (
    <motion.div key="cargo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      <div className="space-y-6">
        <SectionHeader title="Yuklar statistikasi" tab="cargo" exporting={exporting} onExport={onTabExport} />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard title="Jami KG" value={`${formatDecimal(cargoData?.volume.total_weight_kg, 0)} kg`} subtitle="Tanlangan davrda kelgan barcha yuklar umumiy vazni" icon={Package} color="indigo" />
          <StatCard title="Trek soni" value={formatNum(cargoData?.volume.total_cargos)} subtitle="Alohida trek kodlari (paketlar/buyurtmalar) soni" icon={Package} color="blue" />
          <StatCard title="O'rtacha 1 mijoz" value={`${formatDecimal(cargoData?.volume.avg_weight_per_client)} kg`} subtitle="Bir mijozga to'g'ri keladigan o'rtacha yuk vazni" icon={Users} color="gray" />
          <StatCard title="O'rtacha 1 trek" value={`${formatDecimal(cargoData?.volume.avg_weight_per_track)} kg`} subtitle="Bitta trek (paket) uchun o'rtacha vazn" icon={Package} color="gray" />
          <StatCard title="Omborda qolgan" value={formatNum(cargoData?.bottlenecks.uz_paid_not_taken)} subtitle="To'langan, lekin ombordan hali olinmagan" icon={Activity} color="orange" />
          <StatCard title="Mijozga topshirilgan" value={formatNum(cargoData?.bottlenecks.uz_taken_away)} subtitle="O'zi olgan, kuryer yoki pochta orqali" icon={Users} color="green" />
          <StatCard title="Xitoyda hisobsiz" value={formatNum(cargoData?.bottlenecks.china_unaccounted)} subtitle="Xitoyda mavjud, lekin tizimga kiritilmagan" icon={Package} color="red" />
          <StatCard title="To'lov kutayotgan" value={formatNum(cargoData?.bottlenecks.uz_pending_payment)} subtitle="UZda bor, hisobot yuborilgan, to'lov kutilmoqda" icon={DollarSign} color="orange" />
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
            Yuk aylanma tezligi — har bir bosqich uchun o'rtacha kun soni
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Xitoy → O'zbekiston" value={`${formatDecimal(cargoData?.speed.china_to_uz_days)} kun`} subtitle="Xitoy omboridan O'zbekiston omboriga yetib kelish" icon={Activity} color="blue" />
            <StatCard title="Omborxonada turish" value={`${formatDecimal(cargoData?.speed.uz_warehouse_days)} kun`} subtitle="O'zbekiston omborida mijoz olgungacha kutish vaqti" icon={Activity} color="orange" />
            <StatCard title="To'liq tsikl" value={`${formatDecimal(cargoData?.speed.full_cycle_days)} kun`} subtitle="Xitoydan to mijoz qo'liga tekkuncha umumiy vaqt" icon={Zap} color="purple" />
          </div>
        </div>

        {cargoData?.top_flights && cargoData.top_flights.length > 0 && (
          <TableBlock title="Eng katta hajmli reyslar (top 10)">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className={th}>Reys nomi</th>
                  <th className={`${th} text-right`}>Yuklar soni</th>
                  <th className={`${th} text-right`}>Jami vazn</th>
                </tr>
              </thead>
              <tbody>
                {cargoData.top_flights.map((f, i) => (
                  <tr key={i} className={tr}>
                    <td className="py-2.5 pr-4 font-medium text-sm">{f.flight_name}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-sm text-indigo-600 dark:text-indigo-400">{formatNum(f.cargo_count)} ta</td>
                    <td className="py-2.5 pr-4 text-right text-sm font-medium">{formatDecimal(f.total_weight_kg, 0)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableBlock>
        )}

        {rawAnalyticsData?.daily_trends && (
          <ModernAreaChart
            data={rawAnalyticsData.daily_trends}
            title="Trek kod qidiruvlar dinamikasi"
            description="Tanlangan davr ichida har kuni mijozlar tomonidan qilingan trek kod qidiruvlar soni."
            dataKey="count"
            xAxisKey="date"
            color="indigo"
          />
        )}
      </div>
    </motion.div>
  );
}
