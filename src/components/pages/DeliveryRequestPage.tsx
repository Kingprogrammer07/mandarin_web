import { useState, useCallback, useRef, memo } from 'react';
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
  X,
  AlertTriangle,
  Wallet,
  Loader2,
  CheckCircle2,
  FileText,
  ArrowLeft,
  UserCog,
  Clock,
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
  onNavigateToProfile?: () => void;
  onNavigateToHistory?: () => void;
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
    gradient: 'from-orange-500 to-amber-500',
    iconBg: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
  },
  {
    id: 'yandex',
    label: 'Yandex',
    descKey: 'deliveryRequest.options.yandex',
    icon: <Zap className="w-8 h-8" />,
    gradient: 'from-red-500 to-rose-500',
    iconBg: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
  },
  {
    id: 'mandarin',
    label: 'Mandarin Dostavka',
    descKey: 'deliveryRequest.options.mandarin',
    icon: <Package className="w-8 h-8" />,
    gradient: 'from-emerald-500 to-green-500',
    iconBg: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'bts',
    label: 'BTS',
    descKey: 'deliveryRequest.options.bts',
    icon: <Truck className="w-8 h-8" />,
    gradient: 'from-blue-500 to-sky-500',
    iconBg: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
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
        className="h-20 rounded-2xl bg-gray-200 dark:bg-white/5 animate-pulse"
      />
    ))}
  </div>
);

const CalcSkeleton = () => (
  <div className="space-y-4">
    <div className="h-10 rounded-xl bg-gray-200 dark:bg-white/5 animate-pulse w-3/4" />
    <div className="h-24 rounded-2xl bg-gray-200 dark:bg-white/5 animate-pulse" />
    <div className="h-24 rounded-2xl bg-gray-200 dark:bg-white/5 animate-pulse" />
    <div className="h-14 rounded-2xl bg-gray-200 dark:bg-white/5 animate-pulse" />
  </div>
);

// ============================================
// STEP INDICATOR
// ============================================

const StepIndicator = memo(({ current, total }: { current: number; total: number }) => (
  <div className="flex items-center justify-center gap-2 mb-6">
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        className={`h-1.5 rounded-full transition-all duration-500 ${
          i + 1 === current
            ? 'w-8 bg-amber-500'
            : i + 1 < current
            ? 'w-4 bg-amber-500/40'
            : 'w-4 bg-gray-300 dark:bg-white/10'
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
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        {t('deliveryRequest.steps.type.subtitle')}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {DELIVERY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className="
              relative overflow-hidden rounded-3xl p-5 text-left
              bg-white dark:bg-white/5 border-2 border-transparent
              hover:border-amber-400/60 dark:hover:border-amber-500/40
              active:scale-[0.96] transition-all duration-200
              shadow-sm hover:shadow-lg group
              backdrop-blur-md
            "
          >
            {/* Gradient glow on hover */}
            <div
              className={`
                absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300
                bg-gradient-to-br ${opt.gradient}
              `}
            />

            <div className="relative z-10">
              <div
                className={`
                  w-14 h-14 rounded-2xl flex items-center justify-center mb-4
                  ${opt.iconBg}
                `}
              >
                {opt.icon}
              </div>
              <h3 className="font-bold text-lg leading-tight mb-0.5">{opt.label}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t(opt.descKey)}</p>
            </div>

            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 dark:text-white/15 group-hover:text-amber-500 transition-colors" />
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
}

const StepFlightSelection = memo(
  ({ deliveryType, flights, loading, selected, onToggle, onContinue, onBack }: StepFlightProps) => {
    const { t } = useTranslation();
    return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-400">
      <h2 className="text-2xl font-extrabold mb-1">{t('deliveryRequest.steps.flight.title')}</h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        {t('deliveryRequest.steps.flight.subtitle')}
      </p>
      {deliveryType === 'mandarin' && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mb-4 font-medium">
          <Wallet className="w-4 h-4 text-emerald-500 dark:text-emerald-400 inline-block mr-1" />
          {t('deliveryRequest.steps.flight.mandarinNote')}
        </span>
      )}
      {deliveryType === 'yandex' && (
        <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-4 font-medium">
          <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400 inline-block mr-1" />
          {t('deliveryRequest.steps.flight.yandexNote')}
        </span>
      )}
      {deliveryType === 'bts' && (
        <span className="inline-flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 mb-4 font-medium">
          <Clock className="w-4 h-4 text-sky-500 dark:text-sky-400 inline-block mr-1" />
          {t('deliveryRequest.steps.flight.btsNote')}
        </span>
      )}
      {loading ? (
        <FlightSkeleton />
      ) : flights.length === 0 ? (
        <div className="text-center py-16">
          <Plane className="w-16 h-16 mx-auto text-gray-300 dark:text-white/15 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-semibold text-lg">
            {t('deliveryRequest.steps.flight.empty')}
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            {t('deliveryRequest.steps.flight.emptyDesc')}
          </p>
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
                  w-full flex items-center gap-4 p-4 rounded-2xl text-left
                  transition-all duration-200 active:scale-[0.98]
                  border-2
                  ${
                    isChecked
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 shadow-md shadow-amber-500/10'
                      : 'border-transparent bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/8'
                  }
                `}
              >
                {/* Checkbox */}
                <div
                  className={`
                    w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                    transition-all duration-200 border-2
                    ${
                      isChecked
                        ? 'bg-amber-500 border-amber-500'
                        : 'border-gray-300 dark:border-white/20 bg-transparent'
                    }
                  `}
                >
                  {isChecked && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </div>

                {/* Flight Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base">{f.flight_name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('deliveryRequest.steps.flight.flightLabel')}</p>
                </div>

                <Plane className="w-5 h-5 text-gray-300 dark:text-white/15 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom Actions */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={onBack}
          className="
            flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center
            bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300
            active:scale-95 transition-transform
          "
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={onContinue}
          disabled={selected.length === 0}
          className={`
            flex-1 h-14 rounded-2xl font-bold text-base
            flex items-center justify-center gap-2
            transition-all duration-200 active:scale-[0.98]
            ${
              selected.length > 0
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 hover:bg-amber-600'
                : 'bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-gray-500 cursor-not-allowed'
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

interface StepStandardProps {
  deliveryType: DeliveryType;
  selectedFlights: string[];
  submitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}

const StepStandardConfirm = memo(
  ({ deliveryType, selectedFlights, submitting, onSubmit, onBack }: StepStandardProps) => {
    const { t } = useTranslation();
    const typeLabel =
      DELIVERY_OPTIONS.find((o) => o.id === deliveryType)?.label ?? deliveryType;

    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-400">
        <h2 className="text-2xl font-extrabold mb-1">{t('deliveryRequest.steps.confirm.title')}</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          {t('deliveryRequest.steps.confirm.subtitle')}
        </p>

        {/* Summary Card */}
        <div className="rounded-3xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-5 mb-4 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('deliveryRequest.steps.confirm.deliveryType')}</p>
              <h3 className="font-bold text-lg">{typeLabel}</h3>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-white/5 pt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
              {t('deliveryRequest.steps.confirm.selectedFlights')}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedFlights.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-sm font-semibold"
                >
                  <Plane className="w-3.5 h-3.5" />
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 p-4 mb-6">
          <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
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
              flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center
              bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300
              active:scale-95 transition-transform
            "
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="
              flex-1 h-14 rounded-2xl font-bold text-base text-white
              flex items-center justify-center gap-2
              bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98]
              shadow-lg shadow-emerald-500/25 transition-all duration-200
              disabled:opacity-60 disabled:cursor-not-allowed
            "
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
  onSubmit: (walletUsed: number, file: File | null) => void;
  onBack: () => void;
}

function StepUzpostPayment({
  calcData,
  loading,
  selectedFlights,
  submitting,
  onSubmit,
  onBack,
}: StepUzpostProps) {
  const { t } = useTranslation();
  const [useWallet, setUseWallet] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const walletApplied = useWallet && calcData ? Math.min(calcData.wallet_balance, calcData.total_amount) : 0;
  const remaining = calcData ? Math.max(calcData.total_amount - walletApplied, 0) : 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setReceiptFile(file);
    if (file && file.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }
  };

  const clearFile = () => {
    setReceiptFile(null);
    setPreview(null);
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
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{t('deliveryRequest.steps.uzpost.calcDesc')}</p>
        <CalcSkeleton />
      </div>
    );
  }

  // Weight warning screen
  if (calcData?.warning) {
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-400">
        <h2 className="text-2xl font-extrabold mb-4">{t('deliveryRequest.steps.uzpost.warningTitle')}</h2>

        <div className="rounded-3xl bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/30 p-6 text-center mb-6">
          <AlertTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <p className="text-red-700 dark:text-red-300 font-bold text-lg mb-2">
            {t('deliveryRequest.steps.uzpost.weightExceeded')}
          </p>
          <p className="text-red-600 dark:text-red-400 text-sm">{calcData.warning}</p>
        </div>

        <button
          onClick={onBack}
          className="
            w-full h-14 rounded-2xl font-bold text-base
            flex items-center justify-center gap-2
            bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200
            active:scale-[0.98] transition-all
          "
        >
          <ArrowLeft className="w-5 h-5" />
          {t('deliveryRequest.steps.uzpost.backButton')}
        </button>
      </div>
    );
  }

  if (!calcData) return null;

  const fullyCoveredByWallet = remaining <= 0;

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-400">
      <h2 className="text-2xl font-extrabold mb-1">{t('deliveryRequest.steps.uzpost.paymentTitle')}</h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        {t('deliveryRequest.steps.uzpost.flightsFor', { flights: selectedFlights.join(', ') })}
      </p>

      {/* Summary Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 backdrop-blur-md">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('deliveryRequest.steps.uzpost.totalWeight')}</p>
          <p className="text-xl font-extrabold">{calcData.total_weight} kg</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 backdrop-blur-md">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('deliveryRequest.steps.uzpost.totalAmount')}</p>
          <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
            {calcData.total_amount.toLocaleString()} so'm
          </p>
        </div>
      </div>

      {/* Wallet Toggle */}
      <div className="rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 mb-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm">{t('deliveryRequest.steps.uzpost.walletPay')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('deliveryRequest.steps.uzpost.walletBalance', { balance: calcData.wallet_balance.toLocaleString() })}
              </p>
            </div>
          </div>

          {/* Toggle */}
          <button
            onClick={() => setUseWallet(!useWallet)}
            className={`
              relative w-14 h-8 rounded-full transition-colors duration-300
              ${useWallet ? 'bg-amber-500' : 'bg-gray-300 dark:bg-white/15'}
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
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('deliveryRequest.steps.uzpost.fromWallet')}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                -{walletApplied.toLocaleString()} so'm
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('deliveryRequest.steps.uzpost.remainingPayment')}</span>
              <span className="font-extrabold text-lg">
                {remaining.toLocaleString()} so'm
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Card Info (only if payment remains) */}
      {!fullyCoveredByWallet && calcData.card && (
        <div className="rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 mb-4 backdrop-blur-md">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
            {t('deliveryRequest.steps.uzpost.paymentCard')}
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono font-bold text-lg tracking-wider">
                {calcData.card.card_number}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {calcData.card.card_owner}
              </p>
            </div>
            <button
              onClick={() => handleCopy(calcData.card!.card_number)}
              className="
                w-11 h-11 rounded-xl flex items-center justify-center
                bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400
                active:scale-90 transition-transform
              "
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* File Upload (only if payment remains) */}
      {!fullyCoveredByWallet && (
        <div className="mb-6">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
            {t('deliveryRequest.steps.uzpost.uploadReceipt')}
          </p>

          {receiptFile ? (
            <div className="rounded-2xl bg-white dark:bg-white/5 border-2 border-dashed border-emerald-400 dark:border-emerald-500/40 p-4">
              {preview ? (
                <div className="relative mb-3">
                  <img
                    src={preview}
                    alt="Receipt preview"
                    className="w-full max-h-48 object-contain rounded-xl"
                  />
                  <button
                    onClick={clearFile}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-emerald-500" />
                    <div>
                      <p className="font-semibold text-sm truncate max-w-[200px]">
                        {receiptFile.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {(receiptFile.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={clearFile}
                    className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 text-red-500 flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="
                w-full rounded-2xl border-2 border-dashed
                border-gray-300 dark:border-white/15
                hover:border-amber-400 dark:hover:border-amber-500/40
                bg-gray-50 dark:bg-white/[0.02]
                p-8 flex flex-col items-center justify-center gap-3
                transition-all duration-200 active:scale-[0.98] group
              "
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                <Upload className="w-7 h-7" />
              </div>
              <div className="text-center">
                <p className="font-bold text-sm text-gray-700 dark:text-gray-200">
                  {t('deliveryRequest.steps.uzpost.uploadButton')}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {t('deliveryRequest.steps.uzpost.uploadHint')}
                </p>
              </div>
            </button>
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
          className="
            flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center
            bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300
            active:scale-95 transition-transform
          "
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => onSubmit(walletApplied, receiptFile)}
          disabled={submitting || (!fullyCoveredByWallet && !receiptFile)}
          className={`
            flex-1 h-14 rounded-2xl font-bold text-base text-white
            flex items-center justify-center gap-2
            transition-all duration-200 active:scale-[0.98]
            ${
              submitting || (!fullyCoveredByWallet && !receiptFile)
                ? 'bg-gray-300 dark:bg-white/10 text-gray-500 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25'
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
    <div className="w-24 h-24 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mb-6">
      <CheckCircle2 className="w-14 h-14 text-emerald-500" />
    </div>
    <h2 className="text-2xl font-extrabold mb-2">{t('deliveryRequest.steps.success.title')}</h2>
    <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto mb-8">
      {t('deliveryRequest.steps.success.desc')}
    </p>

    <button
      onClick={onGoHome}
      className="
        w-full max-w-xs mx-auto h-14 rounded-2xl font-bold text-base text-white
        flex items-center justify-center gap-2
        bg-amber-500 hover:bg-amber-600 active:scale-[0.98]
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
  ({ onGoProfile, onBack }: { onGoProfile?: () => void; onBack: () => void }) => {
    const { t } = useTranslation();
    return (
    <div className="animate-in fade-in zoom-in-95 duration-400 text-center py-8">
      <div className="w-20 h-20 mx-auto rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center mb-5">
        <UserCog className="w-10 h-10 text-red-500" />
      </div>
      <h2 className="text-xl font-extrabold mb-2">{t('deliveryRequest.profile.title')}</h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto mb-6">
        {t('deliveryRequest.profile.desc')}
      </p>

      <div className="space-y-3 max-w-xs mx-auto">
        {onGoProfile && (
          <button
            onClick={onGoProfile}
            className="
              w-full h-14 rounded-2xl font-bold text-base text-white
              flex items-center justify-center gap-2
              bg-blue-500 hover:bg-blue-600 active:scale-[0.98]
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
            w-full h-14 rounded-2xl font-bold text-base
            flex items-center justify-center gap-2
            bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200
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

export default function DeliveryRequestPage({ onBack, onNavigateToProfile, onNavigateToHistory }: Props) {
  const { t } = useTranslation();
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [deliveryType, setDeliveryType] = useState<DeliveryType | null>(null);
  const [selectedFlights, setSelectedFlights] = useState<string[]>([]);

  // API state
  const [flights, setFlights] = useState<FlightItem[]>([]);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [calcData, setCalcData] = useState<CalculateUzpostResponse | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  const totalSteps = deliveryType === 'uzpost' ? 4 : 4;

  // ---- Actions ----

  const handleTypeSelect = useCallback(async (type: DeliveryType) => {
    setDeliveryType(type);
    setSelectedFlights([]);
    setCalcData(null);
    setProfileIncomplete(false);
    setCurrentStep(2);
    setFlightsLoading(true);

    try {
      const res = await getPaidFlights();
      setFlights(res.flights);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message || t('deliveryRequest.toast.flightsError'));
      setFlights([]);
    } finally {
      setFlightsLoading(false);
    }
  }, []);

  const toggleFlight = useCallback((name: string) => {
    setSelectedFlights((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }, []);

  const handleFlightContinue = useCallback(async () => {
    if (deliveryType === 'uzpost') {
      setCurrentStep(3);
      setCalcLoading(true);
      try {
        const res = await calculateUzpost(selectedFlights);
        setCalcData(res);
      } catch (err: unknown) {
        const e = err as { message?: string };
        toast.error(e?.message || t('deliveryRequest.toast.calcError'));
      } finally {
        setCalcLoading(false);
      }
    } else {
      setCurrentStep(3);
    }
  }, [deliveryType, selectedFlights]);

  const handleStandardSubmit = useCallback(async () => {
    if (!deliveryType || deliveryType === 'uzpost') return;
    setSubmitting(true);
    try {
      await submitStandardDelivery(deliveryType as 'yandex' | 'mandarin' | 'bts', selectedFlights);
      setCurrentStep(4);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e?.status === 400 && e?.message?.toLowerCase().includes('profile')) {
        setProfileIncomplete(true);
      } else {
        toast.error(e?.message || t('deliveryRequest.toast.submitError'));
      }
    } finally {
      setSubmitting(false);
    }
  }, [deliveryType, selectedFlights]);

  const handleUzpostSubmit = useCallback(
    async (walletUsed: number, file: File | null) => {
      setSubmitting(true);
      try {
        await submitUzpostDelivery(selectedFlights, walletUsed, file);
        setCurrentStep(4);
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        if (e?.status === 400 && e?.message?.toLowerCase().includes('profile')) {
          setProfileIncomplete(true);
        } else {
          toast.error(e?.message || t('deliveryRequest.toast.submitError'));
        }
      } finally {
        setSubmitting(false);
      }
    },
    [selectedFlights]
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

  // Profile incomplete overlay
  if (profileIncomplete) {
    return (
      <div className="pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setProfileIncomplete(false)}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-white/5 active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">{t('deliveryRequest.headerTitleShort')}</h1>
        </div>
        <ProfileIncompleteAlert
          onGoProfile={onNavigateToProfile}
          onBack={() => setProfileIncomplete(false)}
        />
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={currentStep === 1 ? onBack : goBackStep}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-white/5 active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">{t('deliveryRequest.headerTitle')}</h1>
        </div>
        {onNavigateToHistory && (
          <button
            onClick={onNavigateToHistory}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-xs font-semibold text-gray-600 dark:text-gray-300 active:scale-95 transition-transform hover:bg-gray-200 dark:hover:bg-white/10"
          >
            <Clock className="w-3.5 h-3.5" />
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
        />
      )}

      {currentStep === 3 && deliveryType === 'uzpost' && (
        <StepUzpostPayment
          calcData={calcData}
          loading={calcLoading}
          selectedFlights={selectedFlights}
          submitting={submitting}
          onSubmit={handleUzpostSubmit}
          onBack={goBackStep}
        />
      )}

      {currentStep === 3 && deliveryType && deliveryType !== 'uzpost' && (
        <StepStandardConfirm
          deliveryType={deliveryType}
          selectedFlights={selectedFlights}
          submitting={submitting}
          onSubmit={handleStandardSubmit}
          onBack={goBackStep}
        />
      )}

      {currentStep === 4 && <StepSuccess onGoHome={onBack} />}
    </div>
  );
}
