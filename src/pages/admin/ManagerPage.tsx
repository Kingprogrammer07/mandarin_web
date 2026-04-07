import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Users, LogOut, Sun, Moon, Layers } from 'lucide-react';
import SearchAndFilterBar from '../../components/manager/SearchAndFilterBar';
import type { SearchType } from '../../components/manager/SearchAndFilterBar';
import ClientsDataTable from '../../components/manager/ClientsDataTable';
import { ClientDetailDrawer } from '../../components/manager/ClientDetailDrawer';
import { useManagerStore } from '../../store/useManagerStore';
import { searchClientsPaginated } from '../../api/services/adminClients';
import { getAdminJwtClaims } from '../../api/services/adminManagement';
import { refreshAdminToken } from '../../api/services/adminAuth';
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
  // Targeted search type: 'name' searches full_name only, 'code' searches client code only
  const [searchType, setSearchType] = useState<SearchType>('name');

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
      ? { code: searchQuery }
      : searchType === 'phone'
        ? { phone: searchQuery }
        : { name: searchQuery };

  const { data, isLoading } = useQuery<ClientSearchResponse>({
    queryKey: ['manager-clients', searchType, searchQuery, page],
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
              {jwtClaims.permissions.has('carousel:read') && (
                <button
                  onClick={() => onNavigate('admin-carousel')}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                  title="Karusel boshqaruvi"
                >
                  <Layers className="w-4 h-4" />
                </button>
              )}

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

          <SearchAndFilterBar
            value={searchQuery}
            onChange={handleSearchChange}
            searchType={searchType}
            onSearchTypeChange={handleSearchTypeChange}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 py-4">
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

      {/* Client detail drawer (reads/writes Zustand store internally) */}
      <ClientDetailDrawer />
    </div>
  );
}
