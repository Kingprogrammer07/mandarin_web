import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/services/adminAuth', () => ({ switchAdminRole: vi.fn() }));
vi.mock('@/api/client', () => ({ apiClient: {}, apiClientFormData: {} }));

import { AdminAccountMenu } from './AdminAccountMenu';

/** An unsigned token: the menu only decodes the claims, it never verifies. */
function signIn(role: string, roles: string[]): void {
  const payload = btoa(JSON.stringify({ sub: '10', role, roles }));
  localStorage.setItem('access_token', `x.${payload}.y`);
}

function menuItems(): Array<string | null> {
  return screen.getAllByRole('menuitem').map((item) => item.textContent);
}

beforeEach(() => {
  localStorage.clear();
});

describe('AdminAccountMenu', () => {
  it('lists only roles that can be switched into', () => {
    signIn('worker', ['worker', 'manager', 'warehouse', 'uzpost-label-config']);
    render(<AdminAccountMenu onLogout={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Hisob: worker' }));

    expect(screen.getByText('Rolni almashtirish')).toBeInTheDocument();
    expect(menuItems()).toEqual(['worker', 'manager', 'warehouse', 'Chiqish']);
  });

  it('offers no switching when the grant is the only other role', () => {
    signIn('warehouse', ['warehouse', 'uzpost-label-config']);
    render(<AdminAccountMenu onLogout={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Hisob: warehouse' }));

    expect(screen.queryByText('Rolni almashtirish')).toBeNull();
    expect(menuItems()).toEqual(['Chiqish']);
  });
});
