import React, { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ChevronLeft,
    ChevronRight,
    Plane,
    Gift,

    Calendar as CalendarIcon,
    ArrowRight,
    Bell,
    AlertCircle
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
    startOfDay,
    getDate
} from 'date-fns';

// --- Helpers ---
const formatDateUzWithMonths = (date: Date, type: 'monthYear' | 'dayMonth' | 'full', months: string[]) => {
    const day = date.getDate();
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    const monthName = months[monthIndex];

    switch (type) {
        case 'monthYear': return `${monthName} ${year}`;
        case 'dayMonth': return `${day}-${monthName}`;
        case 'full': return `${day}-${monthName}, ${year}`;
        default: return '';
    }
};

// Google Calendar URL Generator
const generateGoogleCalendarUrl = (flight: Flight, t: (key: string, opts?: Record<string, string>) => string, months: string[]) => {
    const title = t('flightSchedule.googleCalendar.title', { name: flight.flightName });
    const start = format(flight.date, 'yyyyMMdd');
    const end = format(addDays(flight.date, 1), 'yyyyMMdd');
    const details = t('flightSchedule.googleCalendar.details', { name: flight.flightName, date: formatDateUzWithMonths(flight.date, 'full', months) });

    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(details)}`;
};

// --- Mock Data ---
interface Flight {
    id: string;
    date: Date;
    flightName: string;
    type: 'avia' | 'aksiya';
    status: 'arrived' | 'scheduled' | 'delayed';
}

const TODAY = new Date();
const CURRENT_MONTH_START = startOfMonth(TODAY);
const PREV_MONTH_START = subMonths(CURRENT_MONTH_START, 1);
const NEXT_MONTH_START = addMonths(CURRENT_MONTH_START, 1);

const MOCK_FLIGHTS: Flight[] = [
    // O'tgan reyslar
    { id: '1', date: addDays(PREV_MONTH_START, 15), flightName: 'MC-1044', type: 'avia', status: 'arrived' },
    { id: '2', date: addDays(CURRENT_MONTH_START, 2), flightName: 'MC-1045', type: 'avia', status: 'arrived' },
    { id: '3', date: addDays(CURRENT_MONTH_START, 9), flightName: 'MC-1046', type: 'avia', status: 'arrived' },
    { id: '4', date: addDays(CURRENT_MONTH_START, 16), flightName: 'MC-1047', type: 'avia', status: 'arrived' },

    // Hozirgi/Kutilayotgan reyslar (Kechikkan va Rejalashtirilgan)
    { id: '5', date: addDays(CURRENT_MONTH_START, 23), flightName: 'MC-1048', type: 'avia', status: 'delayed' },
    { id: '6', date: addDays(CURRENT_MONTH_START, 28), flightName: 'Baho Kuni (Maxsus aksiya)', type: 'aksiya', status: 'scheduled' },

    // Keyingi oy reyslari
    { id: '7', date: addDays(NEXT_MONTH_START, 4), flightName: 'MC-1049', type: 'avia', status: 'scheduled' },
    { id: '8', date: addDays(NEXT_MONTH_START, 8), flightName: 'Xalqaro Xotin-qizlar kuni 🌸', type: 'aksiya', status: 'scheduled' },
    { id: '9', date: addDays(NEXT_MONTH_START, 11), flightName: 'MC-1050', type: 'avia', status: 'scheduled' },
    { id: '10', date: addDays(NEXT_MONTH_START, 18), flightName: 'MC-1051', type: 'avia', status: 'scheduled' },
    { id: '11', date: addDays(NEXT_MONTH_START, 20), flightName: 'Navro\'z bayrami (Katta Aksiya) 🌿', type: 'aksiya', status: 'scheduled' },
];

// --- Sub-components ---

const BackgroundGlow = memo(() => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="hidden dark:block">
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[10%] right-[-5%] w-[400px] h-[400px] bg-amber-600/10 rounded-full blur-[120px]" />
        </div>
        <div className="block dark:hidden">
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-b from-gray-50 to-white opacity-80" />
        </div>
    </div>
));

const FlightCard = memo(({ flight, simple = false }: { flight: Flight, simple?: boolean }) => {
    const { t } = useTranslation();
    const months: string[] = t('flightSchedule.calendar.months', { returnObjects: true }) as unknown as string[];
    const isArrived = flight.status === 'arrived';
    const isDelayed = flight.status === 'delayed';
    const isAksiya = flight.type === 'aksiya';

    const statusText = isAksiya ? t('flightSchedule.status.aksiya') : isArrived ? t('flightSchedule.status.arrived') : isDelayed ? t('flightSchedule.status.delayed') : t('flightSchedule.status.scheduled');

    const statusBg = isAksiya ? 'bg-purple-100 dark:bg-purple-500/10' : isArrived ? 'bg-emerald-100 dark:bg-emerald-500/10' : isDelayed ? 'bg-rose-100 dark:bg-rose-500/10' : 'bg-sky-100 dark:bg-sky-500/10';
    const statusTextCol = isAksiya ? 'text-purple-700 dark:text-purple-400' : isArrived ? 'text-emerald-700 dark:text-emerald-400' : isDelayed ? 'text-rose-700 dark:text-rose-400' : 'text-sky-700 dark:text-sky-400';
    const indicatorColor = isAksiya ? 'bg-purple-500' : isArrived ? 'bg-emerald-500' : isDelayed ? 'bg-rose-500' : 'bg-sky-500';

    const iconBoxClass = isAksiya
        ? 'bg-purple-50 border-purple-100 text-purple-600 dark:bg-purple-500/10 dark:border-purple-500/20 dark:text-purple-400'
        : 'bg-sky-50 border-sky-100 text-sky-600 dark:bg-sky-500/10 dark:border-sky-500/20 dark:text-sky-400';

    return (
        <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all relative overflow-hidden group shadow-sm dark:shadow-none ${simple ? 'bg-white dark:bg-transparent border-gray-200 dark:border-white/5' : 'bg-white dark:bg-gray-900/40 border-gray-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-white/20'}`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${indicatorColor}`} />

            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ml-2 border ${iconBoxClass}`}>
                {isAksiya ? <Gift className="w-5 h-5 sm:w-6 sm:h-6" /> : <Plane className="w-5 h-5 sm:w-6 sm:h-6" />}
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <h5 className={`font-bold text-base leading-tight ${isAksiya ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-white'}`}>
                    {flight.flightName}
                </h5>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">{formatDateUzWithMonths(flight.date, 'dayMonth', months)}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${statusBg} ${statusTextCol}`}>
                        {statusText}
                    </span>
                </div>
            </div>

            <div className="shrink-0 ml-1">
                {!isArrived && (
                    <button onClick={() => window.open(generateGoogleCalendarUrl(flight, t, months), '_blank')} className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/20 dark:hover:text-blue-400 transition-colors" title={t('flightSchedule.googleCalendar.tooltip')}>
                        <Bell className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );
});

// --- Main Page Component ---

interface FlightSchedulePageProps {
    onBack: () => void;
    onNavigateToTrack: () => void;
}

const FlightSchedulePage: React.FC<FlightSchedulePageProps> = ({ onBack, onNavigateToTrack }) => {
    const { t } = useTranslation();
    const months: string[] = t('flightSchedule.calendar.months', { returnObjects: true }) as unknown as string[];
    const weekdays: string[] = t('flightSchedule.calendar.weekdays', { returnObjects: true }) as unknown as string[];
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const { calendarDays, monthLabel } = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

        return {
            calendarDays: eachDayOfInterval({ start: startDate, end: endDate }),
            monthLabel: formatDateUzWithMonths(currentMonth, 'monthYear', months)
        };
    }, [currentMonth, months]);

    const { selectedFlights, upcomingFlights, flightsMap } = useMemo(() => {
        const map = new Map<string, Flight[]>();
        MOCK_FLIGHTS.forEach(f => {
            const key = format(f.date, 'yyyy-MM-dd');
            if (!map.has(key)) map.set(key, []);
            map.get(key)?.push(f);
        });

        return {
            selectedFlights: MOCK_FLIGHTS.filter(f => isSameDay(f.date, selectedDate)),
            upcomingFlights: MOCK_FLIGHTS.filter(f => isBefore(startOfDay(new Date()), f.date))
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .slice(0, 3),
            flightsMap: map
        };
    }, [selectedDate]);

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    return (
        <div className="min-h-screen rounded-xl bg-gray-50 dark:bg-gray-950 transition-colors duration-300 relative">
            <BackgroundGlow />

            {/* Header */}
            <header className="sticky top-0 z-50 w-full rounded-t-xl border-b border-gray-200/50 dark:border-white/5 bg-white/80 dark:bg-gray-950/60 backdrop-blur-xl">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 active:scale-95 transition-all text-gray-600 dark:text-gray-300"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('flightSchedule.title')}</h1>
                    <div className="w-10" />
                </div>
            </header>

            <main className="relative z-10 max-w-5xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1">

                    {/* Left Column: Calendar */}
                    <div className="lg:col-span-7 xl:col-span-8 mb-6">
                        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-white/5 rounded-xl p-5 shadow-sm dark:shadow-none backdrop-blur-sm">

                            {/* Month Nav */}
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                                    {monthLabel}
                                </h2>
                                <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1">
                                    <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 shadow-sm transition-all"><ChevronLeft className="w-5 h-5" /></button>
                                    <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 shadow-sm transition-all"><ChevronRight className="w-5 h-5" /></button>
                                </div>
                            </div>

                            {/* Weekday Header */}
                            <div className="grid grid-cols-7 mb-2">
                                {weekdays.map(day => (
                                    <div key={day} className="text-center text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider py-2">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Grid */}
                            <div className="grid grid-cols-7 gap-1 sm:gap-2">
                                {calendarDays.map((day, idx) => {
                                    const dayKey = format(day, 'yyyy-MM-dd');
                                    const dayFlights = flightsMap.get(dayKey) || [];
                                    const hasFlight = dayFlights.length > 0;
                                    const hasAksiya = dayFlights.some(f => f.type === 'aksiya');
                                    const isSelected = isSameDay(day, selectedDate);
                                    const isCurrentMonth = isSameMonth(day, currentMonth);
                                    const isTodayDate = isToday(day);

                                    const selectedClass = hasAksiya
                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-105 z-10 border-purple-500'
                                        : 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105 z-10 border-blue-500';

                                    const todayClass = hasAksiya
                                        ? 'ring-1 ring-purple-500 text-purple-600 font-bold bg-purple-50/50 dark:bg-purple-500/10'
                                        : 'ring-1 ring-blue-500 text-blue-500 font-bold bg-blue-50/50 dark:bg-blue-500/10';

                                    const defaultClass = hasAksiya
                                        ? 'hover:bg-purple-50 dark:hover:bg-purple-500/10 text-purple-700 dark:text-purple-300 bg-purple-50/30 dark:bg-purple-500/5'
                                        : 'hover:bg-gray-50 dark:hover:bg-white/5';

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedDate(day)}
                                            className={`
                                                relative aspect-[1/1] sm:aspect-auto sm:py-3 lg:aspect-[4/3] rounded-xl flex flex-col items-center justify-center text-sm font-medium transition-all duration-200 border
                                                ${!isCurrentMonth ? 'text-gray-300 dark:text-white/5 border-transparent' : 'text-gray-700 dark:text-gray-300 border-transparent'}
                                                ${isSelected ? selectedClass : defaultClass}
                                                ${isTodayDate && !isSelected ? todayClass : ''}
                                            `}
                                        >
                                            <span className="z-10">{getDate(day)}</span>

                                            {/* Flight Dots */}
                                            {hasFlight && (
                                                <div className="flex gap-0.5 mt-1 z-10">
                                                    {dayFlights.map((f, i) => (
                                                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' :
                                                                f.type === 'aksiya' ? 'bg-purple-500' :
                                                                    f.status === 'arrived' ? 'bg-emerald-500' :
                                                                        f.status === 'delayed' ? 'bg-rose-500' : 'bg-blue-400'
                                                            }`} />
                                                    ))}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Details */}
                    <div className="lg:col-span-5 xl:col-span-4 space-y-6">

                        {/* Selected Day Info */}
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center justify-between px-1">
                                <span>{formatDateUzWithMonths(selectedDate, 'dayMonth', months)}</span>
                                {isToday(selectedDate) && <span className="text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-md">{t('flightSchedule.today')}</span>}
                            </h3>

                            {selectedFlights.length > 0 ? (
                                <div className="space-y-3">
                                    {selectedFlights.map(flight => (
                                        <FlightCard key={flight.id} flight={flight} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-white dark:bg-white/5 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                                    <div className="w-12 h-12 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Plane className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                                    </div>
                                    <p className="text-gray-400 dark:text-gray-500 text-sm">{t('flightSchedule.noFlights')}</p>
                                </div>
                            )}
                        </div>

                        {/* CTA Card */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl p-5 shadow-xl text-white">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                        <AlertCircle className="w-5 h-5 text-white" />
                                    </div>
                                    <h4 className="font-bold text-base">{t('flightSchedule.cta.title')}</h4>
                                </div>
                                <p className="text-indigo-100 text-sm mb-4 leading-relaxed opacity-90">
                                    {t('flightSchedule.cta.desc')}
                                </p>
                                <button
                                    onClick={onNavigateToTrack}
                                    className="w-full bg-white/20 hover:bg-white/30 active:scale-95 transition-all text-white font-semibold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 backdrop-blur-sm border border-white/10"
                                >
                                    {t('flightSchedule.cta.button')} <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Upcoming Flights (Simple List) */}
                        {upcomingFlights.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider px-1">
                                    {t('flightSchedule.upcoming')}
                                </h3>
                                <div className="space-y-2">
                                    {upcomingFlights.map(flight => (
                                        <FlightCard key={flight.id} flight={flight} simple />
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
};

export default FlightSchedulePage;