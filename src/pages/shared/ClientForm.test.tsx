/**
 * Renders exactly what ManagerPage's create sheet renders — `mode="add"`, no
 * client data — and asserts the two location fields are present.
 *
 * Written while chasing "region va district selectlari umuman ko'rinmayapti".
 * It passed, which is what located the real fault: the fields were in the DOM
 * all along and the dropdown was painting behind the sheet's backdrop. That
 * half is guarded by `components/ui/portal-stacking.test.tsx`; this half keeps
 * the fields themselves from silently disappearing from the form.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeAll } from 'vitest';

// The form calls the API from effects on mount. Nothing here should reach the
// network; the point is the render, not the data.
vi.mock('@/api/services/client', () => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
  getClient: vi.fn(async () => ({})),
  getPassportImagesMetadata: vi.fn(async () => []),
  previewClientCode: vi.fn(async () => ({ code: 'M000001' })),
}));

import i18n from '@/i18n/config';
import ClientForm from './ClientForm';

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
  }
});

describe('ClientForm — add mode', () => {
  it('renders the region and district selects', () => {
    render(<ClientForm mode="add" />);

    const comboboxes = screen.getAllByRole('combobox');
    // Region and district are the only two Select triggers in add mode.
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText(i18n.t('client.region'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('client.district'))).toBeInTheDocument();
  });
});
