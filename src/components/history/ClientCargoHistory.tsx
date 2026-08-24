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
            className={`bg-mc-surface rounded-mc-lg p-3.5 shadow-[var(--mc-shadow-card)] border cursor-pointer transition-colors duration-200 ${
                isExpanded
                    ? 'border-mc-brand/35 ring-2 ring-mc-brand/15'
                    : 'border-mc-border'
            }`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-mc-md flex items-center justify-center transition-colors ${
                        isExpanded
                            ? 'bg-mc-brand-soft text-mc-brand'
                            : 'bg-mc-surface-2 text-mc-text-2'
                    }`}>
                        <Plane className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-mc-text text-base sm:text-lg">
                            {summary.flight_name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-mc-text-2 mt-0.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                                {summary.last_update ? format(new Date(summary.last_update), 'dd.MM.yyyy HH:mm') : t('cargoHistory.noDate')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-6">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-mc-text-3">{t('cargoHistory.totalWeight')}</span>
                        <span className="font-black font-mono text-mc-text text-lg flex items-center gap-1.5">
                            <Weight className="w-4 h-4 text-mc-brand" />
                            {t('cargoHistory.weightUnit', { weight: summary.total_weight })}
                        </span>
                    </div>
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-mc-text-3">{t('cargoHistory.totalCount')}</span>
                        <span className="font-black font-mono text-mc-text text-lg flex items-center gap-1.5">
                            <Package className="w-4 h-4 text-mc-brand" />
                            {t('cargoHistory.countUnit', { count: summary.total_count })}
                        </span>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-mc-surface-2 transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-mc-warn-soft' : ''}`}>
                        <ChevronDown className={`w-5 h-5 ${isExpanded ? 'text-mc-brand' : 'text-mc-text-3'}`} />
                    </div>
                </div>
            </div>

            {/* Mobile Extra Stats Row */}
            <div className="mt-4 pt-3 border-t border-mc-border flex items-center justify-between sm:hidden">
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                        <Weight className="w-4 h-4 text-mc-brand" />
                        <span className="text-sm font-bold font-mono text-mc-text">{t('cargoHistory.weightUnit', { weight: summary.total_weight })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 border-l border-mc-border pl-4">
                        <Package className="w-4 h-4 text-mc-brand" />
                        <span className="text-sm font-bold font-mono text-mc-text">{t('cargoHistory.countUnit', { count: summary.total_count })}</span>
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
        return 'border-mc-border bg-mc-surface-2 text-mc-text-2';
    }
    if (status === 'reportReady' || status === 'inUzb') {
        return 'border-mc-success/25 bg-mc-success/12 text-mc-success';
    }
    if (status === 'inChina') {
        return 'border-mc-brand/25 bg-mc-brand-soft text-mc-brand';
    }
    return 'border-mc-border bg-mc-surface-2 text-mc-text-2';
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
        <div className="overflow-hidden rounded-mc-lg border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]">
            <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                        <p className="text-[11px] font-black uppercase tracking-wide text-mc-text-3">
                            {t('tracking.resultLabel')}
                        </p>
                        <h3 className="truncate font-mono text-2xl font-black tracking-normal text-mc-text">
                            {item.track_code_2 || item.track_code}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusClass}`}>
                                {t(`cargoStatus.${status}`)}
                            </span>
                            {item.flight_name && (
                                <span className="rounded-full border border-mc-border bg-mc-surface-2 px-2.5 py-1 text-xs font-bold text-mc-text-2 dark:border-white/10 dark:bg-white/[0.06] dark:text-mc-text-3">
                                    {t('cargoHistory.flight', { name: item.flight_name })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-mc-lg border border-mc-border bg-mc-surface-2/80 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                    <div className="mb-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-black text-mc-text">
                                {activeStep?.label}
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-mc-text-2">
                                {activeStep?.status === 'completed' ? t('tracking.stepStatus.completed') : activeStep?.status === 'active' ? t('tracking.stepStatus.active') : t('tracking.stepStatus.upcoming')}
                            </p>
                        </div>
                        <span className="font-mono text-[13px] font-extrabold tabular-nums text-mc-brand">
                            {currentProgress}%
                        </span>
                    </div>

                    <div className="relative grid grid-cols-6 gap-1">
                        <div className="absolute left-[8%] right-[8%] top-3.5 h-1 rounded-full bg-mc-surface-2" />
                        <div
                            className="absolute left-[8%] top-3.5 h-1 max-w-[84%] rounded-full bg-gradient-to-r from-mc-brand to-mc-brand-strong"
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
                                            'flex h-8 w-8 items-center justify-center rounded-mc-sm border transition-colors',
                                            isCompleted
                                                ? 'border-mc-success bg-mc-success text-mc-on-success'
                                                : isActive
                                                    ? 'border-mc-brand bg-mc-brand text-mc-on-brand ring-4 ring-mc-brand/15'
                                                    : 'border-mc-border bg-mc-surface text-mc-text-3',
                                        ].join(' ')}
                                    >
                                        {isCompleted ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-mc-md border border-mc-border bg-mc-surface-2 p-3.5">
                    <div className={`absolute inset-y-0 left-0 w-1 ${item.is_taken_away ? 'bg-mc-text-3' : item.is_sent_web ? 'bg-mc-success' : 'bg-mc-brand'}`} />
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
                            <div className="flex flex-wrap gap-2 border-t border-mc-border pt-3 text-[11px] font-bold text-mc-text-2 dark:border-white/10 dark:text-mc-text-3">
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
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-mc-border bg-white px-3 py-1.5 text-xs font-bold text-mc-text-2 dark:border-white/10 dark:bg-white/[0.05] dark:text-mc-text-3">
            <Icon className="size-3.5 shrink-0 text-mc-brand" />
            <span className="shrink-0 text-mc-text-3">{label}:</span>
            <span className="min-w-0 truncate">{value}</span>
        </span>
    );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-mc-sm border border-mc-border bg-mc-surface p-2.5">
            <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-mc-text-3">{label}</p>
            <p className="text-sm font-bold text-mc-text">{value}</p>
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
        <div className={`rounded-mc-md border p-3 ${accent ? 'border-mc-success/25 bg-mc-success/12' : 'border-mc-border bg-mc-surface'}`}>
            <p className={`mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide ${accent ? 'text-mc-success' : 'text-mc-text-3'}`}>
                <Icon className="size-3.5" />
                {label}
            </p>
            <p className={`font-mono text-sm font-black ${accent ? 'text-mc-success' : 'text-mc-text'}`}>
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
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-mc-surface-2 dark:bg-white/5 rounded-mc-md animate-pulse" />)}
                </div>
            ) : isError ? (
                <div className="text-center py-6 text-mc-danger">{t('cargoHistory.error')}</div>
            ) : (data?.items?.length ?? 0) === 0 ? (
                <div className="text-center py-6 text-mc-text-2">{t('cargoHistory.emptyFlight')}</div>
            ) : (
                <div className="flex flex-col gap-3">
                    {data?.items.map((item: CargoItemResponse) => (
                        <HistoryCargoCard key={item.id} item={item} />
                    ))}
                    {data && data.total > data.size && (
                        <div className="flex justify-center pt-2">
                            <button className="rounded-mc-md bg-mc-brand-soft px-6 py-2.5 text-[13px] font-extrabold text-mc-brand transition-transform active:scale-[0.98]" onClick={() => setPage(p => p + 1)}>
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
        return <div className="flex flex-col gap-4 p-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-mc-surface-2 rounded-mc-lg animate-pulse" />)}</div>;
    }

    if (!history || history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 bg-mc-surface-2 rounded-full flex items-center justify-center mb-4"><FileText className="w-8 h-8 text-mc-text-3" /></div>
                <h3 className="text-lg font-bold text-mc-text">{t('cargoHistory.emptyState.title')}</h3>
                <p className="text-mc-text-2 mt-2 max-w-xs mx-auto">{t('cargoHistory.emptyState.desc')}</p>
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
