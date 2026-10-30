/**
 * Settings → Yuklar: the super-admin changes the display extra for manifest weights.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/client', () => ({ apiClient: {} }));
vi.mock('@/api/services/systemService', () => ({
  systemService: { getCargoWeightExtra: vi.fn(), updateCargoWeightExtra: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { systemService } from '@/api/services/systemService';
import CargoWeightExtraSection from './CargoWeightExtraSection';

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CargoWeightExtraSection />
    </QueryClientProvider>,
  );
}

describe('CargoWeightExtraSection', () => {
  it('shows the current extra and saves a new one typed with a comma', async () => {
    vi.mocked(systemService.getCargoWeightExtra).mockResolvedValue({ extra_kg: 0.1 });
    vi.mocked(systemService.updateCargoWeightExtra).mockResolvedValue({ extra_kg: 0.25 });
    renderSection();

    const input = await screen.findByDisplayValue('0.10');
    expect(screen.getByText(/1.25 kg mijoz va adminlarga 1.35 kg/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '0,25' } });
    fireEvent.click(screen.getByRole('button', { name: /Saqlash/ }));
    await waitFor(() => expect(systemService.updateCargoWeightExtra).toHaveBeenCalledWith(0.25));
  });

  it('refuses a value above the limit', async () => {
    vi.mocked(systemService.getCargoWeightExtra).mockResolvedValue({ extra_kg: 0.1 });
    renderSection();

    fireEvent.change(await screen.findByDisplayValue('0.10'), { target: { value: '10' } });
    expect(screen.getByRole('button', { name: /Saqlash/ })).toBeDisabled();
  });
});
