import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  processUnpaidCargoPayment,
  processExistingTransactionPayment,
  fetchRandomActiveCard,
  type PaymentProvider,
  type ProcessPaymentResponse,
  type ActiveCard,
} from '@/api/payments';
import { formatCurrencySum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Loader2, AlertCircle, CheckCircle, Info, Wallet, CreditCard } from 'lucide-react';
import axios from 'axios';
import { getTelegramWebAppData } from '@/api/services/auth';


// ============================================
// DISCRIMINATED UNION TYPES - Strict typing
// ============================================

// Base fields shared by both modes
interface PaymentDataBase {
  clientCode: string;
  flightName: string;
  rowNumber: number;
  weight: number | string | null;
  expectedAmount: number;
}

// Unpaid cargo payment - POST /payments/process
export interface UnpaidCargoPaymentData extends PaymentDataBase {
  mode: 'unpaid_cargo';
  cargoId: number;
}

// Existing transaction payment - POST /payments/process-existing
export interface ExistingTransactionPaymentData extends PaymentDataBase {
  mode: 'existing_transaction';
  transactionId: number;
}

// Discriminated union
export type PaymentData = UnpaidCargoPaymentData | ExistingTransactionPaymentData;

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentData: PaymentData | null;
  onSuccess: () => void;
  walletBalance?: number; // Optional wallet balance
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Safely convert any value to a valid number
 * Returns 0 if conversion fails or value is invalid
 */
function safeNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Validate that payment data has all required fields
 */
function isValidPaymentData(data: PaymentData | null): data is PaymentData {
  if (!data) return false;

  // Check expected amount is a valid number
  const expected = safeNumber(data.expectedAmount);
  if (expected <= 0) return false;

  // Mode-specific validation
  if (data.mode === 'unpaid_cargo') {
    return Boolean(data.clientCode && data.flightName && data.cargoId > 0);
  } else if (data.mode === 'existing_transaction') {
    return data.transactionId > 0;
  }

  return false;
}

export function PaymentModal({
  walletBalance: walletBalanceProp,
  ...props
}: PaymentModalProps) {
  const { isOpen, onClose, paymentData, onSuccess } = props;
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentProvider>('click');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [paymentResult, setPaymentResult] = useState<ProcessPaymentResponse | null>(null);

  // Card state
  const [activeCard, setActiveCard] = useState<ActiveCard | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  // Wallet state
  const [useBalance, setUseBalance] = useState(false);
  const walletBalance = safeNumber(walletBalanceProp);
  const hasWalletBalance = walletBalance > 0;

  // Safe expected amount - always a valid number
  const expectedAmount = useMemo(() => safeNumber(paymentData?.expectedAmount), [paymentData?.expectedAmount]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen && paymentData) {
      setPaidAmount(expectedAmount.toString());
      setPaymentType('click');
      setError(null);
      setSuccess(false);
      setPaymentResult(null);
      setUseBalance(false);
      setActiveCard(null);
      setCardError(null);
      setCardLoading(false);
    }
  }, [isOpen, paymentData, expectedAmount]);

  // Fetch random active card when "card" payment type is selected
  useEffect(() => {
    if (paymentType !== 'card') {
      setActiveCard(null);
      setCardError(null);
      return;
    }

    let cancelled = false;
    setCardLoading(true);
    setCardError(null);

    fetchRandomActiveCard()
      .then((card) => {
        if (!cancelled) {
          setActiveCard(card);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCardError('Karta ma\'lumotlarini yuklashda xatolik');
          setActiveCard(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCardLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [paymentType]);

  // Derived wallet usage and cash to pay
  const { walletUsed, cashToPayDefault } = useMemo(() => {
    let wUsed = 0;
    let cToPay = expectedAmount;

    if (useBalance && hasWalletBalance) {
      wUsed = Math.min(walletBalance, expectedAmount);
      cToPay = Math.max(0, expectedAmount - wUsed);
    }

    return { walletUsed: wUsed, cashToPayDefault: cToPay };
  }, [useBalance, hasWalletBalance, walletBalance, expectedAmount]);

  // Calculate distinct items for display
  const cashToPayInput = safeNumber(paidAmount);
  // Total logic: expected is the goal.
  // We pay: walletUsed (automatic) + cashToPayInput (manual)
  const totalPaid = walletUsed + cashToPayInput;

  // Calculate payment difference
  // Difference = Total Paid (Cash + Wallet) - Expected
  const difference = useMemo(() => {
    return totalPaid - expectedAmount;
  }, [totalPaid, expectedAmount]);

  // Determine if payment would mark cargo as taken (business rule)
  const wouldMarkAsTaken = useMemo(() => {
    if (paymentData?.mode !== 'unpaid_cargo') return false;
    if (paymentType !== 'cash') return false;

    // CRITICAL: Only mark as taken if fully paid (Cash + Wallet >= Expected)
    return totalPaid >= expectedAmount;
  }, [paymentData?.mode, paymentType, totalPaid, expectedAmount]);

  // Auto-update paidAmount when wallet usage changes
  useEffect(() => {
    if (useBalance) {
      // If wallet is turned ON, set input to remaining cash needed
      setPaidAmount(cashToPayDefault.toString());
    } else {
      // If wallet is turned OFF, reset to full expected amount
      setPaidAmount(expectedAmount.toString());
    }
  }, [useBalance, cashToPayDefault, expectedAmount]);

  // Removed old effects and totalPaymentPreview as they are replaced by above logic

  const getDifferenceConfig = () => {
    if (difference < 0) {
      return {
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        label: 'Qarz (qisman to\'lov)',
        icon: AlertCircle,
      };
    } else if (difference > 0) {
      return {
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        label: 'Ortiqcha to\'lov',
        icon: CheckCircle,
      };
    }
    return {
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      label: 'Aniq to\'lov',
      icon: CheckCircle,
    };
  };

  const handleSubmit = async () => {
    if (!paymentData) return;

    const paid = safeNumber(paidAmount);

    // Validation: Amount must be > 0 unless fully covered by wallet
    // If useBalance is true, paid amount can be 0 if wallet covers it.
    // However, if useBalance is false, or wallet is empty, paid must be > 0.
    if (paid <= 0 && !useBalance) {
      setError('To\'lov miqdorini kiriting');
      return;
    }
    // Also if useBalance is true but paid is 0 AND walletUsed is 0? 
    // That means nothing is being paid.
    // walletUsed is not easily accessible here without referencing the state derived earlier.
    // But we know 'hasWalletBalance' is true if useBalance is true (enforced by UI).
    // Let's just trust that if useBalance is true, the user intends to pay with wallet, 
    // and if they left cash as 0, they rely on wallet. 
    // Backend will validate if total is 0.
    if (paid <= 0 && useBalance && !hasWalletBalance) {
      setError('To\'lov miqdorini kiriting');
      return;
    }

    // Validation checks
    if (paymentData.mode === 'unpaid_cargo') {
      if (!paymentData.clientCode) {
        setError('Mijoz kodi topilmadi');
        return;
      }
      if (!paymentData.flightName) {
        setError('Reys nomi topilmadi');
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    const telegramData = getTelegramWebAppData();
    try {
      let response: ProcessPaymentResponse;

      if (paymentData.mode === 'unpaid_cargo') {
        response = await processUnpaidCargoPayment({
          client_code: paymentData.clientCode,
          cargo_id: paymentData.cargoId,
          flight: paymentData.flightName,
          paid_amount: paid,
          payment_type: paymentType,
          admin_id: telegramData?.user?.id || 1,
          use_balance: useBalance,
        });
      } else {
        response = await processExistingTransactionPayment({
          transaction_id: paymentData.transactionId,
          paid_amount: paid,
          payment_type: paymentType,
          admin_id: telegramData?.user?.id || 1,
          use_balance: useBalance,
        });
      }

      setPaymentResult(response);
      setSuccess(true);

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: unknown) {
      console.error('Payment Error:', err);
      let errorMessage = 'To\'lovni amalga oshirishda xatolik';

      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data;
        if (typeof data.error === 'string') {
          errorMessage = data.error;
        } else if (typeof data.message === 'string') {
          errorMessage = data.message;
        } else if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (typeof data === 'string') {
          errorMessage = data;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  // Check if data is valid for submission
  const isDataValid = isValidPaymentData(paymentData);
  const diffConfig = getDifferenceConfig();
  const DiffIcon = diffConfig.icon;

  // Format weight display
  const weightDisplay = paymentData?.weight != null
    ? `${safeNumber(paymentData.weight)} kg`
    : '-';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg w-full max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <DialogTitle>To'lov qilish</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Tranzaksiya ma'lumotlari
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {success && paymentResult ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-xl font-bold text-green-700 mb-6">To'lov muvaffaqiyatli!</p>

              {/* Show actual status from backend response */}
              <div className="w-full bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">To'lov holati</span>
                  <span className={cn(
                    'font-bold',
                    paymentResult.payment.payment_status === 'paid' ? 'text-green-600' :
                      paymentResult.payment.payment_status === 'partial' ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {paymentResult.payment.payment_status === 'paid' ? 'To\'liq to\'langan' :
                      paymentResult.payment.payment_status === 'partial' ? 'Qisman to\'langan' : 'To\'lanmagan'}
                  </span>
                </div>

                {/* CRITICAL: Show actual is_taken_away from backend */}
                {paymentData?.mode === 'unpaid_cargo' && (
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200">
                    <span className="text-muted-foreground">Yuk holati</span>
                    <span className={cn(
                      'font-bold px-2 py-0.5 rounded text-xs uppercase tracking-wide',
                      paymentResult.payment.is_taken_away ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'
                    )}>
                      {paymentResult.payment.is_taken_away ? 'Olingan' : 'Omborda'}
                    </span>
                  </div>
                )}
              </div>

              {/* Wallet Result Info */}
              {(paymentResult.payment.wallet_deducted ?? 0) > 0 && (
                <div className="w-full bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-4 w-4 text-blue-600" />
                    <span className="font-bold text-blue-800 text-sm">Hamyondan to'landi</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Eski balans:</span>
                    <span className="font-mono text-blue-900">{formatCurrencySum(paymentResult.payment.wallet_balance_before ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-blue-200 pt-1">
                    <span className="text-blue-700">Ishlatildi:</span>
                    <span className="font-mono text-blue-900">-{formatCurrencySum(paymentResult.payment.wallet_deducted ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-blue-200 pt-1">
                    <span className="text-blue-700">Qolgan balans:</span>
                    <span className="font-mono text-blue-900">{formatCurrencySum(paymentResult.payment.wallet_balance_after ?? 0)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {!isDataValid && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 mb-4">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <p className="text-sm text-yellow-700">To'lov ma'lumotlari to'liq emas</p>
                </div>
              )}

              <div className="space-y-6">
                {/* Payment Info Grid */}
                <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-y-3 gap-x-2 text-sm border border-gray-100">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-0.5">Mijoz kodi</span>
                    <p className="font-semibold text-gray-900">{paymentData?.clientCode || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-0.5">Reys</span>
                    <p className="font-semibold text-gray-900">{paymentData?.flightName || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-0.5">Qator</span>
                    <p className="font-semibold text-gray-900">
                      {paymentData?.rowNumber ? `#${paymentData.rowNumber}` : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-0.5">Vazn</span>
                    <p className="font-semibold text-gray-900">{weightDisplay}</p>
                  </div>
                </div>

                <div className="">
                  {/* Expected Payment Display */}
                  <div className="flex justify-between items-end mb-4 px-1">
                    <span className="text-sm font-medium text-gray-600">Kutilgan to'lov</span>
                    <span className="font-bold text-xl text-gray-900">
                      {formatCurrencySum(expectedAmount)}
                    </span>
                  </div>

                  {/* Wallet Toggle */}
                  {hasWalletBalance && (
                    <div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-5 w-5 text-blue-600" />
                          <Label htmlFor="use-balance" className="text-sm font-medium text-blue-900 cursor-pointer">
                            Hisobdan foydalanish
                          </Label>
                        </div>
                        <button
                          type="button"
                          id="use-balance"
                          role="switch"
                          aria-checked={useBalance}
                          onClick={() => setUseBalance(!useBalance)}
                          className={cn(
                            "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
                            useBalance ? "bg-blue-600" : "bg-gray-200"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                              useBalance ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>

                      <div className="flex justify-between text-xs text-blue-700 pl-7">
                        <span>Mavjud balans:</span>
                        <span className="font-bold font-mono">{formatCurrencySum(walletBalance)}</span>
                      </div>

                      {useBalance && (
                        <div className="mt-2 text-xs text-blue-600 pl-7 border-t border-blue-200 pt-2 space-y-1">
                          <div className="flex justify-between">
                            <span>Kutilgan summa:</span>
                            <span className="font-semibold">{formatCurrencySum(expectedAmount)}</span>
                          </div>
                          <div className="flex justify-between font-bold">
                            <span>Hamyondan ishlatiladi:</span>
                            <span>- {formatCurrencySum(walletUsed)}</span>
                          </div>
                          <div className="flex justify-between border-t border-blue-200 pt-1 mt-1 text-blue-800">
                            <span>Naqd to'lanadi:</span>
                            <span>{formatCurrencySum(cashToPayDefault)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Input Fields */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="paid_amount" className="text-xs font-medium text-gray-500 uppercase">
                        {useBalance ? "Naqd to'lov miqdori" : "To'lov miqdori"}
                      </Label>
                      <div className="relative">
                        <Input
                          id="paid_amount"
                          type="number"
                          value={paidAmount}
                          onChange={(e) => setPaidAmount(e.target.value)}
                          placeholder="0"
                          className={cn(
                            "h-12 text-lg font-semibold pl-4",
                            cashToPayDefault === 0 && useBalance ? "bg-gray-100 text-gray-400" : ""
                          )}
                          min="0"
                          step="1000"
                          disabled={cashToPayDefault === 0 && useBalance}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">so'm</div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="payment_type" className="text-xs font-medium text-gray-500 uppercase">To'lov turi</Label>
                      <Select
                        value={paymentType}
                        onValueChange={(value) => setPaymentType(value as PaymentProvider)}
                      >
                        <SelectTrigger className="h-12 text-base w-full bg-white">
                          <SelectValue placeholder="To'lov turini tanlang" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Naqd</SelectItem>
                          <SelectItem value="click">Click</SelectItem>
                          <SelectItem value="payme">Payme</SelectItem>
                          <SelectItem value="card">Kartaga to'lov</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Card Info Display */}
                  {paymentType === 'card' && (
                    <div className="mt-4">
                      {cardLoading && (
                        <div className="flex items-center justify-center gap-2 p-4 bg-gray-50 rounded-lg border border-gray-100">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                          <span className="text-sm text-gray-500">Karta yuklanmoqda...</span>
                        </div>
                      )}
                      {cardError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          <p className="text-sm text-red-700 font-medium">{cardError}</p>
                        </div>
                      )}
                      {activeCard && !cardLoading && (
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-xl p-4 space-y-3 shadow-lg">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-slate-300" />
                            <span className="text-xs text-slate-300 uppercase tracking-wider font-medium">Karta ma'lumotlari</span>
                          </div>
                          <p className="font-mono text-lg tracking-widest">
                            {activeCard.card_number || '—'}
                          </p>
                          <p className="text-sm text-slate-300">
                            {activeCard.holder_name || '—'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between items-center text-sm font-medium pt-2 border-t border-gray-100 mt-2">
                    <span className="text-gray-500">Jami asl to'lanadigan summa:</span>
                    <span className="text-gray-900">{formatCurrencySum(totalPaid)}</span>
                  </div>
                </div>

                {/* Difference Display */}
                <div
                  className={cn(
                    'mt-4 p-3 rounded-lg flex items-center gap-3',
                    diffConfig.bgColor
                  )}
                >
                  <DiffIcon className={cn('h-5 w-5', diffConfig.color)} />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">{diffConfig.label}</p>
                    <p className={cn('font-bold text-base', diffConfig.color)}>
                      {difference > 0 ? '+' : ''}
                      {formatCurrencySum(Math.abs(difference))}
                    </p>
                  </div>
                </div>

                {/* Business Rule Info Box */}
                {paymentType === 'cash' && paymentData?.mode === 'unpaid_cargo' && (
                  <div className={cn(
                    'mt-3 p-3 rounded-lg flex items-start gap-2',
                    wouldMarkAsTaken ? 'bg-blue-50 border border-blue-100' : 'bg-amber-50 border border-amber-100'
                  )}>
                    <Info className={cn(
                      'h-4 w-4 mt-0.5 flex-shrink-0',
                      wouldMarkAsTaken ? 'text-blue-500' : 'text-amber-500'
                    )} />
                    <p className={cn(
                      'text-xs leading-relaxed font-medium',
                      wouldMarkAsTaken ? 'text-blue-700' : 'text-amber-700'
                    )}>
                      {wouldMarkAsTaken
                        ? 'Naqd to\'lov to\'liq qilinganda yuk "Olingan" deb belgilanadi'
                        : 'Qisman to\'lovda yuk "Olinmagan" bo\'lib qoladi'
                      }
                    </p>
                  </div>
                )}

                {/* Error Display */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700 break-words font-medium">{error}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="p-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row gap-3 flex-shrink-0 z-10">
          {success ? (
            <Button onClick={handleClose} className="w-full h-12 text-base bg-green-600 hover:bg-green-700">
              Yopish
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isLoading} className="w-full sm:w-auto h-12 text-base order-2 sm:order-1">
                Bekor qilish
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !isDataValid || (paymentType === 'card' && (!activeCard || cardLoading))}
                className="w-full sm:w-auto h-12 text-base bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 order-1 sm:order-2 flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Yuklanmoqda...
                  </>
                ) : (
                  'To\'lovni tasdiqlash'
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog >
  );
}
