import { useState, useCallback, lazy, Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProfile } from '@/hooks/useProfile';
import { reportService } from '@/api/services/reportService';
import {
    shipmentService,
    type ShipmentView,
} from '@/api/services/shipmentService';
import { HomeHeader } from '@/components/user/HomeHeader';
import { InfoNote } from '@/components/user/InfoNote';
import { SegmentedTabs } from '@/components/user/SegmentedTabs';
import { FlightActionDock } from '@/components/user/FlightActionDock';
import { FlightReportCard } from '@/components/user/FlightReportCard';
import { PaymentSummaryCard } from '@/components/user/PaymentSummaryCard';
import { ShipmentCard } from '@/components/user/ShipmentCard';
import { TrackCodeList } from '@/components/user/TrackCodeList';
import { trackCargo, type TrackCodeSearchResponse } from '@/api/services/cargo';
import { TrackResultCard } from '@/pages/dashboard/components/TrackResultCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ChevronLeft,
    AlertCircle,
    XCircle,
    RefreshCw,
    Search,
    CreditCard,
    History,
    X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
const MakePaymentModal = lazy(() => import('@/components/modals/MakePaymentModal'));
const NotificationCenter = lazy(
    () => import('@/components/notifications/NotificationCenter'),
);

/**
 * Which list is on screen.
 *
 * The three tabs are a partition of the client's current cargo — `active` is in
 * the Tashkent warehouse AND priced, `transit` is everything still moving,
 * `archive` is collected. `history` is not a tab but the full list behind its
 * own button: it also holds the pre-scanner flights (79 of them, M214-M226)
 * that the tabs deliberately leave out.
 */
type ShipmentTab = ShipmentView;

/** Below this the search field is dead weight on a 320px screen: the median
 *  client has 3 flights and only 14.8% have more than ten. */
const SEARCH_THRESHOLD = 10;
import { useTranslation } from 'react-i18next';
import { clearNbuReturnParams } from '@/utils/nbuReturnContext';
import { triggerSoftHaptic } from '@/utils/haptics';

const PAGE_SIZE = 10;

// --- Types ---

type ViewState = 'list' | 'detail';

interface ImagePreviewModalProps {
    src: string | null;
    onClose: () => void;
    /** Passed in rather than read from a hook: the viewer is a plain
     *  expression component and the label is the only string it needs. */
    closeLabel: string;
}

const ImagePreviewModal = ({ src, onClose, closeLabel }: ImagePreviewModalProps) => (
    <AnimatePresence>
        {src && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 cursor-zoom-out"
            >
                <button
                    onClick={onClose}
                    aria-label={closeLabel}
                    className="absolute top-4 right-4 sm:top-8 sm:right-8 p-2 bg-white/10 text-white rounded-full backdrop-blur-md transition-colors z-50"
                >
                    <XCircle className="w-8 h-8" />
                </button>
                <motion.img
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    src={src}
                    alt="Preview"
                    className="max-w-full max-h-[90dvh] object-contain rounded-mc-md shadow-2xl cursor-default"
                    onClick={(e) => e.stopPropagation()}
                />
            </motion.div>
        )}
    </AnimatePresence>
);

// --- Custom Drawer Component ---
interface BottomDrawerProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

const BottomDrawer = ({ open, onClose, children }: BottomDrawerProps) => (
    <AnimatePresence>
        {open && (
            <>
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
                />
                {/* Drawer Panel */}
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed bottom-0 left-0 right-0 z-50 bg-mc-surface rounded-t-mc-xl max-h-[85dvh] flex flex-col shadow-2xl"
                >
                    {/* Handle */}
                    <div className="w-10 h-1 bg-mc-border rounded-full mx-auto mt-3 mb-2 flex-shrink-0" />

                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-10">
                        {children}
                    </div>
                </motion.div>
            </>
        )}
    </AnimatePresence>
);

interface UserReportsPageProps {
    onBack?: () => void;
    onNavigateToDelivery?: () => void;
}

export default function UserReportsPage({ onNavigateToDelivery }: UserReportsPageProps) {
    const { data: user, isLoading: isUserLoading, isError: isUserError } = useProfile();
    const { t } = useTranslation();

    // State
    const [selectedFlight, setSelectedFlight] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ShipmentTab>('active');
    const [search, setSearch] = useState('');
    const view: ViewState = selectedFlight ? 'detail' : 'list';

    // Track Drawer State
    const [selectedTrackCode, setSelectedTrackCode] = useState<string | null>(null);
    const [trackData, setTrackData] = useState<TrackCodeSearchResponse | null>(null);
    const [isTrackLoading, setIsTrackLoading] = useState(false);

    // Payment Modal State
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [paymentFlightName, setPaymentFlightName] = useState<string | null>(null);

    // Image Preview State
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Pagination sizes — grow by PAGE_SIZE on each "Load more" click
    const [flightsFetchSize, setFlightsFetchSize] = useState(PAGE_SIZE);
    const [historyFetchSize, setHistoryFetchSize] = useState(PAGE_SIZE);

    // Reset history page size when the selected flight changes
    useEffect(() => { setHistoryFetchSize(PAGE_SIZE); }, [selectedFlight]);

    // --- Data Fetching (TanStack Query) ---

    // 1. Fetch Flights
    const {
        data: shipments,
        isLoading: isLoadingFlights,
        isFetching: isFetchingMoreFlights,
        refetch: refetchFlights,
        isRefetching: isRefetchingFlights
    } = useQuery({
        // No client_code in the key: the server scopes to the session's own
        // codes, and a client with two of them would otherwise cache twice.
        queryKey: ['shipments', activeTab, search, flightsFetchSize],
        queryFn: () => shipmentService.list(activeTab, 1, flightsFetchSize, search),
        enabled: !!user,
        staleTime: 5 * 60 * 1000,
    });

    // 2. Fetch History (Only when flight selected)
    const {
        data: history = [],
        isLoading: isLoadingHistory,
        isFetching: isFetchingMoreHistory,
        refetch: refetchHistory,
        isRefetching: isRefetchingHistory
    } = useQuery({
        queryKey: ['webHistory', user?.client_code, selectedFlight, historyFetchSize],
        queryFn: () => reportService.getWebHistory(user!.client_code, selectedFlight!, 1, historyFetchSize),
        enabled: !!user?.client_code && !!selectedFlight,
        staleTime: 5 * 60 * 1000,
    });

    // Counts come from their own endpoint: neither list endpoint returns a
    // total, so counting the loaded page would under-report any client with
    // more flights than one page.
    const { data: flightCounts } = useQuery({
        queryKey: ['shipmentCounts'],
        queryFn: () => shipmentService.counts(),
        enabled: Boolean(user),
        staleTime: 60_000,
    });

    // The server decides which tab a shipment is in and returns only that
    // tab's rows: the rule reads four tables and a second copy of it here would
    // drift from the counters.
    const visibleFlights = shipments?.items ?? [];
    const tabTotal = shipments?.total ?? 0;

    // Shown once the list is long enough to be worth searching, or while a
    // search is running — otherwise the field would vanish under the user as
    // soon as it narrowed the list past the threshold.
    const showSearch =
        search.length > 0 || (flightCounts?.history ?? 0) > SEARCH_THRESHOLD;

    const hasMoreFlights = visibleFlights.length < tabTotal;
    const hasMoreHistory = history.length === historyFetchSize;
    const isLoadingMoreFlights = isFetchingMoreFlights && !isLoadingFlights;
    const isLoadingMoreHistory = isFetchingMoreHistory && !isLoadingHistory;

    // --- Handlers ---

    const handleRefresh = () => {
        if (view === 'detail' && selectedFlight) {
            setHistoryFetchSize(PAGE_SIZE);
            refetchHistory();
        } else {
            setFlightsFetchSize(PAGE_SIZE);
            refetchFlights();
        }
    };

    const handleLoadMoreFlights = () => setFlightsFetchSize(s => s + PAGE_SIZE);

    // A new tab or a new search starts at the first page; without this the
    // previously grown page size would fetch a long list the user did not ask
    // for.
    useEffect(() => { setFlightsFetchSize(PAGE_SIZE); }, [activeTab, search]);

    const openPaymentPicker = useCallback(() => {
        triggerSoftHaptic();
        setPaymentFlightName(null);
        setIsPaymentOpen(true);
    }, []);
    const handleLoadMoreHistory = () => setHistoryFetchSize(s => s + PAGE_SIZE);

    const isRefreshing = isRefetchingFlights || isRefetchingHistory;

    const handleTrackClick = async (code: string) => {
        setSelectedTrackCode(code);
        setIsTrackLoading(true);
        setTrackData(null);
        try {
            const data = await trackCargo(code);
            setTrackData(data);
        } catch (error) {
            console.error("Track error", error);
            toast.error(t('reports.trackCodeNotFound'));
            // Don't close immediately, let user see empty state or error
        } finally {
            setIsTrackLoading(false);
        }
    };

    const openPaymentModal = useCallback(() => {
        if (!selectedFlight) {
            toast.error(t('reports.noFlightSelected'));
            return;
        }
        setPaymentFlightName(selectedFlight);
        setIsPaymentOpen(true);
    }, [selectedFlight, t]);

    const handlePaymentClose = useCallback(() => {
        setIsPaymentOpen(false);
        setPaymentFlightName(null);
        // Refresh history after payment
        if (selectedFlight) refetchHistory();
    }, [selectedFlight, refetchHistory]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('nbuReturn') !== 'payment') return;

        const flightName = params.get('nbuFlight');
        if (flightName) {
            setSelectedFlight(flightName);
            setPaymentFlightName(flightName);
        }
        setIsPaymentOpen(true);
        clearNbuReturnParams();
    }, []);

    // --- Render Helpers ---

    if (isUserLoading) {
        return (
            <div className="container max-w-md mx-auto p-4 space-y-4 pt-24">
                <Skeleton className="h-10 w-1/2 rounded-mc-md" />
                <Skeleton className="h-32 w-full rounded-mc-xl" />
                <Skeleton className="h-32 w-full rounded-mc-xl" />
            </div>
        );
    }

    if (isUserError || !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60dvh] text-center pt-24">
                <AlertCircle className="w-10 h-10 text-mc-danger mb-3" strokeWidth={2} />
                <h3 className="text-lg font-bold">{t('reports.errorTitle')}</h3>
                <Button onClick={() => window.location.reload()} className="mt-4" variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" /> {t('reports.retry')}
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-mc-bg text-mc-text">
            {/* pt-24 used to clear the top NavigationBar, which client pages no
                longer render; App.tsx already pads for the bottom bar. */}
            {/* The list reserves the FAB's own height on top of what App.tsx
                already pads for the tab bar. Without it the button sits over
                the last row and that row cannot be read or tapped at all —
                a fixed element takes no space in the flow. */}
            <div className={`mx-auto max-w-lg ${view === 'list' ? 'pb-[4.5rem]' : ''}`}>
                {view === 'list' && (
                    <>
                        <HomeHeader
                            notificationSlot={
                                <Suspense
                                    fallback={<span className="block h-10 w-10" aria-hidden="true" />}
                                >
                                    <NotificationCenter />
                                </Suspense>
                            }
                        />

                        <div className="flex items-start justify-between gap-3 px-4 pt-3">
                            <div className="min-w-0">
                                <h1 className="text-[19px] font-extrabold leading-tight tracking-tight text-mc-text">
                                    {t('reports.title')}
                                </h1>
                                <p className="mt-0.5 text-[12px] font-medium text-mc-text-2">
                                    {t('reports.subtitle')}
                                </p>
                            </div>

                            {/* Beside the title, not in the tab row: three tabs
                                plus two 48px buttons want 400px and a 320px
                                screen leaves that row 288. */}
                            <div className="flex shrink-0 items-center gap-2">
                            <button
                                    type="button"
                                    onClick={() => {
                                        triggerSoftHaptic();
                                        setActiveTab((tab) =>
                                            tab === 'history' ? 'active' : 'history',
                                        );
                                    }}
                                    aria-pressed={activeTab === 'history'}
                                    className={`flex w-12 shrink-0 items-center justify-center rounded-mc-lg
                                               border transition-transform duration-150 active:scale-95 ${
                                                   activeTab === 'history'
                                                       ? 'border-mc-brand bg-mc-brand-soft text-mc-brand'
                                                       : 'border-mc-border bg-mc-surface text-mc-text-2'
                                               }`}
                                    aria-label={t('tracking.historyTitle', 'Yuklar tarixi')}
                                >
                                    {/* The three tabs cover current cargo; 79 older
                                        flights exist only in the full list. */}
                                    <History className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    disabled={isRefreshing}
                                    className="flex w-12 shrink-0 items-center justify-center rounded-mc-lg
                                               border border-mc-border bg-mc-surface text-mc-brand
                                               transition-transform duration-150 active:scale-95"
                                    aria-label={t('reports.retry')}
                                >
                                    {/* The design puts a filter control here. Until the
                                        filter sheet exists this button refreshes, so the
                                        icon says refresh — a funnel that reloads the list
                                        would be a lie about what tapping it does. */}
                                    <RefreshCw
                                        className={`h-[18px] w-[18px] ${isRefreshing ? 'animate-spin' : ''}`}
                                        strokeWidth={2}
                                        aria-hidden="true"
                                    />
                                </button>
                            </div>
                        </div>

                        <div className="mt-3 px-4">
                            <SegmentedTabs<ShipmentTab>
                                label={t('reports.title')}
                                value={activeTab}
                                onChange={setActiveTab}
                                tabs={[
                                    {
                                        id: 'active',
                                        label: t('reports.tabActive', 'Faol'),
                                        count: flightCounts?.active,
                                    },
                                    {
                                        id: 'transit',
                                        label: t('reports.tabTransit', "Yo'ldagi"),
                                        count: flightCounts?.transit,
                                    },
                                    {
                                        id: 'archive',
                                        label: t('reports.tabArchive', 'Arxiv'),
                                        count: flightCounts?.archive,
                                    },
                                ]}
                            />
                        </div>

                        {showSearch && (
                            <div className="mt-2 px-4">
                                <div className="relative">
                                    <Search
                                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4
                                                   -translate-y-1/2 text-mc-text-3"
                                        aria-hidden="true"
                                    />
                                    {/* 16px: anything smaller makes iOS Safari zoom
                                        the page on focus and never zoom back. */}
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder={t('shipments.searchPlaceholder', 'Reys raqami')}
                                        aria-label={t('shipments.searchLabel', 'Reys bo‘yicha qidirish')}
                                        className="h-11 w-full rounded-mc-lg border border-mc-border
                                                   bg-mc-surface pl-9 pr-10 text-[16px] font-semibold
                                                   text-mc-text outline-none placeholder:font-medium
                                                   placeholder:text-mc-text-3 focus:border-mc-brand"
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => setSearch('')}
                                            aria-label={t('shipments.searchClear', 'Tozalash')}
                                            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2
                                                       items-center justify-center text-mc-text-3 active:scale-95"
                                        >
                                            <X className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Header / Navigation */}
                <div className="mb-6 flex items-center justify-between">
                    {view === 'detail' ? (
                        <button
                            onClick={() => setSelectedFlight(null)}
                            className="flex items-center gap-2 text-mc-text-2 transition-transform active:scale-95"
                        >
                            <div className="p-2 rounded-full bg-mc-surface-2">
                                <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={2} />
                            </div>
                            <span className="text-[15px] font-extrabold">{t('reports.back')}</span>
                        </button>
                    ) : null}

                    {view === 'detail' && (
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="rounded-full p-3 text-mc-brand transition-transform active:scale-90"
                            aria-label={t('reports.retry', 'Yangilash')}
                        >
                            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    {view === 'list' ? (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="grid grid-cols-1 gap-4"
                        >
                            {isLoadingFlights ? (
                                <div className="space-y-2.5 px-4">
                                    {[1, 2, 3].map(i => (
                                        <Skeleton key={i} className="h-[124px] w-full rounded-mc-lg" />
                                    ))}
                                </div>
                            ) : visibleFlights.length > 0 ? (
                                <div className="space-y-2.5">
                                    {visibleFlights.map(shipment => (
                                        <ShipmentCard
                                            key={shipment.flight_name}
                                            shipment={shipment}
                                            onOpen={() => setSelectedFlight(shipment.flight_name)}
                                        />
                                    ))}
                                    {hasMoreFlights && (
                                        <div className="px-4">
                                            <button
                                                onClick={handleLoadMoreFlights}
                                                disabled={isLoadingMoreFlights}
                                                className="w-full rounded-mc-lg border border-mc-border py-3
                                                           text-[13px] font-bold text-mc-text-2
                                                           transition-colors disabled:opacity-50"
                                            >
                                                {isLoadingMoreFlights ? t('reports.loading') : t('reports.loadMore')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="px-4 py-16 text-center text-mc-text-3">
                                    <Search className="mx-auto mb-3 h-10 w-10 opacity-30" aria-hidden="true" />
                                    <p className="text-[13px] font-medium">{t('reports.noReports')}</p>
                                </div>
                            )}

                            <InfoNote title={t('reports.infoTitle')}>
                                <p>{t('reports.infoActive')}</p>
                                <p>{t('reports.infoArchive')}</p>
                            </InfoNote>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="detail"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 50 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-4"
                        >
                            <div className="px-4 pt-1">
                                <h1 className="text-[19px] font-extrabold leading-tight tracking-tight text-mc-text">
                                    {t('reports.detailsTitle', {
                                        flight: selectedFlight,
                                        defaultValue: '{{flight}} tafsilotlari',
                                    })}
                                </h1>
                                <p className="mt-0.5 text-[12px] font-medium text-mc-text-2">
                                    {t('reports.detailsSubtitle', 'Yukingiz haqida batafsil ma‘lumot')}
                                </p>
                            </div>

                            {isLoadingHistory ? (
                                <div className="space-y-2.5 px-4">
                                    {[1, 2, 3].map(i => (
                                        <Skeleton key={i} className="h-[120px] w-full rounded-mc-lg" />
                                    ))}
                                </div>
                            ) : history.length > 0 ? (
                                <div className="space-y-2.5">
                                    {history.map((item, idx) => (
                                        <div key={idx} className="space-y-2.5">
                                            <FlightReportCard report={item} />
                                            <TrackCodeList
                                                items={item.cargo_items ?? []}
                                                fallbackCodes={item.track_codes ?? []}
                                                onTrackClick={handleTrackClick}
                                            />
                                            <PaymentSummaryCard
                                                total={item.expected_amount || item.total_price_uzs || 0}
                                                paid={item.paid_amount}
                                                remaining={Math.max(
                                                    0,
                                                    (item.expected_amount || item.total_price_uzs || 0) -
                                                        (item.paid_amount ?? 0),
                                                )}
                                            />
                                            {/* Not in the design, but this gallery is how a client
                                                sees their cargo actually arrived — kept, moved below
                                                the money rather than deleted. */}
                                            {item.photo_file_ids?.length > 0 && (
                                                <div className="px-4">
                                                    <div className="rounded-mc-lg border border-mc-border bg-mc-surface p-3 shadow-[var(--mc-shadow-card)]">
                                                        <h2 className="mb-2 text-[14px] font-extrabold text-mc-text">
                                                            {t('reports.photos')}
                                                        </h2>
                                                        <div className="mc-no-scrollbar flex gap-2.5 overflow-x-auto">
                                                            {item.photo_file_ids.map((photoId, i) => (
                                                                <button
                                                                    key={i}
                                                                    type="button"
                                                                    onClick={() => setPreviewImage(photoId)}
                                                                    className="h-24 w-24 shrink-0 overflow-hidden rounded-mc-md
                                                                               border border-mc-border bg-mc-surface-2
                                                                               transition-transform duration-150 active:scale-[0.97]"
                                                                    aria-label={t('reports.photos')}
                                                                >
                                                                    <img
                                                                        src={photoId}
                                                                        alt=""
                                                                        loading="lazy"
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {hasMoreHistory && (
                                        <div className="px-4">
                                            <button
                                                onClick={handleLoadMoreHistory}
                                                disabled={isLoadingMoreHistory}
                                                className="w-full rounded-mc-lg border border-mc-border py-3
                                                           text-[13px] font-bold text-mc-text-2 disabled:opacity-50"
                                            >
                                                {isLoadingMoreHistory ? t('reports.loading') : t('reports.loadMore')}
                                            </button>
                                        </div>
                                    )}
                                    {/* Clears the sticky dock so the last card is never trapped
                                        underneath it. */}
                                    <div className="h-20" aria-hidden="true" />
                                </div>
                            ) : (
                                <div className="px-4 py-16 text-center text-[13px] font-medium text-mc-text-3">
                                    {t('reports.notFound')}
                                </div>
                            )}

                            {!isLoadingHistory && history.length > 0 && (
                                <FlightActionDock
                                    isTakenAway={history.every(r => r.is_taken_away)}
                                    remaining={history.reduce(
                                        (sum, r) =>
                                            sum +
                                            Math.max(
                                                0,
                                                (r.expected_amount || r.total_price_uzs || 0) -
                                                    (r.paid_amount ?? 0),
                                            ),
                                        0,
                                    )}
                                    onPay={openPaymentModal}
                                    onDeliveryRequest={onNavigateToDelivery}
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Payment Modal — lazy chunk loads only when first opened */}
            {/* Always on screen, on every tab.
                Deliberately below `NbuPaymentWatch` (z-10050), which occupies
                this same corner while a gateway session is open: covering the
                pay button for the seconds a payment is settling is better than
                offering a second one on top of it.
                The offset clears the bottom tab bar and the home indicator. */}
            {view === 'list' && (
                <button
                    type="button"
                    onClick={openPaymentPicker}
                    className="fixed right-4 z-30 flex h-11 items-center gap-1.5 rounded-full
                               bg-mc-brand px-4 text-mc-on-brand
                               shadow-[var(--mc-shadow-cta)] transition-transform
                               duration-150 active:scale-95
                               bottom-[calc(var(--mc-nav-h,0px)+env(safe-area-inset-bottom)+1rem)]"
                >
                    <CreditCard className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                    <span className="text-[13px] font-extrabold">
                        {t('dashboard.actions.payment.label', "To'lov qilish")}
                    </span>
                </button>
            )}

            {isPaymentOpen && (
                <Suspense fallback={null}>
                    <MakePaymentModal
                        isOpen={isPaymentOpen}
                        onClose={handlePaymentClose}
                        preselectedFlightName={paymentFlightName}
                    />
                </Suspense>
            )}

            {/* Custom Bottom Drawer for Track Details */}
            <BottomDrawer open={!!selectedTrackCode} onClose={() => setSelectedTrackCode(null)}>
                <div className="text-left mb-4">
                    <h3 className="flex items-center gap-2 text-[16px] font-extrabold text-mc-text">
                        <Search className="w-[18px] h-[18px] text-mc-brand" strokeWidth={2} />
                        {t('reports.searchResult')}
                    </h3>
                </div>

                {isTrackLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full rounded-mc-lg" />
                        <Skeleton className="h-48 w-full rounded-mc-lg" />
                    </div>
                ) : trackData ? (
                    <TrackResultCard data={trackData} />
                ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-mc-text-3">
                        <Search className="w-16 h-16 opacity-20 mb-4" />
                        <p>{t('reports.notFound')}</p>
                    </div>
                )}
            </BottomDrawer>

            {/* Image Preview Modal */}
            <ImagePreviewModal
                src={previewImage}
                onClose={() => setPreviewImage(null)}
                closeLabel={t('common.close', 'Yopish')}
            />
        </div>
    );
}
