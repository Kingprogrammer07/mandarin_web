import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calculator,
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  Headphones,
  History,
  MapPin,
  PenSquare,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HomeCarousel } from '@/components/user/HomeCarousel';
import { HomeHeader } from '@/components/user/HomeHeader';
import { HomeStatCards, type HomeSummary } from '@/components/user/HomeStatCards';
import { OfficeCard } from '@/components/user/OfficeCard';
import { SUPPORT_TELEGRAM_URL } from '@/config/contacts';
import { QuickActionGrid, type QuickAction } from '@/components/user/QuickActionGrid';
import { TrackSearchBar } from '@/components/user/TrackSearchBar';
import { getHomeSummary } from '@/api/services/userHome';
import { useOfficeInfo } from '@/hooks/useOfficeInfo';
import { useProfile } from '@/hooks/useProfile';
import type { CarouselItemData } from './dashboard-components/types';

/** Where the support button goes until an in-app help surface exists. */

export interface HomeScreenProps {
  onNavigate: (page: string) => void;
  onOpenPayment: () => void;
  onOpenDeliveryRequest: () => void;
  onOpenChinaAddress: () => void;
  onOpenCalculator: () => void;
  onOpenFlightSchedule: () => void;
  onOpenOffice: () => void;
  /** "Yuklar Tarixi" — `TrackCodeTab`'s history view. `tracking.myCargo`
   *  is only the label of the button that opens it, not the screen's name. */
  onOpenCargoHistory: () => void;
  /** The client's own delivery requests — `DeliveryHistoryPage`. */
  onOpenDeliveryHistory: () => void;
  /** `NotificationCenter`, rendered into the header by the container. */
  notificationSlot?: React.ReactNode;
  onOpenCarouselItem: (item: CarouselItemData) => void;
  onTrackSearch: (trackCode: string) => void;
  onOpenTracking: () => void;
  /** Absent for clients whose role has no reports screen. */
  onOpenReports?: () => void;
}

/**
 * The redesigned client home.
 *
 * The bottom tab bar is NOT rendered here — `App.tsx` mounts it once for every
 * client page, so a second copy would stack two bars on top of each other.
 *
 * Built alongside the old `Dashboard.tsx` rather than replacing it in place:
 * the app is live, and the dashboard carries logic (carousel tracking, swipe
 * tabs, install prompts) that is easier to retire once this screen has proven
 * itself than to port under pressure.
 */
export function HomeScreen({
  onNavigate,
  onOpenPayment,
  onOpenDeliveryRequest,
  onOpenChinaAddress,
  onOpenCalculator,
  onOpenFlightSchedule,
  onOpenOffice,
  onOpenCargoHistory,
  onOpenDeliveryHistory,
  notificationSlot,
  onOpenCarouselItem,
  onTrackSearch,
  onOpenTracking,
  onOpenReports,
}: HomeScreenProps) {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { data: office, isLoading: officeLoading } = useOfficeInfo();
  const [isSearching, setIsSearching] = useState(false);

  const summaryQuery = useQuery<HomeSummary>({
    queryKey: ['user-home-summary'],
    queryFn: async () => {
      const data = await getHomeSummary();
      return {
        activeCargoCount: data.active_cargo_count,
        unpaidTotal: data.unpaid_total,
        unpaidFlightCount: data.unpaid_flight_count,
      };
    },
    // Short window: a client who has just paid opens this screen expecting the
    // debt to be gone, and a long cache would still show it.
    staleTime: 30_000,
  });

  const firstName = useMemo(() => {
    const full = profile?.full_name?.trim();
    if (!full) return '';
    return full.split(/\s+/)[0] ?? '';
  }, [profile?.full_name]);

  const handleSearch = useCallback(
    (trackCode: string) => {
      setIsSearching(true);
      try {
        onTrackSearch(trackCode);
      } finally {
        setIsSearching(false);
      }
    },
    [onTrackSearch],
  );

  // The four the client reaches for most: ask for delivery, get the China
  // address to hand a seller, pay, and check where the parcels are. The
  // calculator moved down to Xizmatlar — it is used once before buying, not on
  // every visit, while cargo history is the reason most clients open the app.
  const primaryActions: QuickAction[] = [
    {
      id: 'request',
      label: t('dashboard.actions.request.label', 'Zayafka qoldirish'),
      Icon: PenSquare,
      onClick: onOpenDeliveryRequest,
    },
    {
      id: 'china',
      label: t('dashboard.actions.china.label', 'Xitoy manzili'),
      Icon: MapPin,
      onClick: onOpenChinaAddress,
    },
    {
      id: 'payment',
      label: t('dashboard.actions.payment.label', "To'lov qilish"),
      Icon: CreditCard,
      onClick: onOpenPayment,
    },
    {
      // The screen titles itself `tracking.historyTitle` — "Yuklar Tarixi" —
      // so the entry point reuses that string rather than inventing a name.
      id: 'cargo_history',
      label: t('tracking.historyTitle', 'Yuklar tarixi'),
      Icon: History,
      onClick: onOpenCargoHistory,
    },
  ];

  const secondaryActions: QuickAction[] = [
    {
      id: 'calculator',
      label: t('dashboard.actions.calculator.label', 'Kalkulyator'),
      Icon: Calculator,
      onClick: onOpenCalculator,
    },
    {
      id: 'delivery_history',
      label: t('deliveryHistory.title', 'Zayavkalar tarixi'),
      Icon: ClipboardList,
      onClick: onOpenDeliveryHistory,
    },
    {
      id: 'schedule',
      label: t('dashboard.actions.schedule.label', 'Reyslar Jadvali'),
      Icon: Calendar,
      onClick: onOpenFlightSchedule,
    },
    {
      id: 'support',
      label: t('dashboard.actions.support.label', 'Yordam'),
      Icon: Headphones,
      onClick: () => window.open(SUPPORT_TELEGRAM_URL, '_blank', 'noopener,noreferrer'),
    },
    ...(onOpenReports
      ? [
          {
            id: 'report',
            label: t('dashboard.actions.report.label', 'Hisobotlar'),
            Icon: FileText,
            onClick: onOpenReports,
          } satisfies QuickAction,
        ]
      : []),
  ];

  return (
    <div className="min-h-dvh bg-mc-bg">
      {/* The page fill spans the viewport; the content does not. Without this
          the home screen was the only client page that stretched edge to edge
          on a desktop Telegram window, while the tab bar under it stayed at
          max-w-lg — so the two disagreed about where the app ended. */}
      <div className="mx-auto max-w-lg">
      <HomeHeader notificationSlot={notificationSlot} />

      <div className="px-4 pt-3">
        <h1 className="text-[19px] font-extrabold leading-tight tracking-tight text-mc-text">
          {t('home.greeting', 'Xush kelibsiz')}
          {firstName && (
            <>
              , <span className="text-mc-brand">{firstName}</span>
            </>
          )}
        </h1>
        <p className="mt-0.5 text-[12px] font-medium text-mc-text-2">
          {t('home.subtitle', 'Yuklaringizni kuzating va boshqaring')}
        </p>
      </div>

      {/* pb-5 is this screen's own end-of-content gap. App.tsx pads only by
          the bar height, so without it the last card sits flush against the
          tab bar. Other client pages carry their own pb-28 already. */}
      <div className="mt-3 space-y-2.5 pb-5">
        <TrackSearchBar
          onSearch={handleSearch}
          onOpenTracking={onOpenTracking}
          isSearching={isSearching}
        />

        <HomeStatCards
          summary={summaryQuery.data}
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          onRetry={() => void summaryQuery.refetch()}
          onActiveCargoClick={() => onNavigate('user-reports')}
          onUnpaidClick={onOpenPayment}
        />

        <HomeCarousel onItemClick={onOpenCarouselItem} />

        <QuickActionGrid actions={primaryActions} sweep />

        <OfficeCard office={office} isLoading={officeLoading} onOpen={onOpenOffice} />

        <QuickActionGrid
          actions={secondaryActions}
          title={t('home.services.title', 'Xizmatlar')}
          variant="plain"
        />
      </div>
      </div>
    </div>
  );
}
