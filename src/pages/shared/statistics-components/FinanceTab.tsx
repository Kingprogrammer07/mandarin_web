import { motion } from 'framer-motion';
import { DollarSign, Activity } from 'lucide-react';
import { StatCard } from '@/components/statistics/StatCard';
import { ModernBarChart } from '@/components/statistics/ModernBarChart';
import type { FinancialStatsResponse } from '@/api/services/stats';
import { SectionHeader, TableBlock } from './shared';
import { formatMoney, formatMoneyShort, formatNum, formatDecimal, th, tr } from './utils';

interface FinanceTabProps {
  financeData: FinancialStatsResponse | null;
  exporting: string | null;
  onTabExport: (tab: 'cargo' | 'clients' | 'finance' | 'operational') => void;
}

export function FinanceTab({ financeData, exporting, onTabExport }: FinanceTabProps) {
  return (
    <motion.div key="finance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      <div className="space-y-6">
        <SectionHeader title="Moliyaviy statistika" tab="finance" exporting={exporting} onExport={onTabExport} />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard title="Jami Tushum" value={formatMoney(financeData?.total_revenue)} subtitle="Barcha mijozlarga hisoblab chiqilgan umumiy summa" icon={DollarSign} color="green" />
          <StatCard title="To'langan" value={formatMoney(financeData?.total_paid)} subtitle="Mijozlar tomonidan haqiqatda to'langan summa" icon={DollarSign} color="blue" />
          <StatCard title="Qarz (umumiy)" value={formatMoney(financeData?.total_debt)} subtitle="Hozirgi kungacha yig'ilgan umumiy qarzdorlik" icon={DollarSign} color="red" />
          <StatCard title="Muddati o'tgan qarz" value={formatMoney(financeData?.overdue_debt)} subtitle="15 kundan ortiq vaqt o'tgan to'lanmagan qarzlar" icon={DollarSign} color="red" />
          <StatCard title="O'rtacha Chek" value={formatMoney(financeData?.average_payment)} subtitle="Bitta to'lov operatsiyasining o'rtacha summasi" icon={Activity} color="purple" />
          <StatCard title="Sof Foyda" value={formatMoney(financeData?.total_profitability)} subtitle="To'langan − (Jami KG × $8 × kurs) taxminiy foyda" icon={DollarSign} color="green" />
        </div>

        {financeData?.top_clients && financeData.top_clients.length > 0 && (
          <TableBlock title="Top mijozlar — to'lov va qarz holati">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className={th}>Mijoz kodi</th>
                  <th className={`${th} text-right`}>Hisoblangan</th>
                  <th className={`${th} text-right`}>To'langan</th>
                  <th className={`${th} text-right`}>Qarz</th>
                </tr>
              </thead>
              <tbody>
                {financeData.top_clients.map((c) => (
                  <tr key={c.client_code} className={tr}>
                    <td className="py-2.5 pr-4 font-bold text-sm">{c.client_code}</td>
                    <td className="py-2.5 pr-4 text-right text-sm">{formatMoney(c.revenue)}</td>
                    <td className="py-2.5 pr-4 text-right text-sm font-semibold text-green-600 dark:text-green-400">{formatMoney(c.paid)}</td>
                    <td className="py-2.5 pr-4 text-right text-sm font-semibold text-red-500 dark:text-red-400">{formatMoney(c.debt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableBlock>
        )}

        {financeData?.periodic_revenue && financeData.periodic_revenue.length > 0 && (
          <ModernBarChart
            data={financeData.periodic_revenue}
            title="Davriy tushum dinamikasi"
            description="Har bir davr (oy/hafta) uchun hisoblab chiqilgan umumiy tushum. Yon tarafdagi raqamlar qisqartirilgan ko'rinishda (ming, mln). Aniq qiymat uchun ustun ustiga bosing."
            dataKey="revenue"
            xAxisKey="period"
            color="green"
            valueFormatter={formatMoney}
            axisFormatter={formatMoneyShort}
          />
        )}

        {financeData?.payment_methods && financeData.payment_methods.length > 0 ? (
          <TableBlock title="To'lov usullari bo'yicha taqsimot">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className={th}>To'lov usuli</th>
                  <th className={`${th} text-right`}>Jami summa</th>
                  <th className={`${th} text-right`}>Operatsiyalar</th>
                </tr>
              </thead>
              <tbody>
                {financeData.payment_methods.map((m, i) => (
                  <tr key={i} className={tr}>
                    <td className="py-2.5 pr-4 font-medium text-sm">{m.method}</td>
                    <td className="py-2.5 pr-4 text-right text-sm font-semibold text-green-600 dark:text-green-400">{formatMoney(m.total_amount)}</td>
                    <td className="py-2.5 pr-4 text-right text-sm">{formatNum(m.count)} ta</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableBlock>
        ) : (
          <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center text-sm text-gray-400 py-8">
            To'lov usullari bo'yicha ma'lumot mavjud emas
          </div>
        )}

        {financeData?.flight_collections && financeData.flight_collections.length > 0 && (
          <TableBlock title="Reyslar bo'yicha pul yig'ish holati">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className={th}>Reys nomi</th>
                  <th className={`${th} text-right`}>Hisoblangan</th>
                  <th className={`${th} text-right`}>To'langan</th>
                  <th className={`${th} text-right`}>Undirilish %</th>
                </tr>
              </thead>
              <tbody>
                {financeData.flight_collections.map((f, i) => (
                  <tr key={i} className={tr}>
                    <td className="py-2.5 pr-4 font-medium text-sm">{f.flight_name}</td>
                    <td className="py-2.5 pr-4 text-right text-sm">{formatMoney(f.revenue)}</td>
                    <td className="py-2.5 pr-4 text-right text-sm font-semibold text-green-600 dark:text-green-400">{formatMoney(f.paid)}</td>
                    <td className="py-2.5 pr-4 text-right text-sm font-semibold text-indigo-600 dark:text-indigo-400">{formatDecimal(f.collection_rate)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableBlock>
        )}

        {financeData?.regions && financeData.regions.length > 0 && (
          <TableBlock title="Hududlar bo'yicha moliyaviy ko'rsatkichlar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className={th}>Hudud</th>
                  <th className={`${th} text-right`}>Hisoblangan</th>
                  <th className={`${th} text-right`}>To'langan</th>
                  <th className={`${th} text-right`}>Qarz</th>
                </tr>
              </thead>
              <tbody>
                {financeData.regions.map((r, i) => (
                  <tr key={i} className={tr}>
                    <td className="py-2.5 pr-4 text-sm">
                      <span className="font-semibold">{r.region_name || r.region_code}</span>
                      <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">({r.region_code})</span>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-sm">{formatMoney(r.revenue)}</td>
                    <td className="py-2.5 pr-4 text-right text-sm font-semibold text-green-600 dark:text-green-400">{formatMoney(r.paid)}</td>
                    <td className="py-2.5 pr-4 text-right text-sm font-semibold text-red-500 dark:text-red-400">{formatMoney(r.debt)}</td>
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
