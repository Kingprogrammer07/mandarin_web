import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import {
    type ProfileResponse,
    type UpdateProfileRequest,
    type PaymentReminderResponse,
    type SessionHistoryResponse
} from '@/types/profile';

// --- API FUNCTIONS ---

const getProfile = async (): Promise<ProfileResponse> => {
    const { data } = await apiClient.get<ProfileResponse>('/api/v1/profile/me');

    // Inject Telegram photo if avatar is missing
    if (!data.avatar_url && window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url) {
        data.avatar_url = window.Telegram.WebApp.initDataUnsafe.user.photo_url;
    }

    return data;
};

const updateProfile = async (data: UpdateProfileRequest): Promise<ProfileResponse> => {
    const { data: response } = await apiClient.patch<ProfileResponse>('/api/v1/profile/me', data);
    return response;
};

const getPaymentReminders = async (): Promise<PaymentReminderResponse> => {
    const { data } = await apiClient.get<PaymentReminderResponse>('/api/v1/profile/payments/reminders');
    return data;
};

const getSessionHistory = async (page = 1, limit = 10): Promise<SessionHistoryResponse> => {
    const { data } = await apiClient.get<SessionHistoryResponse>('/api/v1/profile/sessions', {
        params: { page, limit }
    });
    return data;
};

const logoutUser = async (): Promise<{ message: string }> => {
    const { data } = await apiClient.post<{ message: string }>('/api/v1/profile/logout');
    return data;
};

// --- HOOKS ---

export const useProfile = () => {
    return useQuery({
        queryKey: ['profile', 'me'],
        queryFn: getProfile,
        staleTime: 1000 * 60 * 5, // 5 mins
    });
};

export const useUpdateProfile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateProfile,
        onSuccess: (newData) => {
            // Update cache
            queryClient.setQueryData(['profile', 'me'], newData);
        },
        onError: (error: unknown) => {
            console.error("Profile update failed", error);
        }
    });
};

export const usePaymentReminders = () => {
    return useQuery({
        queryKey: ['profile', 'reminders'],
        queryFn: getPaymentReminders,
        staleTime: 1000 * 60 * 2, // 2 mins
    });
};

export const useSessionHistory = (page = 1) => {
    return useQuery({
        queryKey: ['profile', 'sessions', page],
        queryFn: () => getSessionHistory(page),
        placeholderData: keepPreviousData,
    });
};

export const useLogout = (onLogout?: () => void) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: logoutUser,
        onSuccess: () => {
            queryClient.clear();
            sessionStorage.removeItem('access_token');
            onLogout?.(); // ← callback, href yo'q
        }
    });
};