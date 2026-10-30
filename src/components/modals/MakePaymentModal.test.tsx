/**
 * The details step of the payment wizard: one «To'lov usuli» list and one pay
 * button. The list must never offer a method that would charge something other
 * than what the screen shows — NBU always takes the whole debt and never the
 * wallet, a card transfer cannot carry the wallet's part, cash cannot take a
 * custom sum.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n/config';
import type { FlightPaymentDetailsResponse } from '@/api/services/paymentService';
import type { SavedCardItem } from '@/api/services/nbuPaymentService';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/client', () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock('@/utils/audioUtils', () => ({ playApplePaySound: vi.fn() }));
vi.mock('@/utils/nbuReturnContext', () => ({ openNbuUrl: vi.fn() }));
vi.mock('@/utils/nbuCardReauth', () => ({ isCardReauthError: () => false, promptCardReauth: vi.fn() }));
vi.mock('@/hooks/useGuideTour', () => ({ useGuideTour: vi.fn() }));
vi.mock('@/hooks/useMaintenanceWatcher', () => ({
  useMaintenanceWatcher: () => ({ isMaintenance: false, isAdmin: false, isLoading: false }),
}));
vi.mock('@/components/office/OfficeStatus', () => ({ OfficeVisitSummary: () => null }));
vi.mock('@/pages/dashboard/components/TrackResultCard', () => ({ TrackResultCard: () => null }));
vi.mock('@/api/services/cargo', () => ({ trackCargo: vi.fn() }));
vi.mock('@/api/services/paymentService', () => ({
  paymentService: {
    getAvailableFlights: vi.fn(),
    getFlightDetails: vi.fn(),
    submitWalletOnly: vi.fn(),
    submitCash: vi.fn(),
    submitOnline: vi.fn(),
    openCardIntent: vi.fn(),
    getCardIntent: vi.fn(),
  },
}));
vi.mock('@/api/services/nbuPaymentService', () => ({
  nbuPaymentService: {
    getStatus: vi.fn(),
    listCards: vi.fn(),
    init: vi.fn(),
    chargeSavedCard: vi.fn(),
  },
}));
vi.mock('@/api/services/paymeService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/services/paymeService')>()),
  paymeService: {
    available: vi.fn(),
    openOrder: vi.fn(),
    openDeliveryOrder: vi.fn(),
    getOrder: vi.fn(),
  },
  openPaymeCheckout: vi.fn(() => true),
}));

import { toast } from 'sonner';
import { paymentService } from '@/api/services/paymentService';
import { nbuPaymentService } from '@/api/services/nbuPaymentService';
import { openPaymeCheckout, paymeService, type PaymeOrder } from '@/api/services/paymeService';
import MakePaymentModal from './MakePaymentModal';

const payments = vi.mocked(paymentService);
const nbu = vi.mocked(nbuPaymentService);
const payme = vi.mocked(paymeService);

function flight(overrides: Partial<FlightPaymentDetailsResponse> = {}): FlightPaymentDetailsResponse {
  return {
    flight_name: 'TEST-K1',
    client_code: 'SSSS77',
    total_payment: 1210,
    total_weight: 1,
    price_per_kg_usd: 0.1,
    price_per_kg_uzs: 1210,
    extra_charge: 0,
    track_codes: [],
    wallet_balance: 0,
    partial_allowed: false,
    has_existing_partial: false,
    existing_paid_amount: null,
    existing_remaining_amount: null,
    card_number: null,
    card_owner: null,
    cargo_prices: [],
    payment_links: [{ name: 'Click', slug: 'click', url: 'https://example.com/click' }],
    card_intent_available: true,
    ...overrides,
  };
}

const savedCard: SavedCardItem = {
  id: 7,
  card_masked: '626262******2994',
  nickname: null,
  last_used_at: null,
  created_at: '2026-10-01T00:00:00Z',
};

function openFor(
  details: FlightPaymentDetailsResponse,
  cards: SavedCardItem[] = [savedCard],
  paymeOn = false,
) {
  payments.getFlightDetails.mockResolvedValue(details);
  payments.getAvailableFlights.mockResolvedValue({ flights: [], count: 0 });
  nbu.getStatus.mockResolvedValue({ enabled: true });
  nbu.listCards.mockResolvedValue({ items: cards, count: cards.length });
  payme.available.mockResolvedValue({ enabled: paymeOn });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MakePaymentModal isOpen onClose={vi.fn()} preselectedFlightName={details.flight_name} />
    </QueryClientProvider>,
  );
}

/** The radio of a method row, found by the row's title. */
const method = (title: RegExp) => screen.getByRole('radio', { name: title });
const payButton = () => screen.getByRole('button', { name: /to'lash|Davom etish|tanlang/ });

beforeAll(async () => {
  await i18n.changeLanguage('uz');
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MakePaymentModal — details step', () => {
  it('lists every method once and the button names the charge of the picked one', async () => {
    openFor(flight());

    const methods = await screen.findByRole('group', { name: "To'lov usuli" });
    await waitFor(() => expect(within(methods).getAllByRole('radio')).toHaveLength(5));
    expect(method(/6262 •••• 2994/)).toBeChecked();
    expect(method(/Boshqa karta/)).not.toBeChecked();
    expect(method(/Kartaga o'tkazma/)).toBeEnabled();
    expect(method(/Online to'lov/)).toBeEnabled();
    expect(method(/Naqd/)).toBeEnabled();
    expect(payButton()).toHaveTextContent(/^1\s210 so'm to'lash$/);

    // A saved card is charged from the confirm drawer, never by this tap.
    fireEvent.click(payButton());
    expect(await screen.findByText("To'lovni tasdiqlang")).toBeInTheDocument();
    expect(nbu.chargeSavedCard).not.toHaveBeenCalled();
  });

  it('a card transfer goes to its own step with the exact sum', async () => {
    payments.openCardIntent.mockReturnValue(new Promise(() => {}));
    openFor(flight());

    fireEvent.click(await screen.findByRole('radio', { name: /Kartaga o'tkazma/ }));
    expect(payButton()).toHaveTextContent('Davom etish');
    fireEvent.click(payButton());

    await waitFor(() => expect(payments.openCardIntent).toHaveBeenCalledTimes(1));
    expect(payments.openCardIntent.mock.calls[0][0]).toEqual({
      flight_name: 'TEST-K1',
      payment_mode: 'full',
    });
  });

  it('the wallet blocks NBU and the card transfer and says why', async () => {
    openFor(flight({ total_payment: 2_456_500, wallet_balance: 120_000 }));

    fireEvent.click(await screen.findByRole('switch', { name: /Balansdan foydalanish/ }));

    for (const title of [/6262 •••• 2994/, /Boshqa karta/, /Kartaga o'tkazma/]) {
      expect(method(title)).toBeDisabled();
    }
    expect(screen.getAllByText("Balans bilan birga bo'lmaydi")).toHaveLength(3);
    // The first method that can take the wallet's part is picked.
    expect(method(/Online to'lov/)).toBeChecked();
    expect(payButton()).toHaveTextContent('Davom etish');

    // Off again: the saved card is back.
    fireEvent.click(screen.getByRole('switch', { name: /Balansdan foydalanish/ }));
    expect(method(/6262 •••• 2994/)).toBeChecked();
  });

  it('a custom sum blocks NBU and cash, and a sum out of range blocks the button', async () => {
    openFor(flight({ total_payment: 2_456_500, partial_allowed: true }));

    fireEvent.click(await screen.findByRole('switch', { name: /Boshqa summa/ }));

    expect(method(/6262 •••• 2994/)).toBeDisabled();
    expect(method(/Boshqa karta/)).toBeDisabled();
    expect(method(/Naqd/)).toBeDisabled();
    expect(screen.getByText("Boshqa summa bilan bo'lmaydi")).toBeInTheDocument();
    expect(method(/Kartaga o'tkazma/)).toBeChecked();

    const field = screen.getByLabelText('Summani kiriting');
    expect(payButton()).toBeDisabled(); // nothing typed yet
    fireEvent.change(field, { target: { value: '500' } });
    expect(payButton()).toBeDisabled(); // under the 1 000 so'm minimum
    fireEvent.change(field, { target: { value: '3000000' } });
    expect(payButton()).toBeDisabled(); // over the debt
    fireEvent.change(field, { target: { value: '500000' } });
    expect(payButton()).toBeEnabled();
  });

  it("below NBU's floor the NBU rows and the button quote the floor", async () => {
    openFor(flight({ total_payment: 640 }), []);

    const nbuRow = await screen.findByRole('radio', { name: /Bank kartasi/ });
    expect(nbuRow).toBeChecked();
    expect(screen.getByText(/1\s000 so'm yechiladi, ortiqcha 360 so'm balansingizga tushadi/)).toBeInTheDocument();
    expect(payButton()).toHaveTextContent(/^1\s000 so'm to'lash$/);
  });

  it('a wallet that covers the debt is a method of its own, without the switch', async () => {
    payments.submitWalletOnly.mockResolvedValue({ success: true } as never);
    openFor(flight({ total_payment: 18_500, wallet_balance: 40_000 }), []);

    const wallet = await screen.findByRole('radio', { name: /Balansdan to'lash/ });
    expect(wallet).toBeChecked();
    expect(screen.queryByRole('switch', { name: /Balansdan foydalanish/ })).not.toBeInTheDocument();

    fireEvent.click(payButton());
    expect(await screen.findByText("Balansdan to'lov")).toBeInTheDocument();
  });
});

function paymeOrder(overrides: Partial<PaymeOrder> = {}): PaymeOrder {
  return {
    id: 41,
    kind: 'flight',
    flight_name: 'TEST-K1',
    state: 'open',
    amount: 125_000,
    checkout_url: 'https://checkout.paycom.uz/bT1hYmM7YWMub3JkZXJfaWQ9NDE=',
    expires_at: '2026-10-30T12:30:00Z',
    server_time: '2026-10-30T12:00:00Z',
    delivery_request_id: null,
    ...overrides,
  };
}

describe('MakePaymentModal — Payme', () => {
  it('is offered only while the server has it on', async () => {
    openFor(flight(), [], false);

    const methods = await screen.findByRole('group', { name: "To'lov usuli" });
    await waitFor(() => expect(within(methods).getAllByRole('radio')).toHaveLength(4));
    expect(screen.queryByRole('radio', { name: /Payme sahifasida/ })).not.toBeInTheDocument();
  });

  it("takes NBU's limits: the whole debt, never the wallet's part", async () => {
    openFor(flight({ total_payment: 2_456_500, wallet_balance: 120_000, partial_allowed: true }), [], true);

    const row = await screen.findByRole('radio', { name: /Payme sahifasida/ });
    expect(row).toBeEnabled();

    fireEvent.click(screen.getByRole('switch', { name: /Balansdan foydalanish/ }));
    expect(row).toBeDisabled();
    expect(screen.getAllByText("Balans bilan birga bo'lmaydi")).toHaveLength(3);
    fireEvent.click(screen.getByRole('switch', { name: /Balansdan foydalanish/ }));

    fireEvent.click(screen.getByRole('switch', { name: /Boshqa summa/ }));
    expect(row).toBeDisabled();
  });

  it('is off under 1 000 so\'m, which Payme does not take', async () => {
    openFor(flight({ total_payment: 640 }), [], true);

    expect(await screen.findByRole('radio', { name: /Payme/ })).toBeDisabled();
    expect(screen.getByText(/^1\s000 so'mdan kam qarzga bo'lmaydi$/)).toBeInTheDocument();
  });

  it("opens Payme's page on the tap and watches the order until it is booked", async () => {
    payme.openOrder.mockResolvedValue(paymeOrder());
    payme.getOrder.mockResolvedValue(paymeOrder());
    openFor(flight({ total_payment: 125_000 }), [], true);

    fireEvent.click(await screen.findByRole('radio', { name: /Payme sahifasida/ }));
    expect(payButton()).toHaveTextContent(/^125\s000 so'm to'lash$/);
    fireEvent.click(payButton());

    await waitFor(() => expect(payme.openOrder).toHaveBeenCalledWith('TEST-K1'));
    expect(openPaymeCheckout).toHaveBeenCalledWith(paymeOrder().checkout_url);

    // The step says what Payme charges and reopens the same page.
    expect(await screen.findByText("Payme yechadigan summa")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Payme sahifasini ochish/ }));
    expect(openPaymeCheckout).toHaveBeenCalledTimes(2);
    expect(payme.openOrder).toHaveBeenCalledTimes(1);
  });

  it('shows the booking once Payme has performed the payment', async () => {
    payme.openOrder.mockResolvedValue(paymeOrder());
    payme.getOrder.mockResolvedValue(paymeOrder({ state: 'paid', checkout_url: null }));
    openFor(flight({ total_payment: 125_000 }), [], true);

    fireEvent.click(await screen.findByRole('radio', { name: /Payme sahifasida/ }));
    fireEvent.click(payButton());

    expect(await screen.findByText("To'lov qabul qilindi")).toBeInTheDocument();
    expect(screen.getByText(/^125\s000 so'm TEST-K1 reysiga yozildi\.$/)).toBeInTheDocument();
  });

  it('an order Payme is already paying opens no second page', async () => {
    payme.openOrder.mockResolvedValue(paymeOrder({ state: 'processing', checkout_url: null }));
    payme.getOrder.mockResolvedValue(paymeOrder({ state: 'processing', checkout_url: null }));
    openFor(flight({ total_payment: 125_000 }), [], true);

    fireEvent.click(await screen.findByRole('radio', { name: /Payme sahifasida/ }));
    fireEvent.click(payButton());

    expect(await screen.findByText("To'lov bajarilmoqda")).toBeInTheDocument();
    expect(openPaymeCheckout).not.toHaveBeenCalled();
  });

  it("says the server's reason and stays on the list when no order is opened", async () => {
    payme.openOrder.mockRejectedValue({
      status: 409,
      message: 'Serverda xatolik yuz berdi.',
      data: { detail: { code: 'cash_desk', message: "Bu reys kassada ko'rilgan." } },
    });
    openFor(flight({ total_payment: 125_000 }), [], true);

    fireEvent.click(await screen.findByRole('radio', { name: /Payme sahifasida/ }));
    fireEvent.click(payButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Bu reys kassada ko'rilgan."));
    expect(openPaymeCheckout).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: /Payme sahifasida/ })).toBeInTheDocument();
  });
});
