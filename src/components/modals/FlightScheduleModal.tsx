import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    ChevronLeft,
    ChevronRight,
    Plane,
    Truck,
    CheckCircle2,
    Clock,
    AlertCircle,
    Calendar as CalendarIcon,
    ArrowRight
} from 'lucide-react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameDay,
    isToday,
    isSameMonth,
    addDays,
    startOfWeek,
    endOfWeek,
    isBefore,
    startOfDay
} from 'date-fns';
import { uz } from 'date-fns/locale';

// --- Mock Data ---
interface Flight {
    id: string;
    date: Date;
    flightName: string;
    type: 'avia' | 'auto';
    status: 'arrived' | 'scheduled' | 'delayed';
    description?: string;
}

const generateMockFlights = (): Flight[] => {
    const today = new Date();
    const currentMonth = startOfMonth(today);
    const prevMonth = subMonths(currentMonth, 1);
    const nextMonth = addMonths(currentMonth, 1);

    const flights: Flight[] = [
        // Previous Month
        { id: '1', date: addDays(prevMonth, 5), flightName: 'M-200', type: 'avia', status: 'arrived' },
        { id: '2', date: addDays(prevMonth, 12), flightName: 'M-201', type: 'auto', status: 'arrived' },
        { id: '3', date: addDays(prevMonth, 18), flightName: 'M-202', type: 'avia', status: 'arrived' },
        { id: '4', date: addDays(prevMonth, 25), flightName: 'M-203', type: 'auto', status: 'arrived' },

        // Current Month
        { id: '5', date: addDays(currentMonth, 2), flightName: 'M-204', type: 'avia', status: 'arrived' },
        { id: '6', date: addDays(currentMonth, 8), flightName: 'M-205', type: 'avia', status: 'arrived' },
        { id: '7', date: addDays(currentMonth, 15), flightName: 'M-206', type: 'auto', status: 'scheduled' },
        { id: '8', date: addDays(currentMonth, 22), flightName: 'M-207', type: 'avia', status: 'scheduled' },
        { id: '9', date: addDays(currentMonth, 28), flightName: 'M-208', type: 'auto', status: 'delayed' },

        // Next Month (few for preview)
        { id: '10', date: addDays(nextMonth, 5), flightName: 'M-209', type: 'avia', status: 'scheduled' },
    ];

    return flights;
};

const MOCK_FLIGHTS = generateMockFlights();

// --- Components ---

interface FlightScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigateToTrack?: () => void;
}

const FlightScheduleModal: React.FC<FlightScheduleModalProps> = ({ isOpen, onClose, onNavigateToTrack }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    // Navigation handlers
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    // Calendar Grid Generation
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    // Filter flights
    // const _flightsInMonth = MOCK_FLIGHTS.filter(f => isSameMonth(f.date, currentMonth));
    const selectedFlights = MOCK_FLIGHTS.filter(f => isSameDay(f.date, selectedDate));
    const upcomingFlights = MOCK_FLIGHTS.filter(f => isBefore(startOfDay(new Date()), f.date)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 3);
    // const _pastFlights = MOCK_FLIGHTS.filter(f => isBefore(f.date, startOfDay(new Date()))).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);

    // Helpers
    const getDayFlights = (day: Date) => MOCK_FLIGHTS.filter(f => isSameDay(f.date, day));

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                    >
                        {/* Modal Container */}
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-[#1a1b1e] w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[90vh]"
                        >
                            {/* Header */}
                            <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between shrink-0">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                                    <CalendarIcon className="text-blue-500" />
                                    Reyslar Jadvali
                                </h2>
                                <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-500">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="overflow-y-auto p-0 flex-1 custom-scrollbar">

                                {/* Calendar Section */}
                                <div className="p-5">
                                    {/* Month Navigation */}
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                                            {format(currentMonth, 'MMMM yyyy', { locale: uz })}
                                        </h3>
                                        <div className="flex gap-1">
                                            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400">
                                                <ChevronLeft className="w-5 h-5" />
                                            </button>
                                            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400">
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Days Header */}
                                    <div className="grid grid-cols-7 mb-2">
                                        {['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map(day => (
                                            <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
                                                {day}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Calendar Grid */}
                                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                                        {calendarDays.map((day, idx) => {
                                            const dayFlights = getDayFlights(day);
                                            const hasFlight = dayFlights.length > 0;
                                            const isSelected = isSameDay(day, selectedDate);
                                            const isCurrentMonth = isSameMonth(day, currentMonth);
                                            const isTodayDate = isToday(day);

                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => setSelectedDate(day)}
                                                    className={`
                                                        relative h-10 sm:h-12 rounded-xl flex items-center justify-center text-sm font-medium transition-all
                                                        ${!isCurrentMonth ? 'text-gray-300 dark:text-white/10' : 'text-gray-700 dark:text-gray-300'}
                                                        ${isSelected ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105 z-10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}
                                                        ${isTodayDate && !isSelected ? 'ring-1 ring-blue-500 text-blue-500 font-bold' : ''}
                                                    `}
                                                >
                                                    {format(day, 'd')}

                                                    {/* Flight Indicators */}
                                                    {hasFlight && (
                                                        <div className="absolute bottom-1 flex gap-0.5">
                                                            {dayFlights.map((f, i) => (
                                                                <div
                                                                    key={i}
                                                                    className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' :
                                                                        f.status === 'arrived' ? 'bg-green-500' :
                                                                            f.status === 'delayed' ? 'bg-red-500' : 'bg-blue-400'
                                                                        }`}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-2 bg-gray-50 dark:bg-black/20 border-t border-b border-gray-100 dark:border-white/5" />

                                {/* List View Section */}
                                <div className="p-5 space-y-6">

                                    {/* Selected Day Details */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                                            {format(selectedDate, 'd MMMM', { locale: uz })}
                                        </h4>

                                        {selectedFlights.length > 0 ? (
                                            <div className="space-y-3">
                                                {selectedFlights.map(flight => (
                                                    <FlightCard key={flight.id} flight={flight} />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                                                <p className="text-gray-400 dark:text-gray-500 text-sm">Bu kunda reyslar yo'q</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Upcoming Flights Banner */}
                                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-4 border border-blue-500/20">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500 shrink-0">
                                                <InfoIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-gray-900 dark:text-white text-sm mb-1">
                                                    Kusatuv
                                                </h5>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                                                    Yukingizni kuzatib borish uchun Trek-kod tekshirish bo'limidan foydalaning.
                                                </p>
                                                {onNavigateToTrack && (
                                                    <button
                                                        onClick={() => {
                                                            onNavigateToTrack();
                                                            onClose();
                                                        }}
                                                        className="text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1"
                                                    >
                                                        Trek-kodni tekshirish <ArrowRight className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Upcoming Flights List */}
                                    {upcomingFlights.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                                                Keyingi Reyslar
                                            </h4>
                                            <div className="space-y-3">
                                                {upcomingFlights.map(flight => (
                                                    <FlightCard key={flight.id} flight={flight} simple />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
};

// --- Sub-components ---

const FlightCard = ({ flight, simple = false }: { flight: Flight, simple?: boolean }) => {
    const isArrived = flight.status === 'arrived';
    const isDelayed = flight.status === 'delayed';

    return (
        <div className={`
            flex items-center gap-4 p-4 rounded-2xl border transition-all
            ${simple ? 'bg-transparent border-gray-100 dark:border-white/5' : 'bg-white dark:bg-white/5 border-gray-100 dark:border-white/5 shadow-sm'}
        `}>
            {/* Icon */}
            <div className={`
                w-10 h-10 rounded-full flex items-center justify-center shrink-0
                ${flight.type === 'avia' ? 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'}
            `}>
                {flight.type === 'avia' ? <Plane className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <h5 className="font-bold text-gray-900 dark:text-white truncate">
                        {flight.flightName}
                    </h5>
                    {!simple && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize
                            ${isArrived ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                                isDelayed ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                                    'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'}
                        `}>
                            {flight.status}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        {format(flight.date, 'd MMM, yyyy')}
                    </span>
                    {simple && (
                        <span className={`capitalize font-medium
                            ${isArrived ? 'text-green-600' : isDelayed ? 'text-red-600' : 'text-blue-600'}
                         `}>
                            {flight.status}
                        </span>
                    )}
                </div>
            </div>

            {/* Status Icon (for non-simple view) */}
            {!simple && (
                <div className="shrink-0">
                    {isArrived ? (
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                    ) : isDelayed ? (
                        <AlertCircle className="w-6 h-6 text-red-500" />
                    ) : (
                        <Clock className="w-6 h-6 text-blue-500" />
                    )}
                </div>
            )}
        </div>
    );
};

const InfoIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
    </svg>
);

export default FlightScheduleModal;
