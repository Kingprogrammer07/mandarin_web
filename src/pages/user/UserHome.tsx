import { lazy, Suspense, useCallback, useState } from 'react';
import { useBackHandler } from '@/hooks/useBackHandler';
import { BackPriority } from '@/lib/backStack';
import { HomeScreen } from './HomeScreen';
import type { CarouselItemData } from './dashboard-components/types';

const ChinaAddressModal = lazy(() => import('@/components/modals/ChinaAddressModal'));
const MakePaymentModal = lazy(() => import('@/components/modals/MakePaymentModal'));
const CalculatorModal = lazy(() => import('@/components/modals/CalculatorModal'));
const OurAddressModal = lazy(() => import('@/components/modals/OurAddressModal'));
const ProhibitedItemsModal = lazy(
  () => import('@/components/modals/ProhibitedItemsModal'),
);
const FlightSchedulePage = lazy(() => import('@/components/pages/FlightSchedulePage'));
const DeliveryRequestPage = lazy(() => import('@/components/pages/DeliveryRequestPage'));
const DeliveryHistoryPage = lazy(() => import('@/components/pages/DeliveryHistoryPage'));
const TrackCodeView = lazy(() =>
  import('@/components/user/TrackCodeView').then((m) => ({ default: m.TrackCodeView })),
);
const CarouselMediaModal = lazy(() => import('@/components/carousel/CarouselMediaModal'));
const NotificationCenter = lazy(
  () => import('@/components/notifications/NotificationCenter'),
);

/**
 * Destinations of the two built-in carousel cards, keyed by their id in
 * `dashboard-components/constants`. Those ids are the card's identity — the
 * cards carry no action_url, so there is nothing else to route on.
 */
const STATIC_CARD_PROHIBITED = 1;
const STATIC_CARD_DELIVERY = 3;

/** Full-screen views that replace the home screen rather than sitting over it. */
type FullView =
  | 'schedule'
  | 'request'
  | 'track'
  | 'cargo-history'
  | 'delivery-history'
  | null;

interface UserHomeProps {
  onNavigateToReports?: () => void;
  onNavigateToHistory?: () => void;
  /** Accepted for call-site compatibility; the redesigned home has no
   *  referral entry point yet. */
  onNavigateToReferral?: () => void;
  /** Bottom-bar navigation, supplied by the app shell. */
  onNavigate?: (page: string) => void;
}

/**
 * Container for the client home.
 *
 * `HomeScreen` stays presentational; every modal and full-screen view is owned
 * here. The old `Dashboard.tsx` mixed the two, which is a large part of why it
 * reached 732 lines and could not be reasoned about a section at a time.
 */
export default function UserHome({
  onNavigateToReports,
  onNavigateToHistory,
  onNavigate,
}: UserHomeProps) {
  const [isChinaOpen, setIsChinaOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isAddressOpen, setIsAddressOpen] = useState(false);
  const [isProhibitedOpen, setIsProhibitedOpen] = useState(false);
  const [fullView, setFullView] = useState<FullView>(null);
  const [mediaItem, setMediaItem] = useState<CarouselItemData | null>(null);
  const [trackCode, setTrackCode] = useState('');

  /**
   * Back-button wiring.
   *
   * None of these layers is in `window.history` — `fullView` replaces the whole
   * screen from local state and the modals are plain booleans — so without this
   * the system back button would skip straight past them to the router, or, at
   * the root, close the Mini App.
   *
   * Priorities, not registration order, decide who wins: an overlay opened on
   * top of a full view must be dismissed first even though the view registered
   * later.
   */
  useBackHandler(fullView !== null, () => {
    setFullView(null);
    return true;
  }, BackPriority.VIEW);

  useBackHandler(mediaItem !== null, () => {
    setMediaItem(null);
    return true;
  }, BackPriority.OVERLAY);

  useBackHandler(isChinaOpen, () => {
    setIsChinaOpen(false);
    return true;
  });
  useBackHandler(isPaymentOpen, () => {
    setIsPaymentOpen(false);
    return true;
  });
  useBackHandler(isCalculatorOpen, () => {
    setIsCalculatorOpen(false);
    return true;
  });
  useBackHandler(isAddressOpen, () => {
    setIsAddressOpen(false);
    return true;
  });
  useBackHandler(isProhibitedOpen, () => {
    setIsProhibitedOpen(false);
    return true;
  });

  const navigate = useCallback(
    (page: string) => {
      if (page === 'user-reports') return onNavigateToReports?.();
      if (page === 'user-history') return onNavigateToHistory?.();
      onNavigate?.(page);
    },
    [onNavigate, onNavigateToHistory, onNavigateToReports],
  );

  const handleCarouselItem = useCallback((item: CarouselItemData) => {
    if (!item.fromApi) {
      // Built-in cards: fixed destinations, no tracking (nothing to attribute).
      if (item.id === STATIC_CARD_PROHIBITED) setIsProhibitedOpen(true);
      else if (item.id === STATIC_CARD_DELIVERY) setFullView('request');
      return;
    }
    // A gallery opens in place; a single-media item with a link leaves the app.
    if ((item.mediaItems?.length ?? 0) > 1) {
      setMediaItem(item);
    } else if (item.actionUrl) {
      window.open(item.actionUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const handleTrackSearch = useCallback((code: string) => {
    setTrackCode(code);
    setFullView('track');
  }, []);

  if (fullView === 'schedule') {
    return (
      <Suspense fallback={null}>
        <FlightSchedulePage
          onBack={() => setFullView(null)}
          onNavigateToTrack={() => {
            setTrackCode('');
            setFullView('track');
          }}
        />
      </Suspense>
    );
  }

  if (fullView === 'request') {
    return (
      <Suspense fallback={null}>
        <DeliveryRequestPage
          onBack={() => setFullView(null)}
          // Without this the "no eligible flights" state has no way forward:
          // a delivery request needs a paid flight, and the CTA that sends the
          // client to pay only renders when this handler exists.
          onGoToPayment={() => {
            setFullView(null);
            setIsPaymentOpen(true);
          }}
          // App.tsx routed this to `user-history`, which is the PAYMENT history
          // — a different screen that never lists a delivery request.
          onNavigateToHistory={() => setFullView('delivery-history')}
        />
      </Suspense>
    );
  }

  if (fullView === 'delivery-history') {
    return (
      <Suspense fallback={null}>
        <DeliveryHistoryPage onBack={() => setFullView(null)} />
      </Suspense>
    );
  }

  if (fullView === 'track') {
    return (
      <Suspense fallback={null}>
        <TrackCodeView
          initialCode={trackCode}
          onBack={() => setFullView(null)}
        />
      </Suspense>
    );
  }

  return (
    <>
      <HomeScreen
        onNavigate={navigate}
        onOpenPayment={() => setIsPaymentOpen(true)}
        onOpenDeliveryRequest={() => setFullView('request')}
        onOpenChinaAddress={() => setIsChinaOpen(true)}
        onOpenCalculator={() => setIsCalculatorOpen(true)}
        onOpenFlightSchedule={() => setFullView('schedule')}
        onOpenOffice={() => setIsAddressOpen(true)}
        // The history is no longer a screen of its own: it is the full list
        // inside "Mening yuklarim", where each flight carries its billing and
        // its stage instead of appearing twice under two names.
        onOpenCargoHistory={() => onNavigate?.('user-reports')}
        onOpenDeliveryHistory={() => setFullView('delivery-history')}
        notificationSlot={
          // Mounted in the header, not in the page flow. NotificationCenter has
          // no props: it renders its own bell and owns its own open state, so
          // wherever it sits in the tree is where that bell appears — which is
          // how a second bell ended up below the services block. The fallback
          // reserves the exact 40px box so the header does not shift when the
          // chunk lands.
          <Suspense fallback={<span className="block h-10 w-10" aria-hidden="true" />}>
            <NotificationCenter />
          </Suspense>
        }
        onOpenCarouselItem={handleCarouselItem}
        onTrackSearch={handleTrackSearch}
        onOpenTracking={() => {
          setTrackCode('');
          setFullView('track');
        }}
        onOpenReports={onNavigateToReports}
      />

      <Suspense fallback={null}>
        {isChinaOpen && (
          <ChinaAddressModal isOpen onClose={() => setIsChinaOpen(false)} />
        )}
        {isPaymentOpen && (
          <MakePaymentModal isOpen onClose={() => setIsPaymentOpen(false)} />
        )}
        {isCalculatorOpen && (
          <CalculatorModal isOpen onClose={() => setIsCalculatorOpen(false)} />
        )}
        {isAddressOpen && (
          <OurAddressModal isOpen onClose={() => setIsAddressOpen(false)} />
        )}
        {isProhibitedOpen && (
          <ProhibitedItemsModal isOpen onClose={() => setIsProhibitedOpen(false)} />
        )}
        {mediaItem && (
          <CarouselMediaModal
            isOpen
            onClose={() => setMediaItem(null)}
            itemId={mediaItem.id}
            title={mediaItem.title}
            subTitle={mediaItem.sub}
            actionUrl={mediaItem.actionUrl}
            mediaItems={mediaItem.mediaItems ?? []}
          />
        )}
      </Suspense>
    </>
  );
}
