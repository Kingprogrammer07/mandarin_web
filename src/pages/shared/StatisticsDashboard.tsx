import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, PieChart, Users, Package, DollarSign, Activity, BarChart2 } from 'lucide-react';
import { DateFilter } from '@/components/statistics/DateFilter';
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

import { type TabId } from './statistics-components/utils';
import { OverviewTab } from './statistics-components/OverviewTab';
import { ClientsTab } from './statistics-components/ClientsTab';
import { CargoTab } from './statistics-components/CargoTab';
import { FinanceTab } from './statistics-components/FinanceTab';
import { OperationalTab } from './statistics-components/OperationalTab';
import { AnalyticsTab } from './statistics-components/AnalyticsTab';

interface StatisticsDashboardProps {
  onBack: () => void;
}

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Umumiy', icon: PieChart },
  { id: 'clients', label: 'Mijozlar', icon: Users },
  { id: 'cargo', label: 'Yuklar', icon: Package },
  { id: 'finance', label: 'Moliya', icon: DollarSign },
  { id: 'operational', label: 'Jarayon', icon: Activity },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
];

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
  const [rawAnalyticsData, setRawAnalyticsData] = useState<AnalyticsStatsResponse | null>(null);
  const [analyticsEventsData, setAnalyticsEventsData] = useState<AnalyticsEventPage | null>(null);
  const [analyticsEventType, setAnalyticsEventType] = useState('');
  const [analyticsPage, setAnalyticsPage] = useState(1);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportingTab, setExportingTab] = useState<string | null>(null);
  const [expandedViloyatlar, setExpandedViloyatlar] = useState<Set<string>>(new Set());

  const { toast, ToastRenderer } = useToast();

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

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div>
            {activeTab === 'overview' && (
              <OverviewTab
                cargoData={cargoData}
                clientData={clientData}
                financeData={financeData}
                rawAnalyticsData={rawAnalyticsData}
              />
            )}
            {activeTab === 'clients' && (
              <ClientsTab
                clientData={clientData}
                startDate={startDate}
                endDate={endDate}
                exporting={exportingTab}
                onExport={setExportingTab}
                onTabExport={handleExport}
                expandedViloyatlar={expandedViloyatlar}
                onToggleViloyat={toggleViloyat}
              />
            )}
            {activeTab === 'cargo' && (
              <CargoTab
                cargoData={cargoData}
                rawAnalyticsData={rawAnalyticsData}
                exporting={exportingTab}
                onTabExport={handleExport}
              />
            )}
            {activeTab === 'finance' && (
              <FinanceTab
                financeData={financeData}
                exporting={exportingTab}
                onTabExport={handleExport}
              />
            )}
            {activeTab === 'operational' && (
              <OperationalTab
                opData={opData}
                exporting={exportingTab}
                onTabExport={handleExport}
              />
            )}
            {activeTab === 'analytics' && (
              <AnalyticsTab
                analyticsData={analyticsData}
                analyticsEventsData={analyticsEventsData}
                analyticsEventType={analyticsEventType}
                analyticsPage={analyticsPage}
                analyticsLoading={analyticsLoading}
                onEventTypeChange={(type) => { setAnalyticsEventType(type); setAnalyticsPage(1); }}
                onPageChange={setAnalyticsPage}
              />
            )}
          </div>
        )}

      </div>
    </div>
  );
}
