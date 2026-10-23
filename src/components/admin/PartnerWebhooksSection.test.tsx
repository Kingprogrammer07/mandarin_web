import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PartnerWebhook, PartnerWebhookDelivery } from '@/api/services/partnerWebhooks';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/api/client', () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock('@/api/services/partnerWebhooks', () => ({
  partnerWebhookService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    rotateSecret: vi.fn(),
    test: vi.fn(),
    deliveries: vi.fn(),
    retryDelivery: vi.fn(),
    resendDelivery: vi.fn(),
    retryFailed: vi.fn(),
  },
}));

import { partnerWebhookService } from '@/api/services/partnerWebhooks';
import PartnerWebhooksSection from './PartnerWebhooksSection';
import { guideToMarkdown, splitInlineCode } from './partnerWebhookGuide';
import { COURIER_GUIDE_TITLE, PARTNER_COURIER_GUIDE } from './partnerCourierGuide';

const service = vi.mocked(partnerWebhookService);

// Radix Switch measures itself inside a form (the courier API switch).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function partner(overrides: Partial<PartnerWebhook> = {}): PartnerWebhook {
  return {
    id: 1,
    name: 'U kargo',
    client_code_prefixes: ['U'],
    url: 'https://u.uz/hook',
    is_active: true,
    courier_enabled: false,
    color: '#2563EB',
    created_at: null,
    created_by: 'boss',
    updated_by: 'boss',
    pending_count: 1,
    failed_count: 2,
    sent_count: 5,
    last_sent_at: null,
    last_error: 'HTTP 503',
    ...overrides,
  };
}

function delivery(overrides: Partial<PartnerWebhookDelivery> = {}): PartnerWebhookDelivery {
  return {
    id: 10,
    delivery_id: 'd-10',
    event: 'cargo.imported',
    flight_name: 'M314',
    item_count: 5,
    status: 'pending',
    attempts: 7,
    last_status_code: null,
    last_error: 'Domen topilmadi',
    created_at: '2026-10-22T17:21:00Z',
    sent_at: null,
    next_attempt_at: '2026-10-22T18:23:00Z',
    ...overrides,
  };
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PartnerWebhooksSection />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PartnerWebhooksSection', () => {
  it('shows each partner with its prefix, counts and last error', async () => {
    service.list.mockResolvedValue([partner()]);
    renderSection();
    expect(await screen.findByText('U kargo')).toBeInTheDocument();
    expect(screen.getByText('Prefiks:')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument();
    expect(screen.getByText('HTTP 503')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xatolarni qayta yuborish/ })).toBeInTheDocument();
  });

  it('creates a partner and shows its secret once', async () => {
    service.list.mockResolvedValue([]);
    service.create.mockResolvedValue({ ...partner({ id: 7 }), secret: 'whsec_once' });
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: /Hamkor qo'shish/ }));
    fireEvent.change(screen.getByPlaceholderText('U kargo'), { target: { value: 'U kargo' } });
    fireEvent.change(screen.getByPlaceholderText('U'), { target: { value: 'u, uz' } });
    fireEvent.change(screen.getByPlaceholderText(/api\.hamkor\.uz/), {
      target: { value: 'https://u.uz/hook' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Saqlash/ }));

    await waitFor(() =>
      expect(service.create).toHaveBeenCalledWith({
        name: 'U kargo',
        client_code_prefixes: ['U', 'UZ'],
        url: 'https://u.uz/hook',
        courier_enabled: false,
        color: '#2563EB',
      }),
    );
    expect(await screen.findByText('whsec_once')).toBeInTheDocument();
  });

  it('retries a queued delivery and resends a delivered one from the history', async () => {
    service.list.mockResolvedValue([partner()]);
    service.deliveries.mockResolvedValue({
      items: [delivery(), delivery({ id: 9, delivery_id: 'd-9', status: 'sent', last_error: null })],
      next_before_id: null,
    });
    service.retryDelivery.mockResolvedValue({
      ok: true,
      status_code: 200,
      error: null,
      delivery: delivery({ status: 'sent', attempts: 8 }),
    });
    service.resendDelivery.mockResolvedValue({
      ok: false,
      status_code: 503,
      error: 'HTTP 503',
      delivery: delivery({ id: 11, delivery_id: 'd-11' }),
    });
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: /Tarix/ }));

    fireEvent.click(await screen.findByRole('button', { name: /Takrorlash/ }));
    await waitFor(() => expect(service.retryDelivery).toHaveBeenCalledWith(1, 10));
    expect(await screen.findByText('Yetkazildi (HTTP 200).')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Yana yuborish/ }));
    await waitFor(() => expect(service.resendDelivery).toHaveBeenCalledWith(1, 9));
    expect(await screen.findByText(/Yangi yuborish navbatga qo'yildi/)).toBeInTheDocument();
  });

  it('switches the courier API on with a colour and shows the partner id', async () => {
    service.list.mockResolvedValue([partner({ id: 7 })]);
    service.update.mockResolvedValue(partner({ id: 7, courier_enabled: true, color: '#0D9488' }));
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: /Tahrirlash/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Kuryer API' }));
    fireEvent.click(screen.getByRole('radio', { name: '#0D9488' }));
    fireEvent.click(screen.getByRole('button', { name: /Saqlash/ }));
    await waitFor(() =>
      expect(service.update).toHaveBeenCalledWith(7, expect.objectContaining({ courier_enabled: true, color: '#0D9488' })),
    );

    service.list.mockResolvedValue([partner({ id: 7, courier_enabled: true })]);
    renderSection();
    expect(await screen.findByText('ID 7')).toBeInTheDocument();
    // The header button plus the card's courier chip.
    expect(screen.getAllByText('Kuryer API').length).toBeGreaterThanOrEqual(2);
  });

  it('labels courier status events in the history', async () => {
    service.list.mockResolvedValue([partner()]);
    service.deliveries.mockResolvedValue({
      items: [delivery({ event: 'courier.status', flight_name: null, item_count: 0 })],
      next_before_id: null,
    });
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: /Tarix/ }));
    expect(await screen.findByText('Kuryer holati')).toBeInTheDocument();
    expect(screen.queryByText(/0 qator/)).not.toBeInTheDocument();
  });

  it('tells a non-super-admin the section is not theirs', async () => {
    service.list.mockRejectedValue({ message: 'Forbidden', status: 403 });
    renderSection();
    expect(await screen.findByText(/faqat super-admin/)).toBeInTheDocument();
  });
});

describe('partner guide', () => {
  it('includes the pull API with its signed paths and the Python client', () => {
    const markdown = guideToMarkdown();
    expect(markdown).toContain('GET /api/v1/partner/cargo/flights');
    expect(markdown).toContain('POST /api/v1/partner/cargo/items');
    expect(markdown).toContain('next_after_id');
    expect(markdown).toContain('def pull(flights');
  });

  it('copies as Markdown with the Python example and the signature headers', () => {
    const markdown = guideToMarkdown();
    expect(markdown).toContain('```python');
    expect(markdown).toContain('X-Mandarin-Signature');
    expect(markdown).toContain('hmac.compare_digest(expected, signature)');
  });

  it('the courier API guide states the signed string and the status events', () => {
    const markdown = guideToMarkdown(PARTNER_COURIER_GUIDE, COURIER_GUIDE_TITLE);
    expect(markdown).toContain(`# ${COURIER_GUIDE_TITLE}`);
    expect(markdown).toContain('f"{ts}.{method}.{path}."');
    expect(markdown).toContain('/api/v1/partner/courier/orders');
    for (const status of ['planned', 'on_the_way', 'arrived', 'delivered', 'postponed']) {
      expect(markdown).toContain(`| ${status} |`);
    }
  });

  it('splits inline code spans', () => {
    expect(splitInlineCode('a `b` c')).toEqual(['a ', 'b', ' c']);
  });
});
