import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  Crosshair,
  Hash,
  Loader2,
  Maximize2,
  Minimize2,
  MapPin,
  MapPinned,
  RefreshCw,
  Search,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { playSuccessSound } from '@/utils/audioUtils';
import { requestUserLocation, type UserLocation } from '@/utils/locationRequest';
import type { UzpostBranch } from '@/types/uzpostBranch';
import {
  UZPOST_BRANCH_PICKER_THEME,
  type UzpostBranchPickerTheme,
} from '@/components/delivery/UzpostBranchPicker.theme';

interface UzpostBranchPickerProps {
  branches: UzpostBranch[];
  selectedBranch: UzpostBranch | null;
  suggestedBranch?: UzpostBranch | null;
  isLoading: boolean;
  isError: boolean;
  onSelect: (branch: UzpostBranch) => void;
  onRetry: () => void;
  theme?: Partial<UzpostBranchPickerTheme>;
}

interface BranchMapControllerProps {
  branches: UzpostBranch[];
  selectedBranch: UzpostBranch | null;
  userLocation: UserLocation | null;
  isInteractive: boolean;
}

interface BranchWithDistance extends UzpostBranch {
  distanceKm: number | null;
}

const DEFAULT_CENTER: [number, number] = [41.311081, 69.240562];
const DEFAULT_VISIBLE_MARKER_LIMIT = 36;
const SEARCH_VISIBLE_MARKER_LIMIT = 48;
const NEARBY_VISIBLE_MARKER_LIMIT = 40;

function createBranchIcon(color: string, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 42 : 34;
  const innerSize = isSelected ? 18 : 12;

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    html: `
      <div style="
        width:${size}px;
        height:${size}px;
        border-radius:9999px 9999px 9999px 0;
        transform:rotate(-45deg);
        background:${color};
        border:3px solid white;
        box-shadow:0 12px 24px rgba(15,23,42,.22);
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <span style="
          width:${innerSize}px;
          height:${innerSize}px;
          border-radius:9999px;
          background:white;
          display:block;
        "></span>
      </div>
    `,
  });
}

function calculateDistanceKm(from: UserLocation, to: UzpostBranch): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

function formatDistance(distanceKm: number | null): string | null {
  if (distanceKm === null) {
    return null;
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toFixed(1)} km`;
}

function BranchMapController({
  branches,
  selectedBranch,
  userLocation,
  isInteractive,
}: BranchMapControllerProps) {
  const map = useMap();
  const hasFittedBounds = useRef(false);
  const latestUserLocationKey = useRef<string | null>(null);

  useEffect(() => {
    const interactionHandlers = [
      map.dragging,
      map.touchZoom,
      map.doubleClickZoom,
      map.scrollWheelZoom,
      map.boxZoom,
      map.keyboard,
    ];

    interactionHandlers.forEach((handler) => {
      if (isInteractive) {
        handler.enable();
      } else {
        handler.disable();
      }
    });
  }, [isInteractive, map]);

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      map.invalidateSize();
    });
    const timeoutId = window.setTimeout(() => {
      map.invalidateSize();
    }, 280);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
    };
  }, [isInteractive, map]);

  useEffect(() => {
    if (selectedBranch) {
      map.flyTo([selectedBranch.latitude, selectedBranch.longitude], 15, {
        duration: 0.65,
      });
      return;
    }

    if (userLocation) {
      const userLocationKey = `${userLocation.latitude}:${userLocation.longitude}`;
      if (latestUserLocationKey.current !== userLocationKey) {
        map.flyTo([userLocation.latitude, userLocation.longitude], 14, {
          duration: 0.65,
        });
        latestUserLocationKey.current = userLocationKey;
      }
      return;
    }

    if (hasFittedBounds.current || branches.length === 0) {
      return;
    }

    const bounds = L.latLngBounds(
      branches.map((branch): L.LatLngTuple => [branch.latitude, branch.longitude])
    );
    map.fitBounds(bounds, { maxZoom: 12, padding: [28, 28] });
    hasFittedBounds.current = true;
  }, [branches, map, selectedBranch, userLocation]);

  return null;
}

function formatNullable(value: string | null, fallback: string): string {
  return value ?? fallback;
}

function SelectedBranchDetails({
  branch,
  theme,
}: {
  branch: UzpostBranch | null;
  theme: UzpostBranchPickerTheme;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation();
  const unavailableLabel = t('deliveryRequest.branchPicker.unavailable');

  if (!branch) {
    return (
      <div className={cn(theme.selectedPanelClassName, 'text-center')}>
        <MapPinned className="mx-auto mb-3 h-10 w-10 text-orange-400" />
        <p className={cn('text-sm font-bold', theme.primaryTextClassName)}>
          {t('deliveryRequest.branchPicker.emptyTitle')}
        </p>
        <p className={cn('mt-1 text-xs', theme.mutedTextClassName)}>
          {t('deliveryRequest.branchPicker.emptyDescription')}
        </p>
      </div>
    );
  }

  const primaryRows = [
    { label: t('deliveryRequest.branchPicker.fields.index'), value: String(branch.index) },
    { label: t('deliveryRequest.branchPicker.fields.address'), value: branch.address },
    {
      label: t('deliveryRequest.branchPicker.fields.workdays'),
      value: formatNullable(branch.workdays, unavailableLabel),
    },
    {
      label: t('deliveryRequest.branchPicker.fields.saturday'),
      value: formatNullable(branch.saturday, unavailableLabel),
    },
  ];
  const expandedRows = [
    { label: t('deliveryRequest.branchPicker.fields.id'), value: String(branch.id) },
    {
      label: t('deliveryRequest.branchPicker.fields.lunch'),
      value: formatNullable(branch.lunch, unavailableLabel),
    },
    {
      label: t('deliveryRequest.branchPicker.fields.dayOff'),
      value: formatNullable(branch.dayOff, unavailableLabel),
    },
    {
      label: t('deliveryRequest.branchPicker.fields.otherScheduleNotes'),
      value: formatNullable(branch.otherScheduleNotes, unavailableLabel),
    },
    { label: t('deliveryRequest.branchPicker.fields.latitude'), value: String(branch.latitude) },
    { label: t('deliveryRequest.branchPicker.fields.longitude'), value: String(branch.longitude) },
  ];

  return (
    <div className={theme.selectedPanelClassName}>
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className={cn('text-xs font-bold uppercase', theme.mutedTextClassName)}>
            {t('deliveryRequest.branchPicker.selectedLabel')}
          </p>
          <h3 className={cn('mt-0.5 text-base font-extrabold leading-tight', theme.primaryTextClassName)}>
            {branch.name}
          </h3>
          <p className={cn('mt-1 text-sm leading-snug', theme.mutedTextClassName)}>
            {branch.address}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {primaryRows.map((row) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/[0.04]"
          >
            <span className={cn('shrink-0 text-xs font-semibold', theme.mutedTextClassName)}>
              {row.label}
            </span>
            <span className={cn('text-right text-xs font-bold leading-snug', theme.primaryTextClassName)}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-orange-200 bg-orange-50 px-3 py-2 text-left text-xs font-bold text-orange-700 transition active:scale-[0.99] dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300"
      >
        <span>{t('deliveryRequest.branchPicker.expandDetails')}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', isExpanded && 'rotate-180')}
        />
      </button>

      {isExpanded && (
        <div className="mt-2 grid grid-cols-1 gap-2">
          {expandedRows.map((row) => (
            <div
              key={row.label}
              className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/[0.04]"
            >
              <span className={cn('shrink-0 text-xs font-semibold', theme.mutedTextClassName)}>
                {row.label}
              </span>
              <span className={cn('text-right text-xs font-bold leading-snug', theme.primaryTextClassName)}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SelectedBranchPreview({
  branch,
  theme,
  onReopen,
}: {
  branch: UzpostBranch;
  theme: UzpostBranchPickerTheme;
  onReopen: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onReopen}
      className={cn(
        theme.selectedPanelClassName,
        'w-full text-left transition active:scale-[0.99]'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-xs font-bold uppercase', theme.mutedTextClassName)}>
            {t('deliveryRequest.branchPicker.selectedLabel')}
          </p>
          <h3 className={cn('mt-0.5 text-base font-extrabold leading-tight', theme.primaryTextClassName)}>
            {branch.index} - {branch.name}
          </h3>
          <p className={cn('mt-1 line-clamp-2 text-sm leading-snug', theme.mutedTextClassName)}>
            {branch.address}
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
            <ChevronDown className="-rotate-90 h-3.5 w-3.5" />
            {t('deliveryRequest.branchPicker.changeSelection')}
          </p>
        </div>
      </div>
    </button>
  );
}

function SuggestedBranchCard({
  branch,
  theme,
  onUse,
  onChooseOther,
}: {
  branch: UzpostBranch;
  theme: UzpostBranchPickerTheme;
  onUse: () => void;
  onChooseOther: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className={theme.selectedPanelClassName}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300">
          <MapPinned className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-xs font-bold uppercase', theme.mutedTextClassName)}>
            {t('deliveryRequest.branchPicker.savedSuggestionLabel')}
          </p>
          <h3 className={cn('mt-0.5 text-base font-extrabold leading-tight', theme.primaryTextClassName)}>
            {branch.index} - {branch.name}
          </h3>
          <p className={cn('mt-1 line-clamp-2 text-sm leading-snug', theme.mutedTextClassName)}>
            {branch.address}
          </p>
          <p className="mt-2 text-xs font-semibold text-orange-600 dark:text-orange-300">
            {t('deliveryRequest.branchPicker.savedSuggestionHint')}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onUse}
          className="h-11 rounded-2xl bg-emerald-500 px-3 text-xs font-extrabold text-white shadow-lg shadow-emerald-500/20 transition active:scale-95"
        >
          {t('deliveryRequest.branchPicker.useSavedBranch')}
        </button>
        <button
          type="button"
          onClick={onChooseOther}
          className="h-11 rounded-2xl border border-orange-200 bg-orange-50 px-3 text-xs font-extrabold text-orange-700 transition active:scale-95 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300"
        >
          {t('deliveryRequest.branchPicker.chooseOtherBranch')}
        </button>
      </div>
    </div>
  );
}

export const UzpostBranchPicker = memo(function UzpostBranchPicker({
  branches,
  selectedBranch,
  suggestedBranch = null,
  isLoading,
  isError,
  onSelect,
  onRetry,
  theme: themeOverrides,
}: UzpostBranchPickerProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(() => selectedBranch === null && suggestedBranch === null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSelectionSettling, setIsSelectionSettling] = useState(false);
  const [dismissedSuggestionId, setDismissedSuggestionId] = useState<number | null>(null);
  const collapseTimeoutRef = useRef<number | null>(null);
  const theme = useMemo(
    () => ({ ...UZPOST_BRANCH_PICKER_THEME, ...themeOverrides }),
    [themeOverrides]
  );
  const markerIcon = useMemo(() => createBranchIcon(theme.markerColor, false), [theme.markerColor]);
  const selectedMarkerIcon = useMemo(
    () => createBranchIcon(theme.selectedMarkerColor, true),
    [theme.selectedMarkerColor]
  );

  const branchesWithDistance = useMemo<BranchWithDistance[]>(() => {
    return branches
      .map((branch) => ({
        ...branch,
        distanceKm: userLocation ? calculateDistanceKm(userLocation, branch) : null,
      }))
      .sort((first, second) => {
        if (first.distanceKm === null || second.distanceKm === null) {
          return first.id - second.id;
        }

        return first.distanceKm - second.distanceKm;
      });
  }, [branches, userLocation]);

  const filteredBranches = useMemo<BranchWithDistance[]>(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return branchesWithDistance;
    }

    return branchesWithDistance
      .filter((branch) => {
        const searchableText = `${branch.name} ${branch.index} ${branch.address}`.toLowerCase();
        return searchableText.includes(normalizedQuery);
      })
      .slice(0, 10);
  }, [branchesWithDistance, searchQuery, userLocation]);

  const visibleMapBranches = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const candidateBranches = normalizedQuery
      ? branchesWithDistance.filter((branch) => {
          const searchableText = `${branch.name} ${branch.index} ${branch.address}`.toLowerCase();
          return searchableText.includes(normalizedQuery);
        })
      : branchesWithDistance;

    const markerLimit = normalizedQuery
      ? SEARCH_VISIBLE_MARKER_LIMIT
      : userLocation
      ? NEARBY_VISIBLE_MARKER_LIMIT
      : DEFAULT_VISIBLE_MARKER_LIMIT;

    const visibleBranches = candidateBranches.slice(0, markerLimit);
    if (selectedBranch && !visibleBranches.some((branch) => branch.id === selectedBranch.id)) {
      return [selectedBranch, ...visibleBranches];
    }

    return visibleBranches;
  }, [branchesWithDistance, searchQuery, selectedBranch, userLocation]);

  const handleBranchSelect = useCallback(
    (branch: UzpostBranch) => {
      if (collapseTimeoutRef.current !== null) {
        window.clearTimeout(collapseTimeoutRef.current);
      }

      onSelect(branch);
      toast.success(t('deliveryRequest.branchPicker.selectedToast', { name: branch.name }));
      playSuccessSound();
      setIsSelectionSettling(true);
      setSearchQuery('');

      collapseTimeoutRef.current = window.setTimeout(() => {
        setIsPickerOpen(false);
        setIsMapExpanded(false);
        setIsSelectionSettling(false);
        collapseTimeoutRef.current = null;
      }, 520);
    },
    [onSelect, t]
  );

  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current !== null) {
        window.clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, []);

  const handleLocateUser = async () => {
    if (!navigator.geolocation && !window.Telegram?.WebApp?.LocationManager) {
      setLocationError(t('deliveryRequest.branchPicker.geolocationUnsupported'));
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    const nextLocation = await requestUserLocation();

    if (!nextLocation) {
      setLocationError(t('deliveryRequest.branchPicker.geolocationFailed'));
      setIsLocating(false);
      return;
    }

    setUserLocation(nextLocation);
    setIsPickerOpen(true);
    setIsLocating(false);
  };

  if (isLoading) {
    return (
      <div className={cn(theme.shellClassName, 'flex min-h-[280px] items-center justify-center')}>
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-orange-500" />
          <p className={cn('text-sm font-bold', theme.primaryTextClassName)}>
            {t('deliveryRequest.branchPicker.loading')}
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn(theme.shellClassName, 'text-center')}>
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
        <p className={cn('text-sm font-bold', theme.primaryTextClassName)}>
          {t('deliveryRequest.branchPicker.loadError')}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mx-auto mt-4 flex h-11 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
          {t('deliveryRequest.branchPicker.retry')}
        </button>
      </div>
    );
  }

  if (selectedBranch && !isPickerOpen) {
    return (
      <div className={theme.shellClassName} data-dashboard-swipe-lock="true">
        <SelectedBranchPreview
          branch={selectedBranch}
          theme={theme}
          onReopen={() => setIsPickerOpen(true)}
        />
      </div>
    );
  }

  const shouldShowSuggestedBranch =
    suggestedBranch !== null &&
    selectedBranch === null &&
    dismissedSuggestionId !== suggestedBranch.id;

  if (shouldShowSuggestedBranch) {
    return (
      <div className={theme.shellClassName} data-dashboard-swipe-lock="true">
        <SuggestedBranchCard
          branch={suggestedBranch}
          theme={theme}
          onUse={() => handleBranchSelect(suggestedBranch)}
          onChooseOther={() => {
            setDismissedSuggestionId(suggestedBranch.id);
            setIsPickerOpen(true);
            setIsMapExpanded(false);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        theme.shellClassName,
        isSelectionSettling && 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-white transition dark:ring-offset-gray-950'
      )}
      data-dashboard-swipe-lock="true"
    >
      <div className="mb-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className={cn('text-lg font-extrabold', theme.primaryTextClassName)}>
              {t('deliveryRequest.branchPicker.title')}
            </h3>
            <p className={cn('text-xs font-medium', theme.mutedTextClassName)}>
              {t('deliveryRequest.branchPicker.subtitle', {
                count: branches.length,
              })}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-orange-600 shadow-sm dark:bg-white/10 dark:text-orange-300">
            <MapPin className="h-3.5 w-3.5" />
            {visibleMapBranches.length}/{branches.length}
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-orange-400" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className={theme.searchClassName}
            placeholder={t('deliveryRequest.branchPicker.searchPlaceholder')}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleLocateUser}
            disabled={isLocating}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 text-xs font-bold text-white shadow-lg shadow-orange-500/20 transition active:scale-95 disabled:opacity-70"
          >
            {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
            {t('deliveryRequest.branchPicker.locateButton')}
          </button>
          <button
            type="button"
            onClick={() => setIsMapExpanded((current) => !current)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-xs font-bold text-gray-700 shadow-sm transition active:scale-95 dark:bg-white/10 dark:text-gray-200"
          >
            {isMapExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {isMapExpanded
              ? t('deliveryRequest.branchPicker.collapseMap')
              : t('deliveryRequest.branchPicker.expandMap')}
          </button>
        </div>

        {locationError && (
          <p className="mt-2 text-xs font-semibold text-red-500">{locationError}</p>
        )}
      </div>

      {/* Open map button */}
      {!isMapExpanded && (
        <button
          type="button"
          onClick={() => setIsMapExpanded(true)}
          className="w-full h-12 rounded-2xl bg-white dark:bg-white/5 border border-orange-200 dark:border-orange-500/20 text-sm font-bold text-orange-600 dark:text-orange-300 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <MapPin className="h-4 w-4" />
          {t('deliveryRequest.branchPicker.openMap')}
        </button>
      )}

      {/* Map container */}
      {isMapExpanded && (
        <div className={cn(theme.mapClassName, 'h-[420px]', 'relative')}>
          <MapContainer
            key="uzpost-map-expanded"
            center={DEFAULT_CENTER}
            zoom={11}
            scrollWheelZoom
            dragging
            touchZoom
            doubleClickZoom
            zoomControl
            style={{ touchAction: 'none' }}
            className="h-full w-full"
            boxZoom
            keyboard
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <BranchMapController
              branches={visibleMapBranches}
              selectedBranch={selectedBranch}
              userLocation={userLocation}
              isInteractive={isMapExpanded}
            />
            {userLocation && (
              <CircleMarker
                center={[userLocation.latitude, userLocation.longitude]}
                radius={9}
                pathOptions={{
                  color: '#2563eb',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.85,
                  weight: 3,
                }}
              >
                <Popup>{t('deliveryRequest.branchPicker.userLocationPopup')}</Popup>
              </CircleMarker>
            )}
            {visibleMapBranches.map((branch) => {
              const isSelected = selectedBranch?.id === branch.id;
              return (
                <Marker
                  key={branch.id}
                  position={[branch.latitude, branch.longitude]}
                  icon={isSelected ? selectedMarkerIcon : markerIcon}
                  eventHandlers={{ click: () => handleBranchSelect(branch) }}
                >
                  <Popup>
                    <div className="min-w-48">
                      <p className="text-sm font-bold">{branch.name}</p>
                      <p className="mt-1 text-xs text-gray-600">{branch.address}</p>
                      <p className="mt-2 text-xs font-semibold text-orange-600">
                        {t('deliveryRequest.branchPicker.fields.index')}: {branch.index}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
          <button
            type="button"
            onClick={() => setIsMapExpanded(false)}
            className="absolute top-2 right-2 z-[1000] inline-flex items-center gap-1.5 rounded-xl bg-white/95 dark:bg-gray-950/95 px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 shadow-lg ring-1 ring-black/5 dark:ring-white/10 backdrop-blur-md active:scale-95 transition-all"
          >
            <Minimize2 className="h-3.5 w-3.5 text-orange-500" />
            {t('deliveryRequest.branchPicker.closeMap')}
          </button>
        </div>
      )}

      <div className="mt-3 grid gap-2 max-h-60 overflow-y-auto">
        {filteredBranches.map((branch) => {
          const isSelected = selectedBranch?.id === branch.id;
          const distanceLabel = formatDistance(branch.distanceKm);
          return (
            <button
              key={branch.id}
              type="button"
              onClick={() => handleBranchSelect(branch)}
              className={cn(
                theme.resultButtonClassName,
                isSelected && theme.selectedResultButtonClassName,
                isSelected && isSelectionSettling && 'scale-[0.99] ring-2 ring-emerald-400'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300">
                    <Hash className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-sm font-extrabold leading-tight', theme.primaryTextClassName)}>
                      {branch.index} - {branch.name}
                    </p>
                    <p className={cn('mt-1 line-clamp-2 text-xs leading-snug', theme.mutedTextClassName)}>
                      {branch.address}
                    </p>
                    {branch.workdays && (
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {branch.workdays}
                      </span>
                    )}
                    {distanceLabel && (
                      <span className="mt-2 ml-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-300">
                        <MapPin className="h-3.5 w-3.5" />
                        {distanceLabel}
                      </span>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <div className="shrink-0 w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        <SelectedBranchDetails branch={selectedBranch} theme={theme} />
      </div>
    </div>
  );
});
