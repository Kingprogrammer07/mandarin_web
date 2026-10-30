/**
 * The UzPost step's «To'lov usuli» list. A card transfer and Payme take the
 * whole fee, so the wallet blocks them; NBU takes the wallet's part but not a
 * remainder under its floor; the receipt way is there only when the server
 * hands out a card, which it does not while card transfer requests work.
 */
import type { ComponentProps } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n/config';
import type { CalculateUzpostResponse } from '@/api/services/deliveryService';
import type { CardIntent } from '@/api/services/paymentService';
import type { SavedCardItem } from '@/api/services/nbuPaymentService';
import type { UzpostBranch } from '@/types/uzpostBranch';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/client', () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock('@/utils/audioUtils', () => ({ playApplePaySound: vi.fn() }));
vi.mock('@/components/delivery/UzpostBranchPicker', () => ({ UzpostBranchPicker: () => null }));
vi.mock('@/api/services/paymentService', () => ({
  paymentService: { openDeliveryCardIntent: vi.fn(), getCardIntent: vi.fn() },
}));
vi.mock('@/api/services/paymeService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/services/paymeService')>()),
  paymeService: { available: vi.fn(), openDeliveryOrder: vi.fn(), getOrder: vi.fn() },
  openPaymeCheckout: vi.fn(() => true),
}));

import { paymentService } from '@/api/services/paymentService';
import { openPaymeCheckout, paymeService, type PaymeOrder } from '@/api/services/paymeService';
import { StepUzpostPayment } from './DeliveryRequestPage';

const payments = vi.mocked(paymentService);
const payme = vi.mocked(paymeService);

const branch: UzpostBranch = {
  id: 12,
  name: 'Chilonzor 100115',
  index: 100115,
  address: 'Chilonzor tumani',
  longitude: 69.2,
  latitude: 41.28,
  workdays: null,
  lunch: null,
  saturday: null,
  dayOff: null,
  otherScheduleNotes: null,
};

const savedCard: SavedCardItem = {
  id: 7,
  card_masked: '626262******2994',
  nickname: null,
  last_used_at: null,
  created_at: '2026-10-01T00:00:00Z',
};

function calc(overrides: Partial<CalculateUzpostResponse> = {}): CalculateUzpostResponse {
  return {
    total_weight: 3.2,
    price_per_kg: 7_000,
    total_amount: 24_500,
    wallet_balance: 0,
    card: null,
    warning: null,
    card_intent_available: true,
    ...overrides,
  };
}

type StepProps = ComponentProps<typeof StepUzpostPayment>;

function renderStep(calcData: CalculateUzpostResponse, props: Partial<StepProps> = {}) {
  const handlers = {
    onSubmit: vi.fn(),
    onPayOnline: vi.fn(),
    onChargeCard: vi.fn(),
    onPaid: vi.fn(),
    onFinish: vi.fn(),
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <StepUzpostPayment
        calcData={calcData}
        loading={false}
        selectedFlights={['M310', 'M311']}
        submitting={false}
        branches={[branch]}
        branchesLoading={false}
        branchesError={false}
        selectedBranch={branch}
        suggestedBranch={null}
        onBranchSelect={vi.fn()}
        onBranchesRetry={vi.fn()}
        onBack={vi.fn()}
        phoneNumber=""
        onPhoneChange={vi.fn()}
        profileName="Ali Valiyev"
        recipientName={null}
        onRecipientNameChange={vi.fn()}
        paymentLocked={false}
        nbuEnabled
        savedCards={[]}
        paymeEnabled={false}
        {...handlers}
        {...props}
      />
    </QueryClientProvider>,
  );
  return handlers;
}

const method = (title: RegExp) => screen.getByRole('radio', { name: title });
const payButton = () => screen.getByRole('button', { name: /to'lash|Davom etish|tanlang|Jo'natish/ });
const walletSwitch = () => screen.getByRole('switch', { name: /Hamyondan to'lash/ });

const theRequest = {
  flight_names: ['M310', 'M311'],
  location_id: 12,
  phone_number: null,
  recipient_name: null,
};

beforeAll(async () => {
  await i18n.changeLanguage('uz');
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StepUzpostPayment — the list of methods', () => {
  it('with card transfer requests the receipt way is gone and a transfer asks for the whole fee', async () => {
    payments.openDeliveryCardIntent.mockReturnValue(new Promise(() => {}));
    renderStep(calc(), { savedCards: [savedCard] });

    const methods = screen.getByRole('group', { name: "To'lov usuli" });
    expect(within(methods).getAllByRole('radio')).toHaveLength(3);
    expect(method(/6262 •••• 2994/)).toBeChecked();
    expect(method(/Boshqa karta/)).toBeEnabled();
    expect(screen.queryByRole('radio', { name: /Online to'lov/ })).not.toBeInTheDocument();
    expect(payButton()).toHaveTextContent(/^24\s500 so'm to'lash$/);

    fireEvent.click(method(/Kartaga o'tkazma/));
    expect(payButton()).toHaveTextContent('Davom etish');
    fireEvent.click(payButton());

    await waitFor(() => expect(payments.openDeliveryCardIntent).toHaveBeenCalledTimes(1));
    expect(payments.openDeliveryCardIntent.mock.calls[0][0]).toEqual(theRequest);
  });

  it('«Boshqa usulni tanlash» on the transfer brings the list back', async () => {
    const intent: CardIntent = {
      id: 31,
      purpose: 'uzpost',
      flight_name: 'M310, M311',
      payment_mode: 'full',
      state: 'open',
      receipt: null,
      amount: 24_537,
      debt: 24_500,
      pay_amount: 24_500,
      offset: 37,
      card_number: '6262570123452994',
      card_owner: 'MANDARIN CARGO',
      card_last4: '2994',
      expires_at: '2026-10-30T12:30:00Z',
      server_time: '2026-10-30T12:00:00Z',
      delivery_request_id: null,
    };
    payments.openDeliveryCardIntent.mockResolvedValue(intent);
    payments.getCardIntent.mockResolvedValue(intent);
    renderStep(calc());

    fireEvent.click(method(/Kartaga o'tkazma/));
    fireEvent.click(payButton());
    expect(await screen.findByText(/24\s537/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: "To'lov usuli" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Boshqa usulni tanlash' }));
    expect(screen.getByRole('group', { name: "To'lov usuli" })).toBeInTheDocument();
  });

  it("the wallet blocks the card transfer and Payme; NBU takes the wallet's part", () => {
    const { onPayOnline } = renderStep(calc({ wallet_balance: 10_000 }), { paymeEnabled: true });

    fireEvent.click(walletSwitch());

    expect(method(/Kartaga o'tkazma/)).toBeDisabled();
    expect(method(/Payme/)).toBeDisabled();
    expect(screen.getAllByText("Balans bilan birga bo'lmaydi")).toHaveLength(2);
    expect(method(/Bank kartasi/)).toBeChecked();
    expect(payButton()).toHaveTextContent(/^14\s500 so'm to'lash$/);

    fireEvent.click(payButton());
    expect(onPayOnline).toHaveBeenCalledWith(10_000, '');
  });

  it("a remainder under NBU's floor is not charged: the wallet has to come off", () => {
    renderStep(calc({ wallet_balance: 24_000 }));

    fireEvent.click(walletSwitch());

    expect(method(/Bank kartasi/)).toBeDisabled();
    expect(screen.getByText(/Qoldiq 1\s000 so'mdan kam: hamyonni o'chirib to'lang/)).toBeInTheDocument();
    expect(payButton()).toHaveTextContent("To'lov usulini tanlang");
    expect(payButton()).toBeDisabled();

    fireEvent.click(walletSwitch());
    expect(method(/Bank kartasi/)).toBeChecked();
    expect(payButton()).toHaveTextContent(/^24\s500 so'm to'lash$/);
  });

  it('a wallet that covers the fee is a method of its own, without the switch', () => {
    const { onSubmit } = renderStep(calc({ wallet_balance: 30_000 }));

    expect(method(/Balansdan to'lash/)).toBeChecked();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "Balansdan to'lash" }));
    expect(onSubmit).toHaveBeenCalledWith(24_500, null, '');
  });

  it('without card transfer requests the receipt way shows the card and needs the receipt', async () => {
    const { onSubmit } = renderStep(
      calc({
        card_intent_available: false,
        card: { card_number: '8600 1234 5678 9012', card_owner: 'MANDARIN CARGO' },
      }),
      { nbuEnabled: false },
    );

    expect(method(/Online to'lov/)).toBeChecked();
    expect(screen.queryByRole('radio', { name: /Kartaga o'tkazma/ })).not.toBeInTheDocument();
    expect(screen.getByText('8600 1234 5678 9012')).toBeInTheDocument();
    expect(payButton()).toBeDisabled();

    const receipt = new File(['%PDF-1.4'], 'chek.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [receipt] } });

    await waitFor(() => expect(payButton()).toBeEnabled());
    fireEvent.click(payButton());
    expect(onSubmit).toHaveBeenCalledWith(0, receipt, '');
  });
});

describe('StepUzpostPayment — Payme', () => {
  const order: PaymeOrder = {
    id: 52,
    kind: 'delivery',
    flight_name: 'M310, M311',
    state: 'open',
    amount: 24_500,
    checkout_url: 'https://checkout.paycom.uz/bT1hYmM7YWMub3JkZXJfaWQ9NTI=',
    expires_at: '2026-10-30T12:30:00Z',
    server_time: '2026-10-30T12:00:00Z',
    delivery_request_id: null,
  };

  it('is offered only while the server has it on', () => {
    renderStep(calc());
    expect(screen.queryByRole('radio', { name: /Payme/ })).not.toBeInTheDocument();
  });

  it("opens the whole fee's order and Payme's page", async () => {
    payme.openDeliveryOrder.mockResolvedValue(order);
    payme.getOrder.mockResolvedValue(order);
    renderStep(calc(), { paymeEnabled: true });

    fireEvent.click(method(/Payme/));
    expect(payButton()).toHaveTextContent(/^24\s500 so'm to'lash$/);
    fireEvent.click(payButton());

    await waitFor(() => expect(payme.openDeliveryOrder).toHaveBeenCalledWith(theRequest));
    expect(openPaymeCheckout).toHaveBeenCalledWith(order.checkout_url);
    expect(await screen.findByText(/M310, M311/)).toBeInTheDocument();
  });

  it('a paid order made the request: the branch is kept and «Tayyor» leaves', async () => {
    const paid: PaymeOrder = { ...order, state: 'paid', checkout_url: null, delivery_request_id: 901 };
    payme.openDeliveryOrder.mockResolvedValue(order);
    payme.getOrder.mockResolvedValue(paid);
    const { onPaid, onFinish } = renderStep(calc(), { paymeEnabled: true });

    fireEvent.click(method(/Payme/));
    fireEvent.click(payButton());

    await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole('button', { name: 'Tayyor' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
