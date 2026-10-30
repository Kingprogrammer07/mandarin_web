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
  ArrowDownToLine,
  ChevronDown,
  Search,
  ExternalLink,
  Archive,
  Landmark,
  MousePointerClick,
  ArrowRightLeft,
  Smartphone,
  Zap,
} from 'lucide-react';
import {
  paymentService,
  type AvailableFlightItem,
  type PaymentLinkItem,
} from '@/api/services/paymentService';
import { nbuPaymentService, type SavedCardItem } from '@/api/services/nbuPaymentService';
import { trackCargo, type TrackCodeSearchResponse } from '@/api/services/cargo';
import { TrackResultCard } from '@/pages/dashboard/components/TrackResultCard';
import { normalizeNumber } from '@/utils/numberFormat';
import { formatMaskedCard } from '@/utils/cardMask';
import { openNbuUrl } from '@/utils/nbuReturnContext';
import { isCardReauthError, promptCardReauth } from '@/utils/nbuCardReauth';
import { OfficeVisitSummary } from '@/components/office/OfficeStatus';
import { playApplePaySound } from '@/utils/audioUtils';
import { useMaintenanceWatcher } from '@/hooks/useMaintenanceWatcher';
import { useGuideTour } from '@/hooks/useGuideTour';
import { pickVisible } from '@/utils/tour';
import type { DriveStep } from 'driver.js';
import { AstatkaShelfNote } from '@/components/user/AstatkaShelfNote';
import { CardTransferPanel } from '@/components/payment/CardTransferPanel';
import { PayMethodList, SwitchRow, type PayOption } from '@/components/payment/PayMethodList';
import { PaymePanel } from '@/components/payment/PaymePanel';
import {
  clickService,
  openPaymeCheckout,
  paymeRefusal,
  paymeService,
  type OnlineProvider,
  type PaymeOrder,
} from '@/api/services/paymeService';

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

/** NBU's gateway minimum: a smaller debt is charged this much, the rest goes to the wallet. */
const NBU_MIN_UZS = 1000;
/** The smallest part the server takes (`make_payment.py`, "Minimum partial payment"). */
const PARTIAL_MIN_UZS = 1000;
/** Payme's and Click's order refuses a smaller debt (`payme_orders.MIN_AMOUNT`); there is no floor to raise it to. */
const PAYME_MIN_UZS = 1000;

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
// Payment link brand helpers
// ============================================================================

interface LinkBrand {
  bg: string;       // CSS gradient / solid color
  label: string;    // short label shown inside the icon badge
  textColor: string;
}

const LINK_BRANDS: Record<string, LinkBrand> = {
  click:  { bg: 'linear-gradient(135deg,#00B9F1,#0088CC)', label: 'C',  textColor: '#fff' },
  payme:  { bg: 'linear-gradient(135deg,#1AC47D,#14A868)', label: 'P',  textColor: '#fff' },
  uzum:   { bg: 'linear-gradient(135deg,#9B27AF,#7B1FA2)', label: 'U',  textColor: '#fff' },
  apelsin:{ bg: 'linear-gradient(135deg,#FF6B35,#E55A2B)', label: 'A',  textColor: '#fff' },
};

function getLinkBrand(slug: string): LinkBrand {
  return (
    LINK_BRANDS[slug.toLowerCase()] ?? {
      bg: 'linear-gradient(135deg,#F59E0B,#D97706)',
      label: slug[0]?.toUpperCase() ?? '?',
      textColor: '#fff',
    }
  );
}

/** Single payment link button — opens URL in new tab */
const PaymentLinkButton = ({ link }: { link: PaymentLinkItem }) => {
  const brand = getLinkBrand(link.slug);
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3.5 rounded-mc-md border border-mc-border
        bg-mc-surface
        active:scale-[0.97] transition-all duration-150"
    >
      {/* Brand badge */}
      <div
        className="w-10 h-10 rounded-mc-md flex-shrink-0 flex items-center justify-center font-extrabold text-base shadow-sm"
        style={{ background: brand.bg, color: brand.textColor }}
      >
        {brand.label}
      </div>
      <span className="flex-1 font-bold text-sm text-mc-text">
        {link.name}
      </span>
      <ExternalLink className="w-4 h-4 text-mc-text-3 flex-shrink-0" />
    </a>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

/** Skeleton loader card for flights list */
const FlightSkeleton = () => (
  <div className="animate-pulse space-y-3">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="rounded-mc-lg p-4 bg-mc-surface-2 border border-mc-border dark:border-white/5"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-5 w-32 bg-mc-surface-2 rounded-mc-sm" />
            <div className="h-4 w-20 bg-mc-surface-2 rounded-mc-sm" />
          </div>
          <div className="h-8 w-28 bg-mc-surface-2 rounded-mc-md" />
        </div>
      </div>
    ))}
  </div>
);

/** Details skeleton: the final layout in flat bars, so nothing jumps when it loads. */
const DetailSkeleton = () => (
  <div className="animate-pulse space-y-5" aria-hidden="true">
    <div>
      <div className="h-3.5 w-20 rounded-mc-sm bg-mc-surface-2" />
      <div className="mt-2 h-8 w-40 rounded-mc-sm bg-mc-surface-2" />
      <div className="mt-4 h-[54px] rounded-mc-md bg-mc-surface-2" />
    </div>
    <div className="space-y-2">
      <div className="h-3.5 w-24 rounded-mc-sm bg-mc-surface-2" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 rounded-mc-md bg-mc-surface-2" />
      ))}
    </div>
  </div>
);

/** Step progress bar (3 dots) */
const StepIndicator = memo(
  ({ current, total }: { current: number; total: number }) => (
    <div className="flex items-center justify-center gap-2 py-2">
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          // Amber (#f59e0b) is a different hue from the brand orange the rest
          // of the client app uses; the token keeps the wizard in the same
          // palette as the screen it was opened from.
          className={`rounded-full transition-colors duration-300 ${
            i === current
              ? 'bg-mc-brand'
              : i < current
                ? 'bg-mc-brand/45'
                : 'bg-mc-surface-2'
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
          // min-h so that a sheet with one row still rises past the middle of the screen. Height was content-driven, so a single flight left the panel clinging to the bottom edge — it read as a toast, not as a sheet, and the grab handle sat within a thumb's width of the home indicator.
          className="fixed bottom-0 left-0 right-0 z-[10010] bg-mc-surface rounded-t-[22px] max-h-[85dvh] min-h-[58dvh] flex flex-col shadow-2xl"
        >
          <div className="w-12 h-1.5 bg-mc-surface-2 dark:bg-white/20 rounded-full mx-auto mt-4 mb-2 flex-shrink-0" />
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

type PaymentMethod = 'online' | 'cash' | 'wallet' | 'card' | OnlineProvider;
type WizardStep = 0 | 1 | 2;

const MakePaymentModal = ({ isOpen, onClose, preselectedFlightName }: MakePaymentModalProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // ---- State ----
  const [step, setStep] = useState<WizardStep>(0);
  const [direction, setDirection] = useState(1);
  const [selectedFlightName, setSelectedFlightName] = useState<string | null>(null);
  // Archive view — flights whose report isn't sent yet (total_payment == null) are
  // hidden from the main list and revealed only when the user opens the archive.
  const [showArchive, setShowArchive] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  // The row picked in «To'lov usuli»; `selectedOption` falls back to the first
  // usable row when this one is blocked by the wallet / amount choice.
  const [methodKey, setMethodKey] = useState<string | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [isPartial, setIsPartial] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  // Optional: the last 4 digits of the card the client paid with. The server
  // compares them with the Payme / Click payment's card.
  const [cardLast4, setCardLast4] = useState('');
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTrackCodes, setShowTrackCodes] = useState(false);
  const [showCargoPrices, setShowCargoPrices] = useState(false);
  const [selectedTrackCode, setSelectedTrackCode] = useState<string | null>(null);
  const [trackData, setTrackData] = useState<TrackCodeSearchResponse | null>(null);
  const [isTrackLoading, setIsTrackLoading] = useState(false);
  const [isNbuInitiating, setIsNbuInitiating] = useState(false);
  // The Payme or Click order the pay button opened; its step polls it until it is booked.
  const [paymeOrder, setPaymeOrder] = useState<PaymeOrder | null>(null);
  const [isPaymeOpening, setIsPaymeOpening] = useState(false);
  // Tracks which card's charge is in flight (used to reset state cleanly); the
  // value itself isn't rendered — the drawer reflects status via the mutation.
  const [, setChargingCardId] = useState<number | null>(null);
  // Saved-card one-tap now routes through a confirm drawer instead of charging
  // instantly; `chargeDone` swaps that drawer to a celebratory success view.
  const [confirmChargeCard, setConfirmChargeCard] = useState<SavedCardItem | null>(null);
  const [chargeDone, setChargeDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isMaintenance } = useMaintenanceWatcher();

  // Close modal if maintenance kicks in while it's open (prevents stuck payments)
  useEffect(() => {
    if (isOpen && isMaintenance) {
      handleClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMaintenance]);

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
    setShowArchive(false);
    setPaymentMethod(null);
    setMethodKey(null);
    setUseWallet(false);
    setIsPartial(false);
    setCustomAmount('');
    setReceiptFile(null);
    setReceiptPreview(null);
    setCardLast4('');
    setCopied(false);
    setShowSuccess(false);
    setSelectedTrackCode(null);
    setTrackData(null);
    setConfirmChargeCard(null);
    setChargeDone(false);
    setChargingCardId(null);
    setPaymeOrder(null);
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
    staleTime: 5 * 60_000,   // 5 min — flight list rarely changes
    gcTime: 10 * 60_000,     // 10 min — keep in cache even when modal is closed
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

  // One-time onboarding tour for the payment-details step (methods, wallet,
  // partial). Runs only when step 1 is rendered with loaded details.
  const buildPaymentTour = useCallback((): DriveStep[] => [
    {
      element: '[data-tour="pay-amount"]',
      popover: {
        title: t('tour.payment.amount.title'),
        description: t('tour.payment.amount.desc'),
      },
    },
    {
      element: pickVisible('[data-tour="pay-methods"]') ?? '[data-tour="pay-methods"]',
      popover: {
        title: t('tour.payment.methods.title'),
        description: t('tour.payment.methods.desc'),
      },
    },
    {
      element: '[data-tour="pay-wallet"]',
      popover: {
        title: t('tour.payment.wallet.title'),
        description: t('tour.payment.wallet.desc'),
      },
    },
    // The wallet row is not drawn while the balance is empty.
  ].filter((tourStep) => typeof tourStep.element !== 'string' || !!document.querySelector(tourStep.element)), [t]);
  useGuideTour(
    'payment',
    buildPaymentTour,
    isOpen && step === 1 && !!details && !detailsLoading && !showSuccess,
  );

  // NBU status probe
  const { data: nbuStatus } = useQuery({
    queryKey: ['nbu-status'],
    queryFn: nbuPaymentService.getStatus,
    staleTime: 5 * 60_000,
    enabled: isOpen,
  });
  const nbuEnabled = nbuStatus?.enabled === true;

  // Payme Merchant API: off until its keys are on the server.
  const { data: paymeStatus } = useQuery({
    queryKey: ['payme-available'],
    queryFn: paymeService.available,
    staleTime: 5 * 60_000,
    enabled: isOpen,
  });
  const paymeEnabled = paymeStatus?.enabled === true;
  // Click SHOP API: the same, with its own keys.
  const { data: clickStatus } = useQuery({
    queryKey: ['click-available'],
    queryFn: clickService.available,
    staleTime: 5 * 60_000,
    enabled: isOpen,
  });
  const clickEnabled = clickStatus?.enabled === true;

  // Saved cards list
  const { data: nbuCardsData } = useQuery({
    queryKey: ['nbu-cards'],
    queryFn: nbuPaymentService.listCards,
    staleTime: 60_000,
    enabled: isOpen && nbuEnabled,
  });
  const savedCards = nbuCardsData?.items ?? [];

  const buildPaymentCardsTour = useCallback((): DriveStep[] => [
    {
      element: '[data-tour="pay-saved-card"]',
      popover: {
        title: t('tour.payment.savedCard.title'),
        description: t('tour.payment.savedCard.desc'),
      },
    },
  ], [t]);
  useGuideTour(
    'payment-cards',
    buildPaymentCardsTour,
    isOpen && step === 1 && nbuEnabled && savedCards.length > 0 && !!details && !detailsLoading && !showSuccess,
  );

  const nbuChargeMutation = useMutation({
    mutationFn: nbuPaymentService.chargeSavedCard,
    onSuccess: (data) => {
      if (data.status === 'SUCCESS') {
        // Stay in the drawer and reveal the success view — the user should
        // *feel* the payment landed, not just see a toast flash and vanish.
        queryClient.invalidateQueries({ queryKey: ['payment-history'] });
        queryClient.invalidateQueries({ queryKey: ['payment-available-flights'] });
        queryClient.invalidateQueries({ queryKey: ['nbu-cards'] });
        playApplePaySound();
        setChargeDone(true);
      } else {
        toast.error(data.error || t('nbu.cards.chargeFailed'));
        setConfirmChargeCard(null);
      }
      setChargingCardId(null);
    },
    onError: (err: unknown) => {
      // Dead/failing saved-card token (NBU 3008/5000) → offer the user "unbind +
      // re-bind now" vs "pay later" instead of a dead-end toast.
      if (isCardReauthError(err)) {
        setChargingCardId(null);
        setConfirmChargeCard(null);
        void promptCardReauth(err);
        return;
      }
      const error = err as { status?: number; data?: { detail?: string | { message?: string } }; message?: string };
      const status = error?.status ?? 0;
      let msg: string;
      switch (status) {
        case 400:
          msg = t('nbu.error.400');
          break;
        case 404:
          msg = t('nbu.error.404');
          break;
        case 409:
          msg = t('nbu.error.409');
          break;
        case 422: {
          const detail = error?.data?.detail;
          if (typeof detail === 'object' && detail?.message) {
            msg = detail.message;
          } else if (typeof detail === 'string' && detail) {
            msg = detail;
          } else {
            msg = t('nbu.error.422');
          }
          break;
        }
        case 429: {
          // Prefer the backend's specific reason (e.g. "Siz M227 reysi uchun
          // so'nggi 1 soat ichida zayavka yuborgansiz...") over the generic toast.
          const detail = error?.data?.detail;
          if (typeof detail === 'object' && detail?.message) {
            msg = detail.message;
          } else if (typeof detail === 'string' && detail) {
            msg = detail;
          } else {
            msg = t('nbu.error.429');
          }
          break;
        }
        case 502:
          msg = t('nbu.error.502');
          break;
        case 503:
          msg = t('nbu.error.503');
          break;
        default:
          msg = error?.message || t('makePayment.errorOccurred');
      }
      toast.error(msg);
      setChargingCardId(null);
      setConfirmChargeCard(null);
    },
  });

  // Bind + delete saved cards live in `CardsManagerModal` (profile) — the
  // payment surface intentionally focuses on completing the current payment
  // rather than long-lived card management.

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

  // A wallet that covers the whole debt is a method of its own («Balansdan
  // to'lash»), so the switch is offered only for a part of the debt.
  const walletCoversAll =
    !!details && payableAmount > 0 && details.wallet_balance >= payableAmount;
  const hasWalletSwitch = !!details && details.wallet_balance > 0 && !walletCoversAll;
  const walletOn = useWallet && hasWalletSwitch;

  const walletDeduction = useMemo(() => {
    if (!walletOn || !details) return 0;
    return Math.min(details.wallet_balance, effectiveAmount);
  }, [walletOn, details, effectiveAmount]);

  const finalPayable = useMemo(
    () => Math.max(effectiveAmount - walletDeduction, 0),
    [effectiveAmount, walletDeduction],
  );

  // The same limits the hint under the field quotes; an empty field is not a part.
  const partialValid =
    !isPartial ||
    (customAmount !== '' &&
      effectiveAmount >= PARTIAL_MIN_UZS &&
      effectiveAmount <= payableAmount);

  // NBU (saved card or the bank page) always charges the whole debt and never
  // the wallet (`payments_nbu.py`), so it is not offered with either choice.
  const nbuBlockedBy = walletOn
    ? t('cardTransfer.payCardNoWallet')
    : isPartial
      ? t('makePayment.methods.fullOnly')
      : null;
  // Below NBU's floor the floor is charged and the difference goes to the
  // wallet; the server makes the same split in tiyin (`_raise_to_nbu_minimum`).
  const nbuCharge = Math.max(payableAmount, NBU_MIN_UZS);
  const isBelowNbuMinimum = payableAmount > 0 && payableAmount < NBU_MIN_UZS;

  // Required with an online receipt: the server compares them with the
  // Payme / Click payment's card. The reminder shows once a receipt is chosen
  // or digits are being typed, so an untouched form does not look wrong.
  const cardLast4Ready = cardLast4.length === 4;
  const cardLast4Warn = !cardLast4Ready && (receiptFile !== null || cardLast4.length > 0);

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
      // The wallet part, the custom sum and the method belong to one flight.
      setUseWallet(false);
      setIsPartial(false);
      setCustomAmount('');
      setMethodKey(null);
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

  const handleNbuPayment = useCallback(async () => {
    if (!selectedFlightName) return;
    setIsNbuInitiating(true);
    try {
      const response = await nbuPaymentService.init({ flight_name: selectedFlightName });
      openNbuUrl({
        orderId: response.order_id,
        kind: 'payment',
        paymentUrl: response.payment_url,
        flightName: selectedFlightName,
        // After a flight payment, land on the payment-history page.
        homePath: '/user/history',
      });
    } catch (err: unknown) {
      const error = err as { status?: number; data?: { detail?: string | { message?: string } }; message?: string };
      const status = error?.status ?? 0;
      let msg: string;
      switch (status) {
        case 400:
          msg = t('nbu.error.400');
          break;
        case 404:
          msg = t('nbu.error.404');
          break;
        case 409:
          msg = t('nbu.error.409');
          break;
        case 422: {
          const detail = error?.data?.detail;
          if (typeof detail === 'object' && detail?.message) {
            msg = detail.message;
          } else if (typeof detail === 'string' && detail) {
            msg = detail;
          } else {
            msg = t('nbu.error.422');
          }
          break;
        }
        case 429: {
          // Prefer the backend's specific reason (e.g. "Siz M227 reysi uchun
          // so'nggi 1 soat ichida zayavka yuborgansiz...") over the generic toast.
          const detail = error?.data?.detail;
          if (typeof detail === 'object' && detail?.message) {
            msg = detail.message;
          } else if (typeof detail === 'string' && detail) {
            msg = detail;
          } else {
            msg = t('nbu.error.429');
          }
          break;
        }
        case 502:
          msg = t('nbu.error.502');
          break;
        case 503:
          msg = t('nbu.error.503');
          break;
        default:
          msg = error?.message || t('makePayment.errorOccurred');
      }
      toast.error(msg);
    } finally {
      setIsNbuInitiating(false);
    }
  }, [selectedFlightName, t]);

  // Payme or Click: the server opens the order for the whole debt (or hands
  // back the open one, or the one the provider is paying), the provider's page
  // opens on this tap and the next step watches the order until it is booked.
  const handleProviderPayment = useCallback(
    async (provider: OnlineProvider) => {
      if (!selectedFlightName) return;
      setIsPaymeOpening(true);
      try {
        const service = provider === 'click' ? clickService : paymeService;
        const order = await service.openOrder(selectedFlightName);
        if (
          order.state === 'open' &&
          order.checkout_url &&
          !openPaymeCheckout(order.checkout_url, provider)
        ) {
          toast.error(t(`${provider}.badLink`));
        }
        setPaymeOrder(order);
        setPaymentMethod(provider);
        goNext();
      } catch (err: unknown) {
        toast.error(paymeRefusal(err, t('makePayment.errorOccurred')));
      } finally {
        setIsPaymeOpening(false);
      }
    },
    [selectedFlightName, goNext, t],
  );

  const reopenProviderOrder = useCallback(
    () =>
      (paymentMethod === 'click' ? clickService : paymeService).openOrder(
        selectedFlightName ?? '',
      ),
    [paymentMethod, selectedFlightName],
  );

  const handlePaymePaid = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['payment-available-flights'] });
    queryClient.invalidateQueries({ queryKey: ['payment-flight-details'] });
    queryClient.invalidateQueries({ queryKey: ['payment-history'] });
    queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
  }, [queryClient]);

  // Execute the charge for the card the user confirmed in the drawer.
  const confirmCharge = useCallback(() => {
    if (!confirmChargeCard || !selectedFlightName) return;
    setChargingCardId(confirmChargeCard.id);
    nbuChargeMutation.mutate({
      card_id: confirmChargeCard.id,
      flight_name: selectedFlightName,
    });
  }, [confirmChargeCard, selectedFlightName, nbuChargeMutation]);

  // Close the confirm/success drawer. After a completed payment, also close the
  // whole wizard so the user lands back home rather than on a stale form.
  const closeChargeDrawer = useCallback(() => {
    const wasDone = chargeDone;
    setConfirmChargeCard(null);
    setChargeDone(false);
    setChargingCardId(null);
    if (wasDone) handleClose();
  }, [chargeDone, handleClose]);

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
    } else if (paymentMethod === 'online' && receiptFile && cardLast4Ready) {
      onlineMutation.mutate({
        flight_name: selectedFlightName,
        payment_mode: paymentMode,
        paid_amount: effectiveAmount,
        wallet_used: walletDeduction,
        receipt_file: receiptFile,
        card_last4: cardLast4,
      });
    }
  }, [
    selectedFlightName,
    paymentMethod,
    effectiveAmount,
    paymentMode,
    walletDeduction,
    receiptFile,
    cardLast4,
    cardLast4Ready,
    walletMutation,
    cashMutation,
    onlineMutation,
  ]);

  // ============================================================================
  // Payment methods — one list, one button under it
  // ============================================================================

  const detailsReady = !!details && !detailsLoading && !detailsError && details.total_payment != null;

  // Manual online (card / payment links + receipt) is offered whenever the
  // flight has an active card or a payment link, independent of NBU.
  const paymentLinkNames = (details?.payment_links ?? []).map((link) => link.name).join(', ');
  const hasManualOnline = !!details?.card_number || paymentLinkNames !== '';
  // Card transfer by request: an exact sum, no receipt. The server then hides
  // `card_number` from the manual method; the bank transfer cannot carry the
  // wallet's part.
  const hasCardTransfer = details?.card_intent_available === true;

  const payOptions: PayOption[] = [];
  if (detailsReady) {
    const payNow = t('makePayment.methods.payAmount', { amount: formatMoney(nbuCharge) });
    // NBU refuses anything under its floor: the floor is charged and the rest
    // credited to the wallet. Said in the NBU rows, beside the choice it affects,
    // and the button and the confirm drawer quote the same charge.
    const nbuFloorHint = isBelowNbuMinimum
      ? t('makePayment.methods.nbuFloorHint', {
          min: formatMoney(NBU_MIN_UZS),
          surplus: formatMoney(nbuCharge - payableAmount),
        })
      : null;
    const next = t('makePayment.methods.continue');

    if (walletCoversAll) {
      payOptions.push({
        key: 'wallet',
        icon: Wallet,
        title: t('makePayment.payWallet'),
        hint: t('makePayment.methods.walletHint', { amount: formatMoney(details.wallet_balance) }),
        blockedBy: null,
        tour: 'pay-wallet',
        cta: t('makePayment.payWallet'),
        run: () => handleChooseMethod('wallet'),
      });
    }

    if (nbuEnabled) {
      // Binding a card is not offered here: cards are added from the profile
      // (`CardsManagerModal`), so this surface stays on the current payment.
      savedCards.forEach((card, index) => {
        const masked = formatMaskedCard(card.card_masked);
        payOptions.push({
          key: `saved-${card.id}`,
          icon: CreditCard,
          title: card.nickname || masked || t('nbu.cards.namedCardFallback'),
          hint:
            nbuFloorHint ??
            (card.nickname && masked
              ? masked
              : masked
                ? t('makePayment.methods.savedCardHint')
                : t('nbu.cards.pendingMasked')),
          blockedBy: nbuBlockedBy,
          tour: index === 0 ? 'pay-saved-card' : undefined,
          cta: payNow,
          // A saved card charges through the confirm drawer, never on this tap.
          run: () => setConfirmChargeCard(card),
        });
      });
      payOptions.push({
        key: 'nbu',
        icon: Landmark,
        title: savedCards.length > 0 ? t('makePayment.methods.nbuOtherCard') : t('makePayment.methods.nbuTitle'),
        hint: nbuFloorHint ?? t('makePayment.methods.nbuHint'),
        blockedBy: nbuBlockedBy,
        cta: payNow,
        run: () => void handleNbuPayment(),
      });
    }

    if (paymeEnabled) {
      // Payme's order is the whole debt and never the wallet's part, as NBU's,
      // and it has no floor to raise a small debt to: the server refuses one.
      payOptions.push({
        key: 'payme',
        icon: Zap,
        title: t('payme.title'),
        hint: t('payme.hint'),
        blockedBy:
          nbuBlockedBy ??
          (payableAmount < PAYME_MIN_UZS
            ? t('payme.minAmount', { min: formatMoney(PAYME_MIN_UZS) })
            : null),
        cta: t('makePayment.methods.payAmount', { amount: formatMoney(payableAmount) }),
        run: () => void handleProviderPayment('payme'),
      });
    }

    if (clickEnabled) {
      // Click's order is Payme's: the whole debt, never the wallet's part.
      payOptions.push({
        key: 'click',
        icon: MousePointerClick,
        title: t('click.title'),
        hint: t('click.hint'),
        blockedBy:
          nbuBlockedBy ??
          (payableAmount < PAYME_MIN_UZS
            ? t('payme.minAmount', { min: formatMoney(PAYME_MIN_UZS) })
            : null),
        cta: t('makePayment.methods.payAmount', { amount: formatMoney(payableAmount) }),
        run: () => void handleProviderPayment('click'),
      });
    }

    if (hasCardTransfer) {
      payOptions.push({
        key: 'card',
        icon: ArrowRightLeft,
        title: t('cardTransfer.payCard'),
        hint: t('cardTransfer.payCardHint'),
        blockedBy: walletOn ? t('cardTransfer.payCardNoWallet') : null,
        cta: next,
        run: () => handleChooseMethod('card'),
      });
    }

    if (hasManualOnline) {
      payOptions.push({
        key: 'online',
        icon: Smartphone,
        title: t('makePayment.payOnline'),
        hint: details.card_number
          ? paymentLinkNames
            ? t('makePayment.methods.onlineHintCardLinks', { names: paymentLinkNames })
            : t('makePayment.methods.onlineHintCard')
          : t('makePayment.methods.onlineHintLinks', { names: paymentLinkNames }),
        blockedBy: null,
        cta: next,
        run: () => handleChooseMethod('online'),
      });
    }

    payOptions.push({
      key: 'cash',
      icon: Banknote,
      title: t('makePayment.methods.cashTitle'),
      hint: t('makePayment.methods.cashHint'),
      blockedBy: isPartial ? t('makePayment.methods.cashNoPartial') : null,
      cta: next,
      run: () => handleChooseMethod('cash'),
    });
  }

  const selectedOption =
    payOptions.find((option) => option.key === methodKey && option.blockedBy === null) ??
    payOptions.find((option) => option.blockedBy === null) ??
    null;
  const payButtonDisabled =
    !selectedOption || !partialValid || isNbuInitiating || isPaymeOpening;

  // ============================================================================
  // Step Renderers
  // ============================================================================

  /** STEP 0: Select Flight */
  const renderStep0 = () => {
    if (flightsLoading) return <FlightSkeleton />;

    if (flightsError) {
      return (
        <div className="flex flex-col items-center justify-center space-y-3 py-12 text-center">
          <AlertCircle className="h-10 w-10 text-mc-danger" strokeWidth={1.8} />
          <p className="text-[13px] font-medium text-mc-text-2">
            {t('makePayment.errorOccurred')}
          </p>
          <button
            onClick={() => refetchFlights()}
            className="rounded-mc-md bg-mc-brand px-5 py-2.5 text-[14px] font-bold
                       text-mc-on-brand transition-transform active:scale-95"
          >
            {t('makePayment.retry')}
          </button>
        </div>
      );
    }

    const flights = flightsData?.flights ?? [];
    // Split by report readiness: "ready" flights carry a computed total_payment;
    // "pending" (report not sent) ones don't and are tucked into the archive view.
    const readyFlights = flights.filter((f) => f.total_payment != null);
    const pendingFlights = flights.filter((f) => f.total_payment == null);
    const visibleFlights = showArchive ? pendingFlights : readyFlights;

    if (flights.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center space-y-2 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mc-surface-2">
            <Plane className="h-7 w-7 text-mc-text-3" strokeWidth={1.7} />
          </div>
          <p className="text-[15px] font-extrabold text-mc-text">
            {t('makePayment.noFlights')}
          </p>
          <p className="max-w-[280px] text-[12px] font-medium text-mc-text-2">
            {t('makePayment.noFlightsDesc')}
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {/* Header row — title + archive toggle for report-not-sent flights */}
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[13px] font-extrabold text-mc-text">
            {showArchive
              ? t('makePayment.archiveTitle', "Arxiv — hisobot yuborilmagan")
              : t('makePayment.selectFlight')}
          </p>
          {(pendingFlights.length > 0 || showArchive) && (
            <button
              onClick={() => setShowArchive((v) => !v)}
              className="flex shrink-0 items-center gap-1.5 rounded-mc-sm bg-mc-surface-2
                         px-2.5 py-1.5 text-[12px] font-bold text-mc-text-2
                         transition-transform active:scale-95"
            >
              {showArchive ? (
                <>
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {t('makePayment.flightsBack', 'Reyslar')}
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5" />
                  {t('makePayment.archive', 'Arxiv')} ({pendingFlights.length})
                </>
              )}
            </button>
          )}
        </div>

        {visibleFlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-2 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mc-surface-2">
              {showArchive ? (
                <Archive className="h-7 w-7 text-mc-text-3" strokeWidth={1.7} />
              ) : (
                <Plane className="h-7 w-7 text-mc-text-3" strokeWidth={1.7} />
              )}
            </div>
            <p className="max-w-[260px] text-[13px] font-bold text-mc-text-2">
              {showArchive
                ? t('makePayment.archiveEmpty', "Arxivda reys yo'q")
                : t('makePayment.noReadyFlights', "Hisoboti tayyor reys yo'q")}
            </p>
            {!showArchive && pendingFlights.length > 0 && (
              <p className="max-w-[260px] text-[11px] font-medium text-mc-text-3">
                {t('makePayment.noReadyFlightsHint', "Hisobot yuborilmagan reyslar arxivda")}
              </p>
            )}
          </div>
        ) : (
          visibleFlights.map((flight) => (
          <motion.button
            key={flight.flight_name}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleSelectFlight(flight)}
            className="w-full rounded-mc-md border border-mc-border bg-mc-surface p-3
                       text-left shadow-[var(--mc-shadow-card)] transition-transform
                       duration-150"
          >
            {/* Wraps the amount under the name when both do not fit (320px with
                a seven-digit sum) rather than squeezing the flight name: a
                truncated "M286-M..." names no flight at all. */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              {/* Left */}
              <div className="flex items-center gap-2.5">
                {/* Blue appeared nowhere else in the client app; the chip now
                    carries the same warn/brand pair the cargo list uses. */}
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-mc-sm ${
                    flight.payment_status === 'partial'
                      ? 'bg-mc-warn-soft text-mc-warn'
                      : 'bg-mc-brand-soft text-mc-brand'
                  }`}
                >
                  <Plane className="h-[18px] w-[18px]" strokeWidth={2} />
                </div>
                <div>
                  <p className="break-words text-[14px] font-extrabold text-mc-text">
                    {flight.flight_name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                        flight.payment_status === 'partial'
                          ? 'border-mc-warn/25 bg-mc-warn-soft text-mc-warn'
                          : 'border-mc-danger/25 bg-mc-danger-soft text-mc-danger'
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
              <div className="ml-auto text-right flex-shrink-0">
                {flight.total_payment != null ? (
                  <>
                    {flight.payment_status === 'partial' &&
                    flight.remaining_amount != null ? (
                      <div>
                        <p className="text-[11px] font-medium text-mc-text-2">
                          {t('makePayment.remaining')}
                        </p>
                        <p className="text-[14px] font-extrabold text-mc-danger tabular-nums">
                          {formatMoney(flight.remaining_amount)}
                          <span className="ml-1 text-[10px] font-bold opacity-80">
                            so'm
                          </span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-[14px] font-extrabold text-mc-text tabular-nums">
                        {formatMoney(flight.total_payment)}
                        <span className="ml-1 text-[10px] font-bold text-mc-text-2">
                          so'm
                        </span>
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] font-medium text-mc-text-3">
                    {t('makePayment.reportNotReady')}
                  </span>
                )}
                <ChevronRight className="ml-auto mt-0.5 h-3.5 w-3.5 text-mc-text-3" />
              </div>
            </div>
            {/* Under the whole row, not in the name column: a large amount
                squeezes that column to a few dozen pixels. Indented to the
                name (36px chip + 10px gap). */}
            {flight.astatka_flight_name && (
              <span className="mt-1.5 block pl-[46px]">
                <AstatkaShelfNote astatkaFlightName={flight.astatka_flight_name} />
              </span>
            )}
          </motion.button>
          ))
        )}
      </div>
    );
  };

  /** STEP 1: Payment Details & Method */
  const renderStep1 = () => {
    if (detailsLoading) return <DetailSkeleton />;

    // Flight has no cargo calculated yet — show friendly message instead of error
    if (detailsError || !details || details.total_payment == null) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 px-2 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mc-warn-soft">
            <Package className="h-7 w-7 text-mc-warn" strokeWidth={1.8} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-[16px] font-extrabold text-mc-text">
              {t('makePayment.reportNotReady')}
            </h3>
            <p className="mx-auto max-w-[260px] text-[12px] font-medium leading-relaxed text-mc-text-2">
              {t('makePayment.reportNotReadyDesc')}
            </p>
          </div>
          <button
            onClick={goBack}
            className="rounded-mc-md bg-mc-brand px-5 py-2.5 text-[14px] font-bold
                       text-mc-on-brand transition-transform active:scale-95"
          >
            {t('makePayment.retry')}
          </button>
        </div>
      );
    }

    const multiPrice = details.cargo_prices.length > 1;
    const hasTrackCodes = details.track_codes.length > 0;
    const partialOutOfRange = isPartial && customAmount !== '' && !partialValid;

    return (
      <div className="space-y-5">
        {/* ---- What is owed ---- */}
        <div data-tour="pay-amount">
          <p className="text-[12px] font-semibold text-mc-text-2">
            {details.has_existing_partial
              ? t('makePayment.existingRemaining')
              : t('makePayment.totalAmount')}
          </p>
          {/* The figure wraps before the unit, never inside the number. */}
          <p className="mt-1.5 text-[30px] font-extrabold leading-none tracking-tight text-mc-text tabular-nums min-[360px]:text-[34px]">
            {formatMoney(payableAmount)}{' '}
            <span className="text-[16px] font-bold tracking-normal text-mc-text-2">so'm</span>
          </p>
          {details.has_existing_partial && details.existing_paid_amount != null && (
            <p className="mt-2 text-[12px] font-medium text-mc-text-2">
              {t('makePayment.existingPaid')}:{' '}
              <span className="font-bold text-mc-text tabular-nums">
                {formatMoney(details.existing_paid_amount)} so'm
              </span>
            </p>
          )}

          {/* Flight facts: one divided strip rather than a grid of boxed tiles. */}
          <div
            className={`mt-4 grid divide-x divide-mc-border rounded-mc-md border border-mc-border ${
              hasTrackCodes ? 'grid-cols-3' : 'grid-cols-2'
            }`}
          >
            <Fact label={t('makePayment.weight')} value={`${details.total_weight.toFixed(2)} kg`} />
            <Fact
              label={t('makePayment.pricePerKg')}
              value={
                multiPrice
                  ? t('makePayment.variousPrices')
                  : `$${details.price_per_kg_usd.toFixed(2)}`
              }
              expanded={multiPrice ? showCargoPrices : undefined}
              onToggle={multiPrice ? () => setShowCargoPrices((open) => !open) : undefined}
            />
            {hasTrackCodes && (
              <Fact
                label={t('makePayment.trackCodes')}
                value={String(details.track_codes.length)}
                expanded={showTrackCodes}
                onToggle={() => setShowTrackCodes((open) => !open)}
              />
            )}
          </div>
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
              <div className="divide-y divide-mc-border rounded-mc-md border border-mc-border">
                {details.track_codes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleTrackClick(code)}
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2.5 text-left
                      transition-transform active:scale-[0.99]"
                  >
                    <span className="min-w-0 break-all font-mono text-[13px] font-semibold text-mc-text">
                      {code}
                    </span>
                    <Search className="h-4 w-4 shrink-0 text-mc-text-2" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- Expandable Cargo Prices List ---- */}
        <AnimatePresence>
          {showCargoPrices && details.cargo_prices.length > 1 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="divide-y divide-mc-border rounded-mc-md border border-mc-border">
                {details.cargo_prices.map((cargo, idx) => (
                  <div
                    key={idx}
                    className="flex items-baseline justify-between gap-3 px-3 py-2.5 text-[13px] tabular-nums"
                  >
                    <span className="text-mc-text-2">{cargo.weight_kg} kg</span>
                    <span className="font-bold text-mc-text">
                      ${cargo.price_per_kg_usd.toFixed(2)}
                      <span className="ml-0.5 font-medium text-mc-text-2">/kg</span>
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- A custom sum and the wallet's part ---- */}
        {(partialAllowed || hasWalletSwitch) && (
          <div className="divide-y divide-mc-border rounded-mc-md border border-mc-border">
            {partialAllowed && (
              <div>
                <SwitchRow
                  label={t('makePayment.customAmount')}
                  checked={isPartial}
                  onToggle={() => setIsPartial((on) => !on)}
                />
                {isPartial && (
                  <div className="px-3.5 pb-3.5">
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
                      aria-label={t('makePayment.enterAmount')}
                      aria-invalid={partialOutOfRange || undefined}
                      className="w-full rounded-mc-md border border-mc-border bg-mc-surface-2 px-4 py-3 text-[18px] font-bold
                        text-mc-text tabular-nums placeholder:text-mc-text-2 placeholder:font-semibold
                        focus:border-mc-brand focus:outline-none focus:ring-2 focus:ring-mc-brand/40 transition-colors"
                    />
                    <p
                      className={`mt-1.5 px-1 text-[12px] ${
                        partialOutOfRange ? 'font-semibold text-mc-warn' : 'text-mc-text-2'
                      }`}
                    >
                      {t('makePayment.minAmount', { amount: formatMoney(PARTIAL_MIN_UZS) })} ·{' '}
                      {t('makePayment.maxAmount', { amount: formatMoney(payableAmount) })}
                    </p>
                  </div>
                )}
              </div>
            )}
            {hasWalletSwitch && (
              <div data-tour="pay-wallet">
                <SwitchRow
                  label={t('makePayment.useWallet')}
                  hint={`${t('makePayment.yourBalance')}: ${formatMoney(details.wallet_balance)} so'm`}
                  checked={walletOn}
                  onToggle={() => setUseWallet((on) => !on)}
                />
                {walletOn && (
                  <div className="space-y-1 px-3.5 pb-3.5 text-[13px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-mc-text-2">{t('makePayment.walletApplied')}</span>
                      <span className="font-bold text-mc-success tabular-nums">
                        −{formatMoney(walletDeduction)} so'm
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-mc-text">{t('makePayment.youPay')}</span>
                      <span className="font-extrabold text-mc-text tabular-nums">
                        {formatMoney(finalPayable)} so'm
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---- How to pay: one list, the button under the sheet acts on it ---- */}
        <PayMethodList
          options={payOptions}
          selectedKey={selectedOption?.key}
          onSelect={setMethodKey}
          tour="pay-methods"
        />
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
            className="w-20 h-20 rounded-full bg-mc-success/12 flex items-center justify-center"
          >
            <CheckCircle2 className="w-10 h-10 text-mc-success" />
          </motion.div>
          <h3 className="text-2xl font-extrabold text-mc-text">
            {t('makePayment.successTitle')}
          </h3>
          <p className="text-sm text-mc-text-2 max-w-[260px]">
            {t('makePayment.successDesc')}
          </p>
          <button
            onClick={handleClose}
            className="mt-4 w-full max-w-[280px] h-16 rounded-mc-lg font-extrabold text-[16px]
              bg-mc-brand text-mc-on-brand
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
          <div className="w-16 h-16 rounded-full bg-mc-surface-2 flex items-center justify-center">
            <Banknote className="w-8 h-8 text-mc-text-2" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-mc-text">
              {t('makePayment.cashConfirmTitle')}
            </h3>
            <p className="text-sm text-mc-text-2 max-w-[280px] mx-auto">
              {t('makePayment.cashConfirmDesc')}
            </p>
          </div>
          {/* This screen tells the customer to come to the office — without the
              address and today's hours they arrive at a closed door. */}
          <OfficeVisitSummary />
          {walletDeduction > 0 && (
            <div className="w-full max-w-xs mx-auto rounded-mc-md p-3 bg-mc-success/12 border border-mc-success/25">
              <div className="flex justify-between text-sm">
                <span className="text-mc-text-2">
                  {t('makePayment.walletApplied')}
                </span>
                <span className="font-bold text-mc-success">
                  -{formatMoney(walletDeduction)} so'm
                </span>
              </div>
            </div>
          )}
          <p className="text-3xl font-extrabold text-mc-text">
            {formatMoney(finalPayable)}
            <span className="text-base ml-1.5 text-mc-brand font-bold">
              so'm
            </span>
          </p>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full max-w-xs h-14 rounded-mc-lg font-bold text-base
              bg-mc-brand text-mc-on-brand
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
          <div className="w-16 h-16 rounded-full bg-mc-success/12 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-mc-success" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-mc-text">
              {t('makePayment.walletConfirmTitle')}
            </h3>
            <p className="text-sm text-mc-text-2 max-w-[280px] mx-auto">
              {t('makePayment.walletConfirmDesc', {
                amount: `${formatMoney(effectiveAmount)} so'm`,
              })}
            </p>
          </div>
          <p className="text-3xl font-extrabold text-mc-success">
            {formatMoney(effectiveAmount)}
            <span className="text-base ml-1.5 font-bold">so'm</span>
          </p>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full max-w-xs h-16 rounded-mc-lg font-extrabold text-[16px]
              bg-mc-success text-mc-on-success
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

    // ---- Payme's or Click's page ----
    if ((paymentMethod === 'payme' || paymentMethod === 'click') && paymeOrder) {
      return (
        <PaymePanel
          key={`${paymentMethod}-${paymeOrder.id}`}
          provider={paymentMethod}
          initialOrder={paymeOrder}
          reopenOrder={reopenProviderOrder}
          onPaid={handlePaymePaid}
          onBack={goBack}
          onDone={handleClose}
        />
      );
    }

    // ---- Card transfer by request ----
    if (paymentMethod === 'card' && selectedFlightName) {
      return (
        <CardTransferPanel
          flightName={selectedFlightName}
          paymentMode={isPartial ? 'partial' : 'full'}
          partAmount={isPartial ? effectiveAmount : undefined}
          onBack={goBack}
          onDone={handleClose}
        />
      );
    }

    // ---- Online Payment — Card + Links + Upload ----
    if (paymentMethod === 'online') {
      const hasCard = !!details?.card_number;
      const paymentLinks: PaymentLinkItem[] = details?.payment_links ?? [];
      const hasLinks = paymentLinks.length > 0;

      if (!hasCard && !hasLinks) {
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-mc-brand" />
            <p className="text-mc-text-2 max-w-[260px]">
              {t('makePayment.noCardAvailable')}
            </p>
          </div>
        );
      }

      return (
        <div className="space-y-5">
          <h3 className="text-lg font-bold text-mc-text text-center">
            {t('makePayment.onlineTitle')}
          </h3>

          {/* Amount summary */}
          <div className="text-center">
            <p className="text-3xl font-extrabold text-mc-text">
              {formatMoney(finalPayable)}
              <span className="text-sm ml-1.5 text-mc-brand font-bold">
                so'm
              </span>
            </p>
            {walletDeduction > 0 && (
              <p className="text-xs text-mc-success mt-1 font-medium">
                {t('makePayment.walletApplied')}: -{formatMoney(walletDeduction)}{' '}
                so'm
              </p>
            )}
          </div>

          {/* Card info */}
          {hasCard && (
            <div className="rounded-mc-lg p-4 bg-mc-cardface">
              <p className="text-xs font-medium text-white/55 mb-1">
                {t('makePayment.transferTo')}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-extrabold tracking-wider text-white">
                  {details!.card_number}
                </p>
                <button
                  onClick={handleCopyCard}
                  aria-label={t('makePayment.copyCard', 'Karta raqamidan nusxa olish')}
                  className="p-2.5 rounded-mc-md bg-white/10 active:scale-90 transition-all"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-mc-success" />
                  ) : (
                    <Copy className="w-5 h-5 text-white/70" />
                  )}
                </button>
              </div>
              {details!.card_owner && (
                <p className="text-xs text-white/60 mt-1.5">
                  {t('makePayment.cardOwner')}: {details!.card_owner}
                </p>
              )}
            </div>
          )}

          {/* Payment Links */}
          {hasLinks && (
            <div className="space-y-2">
              {hasCard && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-mc-surface-2" />
                  <span className="text-xs font-medium text-mc-text-3 px-1">
                    yoki
                  </span>
                  <div className="flex-1 h-px bg-mc-surface-2" />
                </div>
              )}
              <p className="text-xs font-semibold text-mc-text-2 uppercase tracking-wide">
                {hasCard ? "Online to'lov tizimi orqali" : "To'lov tizimini tanlang"}
              </p>
              {paymentLinks.map((link) => (
                <PaymentLinkButton key={link.slug} link={link} />
              ))}
            </div>
          )}

          {/* Divider before upload */}
          {(hasCard || hasLinks) && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 h-px bg-mc-surface-2" />
              <span className="text-xs font-medium text-mc-text-3 px-1">
                To'lov chekini yuboring
              </span>
              <div className="flex-1 h-px bg-mc-surface-2" />
            </div>
          )}

          {/* File Upload Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-mc-lg border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200
              ${
                receiptFile
                  ? 'border-mc-success dark:border-mc-success/40 bg-mc-success/12 dark:bg-mc-success/5'
                  : 'border-mc-border dark:border-white/15 bg-mc-surface-2'
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
                    className="max-h-36 mx-auto rounded-mc-md object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 mx-auto rounded-mc-md bg-mc-success/12 flex items-center justify-center">
                    <FileImage className="w-8 h-8 text-mc-success" />
                  </div>
                )}
                <p className="text-sm font-semibold text-mc-text truncate px-2">
                  {receiptFile.name}
                </p>
                <p className="text-xs text-mc-brand font-medium">
                  {t('makePayment.changeFile')}
                </p>
              </div>
            ) : (
              <div className="space-y-2 py-3">
                <Upload className="w-10 h-10 text-mc-text-3 mx-auto" />
                <p className="text-sm font-semibold text-mc-text-2">
                  {t('makePayment.dragOrClick')}
                </p>
                <p className="text-xs text-mc-text-3">
                  {t('makePayment.uploadReceiptDesc')}
                </p>
              </div>
            )}
          </div>

          {/* Card's last 4 digits (required) */}
          <label className="flex items-center justify-between gap-3 p-3.5 rounded-mc-md border border-mc-border bg-mc-surface">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-mc-text">
                {t('makePayment.cardLast4')}
              </span>
              <span
                className={`block text-xs mt-0.5 ${
                  cardLast4Warn ? 'text-mc-warn' : 'text-mc-text-3'
                }`}
              >
                {cardLast4Warn
                  ? t('makePayment.cardLast4Incomplete')
                  : t('makePayment.cardLast4Hint')}
              </span>
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={cardLast4}
              onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
              aria-label={t('makePayment.cardLast4')}
              className="w-24 shrink-0 px-3 py-2.5 rounded-mc-md text-center text-lg font-bold tabular-nums tracking-[0.25em]
                bg-mc-surface-2 border border-mc-border text-mc-text
                placeholder:text-mc-text-3 placeholder:font-semibold
                focus:outline-none focus:ring-2 focus:ring-mc-brand/40 focus:border-mc-brand
                transition-all"
            />
          </label>

          {/* Submit Button */}
          <button
            onClick={handleConfirm}
            disabled={!receiptFile || !cardLast4Ready || isSubmitting}
            className="w-full h-16 rounded-mc-lg font-extrabold text-[16px]
              bg-mc-brand text-mc-on-brand
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="make-payment-title"
            className={`fixed z-[10000] bg-mc-surface
              ${
                isMobile
                  ? 'bottom-0 left-0 right-0 rounded-t-[22px] max-h-[92dvh] min-h-[58dvh]'
                  : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-mc-xl max-h-[90dvh]'
              }
              overflow-hidden shadow-2xl border border-mc-border
              flex flex-col`}
          >
            {/* ---- Header ---- */}
            <div className="flex-shrink-0 border-b border-mc-border px-4 pb-2 pt-4">
              {/* Drag handle (mobile) */}
              {isMobile && (
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-mc-surface-2" />
              )}
              <div className="flex items-center justify-between gap-2">
                {step > 0 && !showSuccess ? (
                  <button
                    onClick={goBack}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-sm
                               bg-mc-surface-2 text-mc-text transition-transform duration-150
                               active:scale-95"
                    aria-label={t('reports.back', 'Ortga')}
                  >
                    <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2} />
                  </button>
                ) : (
                  <div className="h-10 w-10 shrink-0" />
                )}
                <h2
                  id="make-payment-title"
                  className="min-w-0 flex-1 truncate px-1 text-center text-[15px] font-extrabold text-mc-text"
                >
                  {showSuccess ? t('makePayment.successTitle') : stepTitles[step]}
                </h2>
                <button
                  onClick={handleClose}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-sm
                             bg-mc-surface-2 text-mc-text-2 transition-transform duration-150
                             active:scale-95"
                  aria-label={t('common.close', 'Yopish')}
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>
              </div>
              {!showSuccess && <StepIndicator current={step} total={3} />}
            </div>

            {/* ---- Body (scrollable, animated) ---- */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
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

            {/* ---- The one pay button of the details step ---- */}
            {step === 1 && detailsReady && !showSuccess && payOptions.length > 0 && (
              <div className="shrink-0 border-t border-mc-border bg-mc-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => selectedOption?.run()}
                  disabled={payButtonDisabled}
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-mc-lg bg-mc-brand px-4 py-3
                    text-center text-[16px] font-extrabold leading-tight text-mc-on-brand tabular-nums
                    transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {(isNbuInitiating || isPaymeOpening) && (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
                  )}
                  {selectedOption ? selectedOption.cta : t('makePayment.methods.choose')}
                </button>
              </div>
            )}
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
                <Search className="w-5 h-5 text-mc-brand" />
                <h3 className="text-lg font-bold text-mc-text">
                  {selectedTrackCode}
                </h3>
              </div>

              {isTrackLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-mc-brand animate-spin" />
                </div>
              )}

              {!isTrackLoading && trackData && (
                <TrackResultCard data={trackData} />
              )}

              {!isTrackLoading && !trackData && selectedTrackCode && (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                  <Package className="w-10 h-10 text-mc-text-3" />
                  <p className="text-sm text-mc-text-2">
                    {t('makePayment.errorOccurred')}
                  </p>
                </div>
              )}
            </div>
          </BottomDrawer>

          {/* Saved-card charge: confirmation → success, in one native drawer */}
          <BottomDrawer
            open={!!confirmChargeCard}
            onClose={() => {
              if (!nbuChargeMutation.isPending) closeChargeDrawer();
            }}
          >
            {confirmChargeCard && !chargeDone && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <h3 className="text-xl font-extrabold text-mc-text">
                    {t('nbu.confirm.title')}
                  </h3>
                  <p className="text-sm text-mc-text-2">
                    {t('nbu.confirm.subtitle')}
                  </p>
                </div>

                {/* Amount: what NBU charges, the floor included */}
                <div className="rounded-mc-lg bg-mc-surface-2 py-4 text-center">
                  <p className="mb-1.5 text-[12px] font-semibold text-mc-text-2">
                    {t('nbu.confirm.amountLabel')}
                  </p>
                  <p className="text-[34px] font-extrabold leading-none tracking-tight text-mc-text tabular-nums">
                    {formatMoney(nbuCharge)}{' '}
                    <span className="text-[16px] font-bold tracking-normal text-mc-text-2">so'm</span>
                  </p>
                </div>

                {/* Card + flight */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 rounded-mc-md border border-mc-border p-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-mc-sm bg-mc-surface-2 text-mc-text-2">
                      <CreditCard className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-mc-text-2">{t('nbu.confirm.cardLabel')}</p>
                      <p className="break-words text-[13px] font-bold text-mc-text tabular-nums">
                        {confirmChargeCard.nickname ||
                          formatMaskedCard(confirmChargeCard.card_masked) ||
                          t('nbu.cards.namedCardFallback')}
                      </p>
                      {confirmChargeCard.nickname && confirmChargeCard.card_masked && (
                        <p className="text-[11px] text-mc-text-2 tabular-nums">
                          {formatMaskedCard(confirmChargeCard.card_masked)}
                        </p>
                      )}
                    </div>
                  </div>
                  {selectedFlightName && (
                    <div className="flex items-center gap-3 rounded-mc-md border border-mc-border p-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-mc-sm bg-mc-surface-2 text-mc-text-2">
                        <Plane className="h-5 w-5" strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-mc-text-2">{t('nbu.confirm.flightLabel')}</p>
                        <p className="break-words text-[13px] font-bold text-mc-text">{selectedFlightName}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 pt-1">
                  <button
                    onClick={confirmCharge}
                    disabled={nbuChargeMutation.isPending}
                    className="w-full h-14 rounded-mc-lg font-extrabold text-[16px]
                      bg-mc-brand text-mc-on-brand
                      active:scale-[0.97] transition-all
                      disabled:opacity-60 disabled:cursor-not-allowed
                      flex items-center justify-center gap-2"
                  >
                    {nbuChargeMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('nbu.confirm.processing')}
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        {t('nbu.confirm.payButton')}
                      </>
                    )}
                  </button>
                  <button
                    onClick={closeChargeDrawer}
                    disabled={nbuChargeMutation.isPending}
                    className="w-full h-12 rounded-mc-lg font-bold text-sm
                      bg-mc-surface-2 text-mc-text
                      active:scale-[0.97] transition-all disabled:opacity-50"
                  >
                    {t('nbu.confirm.cancel')}
                  </button>
                </div>
              </div>
            )}

            {confirmChargeCard && chargeDone && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center justify-center py-6 text-center space-y-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.05 }}
                  className="w-24 h-24 rounded-full bg-mc-success/12 flex items-center justify-center"
                >
                  <CheckCircle2 className="w-12 h-12 text-mc-success" />
                </motion.div>
                <div className="space-y-1.5">
                  <h3 className="text-2xl font-extrabold text-mc-text">
                    {t('nbu.chargeSuccessTitle')}
                  </h3>
                  <p className="text-sm text-mc-text-2 max-w-[280px]">
                    {t('nbu.chargeSuccessBody')}
                  </p>
                </div>
                <p className="text-3xl font-extrabold text-mc-success tabular-nums">
                  {formatMoney(nbuCharge)}
                  <span className="text-base ml-1.5 font-bold">so'm</span>
                </p>

                {/* Delivery upsell — strike while the iron is hot */}
                <div className="w-full max-w-[280px] rounded-mc-lg bg-mc-brand-soft border border-mc-brand/20 p-3 space-y-1">
                  <p className="text-sm font-extrabold text-mc-brand">
                    {t('nbu.deliveryCta.title', "1 daqiqada zayavka qoldiring")}
                  </p>
                  <p className="text-[11px] text-mc-text-2">
                    {t('nbu.deliveryCta.body', 'Yukingiz tezda yetkazib beriladi')}
                  </p>
                </div>
                <button
                  onClick={() => { window.location.href = '/?tab=request'; }}
                  className="w-full max-w-[280px] h-14 rounded-mc-lg font-extrabold text-[16px]
                    bg-mc-brand text-mc-on-brand
                    active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                >
                  <Package className="w-5 h-5" />
                  {t('nbu.deliveryCta.button', 'Zayavka qoldirish')}
                </button>
                <button
                  onClick={closeChargeDrawer}
                  className="w-full max-w-[280px] h-12 rounded-mc-lg font-bold text-sm
                    bg-mc-surface-2 text-mc-text
                    active:scale-[0.97] transition-all"
                >
                  {t('nbu.chargeSuccessDone')}
                </button>
              </motion.div>
            )}
          </BottomDrawer>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};

// ============================================================================
// Small sub-components of the details step
// ============================================================================

/** One cell of the flight facts strip; a cell with `onToggle` opens its list. */
function Fact({
  label,
  value,
  expanded,
  onToggle,
}: {
  label: string;
  value: string;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const content = (
    <>
      <span className="block text-[11px] font-medium text-mc-text-2">{label}</span>
      <span className="mt-0.5 flex items-center gap-1 text-[13px] font-bold text-mc-text tabular-nums">
        <span className="min-w-0 break-words">{value}</span>
        {onToggle && (
          <ChevronDown
            aria-hidden="true"
            className={`h-3.5 w-3.5 shrink-0 text-mc-text-2 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        )}
      </span>
    </>
  );
  if (!onToggle) return <div className="min-w-0 px-3 py-2.5">{content}</div>;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="min-w-0 px-3 py-2.5 text-left transition-transform active:scale-[0.97]"
    >
      {content}
    </button>
  );
}

export default memo(MakePaymentModal);
