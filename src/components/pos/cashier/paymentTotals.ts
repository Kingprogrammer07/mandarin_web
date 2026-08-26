/**
 * The arithmetic behind the payment summary, with no React in it.
 *
 * The old console computed these inline and kept the received amount in state
 * written from an effect. Pulling the sums out here makes them testable without
 * mounting anything — this is the one part of the payment path that was
 * rewritten rather than transplanted, so it is the part that has to be proven.
 */

/** What the cashier is charging, after the wallet, and what the note leaves over. */
export interface PaymentTotals {
  /** Wallet money applied to this payment. Never more than the debt. */
  walletDeduction: number;
  /** Cash/card still to be taken after the wallet. */
  netAfterWallet: number;
  /** What the amount field shows: the cashier's entry, or the amount due. */
  receivedInput: string;
  /** The figure the payment is built from. */
  receivedAmount: number;
  /** Overpayment, which the backend books as wallet credit. */
  change: number;
  /** Underpayment, which stays on the client's account as debt. */
  shortfall: number;
}

export function computePaymentTotals({
  totalOwed,
  walletBalance,
  useWallet,
  receivedOverride,
}: {
  totalOwed: number;
  walletBalance: number;
  useWallet: boolean;
  /** What the cashier typed, or null while the field follows the amount due. */
  receivedOverride: string | null;
}): PaymentTotals {
  // A wallet cannot pay more than is owed, and a negative balance (the client
  // is in debt) must not be added to the bill.
  const walletDeduction = useWallet ? Math.max(0, Math.min(walletBalance, totalOwed)) : 0;
  const netAfterWallet = totalOwed - walletDeduction;

  // Exact, not rounded. `Math.round` turned a 786,400.50 debt into a pre-filled
  // 786,401 that nobody handed over, and the backend books the 0.50 difference
  // as wallet credit — the ledger already holds four such rows. 352 of 4,308
  // debts end in .5 so'm, so this was not rare. Rounding to a convenient note
  // is the cashier's decision to make, not a default to inherit.
  const autoReceived =
    netAfterWallet > 0 ? String(Number(netAfterWallet.toFixed(2))) : '';
  const receivedInput = receivedOverride ?? autoReceived;

  // `|| netAfterWallet` carried over verbatim: an empty or unparseable field
  // means "the full amount", which is what the cashier sees printed on the
  // button. Note this also treats a typed 0 as the full amount.
  const receivedAmount = parseFloat(receivedInput) || netAfterWallet;

  return {
    walletDeduction,
    netAfterWallet,
    receivedInput,
    receivedAmount,
    change: Math.max(0, receivedAmount - netAfterWallet),
    shortfall: receivedAmount > 0 ? Math.max(0, netAfterWallet - receivedAmount) : 0,
  };
}
