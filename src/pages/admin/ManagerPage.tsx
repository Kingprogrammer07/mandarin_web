import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Users, LogOut, Sun, Moon, Layers, CalendarDays, Send } from 'lucide-react';
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

  const [jwtClaims, setJwtClaims] = useState(() => getAdminJwtClaims());
  const [isDark, setIsDark] = useState(getInitialTheme);
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

            <div className="flex items-center gap-1">
              <span className="hidden sm:inline text-[12px] text-gray-500 dark:text-gray-400 mr-1">
                {jwtClaims.role_name}
              </span>

              {/* Carousel management — only visible when the JWT contains carousel:read */}
              {(jwtClaims.isSuperAdmin || jwtClaims.permissions.has('carousel:read')) && (
                <button
                  onClick={() => onNavigate('admin-carousel')}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                  title="Karusel boshqaruvi"
                >
                  <Layers className="w-4 h-4" />
                </button>
              )}

              {/* Flight schedule — visible for both read-only and manage roles */}
              {(jwtClaims.isSuperAdmin || jwtClaims.permissions.has('flight_schedule:manage') || jwtClaims.permissions.has('flight_schedule:read')) && (
                <button
                  onClick={() => onNavigate('flight-schedule-admin')}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                  title="Reys jadvali"
                >
                  <CalendarDays className="w-4 h-4" />
                </button>
              )}

              {/* Delivery request — permission-gated (manager role already carries
                  delivery_requests:create via seeders; no role-name hardcode). */}
              {(jwtClaims.isSuperAdmin || jwtClaims.permissions.has('delivery_requests:create')) && (
                <button
                  onClick={() => onNavigate('admin-delivery-request')}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                  title="Zayavka qoldirish"
                >
                  <Send className="w-4 h-4" />
                </button>
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
          <RoleSwitcher onNavigate={onNavigate} />
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
    </div>
  );
}
