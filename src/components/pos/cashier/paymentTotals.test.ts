import { describe, expect, it } from 'vitest';

import { computePaymentTotals } from './paymentTotals';

const base = {
  totalOwed: 0,
  walletBalance: 0,
  useWallet: false,
  receivedOverride: null,
};

describe('computePaymentTotals', () => {
  it('pre-fills the exact amount due, without rounding', () => {
    // The .50 is the whole point: rounding it up creates wallet credit for
    // money nobody handed over.
    const totals = computePaymentTotals({ ...base, totalOwed: 786400.5 });
    expect(totals.receivedInput).toBe('786400.5');
    expect(totals.receivedAmount).toBe(786400.5);
    expect(totals.change).toBe(0);
    expect(totals.shortfall).toBe(0);
  });

  it('drops a trailing zero rather than showing 500000.00', () => {
    const totals = computePaymentTotals({ ...base, totalOwed: 500000 });
    expect(totals.receivedInput).toBe('500000');
  });

  it('applies the wallet only up to the debt', () => {
    const totals = computePaymentTotals({
      ...base,
      totalOwed: 100000,
      walletBalance: 250000,
      useWallet: true,
    });
    expect(totals.walletDeduction).toBe(100000);
    expect(totals.netAfterWallet).toBe(0);
    // Nothing left to take, so the field is empty rather than showing 0.
    expect(totals.receivedInput).toBe('');
  });

  it('takes the whole wallet when it is smaller than the debt', () => {
    const totals = computePaymentTotals({
      ...base,
      totalOwed: 300000,
      walletBalance: 120000,
      useWallet: true,
    });
    expect(totals.walletDeduction).toBe(120000);
    expect(totals.netAfterWallet).toBe(180000);
    expect(totals.receivedInput).toBe('180000');
  });

  it('never adds a negative wallet balance to the bill', () => {
    // A client in debt carries a negative balance. Without the floor this
    // would raise what the cashier is told to collect.
    const totals = computePaymentTotals({
      ...base,
      totalOwed: 200000,
      walletBalance: -50000,
      useWallet: true,
    });
    expect(totals.walletDeduction).toBe(0);
    expect(totals.netAfterWallet).toBe(200000);
  });

  it('ignores the wallet while the toggle is off', () => {
    const totals = computePaymentTotals({
      ...base,
      totalOwed: 200000,
      walletBalance: 500000,
      useWallet: false,
    });
    expect(totals.walletDeduction).toBe(0);
    expect(totals.netAfterWallet).toBe(200000);
  });

  it('reports an overpayment as change', () => {
    const totals = computePaymentTotals({
      ...base,
      totalOwed: 180000,
      receivedOverride: '200000',
    });
    expect(totals.receivedAmount).toBe(200000);
    expect(totals.change).toBe(20000);
    expect(totals.shortfall).toBe(0);
  });

  it('reports an underpayment as a shortfall', () => {
    const totals = computePaymentTotals({
      ...base,
      totalOwed: 180000,
      receivedOverride: '150000',
    });
    expect(totals.change).toBe(0);
    expect(totals.shortfall).toBe(30000);
  });

  it('treats an emptied field as the full amount due', () => {
    const totals = computePaymentTotals({
      ...base,
      totalOwed: 180000,
      receivedOverride: '',
    });
    expect(totals.receivedInput).toBe('');
    expect(totals.receivedAmount).toBe(180000);
    expect(totals.change).toBe(0);
    expect(totals.shortfall).toBe(0);
  });

  it('nets the wallet before comparing against what was handed over', () => {
    const totals = computePaymentTotals({
      totalOwed: 500000,
      walletBalance: 200000,
      useWallet: true,
      receivedOverride: '300000',
    });
    expect(totals.walletDeduction).toBe(200000);
    expect(totals.netAfterWallet).toBe(300000);
    expect(totals.change).toBe(0);
    expect(totals.shortfall).toBe(0);
  });

  it('shows nothing due when no cargo is selected', () => {
    const totals = computePaymentTotals(base);
    expect(totals.netAfterWallet).toBe(0);
    expect(totals.receivedInput).toBe('');
    expect(totals.receivedAmount).toBe(0);
    expect(totals.change).toBe(0);
    expect(totals.shortfall).toBe(0);
  });

  it('keeps the cashier’s entry when it matches the amount due', () => {
    const totals = computePaymentTotals({
      ...base,
      totalOwed: 180000,
      receivedOverride: '180000',
    });
    expect(totals.change).toBe(0);
    expect(totals.shortfall).toBe(0);
  });
});
