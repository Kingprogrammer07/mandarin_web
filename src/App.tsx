import './i18n/config';
<<<<<<< HEAD
import { useState, useEffect, useCallback } from 'react';
=======
import { useState, useEffect } from 'react';
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
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

// Consolidate Page type. Ideally this should be in a types file.
// For now, we match what is in VerificationNav and UserNav.
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

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [selectedFlightName, setSelectedFlightName] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<number>(0);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('');
  const [passportModalOpen, setPassportModalOpen] = useState(false);
  const [passportClientId, setPassportClientId] = useState<number | null>(null);

  // Check if current page is part of verification module
  const isVerificationPage = [
    'verification-search',
    'verification-profile',
    'verification-transactions',
    'verification-unpaid'
  ].includes(currentPage);

  // Check if current page is part of user module
  const isUserPages = [
    'user-profile',
    'user-home',
    'user-reports',
    'user-history'
  ].includes(currentPage);

  const resolvePageFromPath = (path: string): RouteInfo => {
<<<<<<< HEAD
    const flightMatch = path.match(/\/flights\/([^/]+)/);
=======
    const flightMatch = path.match(/\/flights\/([^\/]+)/);
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
    const flightName = flightMatch ? decodeURIComponent(flightMatch[1]) : undefined;

    const clientMatch = path.match(/\/client\/edit\/(\d+)/);
    const clientId = clientMatch ? parseInt(clientMatch[1], 10) : undefined;

    const verificationProfileMatch = path.match(/\/verification\/profile\/(\d+)/);
    const verificationClientId = verificationProfileMatch ? parseInt(verificationProfileMatch[1], 10) : undefined;

<<<<<<< HEAD
    const verificationTransactionsMatch = path.match(/\/verification\/transactions\/([^/]+)/);
    const transactionsClientCode = verificationTransactionsMatch ? decodeURIComponent(verificationTransactionsMatch[1]) : undefined;

    const verificationUnpaidMatch = path.match(/\/verification\/unpaid\/([^/]+)/);
=======
    const verificationTransactionsMatch = path.match(/\/verification\/transactions\/([^\/]+)/);
    const transactionsClientCode = verificationTransactionsMatch ? decodeURIComponent(verificationTransactionsMatch[1]) : undefined;

    const verificationUnpaidMatch = path.match(/\/verification\/unpaid\/([^\/]+)/);
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
    const unpaidClientCode = verificationUnpaidMatch ? decodeURIComponent(verificationUnpaidMatch[1]) : undefined;

    if (path === '/auth/register') {
      return { page: 'register' };
    } else if (path === '/import') {
      return { page: 'import' };
    } else if (path === '/client/add') {
      return { page: 'client-add' };
    } else if (path.startsWith('/client/edit/')) {
      return { page: 'client-edit', clientId };
    } else if (path === '/flights') {
      return { page: 'flights' };
    } else if (path === '/statistics') {
      return { page: 'statistics' };
    } else if (path.includes('/photos/add') && flightName) {
      return { page: 'cargo-add', flightName };
    } else if (path.includes('/photos') && flightName) {
      return { page: 'cargo-list', flightName };
    } else if (path === '/verification' || path === '/verification/search') {
      return { page: 'verification-search' };
    } else if (path.startsWith('/verification/profile/') && verificationClientId) {
      return { page: 'verification-profile', clientId: verificationClientId };
    } else if (path.startsWith('/verification/transactions/') && transactionsClientCode) {
      return { page: 'verification-transactions', clientCode: transactionsClientCode };
    } else if (path.startsWith('/verification/unpaid/') && unpaidClientCode) {
      return { page: 'verification-unpaid', clientCode: unpaidClientCode };
    } else if (path === '/user/profile') {
      return { page: 'user-profile' };
    } else if (path === '/user/home') {
      return { page: 'user-home' };
    } else if (path === '/user/reports') {
      return { page: 'user-reports' };
    } else if (path === '/user/history') {
      return { page: 'user-history' };
    } else {
      return { page: 'login' };
    }
  };

  const getPathForPage = (page: Page, flightName?: string, clientId?: number, clientCode?: string): string => {
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
  };

<<<<<<< HEAD
  const applyRouteFromUrl = useCallback(() => {


=======
  const applyRouteFromUrl = () => {
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
    const routeInfo = resolvePageFromPath(window.location.pathname);
    setCurrentPage(routeInfo.page);
    if (routeInfo.flightName) {
      setSelectedFlightName(routeInfo.flightName);
    }
    if (routeInfo.clientId) {
      setSelectedClientId(routeInfo.clientId);
    }
    if (routeInfo.clientCode) {
      setSelectedClientCode(routeInfo.clientCode);
    }
<<<<<<< HEAD
  }, []);
=======
  };
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753

  const navigateToPage = (page: Page, flightName?: string, clientId?: number, clientCode?: string) => {
    const path = getPathForPage(page, flightName, clientId, clientCode);
    window.history.pushState({ page, flightName, clientId, clientCode }, '', path);
    setCurrentPage(page);
    if (flightName !== undefined) {
      setSelectedFlightName(flightName);
    }
    if (clientId !== undefined) {
      setSelectedClientId(clientId);
    }
    if (clientCode !== undefined) {
      setSelectedClientCode(clientCode);
    }
  };

  const getClientIdFromUrl = (): number | undefined => {
    const routeInfo = resolvePageFromPath(window.location.pathname);
    return routeInfo.clientId;
  };

  useEffect(() => {
<<<<<<< HEAD
    // Defer URL-driven state update to avoid cascading renders
    queueMicrotask(() => applyRouteFromUrl());
=======
    applyRouteFromUrl();
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753

    const handlePopState = () => {
      applyRouteFromUrl();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
<<<<<<< HEAD
  }, [applyRouteFromUrl]);
=======
  }, []);
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753

  const handleViewPassportImages = (clientId: number) => {
    setPassportClientId(clientId);
    setPassportModalOpen(true);
  };

  return (
    <TelegramWebAppGuard>
      {/* <> */}
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 dark:from-[#0d0a04] dark:via-[#1a1612] dark:to-[#0d0a04] relative overflow-hidden transition-colors duration-300">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-orange-300/20 dark:bg-orange-500/10 rounded-full blur-3xl animate-blob"></div>
          <div className="absolute top-40 right-10 w-96 h-96 bg-amber-300/20 dark:bg-amber-500/10 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-20 left-1/2 w-80 h-80 bg-orange-200/20 dark:bg-orange-400/10 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
        </div>

        <NavigationBar
          onStatisticsClick={() => navigateToPage('statistics')}
          onVerificationClick={() => navigateToPage('verification-search')}
        />

        {isVerificationPage && (
          <VerificationNav
            currentPage={currentPage as VerificationPage}
            onNavigate={(page) => navigateToPage(page as Page, undefined, selectedClientId, selectedClientCode)}
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

        <main className={`relative ${isUserPages ? 'pb-0 md:pb-0 pt-0' : 'pb-12 pt-24'} transition-all duration-300 ${isVerificationPage ? 'pt-24 md:pt-48' : ''}`}>
          {currentPage === 'login' && (
            <LoginForm
              onNavigateToRegister={() => navigateToPage('register')}
            />
          )}
          {currentPage === 'register' && (
            <RegistrationForm onNavigateToLogin={() => navigateToPage('login')} />
          )}
          {currentPage === 'import' && (
            <ImportPage />
          )}
          {currentPage === 'client-add' && (
            <ClientForm mode="add" />
          )}
          {currentPage === 'client-edit' && (
            <ClientForm mode="edit" clientId={getClientIdFromUrl()} />
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
            <StatisticsDashboard
              onBack={() => navigateToPage('flights')}
            />
          )}

          {/* Verification Pages */}
          {currentPage === 'verification-search' && (
            <ClientSearchPage
              onSelectClient={(clientId, clientCode) => {
                // Set both states and navigate with clientCode included
                setSelectedClientId(clientId);
                setSelectedClientCode(clientCode);
                navigateToPage('verification-profile', undefined, clientId, clientCode);
              }}
            />
          )}
          {currentPage === 'verification-profile' && selectedClientId && (
            <ClientProfilePage
              clientId={selectedClientId}
              onBack={() => {
                // Clear state when going back to search
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
              onBack={() => navigateToPage('verification-profile', undefined, selectedClientId || undefined, selectedClientCode)}
            />
          )}
          {currentPage === 'verification-unpaid' && selectedClientCode && (
            <UnpaidCargoPage
              clientCode={selectedClientCode}
              clientId={selectedClientId}
              onBack={() => navigateToPage('verification-profile', undefined, selectedClientId || undefined, selectedClientCode)}
            />
          )}

          {/* User Pages */}
          {currentPage === 'user-profile' && <UserPage />}
          {currentPage === 'user-home' && <UserHome />}
          {currentPage === 'user-reports' && <UserReportsPage />}
          {currentPage === 'user-history' && <div className="p-8 text-center text-gray-500">Tarix (Tez orada)</div>}
        </main>
        <Toaster />

        <PassportImagesModal
          isOpen={passportModalOpen}
          onClose={() => setPassportModalOpen(false)}
          clientId={passportClientId}
        />
      </div>
    </TelegramWebAppGuard>
    // </>
  );
}

export default App;
