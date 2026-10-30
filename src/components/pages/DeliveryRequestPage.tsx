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
  Landmark,
  ArrowRightLeft,
  Smartphone,
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
import { RecipientNameField } from '@/components/delivery/RecipientNameField';
import { useBackHandler } from '@/hooks/useBackHandler';
import { BackPriority } from '@/lib/backStack';
import { useUzpostBranches } from '@/hooks/useUzpostBranches';
import type { UzpostBranchPicker as UzpostBranchPickerComponent } from '@/components/delivery/UzpostBranchPicker';
import {
  useBtsBranches,
  readLastBtsBranchCode,
  rememberBtsBranchCode,
  type BtsBranch,
} from '@/hooks/useBtsBranches';
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
import { openNbuUrl } from '@/utils/nbuReturnContext';
import {
  openPaymeCheckout,
  paymeRefusal,
  paymeService,
  type PaymeOrder,
} from '@/api/services/paymeService';
import type { CardDeliveryIntentRequest } from '@/api/services/paymentService';
import { CardTransferPanel } from '@/components/payment/CardTransferPanel';
import { PaymePanel } from '@/components/payment/PaymePanel';
import { PayMethodList, SwitchRow, type PayOption } from '@/components/payment/PayMethodList';
import { formatMaskedCard } from '@/utils/cardMask';
import { useNbuSessionOpen } from '@/hooks/usePendingNbuOrders';
import { isCardReauthError, promptCardReauth } from '@/utils/nbuCardReauth';
import { isInCourierArea } from '@/lib/courierArea';
import { courierFeeKey, getCourierFee } from '@/api/services/courierService';
import { formatUzsAmount } from '@/lib/format';
import { useQuery } from '@tanstack/react-query';

// Cast back to the generic signature, which lazy() erases.
const UzpostBranchPicker = lazy(() =>
  import('@/components/delivery/UzpostBranchPicker').then((module) => ({
    default: module.UzpostBranchPicker,
  }))
) as unknown as typeof UzpostBranchPickerComponent;

// ============================================
// TYPES
// ============================================

type DeliveryType = 'uzpost' | 'yandex' | 'mandarin' | 'bts';

interface DeliveryOption {
  id: DeliveryType;
  label: string;
  descKey: string;
  icon: React.ReactNode;
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
    icon: <Mail className="w-6 h-6" />,
    iconBg: 'bg-mc-brand-soft text-mc-brand',
  },
  {
    id: 'yandex',
    label: 'Yandex',
    descKey: 'deliveryRequest.options.yandex',
    icon: <Zap className="w-6 h-6" />,
    iconBg: 'bg-mc-danger-soft text-mc-danger',
  },
  {
    id: 'mandarin',
    label: 'Mandarin Dostavka',
    descKey: 'deliveryRequest.options.mandarin',
    icon: <Package className="w-6 h-6" />,
    iconBg: 'bg-mc-success/12 text-mc-success',
  },
  {
    id: 'bts',
    label: 'BTS',
    descKey: 'deliveryRequest.options.bts',
    icon: <Truck className="w-6 h-6" />,
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
/** NBU's gateway minimum (`payments_nbu._MIN_AMOUNT_TIYIN`). */
const NBU_MIN_UZS = 1000;
/** Payme refuses a smaller fee (`payme_orders.MIN_AMOUNT`). */
const PAYME_MIN_UZS = 1000;

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
      <h2 className="text-[17px] font-extrabold mb-1">{t('deliveryRequest.steps.type.title')}</h2>
      <p className="text-mc-text-2 text-[13px] mb-4">
        {t('deliveryRequest.steps.type.subtitle')}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {DELIVERY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className="
              relative overflow-hidden rounded-mc-lg p-4 text-left
              bg-mc-surface border-2 border-transparent
              active:scale-[0.96] transition-all duration-200
              shadow-sm group
              backdrop-blur-md
            "
          >
            <div className="relative z-10">
              <div
                className={`
                  w-11 h-11 rounded-mc-md flex items-center justify-center mb-2.5
                  ${opt.iconBg}
                `}
              >
                {opt.icon}
              </div>
              <h3 className="font-bold text-[15px] leading-tight mb-0.5">{opt.label}</h3>
              <p className="text-[11px] text-mc-text-2">{t(opt.descKey)}</p>
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

/** The courier fee as the super-admin set it; nothing until it is known. */
function MandarinFeeNote() {
  const { t } = useTranslation();
  const { data: fee } = useQuery({
    queryKey: courierFeeKey,
    queryFn: getCourierFee,
    staleTime: 5 * 60_000,
  });
  if (fee === undefined) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-mc-success mb-4 font-medium tabular-nums">
      <Wallet className="w-4 h-4 text-mc-success inline-block mr-1" />
      {fee > 0
        ? t('deliveryRequest.steps.flight.mandarinNote', { amount: formatUzsAmount(fee) })
        : t('deliveryRequest.steps.flight.mandarinNoteFree')}
    </span>
  );
}

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
      <h2 className="text-[17px] font-extrabold mb-1">{t('deliveryRequest.steps.flight.title')}</h2>
      <p className="text-mc-text-2 text-[13px] mb-4">
        {t('deliveryRequest.steps.flight.subtitle')}
      </p>
      {deliveryType === 'mandarin' && <MandarinFeeNote />}
      {deliveryType === 'yandex' && (
        <span className="inline-flex items-center gap-1 text-[11px] text-mc-brand mb-4 font-medium">
          <Clock className="w-4 h-4 text-mc-brand dark:text-mc-brand inline-block mr-1" />
          {t('deliveryRequest.steps.flight.yandexNote')}
        </span>
      )}
      {deliveryType === 'bts' && (
        <span className="inline-flex items-center gap-1 text-[11px] text-mc-brand mb-4 font-medium">
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
          <p className="text-mc-text-2 font-semibold text-[15px]">
            {t('deliveryRequest.steps.flight.empty')}
          </p>
          <p className="text-mc-text-3 text-[13px] mt-1 max-w-xs mx-auto">
            {t('deliveryRequest.steps.flight.emptyDesc')}
          </p>
          <p className="text-mc-text-3 text-[13px] mt-3 max-w-xs mx-auto">
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
                  <h3 className="font-bold text-[15px]">{f.flight_name}</h3>
                  <p className="text-[11px] text-mc-text-2">{t('deliveryRequest.steps.flight.flightLabel')}</p>
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
            flex-1 h-14 rounded-mc-lg font-bold text-[15px]
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
  profileName: string;
  recipientName: string | null;
  onRecipientNameChange: (value: string | null) => void;
  caption: string;
  onCaptionChange: (value: string) => void;
  mapLocation: { latitude: number; longitude: number } | null;
  onMapConfirm: (location: { latitude: number; longitude: number }) => void;
  onMapClear: () => void;
  includeAddress: boolean;
  onIncludeAddressChange: (value: boolean) => void;
  /** BTS only: the office picker shown in place of the map pin. */
  btsPicker?: React.ReactNode;
  btsBranchSelected?: boolean;
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
    profileName,
    recipientName,
    onRecipientNameChange,
    caption,
    onCaptionChange,
    mapLocation,
    onMapConfirm,
    onMapClear,
    includeAddress,
    onIncludeAddressChange,
    btsPicker,
    btsBranchSelected = false,
  }: StepStandardProps) => {
    const { t } = useTranslation();
    const typeLabel = DELIVERY_OPTIONS.find((o) => o.id === deliveryType)?.label ?? deliveryType;
    // Our own courier drives to the pin itself, and only inside Tashkent; the
    // other couriers keep the pin optional.
    const pinRequired = deliveryType === 'mandarin';
    const pinMissing = pinRequired && mapLocation === null;
    const pinOutside = pinRequired && mapLocation !== null && !isInCourierArea(mapLocation);
    const isBts = deliveryType === 'bts';
    // BTS goes to an office: the office is required, the note is not.
    const canSubmit = isBts
      ? btsBranchSelected && !submitting
      : caption.trim().length > 0 && !submitting && !pinMissing && !pinOutside;

    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-400">
        <h2 className="text-[17px] font-extrabold mb-1">{t('deliveryRequest.steps.confirm.title')}</h2>
        <p className="text-mc-text-2 text-[13px] mb-4">
          {t('deliveryRequest.steps.confirm.subtitle')}
        </p>

        <div className="mb-4">
          <RecipientNameField
            profileName={profileName}
            value={recipientName}
            onChange={onRecipientNameChange}
          />
        </div>

        {/* Phone Number */}
        <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-4 mb-4 backdrop-blur-md">
          <label className="flex items-center gap-2 text-[11px] font-bold text-mc-text-2 mb-2">
            <Phone className="w-3.5 h-3.5" />
            {t('deliveryRequest.steps.confirm.phoneLabel')}
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder={t('deliveryRequest.steps.confirm.phonePlaceholder')}
            className="w-full rounded-mc-md border border-mc-border bg-mc-surface-2 dark:bg-white/[0.04] px-4 py-3 text-[16px] font-semibold text-mc-text dark:text-mc-text outline-none focus:border-mc-brand focus:ring-1 focus:ring-mc-brand transition"
          />
          <p className="mt-1.5 text-[11px] text-mc-text-3">
            {t('deliveryRequest.steps.confirm.phoneHint')}
          </p>
        </div>

        {isBts && <div className="mb-4">{btsPicker}</div>}

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
              <span className="block text-[13px] font-bold text-mc-text dark:text-mc-text">
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
          <label className="flex items-center gap-2 text-[11px] font-bold text-mc-text-2 mb-2">
            <MapPin className="w-3.5 h-3.5" />
            {isBts
              ? t('deliveryRequest.steps.confirm.btsNoteLabel')
              : t('deliveryRequest.steps.confirm.captionLabel')}
          </label>
          <textarea
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            placeholder={
              isBts
                ? t('deliveryRequest.steps.confirm.btsNotePlaceholder')
                : t('deliveryRequest.steps.confirm.captionPlaceholder')
            }
            rows={4}
            className="w-full rounded-mc-md border border-mc-border bg-mc-surface-2 dark:bg-white/[0.04] px-4 py-3 text-[16px] font-semibold text-mc-text dark:text-mc-text outline-none focus:border-mc-brand focus:ring-1 focus:ring-mc-brand transition resize-none"
          />
          <p className="mt-1.5 text-[11px] text-mc-text-3">
            {isBts
              ? t('deliveryRequest.steps.confirm.btsNoteHint')
              : t('deliveryRequest.steps.confirm.captionHint')}
          </p>
        </div>

        {/* Map Picker — lazy loaded. BTS delivers to an office, not a pin. */}
        {!isBts && (
        <div className="mb-4">
          <p className="text-[11px] font-bold text-mc-text-2 mb-2">
            {pinRequired
              ? t('deliveryRequest.steps.confirm.mapLabelRequired')
              : t('deliveryRequest.steps.confirm.mapLabel')}
          </p>
          {pinRequired && (
            <p className="text-[12px] text-mc-text-2 mb-2">
              {t('deliveryRequest.steps.confirm.mapRequiredHint')}
            </p>
          )}
          <DeliveryMapPickerLazy
            initialLocation={null}
            confirmedLocation={mapLocation}
            onConfirm={onMapConfirm}
            onClear={onMapClear}
          />
          {pinOutside && (
            <p role="alert" className="mt-2 text-[12px] font-semibold text-mc-danger">
              {t('deliveryRequest.steps.confirm.mapOutsideCity')}
            </p>
          )}
        </div>
        )}

        {/* Summary Card */}
        <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-5 mb-4 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-mc-lg bg-mc-warn-soft flex items-center justify-center text-mc-warn">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] text-mc-text-2">{t('deliveryRequest.steps.confirm.deliveryType')}</p>
              <h3 className="font-bold text-[15px]">{typeLabel}</h3>
            </div>
          </div>

          <div className="border-t border-mc-border pt-4">
            <p className="text-[11px] text-mc-text-2 mb-2 font-medium">
              {t('deliveryRequest.steps.confirm.selectedFlights')}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedFlights.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-mc-md bg-mc-brand-soft dark:bg-mc-brand/10 text-mc-brand text-[13px] font-semibold"
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
          <p className="text-[13px] text-mc-warn font-medium">
            <Trans
              i18nKey="deliveryRequest.steps.confirm.infoMessage"
              values={{ type: typeLabel, flights: selectedFlights.join(', ') }}
              components={{ strong: <strong /> }}
            />
          </p>
        </div>

        {/* A greyed-out button says nothing on its own: name the missing step. */}
        {pinMissing && (
          <p className="mb-3 text-center text-[12px] font-semibold text-mc-text-2">
            {t('deliveryRequest.steps.confirm.mapNeededToSubmit')}
          </p>
        )}

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
              flex-1 h-14 rounded-mc-lg font-bold text-[15px]
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
  profileName: string;
  recipientName: string | null;
  onRecipientNameChange: (value: string | null) => void;
  /** A gateway session is open in the in-app browser — pay controls are locked. */
  paymentLocked: boolean;
  nbuEnabled: boolean;
  savedCards: SavedCardItem[];
  onPayOnline: (walletUsed: number, phoneNumber: string) => void;
  onChargeCard: (cardId: number, walletUsed: number, phoneNumber: string) => void;
  /** Payme Merchant API is switched on: the whole fee on Payme's page. */
  paymeEnabled: boolean;
  /** A card transfer or a Payme order paid the fee: the request is made and approved. */
  onPaid: () => void;
  /** «Tayyor» after such a payment. */
  onFinish: () => void;
}

export function StepUzpostPayment({
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
  profileName,
  recipientName,
  onRecipientNameChange,
  paymentLocked,
  nbuEnabled,
  savedCards,
  onPayOnline,
  onChargeCard,
  paymeEnabled,
  onPaid,
  onFinish,
}: StepUzpostProps) {
  const { t, i18n } = useTranslation();
  const [useWallet, setUseWallet] = useState(false);
  // The row of «To'lov usuli» the client picked; null until they pick one.
  const [methodKey, setMethodKey] = useState<string | null>(null);
  // A card transfer or a Payme order opened from the list, shown in place of it.
  const [view, setView] = useState<{ kind: 'card' } | { kind: 'payme'; order: PaymeOrder } | null>(null);
  const [paymeOpening, setPaymeOpening] = useState(false);
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

  const numberLocale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const formatSom = useCallback(
    (value: number) => value.toLocaleString(numberLocale, { maximumFractionDigits: 2 }),
    [numberLocale],
  );
  const formatUzs = useCallback(
    (value: number) => `${formatSom(value)} ${t('deliveryRequest.steps.uzpost.currencyUzs')}`,
    [formatSom, t],
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

  // While a card transfer or Payme screen is open the system back button
  // returns to the list of methods, not to the flights.
  useBackHandler(view !== null, () => {
    setView(null);
    return true;
  }, BackPriority.MODAL);

  if (loading) {
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-400">
        <h2 className="text-[17px] font-extrabold mb-1">{t('deliveryRequest.steps.uzpost.calcTitle')}</h2>
        <p className="text-mc-text-2 text-[13px] mb-4">{t('deliveryRequest.steps.uzpost.calcDesc')}</p>
        <CalcSkeleton />
      </div>
    );
  }

  // Weight warning screen
  if (calcData?.warning) {
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-400">
        <h2 className="text-[17px] font-extrabold mb-4">{t('deliveryRequest.steps.uzpost.warningTitle')}</h2>

        <div className="rounded-mc-lg bg-mc-danger-soft border-2 border-mc-danger/25 p-6 text-center mb-6">
          <AlertTriangle className="w-16 h-16 mx-auto text-mc-danger mb-4" />
          <p className="text-mc-danger font-bold text-[15px] mb-2">
            {t('deliveryRequest.steps.uzpost.weightExceeded')}
          </p>
          <p className="text-mc-danger text-[13px]">{calcData.warning}</p>
        </div>

        <button
          onClick={onBack}
          className="
            w-full h-14 rounded-mc-lg font-bold text-[15px]
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

  // The request a card transfer or a Payme order makes: the whole fee, never
  // the wallet's part.
  const delivery: CardDeliveryIntentRequest | null = selectedBranch
    ? {
        flight_names: selectedFlights,
        location_id: selectedBranch.id,
        phone_number: phoneNumber.trim() || null,
        recipient_name: recipientName?.trim() || null,
      }
    : null;

  if (view?.kind === 'card' && delivery) {
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-400">
        <CardTransferPanel
          delivery={delivery}
          onBack={() => setView(null)}
          onDone={onFinish}
          onPaid={onPaid}
        />
      </div>
    );
  }

  if (view?.kind === 'payme' && delivery) {
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-400">
        <PaymePanel
          initialOrder={view.order}
          reopenOrder={() => paymeService.openDeliveryOrder(delivery)}
          onPaid={onPaid}
          onBack={() => setView(null)}
          onDone={onFinish}
        />
      </div>
    );
  }

  const total = calcData?.total_amount ?? 0;
  const walletBalance = calcData?.wallet_balance ?? 0;
  // A wallet that covers the whole fee is a method of its own («Balansdan
  // to'lash»), so the switch is offered only for a part of the fee.
  const walletCoversAll = !!calcData && total > 0 && walletBalance >= total;
  const hasWalletSwitch = !!calcData && walletBalance > 0 && !walletCoversAll;
  const walletOn = useWallet && hasWalletSwitch;
  const walletPart = walletOn ? Math.min(walletBalance, total) : 0;
  const remaining = Math.max(total - walletPart, 0);
  // NBU charges at least its floor, and a delivery fee's excess over it is not
  // credited back the way a flight's is, so a smaller remainder is not offered.
  const nbuBelowMin =
    remaining > 0 && remaining < NBU_MIN_UZS
      ? walletOn
        ? t('deliveryRequest.steps.uzpost.belowMinWallet', { min: formatSom(NBU_MIN_UZS) })
        : t('deliveryRequest.steps.uzpost.belowMin', { min: formatSom(NBU_MIN_UZS) })
      : null;
  // With card transfer requests the server leaves the card out: a transfer has
  // to carry its exact sum, so the receipt way is only their fallback.
  const receiptCard = calcData?.card ?? null;
  const noWallet = walletOn ? t('cardTransfer.payCardNoWallet') : null;

  const openPayme = async () => {
    if (!delivery) return;
    setPaymeOpening(true);
    try {
      const order = await paymeService.openDeliveryOrder(delivery);
      if (order.state === 'open' && order.checkout_url && !openPaymeCheckout(order.checkout_url)) {
        toast.error(t('payme.badLink'));
      }
      setView({ kind: 'payme', order });
    } catch (err: unknown) {
      toast.error(paymeRefusal(err, t('makePayment.errorOccurred')));
    } finally {
      setPaymeOpening(false);
    }
  };

  const payOptions: PayOption[] = [];
  if (calcData && total > 0) {
    const payNbu = t('makePayment.methods.payAmount', { amount: formatSom(remaining) });
    if (walletCoversAll) {
      payOptions.push({
        key: 'wallet',
        icon: Wallet,
        title: t('makePayment.payWallet'),
        hint: t('makePayment.methods.walletHint', { amount: formatSom(walletBalance) }),
        blockedBy: null,
        cta: t('makePayment.payWallet'),
        run: () => onSubmit(total, null, phoneNumber),
      });
    }
    if (nbuEnabled) {
      savedCards.forEach((card) => {
        const masked = formatMaskedCard(card.card_masked);
        payOptions.push({
          key: `saved-${card.id}`,
          icon: CreditCard,
          title: card.nickname || masked || t('nbu.cards.namedCardFallback'),
          hint:
            card.nickname && masked
              ? masked
              : masked
                ? t('makePayment.methods.savedCardHint')
                : t('nbu.cards.pendingMasked'),
          blockedBy: nbuBelowMin,
          cta: payNbu,
          run: () => onChargeCard(card.id, walletPart, phoneNumber),
        });
      });
      payOptions.push({
        key: 'nbu',
        icon: Landmark,
        title:
          savedCards.length > 0
            ? t('makePayment.methods.nbuOtherCard')
            : t('makePayment.methods.nbuTitle'),
        hint: t('makePayment.methods.nbuHint'),
        blockedBy: nbuBelowMin,
        cta: payNbu,
        run: () => onPayOnline(walletPart, phoneNumber),
      });
    }
    if (paymeEnabled) {
      payOptions.push({
        key: 'payme',
        icon: Zap,
        title: t('payme.title'),
        hint: t('payme.hint'),
        blockedBy:
          noWallet ??
          (total < PAYME_MIN_UZS
            ? t('deliveryRequest.steps.uzpost.belowMin', { min: formatSom(PAYME_MIN_UZS) })
            : null),
        cta: t('makePayment.methods.payAmount', { amount: formatSom(total) }),
        run: () => void openPayme(),
      });
    }
    if (calcData.card_intent_available) {
      payOptions.push({
        key: 'card',
        icon: ArrowRightLeft,
        title: t('cardTransfer.payCard'),
        hint: t('cardTransfer.payCardHint'),
        blockedBy: noWallet,
        cta: t('makePayment.methods.continue'),
        run: () => setView({ kind: 'card' }),
      });
    }
    if (receiptCard) {
      payOptions.push({
        key: 'receipt',
        icon: Smartphone,
        title: t('makePayment.payOnline'),
        hint: t('makePayment.methods.onlineHintCard'),
        blockedBy: null,
        cta: t('deliveryRequest.steps.uzpost.submitButton'),
        run: () => onSubmit(walletPart, receiptFile, phoneNumber),
      });
    }
  }

  const selectedOption =
    payOptions.find((option) => option.key === methodKey && option.blockedBy === null) ??
    payOptions.find((option) => option.blockedBy === null) ??
    null;
  const receiptChosen = selectedOption?.key === 'receipt';
  const busy = submitting || paymeOpening;
  const payDisabled =
    !selectedOption ||
    busy ||
    paymentLocked ||
    !selectedBranch ||
    (receiptChosen && (receiptProcessing || !receiptFile));

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
                    <p className="text-[13px] font-semibold text-white">{t('camera.preparingCamera')}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-4 bg-black/80 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={closeReceiptCamera}
                disabled={isCapturingReceipt}
                className="h-12 rounded-mc-lg border border-white/30 bg-white/10 px-5 font-bold text-white active:scale-95 disabled:opacity-60"
              >
                {t('camera.cancel')}
              </button>
              <button
                type="button"
                onClick={captureReceiptPhoto}
                disabled={isCapturingReceipt || !isCameraReady}
                className="flex h-12 items-center justify-center gap-2 rounded-mc-lg bg-mc-brand px-6 font-bold text-mc-on-brand active:scale-95 disabled:opacity-60"
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

      <h2 className="text-[17px] font-extrabold mb-1">{t('deliveryRequest.steps.uzpost.paymentTitle')}</h2>
      <p className="text-mc-text-2 text-[13px] mb-4">
        {t('deliveryRequest.steps.uzpost.flightsFor', { flights: selectedFlights.join(', ') })}
      </p>

      <div className="mb-4">
        <RecipientNameField
          profileName={profileName}
          value={recipientName}
          onChange={onRecipientNameChange}
        />
      </div>

      {/* Optional phone number */}
      <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-4 mb-4">
        <label
          htmlFor="uzpost-phone"
          className="flex items-center gap-2 text-[11px] font-bold text-mc-text-2 mb-2"
        >
          <Phone className="w-3.5 h-3.5" aria-hidden="true" />
          {t('deliveryRequest.steps.confirm.phoneLabel')}
        </label>
        <input
          id="uzpost-phone"
          type="tel"
          value={phoneNumber}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder={t('deliveryRequest.steps.confirm.phonePlaceholder')}
          className="w-full rounded-mc-md border border-mc-border bg-mc-surface-2 px-4 py-3 text-[16px] font-semibold text-mc-text outline-none focus:border-mc-brand focus:ring-1 focus:ring-mc-brand transition"
        />
        <p className="mt-1.5 text-[11px] text-mc-text-3">
          {t('deliveryRequest.steps.uzpost.phoneHint')}
        </p>
      </div>

      <div className="mb-6">
        <Suspense
          fallback={
            <div className="space-y-3">
              <div className="h-12 rounded-mc-lg bg-mc-surface-2 animate-pulse" />
              <div className="h-64 rounded-mc-lg bg-mc-surface-2 animate-pulse" />
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

      {/* The weight and the fee — once a branch is picked and priced */}
      {calcData && (
        <dl className="mb-4 grid grid-cols-2 divide-x divide-mc-border rounded-mc-md border border-mc-border bg-mc-surface">
          <div className="min-w-0 px-3.5 py-3">
            <dt className="text-[11px] font-medium text-mc-text-2">
              {t('deliveryRequest.steps.uzpost.totalWeight')}
            </dt>
            <dd className="mt-0.5 text-[15px] font-extrabold tabular-nums text-mc-text">
              {calcData.total_weight} kg
            </dd>
          </div>
          <div className="min-w-0 px-3.5 py-3">
            <dt className="text-[11px] font-medium text-mc-text-2">
              {t('deliveryRequest.steps.uzpost.totalAmount')}
            </dt>
            <dd className="mt-0.5 break-words text-[15px] font-extrabold tabular-nums text-mc-text">
              {formatUzs(total)}
            </dd>
          </div>
        </dl>
      )}

      {/* Offline estimate notice — UzPost pricing API was unreachable. */}
      {calcData?.fallback && (
        <div className="flex items-start gap-2 rounded-mc-md bg-mc-warn-soft border border-mc-warn/25 p-3 mb-4">
          <AlertTriangle className="w-4 h-4 text-mc-warn shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-mc-text text-[12px] leading-snug">
            {t('deliveryRequest.steps.uzpost.estimateNote')}
          </p>
        </div>
      )}

      {/* The wallet's part of the fee */}
      {hasWalletSwitch && (
        <div className="mb-4 rounded-mc-md border border-mc-border bg-mc-surface">
          <SwitchRow
            label={t('deliveryRequest.steps.uzpost.walletPay')}
            hint={t('deliveryRequest.steps.uzpost.walletBalance', {
              balance: formatSom(walletBalance),
            })}
            checked={walletOn}
            onToggle={() => setUseWallet((on) => !on)}
          />
          {walletOn && (
            <div className="space-y-1 px-3.5 pb-3.5 text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-mc-text-2">{t('deliveryRequest.steps.uzpost.fromWallet')}</span>
                <span className="font-bold text-mc-success tabular-nums">−{formatUzs(walletPart)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-mc-text">
                  {t('deliveryRequest.steps.uzpost.remainingPayment')}
                </span>
                <span className="font-extrabold text-mc-text tabular-nums">{formatUzs(remaining)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* How to pay: one list, the button under it acts on the chosen row */}
      {payOptions.length > 0 && (
        <div className="mb-4">
          <PayMethodList
            options={payOptions}
            selectedKey={selectedOption?.key}
            onSelect={setMethodKey}
          />
        </div>
      )}

      {/* The receipt way: the card to pay to, and the receipt */}
      {receiptChosen && receiptCard && (
        <div className="mb-4 space-y-3">
          <div className="rounded-mc-md border border-mc-border bg-mc-surface p-3.5">
            <p className="text-[11px] font-medium text-mc-text-2">
              {t('deliveryRequest.steps.uzpost.paymentCard')}
            </p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-[16px] font-bold tabular-nums tracking-[0.04em] text-mc-text">
                  {receiptCard.card_number}
                </p>
                <p className="text-[12px] text-mc-text-2">{receiptCard.card_owner}</p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(receiptCard.card_number)}
                aria-label={t('makePayment.copyCard')}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm border border-mc-border bg-mc-surface-2 text-mc-text-2 transition-transform active:scale-90"
              >
                <Copy className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium text-mc-text-2">
              {t('deliveryRequest.steps.uzpost.uploadReceipt')}
            </p>

            {receiptFile ? (
              <div className="rounded-mc-md border-2 border-dashed border-mc-success/50 bg-mc-surface p-3.5">
                {preview ? (
                  <div className="relative">
                    <img
                      src={preview}
                      alt={t('makePayment.fileSelected')}
                      className="max-h-48 w-full rounded-mc-sm object-contain"
                    />
                    <button
                      type="button"
                      onClick={clearFile}
                      aria-label={t('deliveryRequest.clearFile', "Faylni o'chirish")}
                      className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-mc-danger-fill text-mc-on-danger transition-transform active:scale-90"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="h-8 w-8 shrink-0 text-mc-success" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-mc-text">
                          {receiptFile.name}
                        </p>
                        <p className="text-[11px] text-mc-text-3">
                          {(receiptFile.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearFile}
                      aria-label={t('deliveryRequest.clearFile', "Faylni o'chirish")}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mc-danger-soft text-mc-danger transition-transform active:scale-90"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : receiptProcessing ? (
              <div className="flex w-full flex-col items-center justify-center gap-3 rounded-mc-md border-2 border-dashed border-mc-warn/30 bg-mc-warn-soft p-6">
                <Loader2 className="h-7 w-7 animate-spin text-mc-warn" aria-hidden="true" />
                <p className="text-[13px] font-bold text-mc-text">
                  {t('deliveryRequest.steps.uzpost.compressingReceipt')}
                </p>
              </div>
            ) : (
              <div className="rounded-mc-md border-2 border-dashed border-mc-border bg-mc-surface-2 p-4">
                <p className="text-center text-[13px] font-bold text-mc-text">
                  {t('deliveryRequest.steps.uzpost.uploadButton')}
                </p>
                <p className="mt-0.5 text-center text-[11px] text-mc-text-3">
                  {t('deliveryRequest.steps.uzpost.uploadHint')}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-mc-md border border-mc-border bg-mc-surface px-2 text-[13px] font-bold text-mc-text transition-transform active:scale-[0.98]"
                  >
                    <Upload className="h-4 w-4 shrink-0 text-mc-text-2" aria-hidden="true" />
                    <span className="min-w-0 break-words">
                      {t('deliveryRequest.steps.uzpost.uploadGalleryButton')}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={openReceiptCamera}
                    className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-mc-md border border-mc-border bg-mc-surface px-2 text-[13px] font-bold text-mc-text transition-transform active:scale-[0.98]"
                  >
                    <Camera className="h-4 w-4 shrink-0 text-mc-text-2" aria-hidden="true" />
                    <span className="min-w-0 break-words">
                      {t('deliveryRequest.steps.uzpost.uploadCameraButton')}
                    </span>
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
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('common.back', 'Ortga')}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-mc-lg bg-mc-surface-2 text-mc-text-2 transition-transform active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => selectedOption?.run()}
          disabled={payDisabled}
          className="flex min-h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-mc-lg bg-mc-brand px-4 py-3
            text-center text-[15px] font-extrabold leading-tight text-mc-on-brand tabular-nums
            transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy && <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />}
          {paymentLocked
            ? t('nbuWatch.waitTitle', 'To‘lov tekshirilmoqda')
            : selectedOption
              ? selectedOption.cta
              : t('makePayment.methods.choose')}
        </button>
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
    <h2 className="text-[17px] font-extrabold mb-2">{t('deliveryRequest.steps.success.title')}</h2>
    <p className="text-mc-text-2 text-[13px] max-w-xs mx-auto mb-8">
      {t('deliveryRequest.steps.success.desc')}
    </p>

    <button
      onClick={onGoHome}
      className="
        w-full max-w-xs mx-auto h-14 rounded-mc-lg font-bold text-[15px] text-mc-on-brand
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
      <h2 className="text-[16px] font-extrabold mb-2">{t('deliveryRequest.profile.title')}</h2>
      <p className="text-mc-text-2 text-[13px] max-w-xs mx-auto mb-2">
        {t('deliveryRequest.profile.desc')}
      </p>

      {missingFields.length > 0 && (
        <div className="max-w-xs mx-auto mb-6">
          <div className="rounded-mc-md bg-mc-danger-soft border border-mc-danger/25 p-3 text-left">
            <p className="text-[11px] font-bold text-mc-danger dark:text-mc-danger mb-1.5">
              Quyidagi maydonlar to'ldirilmagan:
            </p>
            <ul className="space-y-1">
              {missingFields.map((field) => (
                <li key={field} className="flex items-center gap-1.5 text-[11px] text-mc-danger dark:text-mc-danger">
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
              w-full h-14 rounded-mc-lg font-bold text-[15px] text-mc-on-brand
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
            w-full h-14 rounded-mc-lg font-bold text-[15px]
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
  const [selectedBtsBranch, setSelectedBtsBranch] = useState<BtsBranch | null>(null);
  const btsBranchesQuery = useBtsBranches(deliveryType === 'bts');
  const lastBtsBranch = useMemo(() => {
    const code = readLastBtsBranchCode();
    return btsBranchesQuery.data?.find((b) => b.index === code) ?? null;
  }, [btsBranchesQuery.data]);

  // Standard delivery form state
  const [standardPhone, setStandardPhone] = useState('');
  /**
   * Who collects the parcel. `null` means "the profile name" — the field is not
   * pre-filled with it, so an untouched form still follows the account even if
   * the user edits their profile between opening this screen and submitting.
   */
  const [standardRecipient, setStandardRecipient] = useState<string | null>(null);
  const [standardCaption, setStandardCaption] = useState('');
  const [standardMapLocation, setStandardMapLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [includeAddress, setIncludeAddress] = useState(false);

  // UzPost phone state
  const [uzpostPhone, setUzpostPhone] = useState('');
  const [uzpostRecipient, setUzpostRecipient] = useState<string | null>(null);

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

  // Payme Merchant API: off until its keys are on the server.
  const { data: paymeStatus } = useQuery({
    queryKey: ['payme-available'],
    queryFn: paymeService.available,
    staleTime: 5 * 60_000,
    enabled: deliveryType === 'uzpost',
  });
  const paymeEnabled = paymeStatus?.enabled === true;

  // API state
  const [flights, setFlights] = useState<FlightItem[]>([]);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [calcData, setCalcData] = useState<CalculateUzpostResponse | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /**
   * A gateway session is open in the in-app browser.
   *
   * The app is no longer replaced by the gateway, so every pay control here
   * stays live while the user is at the bank. Without this lock they could
   * return, tap Pay again, and mint a second full-amount session — the backend
   * only rejects a duplicate once the local row reads `paid`, and its sweeper
   * waits 60s, so the whole window between paying and settling was open.
   */
  const paymentPending = useNbuSessionOpen('payment');

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
    setSelectedBtsBranch(null);
    setCalcData(null);
    setProfileIncomplete(false);
    setStandardPhone(userProfile?.phone ?? '');
    setStandardRecipient(null);
    setStandardCaption('');
    setStandardMapLocation(null);
    setUzpostPhone(userProfile?.phone ?? '');
    setUzpostRecipient(null);
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
    if (deliveryType === 'bts' && !selectedBtsBranch) {
      toast.error(t('deliveryRequest.toast.btsBranchRequired'));
      return;
    }
    if (deliveryType !== 'bts' && !standardCaption.trim()) {
      toast.error(t('deliveryRequest.toast.captionRequired'));
      return;
    }
    if (deliveryType === 'mandarin' && !standardMapLocation) {
      toast.error(t('deliveryRequest.steps.confirm.mapNeededToSubmit'));
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
        standardCaption.trim() || null,
        // null, not 0. The pin is optional for Yandex/BTS (only "mandarin"
        // requires one), and 0,0 is a real point in the Gulf of Guinea that
        // every reader downstream turned into a route link for the courier.
        standardMapLocation?.latitude ?? null,
        standardMapLocation?.longitude ?? null,
        includeAddress,
        standardRecipient?.trim() || null,
        deliveryType === 'bts' ? selectedBtsBranch?.index ?? null : null
      );
      if (deliveryType === 'bts' && selectedBtsBranch) {
        rememberBtsBranchCode(selectedBtsBranch.index);
      }
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
  }, [deliveryType, selectedFlights, standardPhone, standardRecipient, standardCaption, standardMapLocation, includeAddress, selectedBtsBranch, t, refetchProfile]);

  const handleUzpostSubmit = useCallback(
    async (walletUsed: number, file: File | null, phoneNumber: string) => {
      if (!selectedUzpostBranch) {
        toast.error('UzPost punktini tanlang');
        return;
      }

      setSubmitting(true);
      try {
        const phoneToSend = phoneNumber.trim() || null;
        await submitUzpostDelivery(
          selectedFlights,
          walletUsed,
          file,
          selectedUzpostBranch,
          phoneToSend,
          uzpostRecipient?.trim() || null
        );
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
    [selectedFlights, selectedUzpostBranch, uzpostRecipient, t]
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
          recipient_name: uzpostRecipient?.trim() || null,
          wallet_used: walletUsed,
        });
        saveUzpostBranchPreference(selectedUzpostBranch);
        if (res.payment_url) {
          const mode = openNbuUrl({
            orderId: res.order_id,
            kind: 'payment',
            paymentUrl: res.payment_url,
            flightName: selectedFlights[0],
            // After a zayafka payment, land on the delivery-history tab.
            homePath: '/user/home?tab=delivery_history',
          });
          // The gateway now opens ON TOP of the app instead of replacing it, so
          // this wizard stays mounted — and `submitting` stayed true forever,
          // leaving the pay button a dead spinner. Release it; re-submission is
          // blocked by `paymentPending` instead, which clears only when the
          // payment actually settles.
          if (mode === 'external') setSubmitting(false);
        } else {
          toast.error("To'lov havolasi olinmadi. Qayta urinib ko'ring.");
          setSubmitting(false);
        }
      } catch (err: unknown) {
        showUzpostApiError(err);
        setSubmitting(false);
      }
    },
    [selectedFlights, selectedUzpostBranch, uzpostRecipient, showUzpostApiError]
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
          recipient_name: uzpostRecipient?.trim() || null,
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
    [selectedFlights, selectedUzpostBranch, uzpostRecipient, showUzpostApiError]
  );

  // A card transfer or a Payme order paid the fee: the server made the request
  // and approved it, so the branch is remembered as after any other payment.
  const handleUzpostPaid = useCallback(() => {
    if (!selectedUzpostBranch) return;
    saveUzpostBranchPreference(selectedUzpostBranch);
    setSavedUzpostBranchId(selectedUzpostBranch.id);
  }, [selectedUzpostBranch]);

  const goBackStep = useCallback(() => {
    setProfileIncomplete(false);
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    } else {
      onBack();
    }
  }, [currentStep, onBack]);

  /**
   * The system back button walks the wizard the same way the header arrow does:
   * step 4 -> 3 -> 2 -> 1, then out of the screen. Without this a press in the
   * middle of a half-filled request jumped straight out (or closed the app),
   * losing everything the user had entered.
   *
   * The profile-incomplete overlay and the edit-profile modal sit above the
   * wizard and are dismissed first.
   */
  useBackHandler(isEditProfileOpen, () => {
    setIsEditProfileOpen(false);
    return true;
  }, BackPriority.OVERLAY);

  useBackHandler(profileIncomplete, () => {
    setProfileIncomplete(false);
    return true;
  }, BackPriority.MODAL);

  // Step 4 is the success screen — there is nothing to go back INTO, so it
  // leaves the wizard rather than reopening the form the user just submitted.
  useBackHandler(true, () => {
    if (currentStep === 4) {
      onBack();
      return true;
    }
    goBackStep();
    return true;
  }, BackPriority.VIEW);

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
          <h1 className="text-[15px] font-bold">{t('deliveryRequest.headerTitleShort')}</h1>
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
          paymentLocked={paymentPending}
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
          profileName={userProfile?.full_name ?? ''}
          recipientName={uzpostRecipient}
          onRecipientNameChange={setUzpostRecipient}
          nbuEnabled={nbuEnabled}
          savedCards={savedCards}
          onPayOnline={handleUzpostPayOnline}
          onChargeCard={handleUzpostChargeCard}
          paymeEnabled={paymeEnabled}
          onPaid={handleUzpostPaid}
          onFinish={onNavigateToHistory ?? onBack}
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
          profileName={userProfile?.full_name ?? ''}
          recipientName={standardRecipient}
          onRecipientNameChange={setStandardRecipient}
          caption={standardCaption}
          onCaptionChange={setStandardCaption}
          mapLocation={standardMapLocation}
          onMapConfirm={setStandardMapLocation}
          onMapClear={() => setStandardMapLocation(null)}
          includeAddress={includeAddress}
          onIncludeAddressChange={setIncludeAddress}
          btsBranchSelected={selectedBtsBranch !== null}
          btsPicker={
            deliveryType === 'bts' ? (
              <Suspense
                fallback={
                  <div className="h-64 rounded-mc-lg bg-mc-surface-2 dark:bg-white/5 animate-pulse" />
                }
              >
                <UzpostBranchPicker
                  branches={btsBranchesQuery.data ?? []}
                  selectedBranch={selectedBtsBranch}
                  suggestedBranch={lastBtsBranch}
                  isLoading={btsBranchesQuery.isLoading}
                  isError={btsBranchesQuery.isError}
                  onSelect={setSelectedBtsBranch}
                  onRetry={() => void btsBranchesQuery.refetch()}
                  textPrefix="deliveryRequest.btsBranchPicker"
                />
              </Suspense>
            ) : null
          }
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
