import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
    onClick,
    onPaymentClick
}: {
    item: CombinedNotification;
    onClick: (item: CombinedNotification) => void;
    onPaymentClick: () => void;
}) => {
    const { t, i18n } = useTranslation();
    const isPaymentNotification = item.type === 'notification' && item.iconType === 'payment';

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
                "relative flex gap-3.5 rounded-[1.15rem] border p-3.5 transition-all cursor-pointer group shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                item.is_read
                    ? "border-gray-200/70 bg-white/70 hover:border-orange-200/80 dark:border-white/[0.065] dark:bg-white/[0.035] dark:hover:border-orange-300/15"
                    : "border-orange-200/70 bg-orange-50/90 shadow-[0_10px_24px_rgba(245,158,11,0.08)] dark:border-orange-300/18 dark:bg-orange-400/[0.075] dark:shadow-[0_12px_28px_rgba(0,0,0,0.20)]"
            )}
        >
            {/* Icon Bubble */}
            <div className={cn(
                "shrink-0 w-9 h-9 rounded-[14px] flex items-center justify-center border",
                item.is_read
                    ? "bg-gray-100/80 dark:bg-white/[0.045] border-gray-200 dark:border-white/[0.07] text-gray-400"
                    : "bg-white dark:bg-orange-300/[0.10] border-orange-100 dark:border-orange-300/15 shadow-sm"
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
                            <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-black rounded-full bg-orange-100/80 dark:bg-orange-300/[0.10] text-orange-700 dark:text-amber-300 border border-orange-200/70 dark:border-orange-300/15">
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
                    item.is_read ? "text-gray-500 dark:text-white/38" : "text-gray-600 dark:text-white/58"
                )}>
                    {item.body.replace(/<\/?b>/g, ' ')}
                </p>
                {isPaymentNotification && (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onPaymentClick();
                        }}
                        className="mt-2.5 inline-flex h-8 items-center rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-3 text-xs font-black text-[#241406] shadow-[0_8px_18px_rgba(245,158,11,0.22)] transition-transform active:scale-95"
                    >
                        {t('dashboard.actions.payment.action')}
                    </button>
                )}
            </div>

            {/* Unread Indicator */}
            {!item.is_read && (
                <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
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
                            className="relative w-full max-w-md overflow-hidden rounded-[1.6rem] border border-gray-100 bg-white shadow-2xl pointer-events-auto dark:border-white/[0.075] dark:bg-[#080b11] dark:shadow-[0_28px_70px_rgba(0,0,0,0.56)]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between border-b border-gray-100 bg-gray-50/70 p-5 pb-4 dark:border-white/[0.075] dark:bg-white/[0.025]">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    {notification.iconType && (
                                        <span className="shrink-0 rounded-[14px] border border-orange-200/70 bg-orange-50 p-2 text-orange-600 dark:border-orange-300/15 dark:bg-orange-300/[0.10] dark:text-amber-300">
                                            <MessageSquare className="h-4 w-4" />
                                        </span>
                                    )}
                                    <div className="min-w-0">
                                        <h3 className="truncate text-base font-black text-gray-950 dark:text-[#fff8ed]">
                                            {notification.title}
                                        </h3>
                                        <p className="mt-0.5 text-xs font-semibold text-gray-400 dark:text-white/38">
                                            {notification.date && formatNotificationDate(notification.date, localeCode, yesterdayLabel)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="shrink-0 rounded-xl p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-white/42 dark:hover:bg-white/[0.07] dark:hover:text-white"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-5">
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-white/64">
                                    {notification.body.replace(/<\/?b>/g, ' ')}
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end border-t border-gray-100 p-4 pt-3 dark:border-white/[0.075]">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={onClose}
                                    className="rounded-xl bg-gray-100 font-bold hover:bg-gray-200 dark:bg-white/[0.07] dark:text-white dark:hover:bg-white/[0.10]"
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
    const [isNudgeVisible, setIsNudgeVisible] = useState(false);
    const lastAnnouncedUnreadCount = useRef(0);

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

    useEffect(() => {
        if (totalUnreadCount <= 0) {
            lastAnnouncedUnreadCount.current = 0;
            setIsNudgeVisible(false);
            return undefined;
        }

        if (isOpen) {
            lastAnnouncedUnreadCount.current = totalUnreadCount;
            setIsNudgeVisible(false);
            return undefined;
        }

        if (lastAnnouncedUnreadCount.current === totalUnreadCount) {
            return undefined;
        }

        lastAnnouncedUnreadCount.current = totalUnreadCount;
        const timer = window.setTimeout(() => {
            setIsNudgeVisible(true);
        }, 650);

        return () => window.clearTimeout(timer);
    }, [isOpen, totalUnreadCount]);

    useEffect(() => {
        if (!isNudgeVisible) return undefined;

        const timer = window.setTimeout(() => {
            setIsNudgeVisible(false);
        }, 7000);

        return () => window.clearTimeout(timer);
    }, [isNudgeVisible, totalUnreadCount]);

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

    const handlePaymentNotificationClick = useCallback(() => {
        setIsOpen(false);
        setSelectedNotification(null);
        window.dispatchEvent(new CustomEvent('dashboard:open-payment'));
    }, []);

    const handleOpenNotificationsFromNudge = useCallback(() => {
        setIsNudgeVisible(false);
        setIsOpen(true);
    }, []);

    // --- Notification Panel Content ---
    const renderContent = () => (
        <div className="flex h-full max-h-[85vh] flex-col overflow-hidden bg-white dark:bg-[#080b11] sm:max-h-[520px]">
            {/* Header */}
            <div className="sticky top-0 z-10 shrink-0 border-b border-gray-100 bg-white/85 p-4 backdrop-blur-xl dark:border-white/[0.075] dark:bg-[#080b11]/92">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="grid h-9 w-9 place-items-center rounded-[14px] border border-orange-200/70 bg-orange-50 text-orange-600 dark:border-orange-300/15 dark:bg-orange-300/[0.10] dark:text-amber-300">
                                <Bell className="h-[18px] w-[18px]" />
                            </span>
                            <div className="min-w-0">
                                <h3 className="truncate text-[17px] font-black leading-tight text-gray-950 dark:text-[#fff8ed]">
                                    {t('notifications.title', 'Bildirishnomalar')}
                                </h3>
                                <p className="mt-0.5 text-[11px] font-semibold text-gray-400 dark:text-white/38">
                                    {totalUnreadCount > 0 ? `${totalUnreadCount} ta yangi xabar` : t('notifications.empty')}
                                </p>
                            </div>
                            {(isNotifRefetching || isNotifLoading || isReportsLoading) && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" />
                            )}
                        </div>
                    </div>
                <div className="flex items-center gap-1">
                    {totalUnreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMarkAllAsRead}
                            disabled={markAllReadMutation.isPending}
                            className="h-8 gap-1.5 rounded-xl bg-orange-50 px-2.5 text-[11px] font-black text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:bg-orange-300/[0.10] dark:text-amber-300 dark:hover:bg-orange-300/[0.16]"
                        >
                            <CheckCheck className="h-3.5 w-3.5" />
                            {t('notifications.markAll', "O'qilgan qilish")}
                        </Button>
                    )}
                    {isMobile && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleMobileClose}
                            className="ml-1 h-8 w-8 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-white/42 dark:hover:bg-white/[0.07] dark:hover:text-white"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent dark:scrollbar-thumb-white/10">
                {(isNotifLoading) && !notificationsData ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                        <span className="text-xs text-gray-400">{t('notifications.loading')}</span>
                    </div>
                ) : combinedNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-gray-500 dark:text-white/42">
                        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gray-100 dark:bg-white/[0.045]">
                            <Bell className="h-6 w-6 text-gray-400 dark:text-white/32" />
                        </div>
                        <p className="text-sm">{t('notifications.empty')}</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {combinedNotifications.map((notification) => (
                            <NotificationItem
                                key={notification.id}
                                item={notification}
                                onClick={handleReadItem}
                                onPaymentClick={handlePaymentNotificationClick}
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

            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {isNudgeVisible && totalUnreadCount > 0 && !isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.96 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                            className="fixed left-4 right-4 top-[5.3rem] z-[9997] mx-auto max-w-[390px] sm:left-auto sm:right-5 sm:top-[5.6rem]"
                        >
                            <div className="relative overflow-hidden rounded-[1.25rem] border border-orange-200/70 bg-white/96 p-3.5 shadow-[0_18px_42px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl dark:border-orange-300/16 dark:bg-[#0a0e15]/94 dark:shadow-[0_22px_54px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.07)]">
                                <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-orange-300/70 to-transparent dark:via-amber-200/45" />
                                <div className="flex items-center gap-3">
                                    <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[15px] border border-orange-200 bg-orange-50 text-orange-600 shadow-sm dark:border-orange-300/16 dark:bg-orange-300/[0.10] dark:text-amber-300">
                                        <Bell className="h-5 w-5" />
                                        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-orange-500 px-1 text-[10px] font-black text-[#241406] dark:border-[#0a0e15]">
                                            {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleOpenNotificationsFromNudge}
                                        className="min-w-0 flex-1 text-left"
                                    >
                                        <p className="truncate text-sm font-black text-gray-950 dark:text-[#fff8ed]">
                                            {t('notifications.newPopupTitle', 'Sizga yangi xabar bor')}
                                        </p>
                                        <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-gray-500 dark:text-white/48">
                                            {t('notifications.newPopupDesc', "Bildirishnomalarni ko'rish uchun bosing")}
                                        </p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsNudgeVisible(false)}
                                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-white/38 dark:hover:bg-white/[0.07] dark:hover:text-white/80"
                                        aria-label={t('notifications.close')}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* === Bell Button + Desktop Popover === */}
            <Popover open={isOpen && !isMobile} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <div
                        className="relative group cursor-pointer"
                        onClick={() => isMobile && setIsOpen(prev => !prev)}
                    >
                        <div className={cn(
                            "relative grid h-10 w-10 place-items-center rounded-2xl border transition-all duration-300 shadow-[0_12px_24px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.08)]",
                            isOpen
                                ? "border-orange-300/40 bg-orange-100/80 text-orange-600 dark:border-orange-300/25 dark:bg-orange-400/[0.14] dark:text-amber-300"
                                : "border-gray-200/80 bg-white/90 text-gray-500 hover:border-orange-200 hover:bg-orange-50/70 dark:border-white/[0.085] dark:bg-white/[0.055] dark:text-white/48 dark:hover:border-orange-300/20 dark:hover:bg-orange-400/[0.09]"
                        )}>
                            <Bell
                                className={cn(
                                    "h-[21px] w-[21px] transition-colors",
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
                                        className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-orange-500 px-1 text-[10px] font-black text-[#241406] shadow-sm dark:border-[#080b11]"
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
                        className="w-[370px] overflow-hidden rounded-[1.6rem] border border-gray-100 bg-white/95 p-0 shadow-2xl backdrop-blur-xl dark:border-white/[0.075] dark:bg-[#080b11]/96 dark:shadow-[0_28px_70px_rgba(0,0,0,0.52)]"
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
                                className="fixed inset-0 z-[9998] bg-black/45 backdrop-blur-[2px]"
                            />
                            {/* Drawer */}
                            <motion.div
                                key="drawer-panel"
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed bottom-0 left-0 right-0 z-[9999] flex max-h-[85vh] flex-col overflow-hidden rounded-t-[2rem] border-t border-gray-100 bg-white shadow-[0_-16px_44px_rgba(0,0,0,0.16)] dark:border-white/[0.075] dark:bg-[#080b11] dark:shadow-[0_-24px_70px_rgba(0,0,0,0.56)]"
                            >
                                <div className="mx-auto mt-3 mb-1 h-1.5 w-12 shrink-0 rounded-full bg-gray-200 dark:bg-white/14" />
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
