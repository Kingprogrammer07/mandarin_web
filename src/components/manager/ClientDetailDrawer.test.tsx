/**
 * «Moliya holati» rows (owner report 2026-10-29): every flight showed
 * "0 so'm Qarzdorlik" and nothing said whether the cargo was taken or sits on
 * an astatka shelf. A debt row keeps summa = 0 and its price in total_amount.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ClientTransactionItem } from '../../api/services/adminClients';

// The drawer's API modules need a configured base URL; the card uses none.
vi.mock('../../api/hooks/useAdminClients', () => ({
  useTransactionPaymentDetail: () => ({ data: undefined, isLoading: false }),
}));
vi.mock('../../api/services/adminManagement', () => ({ getAdminJwtClaims: vi.fn() }));
vi.mock('../../api/services/client', () => ({ previewClientCode: vi.fn() }));
vi.mock('./ClientPassportEditor', () => ({ ClientPassportEditor: () => null }));

import { TransactionCard } from './ClientDetailDrawer';

const debtRow: ClientTransactionItem = {
  id: 1,
  reys: 'M288',
  qator_raqami: 0,
  summa: 0,
  vazn: '0.76',
  payment_type: 'online',
  payment_status: 'pending',
  paid_amount: 0,
  remaining_amount: 120000,
  total_amount: 120000,
  is_taken_away: false,
  taken_away_date: null,
  payment_balance_difference: -120000,
  created_at: '2026-09-26T15:40:00Z',
};

describe('TransactionCard', () => {
  it('shows the price of a debt row, not its zero summa', () => {
    render(<TransactionCard tx={debtRow} clientId={7} />);
    expect(screen.getByText(/120\s000 so'm/)).toBeTruthy();
    expect(screen.getByText('Qarzdorlik')).toBeTruthy();
    expect(screen.getByText('Olib ketilmagan')).toBeTruthy();
    expect(screen.queryByText(/Ostatka/)).toBeNull();
  });

  it('says the cargo was taken, with the date', () => {
    render(
      <TransactionCard
        tx={{
          ...debtRow,
          payment_status: 'paid',
          paid_amount: 120000,
          remaining_amount: 0,
          is_taken_away: true,
          taken_away_date: '2026-10-02T10:00:00Z',
        }}
        clientId={7}
      />,
    );
    expect(screen.getByText(/Olib ketilgan · 02\.10\.2026/)).toBeTruthy();
    expect(screen.getByText("To'langan")).toBeTruthy();
  });

  it('names the astatka shelf holding the bag, or the one it was taken from', () => {
    const { rerender } = render(
      <TransactionCard
        tx={{ ...debtRow, astatka_flight_name: 'OSTATKA-21.10', astatka_on_shelf: true }}
        clientId={7}
      />,
    );
    expect(screen.getByText('Ostatkada:', { exact: false })).toBeTruthy();
    expect(screen.getByText('OSTATKA-21.10')).toBeTruthy();

    rerender(
      <TransactionCard
        tx={{
          ...debtRow,
          is_taken_away: true,
          astatka_flight_name: 'OSTATKA-21.10',
          astatka_on_shelf: false,
        }}
        clientId={7}
      />,
    );
    expect(screen.getByText('Ostatkadan olingan:', { exact: false })).toBeTruthy();
  });

  it('shows what is left of a partly paid flight', () => {
    render(
      <TransactionCard
        tx={{ ...debtRow, payment_status: 'partial', paid_amount: 20000, remaining_amount: 100000 }}
        clientId={7}
      />,
    );
    expect(screen.getByText(/Qoldiq: 100\s000 so'm/)).toBeTruthy();
  });
});
