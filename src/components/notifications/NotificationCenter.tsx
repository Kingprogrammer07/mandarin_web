import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    CheckCheck,
    Info,
    AlertCircle,
    CreditCard,
    Package,
    X,
    Loader2,
    Plane,
    MessageSquare
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { uz, ru } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

import { notificationService, type Notification, type NotificationListResponse } from '@/api/services/notificationService';
import { reportService, type ReportResponse } from '@/api/services/reportService';

import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// --- Types ---
type CombinedNotification = {
    id: string | number;
    type: 'notification' | 'report';
    title: string;
    body: string;
    date: string; // ISO string
    is_read: boolean;
    iconType?: string; // for API notifications
    metadata?: { flightName?: string }; // Extra data like flight name

};

// --- Utility: Date Formatting ---
const formatNotificationDate = (dateString: string, localeCode: string, yesterdayLabel?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const locale = localeCode === 'ru' ? ru : uz;

    if (isToday(date)) {
        return format(date, 'HH:mm', { locale });
    }
    if (isYesterday(date)) {
        return yesterdayLabel || (localeCode === 'ru' ? 'Вчера' : 'Kecha');
    }
    return format(date, 'dd MMM', { locale });
};

// --- Component: Notification Item ---
const NotificationItem = ({
    item,
    onClick
}: {
    item: CombinedNotification;
    onClick: (item: CombinedNotification) => void;
}) => {
    const { t, i18n } = useTranslation();

    const getIcon = (type: string, iconType?: string) => {
        if (type === 'report') return <Plane className="w-4 h-4 text-sky-500" />;

        switch (iconType) {
            case 'payment': return <CreditCard className="w-4 h-4 text-green-500" />;
            case 'cargo': return <Package className="w-4 h-4 text-orange-500" />;
            case 'alert': return <AlertCircle className="w-4 h-4 text-red-500" />;
            default: return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -10 }}
            whileHover={{ scale: 0.995 }}
            onClick={() => onClick(item)}
            className={cn(
                "relative flex gap-3 p-3 rounded-xl transition-all border cursor-pointer group mb-2",
                item.is_read
                    ? "bg-white/50 dark:bg-zinc-900/30 border-transparent hover:border-gray-200 dark:hover:border-zinc-700"
                    : "bg-orange-50/80 dark:bg-orange-900/10 border-orange-100 dark:border-orange-500/20 shadow-sm"
            )}
        >
            {/* Icon Bubble */}
            <div className={cn(
                "shrink-0 w-8 h-8 rounded-full flex items-center justify-center border",
                item.is_read
                    ? "bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-400"
                    : "bg-white dark:bg-zinc-800 border-white/50 dark:border-zinc-600 shadow-sm"
            )}>
                {getIcon(item.type, item.iconType)}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <p className={cn(
                            "text-sm font-semibold truncate",
                            item.is_read ? "text-gray-600 dark:text-zinc-400" : "text-gray-900 dark:text-zinc-100"
                        )}>
                            {item.title}
                        </p>
                        {item.type === 'notification' && (
                            <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                {t('notifications.system')}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-zinc-500 shrink-0 mt-0.5">
                        {formatNotificationDate(item.date, i18n.language, t('notifications.yesterday'))}
                    </span>
                </div>
                <p className={cn(
                    "text-xs mt-0.5 line-clamp-2 leading-relaxed",
                    item.is_read ? "text-gray-500 dark:text-zinc-500" : "text-gray-600 dark:text-zinc-300"
                )}>
                    {item.body.replace(/<\/?b>/g, ' ')}
                </p>
            </div>

            {/* Unread Indicator */}
            {!item.is_read && (
                <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            )}
        </motion.div>
    );
};

// --- Detail Dialog (Portal) ---
// Rendered OUTSIDE the isOpen condition so it survives drawer close.
const DetailDialog = ({
    notification,
    onClose,
    localeCode,
    closeLabel,
    yesterdayLabel,
}: {
    notification: CombinedNotification | null;
    onClose: () => void;
    localeCode: string;
    closeLabel: string;
    yesterdayLabel: string;
}) => {
    // Keyboard escape handler
    useEffect(() => {
        if (!notification) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [notification, onClose]);

    return createPortal(
        <AnimatePresence>
            {notification && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="detail-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000]"
                    />

                    {/* Dialog Content */}
                    <motion.div
                        key="detail-dialog"
                        initial={{ opacity: 0, scale: 0.92, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-zinc-950/60 border border-gray-100 dark:border-zinc-800 overflow-hidden pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between p-5 pb-3 border-b border-gray-100 dark:border-zinc-800">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    {notification.iconType && (
                                        <span className="shrink-0 p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                                            <MessageSquare className="w-4 h-4" />
                                        </span>
                                    )}
                                    <div className="min-w-0">
                                        <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 truncate">
                                            {notification.title}
                                        </h3>
                                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                                            {notification.date && formatNotificationDate(notification.date, localeCode, yesterdayLabel)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-5">
                                <p className="text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                    {notification.body.replace(/<\/?b>/g, ' ')}
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end p-4 pt-2 border-t border-gray-100 dark:border-zinc-800">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={onClose}
                                    className="rounded-xl"
                                >
                                    {closeLabel}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
};

// --- Main Component ---
export default function NotificationCenter() {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();

    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<CombinedNotification | null>(null);

    // Profile for reports
    const { data: user } = useProfile();

    // Detect Mobile
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // --- Queries ---

    // 1. Unread Notification Count
    const { data: apiUnreadData } = useQuery({
        queryKey: ['notifications', 'unread'],
        queryFn: notificationService.getUnreadCount,
        refetchInterval: 30000,
    });

    // 2. API Notifications List
    const {
        data: notificationsData,
        isLoading: isNotifLoading,
        isRefetching: isNotifRefetching
    } = useQuery({
        queryKey: ['notifications', 'list'],
        queryFn: () => notificationService.getNotifications(1, 20),
        enabled: isOpen,
    });

    // 3. Reports (Web History) - serving as "Report Notifications"
    const {
        data: reportsHistory,
        isLoading: isReportsLoading
    } = useQuery({
        queryKey: ['webHistory', user?.client_code],
        queryFn: () => reportService.getWebHistory(user!.client_code, undefined, 1, 10),
        enabled: isOpen && !!user?.client_code,
    });

    // 4. Report Unread Count
    const { data: webFlights = [] } = useQuery({
        queryKey: ['webFlights', user?.client_code],
        queryFn: () => reportService.getWebFlights(user!.client_code),
        enabled: !!user?.client_code,
        staleTime: 1000 * 60 * 5
    });

    // Calculate Unread counts
    const webFlightsList = webFlights;


    const lastSeenFlightCount = parseInt(localStorage.getItem('last_seen_flight_count') || '0');
    const reportUnreadCount = Math.max(0, webFlightsList.length - lastSeenFlightCount);

    // Total Unread
    const totalUnreadCount = (apiUnreadData?.count || 0) + reportUnreadCount;

    // --- Merge & Sort Logic ---
    // API Notifications are ALWAYS pinned to the top, sorted by date desc.
    // Reports follow after, sorted by date desc.
    const combinedNotifications: CombinedNotification[] = useMemo(() => {
        // 1. API Notifications
        const apiList: CombinedNotification[] = [];
        if (notificationsData?.items) {
            notificationsData.items.forEach(n => {
                apiList.push({
                    id: n.id,
                    type: 'notification',
                    title: n.title,
                    body: n.body,
                    date: n.created_at,
                    is_read: n.is_read,
                    iconType: n.type
                });
            });
        }
        // Sort API Notifications by date desc
        apiList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // 2. Reports
        const reportsListPlain: CombinedNotification[] = [];
        const rawReports: ReportResponse[] = reportsHistory ?? [];

        if (rawReports) {
            rawReports.forEach((r: ReportResponse, index: number) => {

                const isReportUnread = index < reportUnreadCount;

                reportsListPlain.push({
                    id: `report-${r.flight_name}`,
                    type: 'report',
                    title: t('notifications.reportTitle', { name: r.flight_name }),
                    body: t('notifications.reportDesc', { weight: r.total_weight, price: r.total_price_usd }),
                    date: r.is_sent_web_date,
                    is_read: !isReportUnread,
                    metadata: { flightName: r.flight_name }
                });
            });
        }
        // Sort Reports by date desc
        reportsListPlain.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // 3. Combine: API notifications pinned first, then reports
        return [...apiList, ...reportsListPlain];
    }, [notificationsData, reportsHistory, reportUnreadCount, t]);

    // --- Mutations ---
    const markReadMutation = useMutation<{ status: string }, unknown, number, { previousList: NotificationListResponse | undefined }>({
        mutationFn: notificationService.markAsRead,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['notifications'] });
            const previousList = queryClient.getQueryData<NotificationListResponse>(['notifications', 'list']);
            // Optimistic Update
            queryClient.setQueryData<NotificationListResponse | undefined>(
                ['notifications', 'list'],
                (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        items: old.items.map((n: Notification) =>
                            n.id === id ? { ...n, is_read: true } : n
                        )
                    };
                }
            );

            return { previousList };
        },
        onError: (_err, _newList, context) => {
            queryClient.setQueryData(['notifications', 'list'], context?.previousList);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
        }
    });

    const markAllReadMutation = useMutation({
        mutationFn: notificationService.markAllAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });

            // Also mark local reports as read
            const currentFlights = webFlights;

            if (currentFlights.length > 0) {
                localStorage.setItem('last_seen_flight_count', currentFlights.length.toString());
                queryClient.invalidateQueries({ queryKey: ['webFlights'] });
            }
        }
    });

    // --- Handlers ---
    const handleReadItem = useCallback((item: CombinedNotification) => {
        // 1. Always close the drawer/popover first
        setIsOpen(false);

        if (item.type === 'report') {
            // Update local storage to mark reports as read
            if (!item.is_read) {
                const currentFlights = webFlights;

                localStorage.setItem('last_seen_flight_count', currentFlights.length.toString());
                queryClient.invalidateQueries({ queryKey: ['webFlights'] });
            }
            // Navigate to reports page
            window.history.pushState({ page: 'user-reports' }, '', '/user/reports');
            window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
            // 2. API Notification -> Open detail dialog
            // selectedNotification state persists after drawer closes,
            // DetailDialog is rendered outside the isOpen condition.
            setSelectedNotification(item);

            // Mark as read
            if (!item.is_read && typeof item.id === 'number') {
                markReadMutation.mutate(item.id);
            }
        }
    }, [webFlights, queryClient, markReadMutation]);

    const handleMarkAllAsRead = useCallback(() => {
        markAllReadMutation.mutate();
    }, [markAllReadMutation]);

    const closeDetailDialog = useCallback(() => {
        setSelectedNotification(null);
    }, []);

    const handleMobileClose = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(false);
    }, []);

    // --- Notification Panel Content ---
    const renderContent = () => (
        <div className="flex flex-col h-full max-h-[85vh] sm:max-h-[500px]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
                <h3 className="font-bold text-lg dark:text-zinc-100 flex items-center gap-2">
                    {t('notifications.title', 'Bildirishnomalar')}
                    {(isNotifRefetching || isNotifLoading || isReportsLoading) && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                    )}
                </h3>
                <div className="flex items-center gap-1">
                    {totalUnreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMarkAllAsRead}
                            disabled={markAllReadMutation.isPending}
                            className="text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 h-8 gap-1.5"
                        >
                            <CheckCheck className="w-3.5 h-3.5" />
                            {t('notifications.markAll', "O'qilgan qilish")}
                        </Button>
                    )}
                    {isMobile && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleMobileClose}
                            className="h-8 w-8 ml-1"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                {(isNotifLoading) && !notificationsData ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                        <span className="text-xs text-gray-400">{t('notifications.loading')}</span>
                    </div>
                ) : combinedNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 dark:text-zinc-500 gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-800/50 flex items-center justify-center">
                            <Bell className="w-6 h-6 text-gray-400 dark:text-zinc-600" />
                        </div>
                        <p className="text-sm">{t('notifications.empty')}</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {combinedNotifications.map((notification) => (
                            <NotificationItem
                                key={notification.id}
                                item={notification}
                                onClick={handleReadItem}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            <style>{`
                @keyframes bell-ring {
                    0%, 100% { transform: rotate(0); }
                    5%, 15% { transform: rotate(15deg); }
                    10%, 20% { transform: rotate(-15deg); }
                    25% { transform: rotate(0); }
                }
            `}</style>

            {/* === Detail Dialog Portal === */}
            {/* Rendered at root level, OUTSIDE the isOpen condition, */}
            {/* so it survives the drawer/popover closing. */}
            <DetailDialog
                notification={selectedNotification}
                onClose={closeDetailDialog}
                localeCode={i18n.language}
                closeLabel={t('notifications.close')}
                yesterdayLabel={t('notifications.yesterday')}
            />

            {/* === Bell Button + Desktop Popover === */}
            <Popover open={isOpen && !isMobile} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <div
                        className="relative group cursor-pointer"
                        onClick={() => isMobile && setIsOpen(prev => !prev)}
                    >
                        <div className={cn(
                            "p-2 rounded-xl transition-all duration-300",
                            isOpen
                                ? "bg-orange-100/50 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400"
                                : "hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400"
                        )}>
                            <Bell
                                className={cn(
                                    "w-6 h-6 transition-colors",
                                    totalUnreadCount > 0
                                        ? "text-amber-500 dark:text-amber-400"
                                        : "text-gray-500 dark:text-zinc-400"
                                )}
                                style={{
                                    animation: totalUnreadCount > 0 ? 'bell-ring 4s ease-in-out infinite' : 'none',
                                    transformOrigin: 'top center'
                                }}
                            />

                            <AnimatePresence>
                                {totalUnreadCount > 0 && (
                                    <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        exit={{ scale: 0 }}
                                        className="absolute top-1.5 right-1.5 min-w-[1.125rem] h-4.5 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-white dark:border-zinc-950 shadow-sm"
                                    >
                                        {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </PopoverTrigger>

                {/* Desktop Popover Content */}
                {!isMobile && (
                    <PopoverContent
                        align="end"
                        className="w-[360px] p-0 overflow-hidden shadow-2xl dark:shadow-zinc-950/50 border-gray-100 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl"
                    >
                        {renderContent()}
                    </PopoverContent>
                )}
            </Popover>

            {/* === Mobile Drawer Portal === */}
            {/* AnimatePresence is OUTSIDE the conditional so exit animations work. */}
            {isMobile && createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            {/* Overlay */}
                            <motion.div
                                key="drawer-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                onClick={() => setIsOpen(false)}
                                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998]"
                            />
                            {/* Drawer */}
                            <motion.div
                                key="drawer-panel"
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed bottom-0 left-0 right-0 z-[9999] bg-white dark:bg-zinc-900 rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] max-h-[85vh] flex flex-col"
                            >
                                <div className="w-12 h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full mx-auto mt-3 mb-1 shrink-0" />
                                {renderContent()}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}
