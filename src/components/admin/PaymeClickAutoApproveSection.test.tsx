import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PaymentCheckSettings } from '@/api/services/paymentCheckService';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/api/client', () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock('@/api/services/paymentCheckService', () => ({
  paymentCheckService: { get: vi.fn(), setAutoApprove: vi.fn() },
}));

import { paymentCheckService } from '@/api/services/paymentCheckService';
import PaymeClickAutoApproveSection from './PaymeClickAutoApproveSection';

const service = vi.mocked(paymentCheckService);

function settings(overrides: Partial<PaymentCheckSettings> = {}): PaymentCheckSettings {
  return {
    auto_approve: false,
    reader_active: true,
    updated_by: null,
    updated_at: null,
    stats: { days: 7, checked: 16, would_approve: 9, bot_approved: 0, undone: 0 },
    ...overrides,
  };
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PaymeClickAutoApproveSection />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('PaymeClickAutoApproveSection', () => {
  it('shows the switch off and the last week of receipts', async () => {
    service.get.mockResolvedValue(settings());
    renderSection();

    const toggle = await screen.findByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('So‘nggi 7 kun')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.queryByText(/o‘quvchi boti ishlamayapti/)).not.toBeInTheDocument();
  });

  it('asks before switching on, and does nothing when the admin says no', async () => {
    service.get.mockResolvedValue(settings());
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderSection();

    fireEvent.click(await screen.findByRole('switch'));

    expect(confirm).toHaveBeenCalledOnce();
    expect(service.setAutoApprove).not.toHaveBeenCalled();
  });

  it('switches on after the admin agrees', async () => {
    service.get.mockResolvedValue(settings());
    service.setAutoApprove.mockResolvedValue(
      settings({ auto_approve: true, updated_by: 'boss', updated_at: '2026-10-24T17:30:00Z' }),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderSection();

    fireEvent.click(await screen.findByRole('switch'));

    await waitFor(() => expect(service.setAutoApprove).toHaveBeenCalledWith(true));
    await waitFor(() =>
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true'),
    );
    expect(screen.getByText(/Oxirgi o‘zgartirish: boss/)).toBeInTheDocument();
  });

  it('switches off without asking', async () => {
    service.get.mockResolvedValue(settings({ auto_approve: true }));
    service.setAutoApprove.mockResolvedValue(settings());
    const confirm = vi.spyOn(window, 'confirm');
    renderSection();

    fireEvent.click(await screen.findByRole('switch'));

    await waitFor(() => expect(service.setAutoApprove).toHaveBeenCalledWith(false));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('warns when the reader is not running', async () => {
    service.get.mockResolvedValue(settings({ reader_active: false }));
    renderSection();

    expect(await screen.findByText(/o‘quvchi boti ishlamayapti/)).toBeInTheDocument();
  });
});
