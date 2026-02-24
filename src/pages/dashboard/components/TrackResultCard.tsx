import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    MapPin,
    Plane,
    CheckCircle,
    FileText,
    PackageCheck,
    ChevronDown
} from "lucide-react";
import type { TrackCodeSearchResponse } from "@/api/services/cargo";
import { format } from "date-fns";

interface TrackResultCardProps {
    data: TrackCodeSearchResponse;
}

export function TrackResultCard({ data }: TrackResultCardProps) {
    const [expanded, setExpanded] = useState(false);

    // Combine items for easier access
    const allItems = useMemo(() => [
        ...data.items_in_uzbekistan,
        ...data.items_in_china
    ], [data]);

    // Determine latest status for summary
    const summaryStatus = useMemo(() => {
        if (data.items_in_uzbekistan.length > 0) return { label: "O'zbekistonda", color: "emerald" };
        if (data.items_in_china.length > 0) return { label: "Xitoyda", color: "blue" };
        return { label: "Topilmadi", color: "gray" };
    }, [data]);

    // 5-Step Progress Logic
    const steps = useMemo(() => {
        const hasChina = data.items_in_china.length > 0 || data.items_in_uzbekistan.length > 0;
        const hasWay = data.items_in_china.some(i => i.checkin_status === 'pre') || data.items_in_uzbekistan.length > 0;
        const hasUz = data.items_in_uzbekistan.some(i => i.checkin_status === 'post');
        const hasSent = allItems.some(i => i.is_sent);
        const hasTaken = allItems.some(i => i.is_taken_away);

        return [
            { id: 1, label: "Xitoyda", icon: MapPin, status: hasChina ? 'completed' : 'pending' },
            { id: 2, label: "Yo'lda", icon: Plane, status: hasWay ? (hasUz ? 'completed' : 'active') : 'pending' },
            { id: 3, label: "O'zbekistonda", icon: CheckCircle, status: hasUz ? 'completed' : 'pending' },
            { id: 4, label: "Hisobot", icon: FileText, status: hasSent ? 'completed' : 'pending' },
            { id: 5, label: "Tarqatish", icon: PackageCheck, status: hasTaken ? 'completed' : 'pending' },
        ];
    }, [data, allItems]);

    const toggleExpand = () => setExpanded(!expanded);

    return (
        <motion.div
            layout
            onClick={toggleExpand}
            className={`
        bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 
        rounded-3xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow
        ${expanded ? 'ring-2 ring-blue-500/20' : ''}
      `}
        >
            {/* Summary Header (Always Visible) */}
            <motion.div layout="position" className="p-5 flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-bold font-mono tracking-wider text-gray-900 dark:text-white">
                        {data.track_code}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`
               px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide
               ${summaryStatus.color === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : ''}
               ${summaryStatus.color === 'blue' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : ''}
               ${summaryStatus.color === 'gray' ? 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400' : ''}
             `}>
                            {summaryStatus.label}
                        </span>
                        {allItems[0]?.flight_name && (
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                {allItems[0].flight_name}
                            </span>
                        )}
                    </div>
                </div>
                <motion.div
                    animate={{ rotate: expanded ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <ChevronDown className="w-6 h-6 text-gray-400" />
                </motion.div>
            </motion.div>

            {/* Expanded Content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-gray-100 dark:border-white/5"
                    >
                        <div className="p-5 pt-2">

                            {/* Stepper (Responsive) */}
                            <div className="my-6 relative">
                                <div className="flex items-center justify-between relative px-2">
                                    {/* Connecting Line - Background */}
                                    <div className="absolute top-[20px] left-4 right-4 h-1 bg-gray-100 dark:bg-white/5 -z-10 rounded-full" />

                                    {steps.map((step) => {
                                        // Dynamic Classes for Status
                                        let iconContainerClass = "bg-white dark:bg-[#080814] border-2 border-gray-200 dark:border-white/10 text-gray-300 dark:text-white/20";
                                        let labelClass = "text-gray-400 dark:text-white/20 font-medium";

                                        if (step.status === 'completed') {
                                            iconContainerClass = "bg-emerald-500 text-white border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]";
                                            labelClass = "text-emerald-600 dark:text-emerald-400 font-bold";
                                        } else if (step.status === 'active') {
                                            iconContainerClass = "bg-amber-500 text-white border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)] animate-pulse";
                                            labelClass = "text-amber-600 dark:text-amber-400 font-bold";
                                        }

                                        return (
                                            <div key={step.id} className="flex flex-col items-center gap-2 relative z-10 w-full">
                                                <div
                                                    className={`
                                                      w-10 h-10 rounded-full flex items-center justify-center 
                                                      transition-all duration-300 transform
                                                      ${step.status === 'active' ? 'scale-110' : ''}
                                                      ${iconContainerClass}
                                                    `}
                                                >
                                                    <step.icon className="w-5 h-5" />
                                                </div>
                                                <span className={`text-[9px] sm:text-[10px] uppercase tracking-tight text-center leading-3 max-w-[60px] ${labelClass}`}>
                                                    {step.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Item Details List */}
                            <div className="space-y-3">
                                {allItems.map((item) => (
                                    <div key={item.id} className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 flex flex-col gap-3 border border-gray-100 dark:border-white/5">
                                        {/* Header: Date & Status */}
                                        <div className="flex justify-between items-start text-xs text-gray-500 dark:text-gray-400 pb-2 border-b border-gray-200 dark:border-white/5">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-400 text-[10px] uppercase">Sana</span>
                                                <span className="text-gray-700 dark:text-gray-200 font-mono">
                                                    {item.post_checkin_date
                                                        ? format(new Date(item.post_checkin_date), 'dd.MM.yyyy HH:mm')
                                                        : item.pre_checkin_date
                                                            ? format(new Date(item.pre_checkin_date), 'dd.MM.yyyy HH:mm')
                                                            : '---'}
                                                </span>
                                            </div>
                                            <span className={`uppercase font-bold tracking-wider px-2 py-1 rounded-md text-[10px] ${item.checkin_status === 'post' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'}`}>
                                                {item.checkin_status === 'post' ? "O'zbekistonda" : "Xitoyda"}
                                            </span>
                                        </div>

                                        {/* Body: Specs */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <div className="flex flex-col col-span-2 sm:col-span-4 lg:col-span-2">
                                                <span className="text-[10px] text-gray-400 uppercase">Tovar Nomi</span>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] text-gray-400/70 uppercase">CN</span>
                                                        <span className="font-semibold text-sm text-gray-900 dark:text-white break-words">
                                                            {item.item_name_cn || "---"}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] text-gray-400/70 uppercase">RU</span>
                                                        <span className="font-semibold text-sm text-gray-900 dark:text-white break-words">
                                                            {item.item_name_ru || "---"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-400 uppercase">Soni</span>
                                                <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
                                                    {item.quantity ? `${item.quantity} ta` : '-'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-400 uppercase">Og'irlik</span>
                                                <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
                                                    {item.weight_kg ? `${item.weight_kg} kg` : '-'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-400 uppercase">Joy (Box)</span>
                                                <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
                                                    {item.box_number || '-'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Footer: Price */}
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-white/5 mt-1">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-400 uppercase">Narx/kg</span>
                                                <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                                                    {item.price_per_kg ? `$${item.price_per_kg}` : '-'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-[10px] text-gray-400 uppercase">Jami To'lov</span>
                                                <span className="font-bold font-mono text-lg text-emerald-600 dark:text-emerald-400">
                                                    {item.total_payment ? `$${item.total_payment}` : '-'}
                                                </span>
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
