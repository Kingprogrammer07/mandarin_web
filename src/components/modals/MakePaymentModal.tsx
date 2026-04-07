/**
 * MakePaymentModal — Premium multi-step payment wizard.
 *
 * Flow:
 *   Step 1  →  Select a flight
 *   Step 2  →  Payment details & method choice
 *   Step 3  →  Confirmation / receipt upload / success
 *
 * Designed for accessibility (large touch targets, high contrast),
 * smooth Framer Motion transitions, full i18n, and responsive
 * mobile-drawer / desktop-modal layout.
 */

import { useState, useCallback, useMemo, useRef, memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  X,
  Plane,
  ChevronRight,
  ChevronLeft,
  Wallet,
  Banknote,
  CreditCard,
  Copy,
  Check,
  Upload,
  FileImage,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Package,
  Scale,
  ArrowDownToLine,
  CircleDollarSign,
  ChevronDown,
  WalletCards,
  Search,
} from 'lucide-react';
import {
  paymentService,
  type AvailableFlightItem,
} from '@/api/services/paymentService';
import { trackCargo, type TrackCodeSearchResponse } from '@/api/services/cargo';
import { TrackResultCard } from '@/pages/dashboard/components/TrackResultCard';
import { normalizeNumber } from '@/utils/numberFormat';

// ============================================================================
// Helpers
// ============================================================================

/** Format a number with space-separated thousands: 1500000 → "1 500 000", preserves up to 2 decimals */
function formatMoney(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '0';
  return new Intl.NumberFormat('uz-UZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Validate receipt file type */
function isValidReceiptFile(file: File): boolean {
  const allowed = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp',
    'application/pdf',
  ];
  return allowed.includes(file.type);
}

// ============================================================================
// Sub-components
// ============================================================================

/** Skeleton loader card for flights list */
const FlightSkeleton = () => (
  <div className="animate-pulse space-y-3">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="rounded-2xl p-4 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-5 w-32 bg-gray-200 dark:bg-white/10 rounded-lg" />
            <div className="h-4 w-20 bg-gray-200 dark:bg-white/10 rounded-lg" />
          </div>
          <div className="h-8 w-28 bg-gray-200 dark:bg-white/10 rounded-xl" />
        </div>
      </div>
    ))}
  </div>
);

/** Detail skeleton */
const DetailSkeleton = () => (
  <div className="animate-pulse space-y-4 p-1">
    <div className="h-14 bg-gray-200 dark:bg-white/10 rounded-2xl" />
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex justify-between">
          <div className="h-4 w-24 bg-gray-200 dark:bg-white/10 rounded" />
          <div className="h-4 w-20 bg-gray-200 dark:bg-white/10 rounded" />
        </div>
      ))}
    </div>
    <div className="h-14 bg-gray-200 dark:bg-white/10 rounded-2xl" />
    <div className="h-14 bg-gray-200 dark:bg-white/10 rounded-2xl" />
  </div>
);

/** Step progress bar (3 dots) */
const StepIndicator = memo(
  ({ current, total }: { current: number; total: number }) => (
    <div className="flex items-center justify-center gap-2 py-2">
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          className={`rounded-full transition-colors duration-300 ${
            i === current
              ? 'bg-amber-500 dark:bg-amber-400'
              : i < current
                ? 'bg-amber-500/50 dark:bg-amber-400/40'
                : 'bg-gray-200 dark:bg-white/10'
          }`}
          animate={{
            width: i === current ? 24 : 8,
            height: 8,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        />
      ))}
    </div>
  ),
);

// ============================================================================
// Framer Motion Variants
// ============================================================================

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalDesktopVariants = {
  hidden: { scale: 0.95, opacity: 0, y: 30 },
  visible: { scale: 1, opacity: 1, y: 0 },
  exit: { scale: 0.95, opacity: 0, y: 30 },
};

const modalMobileVariants = {
  hidden: { y: '100%' },
  visible: { y: 0 },
  exit: { y: '100%' },
};

// ============================================================================
// Bottom Drawer (for track code detail)
// ============================================================================

interface BottomDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const BottomDrawer = ({ open, onClose, children }: BottomDrawerProps) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 z-[10010] backdrop-blur-sm"
        />
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 z-[10010] bg-white dark:bg-[#151515] rounded-t-[2rem] max-h-[85vh] flex flex-col shadow-2xl"
        >
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mt-4 mb-2 flex-shrink-0" />
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-10">
            {children}
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ============================================================================
// Main Component
// ============================================================================

interface MakePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedFlightName?: string | null;
}

type PaymentMethod = 'online' | 'cash' | 'wallet';
type WizardStep = 0 | 1 | 2;

const MakePaymentModal = ({ isOpen, onClose, preselectedFlightName }: MakePaymentModalProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // ---- State ----
  const [step, setStep] = useState<WizardStep>(0);
  const [direction, setDirection] = useState(1);
  const [selectedFlightName, setSelectedFlightName] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [isPartial, setIsPartial] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTrackCodes, setShowTrackCodes] = useState(false);
  const [selectedTrackCode, setSelectedTrackCode] = useState<string | null>(null);
  const [trackData, setTrackData] = useState<TrackCodeSearchResponse | null>(null);
  const [isTrackLoading, setIsTrackLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect mobile (≤ 768px) for drawer vs modal
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ---- Sync preselectedFlightName when modal opens ----
  useEffect(() => {
    if (isOpen && preselectedFlightName) {
      setSelectedFlightName(preselectedFlightName);
      setStep(1);
      setDirection(1);
    }
  }, [isOpen, preselectedFlightName]);

  // ---- Reset on close ----
  const resetState = useCallback(() => {
    setStep(0);
    setDirection(1);
    setSelectedFlightName(null);
    setPaymentMethod(null);
    setUseWallet(false);
    setIsPartial(false);
    setCustomAmount('');
    setReceiptFile(null);
    setReceiptPreview(null);
    setCopied(false);
    setShowSuccess(false);
    setSelectedTrackCode(null);
    setTrackData(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  // -------- Navigation --------
  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, 2) as WizardStep);
  }, []);

  const goBack = useCallback(() => {
    if (step === 0) {
      handleClose();
      return;
    }
    if (step === 1 && preselectedFlightName) {
      handleClose();
      return;
    }
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0) as WizardStep);
  }, [step, handleClose, preselectedFlightName]);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  // Step 1 — available flights
  const {
    data: flightsData,
    isLoading: flightsLoading,
    isError: flightsError,
    refetch: refetchFlights,
  } = useQuery({
    queryKey: ['payment-available-flights'],
    queryFn: paymentService.getAvailableFlights,
    enabled: isOpen,
    staleTime: 30_000,
  });

  // Step 2 — flight details
  const {
    data: details,
    isLoading: detailsLoading,
    isError: detailsError,
  } = useQuery({
    queryKey: ['payment-flight-details', selectedFlightName],
    queryFn: () =>
      paymentService.getFlightDetails(selectedFlightName!),
    enabled: !!selectedFlightName && step >= 1,
    staleTime: 30_000,
  });
  
  const partialAllowed = details?.partial_allowed !== false;

  // ---- Computed amounts ----
  const payableAmount = useMemo(() => {
    if (!details) return 0;
    if (details.has_existing_partial && details.existing_remaining_amount) {
      return details.existing_remaining_amount;
    }
    return details.total_payment;
  }, [details]);

  const effectiveAmount = useMemo(() => {
    if (isPartial && customAmount) {
      const parsed = Number(customAmount);
      return isNaN(parsed) ? 0 : parsed;
    }
    return payableAmount;
  }, [isPartial, customAmount, payableAmount]);

  const walletDeduction = useMemo(() => {
    if (!useWallet || !details) return 0;
    return Math.min(details.wallet_balance, effectiveAmount);
  }, [useWallet, details, effectiveAmount]);

  const finalPayable = useMemo(
    () => Math.max(effectiveAmount - walletDeduction, 0),
    [effectiveAmount, walletDeduction],
  );

  const paymentMode = useMemo((): 'full' | 'partial' | 'full_remaining' => {
    if (isPartial) return 'partial'; // Always "partial" if the custom toggle is activated
    if (details?.has_existing_partial) return 'full_remaining'; // Paying the rest fully
    return 'full'; // Paying the initial total fully
  }, [details, isPartial]);

  // ============================================================================
  // Mutations
  // ============================================================================

  const walletMutation = useMutation({
    mutationFn: paymentService.submitWalletOnly,
    onSuccess: () => {
      toast.success(t('makePayment.walletSubmitted'));
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['payment-available-flights'] });
    },
    onError: (err: { message?: string }) => {
      toast.error(err?.message || t('makePayment.errorOccurred'));
    },
  });

  const cashMutation = useMutation({
    mutationFn: paymentService.submitCash,
    onSuccess: () => {
      toast.success(t('makePayment.cashSubmitted'));
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['payment-available-flights'] });
    },
    onError: (err: { message?: string }) => {
      toast.error(err?.message || t('makePayment.errorOccurred'));
    },
  });

  const onlineMutation = useMutation({
    mutationFn: paymentService.submitOnline,
    onSuccess: () => {
      toast.success(t('makePayment.onlineSubmitted'));
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['payment-available-flights'] });
    },
    onError: (err: { message?: string }) => {
      toast.error(err?.message || t('makePayment.errorOccurred'));
    },
  });

  const isSubmitting =
    walletMutation.isPending ||
    cashMutation.isPending ||
    onlineMutation.isPending;

  // ---- Handlers ----
  const handleSelectFlight = useCallback(
    (flight: AvailableFlightItem) => {
      setSelectedFlightName(flight.flight_name);
      goNext();
    },
    [goNext],
  );

  const handleChooseMethod = useCallback(
    (method: PaymentMethod) => {
      setPaymentMethod(method);
      goNext();
    },
    [goNext],
  );

  const handleTrackClick = useCallback(async (code: string) => {
    setSelectedTrackCode(code);
    setTrackData(null);
    setIsTrackLoading(true);
    try {
      const data = await trackCargo(code);
      setTrackData(data);
    } catch {
      toast.error(t('makePayment.errorOccurred'));
    } finally {
      setIsTrackLoading(false);
    }
  }, [t]);

  const handleCopyCard = useCallback(() => {
    if (!details?.card_number) return;
    navigator.clipboard.writeText(details.card_number.replace(/\s/g, ''));
    setCopied(true);
    toast.success(t('makePayment.copied'));
    setTimeout(() => setCopied(false), 2000);
  }, [details, t]);

  const handleFileSelect = useCallback(
    (file: File) => {
      if (!isValidReceiptFile(file)) {
        toast.error(t('makePayment.formatError'));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('makePayment.sizeError'));
        return;
      }
      setReceiptFile(file);
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setReceiptPreview(url);
      } else {
        setReceiptPreview(null);
      }
    },
    [t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleConfirm = useCallback(() => {
    if (!selectedFlightName) return;

    if (paymentMethod === 'wallet') {
      walletMutation.mutate({
        flight_name: selectedFlightName,
        amount: effectiveAmount,
        payment_mode: paymentMode,
      });
    } else if (paymentMethod === 'cash') {
      cashMutation.mutate({
        flight_name: selectedFlightName,
        wallet_used: walletDeduction,
      });
    } else if (paymentMethod === 'online' && receiptFile) {
      onlineMutation.mutate({
        flight_name: selectedFlightName,
        payment_mode: paymentMode,
        paid_amount: effectiveAmount,
        wallet_used: walletDeduction,
        receipt_file: receiptFile,
      });
    }
  }, [
    selectedFlightName,
    paymentMethod,
    effectiveAmount,
    paymentMode,
    walletDeduction,
    receiptFile,
    walletMutation,
    cashMutation,
    onlineMutation,
  ]);

  // ============================================================================
  // Step Renderers
  // ============================================================================

  /** STEP 0: Select Flight */
  const renderStep0 = () => {
    if (flightsLoading) return <FlightSkeleton />;

    if (flightsError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-gray-600 dark:text-gray-400">
            {t('makePayment.errorOccurred')}
          </p>
          <button
            onClick={() => refetchFlights()}
            className="px-6 py-3 rounded-xl bg-amber-500 text-white font-semibold text-base active:scale-95 transition-transform"
          >
            {t('makePayment.retry')}
          </button>
        </div>
      );
    }

    const flights = flightsData?.flights ?? [];

    if (flights.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
            <Plane className="w-8 h-8 text-gray-300 dark:text-gray-600" />
          </div>
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            {t('makePayment.noFlights')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 max-w-[280px]">
            {t('makePayment.noFlightsDesc')}
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
          {t('makePayment.selectFlight')}
        </p>
        {flights.map((flight) => (
          <motion.button
            key={flight.flight_name}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleSelectFlight(flight)}
            className="w-full text-left rounded-2xl p-4
              bg-white dark:bg-white/[0.04]
              border border-gray-200 dark:border-white/10
              hover:border-amber-300 dark:hover:border-amber-500/40
              shadow-sm hover:shadow-md
              transition-all duration-200 group"
          >
            <div className="flex items-center justify-between gap-3">
              {/* Left */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    flight.payment_status === 'partial'
                      ? 'bg-amber-100 dark:bg-amber-500/15'
                      : 'bg-blue-100 dark:bg-blue-500/15'
                  }`}
                >
                  <Plane
                    className={`w-5 h-5 ${
                      flight.payment_status === 'partial'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-base text-gray-900 dark:text-white truncate">
                    {flight.flight_name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        flight.payment_status === 'partial'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                      }`}
                    >
                      {flight.payment_status === 'partial'
                        ? t('makePayment.partial')
                        : t('makePayment.unpaid')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right – amount */}
              <div className="text-right flex-shrink-0">
                {flight.total_payment != null ? (
                  <>
                    {flight.payment_status === 'partial' &&
                    flight.remaining_amount != null ? (
                      <div>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {t('makePayment.remaining')}
                        </p>
                        <p className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                          {formatMoney(flight.remaining_amount)}
                          <span className="text-xs ml-1 font-semibold opacity-70">
                            so'm
                          </span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-base font-extrabold text-gray-900 dark:text-white">
                        {formatMoney(flight.total_payment)}
                        <span className="text-xs ml-1 font-semibold text-gray-400">
                          so'm
                        </span>
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                    {t('makePayment.reportNotReady')}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 ml-auto mt-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    );
  };

  /** STEP 1: Payment Details & Method */
  const renderStep1 = () => {
    if (detailsLoading) return <DetailSkeleton />;
    if (detailsError || !details) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-gray-600 dark:text-gray-400">
            {t('makePayment.errorOccurred')}
          </p>
        </div>
      );
    }

    const walletCoversAll = details.wallet_balance >= payableAmount && payableAmount > 0;

    return (
      <div className="space-y-5">
        {/* ---- Big Amount Display ---- */}
        <div className="text-center py-4 px-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/[0.08] dark:to-orange-500/[0.05] border border-amber-200/60 dark:border-amber-500/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600/70 dark:text-amber-400/60 mb-1">
            {details.has_existing_partial
              ? t('makePayment.existingRemaining')
              : t('makePayment.totalAmount')}
          </p>
          <p className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
            {formatMoney(payableAmount)}
            <span className="text-lg ml-2 font-bold text-amber-600 dark:text-amber-400">
              so'm
            </span>
          </p>
        </div>

        {/* ---- Flight Info Grid ---- */}
        <div className="grid grid-cols-2 gap-2.5">
          <InfoCard
            icon={<Scale className="w-4 h-4" />}
            label={t('makePayment.weight')}
            value={`${details.total_weight.toFixed(2)} kg`}
          />
          <InfoCard
            icon={<CircleDollarSign className="w-4 h-4" />}
            label={t('makePayment.pricePerKg')}
            value={`$${details.price_per_kg_usd.toFixed(2)}`}
          />
          {details.has_existing_partial && details.existing_paid_amount != null && (
            <InfoCard
              icon={<CheckCircle2 className="w-4 h-4" />}
              label={t('makePayment.existingPaid')}
              value={`${formatMoney(details.existing_paid_amount)} so'm`}
              accent
            />
          )}
          {details.track_codes.length > 0 && (
            <InfoCard
              icon={<Package className="w-4 h-4" />}
              label={t('makePayment.trackCodes')}
              value={String(details.track_codes.length)}
              onClick={() => setShowTrackCodes(!showTrackCodes)}
              trailing={
                <motion.div
                  animate={{ rotate: showTrackCodes ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                </motion.div>
              }
            />
          )}
        </div>

        {/* ---- Expandable Track Codes List ---- */}
        <AnimatePresence>
          {showTrackCodes && details.track_codes.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] p-3 space-y-1.5">
                <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                  {t('makePayment.trackCodes')}
                </p>
                {details.track_codes.map((code, idx) => (
                  <motion.button
                    key={code}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => handleTrackClick(code)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg
                      bg-white dark:bg-white/[0.04]
                      border border-gray-100 dark:border-white/5
                      hover:border-amber-300 dark:hover:border-amber-500/30
                      hover:bg-amber-50 dark:hover:bg-amber-500/5
                      active:scale-[0.98] transition-all group"
                  >
                    <span className="text-sm font-mono font-semibold text-gray-700 dark:text-gray-300 truncate">
                      {code}
                    </span>
                    <Search className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors flex-shrink-0 ml-2" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- Partial Toggle ---- */}
        {partialAllowed && (
          <div className="space-y-2">
            <button
              onClick={() => setIsPartial(!isPartial)}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${
                isPartial
                  ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30'
                  : 'bg-white dark:bg-white/[0.03] border-gray-200 dark:border-white/10'
              }`}
            >
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('makePayment.customAmount')}
              </span>
              <div
                className={`w-10 h-6 rounded-full relative transition-colors duration-200 ${
                  isPartial
                    ? 'bg-amber-500'
                    : 'bg-gray-300 dark:bg-white/20'
                }`}
              >
                <motion.div
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
                  animate={{ left: isPartial ? 18 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </div>
            </button>
            {isPartial && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <input
                  type="text"
                  inputMode="decimal"
                  value={customAmount}
                  onChange={(e) => {
                    const normalized = normalizeNumber(e.target.value);
                    if (normalized !== null) {
                      setCustomAmount(normalized);
                    }
                  }}
                  placeholder={t('makePayment.enterAmount')}
                  className="w-full px-4 py-3.5 rounded-xl text-lg font-bold
                    bg-white dark:bg-white/[0.04]
                    border border-gray-200 dark:border-white/10
                    text-gray-900 dark:text-white
                    placeholder:text-gray-400 dark:placeholder:text-gray-600
                    focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500
                    transition-all"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 px-1">
                  {t('makePayment.minAmount', { amount: '1 000' })} ·{' '}
                  {t('makePayment.maxAmount', {
                    amount: formatMoney(payableAmount),
                  })}
                </p>
              </motion.div>
            )}
          </div>
        )}

        {/* ---- Wallet Balance & Toggle ---- */}
        <div
          className={`p-3.5 rounded-xl border transition-all duration-200 ${
            details.wallet_balance <= 0
              ? 'bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/5 opacity-75'
              : useWallet
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30'
                : 'bg-white dark:bg-white/[0.03] border-gray-200 dark:border-white/10'
          }`}
        >
          <button
            onClick={() => {
              if (details.wallet_balance > 0) setUseWallet(!useWallet);
            }}
            className={`w-full flex items-center justify-between ${
              details.wallet_balance <= 0 ? 'cursor-not-allowed' : ''
            }`}
          >
            <div className="flex items-center gap-2.5">
              <WalletCards
                className={`w-5 h-5 ${
                  details.wallet_balance <= 0
                    ? 'text-gray-300 dark:text-gray-600'
                    : useWallet
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-400 dark:text-gray-500'
                }`}
              />
              <div className="text-left">
                <p className={`text-sm font-semibold ${
                  details.wallet_balance <= 0
                    ? 'text-gray-400 dark:text-gray-500'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {t('makePayment.useWallet')}
                </p>
                {details.wallet_balance > 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {t('makePayment.yourBalance')}:{' '}
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatMoney(details.wallet_balance)} so'm
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Hisobingizda mablag' yo'q
                  </p>
                )}
              </div>
            </div>
            <div
              className={`w-10 h-6 rounded-full relative transition-colors duration-200 ${
                details.wallet_balance <= 0
                  ? 'bg-gray-200 dark:bg-white/10'
                  : useWallet
                    ? 'bg-emerald-500'
                    : 'bg-gray-300 dark:bg-white/20'
              }`}
            >
              <motion.div
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
                animate={{ left: useWallet && details.wallet_balance > 0 ? 18 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </div>
          </button>

          <AnimatePresence>
            {useWallet && details.wallet_balance > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-500/20 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {t('makePayment.walletApplied')}
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      -{formatMoney(walletDeduction)} so'm
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {t('makePayment.youPay')}
                    </span>
                    <span className="font-extrabold text-gray-900 dark:text-white">
                      {formatMoney(finalPayable)} so'm
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ---- "Wallet Covers All" — special option ---- */}
        {walletCoversAll && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => handleChooseMethod('wallet')}
            className="w-full h-14 rounded-2xl font-bold text-base
              bg-gradient-to-r from-emerald-500 to-teal-500
              hover:from-emerald-600 hover:to-teal-600
              text-white shadow-lg shadow-emerald-500/20
              active:scale-[0.97] transition-all flex items-center justify-center gap-2.5"
          >
            <Wallet className="w-5 h-5" />
            {t('makePayment.payWallet')}
          </motion.button>
        )}

        {/* ---- Payment Method Buttons ---- */}
        <div className={`grid gap-3 ${walletCoversAll ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => handleChooseMethod('online')}
            className="h-14 rounded-2xl font-bold text-base
              bg-gradient-to-r from-blue-500 to-indigo-500
              hover:from-blue-600 hover:to-indigo-600
              text-white shadow-lg shadow-blue-500/20
              active:scale-[0.97] transition-all flex items-center justify-center gap-2.5"
          >
            <CreditCard className="w-5 h-5" />
            {t('makePayment.payOnline')}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => handleChooseMethod('cash')}
            className="h-14 rounded-2xl font-bold text-base
              bg-gradient-to-r from-gray-700 to-gray-900
              dark:from-white/10 dark:to-white/5
              hover:from-gray-800 hover:to-gray-950
              dark:hover:from-white/15 dark:hover:to-white/10
              text-white shadow-lg
              active:scale-[0.97] transition-all flex items-center justify-center gap-2.5"
          >
            <Banknote className="w-5 h-5" />
            {t('makePayment.payCash')}
          </motion.button>
        </div>
      </div>
    );
  };

  /** STEP 2: Confirmation / Receipt Upload / Success */
  const renderStep2 = () => {
    // ---- Success View ----
    if (showSuccess) {
      return (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center justify-center py-10 text-center space-y-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
            className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center"
          >
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </motion.div>
          <h3 className="text-2xl font-black text-gray-900 dark:text-white">
            {t('makePayment.successTitle')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[260px]">
            {t('makePayment.successDesc')}
          </p>
          <button
            onClick={handleClose}
            className="mt-4 w-full max-w-[260px] h-14 rounded-2xl font-bold text-base
              bg-gradient-to-r from-amber-500 to-orange-500
              text-white shadow-lg shadow-amber-500/20
              active:scale-[0.97] transition-all"
          >
            {t('makePayment.done')}
          </button>
        </motion.div>
      );
    }

    // ---- Cash Confirmation ----
    if (paymentMethod === 'cash') {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
            <Banknote className="w-8 h-8 text-gray-600 dark:text-gray-300" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('makePayment.cashConfirmTitle')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[280px] mx-auto">
              {t('makePayment.cashConfirmDesc')}
            </p>
          </div>
          {walletDeduction > 0 && (
            <div className="w-full max-w-xs mx-auto rounded-xl p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  {t('makePayment.walletApplied')}
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  -{formatMoney(walletDeduction)} so'm
                </span>
              </div>
            </div>
          )}
          <p className="text-3xl font-black text-gray-900 dark:text-white">
            {formatMoney(finalPayable)}
            <span className="text-base ml-1.5 text-amber-600 dark:text-amber-400 font-bold">
              so'm
            </span>
          </p>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full max-w-xs h-14 rounded-2xl font-bold text-base
              bg-gradient-to-r from-amber-500 to-orange-500
              hover:from-amber-600 hover:to-orange-600
              text-white shadow-lg shadow-amber-500/20
              active:scale-[0.97] transition-all
              disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            {isSubmitting
              ? t('makePayment.submitting')
              : t('makePayment.confirm')}
          </button>
        </div>
      );
    }

    // ---- Wallet Only Confirmation ----
    if (paymentMethod === 'wallet') {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('makePayment.walletConfirmTitle')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[280px] mx-auto">
              {t('makePayment.walletConfirmDesc', {
                amount: `${formatMoney(effectiveAmount)} so'm`,
              })}
            </p>
          </div>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {formatMoney(effectiveAmount)}
            <span className="text-base ml-1.5 font-bold">so'm</span>
          </p>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full max-w-xs h-14 rounded-2xl font-bold text-base
              bg-gradient-to-r from-emerald-500 to-teal-500
              hover:from-emerald-600 hover:to-teal-600
              text-white shadow-lg shadow-emerald-500/20
              active:scale-[0.97] transition-all
              disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            {isSubmitting
              ? t('makePayment.submitting')
              : t('makePayment.confirm')}
          </button>
        </div>
      );
    }

    // ---- Online Payment — Card + Upload ----
    if (paymentMethod === 'online') {
      if (!details?.card_number) {
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-amber-400" />
            <p className="text-gray-600 dark:text-gray-400 max-w-[260px]">
              {t('makePayment.noCardAvailable')}
            </p>
          </div>
        );
      }

      return (
        <div className="space-y-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center">
            {t('makePayment.onlineTitle')}
          </h3>

          {/* Amount summary */}
          <div className="text-center">
            <p className="text-3xl font-black text-gray-900 dark:text-white">
              {formatMoney(finalPayable)}
              <span className="text-sm ml-1.5 text-amber-600 dark:text-amber-400 font-bold">
                so'm
              </span>
            </p>
            {walletDeduction > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                {t('makePayment.walletApplied')}: -{formatMoney(walletDeduction)}{' '}
                so'm
              </p>
            )}
          </div>

          {/* Card info */}
          <div className="rounded-2xl p-4 bg-gradient-to-br from-gray-900 to-gray-800 dark:from-white/[0.06] dark:to-white/[0.03] border border-gray-700 dark:border-white/10">
            <p className="text-xs font-medium text-gray-400 mb-1">
              {t('makePayment.transferTo')}
            </p>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-black tracking-wider text-white">
                {details.card_number}
              </p>
              <button
                onClick={handleCopyCard}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 transition-all"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Copy className="w-5 h-5 text-white/70" />
                )}
              </button>
            </div>
            {details.card_owner && (
              <p className="text-xs text-gray-400 mt-1.5">
                {t('makePayment.cardOwner')}: {details.card_owner}
              </p>
            )}
          </div>

          {/* File Upload Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200
              ${
                receiptFile
                  ? 'border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/5'
                  : 'border-gray-300 dark:border-white/15 bg-gray-50 dark:bg-white/[0.02] hover:border-amber-400 dark:hover:border-amber-500/40'
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
            />

            {receiptFile ? (
              <div className="space-y-3">
                {receiptPreview ? (
                  <img
                    src={receiptPreview}
                    alt="Receipt"
                    className="max-h-36 mx-auto rounded-xl object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 mx-auto rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                    <FileImage className="w-8 h-8 text-emerald-500" />
                  </div>
                )}
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate px-2">
                  {receiptFile.name}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {t('makePayment.changeFile')}
                </p>
              </div>
            ) : (
              <div className="space-y-2 py-3">
                <Upload className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto" />
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                  {t('makePayment.dragOrClick')}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {t('makePayment.uploadReceiptDesc')}
                </p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleConfirm}
            disabled={!receiptFile || isSubmitting}
            className="w-full h-14 rounded-2xl font-bold text-base
              bg-gradient-to-r from-blue-500 to-indigo-500
              hover:from-blue-600 hover:to-indigo-600
              text-white shadow-lg shadow-blue-500/20
              active:scale-[0.97] transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2.5"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ArrowDownToLine className="w-5 h-5" />
            )}
            {isSubmitting
              ? t('makePayment.submitting')
              : t('makePayment.submitReceipt')}
          </button>
        </div>
      );
    }

    return null;
  };

  // ============================================================================
  // Render
  // ============================================================================

  const stepContent = [renderStep0, renderStep1, renderStep2];

  const stepTitles = [
    t('makePayment.stepFlight'),
    selectedFlightName ?? t('makePayment.stepDetails'),
    t('makePayment.stepConfirm'),
  ];

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Modal / Drawer */}
          <motion.div
            variants={isMobile ? modalMobileVariants : modalDesktopVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={
              isMobile
                ? { type: 'spring', stiffness: 300, damping: 30 }
                : { type: 'spring', stiffness: 400, damping: 28 }
            }
            onClick={(e) => e.stopPropagation()}
            className={`fixed z-[10000] bg-white dark:bg-[#141210]
              ${
                isMobile
                  ? 'bottom-0 left-0 right-0 rounded-t-3xl max-h-[92vh]'
                  : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-3xl max-h-[90vh]'
              }
              overflow-hidden shadow-2xl border border-gray-200 dark:border-white/10
              flex flex-col`}
          >
            {/* ---- Header ---- */}
            <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-gray-100 dark:border-white/5">
              {/* Drag handle (mobile) */}
              {isMobile && (
                <div className="w-10 h-1 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-3" />
              )}
              <div className="flex items-center justify-between">
                {step > 0 && !showSuccess ? (
                  <button
                    onClick={goBack}
                    className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </button>
                ) : (
                  <div className="w-9" />
                )}
                <h2 className="text-base font-bold text-gray-900 dark:text-white text-center flex-1 truncate px-2">
                  {showSuccess ? t('makePayment.successTitle') : stepTitles[step]}
                </h2>
                <button
                  onClick={handleClose}
                  className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              {!showSuccess && <StepIndicator current={step} total={3} />}
            </div>

            {/* ---- Body (scrollable, animated) ---- */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={showSuccess ? 'success' : step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  {stepContent[step]()}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Track Code Bottom Drawer */}
          <BottomDrawer
            open={!!selectedTrackCode}
            onClose={() => {
              setSelectedTrackCode(null);
              setTrackData(null);
            }}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {selectedTrackCode}
                </h3>
              </div>

              {isTrackLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                </div>
              )}

              {!isTrackLoading && trackData && (
                <TrackResultCard data={trackData} />
              )}

              {!isTrackLoading && !trackData && selectedTrackCode && (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                  <Package className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('makePayment.errorOccurred')}
                  </p>
                </div>
              )}
            </div>
          </BottomDrawer>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};

// ============================================================================
// Small reusable sub-component — info card
// ============================================================================

const InfoCard = memo(
  ({
    icon,
    label,
    value,
    accent = false,
    onClick,
    trailing,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    accent?: boolean;
    onClick?: () => void;
    trailing?: React.ReactNode;
  }) => (
    <div
      onClick={onClick}
      className={`rounded-xl p-3 border ${
        accent
          ? 'bg-amber-50 dark:bg-amber-500/[0.06] border-amber-200 dark:border-amber-500/20'
          : 'bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/10'
      } ${
        onClick
          ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition-colors active:scale-[0.98]'
          : ''
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={
            accent
              ? 'text-amber-500 dark:text-amber-400'
              : 'text-gray-400 dark:text-gray-500'
          }
        >
          {icon}
        </span>
        <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          {label}
        </span>
        {trailing && <span className="ml-auto">{trailing}</span>}
      </div>
      <p
        className={`text-sm font-bold ${
          accent
            ? 'text-amber-700 dark:text-amber-300'
            : 'text-gray-800 dark:text-gray-200'
        }`}
      >
        {value}
      </p>
    </div>
  ),
);

export default memo(MakePaymentModal);
