import { apiClient } from '../client';

export interface CargoItemDetail {
    track_code: string;
    weight_kg: number;
    price_per_kg: number;
    total_payment: number;
    total_payment_uzs: number;
}

export interface ReportResponse {
    flight_name: string;
    total_weight: number;
    total_price_usd: number;
    total_price_uzs: number;
    payment_status: 'paid' | 'unpaid' | 'partial';
    paid_amount: number;
    expected_amount: number;
    track_codes: string[];
    photo_file_ids: string[];
    cargo_items: CargoItemDetail[];
    is_taken_away: boolean;
    taken_away_date?: string; // ISO date string
    is_sent_web_date: string; // ISO date string
    payment_date?: string; // ISO date string
}

export interface FlightResponse {
    flight_name: string;
}

export const reportService = {
    /**
     * Get paginated list of flight names sent via web for a client.
     */
    getWebFlights: async (clientCode: string, page: number = 1, size: number = 10): Promise<string[]> => {
        const response = await apiClient.get<string[]>(`/api/v1/reports/flights/${clientCode}`, {
            params: { page, size },
        });
        return response.data;
    },

    /**
     * Get paginated web report history for a client.
     * Pass size > 10 to load more items (load-more pattern).
     */
    getWebHistory: async (
        clientCode: string,
        flightName?: string,
        page: number = 1,
        size: number = 10
    ): Promise<ReportResponse[]> => {
        const response = await apiClient.get<ReportResponse[]>(`/api/v1/reports/history/${clientCode}`, {
            params: {
                flight_name: flightName,
                page,
                size,
            },
        });
        return response.data;
    },
};
