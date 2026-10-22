/**
 * The home screen's way back to the courier map: shown only for an open
 * delivery, worded by its state, and opening the right delivery.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/client', () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock('@/api/services/courierService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/services/courierService')>()),
  listCourierDeliveries: vi.fn(),
}));

import i18n from '@/i18n/config';
import {
  listCourierDeliveries,
  pickCourierDelivery,
  type CourierDelivery,
} from '@/api/services/courierService';
import { CourierHomeCard } from './CourierHomeCard';

function delivery(overrides: Partial<CourierDelivery> = {}): CourierDelivery {
  return {
    public_id: 'a',
    status: 'waiting',
    delivery_date: '2026-10-22',
    position: null,
    eta_window: null,
    eta_at: null,
    courier_name: null,
    address: null,
    latitude: null,
    longitude: null,
    departed_at: null,
    delivered_at: null,
    postpone_reason: null,
    delivery_request_id: null,
    items: [],
    courier: null,
    courier_car: null,
    courier_phone: null,
    arrived_at: null,
    fee_uzs: 0,
    payment_choice: null,
    payment_method: null,
    paid_at: null,
    can_pay_online: false,
    online_pending: false,
    ...overrides,
  };
}

function renderCard(list: CourierDelivery[]) {
  vi.mocked(listCourierDeliveries).mockResolvedValue(list);
  const onOpen = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <CourierHomeCard onOpen={onOpen} />
    </QueryClientProvider>,
  );
  return { onOpen, ...view };
}

beforeAll(async () => {
  await i18n.changeLanguage('uz');
});

beforeEach(() => {
  vi.mocked(listCourierDeliveries).mockReset();
});

describe('CourierHomeCard', () => {
  it('prefers the delivery the courier is driving to', () => {
    const picked = pickCourierDelivery([
      delivery({ public_id: 'done', status: 'delivered' }),
      delivery({ public_id: 'later' }),
      delivery({ public_id: 'now', status: 'on_the_way' }),
    ]);
    expect(picked?.public_id).toBe('now');
    expect(pickCourierDelivery([delivery({ status: 'delivered' })])).toBeNull();
  });

  it('shows the courier on the way and opens that delivery', async () => {
    const eta = new Date(Date.now() + 20 * 60_000);
    const { onOpen } = renderCard([
      delivery({ public_id: 'now', status: 'on_the_way', eta_at: eta.toISOString() }),
    ]);
    const card = await screen.findByRole('button', { name: /Kuryer yo'lda/ });
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tashkent',
      hour: '2-digit',
      minute: '2-digit',
    }).format(eta);
    expect(card).toHaveTextContent(`Taxminan ${time} da yetib keladi`);
    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledWith('now');
  });

  it('a late courier shows no time in the past', async () => {
    renderCard([
      delivery({ status: 'on_the_way', eta_at: new Date(Date.now() - 10 * 60_000).toISOString() }),
    ]);
    expect(await screen.findByText('Kuryer yetib kelmoqda')).toBeInTheDocument();
  });

  it('says when the courier is at the door', async () => {
    renderCard([
      delivery({ status: 'on_the_way', arrived_at: '2026-10-22T06:02:00Z' }),
    ]);
    expect(await screen.findByText('Kuryer sizni kutyapti')).toBeInTheDocument();
  });

  it('renders nothing without an open delivery', async () => {
    const { container } = renderCard([delivery({ status: 'delivered' })]);
    await vi.waitFor(() => expect(listCourierDeliveries).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });
});
