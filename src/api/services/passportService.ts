import { apiClient, apiClientFormData } from '../client';

export interface ExtraPassport {
    id: number;
    passport_series: string;
    pinfl: string;
    date_of_birth: string;
    image_urls: string[];
    created_at: string;
}

export interface ExtraPassportListResponse {
    items: ExtraPassport[];
    total: number;
    page: number;
    size: number;
}

export interface CreatePassportData {
    passport_series: string;
    pinfl: string;
    date_of_birth: string;
    images: File[];
}

export const passportService = {
    /**
     * Get list of extra passports
     */
    getPassports: async (page = 1, size = 10): Promise<ExtraPassportListResponse> => {
        const response = await apiClient.get<ExtraPassportListResponse>('/api/v1/passports/', {
            params: { page, size },
        });
        return response.data;
    },

    /**
     * Add a new extra passport
     */
    createPassport: async (data: CreatePassportData): Promise<ExtraPassport> => {
        const formData = new FormData();
        formData.append('passport_series', data.passport_series);
        formData.append('pinfl', data.pinfl);
        formData.append('date_of_birth', data.date_of_birth);

        data.images.forEach((file) => {
            formData.append('images', file);
        });

        const response = await apiClientFormData.post<ExtraPassport>('/api/v1/passports/', formData);
        return response.data;
    },

    /**
     * Delete an extra passport
     */
    deletePassport: async (id: number): Promise<{ success: boolean; message: string }> => {
        const response = await apiClient.delete<{ success: boolean; message: string }>(`/api/v1/passports/${id}`);
        return response.data;
    },
};
