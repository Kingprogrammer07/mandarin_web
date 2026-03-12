import './i18n/config';

import { useState, useEffect, useCallback } from 'react';

import NavigationBar from './components/NavigationBar';
import { VerificationNav, type Page as VerificationPage } from './components/navigation/VerificationNav';
import RegistrationForm from './components/RegistrationForm';
import LoginForm from './components/LoginForm';
import ImportPage from './components/ImportPage';
import ClientForm from './components/ClientForm';
import FlightsPage from './components/FlightsPage';
import CargoListPage from './components/CargoListPage';
import AddCargoForm from './components/AddCargoForm';
import StatisticsDashboard from './components/StatisticsDashboard';
import TelegramWebAppGuard from './components/TelegramWebAppGuard';
import ClientSearchPage from './pages/ClientSearchPage';
import ClientProfilePage from './pages/ClientProfilePage';
import TransactionsPage from './pages/TransactionsPage';
import UnpaidCargoPage from './pages/UnpaidCargoPage';
import { PassportImagesModal } from './components/verification/PassportImagesModal';
import UserPage from './pages/UserPage';
import { UserNav } from './components/navigation/UserNav';
import { Toaster } from 'sonner';
import UserHome from './pages/UserHome';
import UserReportsPage from './pages/UserReportsPage';
import UserHistoryPage from './pages/UserHistoryPage';
import { fetchAuthMe } from './api/services/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

type Page =
  | 'login'
  | 'register'
  | 'import'
  | 'client-add'
  | 'client-edit'
  | 'flights'
  | 'cargo-list'
  | 'cargo-add'
  | 'statistics'
  | 'verification-search'
  | 'verification-profile'
  | 'verification-transactions'
  | 'verification-unpaid'
  | 'user-profile'
  | 'user-home'
  | 'user-reports'
  | 'user-history';

interface RouteInfo {
  page: Page;
  flightName?: string;
  clientId?: number;
  clientCode?: string;
}

// ─── Role Config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { default: Page; allowed: Page[] }> = {
  user: {
    default: 'user-home',
    allowed: ['user-home', 'user-profile', 'user-history', 'user-reports'],
  },
  worker: {
    default: 'flights',
    allowed: ['flights', 'cargo-list', 'cargo-add'],
  },
  accountant: {
    default: 'verification-search',
    allowed: [
      'verification-search',
      'verification-profile',
      'verification-transactions',
      'verification-unpaid',
    ],
  },
  admin: {
    default: 'user-home',
    allowed: [
      'import', 'client-add', 'client-edit',
      'flights', 'cargo-list', 'cargo-add', 'statistics',
      'verification-search', 'verification-profile',
      'verification-transactions', 'verification-unpaid',
      'user-home', 'user-profile', 'user-history', 'user-reports',
    ],
  },
  'super-admin': {
    default: 'user-home',
    allowed: [
      'import', 'client-add', 'client-edit',
      'flights', 'cargo-list', 'cargo-add', 'statistics',
      'verification-search', 'verification-profile',
      'verification-transactions', 'verification-unpaid',
      'user-home', 'user-profile', 'user-history', 'user-reports',
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GUEST_PAGES: Page[] = ['login', 'register'];

function isGuestPage(page: Page): boolean {
  return GUEST_PAGES.includes(page);
}

function getDefaultPageForRole(role: string): Page {
  return ROLE_CONFIG[role]?.default ?? 'login';
}

/**
 * Pure access-check function — no side effects.
 * Returns the page the user should actually land on.
 */
function checkAccess(targetPage: Page, role: string | null): Page {
  if (!role) {
    // Not logged in → only guest pages are accessible
    return isGuestPage(targetPage) ? targetPage : 'login';
  }
  if (isGuestPage(targetPage)) {
    // Already logged in → skip login/register, go to role default
    return getDefaultPageForRole(role);
  }
  const allowed = ROLE_CONFIG[role]?.allowed ?? [];
  return allowed.includes(targetPage) ? targetPage : getDefaultPageForRole(role);
}

function getPathForPage(
  page: Page,
  flightName?: string,
  clientId?: number,
  clientCode?: string,
): string {
  if (page === 'register') return '/auth/register';
  if (page === 'import') return '/import';
  if (page === 'client-add') return '/client/add';
  if (page === 'client-edit' && clientId) return `/client/edit/${clientId}`;
  if (page === 'flights') return '/flights';
  if (page === 'statistics') return '/statistics';
  if (page === 'cargo-list' && flightName) return `/flights/${encodeURIComponent(flightName)}/photos`;
  if (page === 'cargo-add' && flightName) return `/flights/${encodeURIComponent(flightName)}/photos/add`;
  if (page === 'verification-search') return '/verification/search';
  if (page === 'verification-profile' && clientId) return `/verification/profile/${clientId}`;
  if (page === 'verification-transactions' && clientCode) return `/verification/transactions/${encodeURIComponent(clientCode)}`;
  if (page === 'verification-unpaid' && clientCode) return `/verification/unpaid/${encodeURIComponent(clientCode)}`;
  if (page === 'user-profile') return '/user/profile';
  if (page === 'user-home') return '/user/home';
  if (page === 'user-reports') return '/user/reports';
  if (page === 'user-history') return '/user/history';
  return '/auth/login';
}

function resolvePageFromPath(rawPath: string): RouteInfo {
  const path =
    rawPath.endsWith('/') && rawPath.length > 1 ? rawPath.slice(0, -1) : rawPath;

  const flightMatch = path.match(/\/flights\/([^/]+)/);
  const flightName = flightMatch ? decodeURIComponent(flightMatch[1]) : undefined;

  const clientEditMatch = path.match(/\/client\/edit\/(\d+)/);
  const clientEditId = clientEditMatch ? parseInt(clientEditMatch[1], 10) : undefined;

  const verificationProfileMatch = path.match(/\/verification\/profile\/(\d+)/);
  const verificationClientId = verificationProfileMatch
    ? parseInt(verificationProfileMatch[1], 10)
    : undefined;

  const verificationTransactionsMatch = path.match(/\/verification\/transactions\/([^/]+)/);
  const transactionsClientCode = verificationTransactionsMatch
    ? decodeURIComponent(verificationTransactionsMatch[1])
    : undefined;

  const verificationUnpaidMatch = path.match(/\/verification\/unpaid\/([^/]+)/);
  const unpaidClientCode = verificationUnpaidMatch
    ? decodeURIComponent(verificationUnpaidMatch[1])
    : undefined;

  if (path === '/auth/register') return { page: 'register' };
  if (path === '/import') return { page: 'import' };
  if (path === '/client/add') return { page: 'client-add' };
  if (path.startsWith('/client/edit/') && clientEditId) return { page: 'client-edit', clientId: clientEditId };
  if (path === '/flights') return { page: 'flights' };
  if (path === '/statistics') return { page: 'statistics' };
  if (flightName && path.includes('/photos/add')) return { page: 'cargo-add', flightName };
  if (flightName && path.includes('/photos')) return { page: 'cargo-list', flightName };
  if (path === '/verification' || path === '/verification/search') return { page: 'verification-search' };
  if (path.startsWith('/verification/profile/') && verificationClientId) return { page: 'verification-profile', clientId: verificationClientId };
  if (path.startsWith('/verification/transactions/') && transactionsClientCode) return { page: 'verification-transactions', clientCode: transactionsClientCode };
  if (path.startsWith('/verification/unpaid/') && unpaidClientCode) return { page: 'verification-unpaid', clientCode: unpaidClientCode };
  if (path === '/user/profile') return { page: 'user-profile' };
  if (path === '/user/home') return { page: 'user-home' };
  if (path === '/user/reports') return { page: 'user-reports' };
  if (path === '/user/history') return { page: 'user-history' };

  return { page: 'login' };
}

// ─── App ──────────────────────────────────────────────────────────────────────

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [selectedFlightName, setSelectedFlightName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(0);
  const [selectedClientCode, setSelectedClientCode] = useState('');
  const [passportModalOpen, setPassportModalOpen] = useState(false);
  const [passportClientId, setPassportClientId] = useState<number | null>(null);

  const [userRole, setUserRole] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // ── Core routing ─────────────────────────────────────────────────────────

  /**
   * Single place that validates access and updates URL + React state together.
   * Always pass `role` explicitly — never rely on stale closure state.
   */
  const applyRoute = useCallback(
    (
      routeInfo: RouteInfo,
      role: string | null,
      method: 'push' | 'replace' = 'replace',
    ) => {
      let { page, flightName, clientId, clientCode } = routeInfo;

      const finalPage = checkAccess(page, role);

      if (finalPage !== page) {
        // Access denied — strip params belonging to the blocked page
        page = finalPage;
        flightName = undefined;
        clientId = undefined;
        clientCode = undefined;
      }

      const path = getPathForPage(page, flightName, clientId, clientCode);

      if (method === 'push') {
        window.history.pushState({ page, flightName, clientId, clientCode }, '', path);
      } else {
        window.history.replaceState({ page, flightName, clientId, clientCode }, '', path);
      }

      setCurrentPage(page);
      if (flightName !== undefined) setSelectedFlightName(flightName);
      if (clientId !== undefined) setSelectedClientId(clientId);
      if (clientCode !== undefined) setSelectedClientCode(clientCode);
    },
    [],
  );
  const handleLogout = useCallback(() => {
      setUserRole(null);
      applyRoute({ page: 'login' }, null, 'replace');
  }, [applyRoute]);
  // ── Initial auth check (runs once on mount) ──────────────────────────────
  useEffect(() => {
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [handleLogout]);
  
  useEffect(() => {
    let cancelled = false;

    const verifyAuth = async () => {
      const token = sessionStorage.getItem('access_token');
      const currentRouteInfo = resolvePageFromPath(window.location.pathname);

      if (!token) {
        if (!cancelled) {
          setUserRole(null);
          setIsCheckingAuth(false);

          // If bot opened a protected URL (e.g. /user/home), save it so we can
          // redirect there after a successful login.
          if (!isGuestPage(currentRouteInfo.page) && currentRouteInfo.page !== 'login') {
            sessionStorage.setItem('intended_path', window.location.pathname);
          }

          applyRoute(currentRouteInfo, null, 'replace');
        }
        return;
      }

      try {
        const userData = await fetchAuthMe();
        if (!cancelled) {
          const role = userData.role ?? 'user';
          setUserRole(role);
          setIsCheckingAuth(false);
          // Token still valid → honour the current URL with the real role
          applyRoute(currentRouteInfo, role, 'replace');
        }
      } catch {
        if (!cancelled) {
          sessionStorage.removeItem('access_token');
          setUserRole(null);
          setIsCheckingAuth(false);
          applyRoute({ page: 'login' }, null, 'replace');
        }
      }
    };

    verifyAuth();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once

  // ── Browser back / forward ───────────────────────────────────────────────

  useEffect(() => {
    const handlePopState = () => {
      applyRoute(resolvePageFromPath(window.location.pathname), userRole, 'replace');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [userRole, applyRoute]);

  // ── Programmatic navigation ──────────────────────────────────────────────

  const navigateToPage = useCallback(
    (page: Page, flightName?: string, clientId?: number, clientCode?: string) => {
      applyRoute({ page, flightName, clientId, clientCode }, userRole, 'push');
    },
    [userRole, applyRoute],
  );

  // ── Login success ────────────────────────────────────────────────────────

  const handleLoginSuccess = useCallback(
    (role: string) => {
      setUserRole(role);
      setIsCheckingAuth(false);

      // Check if bot had opened a specific URL before login was required.
      // If the role allows that page → go there. Otherwise → role default.
      const intendedPath = sessionStorage.getItem('intended_path');
      sessionStorage.removeItem('intended_path');

      const intendedRoute = intendedPath
        ? resolvePageFromPath(intendedPath)
        : null;

      const targetPage = intendedRoute
        ? checkAccess(intendedRoute.page, role)
        : getDefaultPageForRole(role);

      const finalRoute: RouteInfo =
        intendedRoute && targetPage === intendedRoute.page
          ? intendedRoute          // intended page is allowed → use it with its params
          : { page: targetPage };  // fallback to role default

      applyRoute(finalRoute, role, 'replace');
    },
    [applyRoute],
  );

  // ── Passport modal ───────────────────────────────────────────────────────

  const handleViewPassportImages = (clientId: number) => {
    setPassportClientId(clientId);
    setPassportModalOpen(true);
  };

  // ── Derived flags ────────────────────────────────────────────────────────

  const isVerificationPage = [
    'verification-search',
    'verification-profile',
    'verification-transactions',
    'verification-unpaid',
  ].includes(currentPage);

  const isUserPages = [
    'user-profile',
    'user-home',
    'user-reports',
    'user-history',
  ].includes(currentPage);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 dark:from-[#0d0a04] dark:via-[#1a1612] dark:to-[#0d0a04] relative overflow-hidden transition-colors duration-300">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-300/20 dark:bg-orange-500/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-40 right-10 w-96 h-96 bg-amber-300/20 dark:bg-amber-500/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-20 left-1/2 w-80 h-80 bg-orange-200/20 dark:bg-orange-400/10 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      <NavigationBar
        onStatisticsClick={() => navigateToPage('statistics')}
        onVerificationClick={() => navigateToPage('verification-search')}
        currentPage={currentPage}
      />

      {isVerificationPage && (
        <VerificationNav
          currentPage={currentPage as VerificationPage}
          onNavigate={(page) =>
            navigateToPage(page as Page, undefined, selectedClientId, selectedClientCode)
          }
          clientCode={selectedClientCode}
          clientId={selectedClientId}
        />
      )}

      {isUserPages && (
        <UserNav
          currentPage={currentPage}
          onNavigate={(page) => navigateToPage(page as Page)}
        />
      )}

      {isCheckingAuth ? (
        <div className="flex h-[60vh] items-center justify-center">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <main
          className={`relative ${
            isUserPages ? 'pb-0 md:pb-0 pt-0' : 'pb-12 pt-24'
          } transition-all duration-300 ${isVerificationPage ? 'pt-24 md:pt-48' : ''}`}
        >
          {currentPage === 'login' && (
            <LoginForm
              onNavigateToRegister={() => navigateToPage('register')}
              onLoginSuccess={handleLoginSuccess}
            />
          )}

          {currentPage === 'register' && (
            <RegistrationForm onNavigateToLogin={() => navigateToPage('login')} />
          )}

          {currentPage === 'import' && <ImportPage />}

          {currentPage === 'client-add' && <ClientForm mode="add" />}

          {currentPage === 'client-edit' && (
            <ClientForm
              mode="edit"
              clientId={resolvePageFromPath(window.location.pathname).clientId}
            />
          )}

          {currentPage === 'flights' && (
            <FlightsPage
              onSelectFlight={(flightName) => navigateToPage('cargo-list', flightName)}
            />
          )}

          {currentPage === 'cargo-list' && selectedFlightName && (
            <CargoListPage
              flightName={selectedFlightName}
              onBack={() => navigateToPage('flights')}
              onAddCargo={() => navigateToPage('cargo-add', selectedFlightName)}
            />
          )}

          {currentPage === 'cargo-add' && selectedFlightName && (
            <AddCargoForm
              flightName={selectedFlightName}
              onBack={() => navigateToPage('cargo-list', selectedFlightName)}
              onSuccess={() => navigateToPage('cargo-list', selectedFlightName)}
            />
          )}

          {currentPage === 'statistics' && (
            <StatisticsDashboard onBack={() => navigateToPage('flights')} />
          )}

          {currentPage === 'verification-search' && (
            <ClientSearchPage
              onSelectClient={(clientId, clientCode) => {
                setSelectedClientId(clientId);
                setSelectedClientCode(clientCode);
                navigateToPage('verification-profile', undefined, clientId, clientCode);
              }}
            />
          )}

          {currentPage === 'verification-profile' && selectedClientId > 0 && (
            <ClientProfilePage
              clientId={selectedClientId}
              onBack={() => {
                setSelectedClientId(0);
                setSelectedClientCode('');
                navigateToPage('verification-search');
              }}
              onViewTransactions={(clientCode) => {
                setSelectedClientCode(clientCode);
                navigateToPage('verification-transactions', undefined, selectedClientId, clientCode);
              }}
              onViewUnpaidCargo={(clientCode) => {
                setSelectedClientCode(clientCode);
                navigateToPage('verification-unpaid', undefined, selectedClientId, clientCode);
              }}
              onViewPassportImages={handleViewPassportImages}
            />
          )}

          {currentPage === 'verification-transactions' && selectedClientCode && (
            <TransactionsPage
              clientCode={selectedClientCode}
              client_id={selectedClientId}
              onBack={() =>
                navigateToPage(
                  'verification-profile',
                  undefined,
                  selectedClientId || undefined,
                  selectedClientCode,
                )
              }
            />
          )}

          {currentPage === 'verification-unpaid' && selectedClientCode && (
            <UnpaidCargoPage
              clientCode={selectedClientCode}
              clientId={selectedClientId}
              onBack={() =>
                navigateToPage(
                  'verification-profile',
                  undefined,
                  selectedClientId || undefined,
                  selectedClientCode,
                )
              }
            />
          )}

          {currentPage === 'user-profile' && <UserPage onLogout={handleLogout}/>}

          {currentPage === 'user-home' && (
            <UserHome
              onNavigateToReports={() => navigateToPage('user-reports')}
              onNavigateToHistory={() => navigateToPage('user-history')}
            />
          )}

          {currentPage === 'user-reports' && <UserReportsPage />}

          {currentPage === 'user-history' && (
            <UserHistoryPage onBack={() => navigateToPage('user-home')} />
          )}
        </main>
      )}

      <Toaster />

      <PassportImagesModal
        isOpen={passportModalOpen}
        onClose={() => setPassportModalOpen(false)}
        clientId={passportClientId}
      />
    </div>
  );
}

export default function App() {
  return (
    <TelegramWebAppGuard>
      <AppContent />
    </TelegramWebAppGuard>
  );
}