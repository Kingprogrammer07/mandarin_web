import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown,
    Package,
    Weight,
    Calendar,
    Plane,
    FileText,
    MapPin,
    CheckCircle,
    PackageCheck
} from 'lucide-react';
import { format } from 'date-fns';
import {
    getClientFlightHistory,
    getClientFlightDetails,
    type CargoItemResponse
} from '../../api/services/cargo';
import { useProfile } from '../../hooks/useProfile';

// --- Components ---

// 1. Flight Summary Card (Master)
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
    },

    isExpanded: boolean,
    onToggle: () => void
}) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onToggle}
            className={`
                bg-white dark:bg-[#1e1a45] rounded-2xl p-4 shadow-sm border 
                cursor-pointer transition-colors duration-200
                ${isExpanded
                    ? 'border-amber-500/50 dark:border-amber-500/50 ring-1 ring-amber-500/20'
                    : 'border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10'
                }
            `}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center
                        ${isExpanded
                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'
                        }
                    `}>
                        <Plane className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-base">
                            {summary.flight_name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <Calendar className="w-3 h-3" />
                            <span>{format(new Date(summary.last_update), 'dd.MM.yyyy HH:mm') || summary.last_update || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-xs text-gray-400">Jami vazn</span>
                        <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                            <Weight className="w-3 h-3 text-amber-500" />
                            {summary.total_weight} kg
                        </span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-gray-400 sm:hidden">Yuklar</span>
                        <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                            <Package className="w-3 h-3 text-blue-500" />
                            {summary.total_count}
                        </span>
                    </div>
                    <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    </div>
                </div>
            </div>

            {/* Mobile Stat Row (Counts) - Visible always or just collapse? */}
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 flex justify-between sm:hidden">
                <div className="flex items-center gap-1.5">
                    <Weight className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium dark:text-gray-200">{summary.total_weight} kg</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Status:</span>
                    <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                        Yakunlangan
                    </span>
                </div>
            </div>
        </motion.div>
    );
};

// --- Helper for Stepper ---
const getSteps = (item: CargoItemResponse) => {
    // Status Logic
    // 1. China: Always completed if item exists
    // 2. Way: If status is 'pre' or 'post' (basically always active or completed if item exists)
    // 3. Uzbekistan: If status is 'post'
    // 4. Report: If is_sent is true
    // 5. Taken: If is_taken_away is true

    const hasChina = true;
    const hasWay = true; // If it's in history, it's at least tracking
    const hasUz = item.checkin_status === 'post';
    const hasSent = item.is_sent;
    const hasTaken = item.is_taken_away;

    return [
        { id: 1, label: "Xitoyda", icon: MapPin, status: hasChina ? 'completed' : 'pending' },
        { id: 2, label: "Yo'lda", icon: Plane, status: hasWay ? (hasUz ? 'completed' : 'active') : 'pending' },
        { id: 3, label: "O'zbekistonda", icon: CheckCircle, status: hasUz ? 'completed' : 'pending' },
        { id: 4, label: "Hisobot", icon: FileText, status: hasSent ? 'completed' : 'pending' },
        { id: 5, label: "Tarqatish", icon: PackageCheck, status: hasTaken ? 'completed' : 'pending' },
    ];
};

// 2. Flight Details Section (Detail)
const FlightDetailsSection = ({
    clientCode,
    flightName,
    isExpanded
}: {
    clientCode: string,
    flightName: string,
    isExpanded: boolean
}) => {
    const [page, setPage] = useState(1);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['flightDetails', clientCode, flightName, page],
        queryFn: () => getClientFlightDetails(clientCode, flightName, page),
        enabled: isExpanded, // Lazy load!
        staleTime: 1000 * 60 * 5, // 5 mins
    });

    if (!isExpanded) return null;

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
        >
            <div className="p-1 sm:p-4 pt-0">
                <div className="bg-gray-50 dark:bg-[#131030] rounded-xl border border-gray-100 dark:border-white/5 p-2 sm:p-4 mt-2">

                    {isLoading ? (
                        <div className="flex flex-col gap-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-24 bg-gray-200 dark:bg-white/5 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : isError ? (
                        <div className="text-center py-6 text-red-500">
                            Ma'lumotlarni yuklashda xatolik yuz berdi.
                        </div>
                    ) : (data?.items?.length ?? 0) === 0 ? (
                        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                            Bu reysda yuklar topilmadi.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {data?.items.map((item: CargoItemResponse) => (
                                <div
                                    key={item.id}
                                    className="bg-white dark:bg-[#1a163d] p-4 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
                                >
                                    {/* Status Indicator Bar */}
                                    <div className={`absolute top-0 left-0 bottom-0 w-1 
                                        ${item.is_sent ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}
                                    `} />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-2">
                                        {/* Left Column: Main Identity */}
                                        <div className="space-y-3">
                                            {/* Track Code & Box */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                                                        {item.track_code}
                                                    </span>
                                                    {item.box_number && (
                                                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                                                            Box {item.box_number}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Names */}
                                            <div className="space-y-1">
                                                {item.item_name_cn && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs bg-gray-100 dark:bg-white/10 text-gray-500 px-1.5 rounded">CN</span>
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">{item.item_name_cn}</span>
                                                    </div>
                                                )}
                                                {item.item_name_ru && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs bg-gray-100 dark:bg-white/10 text-gray-500 px-1.5 rounded">RU</span>
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">{item.item_name_ru}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Quantity */}
                                            {item.quantity && (
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    Soni: <span className="font-medium text-gray-900 dark:text-white">{item.quantity} ta</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Column: Stats & Financials */}
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                            {/* Stepper (Col-span 2) */}
                                            <div className="col-span-2 py-2">
                                                <div className="flex items-center justify-between relative px-1">
                                                    {/* Background Line */}
                                                    <div className="absolute top-[14px] left-3 right-3 h-0.5 bg-gray-100 dark:bg-white/5 -z-10 rounded-full" />

                                                    {getSteps(item).map((step) => {
                                                        let iconClass = "bg-white dark:bg-[#1a163d] border border-gray-200 dark:border-white/10 text-gray-300 dark:text-gray-600";

                                                        if (step.status === 'completed') {
                                                            iconClass = "bg-emerald-500 border-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.4)]";
                                                        } else if (step.status === 'active') {
                                                            iconClass = "bg-amber-500 border-amber-500 text-white shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse";
                                                        }

                                                        return (
                                                            <div key={step.id} className="flex flex-col items-center gap-1 relative z-10">
                                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${iconClass}`}>
                                                                    <step.icon className="w-3.5 h-3.5" />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Weight */}
                                            <div className="bg-gray-50 dark:bg-white/5 p-2 rounded-lg">
                                                <div className="text-xs text-gray-400 mb-0.5">Vazn</div>
                                                <div className="font-bold text-gray-900 dark:text-white">{item.weight_kg} kg</div>
                                            </div>

                                            {/* Price/Kg */}
                                            <div className="bg-gray-50 dark:bg-white/5 p-2 rounded-lg">
                                                <div className="text-xs text-gray-400 mb-0.5">Narx/kg</div>
                                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                                    {item.price_per_kg ? `$${item.price_per_kg}` : '-'}
                                                </div>
                                            </div>

                                            {/* Total Payment */}
                                            <div className="col-span-2 bg-amber-50 dark:bg-amber-500/10 p-2 rounded-lg border border-amber-100 dark:border-amber-500/20">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Jami to'lov</span>
                                                    <span className="font-bold text-amber-700 dark:text-amber-300">
                                                        {item.total_payment ? `$${item.total_payment}` : '-'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Dates */}
                                            <div className="col-span-2 flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100 dark:border-white/5 mt-1">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>CN: {item.pre_checkin_date ? format(new Date(item.pre_checkin_date), 'dd.MM.yyyy HH:mm') : '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>UZ: {item.post_checkin_date ? format(new Date(item.post_checkin_date), 'dd.MM.yyyy HH:mm') : '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Pagination Logic */}
                            {data && data.total > data.size && (
                                <div className="flex justify-center pt-4">
                                    <button
                                        className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline bg-purple-50 dark:bg-purple-500/10 px-4 py-2 rounded-full transition-colors"
                                        onClick={() => setPage(p => p + 1)}
                                    >
                                        Ko'proq yuklash...
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// 3. Main Component
export default function ClientCargoHistory() {
    const { data: profile, isLoading: isProfileLoading } = useProfile();
    const [expandedFlight, setExpandedFlight] = useState<string | null>(null);

    const clientCode = profile?.client_code;

    const { data: history, isLoading: isHistoryLoading } = useQuery({
        queryKey: ['flightHistory', clientCode],
        queryFn: () => getClientFlightHistory(clientCode!),
        enabled: !!clientCode,
        staleTime: 1000 * 60 * 10, // 10 mins
    });

    const handleToggle = (flightName: string) => {
        setExpandedFlight(prev => prev === flightName ? null : flightName);
    };

    if (isProfileLoading || (isHistoryLoading && !history)) {
        return (
            <div className="flex flex-col gap-4 p-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-24 bg-gray-100 dark:bg-white/5 rounded-2xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (!history || history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Tarix topilmadi
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-xs mx-auto">
                    Sizda hali yakunlangan parvozlar tarixi mavjud emas.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4 py-4  pb-24">

            <div className="flex flex-col gap-3">
                <AnimatePresence>
                    {history.map((flight) => (
                        <div key={flight.flight_name} className="relative">
                            <FlightSummaryCard
                                summary={{
                                    flight_name: flight.flight_name,
                                    last_update: flight.last_update ?? '',
                                    total_weight: flight.total_weight,
                                    total_count: flight.total_count
                                }}

                                isExpanded={expandedFlight === flight.flight_name}
                                onToggle={() => handleToggle(flight.flight_name)}
                            />
                            <AnimatePresence>
                                {expandedFlight === flight.flight_name && (
                                    <FlightDetailsSection
                                        clientCode={clientCode!}
                                        flightName={flight.flight_name}
                                        isExpanded={true}
                                    />
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
