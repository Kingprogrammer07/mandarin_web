import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Package, DollarSign, Activity, PieChart, Zap, Download, ChevronDown, ChevronRight, BarChart2 } from 'lucide-react';
import { DateFilter } from './statistics/DateFilter';
import { StatCard } from './statistics/StatCard';
import { ModernAreaChart } from './statistics/ModernAreaChart';
import { ModernBarChart } from './statistics/ModernBarChart';
import { useToast } from '@/hooks/useToast';
import {
  getCargoStats,
  getClientStats,
  getFinancialStats,
  getOperationalStats,
  getAnalyticsStats,
  getAnalyticsEvents,
  exportCargoStats,
  exportClientStats,
  exportZombieClients,
  exportPassiveClients,
  exportFrequentClients,
  exportFinancialStats,
  exportOperationalStats,
} from '@/api/services/stats';
import type {
  CargoStatsResponse,
  ClientStatsResponse,
  FinancialStatsResponse,
  OperationalStatsResponse,
  AnalyticsStatsResponse,
  AnalyticsEventPage,
} from '@/api/services/stats';

interface StatisticsDashboardProps {
  onBack: () => void;
}

// ── Specialized client export panel ──────────────────────────────────────────

type ClientExportKey = 'zombie' | 'passive' | 'frequent';

interface ClientExportPanelProps {
  startDate: string;
  endDate: string;
  exporting: string | null;
  onExport: (key: string | null) => void;
}

function ClientExportPanel({ startDate, endDate, exporting, onExport }: ClientExportPanelProps) {
  const exports: { key: ClientExportKey; label: string; desc: string }[] = [
    { key: 'zombie',   label: 'Zombi mijozlar',  desc: 'Hech qachon yuk buyurtma qilmaganlar' },
    { key: 'passive',  label: 'Passiv mijozlar',  desc: '60+ kun ichida yuk olmagan (lekin avval olgan)' },
    { key: 'frequent', label: 'Faol mijozlar',    desc: '5+ reysda yuklari bo\'lganlar' },
  ];

  const run = async (key: ClientExportKey) => {
    if (exporting) return;
    onExport(key);
    try {
      if (key === 'zombie')   await exportZombieClients(startDate, endDate);
      if (key === 'passive')  await exportPassiveClients(startDate, endDate);
      if (key === 'frequent') await exportFrequentClients(5);
    } finally {
      onExport(null);
    }
  };

  return (
    <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <h3 className="text-sm font-bold mb-1 text-gray-700 dark:text-gray-300 uppercase tracking-wide">
        Mijozlar ro'yxatlarini yuklab olish
      </h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        Har bir kategoriya bo'yicha alohida Excel fayli
      </p>
      <div className="flex flex-wrap gap-3">
        {exports.map(({ key, label, desc }) => (
          <button
            key={key}
            onClick={() => run(key)}
            disabled={!!exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60 transition-all text-left group"
          >
            <span className="shrink-0">
              {exporting === key
                ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                : <Download className="w-4 h-4 text-indigo-500 group-hover:text-indigo-600" />}
            </span>
            <span>
              <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">{label}</span>
              <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

type TabId = 'overview' | 'clients' | 'cargo' | 'finance' | 'operational' | 'analytics';

export default function StatisticsDashboard({ onBack }: StatisticsDashboardProps) {

  const getToday = () => new Date().toISOString().split('T')[0];
  const getStartOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getStartOfMonth());
  const [endDate, setEndDate] = useState(getToday());
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [cargoData, setCargoData] = useState<CargoStatsResponse | null>(null);
  const [clientData, setClientData] = useState<ClientStatsResponse | null>(null);
  const [financeData, setFinanceData] = useState<FinancialStatsResponse | null>(null);
  const [opData, setOpData] = useState<OperationalStatsResponse | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsStatsResponse | null>(null);
  // Unfiltered analytics stats for overview/cargo trend charts — loaded by main effect.
  // Kept separate so the analytics tab's event-type filter doesn't corrupt these charts.
  const [rawAnalyticsData, setRawAnalyticsData] = useState<AnalyticsStatsResponse | null>(null);
  const [analyticsEventsData, setAnalyticsEventsData] = useState<AnalyticsEventPage | null>(null);
  const [analyticsEventType, setAnalyticsEventType] = useState('');
  const [analyticsPage, setAnalyticsPage] = useState(1);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportingTab, setExportingTab] = useState<string | null>(null);
  // Tracks which viloyat groups are expanded in the regions list
  const [expandedViloyatlar, setExpandedViloyatlar] = useState<Set<string>>(new Set());

  const { toast, ToastRenderer } = useToast();

  // ── Formatters ───────────────────────────────────────────────

  const formatMoney = (val: string | number | undefined | null): string => {
    if (val == null) return `0 so'm`;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return `0 so'm`;
    return `${num.toLocaleString('ru-RU')} so'm`;
  };

  /** Short money label for chart Y-axis (e.g. "1.2 mln", "450 ming") */
  const formatMoneyShort = (val: string | number): string => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '0';
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)} mlrd`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)} mln`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(0)} ming`;
    return `${num}`;
  };

  /** Integer/large number with space as thousands separator (Russian locale) */
  const formatNum = (val: string | number | undefined | null): string => {
    if (val == null) return '0';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '0';
    // Only use locale formatting for numbers >= 1 to avoid decimal confusion
    if (Number.isInteger(num)) return num.toLocaleString('ru-RU');
    return num.toLocaleString('ru-RU');
  };

  /**
   * Formats a decimal number (days, kg averages) using a period as the decimal
   * separator so it cannot be confused with a thousands separator.
   * e.g. 1.245 → "1.2", 12.7 → "12.7", 1245 → "1 245"
   */
  const formatDecimal = (val: string | number | undefined | null, decimals = 1): string => {
    if (val == null) return '0';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '0';
    if (num >= 1000) return num.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
    return num.toFixed(decimals);
  };

  // ── Data loading ─────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [r0, r1, r2, r3, r4] = await Promise.allSettled([
          getCargoStats(startDate, endDate),
          getClientStats(startDate, endDate),
          getFinancialStats(startDate, endDate),
          getOperationalStats(startDate, endDate),
          getAnalyticsStats(startDate, endDate, 'track_code_search'),
        ]);
        setCargoData(r0.status === 'fulfilled' ? r0.value : null);
        setClientData(r1.status === 'fulfilled' ? r1.value : null);
        setFinanceData(r2.status === 'fulfilled' ? r2.value : null);
        setOpData(r3.status === 'fulfilled' ? r3.value : null);
        setRawAnalyticsData(r4.status === 'fulfilled' ? r4.value : null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [startDate, endDate]);

  // ── Analytics — lazy load, re-fetches on filter or date change ──
  useEffect(() => {
    if (activeTab !== 'analytics') return;
    const load = async () => {
      setAnalyticsLoading(true);
      try {
        const eventTypeParam = analyticsEventType || undefined;
        const [r0, r1] = await Promise.allSettled([
          getAnalyticsStats(startDate, endDate, eventTypeParam),
          getAnalyticsEvents(startDate, endDate, eventTypeParam, analyticsPage, 50),
        ]);
        setAnalyticsData(r0.status === 'fulfilled' ? r0.value : null);
        setAnalyticsEventsData(r1.status === 'fulfilled' ? r1.value : null);
      } finally {
        setAnalyticsLoading(false);
      }
    };
    load();
  }, [activeTab, startDate, endDate, analyticsEventType, analyticsPage]);

  // ── Export handler ───────────────────────────────────────────

  const handleExport = async (tab: 'cargo' | 'clients' | 'finance' | 'operational') => {
    if (exportingTab) return;
    setExportingTab(tab);
    try {
      if (tab === 'cargo') await exportCargoStats(startDate, endDate);
      else if (tab === 'clients') await exportClientStats(startDate, endDate);
      else if (tab === 'finance') await exportFinancialStats(startDate, endDate);
      else await exportOperationalStats(startDate, endDate);
      toast({ title: 'Fayl yuklab olindi', variant: 'success' });
    } catch {
      toast({ title: 'Export xatosi', description: 'Faylni yuklab olishda xatolik', variant: 'error' });
    } finally {
      setExportingTab(null);
    }
  };

  const toggleViloyat = (viloyat: string) => {
    setExpandedViloyatlar(prev => {
      const next = new Set(prev);
      if (next.has(viloyat)) next.delete(viloyat);
      else next.add(viloyat);
      return next;
    });
  };

  // ── Shared sub-components ────────────────────────────────────

  const ExportBtn = ({ tab }: { tab: 'cargo' | 'clients' | 'finance' | 'operational' }) => (
    <button
      onClick={() => handleExport(tab)}
      disabled={!!exportingTab}
      className="flex items-center gap-1.5 h-8 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 border border-emerald-200/60 dark:border-emerald-500/20 active:scale-[0.98] disabled:opacity-60 rounded-xl transition-all"
    >
      {exportingTab === tab
        ? <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        : <Download className="w-3.5 h-3.5" />}
      {exportingTab === tab ? 'Yuklanmoqda...' : 'Excel'}
    </button>
  );

  const SectionHeader = ({ title, tab }: { title: string; tab?: 'cargo' | 'clients' | 'finance' | 'operational' }) => (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h2>
      {tab && <ExportBtn tab={tab} />}
    </div>
  );

  const TableBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <h3 className="text-sm font-bold mb-3 text-gray-700 dark:text-gray-300 uppercase tracking-wide">{title}</h3>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );

  const th = 'pb-2 pr-4 font-semibold text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 whitespace-nowrap';
  const tr = 'border-b last:border-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors';

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Umumiy', icon: PieChart },
    { id: 'clients', label: 'Mijozlar', icon: Users },
    { id: 'cargo', label: 'Yuklar', icon: Package },
    { id: 'finance', label: 'Moliya', icon: DollarSign },
    { id: 'operational', label: 'Jarayon', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  ];

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors">
      <ToastRenderer />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
          <div>
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 mb-2 font-medium bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full w-fit transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Orqaga
            </button>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
              Statistika Paneli
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Barcha ko'rsatkichlar va tahlillar</p>
          </div>
          <DateFilter startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
        </div>

        {/* Tab bar */}
        <div className="flex overflow-x-auto hide-scrollbar mb-6 bg-gray-100 dark:bg-gray-800/60 p-1 rounded-2xl w-full md:w-fit border border-gray-200/50 dark:border-gray-700/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap z-10 transition-colors ${
                  isActive
                    ? 'text-indigo-700 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 -z-10"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Content — no AnimatePresence exit animation to avoid blank-screen flicker */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div>
            {/* Each tab is conditionally mounted; motion.div fades in on mount */}

            {/* ── OVERVIEW ─────────────────────────────────── */}
            {activeTab === 'overview' && (
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
            )}

            {/* ── CLIENTS ──────────────────────────────────── */}
            {activeTab === 'clients' && (
              <motion.div key="clients" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                <div className="space-y-6">
                  <SectionHeader title="Mijozlar statistikasi" tab="clients" />

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

                  {/* Specialized exports */}
                  <ClientExportPanel
                    startDate={startDate}
                    endDate={endDate}
                    exporting={exportingTab}
                    onExport={setExportingTab}
                  />

                  {/* Regions — grouped by viloyat, collapsible */}
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
                                onClick={() => toggleViloyat(viloyatName)}
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
            )}

            {/* ── CARGO ────────────────────────────────────── */}
            {activeTab === 'cargo' && (
              <motion.div key="cargo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                <div className="space-y-6">
                  <SectionHeader title="Yuklar statistikasi" tab="cargo" />

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <StatCard title="Jami KG" value={`${formatDecimal(cargoData?.volume.total_weight_kg, 0)} kg`} subtitle="Tanlangan davrda kelgan barcha yuklar umumiy vazni" icon={Package} color="indigo" />
                    <StatCard title="Trek soni" value={formatNum(cargoData?.volume.total_cargos)} subtitle="Alohida trek kodlari (paketlar/buyurtmalar) soni" icon={Package} color="blue" />
                    <StatCard
                      title="O'rtacha 1 mijoz"
                      value={`${formatDecimal(cargoData?.volume.avg_weight_per_client)} kg`}
                      subtitle="Bir mijozga to'g'ri keladigan o'rtacha yuk vazni"
                      icon={Users} color="gray"
                    />
                    <StatCard
                      title="O'rtacha 1 trek"
                      value={`${formatDecimal(cargoData?.volume.avg_weight_per_track)} kg`}
                      subtitle="Bitta trek (paket) uchun o'rtacha vazn"
                      icon={Package} color="gray"
                    />
                    <StatCard title="Omborda qolgan" value={formatNum(cargoData?.bottlenecks.uz_paid_not_taken)} subtitle="To'langan, lekin ombordan hali olinmagan" icon={Activity} color="orange" />
                    <StatCard title="Mijozga topshirilgan" value={formatNum(cargoData?.bottlenecks.uz_taken_away)} subtitle="Mijoz o'zi kelib olib ketgan" icon={Users} color="green" />
                    <StatCard title="Xitoyda hisobsiz" value={formatNum(cargoData?.bottlenecks.china_unaccounted)} subtitle="Xitoyda mavjud, lekin tizimga kiritilmagan" icon={Package} color="red" />
                    <StatCard title="To'lov kutayotgan" value={formatNum(cargoData?.bottlenecks.uz_pending_payment)} subtitle="UZda bor, hisobot yuborilgan, to'lov kutilmoqda" icon={DollarSign} color="orange" />
                  </div>

                  {/* Speed — uses formatDecimal to avoid decimal/thousand confusion */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
                      Yuk aylanma tezligi — har bir bosqich uchun o'rtacha kun soni
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <StatCard
                        title="Xitoy → O'zbekiston"
                        value={`${formatDecimal(cargoData?.speed.china_to_uz_days)} kun`}
                        subtitle="Xitoy omboridan O'zbekiston omboriga yetib kelish"
                        icon={Activity} color="blue"
                      />
                      <StatCard
                        title="Omborxonada turish"
                        value={`${formatDecimal(cargoData?.speed.uz_warehouse_days)} kun`}
                        subtitle="O'zbekiston omborida mijoz olgungacha kutish vaqti"
                        icon={Activity} color="orange"
                      />
                      <StatCard
                        title="To'liq tsikl"
                        value={`${formatDecimal(cargoData?.speed.full_cycle_days)} kun`}
                        subtitle="Xitoydan to mijoz qo'liga tekkuncha umumiy vaqt"
                        icon={Zap} color="purple"
                      />
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
            )}

            {/* ── FINANCE ──────────────────────────────────── */}
            {activeTab === 'finance' && (
              <motion.div key="finance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                <div className="space-y-6">
                  <SectionHeader title="Moliyaviy statistika" tab="finance" />

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
            )}

            {/* ── OPERATIONAL ──────────────────────────────── */}
            {activeTab === 'operational' && (
              <motion.div key="operational" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                <div className="space-y-6">
                  <SectionHeader title="Jarayon statistikasi" tab="operational" />

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
            )}

            {/* ── ANALYTICS ────────────────────────────────── */}
            {activeTab === 'analytics' && (
              <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Analytics statistikasi</h2>
                    {/* Event type filter */}
                    <div className="flex items-center gap-2">
                      <select
                        value={analyticsEventType}
                        onChange={(e) => { setAnalyticsEventType(e.target.value); setAnalyticsPage(1); }}
                        className="h-9 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Barcha event turlari</option>
                        {analyticsData?.summary.map((s) => (
                          <option key={s.event_type} value={s.event_type}>{s.event_type}</option>
                        ))}
                      </select>
                      {analyticsEventType && (
                        <button
                          onClick={() => { setAnalyticsEventType(''); setAnalyticsPage(1); }}
                          className="h-9 px-3 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                        >
                          Tozalash
                        </button>
                      )}
                      {analyticsLoading && (
                        <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                  </div>

                  {/* Summary table — per event_type */}
                  {analyticsData?.summary && analyticsData.summary.length > 0 ? (
                    <TableBlock title="Event turlari bo'yicha umumiy statistika">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-800">
                            <th className={th}>Event turi</th>
                            <th className={`${th} text-right`}>Jami</th>
                            <th className={`${th} text-right`}>Unique foydalanuvchilar</th>
                            <th className={`${th} text-right`}>Oxirgi marta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsData.summary.map((row) => (
                            <tr
                              key={row.event_type}
                              className={`${tr} cursor-pointer`}
                              onClick={() => { setAnalyticsEventType(row.event_type); setAnalyticsPage(1); }}
                            >
                              <td className="py-2.5 pr-4 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                {row.event_type}
                              </td>
                              <td className="py-2.5 pr-4 text-right text-sm font-bold">{formatNum(row.total_count)}</td>
                              <td className="py-2.5 pr-4 text-right text-sm text-gray-600 dark:text-gray-400">{formatNum(row.unique_users)}</td>
                              <td className="py-2.5 pr-4 text-right text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                                {row.last_occurrence
                                  ? new Date(row.last_occurrence).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableBlock>
                  ) : !analyticsLoading && (
                    <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center text-sm text-gray-400 py-10">
                      Analytics ma'lumotlari mavjud emas
                    </div>
                  )}

                  {/* Daily trend chart */}
                  {analyticsData?.daily_trends && (
                    <ModernAreaChart
                      data={analyticsData.daily_trends}
                      title={analyticsEventType ? `"${analyticsEventType}" kunlik dinamikasi` : 'Kunlik eventlar dinamikasi'}
                      description="Tanlangan davr ichida har kuni qayd etilgan analytics eventlar soni."
                      dataKey="count"
                      xAxisKey="date"
                      color="purple"
                    />
                  )}

                  {/* Events list with pagination */}
                  {analyticsEventsData && (
                    <TableBlock title={`So'nggi eventlar${analyticsEventType ? ` — ${analyticsEventType}` : ''} (jami: ${formatNum(analyticsEventsData.total)})`}>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-800">
                            <th className={th}>#</th>
                            <th className={th}>Event turi</th>
                            <th className={`${th} text-right`}>User ID</th>
                            <th className={th}>Ma'lumot</th>
                            <th className={`${th} text-right`}>Vaqt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsEventsData.items.map((ev) => (
                            <tr key={ev.id} className={tr}>
                              <td className="py-2 pr-3 text-xs text-gray-400 tabular-nums">{ev.id}</td>
                              <td className="py-2 pr-4 font-mono text-xs font-semibold text-purple-600 dark:text-purple-400 whitespace-nowrap">
                                {ev.event_type}
                              </td>
                              <td className="py-2 pr-4 text-right text-xs text-gray-500">{ev.user_id ?? '—'}</td>
                              <td className="py-2 pr-4 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                {ev.event_data ? JSON.stringify(ev.event_data) : '—'}
                              </td>
                              <td className="py-2 pr-4 text-right text-xs text-gray-400 tabular-nums whitespace-nowrap">
                                {new Date(ev.created_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Pagination */}
                      {analyticsEventsData.total_pages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                          <span className="text-xs text-gray-400">
                            {analyticsPage} / {analyticsEventsData.total_pages} sahifa
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setAnalyticsPage((p) => Math.max(1, p - 1))}
                              disabled={analyticsPage <= 1 || analyticsLoading}
                              className="h-8 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                              ← Oldingi
                            </button>
                            <button
                              onClick={() => setAnalyticsPage((p) => Math.min(analyticsEventsData.total_pages, p + 1))}
                              disabled={analyticsPage >= analyticsEventsData.total_pages || analyticsLoading}
                              className="h-8 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                              Keyingi →
                            </button>
                          </div>
                        </div>
                      )}
                    </TableBlock>
                  )}
                </div>
              </motion.div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
