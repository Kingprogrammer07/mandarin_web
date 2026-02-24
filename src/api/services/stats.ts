import { apiClient } from '../client';

// Base interfaces for statistics
export interface PeriodData {
  count: number;
  start_date: string;
  end_date: string;
}

export interface PeriodComparison {
  current_period: PeriodData;
  previous_period: PeriodData;
  delta_absolute: number;
  delta_percent: number;
}

// NEW: Today vs Yesterday comparison interface
export interface TodayYesterdayComparison {
  today_count: number;
  yesterday_count: number;
  difference: number;
  percent_change: number;
  is_growth: boolean;
  today_date: string;
  yesterday_date: string;
}

// NEW: Today vs Yesterday activity comparison
export interface TodayYesterdayActivityComparison {
  today_active: number;
  yesterday_active: number;
  difference: number;
  percent_change: number;
  is_growth: boolean;
  today_date: string;
  yesterday_date: string;
}

// NEW: Today vs Yesterday revenue comparison
export interface TodayYesterdayRevenueComparison {
  today_revenue: number;
  yesterday_revenue: number;
  today_count: number;
  yesterday_count: number;
  difference: number;
  percent_change: number;
  is_growth: boolean;
  today_date: string;
  yesterday_date: string;
}

export interface ActivityMetrics {
  active_clients: number;
  passive_clients: number;
  total_registered: number;
  activity_rate: number;
}

export interface CargoTrendData {
  cargo_count: number;
  unique_clients: number;
  total_weight_kg: number | null;
  avg_weight_kg: number | null;
  start_date: string;
  end_date: string;
}

export interface RevenueData {
  total_revenue: number;
  payment_count: number;
  avg_payment: number;
  full_payments_count: number;
  partial_payments_count: number;
  start_date: string;
  end_date: string;
}

export interface RevenuePeriodComparison {
  current_period: RevenueData;
  previous_period: RevenueData;
  delta_absolute: number;
  delta_percent: number;
}

// Registration Statistics - UPDATED with today_vs_yesterday
export interface RegistrationStatsResponse {
  today_vs_yesterday: TodayYesterdayComparison;
  daily: PeriodComparison;
  weekly: PeriodComparison;
  monthly: PeriodComparison;
  current_month_vs_previous: PeriodComparison;
  total_lifetime: number;
}

// Client Activity Statistics - UPDATED with today_vs_yesterday
export interface ClientActivityStatsResponse {
  today_vs_yesterday?: TodayYesterdayActivityComparison;
  last_7_days: ActivityMetrics;
  last_30_days: ActivityMetrics;
  last_60_days: ActivityMetrics;
  calculated_at: string;
}

// Cargo Statistics - UPDATED with today_vs_yesterday
export interface CargoStatsResponse {
  today_vs_yesterday?: TodayYesterdayComparison;
  weekly_comparison: PeriodComparison;
  weekly_details: CargoTrendData;
  monthly_comparison: PeriodComparison;
  monthly_details: CargoTrendData;
  current_month_vs_previous: PeriodComparison;
  total_lifetime: number;
}

// Revenue Statistics - UPDATED with today_vs_yesterday
export interface RevenueStatsResponse {
  today_vs_yesterday?: TodayYesterdayRevenueComparison;
  weekly: RevenuePeriodComparison;
  monthly: RevenuePeriodComparison;
  current_month_vs_previous: RevenuePeriodComparison;
  total_lifetime_revenue: number;
  total_lifetime_payments: number;
  avg_lifetime_payment: number;
}

// Bot Lifecycle Statistics
export interface BotLifecycleStatsResponse {
  bot_launch_date: string;
  days_since_launch: number;
  total_users: number;
  total_approved_clients: number;
  total_cargo_uploads: number;
  total_payments: number;
  total_revenue: number;
  avg_users_per_day: number;
  avg_cargo_per_day: number;
  avg_revenue_per_day: number;
  calculated_at: string;
}

// ============================================================================
// DOMAIN-SPECIFIC STATISTICS INTERFACES
// ============================================================================

export interface CargoItemWarehouseStats {
  warehouse_name: string;
  checkin_status: string;
  total_items: number;
  used_items: number;
  unused_items: number;
  total_weight_kg: number | null;
  avg_weight_kg: number | null;
  total_declared_value: number | null;
  avg_declared_value: number | null;
}

export interface CargoItemsStatsResponse {
  xitoy_baza: CargoItemWarehouseStats;
  uzbek_baza: CargoItemWarehouseStats;
  combined_total: number;
  calculated_at: string;
}

export interface CargoItemsTrendData {
  period_start: string;
  period_end: string;
  xitoy_count: number;
  uzbek_count: number;
  total_count: number;
}

export interface CargoItemsTrendsResponse {
  weekly_current: CargoItemsTrendData;
  weekly_previous: CargoItemsTrendData;
  weekly_delta_percent: number;
  monthly_current: CargoItemsTrendData;
  monthly_previous: CargoItemsTrendData;
  monthly_delta_percent: number;
  lifetime_stats: CargoItemsStatsResponse;
}

export interface FotoHisobotFlightStats {
  flight_name: string;
  total_uploads: number;
  unique_clients: number;
  total_photos: number;
  total_weight_kg: number | null;
  avg_weight_kg: number | null;
  sent_count: number;
  unsent_count: number;
}

export interface FotoHisobotStatsResponse {
  total_uploads: number;
  total_photos: number;
  unique_clients: number;
  unique_flights: number;
  total_weight_kg: number | null;
  sent_count: number;
  unsent_count: number;
  top_flights: FotoHisobotFlightStats[];
  calculated_at: string;
}

export interface FotoHisobotTrendsResponse {
  daily_comparison: PeriodComparison;
  weekly_comparison: PeriodComparison;
  monthly_comparison: PeriodComparison;
  current_month_vs_previous: PeriodComparison;
  lifetime_total: number;
}

export interface DeliveryServiceStats {
  delivery_type: string;
  total_requests: number;
  pending: number;
  approved: number;
  rejected: number;
  approval_rate: number;
}

export interface DeliveryRequestsStatsResponse {
  total_requests: number;
  by_service: DeliveryServiceStats[];
  overall_approval_rate: number;
  calculated_at: string;
}

export interface BroadcastStatsResponse {
  total_broadcasts: number;
  completed_broadcasts: number;
  total_messages_sent: number;
  total_failed: number;
  total_blocked: number;
  success_rate: number;
  calculated_at: string;
}

export interface GlobalDashboardStats {
  total_registered_clients: number;
  total_approved_clients: number;
  active_clients_30_days: number;
  total_lifetime_revenue: number;
  revenue_this_month: number;
  revenue_last_month: number;
  revenue_growth_percent: number;
  total_foto_hisobot_uploads: number;
  foto_hisobot_this_month: number;
  total_cargo_items: number;
  cargo_items_xitoy: number;
  cargo_items_uzbek: number;
  total_payments: number;
  payments_this_month: number;
  total_api_requests: number;
  api_error_rate: number;
  bot_launch_date: string;
  days_since_launch: number;
  calculated_at: string;
  // NEW: Payment provider breakdown fields
  provider_totals?: ProviderTotals;
  provider_share?: ProviderSharePercentages;
  daily_comparison?: {
    today: ProviderTotals;
    yesterday: ProviderTotals;
    growth: GrowthMetrics;
  };
  this_week_providers?: ProviderTotals;
  this_month_providers?: ProviderTotals;
  weekly_growth?: GrowthMetrics;
  monthly_growth?: GrowthMetrics;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label: string | null;
}

export interface ChartDataSeries {
  series_name: string;
  data_points: ChartDataPoint[];
}

export interface TimeSeriesChartResponse {
  chart_title: string;
  series: ChartDataSeries[];
  x_axis_label: string;
  y_axis_label: string;
  period_start: string;
  period_end: string;
}

// ============================================================================
// PAYMENT PROVIDER INTERFACES - NEW MIXED PAYMENT SYSTEM
// ============================================================================

export interface ProviderTotals {
  cash: number;
  click: number;
  payme: number;
  account: number;
  total: number;
  cash_count: number;
  click_count: number;
  payme_count: number;
  account_count: number;
  total_count: number;
}

export interface ProviderSharePercentages {
  cash_percent: number;
  click_percent: number;
  payme_percent: number;
  account_percent: number;
}

export interface PaymentPeriodData {
  start_date: string;
  end_date: string;
  providers: ProviderTotals;
  share_percentages?: ProviderSharePercentages;
}

export interface GrowthMetrics {
  difference: number;
  percent?: number;
  is_new: boolean;
}

export interface ProviderGrowthMetrics {
  total: GrowthMetrics;
  cash: GrowthMetrics;
  click: GrowthMetrics;
  payme: GrowthMetrics;
  account: GrowthMetrics;
}

export interface PeriodPaymentComparison {
  current: PaymentPeriodData;
  previous: PaymentPeriodData;
  growth: ProviderGrowthMetrics;
}

export interface PaymentSummaryResponse {
  providers: ProviderTotals;
  share_percentages: ProviderSharePercentages;
  today: PaymentPeriodData;
  yesterday: PaymentPeriodData;
  this_week: PaymentPeriodData;
  previous_week: PaymentPeriodData;
  this_month: PaymentPeriodData;
  previous_month: PaymentPeriodData;
  last_7_days: PaymentPeriodData;
  last_60_days: PaymentPeriodData;
  growth: {
    daily: ProviderGrowthMetrics;
    weekly: ProviderGrowthMetrics;
    monthly: ProviderGrowthMetrics;
  };
  calculated_at: string;
}

export interface DailyPaymentStats {
  date: string;
  providers: ProviderTotals;
}

export interface PaymentDailyResponse {
  days: DailyPaymentStats[];
  period_totals: ProviderTotals;
  start_date: string;
  end_date: string;
  total_days: number;
}

export interface WeeklyPaymentStats {
  week_start: string;
  week_end: string;
  week_number: number;
  year: number;
  providers: ProviderTotals;
}

export interface PaymentWeeklyResponse {
  weeks: WeeklyPaymentStats[];
  period_totals: ProviderTotals;
  total_weeks: number;
}

export interface MonthlyPaymentStats {
  month: number;
  year: number;
  month_name: string;
  providers: ProviderTotals;
}

export interface PaymentMonthlyResponse {
  months: MonthlyPaymentStats[];
  period_totals: ProviderTotals;
  total_months: number;
}

export interface PaymentCompareResponse {
  daily: PeriodPaymentComparison;
  weekly: PeriodPaymentComparison;
  monthly: PeriodPaymentComparison;
  calculated_at: string;
}

export interface ClientPaymentStats {
  client_code: string;
  providers: ProviderTotals;
  first_payment_date?: string;
  last_payment_date?: string;
  total_transactions: number;
}

export interface ClientPaymentStatsResponse {
  clients: ClientPaymentStats[];
  total_clients: number;
  period_start?: string;
  period_end?: string;
}

export interface FlightPaymentStats {
  flight_name: string;
  providers: ProviderTotals;
  unique_clients: number;
  total_transactions: number;
}

export interface FlightPaymentStatsResponse {
  flights: FlightPaymentStats[];
  total_flights: number;
  period_start?: string;
  period_end?: string;
}

// API Functions
export const getRegistrationStatistics = async (): Promise<RegistrationStatsResponse> => {
  const response = await apiClient.get<RegistrationStatsResponse>('/api/v1/stats/registrations');
  return response.data;
};

export const getClientActivityStatistics = async (): Promise<ClientActivityStatsResponse> => {
  const response = await apiClient.get<ClientActivityStatsResponse>('/api/v1/stats/activity');
  return response.data;
};

export const getCargoTrendStatistics = async (): Promise<CargoStatsResponse> => {
  const response = await apiClient.get<CargoStatsResponse>('/api/v1/stats/cargo-trends');
  return response.data;
};

export const getRevenueStatistics = async (): Promise<RevenueStatsResponse> => {
  const response = await apiClient.get<RevenueStatsResponse>('/api/v1/stats/revenue');
  return response.data;
};

export const getBotLifecycleStatistics = async (): Promise<BotLifecycleStatsResponse> => {
  const response = await apiClient.get<BotLifecycleStatsResponse>('/api/v1/stats/lifecycle');
  return response.data;
};

// ============================================================================
// DOMAIN-SPECIFIC STATISTICS API FUNCTIONS
// ============================================================================

export const getCargoItemsStatistics = async (): Promise<CargoItemsStatsResponse> => {
  const response = await apiClient.get<CargoItemsStatsResponse>('/api/v1/stats/domain/cargo-items');
  return response.data;
};

export const getCargoItemsTrends = async (): Promise<CargoItemsTrendsResponse> => {
  const response = await apiClient.get<CargoItemsTrendsResponse>('/api/v1/stats/domain/cargo-items/trends');
  return response.data;
};

export const getFotoHisobotStatistics = async (): Promise<FotoHisobotStatsResponse> => {
  const response = await apiClient.get<FotoHisobotStatsResponse>('/api/v1/stats/domain/foto-hisobot');
  return response.data;
};

export const getFotoHisobotTrends = async (): Promise<FotoHisobotTrendsResponse> => {
  const response = await apiClient.get<FotoHisobotTrendsResponse>('/api/v1/stats/domain/foto-hisobot/trends');
  return response.data;
};

export const getDeliveryRequestsStatistics = async (): Promise<DeliveryRequestsStatsResponse> => {
  const response = await apiClient.get<DeliveryRequestsStatsResponse>('/api/v1/stats/domain/delivery-requests');
  return response.data;
};

export const getBroadcastStatistics = async (): Promise<BroadcastStatsResponse> => {
  const response = await apiClient.get<BroadcastStatsResponse>('/api/v1/stats/domain/broadcast');
  return response.data;
};

export const getGlobalDashboardStatistics = async (): Promise<GlobalDashboardStats> => {
  const response = await apiClient.get<GlobalDashboardStats>('/api/v1/stats/global');
  return response.data;
};

export const getTimeSeriesChart = async (chartType: string): Promise<TimeSeriesChartResponse> => {
  const response = await apiClient.get<TimeSeriesChartResponse>(`/api/v1/stats/charts/${chartType}`);
  return response.data;
};

// ============================================================================
// NEW PAYMENT STATISTICS API FUNCTIONS
// ============================================================================

export const getPaymentSummary = async (): Promise<PaymentSummaryResponse> => {
  const response = await apiClient.get<PaymentSummaryResponse>('/api/v1/stats/payments/summary');
  return response.data;
};

export const getPaymentDailyStats = async (
  startDate?: string,
  endDate?: string
): Promise<PaymentDailyResponse> => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  const queryString = params.toString();
  const url = `/api/v1/stats/payments/daily${queryString ? `?${queryString}` : ''}`;
  const response = await apiClient.get<PaymentDailyResponse>(url);
  return response.data;
};

export const getPaymentWeeklyStats = async (weeks: number = 12): Promise<PaymentWeeklyResponse> => {
  const response = await apiClient.get<PaymentWeeklyResponse>(`/api/v1/stats/payments/weekly?weeks=${weeks}`);
  return response.data;
};

export const getPaymentMonthlyStats = async (months: number = 12): Promise<PaymentMonthlyResponse> => {
  const response = await apiClient.get<PaymentMonthlyResponse>(`/api/v1/stats/payments/monthly?months=${months}`);
  return response.data;
};

export const getPaymentComparisons = async (): Promise<PaymentCompareResponse> => {
  const response = await apiClient.get<PaymentCompareResponse>('/api/v1/stats/payments/compare');
  return response.data;
};

export const getPaymentsByClient = async (
  startDate?: string,
  endDate?: string,
  limit: number = 100
): Promise<ClientPaymentStatsResponse> => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  params.append('limit', limit.toString());
  const queryString = params.toString();
  const url = `/api/v1/stats/payments/by-client${queryString ? `?${queryString}` : ''}`;
  const response = await apiClient.get<ClientPaymentStatsResponse>(url);
  return response.data;
};

export const getPaymentsByFlight = async (
  startDate?: string,
  endDate?: string,
  limit: number = 100
): Promise<FlightPaymentStatsResponse> => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  params.append('limit', limit.toString());
  const queryString = params.toString();
  const url = `/api/v1/stats/payments/by-flight${queryString ? `?${queryString}` : ''}`;
  const response = await apiClient.get<FlightPaymentStatsResponse>(url);
  return response.data;
};

// ============================================================================
// EXPORT API FUNCTIONS
// ============================================================================

const getApiBaseUrl = (): string => {
  return apiClient.defaults.baseURL || '';
};

export const exportClients = (): void => {
  window.location.href = `${getApiBaseUrl()}/api/v1/stats/export/clients`;
};

export const exportFotoHisobot = (flightName?: string): void => {
  const params = flightName ? `?flight_name=${encodeURIComponent(flightName)}` : '';
  window.location.href = `${getApiBaseUrl()}/api/v1/stats/export/foto-hisobot${params}`;
};

export const exportCargoItems = (warehouse?: string): void => {
  const params = warehouse ? `?warehouse=${encodeURIComponent(warehouse)}` : '';
  window.location.href = `${getApiBaseUrl()}/api/v1/stats/export/cargo-items${params}`;
};

export const exportRevenue = (startDate?: string, endDate?: string, paymentType?: string): void => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (paymentType) params.append('payment_type', paymentType);
  const queryString = params.toString();
  window.location.href = `${getApiBaseUrl()}/api/v1/stats/export/revenue${queryString ? `?${queryString}` : ''}`;
};

export const exportPayments = (
  startDate?: string,
  endDate?: string,
  provider?: 'cash' | 'click' | 'payme',
  format: 'csv' | 'json' = 'csv'
): void => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (provider) params.append('provider', provider);
  params.append('format', format);
  const queryString = params.toString();
  window.location.href = `${getApiBaseUrl()}/api/v1/stats/payments/export${queryString ? `?${queryString}` : ''}`;
};

export const exportPaymentSummary = (): void => {
  window.location.href = `${getApiBaseUrl()}/api/v1/stats/payments/export/summary`;
};

export const exportApiLogs = (startDate?: string, endDate?: string): void => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  const queryString = params.toString();
  window.location.href = `${getApiBaseUrl()}/api/v1/stats/export/api-logs${queryString ? `?${queryString}` : ''}`;
};

export const exportDeliveryRequests = (deliveryType?: string): void => {
  const params = deliveryType ? `?delivery_type=${encodeURIComponent(deliveryType)}` : '';
  window.location.href = `${getApiBaseUrl()}/api/v1/stats/export/delivery-requests${params}`;
};

export const exportAllStats = (): void => {
  window.location.href = `${getApiBaseUrl()}/api/v1/stats/export/all`;
};

export const exportExcel = (): void => {
  window.location.href = `${getApiBaseUrl()}/api/v1/stats/export/excel`;
};

export const exportCsv = (): void => {
  window.location.href = `${getApiBaseUrl()}/api/v1/stats/export/csv`;
};