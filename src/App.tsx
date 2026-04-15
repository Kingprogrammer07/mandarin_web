import "./i18n/config";

import { useState, useEffect, useCallback } from "react";

import NavigationBar from "./components/NavigationBar";
import {
  VerificationNav,
  type Page as VerificationPage,
} from "./components/navigation/VerificationNav";
import RegistrationForm from "./components/RegistrationForm";
import LoginForm from "./components/LoginForm";
import AdminLoginForm from "./components/AdminLoginForm";
import AdminLayout from "./components/admin/AdminLayout";
import AdminAccountsPage from "./pages/admin/AdminAccountsPage";
import AdminRolesPage from "./pages/admin/AdminRolesPage";
import AdminProfilePage from "./pages/admin/AdminProfilePage";
import AdminAuditLogsPage from "./pages/admin/AdminAuditLogsPage";
import AdminCarouselPage from "./pages/admin/AdminCarouselPage";
import POSDashboard from "./pages/POSDashboard";
import ImportPage from "./components/ImportPage";
import ClientForm from "./components/ClientForm";
import FlightsPage from "./components/FlightsPage";
import CargoListPage from "./components/CargoListPage";
import AddCargoForm from "./components/AddCargoForm";
import StatisticsDashboard from "./components/StatisticsDashboard";
import TelegramWebAppGuard from "./components/TelegramWebAppGuard";
import ClientSearchPage from "./pages/ClientSearchPage";
import ClientProfilePage from "./pages/ClientProfilePage";
import TransactionsPage from "./pages/TransactionsPage";
import UnpaidCargoPage from "./pages/UnpaidCargoPage";
import { PassportImagesModal } from "./components/verification/PassportImagesModal";
import UserPage from "./pages/UserPage";
import { UserNav } from "./components/navigation/UserNav";
import { Toaster } from "sonner";
import UserHome from "./pages/UserHome";
import UserReportsPage from "./pages/UserReportsPage";
import UserHistoryPage from "./pages/UserHistoryPage";
import { fetchAuthMe } from "./api/services/auth";
import { getAdminJwtClaims } from "./api/services/adminManagement";
import ManagerPage from "./pages/admin/ManagerPage";
import PasskeyPage from "./pages/admin/PasskeyPage";
import WarehousePage from "./pages/admin/WarehousePage";
import ExpectedCargoPage from "./pages/admin/ExpectedCargoPage";

// ─── Types ────────────────────────────────────────────────────────────────────

type Page =
  | "login"
  | "admin-login"
  | "register"
  | "import"
  | "client-add"
  | "client-edit"
  | "flights"
  | "cargo-list"
  | "cargo-add"
  | "statistics"
  | "verification-search"
  | "verification-profile"
  | "verification-transactions"
  | "verification-unpaid"
  | "user-profile"
  | "user-home"
  | "user-reports"
  | "user-history"
  | "admin-accounts"
  | "admin-roles"
  | "admin-audit"
  | "admin-profile"
  | "admin-carousel"
  | "pos-dashboard"
  | "manager-page"
  | "passkey-page"
  | "warehouse-page"
  | "expected-cargo";

interface RouteInfo {
  page: Page;
  flightName?: string;
  clientId?: number;
  clientCode?: string;
}

// ─── Role Config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { default: Page; allowed: Page[] }> = {
  user: {
    default: "user-home",
    allowed: ["user-home", "user-profile", "user-history", "user-reports"],
  },
  worker: {
    default: "flights",
    allowed: ["flights", "cargo-list", "cargo-add", "passkey-page", "expected-cargo"],
  },
  accountant: {
    default: "verification-search",
    allowed: [
      "verification-search",
      "verification-profile",
      "verification-transactions",
      "verification-unpaid",
      "pos-dashboard",
      "admin-profile",
      "passkey-page",
    ],
  },
  admin: {
    default: "admin-accounts",
    allowed: [
      "import",
      "client-add",
      "client-edit",
      "flights",
      "cargo-list",
      "cargo-add",
      "statistics",
      "verification-search",
      "verification-profile",
      "verification-transactions",
      "verification-unpaid",
      "user-home",
      "user-profile",
      "user-history",
      "user-reports",
      "admin-accounts",
      "admin-roles",
      "admin-audit",
      "admin-profile",
      "admin-carousel",
      "pos-dashboard",
      "warehouse-page",
      "expected-cargo",
      "passkey-page",
    ],
  },
  "super-admin": {
    default: "admin-accounts",
    allowed: [
      "import",
      "client-add",
      "client-edit",
      "flights",
      "cargo-list",
      "cargo-add",
      "statistics",
      "verification-search",
      "verification-profile",
      "verification-transactions",
      "verification-unpaid",
      "user-home",
      "user-profile",
      "user-history",
      "user-reports",
      "admin-accounts",
      "admin-roles",
      "admin-audit",
      "admin-profile",
      "admin-carousel",
      "pos-dashboard",
      "warehouse-page",
      "expected-cargo",
      "manager-page",
      "passkey-page",
    ],
  },
  manager: {
    default: "manager-page",
    // admin-carousel is gated by JWT permission (carousel:read) checked in ManagerPage UI;
    // adding it here only unlocks the route — the backend enforces actual authorization.
    allowed: ["manager-page", "admin-carousel", "admin-profile", "passkey-page"],
  },
  warehouse_worker: {
    default: "warehouse-page",
    allowed: ["warehouse-page", "expected-cargo", "admin-profile", "passkey-page"],
  },
  warehouse: {
    default: "warehouse-page",
    allowed: ["warehouse-page", "expected-cargo", "admin-profile", "passkey-page"],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GUEST_PAGES: Page[] = ["login", "admin-login", "register"];
const USER_PAGES: Page[] = ["user-profile", "user-home", "user-reports", "user-history"];

function isGuestPage(page: Page): boolean {
  return GUEST_PAGES.includes(page);
}

function getDefaultPageForRole(role: string): Page {
  // The backend JWT's home_page is always authoritative — it may differ from
  // the static ROLE_CONFIG default (e.g. accountant whose home_page is "/pos"
  // instead of "/verification/search").  ROLE_CONFIG is only a fallback for
  // when there is no token yet (e.g. during the login redirect itself).
  const claims = getAdminJwtClaims();
  if (claims.home_page) {
    const resolved = resolvePageFromPath(claims.home_page);
    if (!isGuestPage(resolved.page)) return resolved.page;
  }

  // No JWT or home_page missing — fall back to static config then admin-login.
  if (ROLE_CONFIG[role]) return ROLE_CONFIG[role].default;
  return "admin-login";
}

/**
 * Pure access-check function — no side effects.
 * Returns the page the user should actually land on.
 */
function checkAccess(targetPage: Page, role: string | null): Page {
  if (!role) {
    // Not logged in → only guest pages are accessible
    if (isGuestPage(targetPage)) return targetPage;
    // User pages go to regular login; all other (admin/worker) pages go to admin login
    return USER_PAGES.includes(targetPage) ? "login" : "admin-login";
  }
  if (isGuestPage(targetPage)) {
    // Already logged in → skip login/register, go to role default
    return getDefaultPageForRole(role);
  }

  // Known role: enforce whitelist from static config
  if (ROLE_CONFIG[role]) {
    const allowed = ROLE_CONFIG[role].allowed;
    return allowed.includes(targetPage) ? targetPage : getDefaultPageForRole(role);
  }

  // Custom/unknown role: the only guaranteed-allowed page is their home_page.
  // Redirect any other page back to it rather than to /auth/login (which is
  // only for unauthenticated users — a 403, not a 401, situation).
  return getDefaultPageForRole(role);
}

function getPathForPage(
  page: Page,
  flightName?: string,
  clientId?: number,
  clientCode?: string,
): string {
  if (page === "register") return "/auth/register";
  if (page === "admin-login") return "/admin/login";
  if (page === "import") return "/import";
  if (page === "client-add") return "/client/add";
  if (page === "client-edit" && clientId) return `/client/edit/${clientId}`;
  if (page === "flights") return "/flights";
  if (page === "statistics") return "/statistics";
  if (page === "cargo-list" && flightName)
    return `/flights/${encodeURIComponent(flightName)}/photos`;
  if (page === "cargo-add" && flightName)
    return `/flights/${encodeURIComponent(flightName)}/photos/add`;
  if (page === "verification-search") return "/verification/search";
  if (page === "verification-profile" && clientId)
    return `/verification/profile/${clientId}`;
  if (page === "verification-transactions" && clientCode)
    return `/verification/transactions/${encodeURIComponent(clientCode)}`;
  if (page === "verification-unpaid" && clientCode)
    return `/verification/unpaid/${encodeURIComponent(clientCode)}`;
  if (page === "user-profile") return "/user/profile";
  if (page === "user-home") return "/user/home";
  if (page === "user-reports") return "/user/reports";
  if (page === "user-history") return "/user/history";
  if (page === "admin-accounts") return "/admin/accounts";
  if (page === "admin-roles") return "/admin/roles";
  if (page === "admin-audit") return "/admin/audit";
  if (page === "admin-profile") return "/admin/profile";
  if (page === "admin-carousel") return "/admin/carousel";
  if (page === "manager-page") return "/admin/clients";
  if (page === "passkey-page") return "/admin/passkey";
  if (page === "warehouse-page") return "/admin/warehouse";
  if (page === "pos-dashboard") return "/pos";
  if (page === "expected-cargo") return "/admin/expected-cargo";
  return "/auth/login";
}

function resolvePageFromPath(rawPath: string): RouteInfo {
  const path =
    rawPath.endsWith("/") && rawPath.length > 1
      ? rawPath.slice(0, -1)
      : rawPath;

  const flightMatch = path.match(/\/flights\/([^/]+)/);
  const flightName = flightMatch
    ? decodeURIComponent(flightMatch[1])
    : undefined;

  const clientEditMatch = path.match(/\/client\/edit\/(\d+)/);
  const clientEditId = clientEditMatch
    ? parseInt(clientEditMatch[1], 10)
    : undefined;

  const verificationProfileMatch = path.match(/\/verification\/profile\/(\d+)/);
  const verificationClientId = verificationProfileMatch
    ? parseInt(verificationProfileMatch[1], 10)
    : undefined;

  const verificationTransactionsMatch = path.match(
    /\/verification\/transactions\/([^/]+)/,
  );
  const transactionsClientCode = verificationTransactionsMatch
    ? decodeURIComponent(verificationTransactionsMatch[1])
    : undefined;

  const verificationUnpaidMatch = path.match(/\/verification\/unpaid\/([^/]+)/);
  const unpaidClientCode = verificationUnpaidMatch
    ? decodeURIComponent(verificationUnpaidMatch[1])
    : undefined;

  if (path === "/auth/register") return { page: "register" };
  if (path === "/admin/login") return { page: "admin-login" };
  if (path === "/import") return { page: "import" };
  if (path === "/client/add") return { page: "client-add" };
  if (path.startsWith("/client/edit/") && clientEditId)
    return { page: "client-edit", clientId: clientEditId };
  if (path === "/flights") return { page: "flights" };
  if (path === "/statistics") return { page: "statistics" };
  if (flightName && path.includes("/photos/add"))
    return { page: "cargo-add", flightName };
  if (flightName && path.includes("/photos"))
    return { page: "cargo-list", flightName };
  if (path === "/verification" || path === "/verification/search")
    return { page: "verification-search" };
  if (path.startsWith("/verification/profile/") && verificationClientId)
    return { page: "verification-profile", clientId: verificationClientId };
  if (path.startsWith("/verification/transactions/") && transactionsClientCode)
    return {
      page: "verification-transactions",
      clientCode: transactionsClientCode,
    };
  if (path.startsWith("/verification/unpaid/") && unpaidClientCode)
    return { page: "verification-unpaid", clientCode: unpaidClientCode };
  if (path === "/user/profile") return { page: "user-profile" };
  if (path === "/user/home") return { page: "user-home" };
  if (path === "/user/reports") return { page: "user-reports" };
  if (path === "/user/history") return { page: "user-history" };
  if (path === "/admin/accounts") return { page: "admin-accounts" };
  if (path === "/admin/roles") return { page: "admin-roles" };
  if (path === "/admin/audit") return { page: "admin-audit" };
  if (path === "/admin/profile") return { page: "admin-profile" };
  if (path === "/admin/carousel") return { page: "admin-carousel" };
  if (path === "/admin/clients") return { page: "manager-page" };
  if (path === "/admin/passkey") return { page: "passkey-page" };
  if (path === "/warehouse" || path === "/admin/warehouse") return { page: "warehouse-page" };
  if (path === "/admin/expected-cargo") return { page: "expected-cargo" };
  if (path === "/pos") return { page: "pos-dashboard" };

  return { page: "login" };
}

// ─── App ──────────────────────────────────────────────────────────────────────

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>("login");
  const [selectedFlightName, setSelectedFlightName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(0);
  const [selectedClientCode, setSelectedClientCode] = useState("");
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
      method: "push" | "replace" = "replace",
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

      // Preserve existing query params (e.g. ?tab=request) from the current URL
      const currentParams = window.location.search;
      const url = currentParams ? `${path}${currentParams}` : path;

      if (method === "push") {
        window.history.pushState(
          { page, flightName, clientId, clientCode },
          "",
          url,
        );
      } else {
        window.history.replaceState(
          { page, flightName, clientId, clientCode },
          "",
          url,
        );
      }

      setCurrentPage(page);
      if (flightName !== undefined) setSelectedFlightName(flightName);
      if (clientId !== undefined) setSelectedClientId(clientId);
      if (clientCode !== undefined) setSelectedClientCode(clientCode);
    },
    [],
  );
  const handleLogout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("admin_role");
    sessionStorage.removeItem("access_token");
    setUserRole(null);

    const currentRouteInfo = resolvePageFromPath(window.location.pathname);
    const isUserRoute =
      USER_PAGES.includes(currentRouteInfo.page) ||
      currentRouteInfo.page === "login" ||
      currentRouteInfo.page === "register";

    applyRoute(
      { page: isUserRoute ? "login" : "admin-login" },
      null,
      "replace",
    );
  }, [applyRoute]);
  // ── Initial auth check (runs once on mount) ──────────────────────────────
  useEffect(() => {
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [handleLogout]);

  useEffect(() => {
    let cancelled = false;

    const verifyAuth = async () => {
      const adminToken = localStorage.getItem("access_token");
      const adminRole = localStorage.getItem("admin_role");
      const userToken = sessionStorage.getItem("access_token");
      const currentRouteInfo = resolvePageFromPath(window.location.pathname);

      // ── 1. Admin session (localStorage) ──────────────────────────────────
      // Admin tokens are issued by a separate auth system and are NOT accepted
      // by /auth/me. Calling it would always return 401 and log the admin out.
      // Token validity is instead proven on every real API call via
      // X-Admin-Authorization; a 401 there dispatches auth:logout automatically.
      // Any admin with a stored token is considered authenticated — the token's
      // validity is proven on every API call via X-Admin-Authorization.
      // Restricting by role name here locked out custom roles (e.g. "cashier").
      if (adminToken && adminRole) {
        if (!cancelled) {
          setUserRole(adminRole);
          setIsCheckingAuth(false);
          // On a guest/login page → send to the admin default; otherwise honour URL
          if (isGuestPage(currentRouteInfo.page)) {
            applyRoute({ page: getDefaultPageForRole(adminRole) }, adminRole, "replace");
          } else {
            applyRoute(currentRouteInfo, adminRole, "replace");
          }
        }
        return;
      }

      // ── 2. No user token either → guest ──────────────────────────────────
      if (!userToken) {
        if (!cancelled) {
          setUserRole(null);
          setIsCheckingAuth(false);

          // If the bot opened a protected URL, save it to redirect after login
          if (
            !isGuestPage(currentRouteInfo.page) &&
            currentRouteInfo.page !== "login"
          ) {
            sessionStorage.setItem("intended_path", window.location.pathname);
          }

          // checkAccess will route to the correct login page based on the target
          applyRoute(currentRouteInfo, null, "replace");
        }
        return;
      }

      // ── 3. Regular user session (sessionStorage) — validate with server ──
      try {
        const userData = await fetchAuthMe();
        if (!cancelled) {
          const role = userData.role ?? "user";
          setUserRole(role);
          setIsCheckingAuth(false);
          applyRoute(currentRouteInfo, role, "replace");
        }
      } catch {
        if (!cancelled) {
          sessionStorage.removeItem("access_token");
          setUserRole(null);
          setIsCheckingAuth(false);
          applyRoute({ page: "login" }, null, "replace");
        }
      }
    };

    verifyAuth();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once

  // ── Browser back / forward ───────────────────────────────────────────────

  useEffect(() => {
    const handlePopState = () => {
      applyRoute(
        resolvePageFromPath(window.location.pathname),
        userRole,
        "replace",
      );
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [userRole, applyRoute]);

  // ── Programmatic navigation ──────────────────────────────────────────────

  const navigateToPage = useCallback(
    (
      page: Page,
      flightName?: string,
      clientId?: number,
      clientCode?: string,
    ) => {
      applyRoute({ page, flightName, clientId, clientCode }, userRole, "push");
    },
    [userRole, applyRoute],
  );

  // ── Login success ────────────────────────────────────────────────────────

  const handleLoginSuccess = useCallback(
    (role: string) => {
      setUserRole(role);
      setIsCheckingAuth(false);

      // AdminLoginForm writes access_token to localStorage *before* calling this
      // callback, so getAdminJwtClaims() can read the freshly issued token here.
      const claims = getAdminJwtClaims();
      // Prefer the home_page encoded by the backend in the JWT — it is role-specific
      // and may differ from the static ROLE_CONFIG default (e.g. a super-admin
      // whose home_page is set to "/pos" rather than "/admin/accounts").
      const jwtHomePage = claims.home_page
        ? resolvePageFromPath(claims.home_page).page
        : null;

      // Check if the bot had opened a specific URL before login was required.
      // If the role allows that page → go there. Otherwise → JWT/role default.
      const intendedPath = sessionStorage.getItem("intended_path");
      sessionStorage.removeItem("intended_path");

      const intendedRoute = intendedPath
        ? resolvePageFromPath(intendedPath)
        : null;

      const targetPage = intendedRoute
        ? checkAccess(intendedRoute.page, role)
        : (jwtHomePage ?? getDefaultPageForRole(role));

      const finalRoute: RouteInfo =
        intendedRoute && targetPage === intendedRoute.page
          ? intendedRoute // intended page is allowed → use it with its params
          : { page: targetPage }; // fallback to JWT home_page / role default

      applyRoute(finalRoute, role, "replace");
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
    "verification-search",
    "verification-profile",
    "verification-transactions",
    "verification-unpaid",
  ].includes(currentPage);

  const isUserPages = [
    "user-profile",
    "user-home",
    "user-reports",
    "user-history",
  ].includes(currentPage);

  const isAdminLoginPage = currentPage === "admin-login";

  const isSuperAdminPages = [
    "admin-accounts",
    "admin-roles",
    "admin-audit",
    "admin-profile",
    "admin-carousel",
  ].includes(currentPage);

  // Only roles with admin-accounts (admin, super-admin) get the full AdminLayout shell.
  // All other roles that happen to have admin-* pages in their allowed list (manager →
  // admin-carousel, accountant/warehouse_worker → admin-profile) receive standalone views.
  const canAccessAdminPanel =
    userRole !== null &&
    (ROLE_CONFIG[userRole]?.allowed ?? []).includes("admin-accounts");

  // Non-admin role on a page that lives inside isSuperAdminPages → standalone render.
  const isStandaloneAdminSubpage =
    isSuperAdminPages &&
    !canAccessAdminPanel &&
    userRole !== null;

  const isPOSPage = currentPage === "pos-dashboard";
  const isManagerPage = currentPage === "manager-page";
  const isPasskeyPage = currentPage === "passkey-page";
  const isWarehousePage = currentPage === "warehouse-page";
  const isExpectedCargoPage = currentPage === "expected-cargo";
  const canAccessManagerPage =
    userRole !== null &&
    (ROLE_CONFIG[userRole]?.allowed ?? []).includes("manager-page");
  const canAccessWarehouse =
    userRole !== null &&
    (ROLE_CONFIG[userRole]?.allowed ?? []).includes("warehouse-page");
  const canAccessExpectedCargo =
    userRole !== null &&
    (ROLE_CONFIG[userRole]?.allowed ?? []).includes("expected-cargo");

  const isAdminArea =
    isSuperAdminPages || isAdminLoginPage || isPOSPage ||
    isManagerPage || isStandaloneAdminSubpage || isPasskeyPage ||
    isWarehousePage || isExpectedCargoPage;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className={`min-h-screen relative overflow-hidden transition-colors duration-300 ${
        isAdminArea
          ? "bg-[#f5f5f4] dark:bg-[#09090b]"
          : "bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 dark:from-[#0d0a04] dark:via-[#1a1612] dark:to-[#0d0a04]"
      }`}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-300/20 dark:bg-orange-500/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-40 right-10 w-96 h-96 bg-amber-300/20 dark:bg-amber-500/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-20 left-1/2 w-80 h-80 bg-orange-200/20 dark:bg-orange-400/10 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      {!isAdminArea && (
        <>
          <NavigationBar
            onStatisticsClick={() => navigateToPage("statistics")}
            onVerificationClick={() => navigateToPage("verification-search")}
            currentPage={currentPage}
          />

          {isVerificationPage && (
            <VerificationNav
              currentPage={currentPage as VerificationPage}
              onNavigate={(page) =>
                navigateToPage(
                  page as Page,
                  undefined,
                  selectedClientId,
                  selectedClientCode,
                )
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
        </>
      )}

      {isCheckingAuth ? (
        <div className="flex h-[60vh] items-center justify-center">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isSuperAdminPages && canAccessAdminPanel ? (
        <AdminLayout
          currentPage={currentPage}
          onNavigate={(page) => navigateToPage(page as Page)}
          onLogout={handleLogout}
        >
          {currentPage === "admin-accounts" && <AdminAccountsPage />}
          {currentPage === "admin-roles" && <AdminRolesPage />}
          {currentPage === "admin-audit" && <AdminAuditLogsPage />}
          {currentPage === "admin-profile" && <AdminProfilePage />}
          {currentPage === "admin-carousel" && <AdminCarouselPage />}
        </AdminLayout>
      ) : isPOSPage ? (
        <POSDashboard
          onNavigate={(page) => navigateToPage(page as Page)}
          onLogout={handleLogout}
        />
      ) : isStandaloneAdminSubpage ? (
        // Non-admin roles on admin-* pages — render standalone without AdminLayout sidebar.
        // The back destination is the role's default home page.
        <>
          {currentPage === "admin-carousel" && (
            <AdminCarouselPage
              onBack={() => navigateToPage(getDefaultPageForRole(userRole!) as Page)}
            />
          )}
          {currentPage === "admin-profile" && (
            <AdminProfilePage
              onBack={() => navigateToPage(getDefaultPageForRole(userRole!) as Page)}
            />
          )}
        </>
      ) : isManagerPage && canAccessManagerPage ? (
        <ManagerPage
          onNavigate={(page) => navigateToPage(page as Page)}
          onLogout={handleLogout}
        />
      ) : isPasskeyPage ? (
        <PasskeyPage
          onNavigate={(page) => navigateToPage(page as Page)}
          onLogout={handleLogout}
        />
      ) : isWarehousePage && canAccessWarehouse ? (
        <WarehousePage
          onNavigate={(page) => navigateToPage(page as Page)}
          onLogout={handleLogout}
        />
      ) : isExpectedCargoPage && canAccessExpectedCargo ? (
        <ExpectedCargoPage
          onNavigate={(page) => navigateToPage(page as Page)}
          onLogout={handleLogout}
        />
      ) : (
        <main
          className={`relative ${
            isUserPages
              ? "pb-0 md:pb-0 pt-0"
              : isAdminLoginPage
                ? "p-0"
                : ["flights", "cargo-list", "cargo-add", "statistics"].includes(currentPage)
                  ? "pt-20 pb-20"   // NavigationBar clearance only — inner pages control their own spacing
                  : "pb-12 pt-24"
          } transition-all duration-300 ${isVerificationPage ? "pt-24 md:pt-48" : ""}`}
        >
          {currentPage === "login" && (
            <LoginForm
              onNavigateToRegister={() => navigateToPage("register")}
              onLoginSuccess={handleLoginSuccess}
            />
          )}

          {currentPage === "admin-login" && (
            <AdminLoginForm onAdminLoginSuccess={handleLoginSuccess} />
          )}

          {currentPage === "register" && (
            <RegistrationForm
              onNavigateToLogin={() => navigateToPage("login")}
            />
          )}

          {currentPage === "import" && <ImportPage />}

          {currentPage === "client-add" && <ClientForm mode="add" />}

          {currentPage === "client-edit" && (
            <ClientForm
              mode="edit"
              clientId={resolvePageFromPath(window.location.pathname).clientId}
            />
          )}

          {currentPage === "flights" && (
            <FlightsPage
              onSelectFlight={(flightName) =>
                navigateToPage("cargo-list", flightName)
              }
              onLogout={handleLogout}
              onNavigate={(page) => navigateToPage(page as Page)}
            />
          )}

          {currentPage === "cargo-list" && selectedFlightName && (
            <CargoListPage
              flightName={selectedFlightName}
              onBack={() => navigateToPage("flights")}
              onAddCargo={() => navigateToPage("cargo-add", selectedFlightName)}
              onLogout={handleLogout}
            />
          )}

          {currentPage === "cargo-add" && selectedFlightName && (
            <AddCargoForm
              flightName={selectedFlightName}
              onBack={() => navigateToPage("cargo-list", selectedFlightName)}
              onSuccess={() => navigateToPage("cargo-list", selectedFlightName)}
            />
          )}

          {currentPage === "statistics" && (
            <StatisticsDashboard onBack={() => window.history.back()} />
          )}

          {currentPage === "verification-search" && (
            <ClientSearchPage
              onSelectClient={(clientId, clientCode) => {
                setSelectedClientId(clientId);
                setSelectedClientCode(clientCode);
                navigateToPage(
                  "verification-profile",
                  undefined,
                  clientId,
                  clientCode,
                );
              }}
            />
          )}

          {currentPage === "verification-profile" && selectedClientId > 0 && (
            <ClientProfilePage
              clientId={selectedClientId}
              onBack={() => {
                setSelectedClientId(0);
                setSelectedClientCode("");
                navigateToPage("verification-search");
              }}
              onViewTransactions={(clientCode) => {
                setSelectedClientCode(clientCode);
                navigateToPage(
                  "verification-transactions",
                  undefined,
                  selectedClientId,
                  clientCode,
                );
              }}
              onViewUnpaidCargo={(clientCode) => {
                setSelectedClientCode(clientCode);
                navigateToPage(
                  "verification-unpaid",
                  undefined,
                  selectedClientId,
                  clientCode,
                );
              }}
              onViewPassportImages={handleViewPassportImages}
            />
          )}

          {currentPage === "verification-transactions" &&
            selectedClientCode && (
              <TransactionsPage
                clientCode={selectedClientCode}
                client_id={selectedClientId}
                onBack={() =>
                  navigateToPage(
                    "verification-profile",
                    undefined,
                    selectedClientId || undefined,
                    selectedClientCode,
                  )
                }
              />
            )}

          {currentPage === "verification-unpaid" && selectedClientCode && (
            <UnpaidCargoPage
              clientCode={selectedClientCode}
              clientId={selectedClientId}
              onBack={() =>
                navigateToPage(
                  "verification-profile",
                  undefined,
                  selectedClientId || undefined,
                  selectedClientCode,
                )
              }
            />
          )}

          {currentPage === "user-profile" && (
            <UserPage onLogout={handleLogout} />
          )}

          {currentPage === "user-home" && (
            <UserHome
              onNavigateToReports={() => navigateToPage("user-reports")}
              onNavigateToHistory={() => navigateToPage("user-history")}
            />
          )}

          {currentPage === "user-reports" && <UserReportsPage />}

          {currentPage === "user-history" && (
            <UserHistoryPage onBack={() => navigateToPage("user-home")} />
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
