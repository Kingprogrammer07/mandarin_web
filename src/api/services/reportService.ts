import { apiClient } from '../client';

export interface CargoItemDetail {
    track_code: string;
    /** Corrected/alternate code (Excel column C). Display this if present — same parcel. */
    track_code_2?: string | null;
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

export type ReportFlightPaymentStatus = 'new' | 'partial' | 'paid' | 'taken_away';

export interface ReportFlightSummary {
    flight_name: string;
    payment_status: ReportFlightPaymentStatus;
    paid_amount: number;
    expected_amount: number;
    remaining_amount: number;
    is_taken_away: boolean;
    last_sent_web_date?: string | null;
}

const validFlightStatuses: ReportFlightPaymentStatus[] = ['new', 'partial', 'paid', 'taken_away'];

const toNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const normalizeWebFlight = (item: unknown): ReportFlightSummary | null => {
    if (typeof item === 'string') {
        return {
            flight_name: item,
            payment_status: 'new',
            paid_amount: 0,
            expected_amount: 0,
            remaining_amount: 0,
            is_taken_away: false,
            last_sent_web_date: null,
        };
    }

    if (!item || typeof item !== 'object') return null;

    const raw = item as Record<string, unknown>;
    const flightName = typeof raw.flight_name === 'string' ? raw.flight_name : '';
    if (!flightName) return null;

    const rawStatus = typeof raw.payment_status === 'string' ? raw.payment_status : 'new';
    const paymentStatus = validFlightStatuses.includes(rawStatus as ReportFlightPaymentStatus)
        ? rawStatus as ReportFlightPaymentStatus
        : 'new';

    return {
        flight_name: flightName,
        payment_status: paymentStatus,
        paid_amount: toNumber(raw.paid_amount),
        expected_amount: toNumber(raw.expected_amount),
        remaining_amount: toNumber(raw.remaining_amount),
        is_taken_away: raw.is_taken_away === true,
        last_sent_web_date: typeof raw.last_sent_web_date === 'string' ? raw.last_sent_web_date : null,
    };
};

export const reportService = {
    /**
     * Get paginated list of web-sent flight summaries for a client.
     */
    getWebFlights: async (clientCode: string, page: number = 1, size: number = 10): Promise<ReportFlightSummary[]> => {
        const response = await apiClient.get<unknown[]>(`/api/v1/reports/flights/${clientCode}`, {
            params: { page, size },
        });
        return response.data
            .map(normalizeWebFlight)
            .filter((flight): flight is ReportFlightSummary => flight !== null);
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
