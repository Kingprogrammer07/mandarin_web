import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CardTransferSettings } from '@/api/services/cardTransferService';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/api/client', () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock('@/api/services/cardTransferService', () => ({
  cardTransferService: { get: vi.fn(), setAutoApprove: vi.fn() },
}));

import { cardTransferService } from '@/api/services/cardTransferService';
import CardTransferAutoApproveSection from './CardTransferAutoApproveSection';

const service = vi.mocked(cardTransferService);

function settings(overrides: Partial<CardTransferSettings> = {}): CardTransferSettings {
  return {
    auto_approve: false,
    reader_active: true,
    updated_by: null,
    updated_at: null,
    stats: {
      days: 7,
      found: 12,
      would: 9,
      would_confirmed: 9,
      booked: 0,
      undone: 0,
      reasons: [{ code: 'chain', label: 'qoldiq zanjiri to‘g‘ri emas', count: 3 }],
    },
    ...overrides,
  };
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CardTransferAutoApproveSection />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('CardTransferAutoApproveSection', () => {
  it('shows the switch off, the week and why the rest went to the admin', async () => {
    service.get.mockResolvedValue(settings());
    renderSection();

    const toggle = await screen.findByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('So‘nggi 7 kun')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText(/admin tasdiqlagani: 9/)).toBeInTheDocument();
    expect(screen.getByText('qoldiq zanjiri to‘g‘ri emas')).toBeInTheDocument();
    expect(screen.queryByText(/tasdiqlamagan/)).not.toBeInTheDocument();
    expect(screen.queryByText(/o‘quvchisi 5 daqiqadan beri/)).not.toBeInTheDocument();
  });

  it('warns when a «would book» credit was not confirmed for its request', async () => {
    service.get.mockResolvedValue(
      settings({
        stats: { ...settings().stats, would: 9, would_confirmed: 7 },
      }),
    );
    renderSection();

    expect(await screen.findByText(/2 ta o‘tkazmani admin shu so‘rovga/)).toBeInTheDocument();
  });

  it('asks before switching on, and does nothing when the admin says no', async () => {
    service.get.mockResolvedValue(settings());
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderSection();

    fireEvent.click(await screen.findByRole('switch'));

    expect(confirm).toHaveBeenCalledOnce();
    expect(service.setAutoApprove).not.toHaveBeenCalled();
  });

  it('switches on after the admin agrees, and off without asking', async () => {
    service.get.mockResolvedValue(settings());
    service.setAutoApprove.mockResolvedValueOnce(
      settings({ auto_approve: true, updated_by: 'boss', updated_at: '2026-10-30T17:30:00Z' }),
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderSection();

    fireEvent.click(await screen.findByRole('switch'));
    await waitFor(() => expect(service.setAutoApprove).toHaveBeenCalledWith(true));
    await waitFor(() =>
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true'),
    );
    expect(screen.getByText(/Oxirgi o‘zgartirish: boss/)).toBeInTheDocument();

    service.setAutoApprove.mockResolvedValueOnce(settings());
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(service.setAutoApprove).toHaveBeenCalledWith(false));
    expect(confirm).toHaveBeenCalledOnce();
  });

  it('warns when CardXabar is not being read', async () => {
    service.get.mockResolvedValue(settings({ reader_active: false }));
    renderSection();

    expect(await screen.findByText(/o‘quvchisi 5 daqiqadan beri/)).toBeInTheDocument();
  });
});
