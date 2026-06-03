import { useState, useCallback, memo, lazy, Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProfile } from '@/hooks/useProfile';
import { reportService, type ReportFlightSummary, type ReportResponse } from '@/api/services/reportService';
import { trackCargo, type TrackCodeSearchResponse } from '@/api/services/cargo';
import { TrackResultCard } from '@/pages/dashboard/components/TrackResultCard';
import { UniqueBackground } from '@/components/ui/UniqueBackground';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Plane,
    Calendar,
    Package,
    DollarSign,
    Scale,
    ChevronLeft,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    CreditCard,
    CheckCircle2,
    Clock,
    XCircle,
    RefreshCw,
    Search,
    ArrowRight,
    Truck,
    Tag,
} from 'lucide-react';
import { format } from 'date-fns';
import { uz } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
const MakePaymentModal = lazy(() => import('@/components/modals/MakePaymentModal'));
import { useTranslation } from 'react-i18next';
import { clearNbuReturnParams } from '@/utils/nbuReturnContext';

const PAGE_SIZE = 10;
const TRACK_PREVIEW_LIMIT = 3;

// --- Types ---

type ViewState = 'list' | 'detail';

interface FlightCardProps {
    flight: ReportFlightSummary;
    onClick: () => void;
}

interface FlightActionBarProps {
    reports: ReportResponse[];
    onPay: (amount: number) => void;
    onDeliveryRequest?: () => void;
}

const FlightActionBar = memo(({ reports, onPay, onDeliveryRequest }: FlightActionBarProps) => {
    const { t } = useTranslation();
    // `expected_amount` / `paid_amount` are FLIGHT-LEVEL figures (sourced from the
    // flight's transaction row) that the backend repeats on every per-cargo report
    // item. Summing them double-counts the debt once per cargo box — take the
    // flight-level value a single time instead.
    const totalExpected = Math.max(0, ...reports.map((r) => r.expected_amount ?? 0));
    const totalPaid = Math.max(0, ...reports.map((r) => r.paid_amount ?? 0));
    const totalRemaining = Math.max(0, totalExpected - totalPaid);
    const allTakenAway = reports.every((r) => r.is_taken_away);
    const anyUnpaid = reports.some((r) => r.payment_status !== 'paid' && (r.expected_amount ?? 0) - (r.paid_amount ?? 0) > 0);
    const firstReport = reports[0];

    // Taken away — no action, just status
    if (allTakenAway) {
        return (
            <div className="sticky bottom-0 z-10 bg-white/80 dark:bg-[#06080d]/85 backdrop-blur-md border-t border-gray-100 dark:border-white/5 px-4 py-4 -mx-4">
                <div className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-500/10 rounded-xl border border-slate-200 dark:border-slate-500/20">
                    <CheckCircle2 className="w-5 h-5 text-slate-500" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {t('reports.takenAway', 'Olib ketilgan')}
                        {firstReport?.taken_away_date && (
                            <span className="font-normal text-slate-400 ml-1">
                                ({format(new Date(firstReport.taken_away_date), 'dd MMM, HH:mm', { locale: uz })})
                            </span>
                        )}
                    </span>
                </div>
            </div>
        );
    }

    // Not fully paid — show pay button
    if (anyUnpaid && totalRemaining > 0) {
        return (
            <div className="sticky bottom-0 z-10 bg-white/80 dark:bg-[#06080d]/85 backdrop-blur-md border-t border-gray-100 dark:border-white/5 px-4 py-4 -mx-4 space-y-2.5">
                {/* Amount badges */}
                <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08]">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            {t('reports.totalAmountShort', 'Jami')}
                        </span>
                        <span className="text-sm font-black text-gray-800 dark:text-gray-200">
                            {t('reports.currencySum', { amount: totalExpected.toLocaleString('uz-UZ'), defaultValue: '{{amount}} so‘m' })}
                        </span>
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                        <span className="text-[10px] font-bold text-red-400 dark:text-red-400 uppercase tracking-wider">
                            {t('reports.remainingAmountShort', 'Qoldiq')}
                        </span>
                        <span className="text-sm font-black text-red-600 dark:text-red-400">
                            {t('reports.currencySum', { amount: totalRemaining.toLocaleString('uz-UZ'), defaultValue: '{{amount}} so‘m' })}
                        </span>
                    </div>
                </div>
                <Button
                    className={`w-full rounded-2xl font-black text-[16px] text-white shadow-xl shadow-orange-500/25 active:scale-[0.97] transition-all py-6 h-auto
                        ${firstReport?.payment_status === 'unpaid'
                            ? 'bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                        }`}
                    onClick={() => onPay(totalRemaining)}
                >
                    <CreditCard className="w-5 h-5 mr-2" />
                    {t('reports.payAll', "Barchasiga to'lov qilish")}
                </Button>
            </div>
        );
    }

    // Fully paid — show delivery request button
    if (!anyUnpaid && onDeliveryRequest) {
        return (
            <div className="sticky bottom-0 z-10 bg-white/80 dark:bg-[#06080d]/85 backdrop-blur-md border-t border-gray-100 dark:border-white/5 px-4 py-4 -mx-4">
                <Button
                    className="w-full rounded-xl font-bold text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                    onClick={onDeliveryRequest}
                >
                    <Truck className="w-4 h-4 mr-2" />
                    {t('reports.requestDelivery', 'Zayafka qoldirish')}
                </Button>
            </div>
        );
    }

    return null;
});

interface ReportHistoryItemProps {
    report: ReportResponse;
    onTrackClick: (code: string) => void;
    onImageClick: (url: string) => void;
}

// --- Components ---

const FlightCard = memo(({ flight, onClick }: FlightCardProps) => {
    const { t } = useTranslation();
    const label = t('reports.cargoReport', 'Yuk hisoboti');
    const statusConfig = {
        new: {
            label: t('reports.statusNew', 'Yangi'),
            icon: Package,
            className: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-300/25 dark:bg-orange-400/12 dark:text-orange-100',
        },
        partial: {
            label: t('reports.statusPartial', 'Qisman'),
            icon: Clock,
            className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/25 dark:bg-amber-400/12 dark:text-amber-100',
        },
        paid: {
            label: t('reports.statusPaid', "To'langan"),
            icon: CheckCircle2,
            className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/25 dark:bg-emerald-400/12 dark:text-emerald-100',
        },
        taken_away: {
            label: t('reports.statusTakenAway', 'Olib ketilgan'),
            icon: CheckCircle2,
            className: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/12 dark:bg-white/[0.07] dark:text-slate-200',
        },
    } satisfies Record<ReportFlightSummary['payment_status'], {
        label: string;
        icon: typeof Package;
        className: string;
    }>;
    const status = statusConfig[flight.payment_status];
    const StatusIcon = status.icon;

    return (
        <motion.button
            type="button"
            layoutId={`flight-${flight.flight_name}`}
            onClick={onClick}
            whileTap={{ scale: 0.985 }}
            aria-label={`${flight.flight_name} ${label} ${status.label}`}
            className="
                w-full min-h-[84px] grid grid-cols-[48px_minmax(0,1fr)_28px] items-center gap-3
                rounded-[19px] px-3 py-3 text-left select-none
                border transition-colors duration-150
                bg-[var(--flight-card-bg)] text-[var(--flight-card-text)]
                border-[var(--flight-card-border)] shadow-[var(--flight-card-shadow)]
                active:bg-[var(--flight-card-active-bg)] active:border-[var(--flight-card-active-border)]
                dark:ring-1 dark:ring-white/[0.03] dark:active:ring-orange-300/20
                [--flight-card-bg:#ffffff]
                [--flight-card-text:#0f172a]
                [--flight-card-border:#e2e8f0]
                [--flight-card-shadow:0_1px_3px_rgba(15,23,42,0.06)]
                [--flight-card-active-bg:#fff7ed]
                [--flight-card-active-border:rgba(249,115,22,0.26)]
                dark:[--flight-card-bg:linear-gradient(180deg,rgba(255,255,255,0.062),rgba(255,255,255,0.026)),radial-gradient(circle_at_0%_0%,rgba(255,138,31,0.10),transparent_36%),rgba(15,21,31,0.88)]
                dark:[--flight-card-text:#f8fafc]
                dark:[--flight-card-border:rgba(255,255,255,0.13)]
                dark:[--flight-card-shadow:inset_0_1px_0_rgba(255,255,255,0.08),0_14px_30px_rgba(0,0,0,0.28)]
                dark:[--flight-card-active-bg:linear-gradient(180deg,rgba(255,138,31,0.11),rgba(255,255,255,0.03)),rgba(18,25,36,0.94)]
                dark:[--flight-card-active-border:rgba(253,186,116,0.30)]
            "
        >
            <span className="
                flex h-12 w-12 items-center justify-center rounded-2xl
                border border-[var(--flight-icon-border)] bg-[var(--flight-icon-bg)] text-[var(--flight-icon-text)]
                [--flight-icon-bg:#fff7ed] [--flight-icon-border:#fed7aa] [--flight-icon-text:#ea580c]
                dark:[--flight-icon-bg:linear-gradient(145deg,rgba(255,138,31,0.28),rgba(251,146,60,0.11))]
                dark:[--flight-icon-border:rgba(253,186,116,0.25)] dark:[--flight-icon-text:#fff7ed]
                dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]
            ">
                <Plane className="h-[22px] w-[22px]" />
            </span>

            <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[17px] font-black leading-tight tracking-normal">
                        {flight.flight_name}
                    </span>
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-extrabold leading-none ${status.className}`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                    </span>
                </span>
                <span className="mt-1.5 block truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {label} - {t('reports.viewDetails', "Batafsil ko'rish")}
                </span>
            </span>

            <span className="
                flex h-7 w-7 items-center justify-center rounded-full border bg-slate-50 text-slate-400
                border-slate-200/70 dark:border-white/10 dark:bg-white/[0.07] dark:text-orange-100/70
                dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]
            ">
                <ArrowRight className="h-4 w-4" />
            </span>
        </motion.button>
    );
});

const ReportHistoryItem = memo(({ report, onTrackClick, onImageClick }: ReportHistoryItemProps) => {
    const { t } = useTranslation();
    const [areTracksExpanded, setAreTracksExpanded] = useState(false);
    const sentDate = report.is_sent_web_date
        ? format(new Date(report.is_sent_web_date), 'dd MMMM, HH:mm', { locale: uz })
        : t('reports.unknownDate');
    const cargoItems = report.cargo_items ?? [];
    const hasCargoItems = cargoItems.length > 0;
    const visibleCargoItems = areTracksExpanded ? cargoItems : cargoItems.slice(0, TRACK_PREVIEW_LIMIT);
    const hiddenCargoItemCount = Math.max(0, cargoItems.length - TRACK_PREVIEW_LIMIT);
    const fallbackTrackCodes = !hasCargoItems ? report.track_codes : [];
    const visibleFallbackTrackCodes = areTracksExpanded
        ? fallbackTrackCodes
        : fallbackTrackCodes.slice(0, TRACK_PREVIEW_LIMIT);
    const hiddenFallbackTrackCount = Math.max(0, fallbackTrackCodes.length - TRACK_PREVIEW_LIMIT);
    const hiddenTrackCount = hasCargoItems ? hiddenCargoItemCount : hiddenFallbackTrackCount;
    const hasHiddenTracks = hiddenTrackCount > 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-white/5 backdrop-blur-md rounded-3xl p-5 border border-gray-100 dark:border-white/5 shadow-sm space-y-4"
        >
            {/* Header */}
            <div className="pb-3 border-b border-gray-100 dark:border-white/5 space-y-3">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                        <Package className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{t('reports.cargoReport')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {sentDate}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Pickup status badge */}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${
                        report.is_taken_away
                            ? 'bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20 text-slate-600 dark:text-slate-400'
                            : 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-300'
                    }`}>
                        {report.is_taken_away ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {report.is_taken_away
                            ? t('reports.takenAway', 'Olib ketilgan')
                            : t('reports.notTakenAway', 'Olib ketilmagan')}
                    </div>
                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
                        style={{
                            backgroundColor: report.payment_status === 'paid' ? 'rgba(16, 185, 129, 0.1)' :
                                report.payment_status === 'partial' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            borderColor: report.payment_status === 'paid' ? 'rgba(16, 185, 129, 0.2)' :
                                report.payment_status === 'partial' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: report.payment_status === 'paid' ? '#10b981' :
                                report.payment_status === 'partial' ? '#f59e0b' : '#ef4444'
                        }}
                    >
                        {report.payment_status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> :
                            report.payment_status === 'partial' ? <Clock className="w-3 h-3" /> :
                                <XCircle className="w-3 h-3" />}
                        {report.payment_status === 'paid' ? t('reports.status.paid') :
                            report.payment_status === 'partial' ? t('reports.status.partial') : t('reports.status.unpaid')}
                    </div>
                </div>
            </div>

            {/* Info Grid — aggregate totals */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-black/20 rounded-2xl p-3">
                    <span className="text-[10px] uppercase text-gray-400 font-semibold">{t('reports.weight')}</span>
                    <div className="flex items-center gap-1 text-gray-900 dark:text-white font-bold text-base mt-0.5">
                        <Scale className="w-4 h-4 text-orange-500" />
                        {report.total_weight} <span className="text-xs font-normal text-gray-500">kg</span>
                    </div>
                </div>
                <div className="bg-gray-50 dark:bg-black/20 rounded-2xl p-3">
                    <span className="text-[10px] uppercase text-gray-400 font-semibold">{t('reports.totalPrice')}</span>
                    <div className="flex items-start gap-1 text-gray-900 dark:text-white font-bold text-base mt-0.5">
                        <DollarSign className="w-4 h-4 text-emerald-500 mt-1" />
                        <div className="flex flex-col">
                            <span>
                                {report.total_price_uzs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                <span className="text-xs font-normal text-gray-500 ml-1">so'm</span>
                            </span>
                            <span className="text-xs font-normal text-gray-400">
                                ${report.total_price_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Per-track-code breakdown (from cargo_items) */}
            {hasCargoItems && (
                <div className="space-y-2">
                    <p className="text-[10px] uppercase text-gray-400 font-semibold">{t('reports.trackCodes')}</p>
                    <div className="space-y-2">
                        {visibleCargoItems.map((item, i) => (
                            <button
                                key={i}
                                onClick={() => onTrackClick(item.track_code)}
                                className="w-full bg-gray-50 dark:bg-black/20 rounded-2xl p-3 text-left active:scale-[0.99] hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-all"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0 flex items-center gap-2">
                                        <Tag className="w-3.5 h-3.5 text-orange-500" />
                                        <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">
                                            {item.track_code}
                                        </span>
                                    </div>
                                    <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                        <Scale className="w-3 h-3" />
                                        {item.weight_kg} kg
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                    {hasHiddenTracks && (
                        <button
                            type="button"
                            onClick={() => setAreTracksExpanded((value) => !value)}
                            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-orange-200/70 bg-orange-50/70 px-3 py-2 text-xs font-bold text-orange-600 active:scale-[0.98] transition-all dark:border-orange-400/20 dark:bg-orange-400/10 dark:text-orange-200"
                        >
                            {areTracksExpanded ? (
                                <>
                                    <ChevronUp className="w-4 h-4" />
                                    {t('reports.showLessTracks', 'Kamroq ko‘rsatish')}
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="w-4 h-4" />
                                    {t('reports.showMoreTracks', { count: hiddenTrackCount, defaultValue: 'Yana {{count}} ta ko‘rsatish' })}
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}

            {/* Fallback track codes when cargo_items is empty */}
            {!hasCargoItems && fallbackTrackCodes.length > 0 && (
                <div>
                    <p className="text-[10px] uppercase text-gray-400 font-semibold mb-2">{t('reports.trackCodes')}</p>
                    <div className="flex flex-wrap gap-2">
                        {visibleFallbackTrackCodes.map((code, i) => (
                            <button
                                key={i}
                                onClick={() => onTrackClick(code)}
                                className="px-3 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-gray-700 dark:text-gray-200 text-xs font-mono rounded-lg transition-colors border border-transparent hover:border-orange-200 dark:hover:border-orange-500/30 active:scale-95"
                            >
                                {code}
                            </button>
                        ))}
                    </div>
                    {hasHiddenTracks && (
                        <button
                            type="button"
                            onClick={() => setAreTracksExpanded((value) => !value)}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-xl border border-orange-200/70 bg-orange-50/70 px-3 py-2 text-xs font-bold text-orange-600 active:scale-[0.98] transition-all dark:border-orange-400/20 dark:bg-orange-400/10 dark:text-orange-200"
                        >
                            {areTracksExpanded ? (
                                <>
                                    <ChevronUp className="w-4 h-4" />
                                    {t('reports.showLessTracks', 'Kamroq ko‘rsatish')}
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="w-4 h-4" />
                                    {t('reports.showMoreTracks', { count: hiddenTrackCount, defaultValue: 'Yana {{count}} ta ko‘rsatish' })}
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}

            {/* Photos Grid */}
            {report.photo_file_ids && report.photo_file_ids.length > 0 && (
                <div className="mb-4">
                    <p className="text-[10px] uppercase text-gray-400 font-semibold mb-2">{t('reports.photos')}</p>
                    <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                        {report.photo_file_ids.map((photoId, i) => (
                            <div 
                                key={i} 
                                onClick={() => onImageClick(photoId)}
                                className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 relative group cursor-pointer"
                            >
                                <img
                                    src={`${photoId}`}
                                    alt={`Cargo photo ${i + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://placehold.co/400x400/png?text=Rasm+Topilmadi';
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </motion.div>
    );
});

// --- Image Preview Modal ---
interface ImagePreviewModalProps {
    src: string | null;
    onClose: () => void;
}

const ImagePreviewModal = ({ src, onClose }: ImagePreviewModalProps) => (
    <AnimatePresence>
        {src && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 cursor-zoom-out"
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 sm:top-8 sm:right-8 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors z-50"
                >
                    <XCircle className="w-8 h-8" />
                </button>
                <motion.img
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    src={src}
                    alt="Preview"
                    className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl cursor-default"
                    onClick={(e) => e.stopPropagation()}
                />
            </motion.div>
        )}
    </AnimatePresence>
);

// --- Custom Drawer Component ---
interface BottomDrawerProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

const BottomDrawer = ({ open, onClose, children }: BottomDrawerProps) => (
    <AnimatePresence>
        {open && (
            <>
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
                />
                {/* Drawer Panel */}
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#151515] rounded-t-[2rem] max-h-[85vh] flex flex-col shadow-2xl"
                >
                    {/* Handle */}
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mt-4 mb-2 flex-shrink-0" />

                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-10">
                        {children}
                    </div>
                </motion.div>
            </>
        )}
    </AnimatePresence>
);

interface UserReportsPageProps {
    onBack?: () => void;
    onNavigateToDelivery?: () => void;
}

export default function UserReportsPage({ onBack, onNavigateToDelivery }: UserReportsPageProps) {
    const { data: user, isLoading: isUserLoading, isError: isUserError } = useProfile();
    const { t } = useTranslation();

    // State
    const [selectedFlight, setSelectedFlight] = useState<string | null>(null);
    const view: ViewState = selectedFlight ? 'detail' : 'list';

    // Track Drawer State
    const [selectedTrackCode, setSelectedTrackCode] = useState<string | null>(null);
    const [trackData, setTrackData] = useState<TrackCodeSearchResponse | null>(null);
    const [isTrackLoading, setIsTrackLoading] = useState(false);

    // Payment Modal State
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [paymentFlightName, setPaymentFlightName] = useState<string | null>(null);

    // Image Preview State
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Pagination sizes — grow by PAGE_SIZE on each "Load more" click
    const [flightsFetchSize, setFlightsFetchSize] = useState(PAGE_SIZE);
    const [historyFetchSize, setHistoryFetchSize] = useState(PAGE_SIZE);

    // Reset history page size when the selected flight changes
    useEffect(() => { setHistoryFetchSize(PAGE_SIZE); }, [selectedFlight]);

    // --- Data Fetching (TanStack Query) ---

    // 1. Fetch Flights
    const {
        data: flights = [],
        isLoading: isLoadingFlights,
        isFetching: isFetchingMoreFlights,
        refetch: refetchFlights,
        isRefetching: isRefetchingFlights
    } = useQuery({
        queryKey: ['webFlights', user?.client_code, flightsFetchSize],
        queryFn: () => reportService.getWebFlights(user!.client_code, 1, flightsFetchSize),
        enabled: !!user?.client_code,
        staleTime: 5 * 60 * 1000,
    });

    // 2. Fetch History (Only when flight selected)
    const {
        data: history = [],
        isLoading: isLoadingHistory,
        isFetching: isFetchingMoreHistory,
        refetch: refetchHistory,
        isRefetching: isRefetchingHistory
    } = useQuery({
        queryKey: ['webHistory', user?.client_code, selectedFlight, historyFetchSize],
        queryFn: () => reportService.getWebHistory(user!.client_code, selectedFlight!, 1, historyFetchSize),
        enabled: !!user?.client_code && !!selectedFlight,
        staleTime: 5 * 60 * 1000,
    });

    const hasMoreFlights = flights.length === flightsFetchSize;
    const hasMoreHistory = history.length === historyFetchSize;
    const isLoadingMoreFlights = isFetchingMoreFlights && !isLoadingFlights;
    const isLoadingMoreHistory = isFetchingMoreHistory && !isLoadingHistory;

    // --- Handlers ---

    const handleRefresh = () => {
        if (view === 'detail' && selectedFlight) {
            setHistoryFetchSize(PAGE_SIZE);
            refetchHistory();
        } else {
            setFlightsFetchSize(PAGE_SIZE);
            refetchFlights();
        }
    };

    const handleLoadMoreFlights = () => setFlightsFetchSize(s => s + PAGE_SIZE);
    const handleLoadMoreHistory = () => setHistoryFetchSize(s => s + PAGE_SIZE);

    const isRefreshing = isRefetchingFlights || isRefetchingHistory;

    const handleTrackClick = async (code: string) => {
        setSelectedTrackCode(code);
        setIsTrackLoading(true);
        setTrackData(null);
        try {
            const data = await trackCargo(code);
            setTrackData(data);
        } catch (error) {
            console.error("Track error", error);
            toast.error(t('reports.trackCodeNotFound'));
            // Don't close immediately, let user see empty state or error
        } finally {
            setIsTrackLoading(false);
        }
    };

    const openPaymentModal = useCallback(() => {
        if (!selectedFlight) {
            toast.error(t('reports.noFlightSelected'));
            return;
        }
        setPaymentFlightName(selectedFlight);
        setIsPaymentOpen(true);
    }, [selectedFlight, t]);

    const handlePay = useCallback(
        () => openPaymentModal(),
        [openPaymentModal],
    ) as (amount: number) => void;

    const handlePaymentClose = useCallback(() => {
        setIsPaymentOpen(false);
        setPaymentFlightName(null);
        // Refresh history after payment
        if (selectedFlight) refetchHistory();
    }, [selectedFlight, refetchHistory]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('nbuReturn') !== 'payment') return;

        const flightName = params.get('nbuFlight');
        if (flightName) {
            setSelectedFlight(flightName);
            setPaymentFlightName(flightName);
        }
        setIsPaymentOpen(true);
        clearNbuReturnParams();
    }, []);

    // --- Render Helpers ---

    if (isUserLoading) {
        return (
            <div className="container max-w-md mx-auto p-4 space-y-4 pt-24">
                <Skeleton className="h-10 w-1/2 rounded-xl" />
                <Skeleton className="h-32 w-full rounded-3xl" />
                <Skeleton className="h-32 w-full rounded-3xl" />
            </div>
        );
    }

    if (isUserError || !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center pt-24">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-lg font-bold">{t('reports.errorTitle')}</h3>
                <Button onClick={() => window.location.reload()} className="mt-4" variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" /> {t('reports.retry')}
                </Button>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen bg-gray-50 dark:bg-[#06080d] text-gray-900 dark:text-white font-sans transition-colors duration-300 pt-24 pb-28"
        >
            <UniqueBackground />

            <div className="container max-w-lg mx-auto px-4 relative z-10">

                {/* Header / Navigation */}
                <div className="mb-6 flex items-center justify-between">
                    {view === 'detail' ? (
                        <button
                            onClick={() => setSelectedFlight(null)}
                            className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors"
                        >
                            <div className="p-2 rounded-full bg-white/50 dark:bg-white/5 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors">
                                <ChevronLeft className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-lg">{t('reports.back')}</span>
                        </button>
                    ) : (
                        <div className="flex items-center gap-3 min-w-0">
                            {onBack && (
                                <button
                                    onClick={onBack}
                                    className="flex-shrink-0 p-2 rounded-full bg-white/50 dark:bg-white/5 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors text-gray-500 dark:text-gray-400 hover:text-orange-500"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                            )}
                            <div className="min-w-0">
                                <h1 className="text-3xl font-black bg-gradient-to-r from-orange-500 to-amber-600 bg-clip-text text-transparent">
                                    {t('reports.title')}
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                    {t('reports.subtitle')}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Refresh Button */}
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-3 rounded-full bg-white/50 dark:bg-white/5 hover:bg-orange-100 dark:hover:bg-orange-500/20 active:scale-90 transition-all text-orange-500 dark:text-orange-400"
                    >
                        <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {view === 'list' ? (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="grid grid-cols-1 gap-4"
                        >
                            {isLoadingFlights ? (
                                [1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-3xl bg-gray-200 dark:bg-white/5" />)
                            ) : flights.length > 0 ? (
                                <>
                                    {flights.map(flight => (
                                        <FlightCard
                                            key={flight.flight_name}
                                            flight={flight}
                                            onClick={() => setSelectedFlight(flight.flight_name)}
                                        />
                                    ))}
                                    {hasMoreFlights && (
                                        <button
                                            onClick={handleLoadMoreFlights}
                                            disabled={isLoadingMoreFlights}
                                            className="w-full py-3 rounded-2xl border border-gray-200 dark:border-white/10 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                                        >
                                            {isLoadingMoreFlights ? t('reports.loading') : t('reports.loadMore')}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-20 text-gray-400">
                                    <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>{t('reports.noReports')}</p>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="detail"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 50 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-4"
                        >
                            {/* Detail Title */}
                            <div className="flex items-center gap-3 mb-2">
                                <span className="w-1.5 h-6 bg-orange-500 rounded-full" />
                                <h2 className="text-xl font-bold">{t('reports.details', { flight: selectedFlight })}</h2>
                            </div>

                            {isLoadingHistory ? (
                                [1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-3xl bg-gray-200 dark:bg-white/5" />)
                            ) : history.length > 0 ? (
                                <div className="space-y-4">
                                    {history.map((item, idx) => (
                                        <ReportHistoryItem
                                            key={idx}
                                            report={item}
                                            onTrackClick={handleTrackClick}
                                            onImageClick={setPreviewImage}
                                        />
                                    ))}
                                    {hasMoreHistory && (
                                        <button
                                            onClick={handleLoadMoreHistory}
                                            disabled={isLoadingMoreHistory}
                                            className="w-full py-3 rounded-2xl border border-gray-200 dark:border-white/10 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                                        >
                                            {isLoadingMoreHistory ? t('reports.loading') : t('reports.loadMore')}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-10 opacity-50">{t('reports.notFound')}</div>
                            )}

                            {/* Single bottom action bar for the whole flight */}
                            {!isLoadingHistory && history.length > 0 && (
                                <FlightActionBar
                                    reports={history}
                                    onPay={handlePay}
                                    onDeliveryRequest={onNavigateToDelivery}
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Payment Modal — lazy chunk loads only when first opened */}
            {isPaymentOpen && (
                <Suspense fallback={null}>
                    <MakePaymentModal
                        isOpen={isPaymentOpen}
                        onClose={handlePaymentClose}
                        preselectedFlightName={paymentFlightName}
                    />
                </Suspense>
            )}

            {/* Custom Bottom Drawer for Track Details */}
            <BottomDrawer open={!!selectedTrackCode} onClose={() => setSelectedTrackCode(null)}>
                <div className="text-left mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                        <Search className="w-5 h-5 text-orange-500" />
                        {t('reports.searchResult')}
                    </h3>
                </div>

                {isTrackLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full rounded-2xl" />
                        <Skeleton className="h-48 w-full rounded-2xl" />
                    </div>
                ) : trackData ? (
                    <TrackResultCard data={trackData} />
                ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                        <Search className="w-16 h-16 opacity-20 mb-4" />
                        <p>{t('reports.notFound')}</p>
                    </div>
                )}
            </BottomDrawer>

            {/* Image Preview Modal */}
            <ImagePreviewModal
                src={previewImage}
                onClose={() => setPreviewImage(null)}
            />
        </div>
    );
}
