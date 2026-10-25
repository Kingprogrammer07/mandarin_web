import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() =>
  vi.fn<(url: string, body: FormData) => Promise<{ data: unknown }>>(),
);
vi.mock('@/api/client', () => ({ apiClient: {}, apiClientFormData: { post } }));

import { paymentService } from './paymentService';

const receipt = new File(['x'], 'chek.jpg', { type: 'image/jpeg' });
const base = {
  flight_name: 'M310',
  payment_mode: 'full' as const,
  paid_amount: 59774,
  wallet_used: 0,
  receipt_file: receipt,
};

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ data: {} });
});

describe('submitOnline — card digits', () => {
  it('sends the last 4 digits of the card when the client typed them', async () => {
    await paymentService.submitOnline({ ...base, card_last4: '2530' });

    const body = post.mock.calls[0][1];
    expect(body.get('card_last4')).toBe('2530');
    expect(body.get('receipt_file')).toBeInstanceOf(File);
  });

  it('leaves the field out when the client did not', async () => {
    await paymentService.submitOnline(base);

    expect(post.mock.calls[0][1].has('card_last4')).toBe(false);
  });
});
