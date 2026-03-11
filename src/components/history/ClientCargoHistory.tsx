import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Package, Weight, Calendar, Plane, FileText, MapPin, CheckCircle, PackageCheck } from 'lucide-react';
import { format } from 'date-fns';
import { getClientFlightHistory, getClientFlightDetails, type CargoItemResponse } from '../../api/services/cargo';
import { useProfile } from '../../hooks/useProfile';
import { useTranslation } from 'react-i18next';

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
            className={`bg-white dark:bg-[#1e1a45] rounded-2xl p-4 sm:p-5 shadow-sm border cursor-pointer transition-all duration-200 ${
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
                            <Package className="w-4 h-4 text-blue-500" />
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
                        <Package className="w-4 h-4 text-blue-500" />
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
    const hasWay = hasChina;
    const hasSent = !!item.is_sent_web;
    const hasTaken = !!item.is_taken_away;
    return [
        { id: 1, label: t('cargoSteps.china'), icon: MapPin, status: hasChina ? 'completed' : 'pending' },
        { id: 2, label: t('cargoSteps.onWay'), icon: Plane, status: hasWay ? (hasUz ? 'completed' : 'active') : 'pending' },
        { id: 3, label: t('cargoSteps.uzb'), icon: CheckCircle, status: hasUz ? 'completed' : 'pending' },
        { id: 4, label: t('cargoSteps.report'), icon: FileText, status: hasSent ? 'completed' : 'pending' },
        { id: 5, label: t('cargoSteps.distribute'), icon: PackageCheck, status: hasTaken ? 'completed' : 'pending' },
    ];
};

const formatMoney = (val?: string | number | null) => {
    if (val == null || val === '') return null;
    const num = Number(val);
    return isNaN(num) ? val : num.toLocaleString('ru-RU');
};

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
                        <div key={item.id} className="bg-white dark:bg-[#1a163d] p-4 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm relative overflow-hidden group">
                            <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${item.is_sent_web ? 'bg-emerald-500' : 'bg-blue-500 dark:bg-blue-600'}`} />
                            
                            <div className="pl-2">
                                <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-white/5 pb-2">
                                    <span className="font-mono text-lg font-bold text-gray-900 dark:text-white tracking-tight">{item.track_code}</span>
                                    {item.box_number && <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 uppercase tracking-wider">{t('cargoHistory.box', { number: item.box_number })}</span>}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            {item.item_name_cn && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold bg-gray-100 dark:bg-white/10 text-gray-500 px-1.5 py-0.5 rounded">CN</span>
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{item.item_name_cn}</span>
                                                </div>
                                            )}
                                            {item.item_name_ru && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold bg-gray-100 dark:bg-white/10 text-gray-500 px-1.5 py-0.5 rounded">RU</span>
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{item.item_name_ru}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-2">
                                            <div className="bg-gray-50 dark:bg-[#131030] p-3 rounded-xl border border-gray-100 dark:border-white/5">
                                                <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">{t('cargoHistory.details.weight')}</div>
                                                <div className="font-bold font-mono text-gray-900 dark:text-white text-base">{item.weight_kg != null && item.weight_kg !== '' ? `${item.weight_kg} kg` : '-'}</div>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-[#131030] p-3 rounded-xl border border-gray-100 dark:border-white/5">
                                                <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">{t('cargoHistory.details.count')}</div>
                                                <div className="font-bold font-mono text-gray-900 dark:text-white text-base">{item.quantity != null && item.quantity !== '' ? `${item.quantity} ta` : '-'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-between space-y-4">
                                        
                                        {/* Flex-1 Stepper for mobile responsiveness */}
                                        <div className="py-2">
                                            <div className="flex justify-between relative w-full">
                                                <div className="absolute top-[12px] sm:top-[14px] left-[10%] right-[10%] h-0.5 bg-gray-200 dark:bg-white/10 -z-10 rounded-full" />
                                                {getSteps(item, t).map((step) => {
                                                    const isCompleted = step.status === 'completed';
                                                    const isActive = step.status === 'active';
                                                    let iconClass = "bg-white dark:bg-[#1a163d] border-2 border-gray-200 dark:border-white/10 text-gray-300 dark:text-gray-600";
                                                    if (isCompleted) iconClass = "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20";
                                                    if (isActive) iconClass = "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20 animate-pulse ring-2 ring-amber-500/20";

                                                    return (
                                                        <div key={step.id} className="flex flex-col items-center flex-1 z-10">
                                                            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-300 ${iconClass}`}>
                                                                <step.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                                                            </div>
                                                            <span className={`text-[7px] sm:text-[9px] uppercase tracking-wider text-center mt-1 w-full px-0.5 break-words leading-tight ${isCompleted ? 'text-emerald-600 dark:text-emerald-400 font-bold' : isActive ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-gray-400 dark:text-gray-500 font-medium'}`}>
                                                                {step.label}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="bg-gray-50 dark:bg-[#131030] p-3 rounded-xl border border-gray-100 dark:border-white/5">
                                                <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">{t('cargoHistory.financials.pricePerKg')}</div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold font-mono text-gray-900 dark:text-white">{item.price_per_kg_uzs != null && item.price_per_kg_uzs !== '' ? `${formatMoney(item.price_per_kg_uzs)} so'm` : '-'}</span>
                                                    {item.price_per_kg_usd != null && item.price_per_kg_usd !== '' && <span className="text-[10px] text-gray-500">(${item.price_per_kg_usd})</span>}
                                                </div>
                                            </div>
                                            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                                                <div className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 uppercase font-bold tracking-wider mb-1">{t('cargoHistory.financials.totalPayment')}</div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 text-lg leading-tight">{item.total_payment_uzs != null && item.total_payment_uzs !== '' ? `${formatMoney(item.total_payment_uzs)} so'm` : '-'}</span>
                                                    {item.total_payment_usd != null && item.total_payment_usd !== '' && <span className="text-xs text-emerald-600/60 dark:text-emerald-400/60 font-medium mt-0.5">(${item.total_payment_usd})</span>}
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-400 pt-3 mt-3 border-t border-gray-100 dark:border-white/5">
                                    <div className="flex gap-4">
                                        <span>CN: {item.pre_checkin_date ? format(new Date(item.pre_checkin_date), 'dd.MM.yyyy HH:mm') : '-'}</span>
                                        <span>UZ: {item.post_checkin_date ? format(new Date(item.post_checkin_date), 'dd.MM.yyyy HH:mm') : '-'}</span>
                                    </div>
                                    {item.exchange_rate != null && item.exchange_rate !== '' && (
                                        <span className="bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded text-gray-500">{t('cargoHistory.financials.exchangeRate', { rate: formatMoney(item.exchange_rate) })}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {data && data.total > data.size && (
                        <div className="flex justify-center pt-2">
                            <button className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 px-6 py-2.5 rounded-xl transition-colors" onClick={() => setPage(p => p + 1)}>
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
        staleTime: 0,
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
