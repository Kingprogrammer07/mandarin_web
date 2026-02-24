import { apiClient } from '../client';

export interface Notification {
  id: number;
  client_id: number;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  page: number;
  size: number;
}

export interface UnreadCountResponse {
  count: number;
}

export const notificationService = {
  getNotifications: async (page = 1, size = 20): Promise<NotificationListResponse> => {
    const response = await apiClient.get<NotificationListResponse>('/api/v1/notifications/', {
      params: { page, size },
    });
    return response.data;
  },

  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    const response = await apiClient.get<UnreadCountResponse>('/api/v1/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (id: number): Promise<{ status: string }> => {
    const response = await apiClient.post<{ status: string }>(`/api/v1/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async (): Promise<{ status: string; updated: number }> => {
    const response = await apiClient.post<{ status: string; updated: number }>('/api/v1/notifications/read-all');
    return response.data;
  },
};
