import { motion } from 'framer-motion';
import { Users, Package, DollarSign, Activity } from 'lucide-react';
import { StatCard } from '@/components/statistics/StatCard';
import { ModernAreaChart } from '@/components/statistics/ModernAreaChart';
import type { CargoStatsResponse, ClientStatsResponse, FinancialStatsResponse, AnalyticsStatsResponse } from '@/api/services/stats';
import { formatNum, formatMoney, formatDecimal } from './utils';

interface OverviewTabProps {
  cargoData: CargoStatsResponse | null;
  clientData: ClientStatsResponse | null;
  financeData: FinancialStatsResponse | null;
  rawAnalyticsData: AnalyticsStatsResponse | null;
}

export function OverviewTab({ cargoData, clientData, financeData, rawAnalyticsData }: OverviewTabProps) {
  return (
    <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <StatCard title="Yangi Mijozlar" value={formatNum(clientData?.overview.new_clients)} subtitle="Tanlangan davr uchun yangi ro'yxatdan o'tganlar" icon={Users} color="blue" delay={0.04} />
          <StatCard title="Kelgan Yuklar" value={formatNum(cargoData?.volume.total_cargos)} subtitle={`Jami ${formatDecimal(cargoData?.volume.total_weight_kg, 0)} kg yuk`} icon={Package} color="indigo" delay={0.06} />
          <StatCard title="Jami Tushum" value={formatMoney(financeData?.total_revenue)} subtitle="Barcha hisoblangan summa" icon={DollarSign} color="green" delay={0.08} />
          <StatCard title="Jami Qarz" value={formatMoney(financeData?.total_debt)} subtitle="Hali to'lanmagan umumiy summa" icon={DollarSign} color="red" delay={0.10} />
          <StatCard title="Omborda kutayotgan" value={formatNum(cargoData?.bottlenecks.uz_paid_not_taken)} subtitle="To'langan, lekin ombordan hali olinmagan" icon={Package} color="orange" delay={0.12} />
          <StatCard title="Mijozga topshirilgan" value={formatNum(cargoData?.bottlenecks.uz_taken_away)} subtitle="Mijoz o'zi kelib olib ketgan yuklar" icon={Activity} color="cyan" delay={0.14} />
          <StatCard title="Dostavka / Pochta" value={formatNum(cargoData?.bottlenecks.post_approved)} subtitle="Kuryer yoki pochtaga topshirilgan yuklar" icon={Package} color="purple" delay={0.16} />
          <StatCard title="Xitoyda hisobsiz" value={formatNum(cargoData?.bottlenecks.china_unaccounted)} subtitle="Xitoyda mavjud, lekin tizimga kiritilmagan" icon={Package} color="red" delay={0.18} />
          <StatCard title="To'lov kutayotgan" value={formatNum(cargoData?.bottlenecks.uz_pending_payment)} subtitle="UZda bor, hisobot yuborilgan, to'lov kutilmoqda" icon={DollarSign} color="orange" delay={0.20} />
        </div>
        {rawAnalyticsData?.daily_trends && (
          <ModernAreaChart
            data={rawAnalyticsData.daily_trends}
            title="Trek kod qidiruvlar dinamikasi"
            description="Tanlangan davr ichida har kuni mijozlar tomonidan qilingan trek kod qidiruvlar soni. O'sish tendensiyasi yuklar kelishiga qiziqishni ko'rsatadi."
            dataKey="count"
            xAxisKey="date"
            color="indigo"
          />
        )}
      </div>
    </motion.div>
  );
}
