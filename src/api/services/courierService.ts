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
}

export const courierDeliveryKey = (publicId: string) => ['courier-delivery', publicId] as const;

export async function getCourierDelivery(publicId: string): Promise<CourierDelivery> {
  const response = await apiClient.get<CourierDelivery>(
    `/api/v1/user/courier/deliveries/${encodeURIComponent(publicId)}`,
  );
  return response.data;
}

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
