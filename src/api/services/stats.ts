import { apiClient } from '../client';

export const getAdminHeaders = () => {
  const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
  return { 'X-Admin-Authorization': `Bearer ${token}` };
};

// -------------------------------------------------------------
// 1. CARGO STATS
// -------------------------------------------------------------
export interface CargoVolumeStats {
  total_cargos: number;
  total_weight_kg: string | number;
  avg_weight_per_client: string | number;
  avg_weight_per_track: string | number;
}
export interface CargoBottleneckStats {
  china_unaccounted: number;
  uz_pending_payment: number;
  uz_paid_not_taken: number;
  uz_taken_away: number;
  post_approved: number;
}
export interface CargoSpeedStats {
  china_to_uz_days: string | number;
  uz_warehouse_days: string | number;
  full_cycle_days: string | number;
}
export interface FlightVolumeItem {
  flight_name: string;
  cargo_count: number;
  total_weight_kg: string | number;
}
export interface PeriodVolumeItem {
  period_name: string;
  search_count: number;
}
export interface CargoStatsResponse {
  volume: CargoVolumeStats;
  bottlenecks: CargoBottleneckStats;
  speed: CargoSpeedStats;
  top_flights: FlightVolumeItem[];
  period_trends: PeriodVolumeItem[];
}

export const getCargoStats = async (startDate?: string, endDate?: string): Promise<CargoStatsResponse> => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  const res = await apiClient.get<CargoStatsResponse>(`/api/v1/statistics/cargo?${params.toString()}`, {
    headers: getAdminHeaders()
  });
  return res.data;
};

// -------------------------------------------------------------
// 2. CLIENT STATS
// -------------------------------------------------------------
export interface OverviewStats {
  total_clients: number;
  new_clients: number;
  active_clients: number;
  passive_clients: number;
  zombie_clients: number;
  logged_in_clients: number;
}
export interface RetentionStats {
  repeat_clients: number;
  one_time_clients: number;
  most_frequent_clients: number;
}
export interface DistrictDetail {
  code: string;
  count: number;
  revenue: number;
  paid: number;
  debt: number;
}
export interface RegionDetail {
  code: string;
  count: number;
  revenue: number;
  paid: number;
  debt: number;
  districts: Record<string, DistrictDetail>;
}
export interface DeliveryStatItem {
  method: string;
  count: number;
}
export interface ClientStatsResponse {
  overview: OverviewStats;
  retention: RetentionStats;
  regions: Record<string, RegionDetail>;
  delivery_methods: DeliveryStatItem[];
}

export const getClientStats = async (startDate?: string, endDate?: string): Promise<ClientStatsResponse> => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  const res = await apiClient.get<ClientStatsResponse>(`/api/v1/statistics/clients?${params.toString()}`, {
    headers: getAdminHeaders()
  });
  return res.data;
};

// -------------------------------------------------------------
// 3. FINANCIAL STATS
// -------------------------------------------------------------
export interface PeriodicRevenue {
  period: string;
  revenue: number;
  paid: number;
  debt: number;
}
export interface PaymentMethodStat {
  method: string;
  total_amount: number;
  count: number;
}
export interface RegionStat {
  region_code: string;
  region_name: string;
  revenue: number;
  paid: number;
  debt: number;
}
export interface TopClientStat {
  client_code: string;
  revenue: number;
  paid: number;
  debt: number;
}
export interface FlightCollectionStat {
  flight_name: string;
  revenue: number;
  paid: number;
  collection_rate: number;
}
export interface FinancialStatsResponse {
  total_revenue: number;
  total_paid: number;
  total_debt: number;
  total_profitability: number;
  overdue_debt: number;
  average_payment: number;
  periodic_revenue: PeriodicRevenue[];
  payment_methods: PaymentMethodStat[];
  regions: RegionStat[];
  top_clients: TopClientStat[];
  flight_collections: FlightCollectionStat[];
}

export const getFinancialStats = async (startDate?: string, endDate?: string, baseCostUsd: number = 8.0): Promise<FinancialStatsResponse> => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  params.append('base_cost_usd', baseCostUsd.toString());
  
  const res = await apiClient.get<FinancialStatsResponse>(`/api/v1/statistics/financial?${params.toString()}`, {
    headers: getAdminHeaders()
  });
  return res.data;
};

// -------------------------------------------------------------
// 4. OPERATIONAL STATS
// -------------------------------------------------------------
export interface StageAvgTime {
  stage_name: string;
  avg_days: number;
}
export interface DeliveryTypeStat {
  delivery_type: string;
  count: number;
  percentage: number;
}
export interface BottleneckInfo {
  stage_name: string;
  avg_days: number;
}
export interface OperationalStatsResponse {
  start_date?: string;
  end_date?: string;
  total_cargos_analyzed: number;
  stages: StageAvgTime[];
  delivery_types: DeliveryTypeStat[];
  bottlenecks: BottleneckInfo[];
}

export const getOperationalStats = async (startDate?: string, endDate?: string): Promise<OperationalStatsResponse> => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  const res = await apiClient.get<OperationalStatsResponse>(`/api/v1/operational/summary?${params.toString()}`, {
    headers: getAdminHeaders()
  });
  return res.data;
};

// -------------------------------------------------------------
// 5. ANALYTICS STATS
// -------------------------------------------------------------
export interface AnalyticsEventItem {
  id: number;
  event_type: string;
  user_id: number | null;
  event_data: Record<string, unknown> | null;
  created_at: string;
}

export interface AnalyticsEventPage {
  items: AnalyticsEventItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AnalyticsDailyTrendItem {
  date: string;
  count: number;
}

export interface AnalyticsEventTypeSummary {
  event_type: string;
  total_count: number;
  unique_users: number;
  last_occurrence: string | null;
}

export interface AnalyticsStatsResponse {
  summary: AnalyticsEventTypeSummary[];
  daily_trends: AnalyticsDailyTrendItem[];
}

export const getAnalyticsStats = async (
  startDate?: string,
  endDate?: string,
  eventType?: string,
): Promise<AnalyticsStatsResponse> => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (eventType) params.append('event_type', eventType);

  const res = await apiClient.get<AnalyticsStatsResponse>(
    `/api/v1/statistics/analytics?${params.toString()}`,
    { headers: getAdminHeaders() },
  );
  return res.data;
};

export const getAnalyticsEvents = async (
  startDate?: string,
  endDate?: string,
  eventType?: string,
  page = 1,
  pageSize = 50,
): Promise<AnalyticsEventPage> => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (eventType) params.append('event_type', eventType);
  params.append('page', page.toString());
  params.append('page_size', pageSize.toString());

  const res = await apiClient.get<AnalyticsEventPage>(
    `/api/v1/statistics/analytics/events?${params.toString()}`,
    { headers: getAdminHeaders() },
  );
  return res.data;
};

// -------------------------------------------------------------
// EXPORTS — triggers .xlsx file download via blob
// -------------------------------------------------------------

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}

export const exportCargoStats = async (startDate?: string, endDate?: string): Promise<void> => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const res = await apiClient.get(`/api/v1/statistics/cargo/export?${params.toString()}`, {
    headers: getAdminHeaders(),
    responseType: 'blob',
  });
  const sd = startDate ?? 'boshidan';
  const ed = endDate ?? 'hozirgacha';
  triggerBlobDownload(res.data as Blob, `yuklar_statistikasi_${sd}_${ed}.xlsx`);
};

export const exportClientStats = async (startDate?: string, endDate?: string): Promise<void> => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const res = await apiClient.get(`/api/v1/statistics/clients/export?${params.toString()}`, {
    headers: getAdminHeaders(),
    responseType: 'blob',
  });
  const sd = startDate ?? 'boshidan';
  const ed = endDate ?? 'hozirgacha';
  triggerBlobDownload(res.data as Blob, `mijozlar_statistikasi_${sd}_${ed}.xlsx`);
};

export const exportZombieClients = async (startDate?: string, endDate?: string): Promise<void> => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const res = await apiClient.get(`/api/v1/statistics/clients/export/zombie?${params.toString()}`, {
    headers: getAdminHeaders(),
    responseType: 'blob',
  });
  const sd = startDate ?? 'boshidan';
  const ed = endDate ?? 'hozirgacha';
  triggerBlobDownload(res.data as Blob, `zombie_mijozlar_${sd}_${ed}.xlsx`);
};

export const exportPassiveClients = async (startDate?: string, endDate?: string): Promise<void> => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const res = await apiClient.get(`/api/v1/statistics/clients/export/passive?${params.toString()}`, {
    headers: getAdminHeaders(),
    responseType: 'blob',
  });
  const sd = startDate ?? 'boshidan';
  const ed = endDate ?? 'hozirgacha';
  triggerBlobDownload(res.data as Blob, `passiv_mijozlar_${sd}_${ed}.xlsx`);
};

export const exportFrequentClients = async (minFlights = 5): Promise<void> => {
  const params = new URLSearchParams();
  params.append('min_flights', minFlights.toString());

  const res = await apiClient.get(`/api/v1/statistics/clients/export/frequent?${params.toString()}`, {
    headers: getAdminHeaders(),
    responseType: 'blob',
  });
  triggerBlobDownload(res.data as Blob, `faol_mijozlar_${minFlights}plus_reys.xlsx`);
};

export const exportFinancialStats = async (startDate?: string, endDate?: string, baseCostUsd = 8.0): Promise<void> => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  params.append('base_cost_usd', baseCostUsd.toString());

  const res = await apiClient.get(`/api/v1/statistics/financial/export?${params.toString()}`, {
    headers: getAdminHeaders(),
    responseType: 'blob',
  });
  const sd = startDate ?? 'boshidan';
  const ed = endDate ?? 'hozirgacha';
  triggerBlobDownload(res.data as Blob, `moliyaviy_statistika_${sd}_${ed}.xlsx`);
};

export const exportOperationalStats = async (startDate?: string, endDate?: string): Promise<void> => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const res = await apiClient.get(`/api/v1/operational/export?${params.toString()}`, {
    headers: getAdminHeaders(),
    responseType: 'blob',
  });
  const sd = startDate ?? 'boshidan';
  const ed = endDate ?? 'hozirgacha';
  triggerBlobDownload(res.data as Blob, `operatsion_statistika_${sd}_${ed}.xlsx`);
};
