import { apiClient } from '@/api/client';

/** Mirrors `ClientDeliveryOut` in the backend (`src/api/schemas/courier.py`). */
export type CourierStopStatus = 'waiting' | 'on_the_way' | 'delivered' | 'cancelled';

export interface CourierLivePosition {
  latitude: number;
  longitude: number;
  heading: number | null;
  /** ISO time of the courier's last GPS fix. */
  recorded_at: string;
}

export interface CourierDeliveryItem {
  flight_name: string | null;
  weight: string | null;
}

export interface CourierDelivery {
  public_id: string;
  status: CourierStopStatus;
  /** YYYY-MM-DD, Tashkent. A postponed delivery carries its new day here. */
  delivery_date: string;
  /** Place in the courier's queue, only while the courier is on the road. */
  position: number | null;
  /** "10:30–11:30", Tashkent time; null before the courier sets off. */
  eta_window: string | null;
  eta_at: string | null;
  courier_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  departed_at: string | null;
  delivered_at: string | null;
  postpone_reason: string | null;
  delivery_request_id: number | null;
  items: CourierDeliveryItem[];
  /** Only while the courier is driving to this client, and only while fresh. */
  courier: CourierLivePosition | null;
  /** "Oq Chevrolet Cobalt · 01 A 123 BC", as the courier filled it in. */
  courier_car: string | null;
  /** Only while the courier is driving to this client. */
  courier_phone: string | null;
  /** «Yetib keldim»: the courier is at the door. */
  arrived_at: string | null;
  /** The delivery fee, so'm; 0 when free. */
  fee_uzs: number;
  /** What the client said they will pay with; a hint for the courier. */
  payment_choice: CourierPayMethod | null;
  payment_method: CourierPayMethod | null;
  paid_at: string | null;
  /** The courier is at the door and the fee can be paid through NBU now. */
  can_pay_online: boolean;
  /** An NBU payment for this delivery is open and may still go through. */
  online_pending: boolean;
}

export type CourierPayMethod = 'cash' | 'card' | 'nbu';

export interface CourierPayResponse {
  payment_url: string;
  order_id: string;
  amount_uzs: number;
}

export const courierDeliveryKey = (publicId: string) => ['courier-delivery', publicId] as const;

export const courierDeliveriesKey = ['courier-deliveries'] as const;

/** The client's open deliveries plus the ones delivered in the last 24 hours. */
export async function listCourierDeliveries(): Promise<CourierDelivery[]> {
  const response = await apiClient.get<{ deliveries: CourierDelivery[] }>(
    '/api/v1/user/courier/deliveries',
  );
  return response.data.deliveries;
}

/** The delivery worth showing: the one the courier is driving to, else the soonest. */
export function pickCourierDelivery(list: CourierDelivery[]): CourierDelivery | null {
  const open = list.filter((d) => d.status === 'on_the_way' || d.status === 'waiting');
  return open.find((d) => d.status === 'on_the_way') ?? open[0] ?? null;
}

export async function getCourierDelivery(publicId: string): Promise<CourierDelivery> {
  const response = await apiClient.get<CourierDelivery>(
    `/api/v1/user/courier/deliveries/${encodeURIComponent(publicId)}`,
  );
  return response.data;
}

/**
 * Opens (or, within the same NBU session, re-opens) the online payment for the
 * delivery fee. The backend refuses until the courier is at the door.
 */
export async function payCourierOnline(publicId: string): Promise<CourierPayResponse> {
  const response = await apiClient.post<CourierPayResponse>(
    `/api/v1/user/courier/deliveries/${encodeURIComponent(publicId)}/pay`,
  );
  return response.data;
}

export const courierFeeKey = ['courier-fee'] as const;

/** The courier delivery fee the request form shows. */
export async function getCourierFee(): Promise<number> {
  const response = await apiClient.get<{ fee_uzs: number }>('/api/v1/user/courier/settings');
  return response.data.fee_uzs;
}

/** Super-admin: the fee, which payment methods are on, and whether the client is asked. */
export interface CourierSettings {
  fee_uzs: number;
  ask_client: boolean;
  cash_enabled: boolean;
  card_enabled: boolean;
  online_enabled: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

export type CourierSettingsUpdate = Omit<CourierSettings, 'updated_at' | 'updated_by'>;

export const courierSettingsService = {
  async get(): Promise<CourierSettings> {
    const response = await apiClient.get<CourierSettings>('/api/v1/system/courier');
    return response.data;
  },
  async update(body: CourierSettingsUpdate): Promise<CourierSettings> {
    const response = await apiClient.put<CourierSettings>('/api/v1/system/courier', body);
    return response.data;
  },
};

/** Payload of the `courier.location` SSE event (`services/courier.py`). */
export interface CourierLocationEvent {
  public_id: string;
  lat: number;
  lon: number;
  heading?: number | null;
  at: string;
}

/** A live fix applies only to a delivery the courier is driving to. */
export function applyCourierLocation(
  delivery: CourierDelivery | undefined,
  event: CourierLocationEvent,
): CourierDelivery | undefined {
  if (!delivery || delivery.status !== 'on_the_way') return delivery;
  if (typeof event.lat !== 'number' || typeof event.lon !== 'number') return delivery;
  return {
    ...delivery,
    courier: {
      latitude: event.lat,
      longitude: event.lon,
      heading: typeof event.heading === 'number' ? event.heading : null,
      recorded_at: event.at,
    },
  };
}
