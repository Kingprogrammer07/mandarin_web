/**
 * Publishing a courier app build: list, pick an APK, upload with a note.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/client', () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock('@/api/services/courierService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/services/courierService')>()),
  courierAppService: { list: vi.fn(), upload: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { courierAppService, type CourierAppRelease } from '@/api/services/courierService';
import CourierAppReleases from './CourierAppReleases';

const RELEASE: CourierAppRelease = {
  build: 3,
  version_code: 2003,
  version_name: '1.0.2',
  notes: 'Tema tanlash',
  size_bytes: 25 * 1024 * 1024,
  sha256: 'a'.repeat(64),
  published_at: '2026-10-23T07:00:00Z',
  uploaded_by: 'super-admin',
};

function renderIt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CourierAppReleases />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(courierAppService.list).mockReset();
  vi.mocked(courierAppService.upload).mockReset();
});

describe('CourierAppReleases', () => {
  it('shows the current build and uploads a new APK with its note', async () => {
    vi.mocked(courierAppService.list).mockResolvedValue([RELEASE]);
    vi.mocked(courierAppService.upload).mockResolvedValue({ ...RELEASE, build: 4, version_name: '1.0.3' });
    renderIt();

    expect(await screen.findByText('Joriy: 1.0.2 · build 3')).toBeInTheDocument();
    expect(screen.getByText('Tema tanlash')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /Chiqarish/ });
    expect(button).toBeDisabled();

    const apk = new File(['apk'], 'app-arm64-v8a-release.apk', {
      type: 'application/vnd.android.package-archive',
    });
    fireEvent.change(screen.getByLabelText('APK fayl'), { target: { files: [apk] } });
    fireEvent.change(screen.getByPlaceholderText(/Masalan/), { target: { value: 'Xarita tezroq' } });
    fireEvent.click(button);

    await waitFor(() => expect(courierAppService.upload).toHaveBeenCalledTimes(1));
    expect(vi.mocked(courierAppService.upload).mock.calls[0].slice(0, 2)).toEqual([apk, 'Xarita tezroq']);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('1.0.3 (build 4) chiqarildi'));
  });

  it('says so when nothing was published yet', async () => {
    vi.mocked(courierAppService.list).mockResolvedValue([]);
    renderIt();
    expect(await screen.findByText('Hali versiya yuklanmagan.')).toBeInTheDocument();
  });
});
