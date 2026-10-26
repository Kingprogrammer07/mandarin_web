/**
 * Settings → Yetkazish: the couriers' Telegram message about new stops is a
 * switch the super-admin turns on at go-live.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/client', () => ({ apiClient: {} }));
vi.mock('@/api/services/courierService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/services/courierService')>()),
  courierSettingsService: { get: vi.fn(), update: vi.fn() },
}));
vi.mock('./CourierAppReleases', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { courierSettingsService, type CourierSettings } from '@/api/services/courierService';
import CourierSettingsSection from './CourierSettingsSection';

const SETTINGS: CourierSettings = {
  fee_uzs: 30_000,
  ask_client: true,
  cash_enabled: true,
  card_enabled: true,
  online_enabled: true,
  order_alerts: false,
  updated_at: null,
  updated_by: null,
};

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CourierSettingsSection />
    </QueryClientProvider>,
  );
}

describe('CourierSettingsSection', () => {
  beforeEach(() => {
    vi.mocked(courierSettingsService.update).mockReset();
  });

  it('shows the Telegram message off and saves it switched on', async () => {
    vi.mocked(courierSettingsService.get).mockResolvedValue(SETTINGS);
    vi.mocked(courierSettingsService.update).mockImplementation(async (body) => ({
      ...SETTINGS,
      ...body,
    }));
    renderSection();

    const alerts = await screen.findByRole('switch', { name: /Skladda yangi zayavka/ });
    expect(alerts).not.toBeChecked();
    expect(screen.getByText(/Kuryerlarga Telegram xabari bormaydi/)).toBeInTheDocument();

    fireEvent.click(alerts);
    expect(screen.getByText(/yo‘lda bo‘lmagan kuryerlarga botdan xabar boradi/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Saqlash/ }));
    await waitFor(() => expect(courierSettingsService.update).toHaveBeenCalled());
    expect(vi.mocked(courierSettingsService.update).mock.calls[0][0]).toMatchObject({
      order_alerts: true,
      fee_uzs: 30_000,
    });
  });

  it('an older server without the switch reads as off', async () => {
    const older: CourierSettings = { ...SETTINGS };
    delete older.order_alerts;
    vi.mocked(courierSettingsService.get).mockResolvedValue(older);
    renderSection();
    expect(await screen.findByRole('switch', { name: /Skladda yangi zayavka/ })).not.toBeChecked();
  });
});
