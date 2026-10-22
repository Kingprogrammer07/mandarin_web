import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PartnerWebhook } from '@/api/services/partnerWebhooks';

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
    retryFailed: vi.fn(),
  },
}));

import { partnerWebhookService } from '@/api/services/partnerWebhooks';
import PartnerWebhooksSection from './PartnerWebhooksSection';
import { guideToMarkdown, splitInlineCode } from './partnerWebhookGuide';

const service = vi.mocked(partnerWebhookService);

function partner(overrides: Partial<PartnerWebhook> = {}): PartnerWebhook {
  return {
    id: 1,
    name: 'U kargo',
    client_code_prefixes: ['U'],
    url: 'https://u.uz/hook',
    is_active: true,
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
      }),
    );
    expect(await screen.findByText('whsec_once')).toBeInTheDocument();
  });

  it('tells a non-super-admin the section is not theirs', async () => {
    service.list.mockRejectedValue({ message: 'Forbidden', status: 403 });
    renderSection();
    expect(await screen.findByText(/faqat super-admin/)).toBeInTheDocument();
  });
});

describe('partner guide', () => {
  it('copies as Markdown with the Python example and the signature headers', () => {
    const markdown = guideToMarkdown();
    expect(markdown).toContain('```python');
    expect(markdown).toContain('X-Mandarin-Signature');
    expect(markdown).toContain('hmac.compare_digest(expected, signature)');
  });

  it('splits inline code spans', () => {
    expect(splitInlineCode('a `b` c')).toEqual(['a ', 'b', ' c']);
  });
});
