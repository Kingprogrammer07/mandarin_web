import "./i18n/config";

import { useState, useEffect, useCallback, lazy, Suspense, useTransition } from "react";

import NavigationBar from "./components/NavigationBar";
import AdminLayout from "./components/admin/AdminLayout";
import TelegramWebAppGuard from "./components/TelegramWebAppGuard";
import { UserNav } from "./components/navigation/UserNav";
import { Toaster } from "sonner";
import { installGlobalErrorHandlers } from "./api/services/frontendErrors";
import { fetchAuthMe, isRequestCanceled } from "./api/services/auth";
import { getAdminJwtClaims } from "./api/services/adminManagement";
import { TopProgressBar } from "./components/ui/TopProgressBar";
import { Skeleton } from "./components/ui/skeleton";

const RegistrationForm = lazy(() => import("./components/RegistrationForm"));
const LoginForm = lazy(() => import("./components/LoginForm"));
const AdminLoginForm = lazy(() => import("./components/AdminLoginForm"));
const AdminAccountsPage = lazy(() => import("./pages/admin/AdminAccountsPage"));
const AdminRolesPage = lazy(() => import("./pages/admin/AdminRolesPage"));
const AdminProfilePage = lazy(() => import("./pages/admin/AdminProfilePage"));
const AdminAuditLogsPage = lazy(() => import("./pages/admin/AdminAuditLogsPage"));
const AdminCarouselPage = lazy(() => import("./pages/admin/AdminCarouselPage"));
const FlightScheduleAdminPage = lazy(() => import("./pages/admin/FlightScheduleAdminPage"));
const POSDashboard = lazy(() => import("./pages/pos/POSDashboard"));
const ImportPage = lazy(() => import("./pages/shared/ImportPage"));
const ClientForm = lazy(() => import("./pages/shared/ClientForm"));
const FlightsPage = lazy(() => import("./pages/worker/FlightsPage"));
const CargoListPage = lazy(() => import("./pages/worker/CargoListPage"));
const AddCargoForm = lazy(() => import("./pages/worker/AddCargoForm"));
const StatisticsDashboard = lazy(() => import("./pages/shared/StatisticsDashboard"));
const UserPage = lazy(() => import("./pages/user/UserPage"));
const UserHome = lazy(() => import("./pages/user/UserHome"));
const UserReportsPage = lazy(() => import("./pages/user/UserReportsPage"));
const UserHistoryPage = lazy(() => import("./pages/user/UserHistoryPage"));
const ManagerPage = lazy(() => import("./pages/admin/ManagerPage"));
const PasskeyPage = lazy(() => import("./pages/admin/PasskeyPage"));
const WarehousePage = lazy(() => import("./pages/admin/WarehousePage"));
const ExpectedCargoPage = lazy(() => import("./pages/admin/ExpectedCargoPage"));
const PickupQueueTVPage = lazy(() => import("./pages/shared/PickupQueueTVPage"));
const AdminDeliveryRequestPage = lazy(() => import("./pages/admin/AdminDeliveryRequestPage"));
const FlightNotificationPage = lazy(() => import("./pages/admin/FlightNotificationPage"));

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
  | "expected-cargo"
  | "flight-schedule-admin"
  | "pickup-tv"
  | "admin-delivery-request"
  | "admin-flight-notifications";

interface RouteInfo {
  page: Page;
  flightName?: string;
  clientId?: number;
}

// ─── Role Config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { default: Page; allowed: Page[] }> = {
  user: {
    default: "user-home",
    allowed: ["user-home", "user-profile", "user-history", "user-reports"],
  },
  worker: {
    default: "flights",
    allowed: ["flights", "cargo-list", "cargo-add", "passkey-page", "expected-cargo", "admin-flight-notifications"],
  },
  accountant: {
    default: "pos-dashboard",
    allowed: [
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
      "flight-schedule-admin",
      "manager-page",
      "pickup-tv",
      "admin-delivery-request",
      "admin-flight-notifications",
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
      "flight-schedule-admin",
      "pickup-tv",
      "admin-delivery-request",
      "admin-flight-notifications",
    ],
  },
  manager: {
    default: "manager-page",
    // admin-carousel is gated by JWT permission (carousel:read) checked in ManagerPage UI;
    // flight-schedule-admin is gated by JWT permission (flight_schedule:manage) in the page UI;
    // adding them here only unlocks the route — the backend enforces actual authorization.
    allowed: ["manager-page", "admin-carousel", "admin-profile", "passkey-page", "flight-schedule-admin", "admin-delivery-request"],
  },
  warehouse_worker: {
    default: "warehouse-page",
    allowed: ["warehouse-page", "expected-cargo", "admin-profile", "passkey-page"],
  },
  warehouse: {
    default: "warehouse-page",
    allowed: ["warehouse-page", "expected-cargo", "admin-profile", "passkey-page", "admin-flight-notifications"],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GUEST_PAGES: Page[] = ["login", "admin-login", "register"];
const USER_PAGES: Page[] = ["user-profile", "user-home", "user-reports", "user-history"];
const PUBLIC_PAGES: Page[] = ["pickup-tv"];

function isGuestPage(page: Page): boolean {
  return GUEST_PAGES.includes(page);
}

function isPublicPage(page: Page): boolean {
  return PUBLIC_PAGES.includes(page);
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
  if (isPublicPage(targetPage)) return targetPage;

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
  if (page === "flight-schedule-admin") return "/admin/flight-schedule";
  if (page === "admin-delivery-request") return "/admin/delivery-request";
  if (page === "pickup-tv") return "/pickup-tv";
  if (page === "admin-flight-notifications" && flightName)
    return `/flights/${encodeURIComponent(flightName)}/notifications`;
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

  if (path === "/auth/register") return { page: "register" };
  if (path === "/admin/login") return { page: "admin-login" };
  if (path === "/import") return { page: "import" };
  if (path === "/client/add") return { page: "client-add" };
  if (path.startsWith("/client/edit/") && clientEditId)
    return { page: "client-edit", clientId: clientEditId };
  if (path === "/flights") return { page: "flights" };
  if (path === "/statistics") return { page: "statistics" };
  if (flightName && path.includes("/notifications"))
    return { page: "admin-flight-notifications", flightName };
  if (flightName && path.includes("/photos/add"))
    return { page: "cargo-add", flightName };
  if (flightName && path.includes("/photos"))
    return { page: "cargo-list", flightName };
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
  if (path === "/admin/flight-schedule") return { page: "flight-schedule-admin" };
  if (path === "/pos") return { page: "pos-dashboard" };
  if (path === "/pickup-tv") return { page: "pickup-tv" };

  return { page: "login" };
}

// ─── App ──────────────────────────────────────────────────────────────────────

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>("login");
  const [selectedFlightName, setSelectedFlightName] = useState("");
  const [isTransitioning, startTransition] = useTransition();

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
      let { page, flightName, clientId } = routeInfo;

      const finalPage = checkAccess(page, role);

      if (finalPage !== page) {
        // Access denied — strip params belonging to the blocked page
        page = finalPage;
        flightName = undefined;
        clientId = undefined;
      }

      const path = getPathForPage(page, flightName, clientId);

      // Preserve existing query params (e.g. ?tab=request) from the current URL
      const currentParams = window.location.search;
      const url = currentParams ? `${path}${currentParams}` : path;

      if (method === "push") {
        window.history.pushState(
          { page, flightName, clientId },
          "",
          url,
        );
      } else {
        window.history.replaceState(
          { page, flightName, clientId },
          "",
          url,
        );
      }

      // startTransition keeps the current page visible while the lazy chunk loads,
      // eliminating the blank-screen flash between route changes.
      startTransition(() => {
        setCurrentPage(page);
        if (flightName !== undefined) setSelectedFlightName(flightName);
      });
    },
    // startTransition is stable — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const handleLogout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("admin_role");
    sessionStorage.removeItem("access_token");
    setUserRole(null);

    const currentRouteInfo = resolvePageFromPath(window.location.pathname);
    if (isPublicPage(currentRouteInfo.page)) {
      applyRoute(currentRouteInfo, null, "replace");
      return;
    }

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
      if (isPublicPage(currentRouteInfo.page)) {
        if (!cancelled) {
          const publicRouteRole = adminToken && adminRole ? adminRole : null;
          setUserRole(publicRouteRole);
          setIsCheckingAuth(false);
          applyRoute(currentRouteInfo, publicRouteRole, "replace");
        }
        return;
      }

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
      } catch (error) {
        if (!cancelled) {
          if (isRequestCanceled(error)) {
            // Do not trap users behind the auth spinner when /auth/me is slow.
            // The next protected API call will still validate the token and
            // trigger the global 401 logout flow if the session is invalid.
            const fallbackRole = "user";
            setUserRole(fallbackRole);
            setIsCheckingAuth(false);
            applyRoute(currentRouteInfo, fallbackRole, "replace");
          } else {
            sessionStorage.removeItem("access_token");
            setUserRole(null);
            setIsCheckingAuth(false);
            applyRoute({ page: "login" }, null, "replace");
          }
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
    ) => {
      applyRoute({ page, flightName, clientId }, userRole, "push");
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

  // ── Derived flags ────────────────────────────────────────────────────────

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
    "flight-schedule-admin",
    "admin-delivery-request",
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
    isWarehousePage || isExpectedCargoPage || currentPage === "pickup-tv";

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
    {/* Fixed progress bar: shows during auth check, lazy-page transitions, and Suspense fallback */}
    {(isTransitioning || isCheckingAuth) && <TopProgressBar />}
    <div
      className={`min-h-screen relative overflow-hidden transition-colors duration-300 ${
        isAdminArea
          ? "bg-[#f5f5f4] dark:bg-[#09090b]"
          : "bg-[#f8fafc] dark:bg-[#06080d]"
      }`}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {!isAdminArea && (
          <>
            <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,rgba(255,138,31,0.18),rgba(249,115,22,0.07)_38%,transparent_72%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,138,31,0.20),rgba(249,115,22,0.08)_38%,transparent_72%)]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-300/70 to-transparent dark:via-orange-200/55" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.55),transparent_24%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent_28%)]" />
          </>
        )}
      </div>

      {!isAdminArea && (
        <>
          <NavigationBar
            onStatisticsClick={() => navigateToPage("statistics")}
            currentPage={currentPage}
          />

          {isUserPages && (
            <UserNav
              currentPage={currentPage}
              onNavigate={(page) => navigateToPage(page as Page)}
            />
          )}
        </>
      )}

      {isCheckingAuth ? (
        <div className="pt-24 px-4 space-y-4 max-w-lg mx-auto animate-in fade-in duration-300">
          <Skeleton className="h-10 w-1/3 rounded-xl" />
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-32 w-3/4 rounded-3xl" />
        </div>
      ) : (
      <Suspense fallback={<TopProgressBar />}>
      {/* Pages rendered here: isSuperAdminPages first branch */}
      {isSuperAdminPages && canAccessAdminPanel ? (
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
          {currentPage === "flight-schedule-admin" && <FlightScheduleAdminPage />}
          {currentPage === "admin-delivery-request" && <AdminDeliveryRequestPage />}
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
          {currentPage === "flight-schedule-admin" && (
            <FlightScheduleAdminPage
              onBack={() => navigateToPage(getDefaultPageForRole(userRole!) as Page)}
            />
          )}
          {currentPage === "admin-delivery-request" && (
            <AdminDeliveryRequestPage />
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
      ) : currentPage === "pickup-tv" ? (
        <PickupQueueTVPage />
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
          } transition-all duration-300`}
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
              onNavigateToNotifications={() =>
                navigateToPage("admin-flight-notifications", selectedFlightName)
              }
              onLogout={handleLogout}
            />
          )}

          {currentPage === "admin-flight-notifications" && selectedFlightName && (
            <FlightNotificationPage
              flightName={selectedFlightName}
              onBack={() => navigateToPage("cargo-list", selectedFlightName)}
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

          {currentPage === "user-profile" && (
            <UserPage onLogout={handleLogout} />
          )}

          {currentPage === "user-home" && (
            <UserHome
              onNavigateToReports={() => navigateToPage("user-reports")}
              onNavigateToHistory={() => navigateToPage("user-history")}
            />
          )}

          {currentPage === "user-reports" && (
            <UserReportsPage
              onBack={() => navigateToPage("user-home")}
              onNavigateToDelivery={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("tab", "request");
                window.history.replaceState({}, "", url.toString());
                navigateToPage("user-home");
              }}
            />
          )}

          {currentPage === "user-history" && (
            <UserHistoryPage onBack={() => navigateToPage("user-home")} />
          )}
        </main>
      )}
      </Suspense>
      )}

      <Toaster position="top-center" richColors />
    </div>
    </>
  );
}

export default function App() {
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  return (
    <TelegramWebAppGuard>
      <AppContent />
    </TelegramWebAppGuard>
  );
}
