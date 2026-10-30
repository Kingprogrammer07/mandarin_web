/**
 * The card transfer screen: the exact sum is the client's only proof of
 * payment, so it must be shown and copied exactly; refusals and the booked
 * payment must reach the client in their language.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n/config';
import uz from '@/i18n/locales/uz.json';
import type { CardIntent } from '@/api/services/paymentService';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/client', () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock('@/utils/audioUtils', () => ({ playApplePaySound: vi.fn() }));
vi.mock('@/api/services/paymentService', () => ({
  paymentService: { openCardIntent: vi.fn(), getCardIntent: vi.fn() },
}));

import { paymentService } from '@/api/services/paymentService';
import { CardTransferPanel } from './CardTransferPanel';

const service = vi.mocked(paymentService);
const text = uz.cardTransfer;

function intent(overrides: Partial<CardIntent> = {}): CardIntent {
  const now = Date.parse('2026-10-30T12:00:00Z');
  return {
    id: 7,
    flight_name: 'M310',
    payment_mode: 'full',
    state: 'open',
    receipt: null,
    amount: 340037,
    debt: 340000,
    pay_amount: 340000,
    offset: 37,
    card_number: '8600123412345940',
    card_owner: 'ALI VALIYEV',
    card_last4: '5940',
    expires_at: new Date(now + 30 * 60_000).toISOString(),
    server_time: new Date(now).toISOString(),
    ...overrides,
  };
}

function renderPanel(props: Partial<Parameters<typeof CardTransferPanel>[0]> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const onBack = vi.fn();
  const onDone = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <CardTransferPanel
        flightName="M310"
        paymentMode="full"
        onBack={onBack}
        onDone={onDone}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { invalidate, onBack, onDone };
}

const digitsOnly = (value: string) => value.replace(/\s/g, '');

beforeAll(async () => {
  await i18n.changeLanguage('uz');
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CardTransferPanel', () => {
  it('shows the card and the exact sum, and copies the sum as plain digits', async () => {
    service.openCardIntent.mockResolvedValue(intent());
    service.getCardIntent.mockResolvedValue(intent());
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderPanel();

    expect(await screen.findByText('8600 1234 1234 5940')).toBeInTheDocument();
    expect(screen.getByText((content) => digitsOnly(content) === '340037')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent(/^(30:00|29:5\d)$/);
    expect(service.openCardIntent.mock.calls[0][0]).toEqual({
      flight_name: 'M310',
      payment_mode: 'full',
    });

    fireEvent.click(screen.getByRole('button', { name: text.copyAmount }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('340037'));
  });

  it('asks for a part with its sum and shows what stays owed', async () => {
    const part = intent({ payment_mode: 'partial', pay_amount: 50000, offset: 12, amount: 50012 });
    service.openCardIntent.mockResolvedValue(part);
    service.getCardIntent.mockResolvedValue(part);
    renderPanel({ paymentMode: 'partial', partAmount: 50000 });

    expect(await screen.findByText(text.restAfter)).toBeInTheDocument();
    expect(screen.getByText((content) => digitsOnly(content) === "289988so'm")).toBeInTheDocument();
    expect(service.openCardIntent.mock.calls[0][0]).toEqual({
      flight_name: 'M310',
      payment_mode: 'partial',
      amount: 50000,
    });
  });

  it("tells a refusal in the client's language and leads back to the methods", async () => {
    service.openCardIntent.mockRejectedValue({
      message: 'Konflikt',
      status: 409,
      data: { detail: { code: 'no_card', message: 'server matni' } },
    });
    const { onBack } = renderPanel();

    expect(await screen.findByText(text.errors.no_card)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: text.otherMethod }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(service.getCardIntent).not.toHaveBeenCalled();
  });

  it('says the money came while an admin confirms', async () => {
    service.openCardIntent.mockResolvedValue(intent());
    service.getCardIntent.mockResolvedValue(intent({ state: 'found', card_number: null }));
    renderPanel();

    expect(await screen.findByText(text.foundTitle)).toBeInTheDocument();
    expect(screen.queryByText('8600 1234 1234 5940')).not.toBeInTheDocument();
  });

  it('shows a booked payment, refreshes the flights, and the surplus going to the balance', async () => {
    service.openCardIntent.mockResolvedValue(intent());
    service.getCardIntent.mockResolvedValue(intent({ state: 'paid', card_number: null }));
    const { invalidate, onDone } = renderPanel();

    expect(await screen.findByText(text.paidTitle)).toBeInTheDocument();
    expect(screen.getByText("Ortiqcha 37 so'm balansingizga qo'shildi.")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['payment-available-flights'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['walletBalance'] });

    fireEvent.click(screen.getByRole('button', { name: uz.makePayment.done }));
    expect(onDone).toHaveBeenCalledOnce();
  });
});
