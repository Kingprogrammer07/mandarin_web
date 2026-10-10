import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DailyReportSettings } from '@/api/services/dailyReportService';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/api/client', () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock('@/api/services/dailyReportService', () => ({
  dailyReportService: {
    get: vi.fn(),
    update: vi.fn(),
    preview: vi.fn(),
    sendNow: vi.fn(),
  },
}));

import { dailyReportService } from '@/api/services/dailyReportService';
import DailyReportSection from './DailyReportSection';

const service = vi.mocked(dailyReportService);

function settings(overrides: Partial<DailyReportSettings> = {}): DailyReportSettings {
  return {
    enabled: false,
    send_time: '20:00',
    recipient_admin_ids: [],
    super_admins: [
      { admin_id: 1, username: 'boss', selected: false, can_receive: true, problem: null },
      {
        admin_id: 2,
        username: 'deputy',
        selected: false,
        can_receive: false,
        problem: 'Telegram ID yo‘q',
      },
    ],
    last_sent_date: null,
    last_sent_at: null,
    last_result: null,
    ...overrides,
  };
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DailyReportSection />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DailyReportSection', () => {
  it('cannot be switched on before any recipient is saved', async () => {
    service.get.mockResolvedValue(settings());
    renderSection();

    expect(await screen.findByText('boss')).toBeInTheDocument();
    expect(screen.getByText('Telegram ID yo‘q')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('saves the chosen time and super-admins', async () => {
    service.get.mockResolvedValue(settings());
    service.update.mockResolvedValue(
      settings({ send_time: '21:30', recipient_admin_ids: [1] }),
    );
    renderSection();

    fireEvent.click(await screen.findByRole('checkbox', { name: /boss/ }));
    fireEvent.change(screen.getByLabelText(/Yuborish vaqti/), {
      target: { value: '21:30' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Saqlash/ }));

    await waitFor(() => expect(service.update).toHaveBeenCalled());
    expect(service.update.mock.calls[0][0]).toEqual({
      send_time: '21:30',
      recipient_admin_ids: [1],
    });
  });

  it('shows the rich preview with its tables, never user data as markup', async () => {
    service.get.mockResolvedValue(settings());
    service.preview.mockResolvedValue({
      rich_html:
        '<h3>📊 Kunlik hisobot</h3><table bordered striped>' +
        '<tr><td>💵 Naqd</td><td align="right">150 000</td></tr></table>' +
        '<details><summary>⚠️ Qarzga chiqarilganlar</summary>' +
        '<table bordered><tr><td>S&lt;img src=x&gt;</td></tr></table></details>',
      text: '📊 <b>Kunlik hisobot</b>',
      window_start: '2026-10-09T00:00:00+05:00',
      window_end: '2026-10-09T20:00:00+05:00',
    });
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: /Namuna/ }));

    const preview = await screen.findByTestId('daily-report-preview');
    expect(screen.getByRole('heading', { name: '📊 Kunlik hisobot' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '150 000' })).toHaveStyle({ textAlign: 'right' });
    expect(preview).toHaveTextContent('S<img src=x>');
    expect(preview.querySelector('img')).toBeNull();
  });

  it('sends now to the ticked admins and says who did not get it', async () => {
    service.get.mockResolvedValue(settings({ recipient_admin_ids: [1, 2] }));
    service.sendNow.mockResolvedValue({
      delivered: [{ admin_id: 1, username: 'boss', reason: null }],
      failed: [{ admin_id: 2, username: 'deputy', reason: 'Telegram ID yo‘q' }],
      sent_at: '2026-10-09T15:00:00Z',
    });
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: /Hozir yuborish/ }));

    expect(await screen.findByText('1 ta yetdi, 1 ta yetmadi')).toBeInTheDocument();
    expect(service.sendNow).toHaveBeenCalledWith([1, 2]);
    expect(screen.getByText('deputy: Telegram ID yo‘q')).toBeInTheDocument();
  });

  it('says when Telegram refused the table format and plain text went out', async () => {
    service.get.mockResolvedValue(settings({ recipient_admin_ids: [1] }));
    service.sendNow.mockResolvedValue({
      delivered: [{ admin_id: 1, username: 'boss', reason: null, format: 'text' }],
      failed: [],
      sent_at: '2026-10-09T15:00:00Z',
      rich_error: "Bad Request: can't parse rich message",
    });
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: /Hozir yuborish/ }));

    expect(
      await screen.findByText(/jadvalli formatni qabul qilmadi.*can't parse rich message/),
    ).toBeInTheDocument();
  });
});
