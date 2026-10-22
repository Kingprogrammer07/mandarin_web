/**
 * The delivery fee on the client's tracking screen: online payment opens only
 * at the door, goes to NBU with a way back to this delivery, and a paid or
 * pending fee is shown as such instead of a second pay button.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/client', () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock('@/api/services/courierService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/services/courierService')>()),
  getCourierDelivery: vi.fn(),
  payCourierOnline: vi.fn(),
}));
vi.mock('@/utils/nbuReturnContext', () => ({ openNbuUrl: vi.fn(() => 'external') }));

import i18n from '@/i18n/config';
import {
  getCourierDelivery,
  payCourierOnline,
  type CourierDelivery,
} from '@/api/services/courierService';
import { openNbuUrl } from '@/utils/nbuReturnContext';
import { CourierTrackView } from './CourierTrackView';

const ID = '5f1c2c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

function delivery(overrides: Partial<CourierDelivery> = {}): CourierDelivery {
  return {
    public_id: ID,
    status: 'on_the_way',
    delivery_date: '2026-10-22',
    position: 1,
    eta_window: null,
    eta_at: null,
    courier_name: 'Aziz',
    address: 'Chilonzor 9',
    // No pin: the screen renders without the map.
    latitude: null,
    longitude: null,
    departed_at: '2026-10-22T05:30:00Z',
    delivered_at: null,
    postpone_reason: null,
    delivery_request_id: 7,
    items: [{ flight_name: 'M306', weight: '1.2' }],
    courier: null,
    courier_car: 'Oq Chevrolet Cobalt · 01 A 123 BC',
    courier_phone: '+998901234567',
    arrived_at: '2026-10-22T06:02:00Z',
    fee_uzs: 30000,
    payment_choice: null,
    payment_method: null,
    paid_at: null,
    can_pay_online: true,
    online_pending: false,
    ...overrides,
  };
}

function show(d: CourierDelivery) {
  vi.mocked(getCourierDelivery).mockResolvedValue(d);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CourierTrackView publicId={d.public_id} onClose={() => {}} />
    </QueryClientProvider>,
  );
}

beforeAll(async () => {
  await i18n.changeLanguage('uz');
});

beforeEach(() => {
  vi.mocked(getCourierDelivery).mockReset();
  vi.mocked(payCourierOnline).mockReset();
  vi.mocked(openNbuUrl).mockClear();
});

describe('CourierTrackView payment', () => {
  it('at the door: the car, a call button and online payment through NBU', async () => {
    vi.mocked(payCourierOnline).mockResolvedValue({
      payment_url: 'https://nbu.test/pay/1',
      order_id: 'ord-1',
      amount_uzs: 30000,
    });
    show(delivery());

    expect(await screen.findByText('Kuryer sizni kutyapti')).toBeInTheDocument();
    expect(screen.getByText('Oq Chevrolet Cobalt · 01 A 123 BC')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Kuryerga qo'ng'iroq qilish" })).toHaveAttribute(
      'href',
      'tel:+998901234567',
    );

    fireEvent.click(screen.getByRole('button', { name: /Onlayn to'lash · 30\s000 so'm/ }));
    await waitFor(() => expect(openNbuUrl).toHaveBeenCalledTimes(1));
    expect(payCourierOnline).toHaveBeenCalledWith(ID);
    expect(openNbuUrl).toHaveBeenCalledWith({
      orderId: 'ord-1',
      kind: 'payment',
      paymentUrl: 'https://nbu.test/pay/1',
      homePath: `/user/home?courier=${ID}`,
    });
  });

  it('a late courier: no estimate from the past under the steps', async () => {
    show(delivery({ arrived_at: null, eta_at: new Date(Date.now() - 10 * 60_000).toISOString() }));
    expect(await screen.findByText('Kuryer yetib kelmoqda')).toBeInTheDocument();
    expect(screen.queryByText(/^~/)).not.toBeInTheDocument();
  });

  it('a paid fee shows how it was paid and no pay button', async () => {
    show(delivery({ paid_at: '2026-10-22T06:03:00Z', payment_method: 'nbu', can_pay_online: false }));

    expect(await screen.findByText("To'landi")).toBeInTheDocument();
    expect(screen.getByText("To'langan: onlayn")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Onlayn to'lash/ })).not.toBeInTheDocument();
  });

  it('a payment in progress re-opens the same session instead of a new one', async () => {
    show(delivery({ online_pending: true, payment_choice: 'nbu' }));

    expect(await screen.findByText('Tekshirilmoqda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "To'lov sahifasini qayta ochish" })).toBeInTheDocument();
  });

  it('before the door: the fee and the client choice, nothing to pay yet', async () => {
    show(delivery({ arrived_at: null, can_pay_online: false, payment_choice: 'cash' }));

    expect(await screen.findByText("Kuryer yetib kelganda to'laysiz.")).toBeInTheDocument();
    expect(screen.getByText('Siz tanladingiz: naqd')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Onlayn to'lash/ })).not.toBeInTheDocument();
  });

  it('a free delivery has no fee card', async () => {
    show(delivery({ fee_uzs: 0, arrived_at: null, can_pay_online: false }));

    expect(await screen.findByText('Aziz')).toBeInTheDocument();
    expect(screen.queryByText('Yetkazish narxi')).not.toBeInTheDocument();
  });
});
