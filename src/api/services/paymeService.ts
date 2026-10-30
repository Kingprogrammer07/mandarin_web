import { apiClient } from '@/api/client';

/**
 * Payme Merchant API orders (`/api/v1/payme`).
 *
 * An order pays a flight's whole debt (or an UzPost delivery fee) on Payme's
 * own page. The server holds the sum for 30 minutes and books it when Payme
 * performs the payment, so the screen only opens the page and polls the order.
 * The same open order comes back while it has time left, and the one Payme is
 * paying right now always does: reopening never makes a second payment.
 */

/**
 * open: Payme's page can be opened; processing: Payme is taking the money;
 * paid: booked; expired: the 30 minutes are over; replaced: a newer order of
 * the flight took its place; refunded: paid, then returned.
 */
export type PaymeOrderState = 'open' | 'processing' | 'paid' | 'expired' | 'replaced' | 'refunded';

export interface PaymeOrder {
  id: number;
  kind: 'flight' | 'delivery';
  /** The flight; of a delivery order, its flights, comma separated. */
  flight_name: string;
  state: PaymeOrderState;
  /** What Payme charges, so'm. */
  amount: number;
  /** Payme's page; only while the order can be paid. */
  checkout_url: string | null;
  expires_at: string;
  /** The server's clock, for the countdown. */
  server_time: string;
  /** The UzPost request a paid delivery order made. */
  delivery_request_id: number | null;
}

export interface PaymeDeliveryOrderRequest {
  flight_names: string[];
  location_id: number;
  phone_number?: string | null;
  recipient_name?: string | null;
}

const BASE = '/api/v1/payme';

/** Payme's checkout hosts; anything else is never opened. */
const CHECKOUT_HOSTS = new Set(['checkout.paycom.uz', 'test.paycom.uz']);

export const paymeService = {
  /** Whether the Mini App offers «Payme» at all. */
  async available(): Promise<{ enabled: boolean }> {
    const { data } = await apiClient.get<{ enabled: boolean }>(`${BASE}/available`);
    return data;
  },

  /** Open (or get back) the order for a flight's whole debt. */
  async openOrder(flightName: string): Promise<PaymeOrder> {
    const { data } = await apiClient.post<PaymeOrder>(`${BASE}/orders`, {
      flight_name: flightName,
    });
    return data;
  },

  /** Open (or get back) the order for an UzPost delivery fee. */
  async openDeliveryOrder(body: PaymeDeliveryOrderRequest): Promise<PaymeOrder> {
    const { data } = await apiClient.post<PaymeOrder>(`${BASE}/delivery-orders`, body);
    return data;
  },

  async getOrder(orderId: number): Promise<PaymeOrder> {
    const { data } = await apiClient.get<PaymeOrder>(`${BASE}/orders/${orderId}`);
    return data;
  },
};

/** The server's reason for refusing an order, as it wrote it (Uzbek). */
export function paymeRefusal(error: unknown, fallback: string): string {
  const rejected = error as { message?: string; data?: { detail?: unknown } } | null;
  const detail = rejected?.data?.detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const { message } = detail as { message?: unknown };
    if (typeof message === 'string' && message) return message;
  }
  return rejected?.message || fallback;
}

/**
 * Open Payme's page for `url`. False when the URL is not Payme's.
 *
 * Inside the Mini App, Telegram's in-app browser opens on top of the app
 * (`WebApp.openLink`), as NBU's page does, so the app stays underneath and
 * sees the payment land. Elsewhere the tab goes to Payme, which sends the
 * client back to the configured return page.
 */
export function openPaymeCheckout(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || !CHECKOUT_HOSTS.has(parsed.hostname)) return false;

  const webApp = window.Telegram?.WebApp;
  // The same three checks as NBU's page (`openNbuUrl`): really inside
  // Telegram, the method exists, and the client honours it (Bot API 6.1).
  const supportsOpenLink =
    Boolean(webApp?.initData) &&
    typeof webApp?.openLink === 'function' &&
    webApp.isVersionAtLeast?.('6.1') !== false;
  if (supportsOpenLink) {
    webApp.openLink(parsed.href, { try_instant_view: false });
  } else {
    window.location.assign(parsed.href);
  }
  return true;
}
