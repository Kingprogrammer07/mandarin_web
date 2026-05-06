import { motion } from 'framer-motion';
import { Users, Activity, Zap } from 'lucide-react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { StatCard } from '@/components/statistics/StatCard';
import type { ClientStatsResponse } from '@/api/services/stats';
import { ClientExportPanel } from './ClientExportPanel';
import { SectionHeader } from './shared';
import { formatNum, formatMoney } from './utils';

interface ClientsTabProps {
  clientData: ClientStatsResponse | null;
  startDate: string;
  endDate: string;
  exporting: string | null;
  onExport: (key: string | null) => void;
  onTabExport: (tab: 'cargo' | 'clients' | 'finance' | 'operational') => void;
  expandedViloyatlar: Set<string>;
  onToggleViloyat: (viloyat: string) => void;
}

export function ClientsTab({
  clientData, startDate, endDate, exporting, onExport, onTabExport,
  expandedViloyatlar, onToggleViloyat,
}: ClientsTabProps) {
  return (
    <motion.div key="clients" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      <div className="space-y-6">
        <SectionHeader title="Mijozlar statistikasi" tab="clients" exporting={exporting} onExport={onTabExport} />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard title="Jami Mijozlar" value={formatNum(clientData?.overview.total_clients)} subtitle="Tizimda ro'yxatdan o'tgan barcha mijozlar" icon={Users} color="blue" />
          <StatCard title="Aktiv Mijozlar" value={formatNum(clientData?.overview.active_clients)} subtitle="So'nggi 45 kun ichida yuk olgan" icon={Activity} color="green" />
          <StatCard title="Passiv Mijozlar" value={formatNum(clientData?.overview.passive_clients)} subtitle="60 kundan beri hech qanday harakat yo'q" icon={Users} color="gray" />
          <StatCard title="Zombie Mijozlar" value={formatNum(clientData?.overview.zombie_clients)} subtitle="Ro'yxatdan o'tgan, lekin hech qachon yuk buyurtma qilmagan" icon={Users} color="gray" />
          <StatCard title="Qayta kelgan" value={formatNum(clientData?.retention.repeat_clients)} subtitle="Bir nechta marta yuk buyurtma qilgan sodiq mijozlar" icon={Users} color="green" />
          <StatCard title="Bir martalik" value={formatNum(clientData?.retention.one_time_clients)} subtitle="Faqat bir marta buyurtma berib, qaytmagan mijozlar" icon={Users} color="orange" />
          <StatCard title="Eng faol (5+ reys)" value={formatNum(clientData?.retention.most_frequent_clients)} subtitle="5 va undan ko'p reys buyurtma qilganlar" icon={Activity} color="purple" />
          <StatCard title="Hozir tizimda" value={formatNum(clientData?.overview.logged_in_clients)} subtitle="Telegram botga hozirda kirgan (is_logged_in=true) mijozlar" icon={Zap} color="cyan" />
        </div>

        <ClientExportPanel startDate={startDate} endDate={endDate} exporting={exporting} onExport={onExport} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <h3 className="text-sm font-bold mb-1 text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Hududlar bo'yicha mijozlar
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Viloyatni bosing — tumanlari ko'rsatiladi
            </p>
            <div className="max-h-96 overflow-y-auto space-y-1 pr-1">
              {Object.entries(clientData?.regions ?? {}).map(([viloyatName, regionDetail]) => {
                const isOpen = expandedViloyatlar.has(viloyatName);
                return (
                  <div key={viloyatName}>
                    <button
                      onClick={() => onToggleViloyat(viloyatName)}
                      className="w-full flex items-center justify-between px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        {isOpen
                          ? <ChevronDown className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-400 shrink-0" />
                        }
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{viloyatName}</span>
                      </div>
                      <span className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-2.5 py-0.5 rounded-lg text-xs font-bold shrink-0 ml-2">
                        {regionDetail.count} ta
                      </span>
                    </button>
                    {isOpen && (
                      <div className="ml-6 mt-0.5 space-y-0.5">
                        {Object.entries(regionDetail.districts).map(([districtName, district]) => (
                          <div key={districtName} className="px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">{districtName}</span>
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 ml-2">{district.count} ta</span>
                            </div>
                            {(district.revenue > 0 || district.debt > 0) && (
                              <div className="flex gap-3 mt-0.5">
                                <span className="text-[11px] text-green-600 dark:text-green-400">{formatMoney(district.paid)}</span>
                                {district.debt > 0 && (
                                  <span className="text-[11px] text-red-500 dark:text-red-400">Qarz: {formatMoney(district.debt)}</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {!Object.keys(clientData?.regions ?? {}).length && (
                <p className="text-gray-400 text-sm py-6 text-center">Ma'lumot yo'q</p>
              )}
            </div>
          </div>

          <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <h3 className="text-sm font-bold mb-1 text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Yetkazib berish usullari
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Mijozlar qaysi usulda yuk olayotgani
            </p>
            <div className="space-y-4">
              {clientData?.delivery_methods.map((d) => {
                const total = (clientData.delivery_methods).reduce((s, x) => s + x.count, 0);
                const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
                return (
                  <div key={d.method} className="space-y-1.5">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-gray-700 dark:text-gray-300">{d.method}</span>
                      <span className="text-gray-500 dark:text-gray-400 tabular-nums">{d.count} ta ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {!clientData?.delivery_methods.length && (
                <p className="text-gray-400 text-sm py-6 text-center">Ma'lumot yo'q</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
