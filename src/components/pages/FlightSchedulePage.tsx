import React, { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { parseISO } from 'date-fns';
import {
    ChevronLeft,
    ChevronRight,
    Plane,
    Gift,
    Calendar as CalendarIcon,
    ArrowRight,
    Bell,
    AlertCircle,
    Loader2,
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
    getDate,
    getYear,
} from 'date-fns';
import { getFlightSchedule, type FlightScheduleItem } from '@/api/services/flightSchedule';

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

/** Runtime representation with a proper Date object for calendar/date-fns operations. */
interface Flight {
    id: number;
    date: Date;
    flightName: string;
    type: 'avia' | 'aksiya';
    status: 'arrived' | 'scheduled' | 'delayed';
    notes: string | null;
}

const mapApiItem = (item: FlightScheduleItem): Flight => ({
    id: item.id,
    date: parseISO(item.flight_date),
    flightName: item.flight_name,
    type: item.type,
    status: item.status,
    notes: item.notes,
});

// ── Calendar integration helpers ──────────────────────────────────────────────

/** Builds URL/download helpers for all supported calendar platforms. */
function buildCalendarLinks(flight: Flight, title: string, details: string) {
    const startDate = format(flight.date, 'yyyyMMdd');
    const endDate   = format(addDays(flight.date, 1), 'yyyyMMdd');
    const startISO  = format(flight.date, 'yyyy-MM-dd');
    const endISO    = format(addDays(flight.date, 1), 'yyyy-MM-dd');

    const googleUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(details)}`;

    const outlookUrl = `https://outlook.live.com/calendar/0/action/compose?subject=${encodeURIComponent(title)}&startdt=${startISO}&enddt=${endISO}&body=${encodeURIComponent(details)}&allday=true`;

    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Mandarin Cargo//Flight Schedule//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `DTSTART;VALUE=DATE:${startDate}`,
        `DTEND;VALUE=DATE:${endDate}`,
        `SUMMARY:${title}`,
        `DESCRIPTION:${details.replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n')}`,
        'STATUS:CONFIRMED',
        `UID:mandarin-cargo-flight-${flight.id}-${startDate}@mandarin-cargo.uz`,
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');

    const downloadICS = () => {
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${flight.flightName.replace(/[^a-zA-Z0-9-]/g, '_')}-${startISO}.ics`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return { googleUrl, outlookUrl, downloadICS };
}

// ── Calendar picker bottom-sheet ──────────────────────────────────────────────

interface CalendarPickerSheetProps {
    flight: Flight;
    title: string;
    details: string;
    onClose: () => void;
}

const CalendarPickerSheet = memo(({ flight, title, details, onClose }: CalendarPickerSheetProps) => {
    const { googleUrl, outlookUrl, downloadICS } = buildCalendarLinks(flight, title, details);

    const openUrl = (url: string) => { window.open(url, '_blank'); onClose(); };
    const download = () => { downloadICS(); onClose(); };

    const options: { label: string; desc?: string; dot: string; onClick: () => void }[] = [
        {
            label: 'Google Calendar',
            dot: 'bg-mc-brand',
            onClick: () => openUrl(googleUrl),
        },
        {
            label: 'Apple Calendar (iOS / macOS)',
            desc: '.ics fayl yuklanadi',
            dot: 'bg-mc-surface-2 dark:bg-mc-surface-2',
            onClick: download,
        },
        {
            label: 'Outlook Calendar',
            dot: 'bg-mc-brand',
            onClick: () => openUrl(outlookUrl),
        },
        {
            label: 'Samsung / Boshqa kalendarlar',
            desc: '.ics fayl yuklanadi',
            dot: 'bg-mc-brand',
            onClick: download,
        },
    ];

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

            {/* Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-mc-surface-2 rounded-t-2xl shadow-2xl border-t border-mc-border animate-in slide-in-from-bottom duration-200">
                {/* Handle */}
                <div className="w-10 h-1 bg-mc-surface-2 rounded-full mx-auto mt-3 mb-1" />

                <div className="px-4 pt-3 pb-8">
                    <p className="text-[11px] font-bold text-mc-text-3 uppercase tracking-wider mb-3 px-1">
                        Kalendarni tanlang
                    </p>

                    <div className="space-y-1">
                        {options.map((opt) => (
                            <button
                                key={opt.label}
                                onClick={opt.onClick}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-mc-md active:scale-[0.98] transition-all text-left"
                            >
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${opt.dot}`} />
                                <div className="min-w-0">
                                    <span className="block text-sm font-semibold text-mc-text dark:text-mc-text">
                                        {opt.label}
                                    </span>
                                    {opt.desc && (
                                        <span className="block text-[11px] text-mc-text-3 mt-0.5">
                                            {opt.desc}
                                        </span>
                                    )}
                                </div>
                                <ChevronRight className="w-4 h-4 text-mc-text-3 ml-auto flex-shrink-0" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
});

// --- Sub-components ---

const FlightCard = memo(({ flight, simple = false }: { flight: Flight, simple?: boolean }) => {
    const { t } = useTranslation();
    const months: string[] = t('flightSchedule.calendar.months', { returnObjects: true }) as unknown as string[];
    const [pickerOpen, setPickerOpen] = useState(false);

    const isArrived = flight.status === 'arrived';
    const isDelayed = flight.status === 'delayed';
    const isAksiya = flight.type === 'aksiya';

    const statusText = isAksiya ? t('flightSchedule.status.aksiya') : isArrived ? t('flightSchedule.status.arrived') : isDelayed ? t('flightSchedule.status.delayed') : t('flightSchedule.status.scheduled');

    const statusBg = isAksiya ? 'bg-mc-warn-soft dark:bg-mc-warn-soft' : isArrived ? 'bg-mc-success/12 dark:bg-mc-success/10' : isDelayed ? 'bg-mc-danger-soft dark:bg-mc-danger/10' : 'bg-mc-brand-soft dark:bg-mc-brand/10';
    const statusTextCol = isAksiya ? 'text-mc-warn' : isArrived ? 'text-mc-success' : isDelayed ? 'text-mc-danger' : 'text-mc-brand';
    const indicatorColor = isAksiya ? 'bg-mc-warn' : isArrived ? 'bg-mc-success' : isDelayed ? 'bg-mc-danger' : 'bg-mc-brand';

    const iconBoxClass = isAksiya
        ? 'bg-mc-warn-soft border-mc-warn/25 text-mc-warn'
        : 'bg-mc-brand-soft border-mc-brand/20 text-mc-brand dark:bg-mc-brand/10 dark:border-mc-brand/20 dark:text-mc-brand';

    const calTitle   = t('flightSchedule.googleCalendar.title', { name: flight.flightName });
    const calDetails = t('flightSchedule.googleCalendar.details', { name: flight.flightName, date: formatDateUzWithMonths(flight.date, 'full', months) });

    return (
        <div className={`flex items-center gap-4 p-4 rounded-mc-md border transition-all relative overflow-hidden group shadow-sm dark:shadow-none ${simple ? 'bg-white dark:bg-transparent border-mc-border dark:border-white/5' : 'bg-white dark:bg-mc-surface-2 border-mc-border'}`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${indicatorColor}`} />

            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-mc-md flex items-center justify-center shrink-0 ml-2 border ${iconBoxClass}`}>
                {isAksiya ? <Gift className="w-5 h-5 sm:w-6 sm:h-6" /> : <Plane className="w-5 h-5 sm:w-6 sm:h-6" />}
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <h5 className={`font-bold text-base leading-tight ${isAksiya ? 'text-mc-warn' : 'text-mc-text'}`}>
                    {flight.flightName}
                </h5>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <div className="flex items-center gap-1.5 text-mc-text-2 bg-mc-surface-2 px-2 py-0.5 rounded-mc-sm">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">{formatDateUzWithMonths(flight.date, 'dayMonth', months)}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-mc-sm uppercase tracking-wider ${statusBg} ${statusTextCol}`}>
                        {statusText}
                    </span>
                </div>
                {flight.notes && (
                    <p className="text-xs text-mc-text-2 mt-0.5 truncate">{flight.notes}</p>
                )}
            </div>

            <div className="shrink-0 ml-1">
                {!isArrived && (
                    <button
                        onClick={() => setPickerOpen(true)}
                        className="p-2 rounded-mc-sm text-mc-text-3 transition-colors"
                        title={t('flightSchedule.googleCalendar.tooltip')}
                    >
                        <Bell className="w-5 h-5" />
                    </button>
                )}
            </div>

            {pickerOpen && (
                <CalendarPickerSheet
                    flight={flight}
                    title={calTitle}
                    details={calDetails}
                    onClose={() => setPickerOpen(false)}
                />
            )}
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

    // Fetch the full year; re-fetch when the user navigates to a different year.
    const year = getYear(currentMonth);
    const { data, isLoading, isError } = useQuery({
        queryKey: ['flightSchedule', year],
        queryFn: () => getFlightSchedule(year),
        staleTime: 5 * 60_000,
    });

    const flights: Flight[] = useMemo(
        () => (data?.items ?? []).map(mapApiItem),
        [data],
    );

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
        flights.forEach(f => {
            const key = format(f.date, 'yyyy-MM-dd');
            if (!map.has(key)) map.set(key, []);
            map.get(key)?.push(f);
        });

        return {
            selectedFlights: flights.filter(f => isSameDay(f.date, selectedDate)),
            upcomingFlights: flights
                .filter(f => isBefore(startOfDay(new Date()), f.date))
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .slice(0, 3),
            flightsMap: map
        };
    }, [flights, selectedDate]);

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    return (
        <div className="min-h-dvh bg-mc-bg">
            {/* The page opened at max-w-5xl with its own decorative glow, so it
                was the widest client screen while the tab bar under it stayed at
                max-w-lg. The glow went with the old palette. */}
            <header className="sticky top-0 z-50 w-full border-b border-mc-border bg-mc-bg/90 backdrop-blur-xl">
                <div className="mx-auto flex h-14 max-w-lg items-center gap-2.5 px-4">
                    <button
                        onClick={onBack}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-sm
                                   bg-mc-surface-2 text-mc-text transition-transform duration-150
                                   active:scale-95"
                        aria-label={t('flightSchedule.back', 'Ortga')}
                    >
                        <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2} />
                    </button>
                    <h1 className="min-w-0 truncate text-[16px] font-extrabold text-mc-text">
                        {t('flightSchedule.title')}
                    </h1>
                </div>
            </header>

            <main className="relative z-10 mx-auto max-w-lg px-4 py-4">
                {/* Loading state */}
                {isLoading && (
                    <div className="flex items-center justify-center py-20 gap-3 text-mc-text-3">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Reyslar yuklanmoqda...</span>
                    </div>
                )}

                {/* Error state */}
                {isError && !isLoading && (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-mc-danger">
                        <AlertCircle className="w-8 h-8 opacity-70" />
                        <p className="text-sm font-medium">Reyslarni yuklashda xatolik yuz berdi</p>
                    </div>
                )}

                {!isLoading && !isError && (
                    <div className="grid grid-cols-1">

                        {/* Left Column: Calendar */}
                        <div className="lg:col-span-7 xl:col-span-8 mb-6">
                            <div className="bg-white dark:bg-mc-surface-2 border border-mc-border dark:border-white/5 rounded-mc-md p-5 shadow-sm dark:shadow-none backdrop-blur-sm">

                                {/* Month Nav */}
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-mc-text capitalize">
                                        {monthLabel}
                                    </h2>
                                    <div className="flex gap-1 bg-mc-surface-2 rounded-mc-md p-1">
                                        <button onClick={prevMonth} aria-label={t('flightSchedule.prevMonth', "Oldingi oy")} className="p-2 rounded-mc-sm text-mc-text-2 shadow-sm transition-all"><ChevronLeft className="w-5 h-5" /></button>
                                        <button onClick={nextMonth} aria-label={t('flightSchedule.nextMonth', "Keyingi oy")} className="p-2 rounded-mc-sm text-mc-text-2 shadow-sm transition-all"><ChevronRight className="w-5 h-5" /></button>
                                    </div>
                                </div>

                                {/* Weekday Header */}
                                <div className="grid grid-cols-7 mb-2">
                                    {weekdays.map(day => (
                                        <div key={day} className="text-center text-xs font-bold text-mc-text-3 uppercase tracking-wider py-2">
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
                                            ? 'bg-mc-warn text-white shadow-lg shadow-[var(--mc-shadow-card)] scale-105 z-10 border-mc-warn'
                                            : 'bg-mc-brand text-white shadow-lg shadow-[var(--mc-shadow-card)] scale-105 z-10 border-mc-brand';

                                        const todayClass = hasAksiya
                                            ? 'ring-1 ring-mc-warn text-mc-warn font-bold bg-mc-warn-soft'
                                            : 'ring-1 ring-mc-brand text-mc-brand font-bold bg-mc-brand-soft dark:bg-mc-brand/10';

                                        const defaultClass = hasAksiya
                                            ? 'bg-mc-brand-soft text-mc-brand'
                                            : '';

                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => setSelectedDate(day)}
                                                className={`
                                                    relative aspect-[1/1] sm:aspect-auto sm:py-3 lg:aspect-[4/3] rounded-mc-md flex flex-col items-center justify-center text-sm font-medium transition-all duration-200 border
                                                    ${isCurrentMonth ? 'text-mc-text border-transparent' : 'text-mc-text-3 dark:text-white/5 border-transparent'}
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
                                                                    f.type === 'aksiya' ? 'bg-mc-warn' :
                                                                        f.status === 'arrived' ? 'bg-mc-success' :
                                                                            f.status === 'delayed' ? 'bg-mc-danger' : 'bg-mc-brand'
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
                                <h3 className="text-xs font-bold text-mc-text-2 mb-3 uppercase tracking-wider flex items-center justify-between px-1">
                                    <span>{formatDateUzWithMonths(selectedDate, 'dayMonth', months)}</span>
                                    {isToday(selectedDate) && <span className="text-mc-brand bg-mc-brand-soft dark:bg-mc-brand/10 px-2 py-0.5 rounded-mc-sm">{t('flightSchedule.today')}</span>}
                                </h3>

                                {selectedFlights.length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedFlights.map(flight => (
                                            <FlightCard key={flight.id} flight={flight} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 bg-mc-surface rounded-mc-md border border-dashed border-mc-border">
                                        <div className="w-12 h-12 bg-mc-surface-2 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Plane className="w-6 h-6 text-mc-text-3" />
                                        </div>
                                        <p className="text-mc-text-3 text-sm">{t('flightSchedule.noFlights')}</p>
                                    </div>
                                )}
                            </div>

                            {/* CTA Card */}
                            <div className="relative overflow-hidden bg-gradient-to-br from-mc-brand to-mc-brand-strong rounded-mc-md p-5 shadow-xl text-mc-on-brand">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-white/20 rounded-mc-sm backdrop-blur-sm">
                                            <AlertCircle className="w-5 h-5 text-white" />
                                        </div>
                                        <h4 className="font-bold text-base">{t('flightSchedule.cta.title')}</h4>
                                    </div>
                                    <p className="text-mc-on-brand text-sm mb-4 leading-relaxed opacity-90">
                                        {t('flightSchedule.cta.desc')}
                                    </p>
                                    <button
                                        onClick={onNavigateToTrack}
                                        className="w-full bg-white/20 active:scale-95 transition-all text-white font-semibold py-3 px-4 rounded-mc-md text-sm flex items-center justify-center gap-2 backdrop-blur-sm border border-white/10"
                                    >
                                        {t('flightSchedule.cta.button')} <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Upcoming Flights (Simple List) */}
                            {upcomingFlights.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-mc-text-2 mb-3 uppercase tracking-wider px-1">
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
                )}
            </main>
        </div>
    );
};

export default FlightSchedulePage;
