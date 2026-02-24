import { apiClient, apiClientFormData } from '@/api/client';

export interface WalletBalanceResponse {
    balance: number;
    currency: string;
}

export interface CardResponse {
    id: number;
    masked_number: string;
    holder_name?: string;
    is_active: boolean;
}

export interface CardListResponse {
    cards: CardResponse[];
    count: number;
}

export interface CardCreateResponse {
    success: boolean;
    message: string;
    card: CardResponse;
}

export interface MessageResponse {
    success: boolean;
    message: string;
}

export interface CardCreateRequest {
    card_number: string;
    holder_name: string;
}

export interface NewCardInput {
    card_number: string;
    holder_name: string;
}

export interface RefundRequest {
    amount: number;
    card_id?: number;
    new_card?: NewCardInput;
}

export interface ActiveCardResponse {
    card_number: string;
    holder_name: string;
    bank_name?: string;
}

export const walletService = {
    // Balance
    getWalletBalance: async (): Promise<WalletBalanceResponse> => {
        const response = await apiClient.get<WalletBalanceResponse>('/api/v1/wallet/balance');
        return response.data;
    },

    // Cards
    getWalletCards: async (): Promise<CardListResponse> => {
        const response = await apiClient.get<CardListResponse>('/api/v1/wallet/cards');
        return response.data;
    },

    addWalletCard: async (data: CardCreateRequest): Promise<CardCreateResponse> => {
        const response = await apiClient.post<CardCreateResponse>('/api/v1/wallet/cards', data);
        return response.data;
    },

    deleteWalletCard: async (id: number): Promise<MessageResponse> => {
        const response = await apiClient.delete<MessageResponse>(`/api/v1/wallet/cards/${id}`);
        return response.data;
    },

    // Operations
    requestRefund: async (data: RefundRequest): Promise<MessageResponse> => {
        const response = await apiClient.post<MessageResponse>('/api/v1/wallet/refund', data);
        return response.data;
    },

    payDebt: async (formData: FormData): Promise<MessageResponse> => {
        const response = await apiClientFormData.post<MessageResponse>('/api/v1/wallet/pay-debt', formData);
        return response.data;
    },

    // Active Card (for debt payment)
    getActiveCompanyCard: async (): Promise<ActiveCardResponse> => {
        const response = await apiClient.get<ActiveCardResponse>('/api/v1/payments/active-cards/random');
        return response.data;
    }
};
