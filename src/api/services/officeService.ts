import { apiClient } from '@/api/client';

/** One weekday's schedule as stored by the admin panel. */
export interface OfficeDayHours {
  open: string;
  close: string;
  closed: boolean;
}

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const WEEKDAY_ORDER: WeekdayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * Office card. `is_open_now` / `next_open_at` are computed server-side in
 * Tashkent time — never recompute them from the device clock, a wrong phone
 * timezone would tell the customer the office is open when it is closed.
 */
export interface OfficeInfo {
  address_text: string;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  phones: string[];
  telegram_username: string | null;
  working_hours: Partial<Record<WeekdayKey, OfficeDayHours>>;
  holidays: string[];
  notice: string | null;
  map_url: string | null;
  /** Branch photo shown on the home card. Nullable: staff may not have
   *  uploaded one, and the card falls back to an icon rather than a gap. */
  photo_url: string | null;
  is_open_now: boolean;
  today_hours: OfficeDayHours | null;
  closed_reason: 'holiday' | 'weekday' | 'outside_hours' | null;
  next_open_at: string | null;
}

export type OfficeUpdateBody = Partial<
  Pick<
    OfficeInfo,
    | 'address_text'
    | 'landmark'
    | 'latitude'
    | 'longitude'
    | 'phones'
    | 'telegram_username'
    | 'working_hours'
    | 'holidays'
    | 'notice'
    | 'map_url'
  >
>;

const BASE = '/api/v1/system';

export const officeService = {
  async get(): Promise<OfficeInfo> {
    const response = await apiClient.get<OfficeInfo>(`${BASE}/office`);
    return response.data;
  },

  /** Super-admin only. */
  async update(body: OfficeUpdateBody): Promise<OfficeInfo> {
    const response = await apiClient.put<OfficeInfo>(`${BASE}/office`, body);
    return response.data;
  },
};
