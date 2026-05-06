import { useState, lazy, Suspense, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Wallet,
  Smartphone,
  MessageSquare,
} from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import TrackCodeTab from '@/pages/dashboard/TrackCodeTab';
import {
  getActiveCarouselItems,
  trackCarouselView,
  trackCarouselClick,
} from '@/api/services/carousel';
import CarouselMediaModal from '@/components/carousel/CarouselMediaModal';
import { toast } from 'sonner';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import { ActionButton } from '@/components/user_page/ActionButtons';
import { useTranslation } from 'react-i18next';

import { UniqueBackground } from './dashboard-components/UniqueBackground';
import { BetaBadge } from './dashboard-components/BetaBadge';
import { HeaderTabs } from './dashboard-components/HeaderTabs';
import { PageLoadingFallback } from './dashboard-components/PageLoadingFallback';
import { QuickSearchBar } from './dashboard-components/QuickSearchBar';
import { CarouselCard } from './dashboard-components/CarouselCard';
import { CAROUSEL_ITEMS, MAIN_ACTIONS } from './dashboard-components/constants';
import type { CarouselItemData } from './dashboard-components/types';

const ChinaAddressModal = lazy(() => import('@/components/modals/ChinaAddressModal'));
const MakePaymentModal = lazy(() => import('@/components/modals/MakePaymentModal'));
const FlightSchedulePage = lazy(() => import('@/components/pages/FlightSchedulePage'));
const DeliveryRequestPage = lazy(() => import('@/components/pages/DeliveryRequestPage'));
const DeliveryHistoryPage = lazy(() => import('@/components/pages/DeliveryHistoryPage'));
const CalculatorModal = lazy(() => import('@/components/modals/CalculatorModal'));
const ProhibitedItemsModal = lazy(() => import('@/components/modals/ProhibitedItemsModal'));

interface DashboardProps {
  onNavigateToReports?: () => void;
  onNavigateToHistory?: () => void;
}

export default function Dashboard({ onNavigateToReports, onNavigateToHistory }: DashboardProps) {
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const valid = ['home', 'track', 'schedule', 'request', 'delivery_history'];
    return valid.includes(tab ?? '') ? (tab as string) : 'home';
  });
  const [initialTrackView] = useState<'search' | 'history'>('search');
  const [isChinaModalOpen, setIsChinaModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isProhibitedModalOpen, setIsProhibitedModalOpen] = useState(false);
  const [trackAutoFocus, setTrackAutoFocus] = useState(false);
  const [mediaModalItem, setMediaModalItem] = useState<CarouselItemData | null>(null);

  const { t } = useTranslation();
  const { canInstall, handleInstall } = useInstallPrompt();

  const { data: apiCarouselItems } = useQuery({
    queryKey: ['carousel-items'],
    queryFn: getActiveCarouselItems,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

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
      setIsPaymentModalOpen(true);
    } else if (id === 'report') {
      onNavigateToReports?.();
    } else {
      toast.info(t('dashboard.toast.comingSoon', { id }));
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-[#0d0a04] text-gray-900 dark:text-white pb-24 transition-colors duration-300 font-sans selection:bg-orange-500/30"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <UniqueBackground />

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-12 sm:pt-16">
        <BetaBadge />

        <HeaderTabs activeTab={activeTab} setActiveTab={handleSetActiveTab} />

        {activeTab === 'home' && (
          <QuickSearchBar onClick={handleQuickSearch} />
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
                  <span className="w-1 h-5 bg-blue-500 rounded-full inline-block"></span>
                  {t('dashboard.sections.important')}
                </h2>
                <div className="flex items-center gap-2">
                  <NotificationCenter />
                  <div className="hidden md:flex items-center gap-2">
                    <button
                      onClick={() => scrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}
                      className="p-1.5 rounded-full bg-gray-200 dark:bg-white/10 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500 transition-colors active:scale-95"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => scrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
                      className="p-1.5 rounded-full bg-gray-200 dark:bg-white/10 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500 transition-colors active:scale-95"
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

            <section className="mb-4">
              <div className="flex items-center justify-between mb-3 ml-1 mr-1">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span className="w-1 h-5 bg-emerald-500 rounded-full inline-block"></span>
                  {t('dashboard.sections.reportsAndPayments')}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* To'lov tugmasi (Mobile-Optimized Premium) */}
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="relative overflow-hidden rounded-[1.75rem] p-4 sm:p-5 flex flex-col items-center text-center border border-white/60 border-b-white/20 dark:border-white/10 dark:border-t-white/20 bg-gradient-to-b from-white/90 to-white/50 dark:from-[#2a2218]/80 dark:to-[#1a150e]/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] active:scale-[0.95] active:shadow-inner transition-all duration-200 select-none"
                >
                  <div className="absolute -top-8 -right-8 w-28 h-28 bg-rose-400/40 dark:bg-rose-500/20 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '3s' }} />
                  <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-pink-400/30 dark:bg-pink-600/20 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '4s' }} />
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/50 to-white/0 dark:via-white/5 opacity-40 pointer-events-none" />

                  <div className="relative z-10 flex flex-col items-center gap-2.5">
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center bg-white dark:bg-white/10 text-rose-500 dark:text-rose-400 shadow-md ring-1 ring-rose-100 dark:ring-white/10">
                      <Wallet className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow-sm" />
                      <div className="absolute inset-0 rounded-2xl ring-2 ring-rose-500/30 animate-pulse" style={{ animationDuration: '2.5s' }} />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-[14px] sm:text-[16px] font-extrabold text-gray-900 dark:text-white tracking-tight drop-shadow-sm">{t('dashboard.actions.payment.label')}</h3>
                      <p className="text-[10px] sm:text-[11px] font-medium text-gray-500 dark:text-gray-400/80 leading-snug line-clamp-2 px-1">{t('dashboard.actions.payment.desc')}</p>
                    </div>
                  </div>
                </button>

                {/* Zayavka tugmasi (Mobile-Optimized Premium) */}
                <button
                  onClick={() => handleSetActiveTab('request')}
                  className="relative overflow-hidden rounded-[1.75rem] p-4 sm:p-5 flex flex-col items-center text-center border border-white/60 border-b-white/20 dark:border-white/10 dark:border-t-white/20 bg-gradient-to-b from-white/90 to-white/50 dark:from-[#2a2218]/80 dark:to-[#1a150e]/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] active:scale-[0.95] active:shadow-inner transition-all duration-200 select-none"
                >
                  <div className="absolute -top-8 -left-8 w-28 h-28 bg-emerald-400/40 dark:bg-emerald-500/20 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '3.5s' }} />
                  <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-teal-400/30 dark:bg-teal-600/20 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '4.5s' }} />
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/50 to-white/0 dark:via-white/5 opacity-40 pointer-events-none" />

                  <div className="relative z-10 flex flex-col items-center gap-2.5">
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center bg-white dark:bg-white/10 text-emerald-500 dark:text-emerald-400 shadow-md ring-1 ring-emerald-100 dark:ring-white/10">
                      <Edit3 className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow-sm" />
                      <div className="absolute inset-0 rounded-2xl ring-2 ring-emerald-500/30 animate-pulse" style={{ animationDuration: '2s' }} />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-[14px] sm:text-[16px] font-extrabold text-gray-900 dark:text-white tracking-tight drop-shadow-sm">{t('dashboard.actions.request.label')}</h3>
                      <p className="text-[10px] sm:text-[11px] font-medium text-gray-500 dark:text-gray-400/80 leading-snug line-clamp-2 px-1">{t('dashboard.actions.request.desc')}</p>
                    </div>
                  </div>
                </button>
              </div>
            </section>

            <section className="mb-6">
              <div className="flex items-center justify-between mb-4 ml-1 mr-1">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span className="w-1 h-5 bg-amber-500 rounded-full inline-block"></span>
                  {t('dashboard.sections.services')}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MAIN_ACTIONS.map((action) => (
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
            onClose={() => setIsPaymentModalOpen(false)}
          />
          <CalculatorModal
            isOpen={isCalculatorOpen}
            onClose={() => setIsCalculatorOpen(false)}
          />
          <ProhibitedItemsModal
            isOpen={isProhibitedModalOpen}
            onClose={() => setIsProhibitedModalOpen(false)}
          />
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
