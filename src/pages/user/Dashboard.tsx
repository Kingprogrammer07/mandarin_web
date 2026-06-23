import { useState, lazy, Suspense, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  MessageSquare,
  Gift,
} from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useGuideTour } from '@/hooks/useGuideTour';
import type { DriveStep } from 'driver.js';
import TrackCodeTab from '@/pages/dashboard/TrackCodeTab';
import {
  getActiveCarouselItems,
  trackCarouselView,
  trackCarouselClick,
} from '@/api/services/carousel';
import CarouselMediaModal from '@/components/carousel/CarouselMediaModal';
import { toast } from 'sonner';
import { ActionButton } from '@/components/user_page/ActionButtons';
import { useTranslation } from 'react-i18next';

import { UniqueBackground } from './dashboard-components/UniqueBackground';
// import { BetaBadge } from './dashboard-components/BetaBadge';
import { HeaderTabs } from './dashboard-components/HeaderTabs';
import { PageLoadingFallback } from './dashboard-components/PageLoadingFallback';
import { QuickSearchBar } from './dashboard-components/QuickSearchBar';
import { CarouselCard } from './dashboard-components/CarouselCard';
import { CAROUSEL_ITEMS, PRIMARY_ACTIONS, SECONDARY_ACTIONS } from './dashboard-components/constants';
import type { CarouselItemData } from './dashboard-components/types';
import { clearNbuReturnParams } from '@/utils/nbuReturnContext';
import { getPendingDeliveryReview, getPaidFlights } from '@/api/services/deliveryService';
import { paymentService } from '@/api/services/paymentService';
import { notificationService } from '@/api/services/notificationService';
import { useDeliveryStore } from '@/store/useDeliveryStore';

const loadNotificationCenter = () => import('@/components/notifications/NotificationCenter');

const ChinaAddressModal = lazy(() => import('@/components/modals/ChinaAddressModal'));
const MakePaymentModal = lazy(() => import('@/components/modals/MakePaymentModal'));
const FlightSchedulePage = lazy(() => import('@/components/pages/FlightSchedulePage'));
const DeliveryRequestPage = lazy(() => import('@/components/pages/DeliveryRequestPage'));
const DeliveryHistoryPage = lazy(() => import('@/components/pages/DeliveryHistoryPage'));
const CalculatorModal = lazy(() => import('@/components/modals/CalculatorModal'));
const DeliveryReviewModal = lazy(() => import('@/components/delivery/DeliveryReviewModal'));
const ProhibitedItemsModal = lazy(() => import('@/components/modals/ProhibitedItemsModal'));
const OurAddressModal = lazy(() => import('@/components/modals/OurAddressModal'));
const NotificationCenter = lazy(loadNotificationCenter);

/**
 * Dev-only: read a forced delivery id from `?reviewTest=<id>` so the review
 * modal can be opened on demand while testing locally. Returns null in
 * production or when the param is absent/invalid.
 */
function readForcedReviewId(): number | null {
  if (!import.meta.env.DEV) return null;
  const forced = new URLSearchParams(window.location.search).get('reviewTest');
  if (forced && !Number.isNaN(Number(forced))) return Number(forced);
  return null;
}

// Per-user "shown once" guard for the service-review prompt. Persisted in
// localStorage (not sessionStorage) so a given review is asked exactly once and
// never nags again — whether the user submitted it or dismissed it.
const REVIEW_SEEN_PREFIX = 'review_seen:';
function isReviewSeen(id: number): boolean {
  try {
    return localStorage.getItem(`${REVIEW_SEEN_PREFIX}${id}`) === '1';
  } catch {
    return false;
  }
}
function markReviewSeen(id: number): void {
  try {
    localStorage.setItem(`${REVIEW_SEEN_PREFIX}${id}`, '1');
  } catch {
    // Storage unavailable (private mode) — worst case it asks again next time.
  }
}

interface DashboardProps {
  onNavigateToReports?: () => void;
  onNavigateToHistory?: () => void;
  onNavigateToReferral?: () => void;
}

export default function Dashboard({ onNavigateToReports, onNavigateToHistory, onNavigateToReferral }: DashboardProps) {
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const valid = ['home', 'track', 'schedule', 'request', 'delivery_history'];
    return valid.includes(tab ?? '') ? (tab as string) : 'home';
  });
  const [initialTrackView] = useState<'search' | 'history'>('search');

  // Service-review prompt: on load, ask the backend whether the user has an
  // approved delivery that still triggers a (one-time) bot-service review. Shown
  // at most once per user per delivery — `isReviewSeen` guards it permanently.
  // Dev-only force trigger: open the modal on demand for local testing, e.g.
  // `?reviewTest=123`. Resolved once in the initializer (not an effect) so it
  // never causes a setState-in-effect cascade; in that mode submit is mocked.
  const [reviewDrId, setReviewDrId] = useState<number | null>(readForcedReviewId);
  const reviewIsMock = readForcedReviewId() !== null;
  useEffect(() => {
    // Dev force already armed the modal — skip the real pending-review fetch.
    if (readForcedReviewId() !== null) return;
    let active = true;
    getPendingDeliveryReview()
      .then((res) => {
        if (!active || !res.delivery_request_id) return;
        if (isReviewSeen(res.delivery_request_id)) return; // shown once already
        setReviewDrId(res.delivery_request_id);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const [isChinaModalOpen, setIsChinaModalOpen] = useState(false);
  // Returning from an NBU payment? Open the modal straight from initial state
  // (lazy init) instead of a setState-in-effect, which avoids a cascading render.
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(
    () => new URLSearchParams(window.location.search).get('nbuReturn') === 'payment',
  );
  const [paymentFlightName, setPaymentFlightName] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('nbuReturn') === 'payment' ? params.get('nbuFlight') : null;
  });
  const [isOurAddressModalOpen, setIsOurAddressModalOpen] = useState(false);

  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isProhibitedModalOpen, setIsProhibitedModalOpen] = useState(false);
  const [trackAutoFocus, setTrackAutoFocus] = useState(false);
  const [mediaModalItem, setMediaModalItem] = useState<CarouselItemData | null>(null);

  const { t } = useTranslation();
  const { canInstall, handleInstall } = useInstallPrompt();

  // One-time onboarding tour for the home dashboard.
  const buildDashboardTour = useCallback((): DriveStep[] => [
    {
      element: '[data-tour="dash-search"]',
      popover: {
        title: t('tour.dashboard.search.title'),
        description: t('tour.dashboard.search.desc'),
      },
    },
    {
      element: '[data-tour="dash-actions"]',
      popover: {
        title: t('tour.dashboard.actions.title'),
        description: t('tour.dashboard.actions.desc'),
      },
    },
    {
      element: '[data-tour="dash-notif"]',
      popover: {
        title: t('tour.dashboard.notif.title'),
        description: t('tour.dashboard.notif.desc'),
      },
    },
  ], [t]);
  useGuideTour('dashboard', buildDashboardTour, activeTab === 'home');

  const { data: apiCarouselItems } = useQuery({
    queryKey: ['carousel-items'],
    queryFn: getActiveCarouselItems,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const prefetch = () => {
      // Preload the NotificationCenter chunk…
      void loadNotificationCenter();

      // …and warm the data users tap into next, so payment / delivery /
      // notifications open instantly. Runs on idle, and is gated by the server
      // (5-min Redis) + client staleTime, so it costs at most ~one fetch per
      // cache window per user. Failures are swallowed (best-effort warm-up).
      void queryClient.prefetchQuery({
        queryKey: ['payment-available-flights'],
        queryFn: paymentService.getAvailableFlights,
        staleTime: 5 * 60_000,
      });
      void queryClient.prefetchQuery({
        queryKey: ['notifications', 'list'],
        queryFn: () => notificationService.getNotifications(1, 20),
        staleTime: 60_000,
      });
      void queryClient.prefetchQuery({
        queryKey: ['notifications', 'unread'],
        queryFn: notificationService.getUnreadCount,
        staleTime: 60_000,
      });

      // Delivery flights live in a Zustand store (not TanStack). Warm it only
      // when its 5-min cache is empty so opening the delivery page is instant.
      if (!useDeliveryStore.getState().getCachedFlights()) {
        void getPaidFlights()
          .then((res) => useDeliveryStore.getState().setPaidFlights(res.flights))
          .catch(() => {});
      }
    };

    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(prefetch);
      return () => idleWindow.cancelIdleCallback?.(id);
    }

    const id = window.setTimeout(prefetch, 1_500);
    return () => window.clearTimeout(id);
  }, [queryClient]);

  useEffect(() => {
    const handleOpenPayment = () => {
      setPaymentFlightName(null);
      setIsPaymentModalOpen(true);
    };

    window.addEventListener('dashboard:open-payment', handleOpenPayment);
    return () => window.removeEventListener('dashboard:open-payment', handleOpenPayment);
  }, []);

  useEffect(() => {
    // State was already seeded from the URL (lazy init above); just clean the
    // params so a refresh / back-nav doesn't re-trigger the payment modal.
    const params = new URLSearchParams(window.location.search);
    if (params.get('nbuReturn') === 'payment') {
      clearNbuReturnParams();
    }
  }, []);

  const sortedCarouselItems = useMemo((): CarouselItemData[] => {
    const fromApi: CarouselItemData[] = apiCarouselItems
      ? [...apiCarouselItems]
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          id: item.id,
          type: item.type as 'ad' | 'feature',
          title: item.title ?? undefined,
          sub: item.sub_title ?? undefined,
          gradientStyle: item.gradient ?? 'linear-gradient(135deg, #1a1a2e, #16213e)',
          mediaType: item.media_type,
          mediaUrl: item.media_url,
          actionUrl: item.action_url ?? undefined,
          textColor: item.text_color,
          fromApi: true,
          mediaItems: item.media_items ?? [],
        }))
      : [];

    const staticFeatures = CAROUSEL_ITEMS
      .filter(i => i.type === 'feature')
      .sort((a, b) => a.id - b.id);

    return [...fromApi, ...staticFeatures];
  }, [apiCarouselItems]);

  const secondaryActions = useMemo(
    () => SECONDARY_ACTIONS.filter((action) => action.id !== 'report' || onNavigateToReports),
    [onNavigateToReports],
  );

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartedInSwipeLockedArea = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (activeTab !== 'home' || isPaused) return;

    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, clientWidth, scrollWidth } = scrollRef.current;
        const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 50;

        if (isAtEnd) {
          scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollRef.current.scrollBy({ left: clientWidth * 0.6, behavior: 'smooth' });
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeTab, isPaused]);

  const handleSetActiveTab = useCallback((tab: string) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === 'home') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', tab);
    }
    window.history.replaceState(null, '', url.toString());
  }, []);

  const handleQuickSearch = () => {
    setTrackAutoFocus(true);
    handleSetActiveTab('track');
  };

  const handleCarouselItemClick = useCallback((item: CarouselItemData) => {
    if (item.fromApi) {
      const hasGallery = (item.mediaItems?.length ?? 0) > 1;
      if (hasGallery) {
        setMediaModalItem(item);
      } else if (item.actionUrl) {
        trackCarouselClick(item.id);
        window.open(item.actionUrl, '_blank');
      }
    }
    else if (item.id === 1) setIsProhibitedModalOpen(true);
    else if (item.id === 3) handleSetActiveTab('request');
  }, [handleSetActiveTab]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (activeTab !== 'home' && activeTab !== 'track') return;

    const targetElement = e.target instanceof Element ? e.target : null;
    touchStartedInSwipeLockedArea.current = !!targetElement?.closest('[data-dashboard-swipe-lock="true"]');
    if (touchStartedInSwipeLockedArea.current) return;

    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    setIsPaused(true);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (activeTab !== 'home' && activeTab !== 'track') return;

    if (touchStartedInSwipeLockedArea.current) {
      touchStartedInSwipeLockedArea.current = false;
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }

    if (!touchStartX.current || !touchStartY.current) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const distanceX = touchStartX.current - touchEndX;
    const distanceY = touchStartY.current - touchEndY;
    const minSwipeDistance = 50;

    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (distanceX > minSwipeDistance) handleSetActiveTab('track');
      if (distanceX < -minSwipeDistance) handleSetActiveTab('home');
    }

    touchStartX.current = null;
    touchStartY.current = null;
    setTimeout(() => setIsPaused(false), 3000);
  };

  const handleActionClick = (id: string) => {
    if (id === 'calculator') {
      setIsCalculatorOpen(true);
    } else if (id === 'history') {
      onNavigateToHistory?.();
    } else if (id === 'china') {
      setIsChinaModalOpen(true);
    } else if (id === 'schedule') {
      handleSetActiveTab('schedule');
    } else if (id === 'request') {
      handleSetActiveTab('request');
    } else if (id === 'delivery_history') {
      handleSetActiveTab('delivery_history');
    } else if (id === 'payment') {
      setPaymentFlightName(null);
      setIsPaymentModalOpen(true);
    } else if (id === 'our_address') {
      setIsOurAddressModalOpen(true);
    } else if (id === 'report') {
      if (onNavigateToReports) {
        onNavigateToReports();
      } else {
        toast.info(t('dashboard.toast.comingSoon', { id }));
      }
    } else {
      toast.info(t('dashboard.toast.comingSoon', { id }));
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-[#06080d] text-gray-900 dark:text-white transition-colors duration-300 font-sans selection:bg-orange-500/30 pb-24"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <UniqueBackground />

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-[5.75rem] sm:pt-[6rem]">
        {/* <BetaBadge /> */}

        <HeaderTabs activeTab={activeTab} setActiveTab={handleSetActiveTab} />

        {activeTab === 'home' && (
          <div data-tour="dash-search">
            <QuickSearchBar onClick={handleQuickSearch} />
          </div>
        )}

        {activeTab === 'schedule' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <FlightSchedulePage
              onBack={() => handleSetActiveTab('home')}
              onNavigateToTrack={() => handleSetActiveTab('track')}
            />
          </Suspense>
        )}

        {activeTab === 'request' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <DeliveryRequestPage
              onBack={() => handleSetActiveTab('home')}
              onNavigateToHistory={() => handleSetActiveTab('delivery_history')}
            />
          </Suspense>
        )}

        {activeTab === 'delivery_history' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <DeliveryHistoryPage onBack={() => handleSetActiveTab('home')} />
          </Suspense>
        )}

        {activeTab === 'home' ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <section>
              <div className="flex items-center mb-4 ml-1">
                <h2 className="flex-1 text-lg font-bold flex items-center gap-2">
                  <span className="inline-block h-5 w-1 rounded-full bg-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.35)]"></span>
                  {t('dashboard.sections.important')}
                </h2>
                <div className="flex items-center gap-2" data-tour="dash-notif">
                  <Suspense fallback={<div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-white/5" />}>
                    <NotificationCenter />
                  </Suspense>
                  <div className="hidden md:flex items-center gap-2">
                    <button
                      onClick={() => scrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}
                      className="rounded-full border border-gray-200/80 bg-white/90 p-1.5 text-gray-500 transition-colors active:scale-95 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 dark:border-white/[0.085] dark:bg-white/[0.055] dark:text-white/48 dark:hover:border-orange-300/20 dark:hover:bg-orange-400/[0.09] dark:hover:text-amber-300"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => scrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
                      className="rounded-full border border-gray-200/80 bg-white/90 p-1.5 text-gray-500 transition-colors active:scale-95 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 dark:border-white/[0.085] dark:bg-white/[0.055] dark:text-white/48 dark:hover:border-orange-300/20 dark:hover:bg-orange-400/[0.09] dark:hover:text-amber-300"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide lg:mx-0 lg:px-0 lg:pb-4"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                onTouchStart={(e) => { e.stopPropagation(); setIsPaused(true); }}
                onTouchEnd={(e) => { e.stopPropagation(); setTimeout(() => setIsPaused(false), 3000); }}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                {sortedCarouselItems.map((item) => (
                  <div
                    key={item.id}
                    className="group contents cursor-pointer"
                    onClick={() => handleCarouselItemClick(item)}
                  >
                    <CarouselCard
                      item={item}
                      onView={item.fromApi
                        ? () => { trackCarouselView(item.id); }
                        : undefined
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-5" data-tour="dash-actions">
              <div className="flex items-center justify-between mb-3 ml-1 mr-1">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span className="w-1 h-5 bg-amber-500 rounded-full inline-block shadow-[0_0_16px_rgba(245,158,11,0.35)]"></span>
                  {t('dashboard.sections.primaryActions')}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {PRIMARY_ACTIONS.map((action) => (
                  <ActionButton
                    key={action.id}
                    item={{
                      ...action,
                      label: t(action.labelKey),
                      desc: t(action.descKey),
                      badge: t(action.badgeKey),
                      actionLabel: t(action.actionLabelKey),
                    }}
                    onClick={() => handleActionClick(action.id)}
                  />
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4 ml-1 mr-1">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span className="w-1 h-5 bg-amber-500 rounded-full inline-block"></span>
                  {t('dashboard.sections.otherServices')}
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-4">
                {secondaryActions.map((action) => (
                  <ActionButton
                    key={action.id}
                    variant="secondary"
                    item={{
                      ...action,
                      label: t(action.labelKey),
                      desc: t(action.descKey),
                      badge: t(action.badgeKey),
                      actionLabel: t(action.actionLabelKey),
                    }}
                    onClick={() => handleActionClick(action.id)}
                  />
                ))}
              </div>
            </section>

            <section className="pb-8 px-1">
              {canInstall && (
                <button
                  onClick={handleInstall}
                  className="
                    w-full relative overflow-hidden rounded-2xl p-4 flex items-center justify-between mb-3
                    bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/5
                    border border-amber-200 dark:border-amber-500/20
                    active:scale-[0.98] transition-all duration-200 group shadow-sm hover:shadow-md
                  "
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform text-amber-600 dark:text-amber-400">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                        {t('dashboard.installApp.title', "Ekranga qo'shish")}
                      </h3>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                        {t('dashboard.installApp.desc', "Tez kirish uchun bosh ekranga qo'shing")}
                      </p>
                    </div>
                  </div>
                  <Plus className="w-5 h-5 text-amber-500 dark:text-amber-400 group-hover:rotate-90 transition-transform duration-200 shrink-0" />
                </button>
              )}

              {onNavigateToReferral && (
                <button
                  data-tour="dash-referral"
                  className="
                    w-full relative overflow-hidden rounded-2xl p-4 flex items-center justify-between mb-3
                    bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/5
                    border border-amber-200 dark:border-amber-500/20
                    active:scale-[0.98] transition-all duration-200 group shadow-sm hover:shadow-md
                  "
                  onClick={onNavigateToReferral}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform text-amber-600 dark:text-amber-400">
                      <Gift className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                        {t('referral.dashboardTitle')}
                      </h3>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                        {t('referral.dashboardDesc')}
                      </p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-amber-500 dark:text-amber-400 group-hover:translate-x-1 transition-transform shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 18 6-6-6-6" /></svg>
                </button>
              )}

              <button
                className="
                  w-full relative overflow-hidden rounded-2xl p-4 flex items-center justify-between
                  bg-gradient-to-r from-gray-50 to-gray-100 dark:from-white/5 dark:to-white/10
                  border border-gray-200 dark:border-white/10
                  active:scale-[0.98] transition-all duration-200 group shadow-sm hover:shadow-md
                "
                onClick={() => window.open('https://t.me/mandarin_admin', '_blank')}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-white/10 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform text-blue-500 dark:text-blue-400">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t('dashboard.sections.feedback')}</h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                      {t('dashboard.sections.contactUs')}
                    </p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 18 6-6-6-6" /></svg>
              </button>

              <div className="text-center mt-6">
                <p className="text-[10px] text-gray-300 dark:text-white/10 font-mono">
                  v2.0
                </p>
              </div>
            </section>

          </div>
        ) : activeTab === 'track' ? (
          <TrackCodeTab
            key={initialTrackView}
            initialView={initialTrackView}
            autoFocus={trackAutoFocus}
            onFocusConsumed={() => setTrackAutoFocus(false)}
          />
        ) : null}

        <Suspense fallback={null}>
          <ChinaAddressModal
            isOpen={isChinaModalOpen}
            onClose={() => setIsChinaModalOpen(false)}
          />
          <MakePaymentModal
            isOpen={isPaymentModalOpen}
            onClose={() => {
              setIsPaymentModalOpen(false);
              setPaymentFlightName(null);
            }}
            preselectedFlightName={paymentFlightName}
          />
          <CalculatorModal
            isOpen={isCalculatorOpen}
            onClose={() => setIsCalculatorOpen(false)}
          />
          <ProhibitedItemsModal
            isOpen={isProhibitedModalOpen}
            onClose={() => setIsProhibitedModalOpen(false)}
          />
          <OurAddressModal
            isOpen={isOurAddressModalOpen}
            onClose={() => setIsOurAddressModalOpen(false)}
          />
          {reviewDrId !== null && (
            <DeliveryReviewModal
              open
              deliveryRequestId={reviewDrId}
              mock={reviewIsMock}
              onDismiss={() => {
                // Mark seen so it never asks again (skip while dev-testing).
                if (!reviewIsMock) markReviewSeen(reviewDrId);
                setReviewDrId(null);
              }}
              onSubmitted={() => {
                if (!reviewIsMock) markReviewSeen(reviewDrId);
                setReviewDrId(null);
              }}
            />
          )}
        </Suspense>

        <CarouselMediaModal
          isOpen={mediaModalItem !== null}
          onClose={() => setMediaModalItem(null)}
          itemId={mediaModalItem?.id ?? 0}
          title={mediaModalItem?.title}
          subTitle={mediaModalItem?.sub}
          actionUrl={mediaModalItem?.actionUrl}
          mediaItems={mediaModalItem?.mediaItems ?? []}
        />

      </div>
    </div>
  );
}
