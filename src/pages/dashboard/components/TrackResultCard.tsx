import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    MapPin, Plane, CheckCircle, FileText, PackageCheck, ChevronDown, Scale, Box, Calculator, CalendarClock
} from "lucide-react";
import type { TrackCodeSearchResponse } from "@/api/services/cargo";
import { format } from "date-fns";
import { useTranslation } from 'react-i18next';

interface TrackResultCardProps {
    data: TrackCodeSearchResponse;
}

export function TrackResultCard({ data }: TrackResultCardProps) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const allItems = useMemo(() => data.items ?? [], [data]);

    const formatMoney = (val?: string | number | null) => {
        if (val == null || val === '') return null;
        const num = Number(val);
        return isNaN(num) ? val : num.toLocaleString('ru-RU');
    };

    const summaryStatus = useMemo(() => {
        if (allItems.some(i => i.is_taken_away)) return { label: t('cargoStatus.taken'), bg: "bg-purple-100 dark:bg-purple-500/20", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-500/30" };
        if (allItems.some(i => i.is_sent_web)) return { label: t('cargoStatus.reportReady'), bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-500/30" };
        if (allItems.some(i => i.checkin_status === 'post')) return { label: t('cargoStatus.inUzb'), bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-500/30" };
        if (allItems.some(i => i.checkin_status === 'pre')) return { label: t('cargoStatus.inChina'), bg: "bg-blue-100 dark:bg-blue-500/20", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-500/30" };
        return { label: t('cargoStatus.pending'), bg: "bg-gray-100 dark:bg-white/10", text: "text-gray-600 dark:text-gray-300", border: "border-gray-200 dark:border-white/20" };
    }, [allItems, t]);

    const steps = useMemo(() => {
        const hasChina = allItems.some(i => !!i.pre_checkin_date || i.checkin_status === 'pre' || i.checkin_status === 'post');
        const hasUz = allItems.some(i => !!i.post_checkin_date || i.checkin_status === 'post');
        const hasSentWeb = allItems.some(i => i.is_sent_web);
        const hasTaken = allItems.some(i => i.is_taken_away);

        const wayStatus = hasChina ? (hasUz ? 'completed' : 'active') : 'upcoming';

        return [
            { id: 1, label: t('cargoSteps.china'), icon: MapPin, status: hasChina ? 'completed' : 'upcoming' },
            { id: 2, label: t('cargoSteps.onWay'), icon: Plane, status: wayStatus },
            { id: 3, label: t('cargoSteps.uzb'), icon: CheckCircle, status: hasUz ? 'completed' : 'upcoming' },
            { id: 4, label: t('cargoSteps.report'), icon: FileText, status: hasSentWeb ? 'completed' : 'upcoming' },
            { id: 5, label: t('cargoSteps.distribute'), icon: PackageCheck, status: hasTaken ? 'completed' : 'upcoming' },
        ];
    }, [allItems, t]);

    return (
        <motion.div
            layout
            onClick={() => setExpanded(!expanded)}
            className={`bg-white dark:bg-[#141420] border rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 ${expanded ? 'border-purple-300 dark:border-purple-500/50 shadow-xl shadow-purple-500/5 ring-4 ring-purple-500/10' : 'border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-500/30'}`}
        >
            <div className="p-4 sm:p-6 flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h3 className="text-xl sm:text-3xl font-black font-mono tracking-wider text-gray-900 dark:text-white">
                        {data.track_code}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wide border ${summaryStatus.bg} ${summaryStatus.text} ${summaryStatus.border}`}>
                            {summaryStatus.label}
                        </span>
                        {allItems[0]?.flight_name && (
                            <span className="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10">
                                {t('cargoHistory.flight', { name: allItems[0].flight_name })}
                            </span>
                        )}
                    </div>
                </div>
                <motion.div animate={{ rotate: expanded ? 180 : 0 }} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center border border-gray-100 dark:border-white/10 shrink-0">
                    <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 dark:text-gray-500" />
                </motion.div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }}>
                        <div className="px-3 sm:px-6 pb-6 pt-2 border-t border-gray-100 dark:border-white/5">
                            
                            {/* Responsive Flex Stepper */}
                            <div className="my-6 relative max-w-2xl mx-auto w-full">
                                <div className="absolute top-[18px] sm:top-[22px] left-[10%] right-[10%] h-1 sm:h-1.5 bg-gray-100 dark:bg-[#1f1f33] rounded-full -z-10" />
                                
                                <div className="flex justify-between relative w-full">
                                    {steps.map((step) => {
                                        const isCompleted = step.status === 'completed';
                                        const isActive = step.status === 'active';
                                        const isUpcoming = step.status === 'upcoming';

                                        return (
                                            <div key={step.id} className="flex flex-col items-center gap-1.5 sm:gap-2 z-10 flex-1">
                                                <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-500 border-2 ${isCompleted ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/30' : isActive ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/40 ring-4 ring-amber-500/20 animate-pulse' : 'bg-white dark:bg-[#141420] text-gray-300 dark:text-gray-600 border-dashed border-gray-200 dark:border-gray-700'}`}>
                                                    <step.icon className={`w-4 h-4 sm:w-6 sm:h-6 ${isUpcoming ? 'opacity-50' : ''}`} />
                                                </div>
                                                <span className={`text-[8px] sm:text-[10px] text-center uppercase tracking-wider leading-tight px-0.5 break-words w-full ${isCompleted ? 'text-emerald-700 dark:text-emerald-400 font-bold' : isActive ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-gray-400 dark:text-gray-600 font-medium'}`}>
                                                    {step.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-4">
                                {allItems.map((item) => (
                                    <div key={item.id} className="bg-gray-50/80 dark:bg-[#1a1a2e] rounded-2xl p-4 sm:p-6 border border-gray-100 dark:border-white/5 relative overflow-hidden group">
                                        <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${item.is_taken_away ? 'bg-purple-500' : item.is_sent_web ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                        <div className="pl-1 sm:pl-2 space-y-4 sm:space-y-6">
                                            
                                            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-white/5 w-fit px-3 py-1.5 rounded-lg border border-gray-100 dark:border-white/5 shadow-sm">
                                                <CalendarClock className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" />
                                                <span className="font-medium">{t('tracking.dateLabel')}</span>
                                                <span className="font-mono text-gray-800 dark:text-gray-200">
                                                    {item.taken_away_date ? format(new Date(item.taken_away_date), 'dd.MM.yyyy HH:mm') : item.post_checkin_date ? format(new Date(item.post_checkin_date), 'dd.MM.yyyy HH:mm') : item.pre_checkin_date ? format(new Date(item.pre_checkin_date), 'dd.MM.yyyy HH:mm') : t('tracking.noDate')}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
                                                <div className="col-span-2 md:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-white dark:bg-[#141420] p-3 sm:p-4 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                    <div>
                                                        <span className="text-[10px] sm:text-xs text-gray-400 uppercase font-bold tracking-wider mb-1 block">{t('cargoHistory.names.cn')}</span>
                                                        <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">{item.item_name_cn || t('cargoHistory.names.notEntered')}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] sm:text-xs text-gray-400 uppercase font-bold tracking-wider mb-1 block">{t('cargoHistory.names.ru')}</span>
                                                        <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">{item.item_name_ru || t('cargoHistory.names.notEntered')}</span>
                                                    </div>
                                                </div>

                                                <div className="bg-white dark:bg-[#141420] p-3 sm:p-4 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5 text-gray-400">
                                                        <Scale className="w-3 h-3 sm:w-4 sm:h-4" />
                                                        <span className="text-[9px] sm:text-xs uppercase font-bold tracking-wider">{t('cargoHistory.details.actualWeight')}</span>
                                                    </div>
                                                    <span className="text-base sm:text-xl font-black font-mono text-gray-900 dark:text-white">
                                                        {item.weight_kg != null && item.weight_kg !== '' ? `${item.weight_kg} kg` : t('cargoHistory.details.notMeasured')}
                                                    </span>
                                                </div>

                                                <div className="bg-white dark:bg-[#141420] p-3 sm:p-4 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5 text-gray-400">
                                                        <Box className="w-3 h-3 sm:w-4 sm:h-4" />
                                                        <span className="text-[9px] sm:text-xs uppercase font-bold tracking-wider">{t('cargoHistory.details.boxCount')}</span>
                                                    </div>
                                                    <span className="text-base sm:text-xl font-black font-mono text-gray-900 dark:text-white">
                                                        {item.box_number != null && item.box_number !== '' ? item.box_number : '-'}
                                                    </span>
                                                </div>

                                                <div className="bg-white dark:bg-[#141420] p-3 sm:p-4 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5 text-gray-400">
                                                        <Calculator className="w-3 h-3 sm:w-4 sm:h-4" />
                                                        <span className="text-[9px] sm:text-xs uppercase font-bold tracking-wider">{t('cargoHistory.details.count')}</span>
                                                    </div>
                                                    <span className="text-base sm:text-xl font-black font-mono text-gray-900 dark:text-white">
                                                        {item.quantity != null && item.quantity !== '' ? `${item.quantity} ta` : '-'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-4 sm:mt-6 pt-4 sm:pt-5 border-t border-gray-200 dark:border-gray-700/50">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider mb-1">{t('cargoHistory.financials.pricePerKg')}</span>
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-lg sm:text-xl font-bold font-mono text-gray-900 dark:text-gray-100">
                                                                {item.price_per_kg_uzs != null && item.price_per_kg_uzs !== '' ? `${formatMoney(item.price_per_kg_uzs)} so'm` : t('cargoHistory.financials.notCalculated')}
                                                            </span>
                                                            {item.price_per_kg_usd != null && item.price_per_kg_usd !== '' && (
                                                                <span className="text-sm font-medium text-gray-500">(${item.price_per_kg_usd})</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col sm:items-end w-full sm:w-auto bg-emerald-50 dark:bg-emerald-900/10 p-4 sm:p-3 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                                                        <span className="text-[10px] sm:text-xs text-emerald-600/70 dark:text-emerald-400/70 uppercase font-black tracking-wider mb-1">{t('cargoHistory.financials.totalPayment')}</span>
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                                                                {item.total_payment_uzs != null && item.total_payment_uzs !== '' ? `${formatMoney(item.total_payment_uzs)} so'm` : t('cargoHistory.financials.notCalculated')}
                                                            </span>
                                                            {item.total_payment_usd != null && item.total_payment_usd !== '' && (
                                                                <span className="text-sm sm:text-base font-bold text-emerald-600/60 dark:text-emerald-400/60">(${item.total_payment_usd})</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {item.exchange_rate != null && item.exchange_rate !== '' && (
                                                    <div className="mt-3 flex justify-start sm:justify-end">
                                                        <span className="text-[10px] sm:text-xs font-medium text-gray-400 bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-lg">
                                                            {t('cargoHistory.financials.exchangeRate', { rate: formatMoney(item.exchange_rate) })}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
