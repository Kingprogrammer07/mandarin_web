import { apiClient } from '@/api/client';

/**
 * Payme Merchant API and Click SHOP API orders (`/api/v1/payme`, `/api/v1/click`).
 *
 * An order pays a flight's whole debt (or an UzPost delivery fee) on the
 * provider's own page. The server holds the sum for 30 minutes and books it
 * when the provider has taken the money, so the screen only opens the page and
 * polls the order. The same open order comes back while it has time left, and
 * the one the provider is taking the money on always does: reopening never
 * makes a second payment. Payme and Click share a flight's order: opening one
 * replaces the other's open order.
 */

/** Whose page an order is paid on. */
export type OnlineProvider = 'payme' | 'click';

/**
 * open: the provider's page can be opened; processing: it is taking the
 * money; paid: booked; expired: the 30 minutes are over; replaced: a newer
 * order of the flight took its place; refunded: paid, then returned (Payme);
 * held: Click took the money but it was not booked, the admins sort it out.
 */
export type PaymeOrderState =
  | 'open'
  | 'processing'
  | 'paid'
  | 'expired'
  | 'replaced'
  | 'refunded'
  | 'held';

export interface PaymeOrder {
  id: number;
  kind: 'flight' | 'delivery';
  /** The flight; of a delivery order, its flights, comma separated. */
  flight_name: string;
  state: PaymeOrderState;
  /** What the provider charges, so'm. */
  amount: number;
  /** The provider's page; only while the order can be paid. */
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

/** The providers' pages; anything else is never opened. */
const CHECKOUT_HOSTS: Record<OnlineProvider, ReadonlySet<string>> = {
  payme: new Set(['checkout.paycom.uz', 'test.paycom.uz']),
  click: new Set(['my.click.uz']),
};

function ordersService(provider: OnlineProvider) {
  const base = `/api/v1/${provider}`;
  return {
    /** Whether the Mini App offers the provider at all. */
    async available(): Promise<{ enabled: boolean }> {
      const { data } = await apiClient.get<{ enabled: boolean }>(`${base}/available`);
      return data;
    },

    /** Open (or get back) the order for a flight's whole debt. */
    async openOrder(flightName: string): Promise<PaymeOrder> {
      const { data } = await apiClient.post<PaymeOrder>(`${base}/orders`, {
        flight_name: flightName,
      });
      return data;
    },

    /** Open (or get back) the order for an UzPost delivery fee. */
    async openDeliveryOrder(body: PaymeDeliveryOrderRequest): Promise<PaymeOrder> {
      const { data } = await apiClient.post<PaymeOrder>(`${base}/delivery-orders`, body);
      return data;
    },

    async getOrder(orderId: number): Promise<PaymeOrder> {
      const { data } = await apiClient.get<PaymeOrder>(`${base}/orders/${orderId}`);
      return data;
    },
  };
}

export const paymeService = ordersService('payme');
export const clickService = ordersService('click');

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
 * Open the provider's page for `url` (Payme's by default). False when the URL
 * is not that provider's.
 *
 * Inside the Mini App, Telegram's in-app browser opens on top of the app
 * (`WebApp.openLink`), as NBU's page does, so the app stays underneath and
 * sees the payment land. Elsewhere the tab goes to the provider, which sends
 * the client back to the configured return page.
 */
export function openPaymeCheckout(url: string, provider: OnlineProvider = 'payme'): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || !CHECKOUT_HOSTS[provider].has(parsed.hostname)) {
    return false;
  }

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
