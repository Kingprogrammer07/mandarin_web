import { apiClient } from '@/api/client';

export interface MaintenanceStatusResponse {
  maintenance: boolean;
  is_admin: boolean;
}

export const systemService = {
  async getMaintenanceStatus(): Promise<MaintenanceStatusResponse> {
    const { data } = await apiClient.get<MaintenanceStatusResponse>('/api/v1/system/maintenance-status');
    return data;
  },
};
