import { useState, useCallback, useEffect, useMemo, useRef, memo, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation, Trans } from 'react-i18next';
import {
  ChevronRight,
  Truck,
  Package,
  Zap,
  Mail,
  Plane,
  Check,
  Copy,
  Upload,
  Camera,
  X,
  AlertTriangle,
  Wallet,
  Loader2,
  CheckCircle2,
  FileText,
  ArrowLeft,
  UserCog,
  Clock,
  MapPin,
  Phone,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getPaidFlights,
  calculateUzpost,
  submitStandardDelivery,
  submitUzpostDelivery,
  type FlightItem,
  type CalculateUzpostResponse,
} from '@/api/services/deliveryService';
import { useProfile } from '@/hooks/useProfile';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { DeliveryMapPickerLazy } from '@/components/delivery/DeliveryMapPickerLazy';
import { useUzpostBranches } from '@/hooks/useUzpostBranches';
import type { UzpostBranch } from '@/types/uzpostBranch';
import {
  clearSavedUzpostBranchPreference,
  getSavedUzpostBranchId,
  saveUzpostBranchPreference,
} from '@/utils/uzpostBranchStorage';
import { useDeliveryStore } from '@/store/useDeliveryStore';
import {
  nbuPaymentService,
  type SavedCardItem,
} from '@/api/services/nbuPaymentService';
import { redirectToNbuUrl } from '@/utils/nbuReturnContext';
import { isCardReauthError, promptCardReauth } from '@/utils/nbuCardReauth';

const UzpostBranchPicker = lazy(() =>
  import('@/components/delivery/UzpostBranchPicker').then((module) => ({
    default: module.UzpostBranchPicker,
  }))
);

// ============================================
// TYPES
// ============================================

type DeliveryType = 'uzpost' | 'yandex' | 'mandarin' | 'bts';

interface DeliveryOption {
  id: DeliveryType;
  label: string;
  descKey: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
}

interface Props {
  onBack: () => void;
  onNavigateToHistory?: () => void;
  /** Opens the payment modal — offered when the user has no paid flight yet. */
  onGoToPayment?: () => void;
}

// ============================================
// CONSTANTS
// ============================================

const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: 'uzpost',
    label: 'UzPost',
    descKey: 'deliveryRequest.options.uzpost',
    icon: <Mail className="w-8 h-8" />,
    gradient: 'from-mc-brand to-mc-brand-strong',
    iconBg: 'bg-mc-brand-soft text-mc-brand',
  },
  {
    id: 'yandex',
    label: 'Yandex',
    descKey: 'deliveryRequest.options.yandex',
    icon: <Zap className="w-8 h-8" />,
    gradient: 'from-mc-danger to-mc-danger',
    iconBg: 'bg-mc-danger-soft text-mc-danger',
  },
  {
    id: 'mandarin',
    label: 'Mandarin Dostavka',
    descKey: 'deliveryRequest.options.mandarin',
    icon: <Package className="w-8 h-8" />,
    gradient: 'from-mc-success to-mc-success',
    iconBg: 'bg-mc-success/12 text-mc-success',
  },
  {
    id: 'bts',
    label: 'BTS',
    descKey: 'deliveryRequest.options.bts',
    icon: <Truck className="w-8 h-8" />,
    gradient: 'from-mc-brand to-mc-brand-strong',
    iconBg: 'bg-mc-brand-soft text-mc-brand',
  },
];

// ============================================
// SKELETON COMPONENTS
// ============================================

const FlightSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="h-20 rounded-mc-lg bg-mc-surface-2 dark:bg-white/5 animate-pulse"
      />
    ))}
  </div>
);

const CalcSkeleton = () => (
  <div className="space-y-4">
    <div className="h-10 rounded-mc-md bg-mc-surface-2 dark:bg-white/5 animate-pulse w-3/4" />
    <div className="h-24 rounded-mc-lg bg-mc-surface-2 dark:bg-white/5 animate-pulse" />
    <div className="h-24 rounded-mc-lg bg-mc-surface-2 dark:bg-white/5 animate-pulse" />
    <div className="h-14 rounded-mc-lg bg-mc-surface-2 dark:bg-white/5 animate-pulse" />
  </div>
);

const RECEIPT_IMAGE_MAX_WIDTH = 1280;
const RECEIPT_IMAGE_MAX_HEIGHT = 720;
const RECEIPT_IMAGE_QUALITY = 0.82;

async function compressReceiptImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Receipt image could not be loaded'));
      nextImage.src = imageUrl;
    });

    const scale = Math.min(
      RECEIPT_IMAGE_MAX_WIDTH / image.naturalWidth,
      RECEIPT_IMAGE_MAX_HEIGHT / image.naturalHeight,
      1
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', RECEIPT_IMAGE_QUALITY);
    });

    if (!compressedBlob) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'receipt';
    return new File([compressedBlob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

// ============================================
// STEP INDICATOR
// ============================================

// Amber is a different hue from the brand orange every other client screen
// uses; the tokens keep this wizard in the same palette as the card it was
// opened from.
const StepIndicator = memo(({ current, total }: { current: number; total: number }) => (
  <div className="flex items-center justify-center gap-2 mb-6">
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        className={`h-1.5 rounded-full transition-all duration-500 ${
          i + 1 === current
            ? 'w-8 bg-mc-brand'
            : i + 1 < current
            ? 'w-4 bg-mc-brand/40'
            : 'w-4 bg-mc-surface-2 dark:bg-white/10'
        }`}
      />
    ))}
  </div>
));

// ============================================
// STEP 1 — Delivery Type Selection
// ============================================

const StepTypeSelection = memo(
  ({ onSelect }: { onSelect: (type: DeliveryType) => void }) => {
    const { t } = useTranslation();
    return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-400">
      <h2 className="text-2xl font-extrabold mb-1">{t('deliveryRequest.steps.type.title')}</h2>
      <p className="text-mc-text-2 text-sm mb-6">
        {t('deliveryRequest.steps.type.subtitle')}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {DELIVERY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className="
              relative overflow-hidden rounded-mc-lg p-5 text-left
              bg-mc-surface border-2 border-transparent
              active:scale-[0.96] transition-all duration-200
              shadow-sm group
              backdrop-blur-md
            "
          >
            {/* Gradient glow on hover */}
            <div
              className={`
                absolute inset-0 opacity-0 transition-opacity duration-300
                bg-gradient-to-br ${opt.gradient}
              `}
            />

            <div className="relative z-10">
              <div
                className={`
                  w-14 h-14 rounded-mc-lg flex items-center justify-center mb-4
                  ${opt.iconBg}
                `}
              >
                {opt.icon}
              </div>
              <h3 className="font-bold text-lg leading-tight mb-0.5">{opt.label}</h3>
              <p className="text-xs text-mc-text-2">{t(opt.descKey)}</p>
            </div>

            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-mc-text-3 dark:text-white/15 transition-colors" />
          </button>
        ))}
      </div>
    </div>
    );
  }
);

// ============================================
// STEP 2 — Flight Selection
// ============================================

interface StepFlightProps {
  deliveryType: DeliveryType | null;
  flights: FlightItem[];
  loading: boolean;
  selected: string[];
  onToggle: (name: string) => void;
  onContinue: () => void;
  onBack: () => void;
  /** Opens the payment flow — the only way out when no flight is paid yet. */
  onGoToPayment?: () => void;
}

const StepFlightSelection = memo(
  ({ deliveryType, flights, loading, selected, onToggle, onContinue, onBack, onGoToPayment }: StepFlightProps) => {
    const { t } = useTranslation();
    return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-400">
      <h2 className="text-2xl font-extrabold mb-1">{t('deliveryRequest.steps.flight.title')}</h2>
      <p className="text-mc-text-2 text-sm mb-6">
        {t('deliveryRequest.steps.flight.subtitle')}
      </p>
      {deliveryType === 'mandarin' && (
        <span className="inline-flex items-center gap-1 text-xs text-mc-success mb-4 font-medium">
          <Wallet className="w-4 h-4 text-mc-success dark:text-mc-success inline-block mr-1" />
          {t('deliveryRequest.steps.flight.mandarinNote')}
        </span>
      )}
      {deliveryType === 'yandex' && (
        <span className="inline-flex items-center gap-1 text-xs text-mc-brand mb-4 font-medium">
          <Clock className="w-4 h-4 text-mc-brand dark:text-mc-brand inline-block mr-1" />
          {t('deliveryRequest.steps.flight.yandexNote')}
        </span>
      )}
      {deliveryType === 'bts' && (
        <span className="inline-flex items-center gap-1 text-xs text-mc-brand mb-4 font-medium">
          <Clock className="w-4 h-4 text-mc-brand dark:text-mc-brand inline-block mr-1" />
          {t('deliveryRequest.steps.flight.btsNote')}
        </span>
      )}
      {loading ? (
        <FlightSkeleton />
      ) : flights.length === 0 ? (
        /* Dead-end guard: delivery needs a PAID flight, so a user whose payment
           failed lands here with no way forward. Explain the rule and hand them
           the payment flow instead of an empty plane icon. */
        <div className="text-center py-16">
          <Plane className="w-16 h-16 mx-auto text-mc-text-3 dark:text-white/15 mb-4" />
          <p className="text-mc-text-2 font-semibold text-lg">
            {t('deliveryRequest.steps.flight.empty')}
          </p>
          <p className="text-mc-text-3 text-sm mt-1 max-w-xs mx-auto">
            {t('deliveryRequest.steps.flight.emptyDesc')}
          </p>
          <p className="text-mc-text-3 text-sm mt-3 max-w-xs mx-auto">
            {t('deliveryRequest.steps.flight.emptyHint', "Zayavka qoldirish uchun avval yuk to'lovini amalga oshiring.")}
          </p>
          {onGoToPayment && (
            <button
              onClick={onGoToPayment}
              className="mt-5 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-mc-lg
                bg-gradient-to-r from-mc-brand to-mc-brand-strong text-mc-on-brand font-bold
                shadow-lg shadow-amber-500/20 active:scale-[0.97] transition-all"
            >
              <Wallet className="w-5 h-5" />
              {t('deliveryRequest.steps.flight.emptyCta', "To'lov qilish")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {flights.map((f) => {
            const isChecked = selected.includes(f.flight_name);
            return (
              <button
                key={f.flight_name}
                onClick={() => onToggle(f.flight_name)}
                className={`
                  w-full flex items-center gap-4 p-4 rounded-mc-lg text-left
                  transition-all duration-200 active:scale-[0.98]
                  border-2
                  ${
                    isChecked
                      ? 'border-mc-brand bg-mc-warn-soft shadow-md shadow-amber-500/10'
                      : 'border-transparent bg-mc-surface'
                  }
                `}
              >
                {/* Checkbox */}
                <div
                  className={`
                    w-7 h-7 rounded-mc-sm flex items-center justify-center shrink-0
                    transition-all duration-200 border-2
                    ${
                      isChecked
                        ? 'bg-mc-brand border-mc-brand'
                        : 'border-mc-border bg-transparent'
                    }
                  `}
                >
                  {isChecked && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </div>

                {/* Flight Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base">{f.flight_name}</h3>
                  <p className="text-xs text-mc-text-2">{t('deliveryRequest.steps.flight.flightLabel')}</p>
                </div>

                <Plane className="w-5 h-5 text-mc-text-3 dark:text-white/15 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom Actions */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={onBack}
          aria-label={t('common.back', 'Ortga')}
          className="
            flex-shrink-0 w-14 h-14 rounded-mc-lg flex items-center justify-center
            bg-mc-surface-2 text-mc-text-2
            active:scale-95 transition-transform
          "
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={onContinue}
          disabled={selected.length === 0}
          className={`
            flex-1 h-14 rounded-mc-lg font-bold text-base
            flex items-center justify-center gap-2
            transition-all duration-200 active:scale-[0.98]
            ${
              selected.length > 0
                ? 'bg-mc-brand text-mc-on-brand shadow-lg shadow-amber-500/25'
                : 'bg-mc-surface-2 text-mc-text-3 cursor-not-allowed'
            }
          `}
        >
          {t('deliveryRequest.steps.flight.continueButton')}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
    );
  }
);

// ============================================
// STEP 3A — Standard Confirmation (Yandex/Mandarin/BTS)
// ============================================

// Native Telegram confirm dialog when available, else the browser confirm.
function askConfirm(message: string): Promise<boolean> {
  const tg = (
    window as unknown as {
      Telegram?: {
        WebApp?: { showConfirm?: (m: string, cb: (ok: boolean) => void) => void };
      };
    }
  ).Telegram?.WebApp;
  if (tg?.showConfirm) {
    return new Promise<boolean>((resolve) => tg.showConfirm!(message, (ok) => resolve(ok)));
  }
  return Promise.resolve(window.confirm(message));
}


interface StepStandardProps {
  deliveryType: DeliveryType;
  selectedFlights: string[];
  submitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
  phoneNumber: string;
  onPhoneChange: (value: string) => void;
  caption: string;
  onCaptionChange: (value: string) => void;
  mapLocation: { latitude: number; longitude: number } | null;
  onMapConfirm: (location: { latitude: number; longitude: number }) => void;
  onMapClear: () => void;
  includeAddress: boolean;
  onIncludeAddressChange: (value: boolean) => void;
}

const StepStandardConfirm = memo(
  ({
    deliveryType,
    selectedFlights,
    submitting,
    onSubmit,
    onBack,
    phoneNumber,
    onPhoneChange,
    caption,
    onCaptionChange,
    mapLocation,
    onMapConfirm,
    onMapClear,
    includeAddress,
    onIncludeAddressChange,
  }: StepStandardProps) => {
    const { t } = useTranslation();
    const typeLabel = DELIVERY_OPTIONS.find((o) => o.id === deliveryType)?.label ?? deliveryType;
    const canSubmit = caption.trim().length > 0 && !submitting;

    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-400">
        <h2 className="text-2xl font-extrabold mb-1">{t('deliveryRequest.steps.confirm.title')}</h2>
        <p className="text-mc-text-2 text-sm mb-6">
          {t('deliveryRequest.steps.confirm.subtitle')}
        </p>

        {/* Phone Number */}
        <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-4 mb-4 backdrop-blur-md">
          <label className="flex items-center gap-2 text-xs font-bold text-mc-text-2 mb-2">
            <Phone className="w-3.5 h-3.5" />
            {t('deliveryRequest.steps.confirm.phoneLabel')}
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder={t('deliveryRequest.steps.confirm.phonePlaceholder')}
            className="w-full rounded-mc-md border border-mc-border bg-mc-surface-2 dark:bg-white/[0.04] px-4 py-3 text-sm font-semibold text-mc-text dark:text-mc-text outline-none focus:border-mc-brand focus:ring-1 focus:ring-mc-brand transition"
          />
          <p className="mt-1.5 text-[11px] text-mc-text-3">
            {t('deliveryRequest.steps.confirm.phoneHint')}
          </p>
        </div>

        {/* Optional: include the client's residential address in the admin note.
            Off by default so home addresses aren't shared unless the user wants. */}
        <button
          type="button"
          onClick={() => onIncludeAddressChange(!includeAddress)}
          className="w-full flex items-center justify-between gap-3 rounded-mc-lg bg-mc-surface border border-mc-border p-4 mb-4 backdrop-blur-md text-left"
        >
          <span className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-mc-brand shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-mc-text dark:text-mc-text">
                {t('deliveryRequest.steps.confirm.includeAddressLabel')}
              </span>
              <span className="block text-[11px] text-mc-text-3">
                {t('deliveryRequest.steps.confirm.includeAddressHint')}
              </span>
            </span>
          </span>
          <span
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
              includeAddress ? 'bg-mc-brand' : 'bg-mc-surface-2 dark:bg-white/20'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                includeAddress ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </span>
        </button>

        {/* Caption / Courier Note */}
        <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-4 mb-4 backdrop-blur-md">
          <label className="flex items-center gap-2 text-xs font-bold text-mc-text-2 mb-2">
            <MapPin className="w-3.5 h-3.5" />
            {t('deliveryRequest.steps.confirm.captionLabel')}
          </label>
          <textarea
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            placeholder={t('deliveryRequest.steps.confirm.captionPlaceholder')}
            rows={4}
            className="w-full rounded-mc-md border border-mc-border bg-mc-surface-2 dark:bg-white/[0.04] px-4 py-3 text-sm font-semibold text-mc-text dark:text-mc-text outline-none focus:border-mc-brand focus:ring-1 focus:ring-mc-brand transition resize-none"
          />
          <p className="mt-1.5 text-[11px] text-mc-text-3">
            {t('deliveryRequest.steps.confirm.captionHint')}
          </p>
        </div>

        {/* Map Picker — lazy loaded */}
        <div className="mb-4">
          <p className="text-xs font-bold text-mc-text-2 mb-2">
            {t('deliveryRequest.steps.confirm.mapLabel')}
          </p>
          <DeliveryMapPickerLazy
            initialLocation={null}
            confirmedLocation={mapLocation}
            onConfirm={onMapConfirm}
            onClear={onMapClear}
          />
        </div>

        {/* Summary Card */}
        <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-5 mb-4 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-mc-lg bg-mc-warn-soft flex items-center justify-center text-mc-warn">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-mc-text-2">{t('deliveryRequest.steps.confirm.deliveryType')}</p>
              <h3 className="font-bold text-lg">{typeLabel}</h3>
            </div>
          </div>

          <div className="border-t border-mc-border pt-4">
            <p className="text-xs text-mc-text-2 mb-2 font-medium">
              {t('deliveryRequest.steps.confirm.selectedFlights')}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedFlights.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-mc-md bg-mc-brand-soft dark:bg-mc-brand/10 text-mc-brand text-sm font-semibold"
                >
                  <Plane className="w-3.5 h-3.5" />
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="rounded-mc-lg bg-mc-warn-soft dark:bg-mc-brand/5 border border-mc-warn/25 p-4 mb-6">
          <p className="text-sm text-mc-warn font-medium">
            <Trans
              i18nKey="deliveryRequest.steps.confirm.infoMessage"
              values={{ type: typeLabel, flights: selectedFlights.join(', ') }}
              components={{ strong: <strong /> }}
            />
          </p>
        </div>

        {/* Bottom Actions */}
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="
              flex-shrink-0 w-14 h-14 rounded-mc-lg flex items-center justify-center
              bg-mc-surface-2 text-mc-text-2
              active:scale-95 transition-transform
            "
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className={`
              flex-1 h-14 rounded-mc-lg font-bold text-base
              flex items-center justify-center gap-2
              transition-all duration-200 active:scale-[0.98]
              ${
                canSubmit
                  ? 'bg-mc-success text-mc-on-success shadow-lg shadow-emerald-500/25'
                  : 'bg-mc-surface-2 dark:bg-white/10 text-mc-text-2 cursor-not-allowed'
              }
            `}
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {t('deliveryRequest.steps.confirm.submitButton')}
                <Check className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }
);

// ============================================
// STEP 3B — UzPost Calculation & Payment
// ============================================

interface StepUzpostProps {
  calcData: CalculateUzpostResponse | null;
  loading: boolean;
  selectedFlights: string[];
  submitting: boolean;
  branches: UzpostBranch[];
  branchesLoading: boolean;
  branchesError: boolean;
  selectedBranch: UzpostBranch | null;
  suggestedBranch: UzpostBranch | null;
  onBranchSelect: (branch: UzpostBranch) => void;
  onBranchesRetry: () => void;
  onSubmit: (walletUsed: number, file: File | null, phoneNumber: string) => void;
  onBack: () => void;
  phoneNumber: string;
  onPhoneChange: (value: string) => void;
  nbuEnabled: boolean;
  savedCards: SavedCardItem[];
  onPayOnline: (walletUsed: number, phoneNumber: string) => void;
  onChargeCard: (cardId: number, walletUsed: number, phoneNumber: string) => void;
}

function StepUzpostPayment({
  calcData,
  loading,
  selectedFlights,
  submitting,
  branches,
  branchesLoading,
  branchesError,
  selectedBranch,
  suggestedBranch,
  onBranchSelect,
  onBranchesRetry,
  onSubmit,
  onBack,
  phoneNumber,
  onPhoneChange,
  nbuEnabled,
  savedCards,
  onPayOnline,
  onChargeCard,
}: StepUzpostProps) {
  const { t, i18n } = useTranslation();
  const [useWallet, setUseWallet] = useState(false);
  // 'online' = NBU card payment, 'manual' = bank-transfer receipt upload.
  const [payMethod, setPayMethod] = useState<'online' | 'manual'>('online');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [receiptProcessing, setReceiptProcessing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturingReceipt, setIsCapturingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const walletApplied = useWallet && calcData ? Math.min(calcData.wallet_balance, calcData.total_amount) : 0;
  const remaining = calcData ? Math.max(calcData.total_amount - walletApplied, 0) : 0;
  const numberLocale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const formatUzs = useCallback(
    (value: number) => `${value.toLocaleString(numberLocale)} ${t('deliveryRequest.steps.uzpost.currencyUzs')}`,
    [numberLocale, t],
  );

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const processReceiptFile = useCallback(async (file: File) => {
    setReceiptProcessing(true);
    try {
      const preparedFile = await compressReceiptImage(file);
      setReceiptFile(preparedFile);
      setPreview((currentPreview) => {
        if (currentPreview) {
          URL.revokeObjectURL(currentPreview);
        }

        return preparedFile.type.startsWith('image/')
          ? URL.createObjectURL(preparedFile)
          : null;
      });
    } catch {
      setReceiptFile(file);
      setPreview((currentPreview) => {
        if (currentPreview) {
          URL.revokeObjectURL(currentPreview);
        }

        return file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      });
    } finally {
      setReceiptProcessing(false);
    }
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    await processReceiptFile(file);
  };

  const stopReceiptCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraReady(false);
  }, []);

  const closeReceiptCamera = useCallback(() => {
    stopReceiptCamera();
    setIsCameraOpen(false);
    setIsCapturingReceipt(false);
  }, [stopReceiptCamera]);

  const openReceiptCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        window.Telegram?.WebApp?.showAlert?.("Kamera bu brauzerda qo'llab-quvvatlanmaydi.");
        return;
      }

      stopReceiptCamera();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      }

      streamRef.current = stream;
      setIsCameraOpen(true);

      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;

        video.srcObject = streamRef.current;
        void video.play();

        let pollAttempts = 0;
        const pollVideoReady = () => {
          pollAttempts += 1;

          if (!video || !streamRef.current) return;

          if (video.videoWidth > 0 && video.videoHeight > 0) {
            setIsCameraReady(true);
            return;
          }

          if (pollAttempts >= 120) {
            window.Telegram?.WebApp?.showAlert?.("Kamera tayyorlanmadi. Qaytadan urinib ko'ring.");
            closeReceiptCamera();
            return;
          }

          requestAnimationFrame(pollVideoReady);
        };

        pollVideoReady();
      });
    } catch {
      window.Telegram?.WebApp?.showAlert?.("Kameraga ruxsat berilmadi. Telegram sozlamalarida kamera ruxsatini yoqing.");
      stopReceiptCamera();
      setIsCameraOpen(false);
    }
  }, [closeReceiptCamera, stopReceiptCamera]);

  const captureReceiptPhoto = useCallback(() => {
    if (isCapturingReceipt) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isCameraReady || video.videoWidth === 0 || video.videoHeight === 0) {
      window.Telegram?.WebApp?.showAlert?.("Kamera hali tayyor emas. Bir oz kuting va qayta urinib ko'ring.");
      return;
    }

    setIsCapturingReceipt(true);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      setIsCapturingReceipt(false);
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setIsCapturingReceipt(false);
          return;
        }

        const file = new File([blob], `uzpost-receipt-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        void processReceiptFile(file).finally(() => {
          closeReceiptCamera();
          setIsCapturingReceipt(false);
        });
      },
      'image/jpeg',
      0.9
    );
  }, [closeReceiptCamera, isCameraReady, isCapturingReceipt, processReceiptFile]);

  useEffect(() => {
    return () => {
      stopReceiptCamera();
    };
  }, [stopReceiptCamera]);

  const clearFile = () => {
    setReceiptFile(null);
    setPreview((currentPreview) => {
      if (currentPreview) {
        URL.revokeObjectURL(currentPreview);
      }
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('deliveryRequest.toast.copied'));
  };

  if (loading) {
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-400">
        <h2 className="text-2xl font-extrabold mb-1">{t('deliveryRequest.steps.uzpost.calcTitle')}</h2>
        <p className="text-mc-text-2 text-sm mb-6">{t('deliveryRequest.steps.uzpost.calcDesc')}</p>
        <CalcSkeleton />
      </div>
    );
  }

  // Weight warning screen
  if (calcData?.warning) {
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-400">
        <h2 className="text-2xl font-extrabold mb-4">{t('deliveryRequest.steps.uzpost.warningTitle')}</h2>

        <div className="rounded-mc-lg bg-mc-danger-soft border-2 border-mc-danger/25 dark:border-mc-danger/30 p-6 text-center mb-6">
          <AlertTriangle className="w-16 h-16 mx-auto text-mc-danger mb-4" />
          <p className="text-mc-danger font-bold text-lg mb-2">
            {t('deliveryRequest.steps.uzpost.weightExceeded')}
          </p>
          <p className="text-mc-danger text-sm">{calcData.warning}</p>
        </div>

        <button
          onClick={onBack}
          className="
            w-full h-14 rounded-mc-lg font-bold text-base
            flex items-center justify-center gap-2
            bg-mc-surface-2 text-mc-text
            active:scale-[0.98] transition-all
          "
        >
          <ArrowLeft className="w-5 h-5" />
          {t('deliveryRequest.steps.uzpost.backButton')}
        </button>
      </div>
    );
  }

  const fullyCoveredByWallet = remaining <= 0;
  // Online (NBU) payment is offered only when money actually needs collecting and
  // the gateway is enabled. When the wallet fully covers the fee, we fall back to
  // the manual submit (no card charge needed).
  const onlineAvailable = nbuEnabled && !fullyCoveredByWallet;
  const onlineMode = onlineAvailable && payMethod === 'online';
  const cameraOverlay =
    isCameraOpen && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[2147483647] isolate flex flex-col bg-black">
            <div className="relative flex-1">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {!isCameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                  <div className="text-center">
                    <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-white" />
                    <p className="text-sm font-semibold text-white">{t('camera.preparingCamera')}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-4 bg-gradient-to-t from-black via-black/90 to-transparent p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={closeReceiptCamera}
                disabled={isCapturingReceipt}
                className="h-12 rounded-mc-lg border border-white/30 bg-white/10 px-5 font-bold text-white backdrop-blur-sm active:scale-95 disabled:opacity-60"
              >
                {t('camera.cancel')}
              </button>
              <button
                type="button"
                onClick={captureReceiptPhoto}
                disabled={isCapturingReceipt || !isCameraReady}
                className="flex h-12 items-center justify-center gap-2 rounded-mc-lg bg-mc-brand px-6 font-bold text-mc-on-brand shadow-lg shadow-amber-500/30 active:scale-95 disabled:opacity-60"
              >
                {isCapturingReceipt ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
                {isCapturingReceipt ? t('cargo.saving') : t('camera.takePhoto')}
              </button>
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </div>,
          document.body
        )
      : null;

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-400">
      {cameraOverlay}

      <h2 className="text-2xl font-extrabold mb-1">{t('deliveryRequest.steps.uzpost.paymentTitle')}</h2>
      <p className="text-mc-text-2 text-sm mb-4">
        {t('deliveryRequest.steps.uzpost.flightsFor', { flights: selectedFlights.join(', ') })}
      </p>

      {/* Optional phone number */}
      <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-4 mb-4 backdrop-blur-md">
        <label className="flex items-center gap-2 text-xs font-bold text-mc-text-2 mb-2">
          <Phone className="w-3.5 h-3.5" />
          {t('deliveryRequest.steps.confirm.phoneLabel')}
        </label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder={t('deliveryRequest.steps.confirm.phonePlaceholder')}
          className="w-full rounded-mc-md border border-mc-border bg-mc-surface-2 dark:bg-white/[0.04] px-4 py-3 text-sm font-semibold text-mc-text dark:text-mc-text outline-none focus:border-mc-brand focus:ring-1 focus:ring-mc-brand transition"
        />
        <p className="mt-1.5 text-[11px] text-mc-text-3">
          {t('deliveryRequest.steps.uzpost.phoneHint')}
        </p>
      </div>

      <div className="mb-6">
        <Suspense
          fallback={
            <div className="space-y-3">
              <div className="h-12 rounded-mc-lg bg-mc-surface-2 dark:bg-white/5 animate-pulse" />
              <div className="h-64 rounded-mc-lg bg-mc-surface-2 dark:bg-white/5 animate-pulse" />
            </div>
          }
        >
          <UzpostBranchPicker
            branches={branches}
            selectedBranch={selectedBranch}
            suggestedBranch={suggestedBranch}
            isLoading={branchesLoading}
            isError={branchesError}
            onSelect={onBranchSelect}
            onRetry={onBranchesRetry}
          />
        </Suspense>
      </div>

      {/* Summary Grid — shown only after branch selected and calc completed */}
      {calcData && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-4 backdrop-blur-md">
            <p className="text-xs text-mc-text-2 mb-1">{t('deliveryRequest.steps.uzpost.totalWeight')}</p>
            <p className="text-xl font-extrabold">{calcData.total_weight} kg</p>
          </div>
          <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-4 backdrop-blur-md">
            <p className="text-xs text-mc-text-2 mb-1">{t('deliveryRequest.steps.uzpost.totalAmount')}</p>
            <p className="text-xl font-extrabold text-mc-warn">
              {calcData.total_amount.toLocaleString()} so'm
            </p>
          </div>
        </div>
      )}

      {/* Offline estimate notice — UzPost pricing API was unreachable. */}
      {calcData?.fallback && (
        <div className="flex items-start gap-2 rounded-mc-lg bg-mc-warn-soft border border-mc-warn/25 dark:border-mc-brand/30 p-3 mb-4">
          <AlertTriangle className="w-4 h-4 text-mc-brand shrink-0 mt-0.5" />
          <p className="text-mc-warn text-xs">
            {t('deliveryRequest.steps.uzpost.estimateNote')}
          </p>
        </div>
      )}

      {/* Wallet Toggle — shown only after calc completed */}
      {calcData && (
        <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-4 mb-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-mc-md bg-mc-brand-soft flex items-center justify-center text-mc-brand">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">{t('deliveryRequest.steps.uzpost.walletPay')}</p>
                <p className="text-xs text-mc-text-2">
                  {t('deliveryRequest.steps.uzpost.walletBalance', { balance: calcData.wallet_balance.toLocaleString() })}
                </p>
              </div>
            </div>

            {/* Toggle */}
            <button
              onClick={() => setUseWallet(!useWallet)}
              className={`
                relative w-14 h-8 rounded-full transition-colors duration-300
                ${useWallet ? 'bg-mc-brand' : 'bg-mc-surface-2 dark:bg-white/15'}
              `}
            >
              <div
                className={`
                  absolute top-1 w-6 h-6 rounded-full bg-white shadow-md
                  transition-transform duration-300
                  ${useWallet ? 'translate-x-7' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          {useWallet && (
            <div className="mt-3 pt-3 border-t border-mc-border space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-mc-text-2">{t('deliveryRequest.steps.uzpost.fromWallet')}</span>
                <span className="font-bold text-mc-success">
                  -{formatUzs(walletApplied)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-mc-text-2">{t('deliveryRequest.steps.uzpost.remainingPayment')}</span>
                <span className="font-extrabold text-lg">
                  {formatUzs(remaining)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment method toggle — only when there is money to collect online */}
      {onlineAvailable && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setPayMethod('online')}
            className={`h-12 rounded-mc-lg text-sm font-bold flex items-center justify-center gap-2 transition active:scale-[0.98] ${
              payMethod === 'online'
                ? 'bg-mc-success text-mc-on-success shadow-lg shadow-emerald-500/25'
                : 'bg-mc-surface-2 text-mc-text-2'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            {t('deliveryRequest.steps.uzpost.onlinePayment')}
          </button>
          <button
            type="button"
            onClick={() => setPayMethod('manual')}
            className={`h-12 rounded-mc-lg text-sm font-bold flex items-center justify-center gap-2 transition active:scale-[0.98] ${
              payMethod === 'manual'
                ? 'bg-mc-brand text-mc-on-brand shadow-lg shadow-amber-500/25'
                : 'bg-mc-surface-2 text-mc-text-2'
            }`}
          >
            <Upload className="w-4 h-4" />
            {t('deliveryRequest.steps.uzpost.receiptUploadTab')}
          </button>
        </div>
      )}

      {/* Online (NBU) payment panel */}
      {onlineMode && (
        <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-mc-text-2">
              {t('deliveryRequest.steps.uzpost.remainingPayment')}
            </span>
            <span className="font-extrabold text-lg">{formatUzs(remaining)}</span>
          </div>

          {savedCards.length > 0 && (
            <div className="space-y-2 mb-3">
              <p className="text-xs text-mc-text-2 font-medium">
                {t('deliveryRequest.steps.uzpost.savedCards')}
              </p>
              {savedCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => onChargeCard(card.id, walletApplied, phoneNumber)}
                  className="w-full h-12 rounded-mc-lg bg-mc-surface-2 border border-mc-border flex items-center justify-between px-4 text-sm font-semibold active:scale-[0.98] transition disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-mc-success" />
                    {card.card_masked || card.nickname || t('deliveryRequest.steps.uzpost.cardFallback')}
                  </span>
                  <span className="text-mc-success">
                    {t('deliveryRequest.steps.uzpost.payButton')}
                  </span>
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-mc-text-3">
            {t('deliveryRequest.steps.uzpost.nbuPaymentDescription')}
          </p>
        </div>
      )}

      {/* Card Info (manual transfer only) */}
      {!onlineMode && calcData && !fullyCoveredByWallet && calcData.card && (
        <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-4 mb-4 backdrop-blur-md">
          <p className="text-xs text-mc-text-2 mb-2 font-medium">
            {t('deliveryRequest.steps.uzpost.paymentCard')}
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono font-bold text-lg tracking-wider">
                {calcData.card.card_number}
              </p>
              <p className="text-xs text-mc-text-2">
                {calcData.card.card_owner}
              </p>
            </div>
            <button
              onClick={() => handleCopy(calcData.card!.card_number)}
              className="
                w-11 h-11 rounded-mc-md flex items-center justify-center
                bg-mc-warn-soft text-mc-warn
                active:scale-90 transition-transform
              "
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* File Upload (manual transfer only, when payment remains) */}
      {!onlineMode && !fullyCoveredByWallet && (
        <div className="mb-6">
          <p className="text-xs text-mc-text-2 mb-2 font-medium">
            {t('deliveryRequest.steps.uzpost.uploadReceipt')}
          </p>

          {receiptFile ? (
            <div className="rounded-mc-lg bg-mc-surface border-2 border-dashed border-mc-success dark:border-mc-success/40 p-4">
              {preview ? (
                <div className="relative mb-3">
                  <img
                    src={preview}
                    alt="Receipt preview"
                    className="w-full max-h-48 object-contain rounded-mc-md"
                  />
                  <button
                    onClick={clearFile}
                    aria-label={t('deliveryRequest.clearFile', "Faylni o'chirish")}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-mc-danger-fill text-mc-on-danger flex items-center justify-center active:scale-90 transition-transform shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-mc-success" />
                    <div>
                      <p className="font-semibold text-sm truncate max-w-[200px]">
                        {receiptFile.name}
                      </p>
                      <p className="text-xs text-mc-text-3">
                        {(receiptFile.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={clearFile}
                    aria-label={t('deliveryRequest.clearFile', "Faylni o'chirish")}
                    className="w-8 h-8 rounded-full bg-mc-danger-soft text-mc-danger flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : receiptProcessing ? (
            <div className="w-full rounded-mc-lg border-2 border-dashed border-mc-warn/30 bg-mc-warn-soft dark:bg-mc-brand/[0.06] p-8 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-mc-brand" />
              <p className="font-bold text-sm text-mc-warn">
                {t('deliveryRequest.steps.uzpost.compressingReceipt')}
              </p>
            </div>
          ) : (
            <div
              className="
                w-full rounded-mc-lg border-2 border-dashed
                border-mc-border dark:border-white/15
                bg-mc-surface-2
                p-5 flex flex-col gap-3
              "
            >
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-mc-lg bg-mc-warn-soft flex items-center justify-center text-mc-brand mb-3">
                  <Upload className="w-7 h-7" />
                </div>
                <p className="font-bold text-sm text-mc-text">
                  {t('deliveryRequest.steps.uzpost.uploadButton')}
                </p>
                <p className="text-xs text-mc-text-3 mt-0.5">
                  {t('deliveryRequest.steps.uzpost.uploadHint')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-12 rounded-mc-lg bg-white dark:bg-white/10 border border-mc-border text-sm font-bold text-mc-text flex items-center justify-center gap-2 active:scale-[0.98] transition"
                >
                  <Upload className="w-4 h-4 text-mc-brand" />
                  {t('deliveryRequest.steps.uzpost.uploadGalleryButton')}
                </button>
                <button
                  type="button"
                  onClick={openReceiptCamera}
                  className="h-12 rounded-mc-lg bg-mc-brand text-mc-on-brand text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-lg shadow-amber-500/20"
                >
                  <Camera className="w-4 h-4" />
                  {t('deliveryRequest.steps.uzpost.uploadCameraButton')}
                </button>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          aria-label={t('common.back', 'Ortga')}
          className="
            flex-shrink-0 w-14 h-14 rounded-mc-lg flex items-center justify-center
            bg-mc-surface-2 text-mc-text-2
            active:scale-95 transition-transform
          "
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {onlineMode ? (
          <button
            onClick={() => onPayOnline(walletApplied, phoneNumber)}
            disabled={submitting || !selectedBranch || !calcData}
            className={`
              flex-1 h-14 rounded-mc-lg font-bold text-base
              flex items-center justify-center gap-2
              transition-all duration-200 active:scale-[0.98]
              ${
                submitting || !selectedBranch || !calcData
                  ? 'bg-mc-surface-2 text-mc-text-2 cursor-not-allowed'
                  : 'bg-mc-success text-mc-on-success shadow-lg shadow-emerald-500/25'
              }
            `}
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {t('deliveryRequest.steps.uzpost.payAmountButton', { amount: formatUzs(remaining) })}
                <CreditCard className="w-5 h-5" />
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => onSubmit(walletApplied, receiptFile, phoneNumber)}
            disabled={submitting || receiptProcessing || !selectedBranch || !calcData || (!fullyCoveredByWallet && !receiptFile)}
            className={`
              flex-1 h-14 rounded-mc-lg font-bold text-base
              flex items-center justify-center gap-2
              transition-all duration-200 active:scale-[0.98]
              ${
                submitting || receiptProcessing || !selectedBranch || !calcData || (!fullyCoveredByWallet && !receiptFile)
                  ? 'bg-mc-surface-2 text-mc-text-2 cursor-not-allowed'
                  : 'bg-mc-success text-mc-on-success shadow-lg shadow-emerald-500/25'
              }
            `}
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {t('deliveryRequest.steps.uzpost.submitButton')}
                <Check className="w-5 h-5" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// STEP 4 — Success
// ============================================

const StepSuccess = memo(({ onGoHome }: { onGoHome: () => void }) => {
  const { t } = useTranslation();
  return (
  <div className="animate-in fade-in zoom-in-95 duration-500 text-center py-8">
    <div className="w-24 h-24 mx-auto rounded-full bg-mc-success/12 flex items-center justify-center mb-6">
      <CheckCircle2 className="w-14 h-14 text-mc-success" />
    </div>
    <h2 className="text-2xl font-extrabold mb-2">{t('deliveryRequest.steps.success.title')}</h2>
    <p className="text-mc-text-2 text-sm max-w-xs mx-auto mb-8">
      {t('deliveryRequest.steps.success.desc')}
    </p>

    <button
      onClick={onGoHome}
      className="
        w-full max-w-xs mx-auto h-14 rounded-mc-lg font-bold text-base text-mc-on-brand
        flex items-center justify-center gap-2
        bg-mc-brand active:scale-[0.98]
        shadow-lg shadow-amber-500/25 transition-all duration-200
      "
    >
      {t('deliveryRequest.steps.success.homeButton')}
    </button>
  </div>
  );
});

// ============================================
// PROFILE INCOMPLETE ALERT
// ============================================

const ProfileIncompleteAlert = memo(
  ({ onGoProfile, onBack, missingFields }: { onGoProfile?: () => void; onBack: () => void; missingFields: string[] }) => {
    const { t } = useTranslation();
    return (
    <div className="animate-in fade-in zoom-in-95 duration-400 text-center py-8">
      <div className="w-20 h-20 mx-auto rounded-full bg-mc-danger-soft flex items-center justify-center mb-5">
        <UserCog className="w-10 h-10 text-mc-danger" />
      </div>
      <h2 className="text-xl font-extrabold mb-2">{t('deliveryRequest.profile.title')}</h2>
      <p className="text-mc-text-2 text-sm max-w-xs mx-auto mb-2">
        {t('deliveryRequest.profile.desc')}
      </p>

      {missingFields.length > 0 && (
        <div className="max-w-xs mx-auto mb-6">
          <div className="rounded-mc-md bg-mc-danger-soft border border-mc-danger/25 p-3 text-left">
            <p className="text-xs font-bold text-mc-danger dark:text-mc-danger mb-1.5">
              Quyidagi maydonlar to'ldirilmagan:
            </p>
            <ul className="space-y-1">
              {missingFields.map((field) => (
                <li key={field} className="flex items-center gap-1.5 text-xs text-mc-danger dark:text-mc-danger">
                  <span className="w-1.5 h-1.5 rounded-full bg-mc-danger shrink-0" />
                  {field}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="space-y-3 max-w-xs mx-auto">
        {onGoProfile && (
          <button
            onClick={onGoProfile}
            className="
              w-full h-14 rounded-mc-lg font-bold text-base text-mc-on-brand
              flex items-center justify-center gap-2
              bg-mc-brand active:scale-[0.98]
              shadow-lg shadow-blue-500/25 transition-all duration-200
            "
          >
            <UserCog className="w-5 h-5" />
            {t('deliveryRequest.profile.fillButton')}
          </button>
        )}
        <button
          onClick={onBack}
          className="
            w-full h-14 rounded-mc-lg font-bold text-base
            flex items-center justify-center gap-2
            bg-mc-surface-2 text-mc-text
            active:scale-[0.98] transition-all
          "
        >
          <ArrowLeft className="w-5 h-5" />
          {t('deliveryRequest.steps.uzpost.backButton')}
        </button>
      </div>
    </div>
    );
  }
);

// ============================================
// MAIN COMPONENT
// ============================================

export default function DeliveryRequestPage({ onBack, onNavigateToHistory, onGoToPayment }: Props) {
  const { t } = useTranslation();
  const { data: userProfile, isLoading: profileLoading, refetch: refetchProfile } = useProfile();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [deliveryType, setDeliveryType] = useState<DeliveryType | null>(null);
  const [selectedFlights, setSelectedFlights] = useState<string[]>([]);
  const [selectedUzpostBranch, setSelectedUzpostBranch] = useState<UzpostBranch | null>(null);
  const [savedUzpostBranchId, setSavedUzpostBranchId] = useState<number | null>(() =>
    getSavedUzpostBranchId()
  );
  const uzpostBranchesQuery = useUzpostBranches(deliveryType === 'uzpost');

  // Standard delivery form state
  const [standardPhone, setStandardPhone] = useState('');
  const [standardCaption, setStandardCaption] = useState('');
  const [standardMapLocation, setStandardMapLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [includeAddress, setIncludeAddress] = useState(false);

  // UzPost phone state
  const [uzpostPhone, setUzpostPhone] = useState('');

  // NBU online payment (UzPost delivery fee) — feature flag + saved cards
  const [nbuEnabled, setNbuEnabled] = useState(false);
  const [savedCards, setSavedCards] = useState<SavedCardItem[]>([]);
  useEffect(() => {
    let active = true;
    nbuPaymentService
      .getStatus()
      .then((s) => {
        if (active) setNbuEnabled(Boolean(s.enabled));
      })
      .catch(() => {});
    nbuPaymentService
      .listCards()
      .then((r) => {
        if (active) setSavedCards(r.items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // API state
  const [flights, setFlights] = useState<FlightItem[]>([]);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [calcData, setCalcData] = useState<CalculateUzpostResponse | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Recalculate UzPost price when branch is selected (step 3)
  useEffect(() => {
    if (
      deliveryType === 'uzpost' &&
      currentStep === 3 &&
      selectedUzpostBranch &&
      selectedFlights.length > 0
    ) {
      setCalcLoading(true);
      calculateUzpost(selectedFlights, selectedUzpostBranch.id)
        .then((res) => {
          setCalcData(res);
          // UzPost pricing API was down → backend returned an offline estimate.
          // Keep the price (non-blocking) but tell the user it's approximate.
          if (res.fallback) {
            toast.warning(t('deliveryRequest.toast.calcFallback'));
          }
        })
        .catch((err: unknown) => {
          const e = err as { message?: string };
          toast.error(e?.message || t('deliveryRequest.toast.calcError'));
        })
        .finally(() => setCalcLoading(false));
    }
  }, [deliveryType, currentStep, selectedUzpostBranch, selectedFlights, t]);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  const totalSteps = deliveryType === 'uzpost' ? 4 : 4;

  // Profile validation matching backend logic
  const standardProfileMissingFields = useMemo(() => {
    if (profileLoading || !userProfile) return [];
    const missing: string[] = [];
    if (!userProfile.full_name?.trim()) missing.push('Ism');
    if (!userProfile.phone?.trim()) missing.push('Telefon');
    if (!userProfile.region?.trim()) missing.push('Viloyat');
    if (!userProfile.address?.trim()) missing.push('Manzil');
    return missing;
  }, [profileLoading, userProfile]);

  const uzpostProfileMissingFields = useMemo(() => {
    if (profileLoading || !userProfile) return [];
    const missing: string[] = [];
    if (!userProfile.full_name?.trim()) missing.push('Ism');
    return missing;
  }, [profileLoading, userProfile]);

  const isStandardProfileIncomplete = standardProfileMissingFields.length > 0;
  const isUzpostProfileIncomplete = uzpostProfileMissingFields.length > 0;
  const suggestedUzpostBranch = useMemo(() => {
    if (!savedUzpostBranchId) {
      return null;
    }

    return uzpostBranchesQuery.data?.find((branch) => branch.id === savedUzpostBranchId) ?? null;
  }, [savedUzpostBranchId, uzpostBranchesQuery.data]);

  useEffect(() => {
    if (!savedUzpostBranchId || !uzpostBranchesQuery.data) {
      return;
    }

    const savedBranchStillExists = uzpostBranchesQuery.data.some(
      (branch) => branch.id === savedUzpostBranchId
    );

    if (!savedBranchStillExists) {
      clearSavedUzpostBranchPreference();
      setSavedUzpostBranchId(null);
    }
  }, [savedUzpostBranchId, uzpostBranchesQuery.data]);

  // ---- Actions ----

  const handleTypeSelect = useCallback(async (type: DeliveryType) => {
    setDeliveryType(type);
    setSelectedFlights([]);
    setSelectedUzpostBranch(null);
    setCalcData(null);
    setProfileIncomplete(false);
    setStandardPhone(userProfile?.phone ?? '');
    setStandardCaption('');
    setStandardMapLocation(null);
    setUzpostPhone(userProfile?.phone ?? '');
    setCurrentStep(2);

    // Try cache first
    const cached = useDeliveryStore.getState().getCachedFlights();
    if (cached) {
      setFlights(cached);
      return;
    }

    setFlightsLoading(true);
    try {
      const res = await getPaidFlights();
      setFlights(res.flights);
      useDeliveryStore.getState().setPaidFlights(res.flights);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message || t('deliveryRequest.toast.flightsError'));
      setFlights([]);
    } finally {
      setFlightsLoading(false);
    }
  }, [t, userProfile]);

  const toggleFlight = useCallback((name: string) => {
    setSelectedFlights((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }, []);

  const handleFlightContinue = useCallback(async () => {
    if (deliveryType === 'uzpost') {
      if (isUzpostProfileIncomplete) {
        setProfileIncomplete(true);
        return;
      }
      setCurrentStep(3);
    } else {
      if (isStandardProfileIncomplete) {
        setProfileIncomplete(true);
        return;
      }
      setCurrentStep(3);
    }
  }, [deliveryType, isStandardProfileIncomplete, isUzpostProfileIncomplete]);

  const handleStandardSubmit = useCallback(async () => {
    if (!deliveryType || deliveryType === 'uzpost') return;
    if (!standardCaption.trim()) {
      toast.error(t('deliveryRequest.toast.captionRequired'));
      return;
    }
    // When opting to share the home address, confirm the intent explicitly.
    if (includeAddress) {
      const ok = await askConfirm(t('deliveryRequest.confirmSendAddress'));
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      const phoneToSend = standardPhone.trim() || null;
      await submitStandardDelivery(
        deliveryType as 'yandex' | 'mandarin' | 'bts',
        selectedFlights,
        phoneToSend,
        standardCaption.trim(),
        // null, not 0. The map pin is optional here — canSubmit only requires
        // a caption — and 0,0 is a real point in the Gulf of Guinea that every
        // reader downstream turned into a route link for the courier.
        standardMapLocation?.latitude ?? null,
        standardMapLocation?.longitude ?? null,
        includeAddress
      );
      setCurrentStep(4);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string; data?: { detail?: string } };
      const status = e?.status;
      const message = e?.message || t('deliveryRequest.toast.submitError');
      
      if (status === 429 && e?.data?.detail) {
        toast.error(e.data.detail);
      } else if (status === 400 && message.toLowerCase().includes('profile')) {
        // Refetch profile to get latest data before showing incomplete screen
        void refetchProfile();
        setProfileIncomplete(true);
      } else {
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [deliveryType, selectedFlights, standardPhone, standardCaption, standardMapLocation, includeAddress, t, refetchProfile]);

  const handleUzpostSubmit = useCallback(
    async (walletUsed: number, file: File | null, phoneNumber: string) => {
      if (!selectedUzpostBranch) {
        toast.error('UzPost punktini tanlang');
        return;
      }

      setSubmitting(true);
      try {
        const phoneToSend = phoneNumber.trim() || null;
        await submitUzpostDelivery(selectedFlights, walletUsed, file, selectedUzpostBranch, phoneToSend);
        saveUzpostBranchPreference(selectedUzpostBranch);
        setSavedUzpostBranchId(selectedUzpostBranch.id);
        setCurrentStep(4);
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string; data?: { detail?: string } };
        const status = e?.status;
        const message = e?.message || t('deliveryRequest.toast.submitError');

        if (status === 429 && e?.data?.detail) {
          toast.error(e.data.detail);
        } else if (status === 400 && message.toLowerCase().includes('profile')) {
          setProfileIncomplete(true);
        } else {
          toast.error(message);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [selectedFlights, selectedUzpostBranch, t]
  );

  // Shared error surfacing for UzPost online (NBU) payment calls. NBU 422 errors
  // carry an object detail ({message, code}); manual flow returns a string.
  const showUzpostApiError = useCallback(
    (err: unknown) => {
      const e = err as {
        status?: number;
        message?: string;
        data?: { detail?: string | { message?: string } };
      };
      const detail = e?.data?.detail;
      const detailText =
        typeof detail === 'string' ? detail : detail?.message || undefined;
      const message = e?.message || t('deliveryRequest.toast.submitError');
      const httpStatus = e?.status ?? 0;

      if (httpStatus === 400 && message.toLowerCase().includes('profile')) {
        setProfileIncomplete(true);
        return;
      }
      // Gateway / server / network problems: show a friendly localized message,
      // never the raw backend text (e.g. "NBU gateway is currently unavailable"
      // or "Request failed with status code 502") — the user must not see
      // server-error internals.
      if (httpStatus <= 0 || httpStatus >= 500) {
        toast.error(t('nbu.error.502'));
        return;
      }
      if (httpStatus === 429) {
        // Rate-limit reason from the backend is a localized (Uzbek) message
        // naming the flight + wait window; prefer it over the generic toast.
        toast.error(detailText || t('nbu.error.429'));
        return;
      }
      // 4xx: the backend detail is a localized (Uzbek) validation message.
      toast.error(detailText || message);
    },
    [t]
  );

  // Redirect-based NBU payment for the UzPost delivery fee.
  const handleUzpostPayOnline = useCallback(
    async (walletUsed: number, phoneNumber: string) => {
      if (!selectedUzpostBranch) {
        toast.error('UzPost punktini tanlang');
        return;
      }
      setSubmitting(true);
      try {
        const res = await nbuPaymentService.initDelivery({
          flight_names: selectedFlights,
          location_id: selectedUzpostBranch.id,
          phone_number: phoneNumber.trim() || null,
          wallet_used: walletUsed,
        });
        saveUzpostBranchPreference(selectedUzpostBranch);
        if (res.payment_url) {
          redirectToNbuUrl({
            orderId: res.order_id,
            kind: 'payment',
            paymentUrl: res.payment_url,
            flightName: selectedFlights[0],
            // After a zayafka payment, land on the delivery-history tab.
            homePath: '/user/home?tab=delivery_history',
          });
        } else {
          toast.error("To'lov havolasi olinmadi. Qayta urinib ko'ring.");
          setSubmitting(false);
        }
      } catch (err: unknown) {
        showUzpostApiError(err);
        setSubmitting(false);
      }
    },
    [selectedFlights, selectedUzpostBranch, showUzpostApiError]
  );

  // Synchronous saved-card charge for the UzPost delivery fee.
  const handleUzpostChargeCard = useCallback(
    async (cardId: number, walletUsed: number, phoneNumber: string) => {
      if (!selectedUzpostBranch) {
        toast.error('UzPost punktini tanlang');
        return;
      }
      setSubmitting(true);
      try {
        const res = await nbuPaymentService.chargeDelivery({
          card_id: cardId,
          flight_names: selectedFlights,
          location_id: selectedUzpostBranch.id,
          phone_number: phoneNumber.trim() || null,
          wallet_used: walletUsed,
        });
        if (res.status === 'SUCCESS') {
          saveUzpostBranchPreference(selectedUzpostBranch);
          setSavedUzpostBranchId(selectedUzpostBranch.id);
          toast.success("To'lov muvaffaqiyatli amalga oshirildi!");
          setCurrentStep(4);
        } else {
          toast.error(res.error || "To'lov amalga oshmadi. Boshqa usulni sinab ko'ring.");
        }
      } catch (err: unknown) {
        // Dead/failing saved-card token (NBU 3008/5000) → offer "unbind +
        // re-bind now" vs "pay later" instead of a dead-end error.
        if (isCardReauthError(err)) {
          void promptCardReauth(err);
          return;
        }
        showUzpostApiError(err);
      } finally {
        setSubmitting(false);
      }
    },
    [selectedFlights, selectedUzpostBranch, showUzpostApiError]
  );

  const goBackStep = useCallback(() => {
    setProfileIncomplete(false);
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    } else {
      onBack();
    }
  }, [currentStep, onBack]);

  // ---- Render ----

  // Profile incomplete overlay (from backend error during submission)
  if (profileIncomplete) {
    return (
      <div className="pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setProfileIncomplete(false)}
            className="w-10 h-10 rounded-mc-md flex items-center justify-center bg-mc-surface-2 active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">{t('deliveryRequest.headerTitleShort')}</h1>
        </div>
        <ProfileIncompleteAlert
          onGoProfile={() => setIsEditProfileOpen(true)}
          onBack={() => setProfileIncomplete(false)}
          missingFields={deliveryType === 'uzpost' ? uzpostProfileMissingFields : standardProfileMissingFields}
        />
        {userProfile && (
          <EditProfileModal
            isOpen={isEditProfileOpen}
            onClose={() => setIsEditProfileOpen(false)}
            user={userProfile}
          />
        )}
      </div>
    );
  }

  return (
    // The page had no shell of its own: no background, no width limit and no
    // horizontal padding, so its content ran to the screen edges while every
    // other client screen sat in a max-w-lg column.
    <div className="min-h-dvh bg-mc-bg">
      <div className="mx-auto max-w-lg px-4 pb-8 pt-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            onClick={currentStep === 1 ? onBack : goBackStep}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-sm
                       bg-mc-surface-2 text-mc-text transition-transform duration-150
                       active:scale-95"
            aria-label={t('deliveryRequest.back', 'Ortga')}
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <h1 className="min-w-0 truncate text-[16px] font-extrabold text-mc-text">
            {t('deliveryRequest.headerTitle')}
          </h1>
        </div>
        {onNavigateToHistory && (
          <button
            onClick={onNavigateToHistory}
            className="flex shrink-0 items-center gap-1.5 rounded-mc-sm bg-mc-surface-2
                       px-2.5 py-2 text-[12px] font-bold text-mc-text-2
                       transition-transform duration-150 active:scale-95"
          >
            <Clock className="h-3.5 w-3.5" />
            {t('deliveryRequest.historyButton')}
          </button>
        )}
      </div>

      {/* Step Progress */}
      {currentStep < 4 && <StepIndicator current={currentStep} total={totalSteps} />}

      {/* Steps */}
      {currentStep === 1 && <StepTypeSelection onSelect={handleTypeSelect} />}

      {currentStep === 2 && (
        <StepFlightSelection
          deliveryType={deliveryType}
          flights={flights}
          loading={flightsLoading}
          selected={selectedFlights}
          onToggle={toggleFlight}
          onContinue={handleFlightContinue}
          onBack={goBackStep}
          onGoToPayment={onGoToPayment}
        />
      )}

      {currentStep === 3 && deliveryType === 'uzpost' && (
        <StepUzpostPayment
          calcData={calcData}
          loading={calcLoading}
          selectedFlights={selectedFlights}
          submitting={submitting}
          branches={uzpostBranchesQuery.data ?? []}
          branchesLoading={uzpostBranchesQuery.isLoading}
          branchesError={uzpostBranchesQuery.isError}
          selectedBranch={selectedUzpostBranch}
          suggestedBranch={suggestedUzpostBranch}
          onBranchSelect={setSelectedUzpostBranch}
          onBranchesRetry={() => {
            void uzpostBranchesQuery.refetch();
          }}
          onSubmit={handleUzpostSubmit}
          onBack={goBackStep}
          phoneNumber={uzpostPhone}
          onPhoneChange={setUzpostPhone}
          nbuEnabled={nbuEnabled}
          savedCards={savedCards}
          onPayOnline={handleUzpostPayOnline}
          onChargeCard={handleUzpostChargeCard}
        />
      )}

      {currentStep === 3 && deliveryType && deliveryType !== 'uzpost' && (
        <StepStandardConfirm
          deliveryType={deliveryType}
          selectedFlights={selectedFlights}
          submitting={submitting}
          onSubmit={handleStandardSubmit}
          onBack={goBackStep}
          phoneNumber={standardPhone}
          onPhoneChange={setStandardPhone}
          caption={standardCaption}
          onCaptionChange={setStandardCaption}
          mapLocation={standardMapLocation}
          onMapConfirm={setStandardMapLocation}
          onMapClear={() => setStandardMapLocation(null)}
          includeAddress={includeAddress}
          onIncludeAddressChange={setIncludeAddress}
        />
      )}

      {currentStep === 4 && <StepSuccess onGoHome={onBack} />}

      {userProfile && (
        <EditProfileModal
          isOpen={isEditProfileOpen}
          onClose={() => setIsEditProfileOpen(false)}
          user={userProfile}
        />
      )}
    </div>
    </div>
  );
}
