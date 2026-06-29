import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, LogOut, Sun, Moon, Layers, CalendarDays, Send, UserPlus, X, MoreVertical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import SearchAndFilterBar from '../../components/manager/SearchAndFilterBar';
import type { SearchType } from '../../components/manager/SearchAndFilterBar';
import ClientsDataTable from '../../components/manager/ClientsDataTable';
import { ClientDetailDrawer } from '../../components/manager/ClientDetailDrawer';
import { useManagerStore } from '../../store/useManagerStore';
import { searchClientsPaginated } from '../../api/services/adminClients';
import { getAdminJwtClaims } from '../../api/services/adminManagement';
import { refreshAdminToken } from '../../api/services/adminAuth';
import RoleSwitcher from '../../components/admin/RoleSwitcher';
import type { ClientSearchResponse } from '../../api/services/adminClients';
import { useGuideTour } from '../../hooks/useGuideTour';
import {
  isAdminAgreementAccepted,
  ADMIN_AGREEMENT_ACCEPTED_EVENT,
} from '../../components/admin/adminAgreement';
import { pickVisible } from '../../utils/tour';
import type { DriveStep } from 'driver.js';
import { useTranslation } from 'react-i18next';

// Lazy — the full add/edit client form is heavy and only opened on demand.
const ClientForm = lazy(() => import('../../pages/shared/ClientForm'));

interface ManagerPageProps {
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

function getInitialTheme(): boolean {
  return (
    localStorage.getItem('adminTheme') === 'dark' ||
    (!('adminTheme' in localStorage) &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

export default function ManagerPage({ onNavigate, onLogout }: ManagerPageProps) {
  const { searchQuery, page, selectedClientId, setSearchQuery, setPage, setSelectedClientId } =
    useManagerStore();

  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [jwtClaims, setJwtClaims] = useState(() => getAdminJwtClaims());
  const canCreateClient =
    jwtClaims.isSuperAdmin || jwtClaims.permissions.has('clients:create');
  const [isDark, setIsDark] = useState(getInitialTheme);
  // Overflow ("more") menu for the secondary nav icons on narrow screens.
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  // The one-time admin agreement shows on this page; hold the tour until it's
  // accepted so the two overlays never collide.
  const [agreementOk, setAgreementOk] = useState(isAdminAgreementAccepted);
  // Targeted search type: 'code' searches client code only, 'name' full_name only.
  // Default to 'code' — staff most often look clients up by their cargo code.
  const [searchType, setSearchType] = useState<SearchType>('code');
  const [strictSearch, setStrictSearch] = useState(false);

  // Apply theme on mount and when toggled
  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('adminTheme', next ? 'dark' : 'light');
    if (next) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  // Silent token refresh on mount so permissions stay current
  useEffect(() => {
    let cancelled = false;
    refreshAdminToken()
      .then((data) => {
        if (cancelled) return;
        localStorage.setItem('access_token', data.access_token);
        setJwtClaims(getAdminJwtClaims());
      })
      .catch(() => {
        // Non-fatal — continue with existing token
      });
    return () => { cancelled = true; };
  }, []);

  const isQueryEmpty = searchQuery.trim().length === 0;

  // Build the correct targeted param based on search type
  const searchParams = isQueryEmpty
    ? {}
    : searchType === 'code'
      ? { code: searchQuery, strict: strictSearch }
      : searchType === 'phone'
        ? { phone: searchQuery }
        : { name: searchQuery };

  const { data, isLoading } = useQuery<ClientSearchResponse>({
    queryKey: ['manager-clients', searchType, searchQuery, strictSearch, page],
    queryFn: () => searchClientsPaginated({ ...searchParams, page, size: 20 }),
    enabled: !isQueryEmpty,
    placeholderData: (prev) => prev,
  });

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setSelectedClientId(null);
  }, [setSearchQuery, setSelectedClientId]);

  const handleSearchTypeChange = useCallback((type: SearchType) => {
    setSearchType(type);
    setStrictSearch(false);
    // Reset query and page when switching search type
    setSearchQuery('');
    setPage(1);
    setSelectedClientId(null);
  }, [setSearchQuery, setPage, setSelectedClientId]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, [setPage]);

  const handleSelectClient = useCallback((id: number) => {
    setSelectedClientId(id);
  }, [setSelectedClientId]);

  // One-time guided tour: what's on the page + what this admin can do here.
  const buildManagerTour = useCallback((): DriveStep[] => {
    const steps: DriveStep[] = [
      {
        element: '[data-tour="manager-search"]',
        popover: { title: t('tour.manager.search.title'), description: t('tour.manager.search.desc') },
      },
    ];
    const rowEl = pickVisible('[data-tour="manager-row"]');
    if (rowEl) {
      steps.push({
        element: rowEl,
        popover: { title: t('tour.manager.row.title'), description: t('tour.manager.row.desc') },
      });
    }
    if (canCreateClient) {
      steps.push({
        element: '[data-tour="manager-create"]',
        popover: { title: t('tour.manager.create.title'), description: t('tour.manager.create.desc') },
      });
    }
    steps.push({
      element: '[data-tour="manager-nav"]',
      popover: { title: t('tour.manager.nav.title'), description: t('tour.manager.nav.desc') },
    });
    return steps;
  }, [t, canCreateClient]);
  useGuideTour('manager', buildManagerTour, !!jwtClaims.role_name && agreementOk);

  // Start the tour the moment the agreement is accepted (same page, no reload).
  useEffect(() => {
    if (agreementOk) return;
    const onAccepted = () => setAgreementOk(true);
    window.addEventListener(ADMIN_AGREEMENT_ACCEPTED_EVENT, onAccepted);
    return () => window.removeEventListener(ADMIN_AGREEMENT_ACCEPTED_EVENT, onAccepted);
  }, [agreementOk]);

  // Close the overflow menu on any outside click.
  useEffect(() => {
    if (!isMoreOpen) return;
    const handle = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [isMoreOpen]);

  // Secondary nav actions — shown inline on ≥sm, collapsed into a kebab menu on
  // phones so the header never overflows. Permission logic lives here once.
  const secondaryNav = (
    [
      (jwtClaims.isSuperAdmin || jwtClaims.permissions.has('carousel:read')) && {
        key: 'carousel',
        icon: Layers,
        label: 'Karusel boshqaruvi',
        onClick: () => onNavigate('admin-carousel'),
      },
      (jwtClaims.isSuperAdmin ||
        jwtClaims.permissions.has('flight_schedule:manage') ||
        jwtClaims.permissions.has('flight_schedule:read')) && {
        key: 'flight',
        icon: CalendarDays,
        label: 'Reys jadvali',
        onClick: () => onNavigate('flight-schedule-admin'),
      },
      (jwtClaims.isSuperAdmin || jwtClaims.permissions.has('delivery_requests:create')) && {
        key: 'delivery',
        icon: Send,
        label: 'Zayavka qoldirish',
        onClick: () => onNavigate('admin-delivery-request'),
      },
    ] as (false | { key: string; icon: LucideIcon; label: string; onClick: () => void })[]
  ).filter(Boolean) as { key: string; icon: LucideIcon; label: string; onClick: () => void }[];

  return (
    <div className="min-h-screen bg-[#f5f5f4] dark:bg-[#0a0a0a]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-white/[0.08]">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.history.back()}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <h1 className="text-[15px] font-bold text-gray-900 dark:text-white leading-tight">
                    Mijozlar boshqaruvi
                  </h1>
                  {data && !isQueryEmpty && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
                      {data.total_count} ta natija
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1" data-tour="manager-nav">
              <span className="hidden sm:inline text-[12px] text-gray-500 dark:text-gray-400 mr-1">
                {jwtClaims.role_name}
              </span>

              {/* New client — permission-gated (manager carries clients:create via seed). */}
              {canCreateClient && (
                <button
                  onClick={() => setIsCreateOpen(true)}
                  data-tour="manager-create"
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                  title="Yangi mijoz qo'shish"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              )}

              {/* Secondary nav — inline on ≥sm; collapses into a kebab menu on phones.
                  Permission gates are resolved once in `secondaryNav`. */}
              <div className="hidden sm:flex items-center gap-1">
                {secondaryNav.map(({ key, icon: Icon, label, onClick }) => (
                  <button
                    key={key}
                    onClick={onClick}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                    title={label}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>

              {secondaryNav.length > 0 && (
                <div ref={moreRef} className="relative sm:hidden">
                  <button
                    onClick={() => setIsMoreOpen((p) => !p)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                    title="Boshqa amallar"
                    aria-label="Boshqa amallar"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {isMoreOpen && (
                    <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/[0.08] shadow-lg z-50 py-1">
                      {secondaryNav.map(({ key, icon: Icon, label, onClick }) => (
                        <button
                          key={key}
                          onClick={() => {
                            setIsMoreOpen(false);
                            onClick();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                        >
                          <Icon className="w-4 h-4 text-orange-500 shrink-0" />
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Role / theme / logout live in the fixed bottom bar on mobile —
                  keep the header uncluttered on small screens. */}
              <div className="hidden md:flex items-center gap-1">
                <RoleSwitcher onNavigate={onNavigate} />
                <button
                  onClick={toggleTheme}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                  title={isDark ? "Kunduzgi rejim" : "Tungi rejim"}
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  onClick={onLogout}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  title="Chiqish"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div data-tour="manager-search">
            <SearchAndFilterBar
              value={searchQuery}
              onChange={handleSearchChange}
              searchType={searchType}
              onSearchTypeChange={handleSearchTypeChange}
              strict={strictSearch}
              onStrictChange={setStrictSearch}
            />
          </div>
        </div>
      </div>

      {/* Main content — extra bottom padding on mobile so the fixed bottom bar
          never covers the last row / pagination. */}
      <div className="max-w-5xl mx-auto px-4 pt-4 pb-24 md:pb-4">
        <ClientsDataTable
          clients={data?.items ?? []}
          isLoading={isLoading && !isQueryEmpty}
          isQueryEmpty={isQueryEmpty}
          selectedClientId={selectedClientId}
          setSelectedClientId={handleSelectClient}
          page={page}
          totalPages={data?.total_pages ?? 0}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Mobile bottom bar — role switch + theme + logout (hidden in header on
          mobile). Respects the iOS safe-area inset. */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/90 dark:bg-[#0f0f0f]/90 backdrop-blur-xl border-t border-gray-200 dark:border-white/[0.06] px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-2 max-w-5xl mx-auto">
          <RoleSwitcher onNavigate={onNavigate} dropUp menuAlign="left" />
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-9 h-9 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
              title={isDark ? "Kunduzgi rejim" : "Tungi rejim"}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-red-500/80 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Chiqish
            </button>
          </div>
        </div>
      </div>

      {/* Client detail drawer (reads/writes Zustand store internally) */}
      <ClientDetailDrawer />

      {/* New-client sheet — mobile bottom-sheet / desktop right panel, hosts ClientForm. */}
      <AnimatePresence>
        {isCreateOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateOpen(false)}
              className="fixed inset-0 bg-black/50 dark:bg-black/70 z-[100]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[101] max-h-[94vh] flex flex-col bg-white dark:bg-[#111] rounded-t-3xl shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:w-full sm:max-w-lg sm:rounded-t-none sm:rounded-l-3xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06] flex-shrink-0">
                <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">
                  Yangi mijoz qo&apos;shish
                </h2>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
                  aria-label="Yopish"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
                <Suspense
                  fallback={
                    <div className="p-10 text-center text-[13px] text-gray-400 dark:text-gray-500">
                      Yuklanmoqda...
                    </div>
                  }
                >
                  <ClientForm
                    mode="add"
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ['manager-clients'] });
                      setIsCreateOpen(false);
                    }}
                    onCancel={() => setIsCreateOpen(false)}
                  />
                </Suspense>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
