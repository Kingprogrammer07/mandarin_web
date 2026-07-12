import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Box,
    Calculator,
    CheckCircle,
    CheckCircle2,
    ChevronDown,
    ClipboardCheck,
    FileText,
    MapPin,
    Package,
    PackageCheck,
    Plane,
    ShieldCheck,
    Weight,
    Calendar,
    type LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { getClientFlightHistory, getClientFlightDetails, type CargoItemResponse } from '../../api/services/cargo';
import { useProfile } from '../../hooks/useProfile';
import { useTranslation } from 'react-i18next';
import { computeStepProgress, deriveVisualStatuses, type RawStepStatus } from '@/utils/trackingProgress';

const FlightSummaryCard = ({
    summary,
    isExpanded,
    onToggle
}: {
    summary: {
        flight_name: string;
        last_update: string;
        total_weight: number;
        total_count: number;
    };
    isExpanded: boolean;
    onToggle: () => void;
}) => {
    const { t } = useTranslation();
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onToggle}
            className={`bg-white dark:bg-[#0b1018] rounded-2xl p-4 sm:p-5 shadow-sm border cursor-pointer transition-all duration-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
                isExpanded
                    ? 'border-amber-500/50 dark:border-amber-500/50 ring-2 ring-amber-500/20'
                    : 'border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10'
            }`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-colors ${
                        isExpanded
                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'
                    }`}>
                        <Plane className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg">
                            {summary.flight_name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                                {summary.last_update ? format(new Date(summary.last_update), 'dd.MM.yyyy HH:mm') : t('cargoHistory.noDate')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-6">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">{t('cargoHistory.totalWeight')}</span>
                        <span className="font-black font-mono text-gray-900 dark:text-white text-lg flex items-center gap-1.5">
                            <Weight className="w-4 h-4 text-amber-500" />
                            {t('cargoHistory.weightUnit', { weight: summary.total_weight })}
                        </span>
                    </div>
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">{t('cargoHistory.totalCount')}</span>
                        <span className="font-black font-mono text-gray-900 dark:text-white text-lg flex items-center gap-1.5">
                            <Package className="w-4 h-4 text-sky-500" />
                            {t('cargoHistory.countUnit', { count: summary.total_count })}
                        </span>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 dark:bg-white/5 transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-amber-50 dark:bg-amber-500/10' : ''}`}>
                        <ChevronDown className={`w-5 h-5 ${isExpanded ? 'text-amber-500' : 'text-gray-400'}`} />
                    </div>
                </div>
            </div>

            {/* Mobile Extra Stats Row */}
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between sm:hidden">
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                        <Weight className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-bold font-mono text-gray-900 dark:text-gray-100">{t('cargoHistory.weightUnit', { weight: summary.total_weight })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-700 pl-4">
                        <Package className="w-4 h-4 text-sky-500" />
                        <span className="text-sm font-bold font-mono text-gray-900 dark:text-gray-100">{t('cargoHistory.countUnit', { count: summary.total_count })}</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const getSteps = (item: CargoItemResponse, t: (key: string) => string) => {
    const hasChina = !!item.pre_checkin_date || item.checkin_status === 'pre' || item.checkin_status === 'post';
    const hasUz = !!item.post_checkin_date || item.checkin_status === 'post';
    const hasSent = !!item.is_sent_web;
    const hasTaken = !!item.is_taken_away;

    const rawSteps: Array<{
        id: number;
        label: string;
        icon: LucideIcon;
        rawStatus: RawStepStatus;
    }> = [
        { id: 1, label: t('tracking.steps.step1'), icon: MapPin, rawStatus: hasChina ? 'available' : 'nodata' },
        { id: 2, label: t('tracking.steps.step2'), icon: Plane, rawStatus: hasChina ? (hasUz ? 'available' : 'pending') : 'nodata' },
        { id: 3, label: t('tracking.steps.step3'), icon: ShieldCheck, rawStatus: hasUz ? 'available' : 'nodata' },
        { id: 4, label: t('tracking.steps.step4'), icon: FileText, rawStatus: hasSent ? 'available' : 'nodata' },
        { id: 5, label: t('tracking.steps.step5'), icon: PackageCheck, rawStatus: hasSent ? 'available' : 'pending' },
        { id: 6, label: t('tracking.steps.step6'), icon: CheckCircle, rawStatus: hasTaken ? 'available' : hasSent ? 'pending' : 'nodata' },
    ];

    const visuals = deriveVisualStatuses(rawSteps.map((step) => step.rawStatus));

    return rawSteps.map((step, index) => ({
        id: step.id,
        label: step.label,
        icon: step.icon,
        status: visuals[index],
    }));
};

const formatMoney = (val?: string | number | null) => {
    if (val == null || val === '') return null;
    const num = Number(val);
    return isNaN(num) ? val : num.toLocaleString('ru-RU');
};

const formatDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return format(date, 'dd.MM.yyyy HH:mm');
};

const getCargoStatus = (item: CargoItemResponse) => {
    if (item.is_taken_away) return 'taken';
    if (item.is_sent_web) return 'reportReady';
    if (item.checkin_status === 'post') return 'inUzb';
    if (item.checkin_status === 'pre') return 'inChina';
    return 'pending';
};

const getStatusClass = (status: string) => {
    if (status === 'taken') {
        return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-white/12 dark:bg-white/10 dark:text-slate-200';
    }
    if (status === 'reportReady' || status === 'inUzb') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300';
    }
    if (status === 'inChina') {
        return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300';
    }
    return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.07] dark:text-slate-300';
};

function HistoryCargoCard({ item }: { item: CargoItemResponse }) {
    const { t } = useTranslation();
    const steps = getSteps(item, t);
    const activeStep = steps.find((step) => step.status === 'active') ?? [...steps].reverse().find((step) => step.status === 'completed') ?? steps[0];
    const currentProgress = computeStepProgress(steps.map((step) => step.status));
    const status = getCargoStatus(item);
    const statusClass = getStatusClass(status);
    const checkinDate = formatDate(item.pre_checkin_date);
    const arrivalDate = formatDate(item.post_checkin_date);
    const takenDate = formatDate(item.taken_away_date);
    const relevantDate = takenDate ?? arrivalDate ?? checkinDate;
    const itemName = item.item_name_ru || item.item_name_cn || t('cargoHistory.names.notEntered');

    return (
        <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-white/[0.12] dark:bg-[#0b1018] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_34px_rgba(0,0,0,0.22)]">
            <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                        <p className="text-[11px] font-black uppercase tracking-wide text-gray-400 dark:text-gray-500">
                            {t('tracking.resultLabel')}
                        </p>
                        <h3 className="truncate font-mono text-2xl font-black tracking-normal text-gray-950 dark:text-white">
                            {item.track_code_2 || item.track_code}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusClass}`}>
                                {t(`cargoStatus.${status}`)}
                            </span>
                            {item.flight_name && (
                                <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-300">
                                    {t('cargoHistory.flight', { name: item.flight_name })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                    <div className="mb-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-black text-gray-900 dark:text-white">
                                {activeStep?.label}
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                {activeStep?.status === 'completed' ? t('tracking.stepStatus.completed') : activeStep?.status === 'active' ? t('tracking.stepStatus.active') : t('tracking.stepStatus.upcoming')}
                            </p>
                        </div>
                        <span className="font-mono text-sm font-black text-orange-600 dark:text-orange-300">
                            {currentProgress}%
                        </span>
                    </div>

                    <div className="relative grid grid-cols-6 gap-1">
                        <div className="absolute left-[8%] right-[8%] top-3.5 h-1 rounded-full bg-gray-200 dark:bg-white/10" />
                        <div
                            className="absolute left-[8%] top-3.5 h-1 max-w-[84%] rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                            style={{ width: `${Math.min(currentProgress * 0.84, 84)}%` }}
                        />
                        {steps.map((step) => {
                            const isCompleted = step.status === 'completed';
                            const isActive = step.status === 'active';
                            const Icon = step.icon;

                            return (
                                <div key={step.id} className="relative z-10 flex justify-center">
                                    <span
                                        className={[
                                            'flex size-9 items-center justify-center rounded-xl border text-xs font-black transition',
                                            isCompleted
                                                ? 'border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                                                : isActive
                                                    ? 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/20 ring-4 ring-amber-500/15'
                                                    : 'border-gray-200 bg-white text-gray-300 dark:border-white/10 dark:bg-[#0b1018] dark:text-gray-600',
                                        ].join(' ')}
                                    >
                                        {isCompleted ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-white/10 dark:bg-white/[0.035]">
                    <div className={`absolute inset-y-0 left-0 w-1 ${item.is_taken_away ? 'bg-slate-500' : item.is_sent_web ? 'bg-emerald-500' : 'bg-sky-500'}`} />
                    <div className="space-y-4 pl-1">
                        <div className="flex flex-wrap gap-2">
                            {item.flight_name && <DetailChip icon={Plane} label={t('reports.flight')} value={item.flight_name} />}
                            {relevantDate && <DetailChip icon={Calendar} label={arrivalDate ? t('tracking.arrivalDate') : t('tracking.checkinDate')} value={relevantDate} />}
                            {item.box_number && <DetailChip icon={Box} label={t('cargoHistory.details.boxCount')} value={item.box_number} />}
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <InfoBlock label={t('cargoHistory.names.ru')} value={itemName} />
                            {item.item_name_cn && item.item_name_ru && <InfoBlock label={t('cargoHistory.names.cn')} value={item.item_name_cn} />}
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <MetricBlock icon={Weight} label={t('cargoHistory.details.actualWeight')} value={item.weight_kg ? `${item.weight_kg} kg` : t('cargoHistory.details.notMeasured')} />
                            <MetricBlock icon={Calculator} label={t('cargoHistory.details.count')} value={item.quantity ? `${item.quantity} ta` : '-'} />
                            <MetricBlock
                                icon={MapPin}
                                label={t('cargoHistory.financials.totalPayment')}
                                value={item.total_payment_uzs ? `${formatMoney(item.total_payment_uzs)} so'm` : t('cargoHistory.financials.notCalculated')}
                                accent
                            />
                            <MetricBlock
                                icon={ClipboardCheck}
                                label={t('cargoHistory.financials.pricePerKg')}
                                value={item.price_per_kg_uzs ? `${formatMoney(item.price_per_kg_uzs)} so'm` : '-'}
                            />
                        </div>

                        {(checkinDate || arrivalDate || takenDate || item.exchange_rate) && (
                            <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-3 text-[11px] font-bold text-gray-500 dark:border-white/10 dark:text-gray-400">
                                {checkinDate && <span>CN: {checkinDate}</span>}
                                {arrivalDate && <span>UZ: {arrivalDate}</span>}
                                {takenDate && <span>{t('cargoStatus.taken')}: {takenDate}</span>}
                                {item.exchange_rate && <span>{t('cargoHistory.financials.exchangeRate', { rate: formatMoney(item.exchange_rate) })}</span>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function DetailChip({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
    return (
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-300">
            <Icon className="size-3.5 shrink-0 text-orange-500" />
            <span className="shrink-0 text-gray-400">{label}:</span>
            <span className="min-w-0 truncate">{value}</span>
        </span>
    );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#0b1018]">
            <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-gray-400">{label}</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
    );
}

function MetricBlock({
    icon: Icon,
    label,
    value,
    accent = false,
}: {
    icon: LucideIcon;
    label: string;
    value: string | number | null;
    accent?: boolean;
}) {
    return (
        <div className={`rounded-xl border p-3 ${accent ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/8' : 'border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b1018]'}`}>
            <p className={`mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide ${accent ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-400'}`}>
                <Icon className="size-3.5" />
                {label}
            </p>
            <p className={`font-mono text-sm font-black ${accent ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-900 dark:text-white'}`}>
                {value}
            </p>
        </div>
    );
}

const FlightDetailsSection = ({ clientCode, flightName, isExpanded }: { clientCode: string, flightName: string, isExpanded: boolean }) => {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const { data, isLoading, isError } = useQuery({
        queryKey: ['flightDetails', clientCode, flightName, page],
        queryFn: () => getClientFlightDetails(clientCode, flightName, page),
        enabled: isExpanded,
        staleTime: 1000 * 60 * 5,
    });

    if (!isExpanded) return null;

    return (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-3">
            {isLoading ? (
                <div className="flex flex-col gap-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 dark:bg-white/5 rounded-xl animate-pulse" />)}
                </div>
            ) : isError ? (
                <div className="text-center py-6 text-red-500">{t('cargoHistory.error')}</div>
            ) : (data?.items?.length ?? 0) === 0 ? (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400">{t('cargoHistory.emptyFlight')}</div>
            ) : (
                <div className="flex flex-col gap-3">
                    {data?.items.map((item: CargoItemResponse) => (
                        <HistoryCargoCard key={item.id} item={item} />
                    ))}
                    {data && data.total > data.size && (
                        <div className="flex justify-center pt-2">
                            <button className="text-sm font-bold text-orange-600 dark:text-orange-300 bg-orange-50 active:scale-[0.98] dark:bg-orange-400/10 px-6 py-2.5 rounded-xl transition-colors" onClick={() => setPage(p => p + 1)}>
                                {t('cargoHistory.loadMore')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
};

export default function ClientCargoHistory() {
    const { t } = useTranslation();
    const { data: profile, isLoading: isProfileLoading } = useProfile();
    const [expandedFlight, setExpandedFlight] = useState<string | null>(null);
    const clientCode = profile?.client_code;

    const { data: history, isLoading: isHistoryLoading } = useQuery({
        queryKey: ['flightHistory', clientCode],
        queryFn: () => getClientFlightHistory(clientCode!),
        enabled: !!clientCode,
        staleTime: 1000 * 60 * 5,
        placeholderData: keepPreviousData,
    });

    if (isProfileLoading || (isHistoryLoading && !history)) {
        return <div className="flex flex-col gap-4 p-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 dark:bg-white/5 rounded-2xl animate-pulse" />)}</div>;
    }

    if (!history || history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4"><FileText className="w-8 h-8 text-gray-400" /></div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('cargoHistory.emptyState.title')}</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-xs mx-auto">{t('cargoHistory.emptyState.desc')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 py-4 pb-24">
            <div className="flex flex-col gap-3">
                <AnimatePresence>
                    {history.map((flight) => (
                        <div key={flight.flight_name} className="relative">
                            <FlightSummaryCard summary={{ flight_name: flight.flight_name, last_update: flight.last_update ?? '', total_weight: flight.total_weight, total_count: flight.total_count }} isExpanded={expandedFlight === flight.flight_name} onToggle={() => setExpandedFlight(prev => prev === flight.flight_name ? null : flight.flight_name)} />
                            <AnimatePresence>
                                {expandedFlight === flight.flight_name && <FlightDetailsSection clientCode={clientCode!} flightName={flight.flight_name} isExpanded={true} />}
                            </AnimatePresence>
                        </div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
