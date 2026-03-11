export interface ProfileResponse {
    full_name: string;
    phone: string;
    client_code: string;
    extra_code?: string | null;
    passport_series: string;
    pinfl: string;
    date_of_birth?: string; // dd.mm.yyyy
    region: string;
    district?: string | null;
    address: string;
    created_at: string; // dd.mm.yyyy hh:mm
    referral_count: number;
    passport_images: string[];
    telegram_id: number;
    // frontend helper
    avatar_url?: string;
}

export interface UpdateProfileRequest {
    full_name?: string;
    phone?: string;
    region?: string;
    district?: string;
    address?: string;
}

export interface PaymentReminderItem {
    flight: string;
    total: number;
    paid: number;
    remaining: number;
    deadline: string;
    is_partial: boolean;
}

export interface PaymentReminderResponse {
    reminders: PaymentReminderItem[];
    warning_text?: string;
}

export interface SessionLogItem {
    date: string;
    client_code: string;
    event_type: string;
    username?: string;
}

export interface SessionHistoryResponse {
    logs: SessionLogItem[];
}
