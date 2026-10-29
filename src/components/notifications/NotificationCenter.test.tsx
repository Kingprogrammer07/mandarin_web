import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let unreadCount = 2;

vi.mock('@/api/services/notificationService', () => ({
  notificationService: {
    getUnreadCount: vi.fn(async () => ({ count: unreadCount })),
    getNotifications: vi.fn(async () => ({ items: [], total: 0 })),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));
vi.mock('@/api/services/reportService', () => ({
  reportService: {
    getWebFlights: vi.fn(async () => []),
    getWebHistory: vi.fn(async () => []),
  },
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ data: { client_code: 'SX1' } }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'uz' },
  }),
}));

import NotificationCenter from './NotificationCenter';

const TITLE = 'Sizga yangi xabar bor';

// One client for the whole test, like the app: tab switches remount the header,
// not the query cache.
function mount(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <NotificationCenter />
    </QueryClientProvider>,
  );
}

describe('NotificationCenter new-message banner', () => {
  beforeEach(() => {
    sessionStorage.clear();
    unreadCount = 2;
  });

  it('stays dismissed after a remount until a new notification arrives', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const first = mount(client);
    expect(await screen.findByText(TITLE, undefined, { timeout: 2000 })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('notifications.close'));
    await waitFor(() => expect(screen.queryByText(TITLE)).not.toBeInTheDocument());
    first.unmount();

    // Tab switch: same unread count, banner must not come back.
    const second = mount(client);
    await new Promise((r) => setTimeout(r, 900));
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
    second.unmount();

    // A new notification raises the count: banner shows again.
    unreadCount = 3;
    await client.invalidateQueries({ queryKey: ['notifications'] });
    mount(client);
    expect(await screen.findByText(TITLE, undefined, { timeout: 2000 })).toBeInTheDocument();
  });
});
