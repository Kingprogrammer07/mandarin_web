import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  getRegistrationStatistics,
  getClientActivityStatistics,
  getCargoTrendStatistics,
  getRevenueStatistics,
  getBotLifecycleStatistics,
  getCargoItemsStatistics,
  getCargoItemsTrends,
  getFotoHisobotStatistics,
  getDeliveryRequestsStatistics,
  getBroadcastStatistics,
  getGlobalDashboardStatistics,
  getPaymentSummary,
  getPaymentsByClient,
  getPaymentsByFlight,
  exportClients,
  exportFotoHisobot,
  exportCargoItems,
  exportRevenue,
  exportApiLogs,
  exportDeliveryRequests,
  exportAllStats,
  exportExcel,
  exportCsv,
  exportPaymentSummary,
  type RegistrationStatsResponse,
  type ClientActivityStatsResponse,
  type CargoStatsResponse,
  type RevenueStatsResponse,
  type BotLifecycleStatsResponse,
  type CargoItemsStatsResponse,
  type CargoItemsTrendsResponse,
  type FotoHisobotStatsResponse,
  type DeliveryRequestsStatsResponse,
  type BroadcastStatsResponse,
  type GlobalDashboardStats,
  type PaymentSummaryResponse,
  type ClientPaymentStatsResponse,
  type FlightPaymentStatsResponse
} from '@/api/services/stats';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Users, Package, DollarSign, Calendar, Activity,
  RefreshCw, Camera, Truck, Send, BarChart3, Download,
  FileSpreadsheet, CreditCard
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';
import {
  formatCurrencySum,
  formatNumberLocalized,
  formatTashkentDate,
  formatTashkentDateShort,
  getTashkentDateIso
} from '@/lib/format';

// Chart components
import TrendChart from './charts/TrendChart';
import ComparisonBarChart from './charts/ComparisonBarChart';
import PieDonutChart from './charts/PieDonutChart';
import KPICard from './charts/KPICard';
import PaymentProviderBreakdown from './charts/PaymentProviderBreakdown';
import ClientPaymentStatsComponent from './charts/ClientPaymentStats';
import FlightPaymentStatsComponent from './charts/FlightPaymentStats';
import TodayYesterdayCard from './charts/TodayYesterdayCard';

interface StatisticsDashboardProps {
  onBack: () => void;
}

// Animation variants - defined once to avoid recreating
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" as const }
  }
};

// Section Header Component - Reusable
interface SectionHeaderProps {
  icon: React.ElementType;
  title: string;
  gradientFrom: string;
  gradientTo: string;
  actions?: React.ReactNode;
}

function SectionHeader({ icon: Icon, title, gradientFrom, gradientTo, actions }: SectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-lg flex items-center justify-center text-white`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">{title}</h2>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// Card Container Component - Reusable
interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
}

function CardContainer({ children, className = '' }: CardContainerProps) {
  return (
    <div className={`bg-white/60 backdrop-blur-md rounded-xl shadow-lg p-4 sm:p-6 border border-white/20 ${className}`}>
      {children}
    </div>
  );
}

export default function StatisticsDashboard({ onBack }: StatisticsDashboardProps) {
  const { t, i18n } = useTranslation();
  const { toast, ToastRenderer } = useToast();

  // State management - grouped by category
  const [isLoading, setIsLoading] = useState(true);

  // Core statistics
  const [registrationStats, setRegistrationStats] = useState<RegistrationStatsResponse | null>(null);
  const [activityStats, setActivityStats] = useState<ClientActivityStatsResponse | null>(null);
  const [cargoStats, setCargoStats] = useState<CargoStatsResponse | null>(null);
  const [revenueStats, setRevenueStats] = useState<RevenueStatsResponse | null>(null);
  const [lifecycleStats, setLifecycleStats] = useState<BotLifecycleStatsResponse | null>(null);

  // Domain statistics
  const [cargoItemsStats, setCargoItemsStats] = useState<CargoItemsStatsResponse | null>(null);
  const [cargoItemsTrends, setCargoItemsTrends] = useState<CargoItemsTrendsResponse | null>(null);
  const [fotoHisobotStats, setFotoHisobotStats] = useState<FotoHisobotStatsResponse | null>(null);
  const [deliveryStats, setDeliveryStats] = useState<DeliveryRequestsStatsResponse | null>(null);
  const [broadcastStats, setBroadcastStats] = useState<BroadcastStatsResponse | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalDashboardStats | null>(null);

  // Payment statistics
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummaryResponse | null>(null);
  const [paymentsByClient, setPaymentsByClient] = useState<ClientPaymentStatsResponse | null>(null);
  const [paymentsByFlight, setPaymentsByFlight] = useState<FlightPaymentStatsResponse | null>(null);

  // Formatting helpers - memoized
  const formatNumber = useCallback((num: number) => {
    return formatNumberLocalized(num, i18n.language);
  }, [i18n.language]);

  const formatCurrency = useCallback((amount: number) => {
    return formatCurrencySum(amount, i18n.language);
  }, [i18n.language]);

  const formatDate = useCallback((dateString: string) => {
    return formatTashkentDate(dateString, i18n.language);
  }, [i18n.language]);

  const formatDateShort = useCallback((dateString: string) => {
    return formatTashkentDateShort(dateString, i18n.language);
  }, [i18n.language]);

  // Error handler helper
  const getErrorMessage = useCallback((error: unknown) => {
    let errorMessage = t('stats.loadingErrorDesc');
    let errorTitle = t('stats.loadingError');

    const hasResponse = typeof error === 'object' && error !== null && 'response' in (error as object);
    if (hasResponse && (error as { response?: { status?: number; data?: { detail?: string } } }).response?.status) {

      const statusMessages: Record<number, { title: string; message: string }> = {
        400: { title: '❌ Bad Request', message: 'Noto\'g\'ri parametrlar. Sanalarni tekshiring.' },
        401: { title: '❌ Unauthorized', message: 'Tizimga kirish uchun avtorizatsiya talab qilinadi.' },
        403: { title: '❌ Forbidden', message: 'Bu ma\'lumotlarga kirish uchun ruxsat yo\'q.' },
        404: { title: '❌ Not Found', message: 'So\'ralan ma\'lumotlar topilmadi.' },
        429: { title: '❌ Too Many Requests', message: 'Juda ko\'p so\'rovlar. Iltimos birozdan keyinroq urinib ko\'ring.' },
        500: { title: '❌ Server Error', message: 'Serverda xatolik yuz berdi. Iltimos birozdan urinib ko\'ring.' },
        502: { title: '❌ Gateway Error', message: 'Tashqi xizmatda xatolik. Iltimos birozdan urinib ko\'ring.' },
        503: { title: '❌ Service Unavailable', message: 'Xizmat vaqtincha mavjud emas. Iltimos keyinroq urinib ko\'ring.' }
      };

      const statusError = statusMessages[(error as { response: { status: number } }).response.status];

      if (statusError) {
        errorTitle = statusError.title;
        errorMessage = statusError.message;
      } else {
        errorTitle = `❌ ${t('stats.loadingError')}`;
        const err = error as { message?: string; status?: number };
        errorMessage = `HTTP ${err.status ?? ''}: ${err.message || ''}`;
      }
    } else if (typeof error === 'object' && error !== null && 'code' in (error as object) && (error as { code?: string }).code === 'NETWORK_ERROR') {
      errorTitle = '❌ Network Error';
      errorMessage = 'Tarmoq xatoligi. Internet ulanishini tekshiring.';
    } else if (typeof error === 'object' && error !== null && 'code' in (error as object) && (error as { code?: string }).code === 'TIMEOUT') {

      errorTitle = '❌ Timeout';
      errorMessage = 'So\'rov muddati o\'tib ketdi. Iltimos yana urinib ko\'ring.';
    }

    return { errorTitle, errorMessage };
  }, [t]);

  // Load all statistics
  const loadAllStatistics = useCallback(async () => {
    try {
      setIsLoading(true);

      // Get current date in Tashkent timezone for date filters
      const todayIso = getTashkentDateIso();

      // Helper for partial failure handling
      const safeRequest = async <T,>(promise: Promise<T>): Promise<T | null> => {
        try {
          return await promise;
        } catch (error) {
          console.warn('Partial statistics load failure:', error);
          return null;
        }
      };

      const [
        registrationData,
        activityData,
        cargoData,
        revenueData,
        lifecycleData,
        cargoItemsData,
        cargoItemsTrendsData,
        fotoHisobotData,
        deliveryData,
        broadcastData,
        globalData,
        paymentSummaryData,
        paymentsByClientData,
        paymentsByFlightData
      ] = await Promise.all([
        safeRequest(getRegistrationStatistics()),
        safeRequest(getClientActivityStatistics()),
        safeRequest(getCargoTrendStatistics()),
        safeRequest(getRevenueStatistics()),
        safeRequest(getBotLifecycleStatistics()),
        safeRequest(getCargoItemsStatistics()),
        safeRequest(getCargoItemsTrends()),
        safeRequest(getFotoHisobotStatistics()),
        safeRequest(getDeliveryRequestsStatistics()),
        safeRequest(getBroadcastStatistics()),
        safeRequest(getGlobalDashboardStatistics()),
        safeRequest(getPaymentSummary()),
        safeRequest(getPaymentsByClient(undefined, todayIso)),
        safeRequest(getPaymentsByFlight(undefined, todayIso))
      ]);

      setRegistrationStats(registrationData);
      setActivityStats(activityData);
      setCargoStats(cargoData);
      setRevenueStats(revenueData);
      setLifecycleStats(lifecycleData);
      setCargoItemsStats(cargoItemsData);
      setCargoItemsTrends(cargoItemsTrendsData);
      setFotoHisobotStats(fotoHisobotData);
      setDeliveryStats(deliveryData);
      setBroadcastStats(broadcastData);
      setGlobalStats(globalData);
      setPaymentSummary(paymentSummaryData);
      setPaymentsByClient(paymentsByClientData);
      setPaymentsByFlight(paymentsByFlightData);

      // Check if EVERYTHING failed (edge case)
      if (
        !registrationData && !activityData && !cargoData && !revenueData && 
        !lifecycleData && !cargoItemsData && !fotoHisobotData && !deliveryData && 
        !broadcastData && !globalData && !paymentSummaryData
      ) {
         toast({ 
           title: t('stats.loadingError'), 
           description: t('stats.loadingErrorDesc'), 
           variant: 'error' 
         });
      }

    } catch (error: unknown) {

      console.error('Critical failure in loadAllStatistics:', error);
      const { errorTitle, errorMessage } = getErrorMessage(error);
      toast({ title: errorTitle, description: errorMessage, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [getErrorMessage, toast, t]);

  useEffect(() => {
    loadAllStatistics();
  }, [loadAllStatistics]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-orange-50/30 to-gray-100">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">{t('stats.loading')}</p>
        </motion.div>
      </div>
    );
  }

  // Transform data for charts
  const registrationTrendData = registrationStats ? [
    {
      name: t('stats.periods.daily'),
      current: registrationStats.daily.current_period.count,
      previous: registrationStats.daily.previous_period.count
    },
    {
      name: t('stats.periods.weekly'),
      current: registrationStats.weekly.current_period.count,
      previous: registrationStats.weekly.previous_period.count
    },
    {
      name: t('stats.periods.monthly'),
      current: registrationStats.monthly.current_period.count,
      previous: registrationStats.monthly.previous_period.count
    }
  ] : [];

  const activityPieData = activityStats ? [
    { name: t('stats.activity.active'), value: activityStats.last_30_days.active_clients },
    { name: t('stats.activity.passive'), value: activityStats.last_30_days.passive_clients }
  ] : [];

  const cargoComparisonData = cargoStats ? [
    {
      name: t('stats.periods.weekly'),
      value: cargoStats.weekly_comparison.current_period.count,
      comparison: cargoStats.weekly_comparison.previous_period.count
    },
    {
      name: t('stats.periods.monthly'),
      value: cargoStats.monthly_comparison.current_period.count,
      comparison: cargoStats.monthly_comparison.previous_period.count
    }
  ] : [];

  const revenueComparisonData = revenueStats ? [
    {
      name: t('stats.periods.weekly'),
      value: revenueStats.weekly.current_period.total_revenue,
      comparison: revenueStats.weekly.previous_period.total_revenue
    },
    {
      name: t('stats.periods.monthly'),
      value: revenueStats.monthly.current_period.total_revenue,
      comparison: revenueStats.monthly.previous_period.total_revenue
    }
  ] : [];

  const paymentTypeData = revenueStats?.weekly.current_period ? [
    { name: t('stats.revenue.fullPayments'), value: revenueStats.weekly.current_period.full_payments_count },
    { name: t('stats.revenue.partialPayments'), value: revenueStats.weekly.current_period.partial_payments_count }
  ] : [];

  return (
    <>
      <ToastRenderer />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-[1400px] bg-gradient-to-br from-gray-50 via-orange-50/30 to-gray-100 min-h-screen"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-medium text-sm sm:text-base">{t('stats.backToDashboard')}</span>
          </button>

          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">
                {t('stats.title')}
              </h1>
              <p className="text-sm text-gray-600">{t('stats.subtitle')}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={loadAllStatistics}
                size="sm"
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold shadow-md"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('stats.refresh')}
              </Button>
              <Button
                onClick={exportExcel}
                size="sm"
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold shadow-md"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                {t('stats.export.excel')}
              </Button>
              <Button
                onClick={exportCsv}
                size="sm"
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-md"
              >
                <Download className="w-4 h-4 mr-2" />
                {t('stats.export.csv')}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* KPI Overview - Top Row */}
        {lifecycleStats && (
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6"
          >
            <KPICard
              title={t('stats.kpi.totalUsers')}
              value={formatNumber(lifecycleStats.total_users)}
              subtitle={`${formatNumber(lifecycleStats.total_approved_clients)} ${t('stats.kpi.approvedClients')}`}
              icon={Users}
              trend={{
                value: lifecycleStats.avg_users_per_day,
                label: t('stats.kpi.avgPerDay')
              }}
              color="blue"
            />
            <KPICard
              title={t('stats.kpi.totalCargo')}
              value={formatNumber(lifecycleStats.total_cargo_uploads)}
              subtitle={`${lifecycleStats.avg_cargo_per_day.toFixed(1)} ${t('stats.kpi.avgPerDay')}`}
              icon={Package}
              color="green"
            />
            <KPICard
              title={t('stats.kpi.totalRevenue')}
              value={formatCurrency(lifecycleStats.total_revenue)}
              subtitle={`${formatNumber(lifecycleStats.total_payments)} ${t('stats.kpi.payments')}`}
              icon={DollarSign}
              color="purple"
            />
            <KPICard
              title={t('stats.kpi.daysActive')}
              value={formatNumber(lifecycleStats.days_since_launch)}
              subtitle={`${t('stats.kpi.since')} ${formatDate(lifecycleStats.bot_launch_date)}`}
              icon={Calendar}
              color="orange"
            />
          </motion.div>
        )}

        {/* TODAY VS YESTERDAY COMPARISONS - NEW SECTION */}
        {(registrationStats?.today_vs_yesterday || cargoStats?.today_vs_yesterday || revenueStats?.today_vs_yesterday) && (
          <motion.div variants={itemVariants} className="mb-6">
            <SectionHeader
              icon={Calendar}
              title={t('stats.periods.todayVsYesterday')}
              gradientFrom="from-indigo-500"
              gradientTo="to-indigo-600"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {registrationStats?.today_vs_yesterday && (
                <TodayYesterdayCard
                  title={t('stats.registrations.title')}
                  todayValue={registrationStats.today_vs_yesterday.today_count}
                  yesterdayValue={registrationStats.today_vs_yesterday.yesterday_count}
                  difference={registrationStats.today_vs_yesterday.difference}
                  percentChange={registrationStats.today_vs_yesterday.percent_change}
                  isGrowth={registrationStats.today_vs_yesterday.is_growth}
                  todayDate={formatDateShort(registrationStats.today_vs_yesterday.today_date)}
                  yesterdayDate={formatDateShort(registrationStats.today_vs_yesterday.yesterday_date)}
                  icon={Users}
                  compact
                />
              )}
              {cargoStats?.today_vs_yesterday && (
                <TodayYesterdayCard
                  title={t('stats.cargo.title')}
                  todayValue={cargoStats.today_vs_yesterday.today_count}
                  yesterdayValue={cargoStats.today_vs_yesterday.yesterday_count}
                  difference={cargoStats.today_vs_yesterday.difference}
                  percentChange={cargoStats.today_vs_yesterday.percent_change}
                  isGrowth={cargoStats.today_vs_yesterday.is_growth}
                  todayDate={formatDateShort(cargoStats.today_vs_yesterday.today_date)}
                  yesterdayDate={formatDateShort(cargoStats.today_vs_yesterday.yesterday_date)}
                  icon={Package}
                  compact
                  colorScheme="activity"
                />
              )}
              {revenueStats?.today_vs_yesterday && (
                <TodayYesterdayCard
                  title={t('stats.revenue.title')}
                  todayValue={revenueStats.today_vs_yesterday.today_revenue}
                  yesterdayValue={revenueStats.today_vs_yesterday.yesterday_revenue}
                  difference={revenueStats.today_vs_yesterday.difference}
                  percentChange={revenueStats.today_vs_yesterday.percent_change}
                  isGrowth={revenueStats.today_vs_yesterday.is_growth}
                  todayDate={formatDateShort(revenueStats.today_vs_yesterday.today_date)}
                  yesterdayDate={formatDateShort(revenueStats.today_vs_yesterday.yesterday_date)}
                  icon={DollarSign}
                  valueFormatter={(v) => formatCurrency(Number(v))}
                  compact
                  colorScheme="revenue"
                />
              )}
            </div>
          </motion.div>
        )}

        {/* PAYMENT STATISTICS - GROUPED TOGETHER */}
        {paymentSummary && (
          <motion.div variants={itemVariants} className="mb-6">
            <CardContainer>
              <SectionHeader
                icon={CreditCard}
                title={t('stats.paymentProviders.title')}
                gradientFrom="from-violet-500"
                gradientTo="to-violet-600"
                actions={
                  <>
                    <Button
                      onClick={() => exportPaymentSummary()}
                      size="sm"
                      className="bg-violet-500 hover:bg-violet-600 text-white"
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      {t('stats.export.paymentSummary')}
                    </Button>
                  </>
                }
              />

              {/* Today vs Yesterday Payment Comparison */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <PaymentProviderBreakdown
                  title={t('stats.paymentProviders.today')}
                  providers={paymentSummary.today.providers}
                  sharePercentages={paymentSummary.today.share_percentages}
                  growth={paymentSummary.growth.daily.total}
                  compact
                />
                <PaymentProviderBreakdown
                  title={t('stats.paymentProviders.yesterday')}
                  providers={paymentSummary.yesterday.providers}
                  sharePercentages={paymentSummary.yesterday.share_percentages}
                  compact
                />
              </div>

              {/* All Time Summary */}
              <PaymentProviderBreakdown
                title={t('stats.paymentProviders.allTime')}
                providers={paymentSummary.providers}
                sharePercentages={paymentSummary.share_percentages}
                compact={false}
              />

              {/* Weekly and Monthly */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                <PaymentProviderBreakdown
                  title={t('stats.paymentProviders.thisWeek')}
                  providers={paymentSummary.this_week.providers}
                  sharePercentages={paymentSummary.this_week.share_percentages}
                  growth={paymentSummary.growth.weekly.total}
                  showDetails={false}
                />
                <PaymentProviderBreakdown
                  title={t('stats.paymentProviders.thisMonth')}
                  providers={paymentSummary.this_month.providers}
                  sharePercentages={paymentSummary.this_month.share_percentages}
                  growth={paymentSummary.growth.monthly.total}
                  showDetails={false}
                />
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
                <KPICard
                  title={t('stats.paymentProviders.last7Days')}
                  value={formatCurrency(paymentSummary.last_7_days.providers.total)}
                  subtitle={`${formatNumber(paymentSummary.last_7_days.providers.total_count)} ${t('stats.revenue.payments')}`}
                  icon={DollarSign}
                  trend={{
                    value: paymentSummary.growth.weekly.total.percent || 0,
                    label: t('stats.periods.vsLastWeek')
                  }}
                  color="green"
                />
                <KPICard
                  title={t('stats.paymentProviders.last60Days')}
                  value={formatCurrency(paymentSummary.last_60_days.providers.total)}
                  subtitle={`${formatNumber(paymentSummary.last_60_days.providers.total_count)} ${t('stats.revenue.payments')}`}
                  icon={DollarSign}
                  color="blue"
                />
                <KPICard
                  title={t('stats.paymentProviders.accountTotal')}
                  value={formatCurrency(paymentSummary.providers.account)}
                  subtitle={`${formatNumber(paymentSummary.providers.account_count)} ${t('stats.revenue.payments')}`}
                  icon={CreditCard}
                  color="purple"
                />
                <KPICard
                  title={t('stats.paymentProviders.totalTransactions')}
                  value={formatNumber(paymentSummary.providers.total_count)}
                  subtitle={t('stats.paymentProviders.allTime')}
                  icon={DollarSign}
                  color="orange"
                />
              </div>
            </CardContainer>

            {/* Client and Flight Payment Stats */}
            <div className="grid grid-cols-1 gap-4 mt-4">
              {paymentsByClient && (
                <ClientPaymentStatsComponent data={paymentsByClient} />
              )}
              {paymentsByFlight && (
                <FlightPaymentStatsComponent data={paymentsByFlight} />
              )}
            </div>
          </motion.div>
        )}

        {/* Registration Trends */}
        {registrationStats && (
          <motion.div variants={itemVariants} className="mb-6">
            <SectionHeader
              icon={Users}
              title={t('stats.registrations.title')}
              gradientFrom="from-blue-500"
              gradientTo="to-blue-600"
              actions={
                <Button onClick={exportClients} size="sm" className="bg-blue-500 hover:bg-blue-600 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  {t('stats.export.clients')}
                </Button>
              }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <TrendChart
                  data={registrationTrendData}
                  title={t('stats.registrations.chartTitle')}
                  currentLabel={t('stats.registrations.currentPeriod')}
                  previousLabel={t('stats.registrations.previousPeriod')}
                />
              </div>

              <div className="space-y-3">
                <KPICard
                  title={t('stats.registrations.thisWeek')}
                  value={formatNumber(registrationStats.weekly.current_period.count)}
                  trend={{
                    value: registrationStats.weekly.delta_percent,
                    label: t('stats.periods.vsLastWeek')
                  }}
                  color="blue"
                />
                <KPICard
                  title={t('stats.registrations.thisMonth')}
                  value={formatNumber(registrationStats.monthly.current_period.count)}
                  trend={{
                    value: registrationStats.monthly.delta_percent,
                    label: t('stats.periods.vsLastMonth')
                  }}
                  color="blue"
                />
                <KPICard
                  title={t('stats.registrations.lifetimeTotal')}
                  value={formatNumber(registrationStats.total_lifetime)}
                  subtitle={t('stats.registrations.allTimeRegistrations')}
                  color="blue"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Client Activity */}
        {activityStats && (
          <motion.div variants={itemVariants} className="mb-6">
            <SectionHeader
              icon={Activity}
              title={t('stats.activity.titleWithPeriod')}
              gradientFrom="from-green-500"
              gradientTo="to-green-600"
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <PieDonutChart
                data={activityPieData}
                title={t('stats.activity.chartTitle')}
                colors={['#10b981', '#94a3b8']}
                valueFormatter={(value) => formatNumber(value)}
              />

              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { period: 'last_7_days', label: t('stats.periods.last7Days') },
                  { period: 'last_30_days', label: t('stats.periods.last30Days') },
                  { period: 'last_60_days', label: t('stats.periods.last60Days') }
                ].map(({ period, label }) => {
                  const metrics = activityStats[period as keyof typeof activityStats];
                  if (typeof metrics === 'object' && 'active_clients' in metrics) {
                    return (
                      <CardContainer key={period}>
                        <h4 className="text-xs sm:text-sm font-medium text-gray-600 mb-3">{label}</h4>
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-gray-500">{t('stats.activity.active')}</span>
                              <span className="text-xs font-medium text-green-600">
                                {formatNumber(metrics.active_clients)}
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                                style={{
                                  width: `${metrics.total_registered > 0 ? (metrics.active_clients / metrics.total_registered) * 100 : 0}%`
                                }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-gray-500">{t('stats.activity.passive')}</span>
                              <span className="text-xs font-medium text-gray-600">
                                {formatNumber(metrics.passive_clients)}
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-gray-400 h-2 rounded-full transition-all duration-500"
                                style={{
                                  width: `${metrics.total_registered > 0 ? (metrics.passive_clients / metrics.total_registered) * 100 : 0}%`
                                }}
                              />
                            </div>
                          </div>
                          <div className="pt-2 border-t border-gray-100">
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-600">{t('stats.activity.rate')}</span>
                              <span className="text-sm font-bold text-blue-600">
                                {metrics.activity_rate}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContainer>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Cargo Statistics */}
        {cargoStats && (
          <motion.div variants={itemVariants} className="mb-6">
            <SectionHeader
              icon={Package}
              title={t('stats.cargo.title')}
              gradientFrom="from-amber-500"
              gradientTo="to-amber-600"
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <ComparisonBarChart
                  data={cargoComparisonData}
                  title={t('stats.cargo.chartTitle')}
                  valueLabel={t('stats.cargo.currentPeriod')}
                  comparisonLabel={t('stats.cargo.previousPeriod')}
                  color="#f59e0b"
                  comparisonColor="#94a3b8"
                />
              </div>

              <div className="space-y-3">
                <CardContainer>
                  <h4 className="text-xs sm:text-sm font-medium text-gray-600 mb-3">{t('stats.cargo.monthlyDetails')}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs sm:text-sm text-gray-600">{t('stats.cargo.count')}</span>
                      <span className="text-sm font-semibold text-gray-800">
                        {formatNumber(cargoStats.monthly_details.cargo_count)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs sm:text-sm text-gray-600">{t('stats.cargo.clients')}</span>
                      <span className="text-sm font-semibold text-blue-600">
                        {formatNumber(cargoStats.monthly_details.unique_clients)}
                      </span>
                    </div>
                    {cargoStats.monthly_details.total_weight_kg && (
                      <div className="flex justify-between">
                        <span className="text-xs sm:text-sm text-gray-600">{t('stats.cargo.totalWeight')}</span>
                        <span className="text-sm font-semibold text-green-600">
                          {cargoStats.monthly_details.total_weight_kg.toFixed(1)} kg
                        </span>
                      </div>
                    )}
                    {cargoStats.monthly_details.avg_weight_kg && (
                      <div className="flex justify-between">
                        <span className="text-xs sm:text-sm text-gray-600">{t('stats.cargo.avgWeight')}</span>
                        <span className="text-sm font-semibold text-orange-600">
                          {cargoStats.monthly_details.avg_weight_kg.toFixed(1)} kg
                        </span>
                      </div>
                    )}
                  </div>
                </CardContainer>

                <KPICard
                  title={t('stats.cargo.lifetimeCargo')}
                  value={formatNumber(cargoStats.total_lifetime)}
                  subtitle={t('stats.cargo.allTimeUploads')}
                  color="orange"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Revenue Statistics */}
        {revenueStats && (
          <motion.div variants={itemVariants} className="mb-6">
            <SectionHeader
              icon={DollarSign}
              title={t('stats.revenue.title')}
              gradientFrom="from-purple-500"
              gradientTo="to-purple-600"
              actions={
                <Button onClick={() => exportRevenue()} size="sm" className="bg-purple-500 hover:bg-purple-600 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  {t('stats.export.revenue')}
                </Button>
              }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <div className="lg:col-span-2">
                <ComparisonBarChart
                  data={revenueComparisonData}
                  title={t('stats.revenue.chartTitle')}
                  valueLabel={t('stats.revenue.currentPeriod')}
                  comparisonLabel={t('stats.revenue.previousPeriod')}
                  valueFormatter={(value) => formatCurrency(value)}
                  color="#8b5cf6"
                  comparisonColor="#94a3b8"
                />
              </div>

              <div className="space-y-3">
                <KPICard
                  title={t('stats.revenue.weeklyRevenue')}
                  value={formatCurrency(revenueStats.weekly.current_period.total_revenue)}
                  subtitle={`${formatNumber(revenueStats.weekly.current_period.payment_count)} ${t('stats.revenue.payments')}`}
                  trend={{
                    value: revenueStats.weekly.delta_percent,
                    label: t('stats.periods.vsLastWeek')
                  }}
                  color="purple"
                />
                <KPICard
                  title={t('stats.revenue.avgPayment')}
                  value={formatCurrency(revenueStats.avg_lifetime_payment)}
                  subtitle={t('stats.revenue.lifetimeAverage')}
                  color="purple"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {paymentTypeData.length > 0 && (
                <PieDonutChart
                  data={paymentTypeData}
                  title={t('stats.revenue.paymentTypes')}
                  valueFormatter={(value) => formatNumber(value)}
                />
              )}

              <CardContainer className="lg:col-span-2">
                <h3 className="text-base font-semibold text-gray-800 mb-4">{t('stats.revenue.summary')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">{t('stats.revenue.totalLifetime')}</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">
                      {formatCurrency(revenueStats.total_lifetime_revenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">{t('stats.revenue.totalPayments')}</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">
                      {formatNumber(revenueStats.total_lifetime_payments)}
                    </p>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">{t('stats.revenue.avgPayment')}</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">
                      {formatCurrency(revenueStats.avg_lifetime_payment)}
                    </p>
                  </div>
                </div>
              </CardContainer>
            </div>
          </motion.div>
        )}

        {/* Cargo Items Statistics - Xitoy/UZB Warehouse Split */}
        {cargoItemsStats && (
          <motion.div variants={itemVariants} className="mb-6">
            <SectionHeader
              icon={Package}
              title={t('stats.cargoItems.title')}
              gradientFrom="from-indigo-500"
              gradientTo="to-indigo-600"
              actions={
                <>
                  <Button onClick={() => exportCargoItems('xitoy')} size="sm" className="bg-indigo-500 hover:bg-indigo-600 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    🇨🇳 {t('stats.export.cargoXitoy')}
                  </Button>
                  <Button onClick={() => exportCargoItems('uzbek')} size="sm" className="bg-indigo-500 hover:bg-indigo-600 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    🇺🇿 {t('stats.export.cargoUzbek')}
                  </Button>
                </>
              }
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <CardContainer>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🇨🇳 Xitoy baza</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('stats.cargoItems.total')}</p>
                    <p className="text-xl font-bold text-indigo-600">
                      {formatNumber(cargoItemsStats.xitoy_baza.total_items)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('stats.cargoItems.used')}</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatNumber(cargoItemsStats.xitoy_baza.used_items)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('stats.cargoItems.unused')}</p>
                    <p className="text-xl font-bold text-orange-600">
                      {formatNumber(cargoItemsStats.xitoy_baza.unused_items)}
                    </p>
                  </div>
                  {cargoItemsStats.xitoy_baza.total_weight_kg && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{t('stats.cargoItems.weight')}</p>
                      <p className="text-xl font-bold text-blue-600">
                        {cargoItemsStats.xitoy_baza.total_weight_kg.toFixed(1)} kg
                      </p>
                    </div>
                  )}
                </div>
              </CardContainer>

              <CardContainer>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🇺🇿 O'zbek baza</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('stats.cargoItems.total')}</p>
                    <p className="text-xl font-bold text-indigo-600">
                      {formatNumber(cargoItemsStats.uzbek_baza.total_items)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('stats.cargoItems.used')}</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatNumber(cargoItemsStats.uzbek_baza.used_items)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('stats.cargoItems.unused')}</p>
                    <p className="text-xl font-bold text-orange-600">
                      {formatNumber(cargoItemsStats.uzbek_baza.unused_items)}
                    </p>
                  </div>
                  {cargoItemsStats.uzbek_baza.total_weight_kg && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{t('stats.cargoItems.weight')}</p>
                      <p className="text-xl font-bold text-blue-600">
                        {cargoItemsStats.uzbek_baza.total_weight_kg.toFixed(1)} kg
                      </p>
                    </div>
                  )}
                </div>
              </CardContainer>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KPICard
                title={t('stats.cargoItems.combined')}
                value={formatNumber(cargoItemsStats.combined_total)}
                subtitle={t('stats.cargoItems.totalItems')}
                icon={Package}
                color="indigo"
              />
              {cargoItemsTrends && (
                <>
                  <KPICard
                    title={t('stats.cargoItems.weeklyChange')}
                    value={`${cargoItemsTrends.weekly_delta_percent > 0 ? '+' : ''}${cargoItemsTrends.weekly_delta_percent}%`}
                    trend={{
                      value: cargoItemsTrends.weekly_delta_percent,
                      label: t('stats.periods.vsLastWeek')
                    }}
                    color={cargoItemsTrends.weekly_delta_percent >= 0 ? 'green' : 'red'}
                  />
                  <KPICard
                    title={t('stats.cargoItems.monthlyChange')}
                    value={`${cargoItemsTrends.monthly_delta_percent > 0 ? '+' : ''}${cargoItemsTrends.monthly_delta_percent}%`}
                    trend={{
                      value: cargoItemsTrends.monthly_delta_percent,
                      label: t('stats.periods.vsLastMonth')
                    }}
                    color={cargoItemsTrends.monthly_delta_percent >= 0 ? 'green' : 'red'}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Foto Hisobot Statistics */}
        {fotoHisobotStats && (
          <motion.div variants={itemVariants} className="mb-6">
            <SectionHeader
              icon={Camera}
              title={t('stats.fotoHisobot.title')}
              gradientFrom="from-emerald-500"
              gradientTo="to-emerald-600"
              actions={
                <Button onClick={() => exportFotoHisobot()} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  {t('stats.export.fotoHisobot')}
                </Button>
              }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <KPICard
                title={t('stats.fotoHisobot.totalUploads')}
                value={formatNumber(fotoHisobotStats.total_uploads)}
                subtitle={`${formatNumber(fotoHisobotStats.unique_clients)} ${t('stats.fotoHisobot.clients')}`}
                icon={Camera}
                color="emerald"
              />
              <KPICard
                title={t('stats.fotoHisobot.totalPhotos')}
                value={formatNumber(fotoHisobotStats.total_photos)}
                subtitle={`${formatNumber(fotoHisobotStats.unique_flights)} ${t('stats.fotoHisobot.flights')}`}
                icon={Camera}
                color="blue"
              />
              <KPICard
                title={t('stats.fotoHisobot.sent')}
                value={formatNumber(fotoHisobotStats.sent_count)}
                subtitle={t('stats.fotoHisobot.reports')}
                icon={Send}
                color="green"
              />
              <KPICard
                title={t('stats.fotoHisobot.unsent')}
                value={formatNumber(fotoHisobotStats.unsent_count)}
                subtitle={t('stats.fotoHisobot.pending')}
                icon={Send}
                color="orange"
              />
            </div>

            {fotoHisobotStats.top_flights.length > 0 && (
              <CardContainer>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('stats.fotoHisobot.topFlights')}</h3>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-medium text-gray-700">{t('stats.fotoHisobot.flight')}</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-700">{t('stats.fotoHisobot.uploads')}</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-700">{t('stats.fotoHisobot.clients')}</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-700">{t('stats.fotoHisobot.photos')}</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-700">{t('stats.fotoHisobot.sent')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fotoHisobotStats.top_flights.map((flight, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3 font-medium text-gray-900">{flight.flight_name}</td>
                          <td className="text-center py-2 px-3 text-gray-700">{formatNumber(flight.total_uploads)}</td>
                          <td className="text-center py-2 px-3 text-gray-700">{formatNumber(flight.unique_clients)}</td>
                          <td className="text-center py-2 px-3 text-gray-700">{formatNumber(flight.total_photos)}</td>
                          <td className="text-center py-2 px-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${flight.sent_count > 0 ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                              {flight.sent_count}/{flight.total_uploads}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContainer>
            )}
          </motion.div>
        )}

        {/* Delivery Requests Statistics */}
        {deliveryStats && (
          <motion.div variants={itemVariants} className="mb-6">
            <SectionHeader
              icon={Truck}
              title={t('stats.delivery.title')}
              gradientFrom="from-cyan-500"
              gradientTo="to-cyan-600"
              actions={
                <Button onClick={() => exportDeliveryRequests()} size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  {t('stats.export.deliveryRequests')}
                </Button>
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <KPICard
                title={t('stats.delivery.totalRequests')}
                value={formatNumber(deliveryStats.total_requests)}
                subtitle={`${deliveryStats.overall_approval_rate.toFixed(1)}% ${t('stats.delivery.approvalRate')}`}
                icon={Truck}
                color="cyan"
              />
              <KPICard
                title={t('stats.delivery.approved')}
                value={formatNumber(deliveryStats.by_service.reduce((sum, service) => sum + service.approved, 0))}
                subtitle={t('stats.delivery.totalApproved')}
                icon={Truck}
                color="green"
              />
              <KPICard
                title={t('stats.delivery.pending')}
                value={formatNumber(deliveryStats.by_service.reduce((sum, service) => sum + service.pending, 0))}
                subtitle={t('stats.delivery.totalPending')}
                icon={Truck}
                color="orange"
              />
            </div>

            <CardContainer>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('stats.delivery.byService')}</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {deliveryStats.by_service.map((service, index) => (
                  <div key={index} className="text-center p-3 bg-white/40 backdrop-blur-sm rounded-lg border border-white/20">
                    <h4 className="font-medium text-gray-900 mb-2 text-sm">{service.delivery_type}</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t('stats.delivery.total')}</span>
                        <span className="font-medium">{formatNumber(service.total_requests)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-600">{t('stats.delivery.approved')}</span>
                        <span className="font-medium text-green-600">{formatNumber(service.approved)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-orange-600">{t('stats.delivery.pending')}</span>
                        <span className="font-medium text-orange-600">{formatNumber(service.pending)}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        <span className="text-xs font-medium text-blue-600">
                          {service.approval_rate.toFixed(1)}% {t('stats.delivery.rate')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContainer>
          </motion.div>
        )}

        {/* Broadcast Statistics */}
        {broadcastStats && (
          <motion.div variants={itemVariants} className="mb-6">
            <SectionHeader
              icon={Send}
              title={t('stats.broadcast.title')}
              gradientFrom="from-pink-500"
              gradientTo="to-pink-600"
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <KPICard
                title={t('stats.broadcast.totalCampaigns')}
                value={formatNumber(broadcastStats.total_broadcasts)}
                subtitle={`${formatNumber(broadcastStats.completed_broadcasts)} ${t('stats.broadcast.completed')}`}
                icon={Send}
                color="pink"
              />
              <KPICard
                title={t('stats.broadcast.messagesSent')}
                value={formatNumber(broadcastStats.total_messages_sent)}
                subtitle={`${broadcastStats.success_rate.toFixed(1)}% ${t('stats.broadcast.successRate')}`}
                icon={Send}
                color="green"
              />
              <KPICard
                title={t('stats.broadcast.failed')}
                value={formatNumber(broadcastStats.total_failed)}
                subtitle={t('stats.delivery.totalFailed')}
                icon={Send}
                color="red"
              />
              <KPICard
                title={t('stats.broadcast.blocked')}
                value={formatNumber(broadcastStats.total_blocked)}
                subtitle={t('stats.broadcast.usersBlocked')}
                icon={Send}
                color="orange"
              />
            </div>

            <CardContainer>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('stats.broadcast.summary')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t('stats.broadcast.deliveryRate')}</p>
                  <p className="text-xl font-bold text-green-600">
                    {broadcastStats.success_rate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatNumber(broadcastStats.total_messages_sent)} / {formatNumber(broadcastStats.total_messages_sent + broadcastStats.total_failed)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t('stats.broadcast.completionRate')}</p>
                  <p className="text-xl font-bold text-blue-600">
                    {broadcastStats.total_broadcasts > 0 ? ((broadcastStats.completed_broadcasts / broadcastStats.total_broadcasts) * 100).toFixed(1) : '0'}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatNumber(broadcastStats.completed_broadcasts)} / {formatNumber(broadcastStats.total_broadcasts)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t('stats.broadcast.blockRate')}</p>
                  <p className="text-xl font-bold text-orange-600">
                    {broadcastStats.total_messages_sent > 0 ? ((broadcastStats.total_blocked / broadcastStats.total_messages_sent) * 100).toFixed(2) : '0'}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatNumber(broadcastStats.total_blocked)} {t('stats.broadcast.users')}
                  </p>
                </div>
              </div>
            </CardContainer>
          </motion.div>
        )}

        {/* Global Dashboard Summary */}
        {globalStats && (
          <motion.div variants={itemVariants} className="mb-4">
            <SectionHeader
              icon={BarChart3}
              title={t('stats.global.title')}
              gradientFrom="from-purple-500"
              gradientTo="to-purple-600"
              actions={
                <>
                  <Button onClick={exportAllStats} size="sm" className="bg-purple-500 hover:bg-purple-600 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    {t('stats.export.all')}
                  </Button>
                  <Button onClick={() => exportApiLogs()} size="sm" className="bg-gray-500 hover:bg-gray-600 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    {t('stats.export.apiLogs')}
                  </Button>
                </>
              }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <KPICard
                title={t('stats.global.totalClients')}
                value={formatNumber(globalStats.total_registered_clients)}
                subtitle={`${formatNumber(globalStats.total_approved_clients)} ${t('stats.global.approved')}`}
                icon={Users}
                color="purple"
              />
              <KPICard
                title={t('stats.global.activeClients')}
                value={formatNumber(globalStats.active_clients_30_days)}
                subtitle={t('stats.global.last30Days')}
                icon={Activity}
                color="green"
              />
              <KPICard
                title={t('stats.global.totalCargoItems')}
                value={formatNumber(globalStats.total_cargo_items)}
                subtitle={`🇨🇳 ${formatNumber(globalStats.cargo_items_xitoy)} | 🇺🇿 ${formatNumber(globalStats.cargo_items_uzbek)}`}
                icon={Package}
                color="orange"
              />
              <KPICard
                title={t('stats.global.totalRevenue')}
                value={formatCurrency(globalStats.total_lifetime_revenue)}
                subtitle={`${globalStats.revenue_growth_percent > 0 ? '+' : ''}${globalStats.revenue_growth_percent.toFixed(1)}% ${t('stats.global.growth')}`}
                icon={DollarSign}
                color="purple"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CardContainer>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('stats.global.fotoHisobotSummary')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('stats.global.totalUploads')}</p>
                    <p className="text-xl font-bold text-emerald-600">
                      {formatNumber(globalStats.total_foto_hisobot_uploads)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('stats.global.thisMonth')}</p>
                    <p className="text-xl font-bold text-blue-600">
                      {formatNumber(globalStats.foto_hisobot_this_month)}
                    </p>
                  </div>
                </div>
              </CardContainer>

              <CardContainer>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('stats.global.systemStats')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('stats.global.apiRequests')}</p>
                    <p className="text-xl font-bold text-cyan-600">
                      {formatNumber(globalStats.total_api_requests)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('stats.global.errorRate')}</p>
                    <p className="text-xl font-bold text-red-600">
                      {globalStats.api_error_rate.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </CardContainer>
            </div>
          </motion.div>
        )}
      </motion.div>
    </>
  );
}
