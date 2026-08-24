import { apiClient } from '../client';

export interface HomeSummaryResponse {
  active_cargo_count: number;
  unpaid_total: number;
  unpaid_flight_count: number;
}

/**
 * The two figures on the home screen, in one call.
 *
 * Deliberately one request rather than three: the home screen is the first
 * thing a client sees, often on a mobile connection, and separate calls would
 * settle at different moments with three loading states flickering in turn.
 */
export async function getHomeSummary(): Promise<HomeSummaryResponse> {
  const response = await apiClient.get<HomeSummaryResponse>('/api/v1/user/home-summary');
  return response.data;
}
