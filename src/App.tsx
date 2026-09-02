import "./i18n/config";

import { useState, useEffect, useCallback, lazy, Suspense, useTransition } from "react";
import { useTranslation } from "react-i18next";

import NavigationBar from "./components/NavigationBar";
import TelegramWebAppGuard from "./components/TelegramWebAppGuard";
import { BottomNav, type BottomNavPage } from "./components/user/BottomNav";
import { Toaster } from "sonner";
import { installGlobalErrorHandlers } from "./api/services/frontendErrors";
import { fetchAuthMe, isRequestCanceled } from "./api/services/auth";
import { AstatkaPage } from "./pages/worker/AstatkaPage";
import { logoutAdmin } from "./api/services/adminAuth";
import { getAdminJwtClaims } from "./api/services/adminManagement";
import { TopProgressBar } from "./components/ui/TopProgressBar";
import StatusAnimation from "./components/StatusAnimation";
import { Skeleton } from "./components/ui/skeleton";
import MaintenancePage from "./components/MaintenancePage";
import { useHealthCheck } from "./hooks/useHealthCheck";
import { useVersionWatcher } from "./hooks/useVersionWatcher";
import { useMaintenanceWatcher } from "./hooks/useMaintenanceWatcher";
import { useGlobalEvents } from "./hooks/useGlobalEvents";
import { useMaintenanceStore } from "./store/useMaintenanceStore";
import { isPosPath } from "@/lib/posRoutes";
import { pickSession } from "@/lib/session";
import { setRouterDepth } from "@/lib/backStack";
import { TelegramBackBridge } from "@/components/TelegramBackBridge";
import { NbuPaymentWatch } from "@/components/payment/NbuPaymentWatch";

// Both of these pull `framer-motion` (122 kB raw / 40 kB gzip). Imported
// statically they sat in the entry chunk, so every client — who never renders
// an admin shell and rarely sees a maintenance screen — downloaded the whole
// animation library on first paint.
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const MaintenanceOverlay = lazy(() => import("./components/system/MaintenanceOverlay"));
const RegistrationForm = lazy(() => import("./components/RegistrationForm"));
const LoginForm = lazy(() => import("./components/LoginForm"));
const AdminLoginForm = lazy(() => import("./components/AdminLoginForm"));
const AdminAgreementModal = lazy(() => import("./components/admin/AdminAgreementModal"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminAccountsPage = lazy(() => import("./pages/admin/AdminAccountsPage"));
const AdminRolesPage = lazy(() => import("./pages/admin/AdminRolesPage"));
const AdminProfilePage = lazy(() => import("./pages/admin/AdminProfilePage"));
const AdminAuditLogsPage = lazy(() => import("./pages/admin/AdminAuditLogsPage"));
const AdminCarouselPage = lazy(() => import("./pages/admin/AdminCarouselPage"));
const FlightScheduleAdminPage = lazy(() => import("./pages/admin/FlightScheduleAdminPage"));
const POSDashboard = lazy(() => import("./pages/pos/POSDashboard"));
// Temporary route while the cashier console is rebuilt. `/pos` keeps
// running the old screen until this one is finished.
const CashierPage = lazy(() => import("./pages/pos/CashierPage"));
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
const ExpensesPage = lazy(() => import("./pages/admin/ExpensesPage"));
const PaymentNbuSuccess = lazy(() => import("./pages/payment/PaymentNbuSuccess"));
const PaymentNbuFailure = lazy(() => import("./pages/payment/PaymentNbuFailure"));
const SavedCardsPage = lazy(() => import("./pages/payment/SavedCardsPage"));
const ReferralPage = lazy(() => import("./pages/user/ReferralPage"));
const SystemSettingsPage = lazy(() => import("./pages/admin/SystemSettingsPage"));

// ─── Types ────────────────────────────────────────────────────────────────────

type Page =
  | "login"
  | "admin-login"
  | "register"
  | "import"
  | "client-add"
  | "client-edit"
  | "flights"
  | "astatka"
  | "cargo-list"
  | "cargo-add"
  | "statistics"
  | "user-profile"
  | "user-home"
  | "user-reports"
  | "user-history"
  | "user-referral"
  | "admin-dashboard"
  | "admin-accounts"
  | "admin-roles"
  | "admin-audit"
  | "admin-profile"
  | "admin-carousel"
  | "pos-dashboard"
  | "kassa"
  | "manager-page"
  | "passkey-page"
  | "warehouse-page"
  | "expected-cargo"
  | "flight-schedule-admin"
  | "pickup-tv"
  | "admin-delivery-request"
  | "admin-flight-notifications"
  | "admin-expenses"
  | "payment_nbu_success"
  | "payment_nbu_failure"
  | "saved_cards"
  | "system-settings";

interface RouteInfo {
  page: Page;
  flightName?: string;
  clientId?: number;
}

// ─── Role Config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { default: Page; allowed: Page[] }> = {
  user: {
    default: "user-home",
    allowed: ["user-home", "user-profile", "user-history", "user-reports", "saved_cards", "user-referral"],
  },
  worker: {
    default: "flights",
    allowed: ["flights", "astatka", "cargo-list", "cargo-add", "passkey-page", "expected-cargo", "admin-flight-notifications"],
  },
  accountant: {
    default: "pos-dashboard",
    allowed: [
      "pos-dashboard",
      "kassa",
      // The trial spreadsheet console. Reachable but not the default: the
      // cashier's day still starts on the screen that can take money.
      "admin-profile",
      "passkey-page",
      "admin-expenses",
    ],
  },
  admin: {
    default: "admin-dashboard",
    allowed: [
      "admin-dashboard",
      "import",
      "client-add",
      "client-edit",
      "flights",
      "astatka",
      "cargo-list",
      "cargo-add",
      "statistics",
      "user-home",
      "user-profile",
      "user-history",
      "user-reports",
      "user-referral",
      "admin-accounts",
      "admin-roles",
      "admin-audit",
      "admin-profile",
      "admin-carousel",
      "pos-dashboard",
      "kassa",
      "warehouse-page",
      "expected-cargo",
      "passkey-page",
      "flight-schedule-admin",
      "manager-page",
      "pickup-tv",
      "admin-delivery-request",
      "admin-flight-notifications",
      "admin-expenses",
      "saved_cards",
      "system-settings",
    ],
  },
  "super-admin": {
    // The super-admin role is created by scripts/seed_super_admin.py with no
    // `home_page`, so the JWT claim is null and this static default is what
    // actually decides where a login lands.
    default: "admin-dashboard",
    allowed: [
      "admin-dashboard",
      "import",
      "client-add",
      "client-edit",
      "flights",
      "astatka",
      "cargo-list",
      "cargo-add",
      "statistics",
      "user-home",
      "user-profile",
      "user-history",
      "user-reports",
      "user-referral",
      "admin-accounts",
      "admin-roles",
      "admin-audit",
      "admin-profile",
      "admin-carousel",
      "pos-dashboard",
      "kassa",
      "warehouse-page",
      "expected-cargo",
      "manager-page",
      "passkey-page",
      "flight-schedule-admin",
      "pickup-tv",
      "admin-delivery-request",
      "admin-flight-notifications",
      "admin-expenses",
      "saved_cards",
      "system-settings",
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
// Every page a client account can open. Used to pick which login screen an
// unauthenticated deep link lands on — `saved_cards` and `user-referral` were
// missing, so a logged-out client following either link met the ADMIN login.
const USER_PAGES: Page[] = [
  "user-profile",
  "user-home",
  "user-reports",
  "user-history",
  "saved_cards",
  "user-referral",
];
const PUBLIC_PAGES: Page[] = ["pickup-tv", "payment_nbu_success", "payment_nbu_failure"];

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
  if (page === "astatka") return "/astatka";
  if (page === "statistics") return "/statistics";
  if (page === "cargo-list" && flightName)
    return `/flights/${encodeURIComponent(flightName)}/photos`;
  if (page === "cargo-add" && flightName)
    return `/flights/${encodeURIComponent(flightName)}/photos/add`;
  if (page === "user-profile") return "/user/profile";
  if (page === "user-home") return "/user/home";
  if (page === "user-reports") return "/user/reports";
  if (page === "user-history") return "/user/history";
  if (page === "admin-dashboard") return "/admin/dashboard";
  if (page === "admin-accounts") return "/admin/accounts";
  if (page === "admin-roles") return "/admin/roles";
  if (page === "admin-audit") return "/admin/audit";
  if (page === "admin-profile") return "/admin/profile";
  if (page === "admin-carousel") return "/admin/carousel";
  if (page === "manager-page") return "/admin/clients";
  if (page === "passkey-page") return "/admin/passkey";
  if (page === "warehouse-page") return "/admin/warehouse";
  if (page === "pos-dashboard") return "/pos";
  if (page === "kassa") return "/kassa";
  if (page === "expected-cargo") return "/admin/expected-cargo";
  if (page === "flight-schedule-admin") return "/admin/flight-schedule";
  if (page === "admin-delivery-request") return "/admin/delivery-request";
  if (page === "pickup-tv") return "/pickup-tv";
  if (page === "admin-expenses") return "/admin/expenses";
  if (page === "system-settings") return "/admin/system-settings";
  if (page === "payment_nbu_success") return "/payment/nbu/success";
  if (page === "payment_nbu_failure") return "/payment/nbu/failure";
  if (page === "saved_cards") return "/payment/nbu/cards";
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
  if (path === "/astatka") return { page: "astatka" };
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
  if (path === "/user/referral") return { page: "user-referral" };
  // The super-admin role in production carries `home_page: "/admin"`, a path
  // nothing here matched — it fell through to `login`, was rejected as a guest
  // page, and only landed correctly because ROLE_CONFIG has the same default.
  // Mapping it makes the JWT claim mean what it says.
  if (path === "/admin" || path === "/admin/dashboard")
    return { page: "admin-dashboard" };
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
  if (path === "/kassa") return { page: "kassa" };
  if (path === "/admin/expenses") return { page: "admin-expenses" };
  if (path === "/pickup-tv") return { page: "pickup-tv" };
  if (path === "/payment/nbu/success") return { page: "payment_nbu_success" };
  if (path === "/payment/nbu/failure") return { page: "payment_nbu_failure" };
  if (path === "/payment/nbu/cards") return { page: "saved_cards" };
  if (path === "/admin/system-settings") return { page: "system-settings" };

  return { page: "login" };
}

// ─── App ──────────────────────────────────────────────────────────────────────

function AppContent() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState<Page>("login");
  const [selectedFlightName, setSelectedFlightName] = useState("");
  const [isTransitioning, startTransition] = useTransition();
  const [loginBootstrapStatus, setLoginBootstrapStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [loginBootstrapMessageIndex, setLoginBootstrapMessageIndex] = useState(0);

  const [userRole, setUserRole] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const isMaintenanceMode = useMaintenanceStore((s) => s.isMaintenanceMode);
  useHealthCheck();

  // Detect a newer frontend deploy and prompt the user to reload — covers
  // clients sitting on an already-loaded page that never trigger a chunk fetch.
  useVersionWatcher();

  // Single app-wide SSE connection that pushes real-time updates (wallet,
  // queue, notifications, maintenance, NBU) and drives React Query
  // invalidation — replaces the former per-resource polling.
  useGlobalEvents();

  const { isMaintenance, isAdmin: isMaintenanceAdmin } = useMaintenanceWatcher();

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

      // How deep this entry sits on top of the entry route, carried IN the
      // history entry rather than in a counter. A counter has to guess on
      // popstate — it can only decrement — so browser-forward, or any pushState
      // made outside this function, silently desynchronised it from reality.
      // The browser restores this value for us on every pop and every forward.
      const currentDepth = (window.history.state as { depth?: number } | null)?.depth ?? 0;
      const depth = method === "push" ? currentDepth + 1 : currentDepth;

      if (method === "push") {
        window.history.pushState({ page, flightName, clientId, depth }, "", url);
      } else {
        window.history.replaceState({ page, flightName, clientId, depth }, "", url);
      }
      setRouterDepth(depth);

      // startTransition keeps the current page visible while the lazy chunk loads,
      // eliminating the blank-screen flash between route changes.
      startTransition(() => {
        setCurrentPage(page);
        if (flightName !== undefined) setSelectedFlightName(flightName);
      });
    },
    // startTransition is stable — safe to omit from deps
    [],
  );
  const handleLogout = useCallback((event?: Event) => {
    // `scope` says which credential was rejected. Clearing both meant one
    // expired client token also signed a staff member out of the admin panel.
    // No scope (an unscoped dispatch) still clears everything.
    const scope = (event as CustomEvent<{ scope?: "admin" | "client" }> | undefined)
      ?.detail?.scope;
    if (scope !== "client") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("admin_role");
    }
    if (scope !== "admin") {
      sessionStorage.removeItem("access_token");
    }
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

  /**
   * The staff "Chiqish" button — a deliberate sign-out, not a rejected token.
   *
   * `handleLogout` only clears storage. That leaves the JWT valid server-side
   * for the rest of `API_JWT_EXPIRE_MINUTES` (8h in production), so signing off
   * a shared till handed the next person — or anyone holding a copy of the
   * token — a working staff session. `logoutAdmin` drops its `jti` into the
   * Redis blocklist that every staff request is checked against.
   *
   * Awaited, not fired and forgotten, and that ordering is load-bearing: the
   * axios interceptor attaches `X-Admin-Authorization` by reading
   * `localStorage` (client.ts, via `credentialForPath`). Clearing storage first
   * would send the revoke request with no credential, it would 401, and the
   * token would stay valid — a sign-out that looks like it worked and does
   * nothing, which is what we are fixing.
   *
   * The `finally` matters just as much. A failed or timed-out revoke must never
   * trap someone on the till screen; they are signed out locally either way and
   * the token then expires on its own schedule, exactly as it does today.
   */
  const handleSignOut = useCallback(async () => {
    try {
      if (localStorage.getItem("access_token")) {
        await logoutAdmin();
      }
    } catch (error) {
      // Best effort. Nothing to show the user: they asked to leave, and they
      // are about to.
      console.warn("Staff session could not be revoked server-side", error);
    } finally {
      handleLogout();
    }
  }, [handleLogout]);

  // ── Initial auth check (runs once on mount) ──────────────────────────────
  useEffect(() => {
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [handleLogout]);

  // Role switch issues a brand-new JWT with a different role. The switcher
  // can't reach this component's `userRole` state, so it broadcasts here.
  // Updating `userRole` (and the persisted `admin_role`) BEFORE navigating is
  // essential: `navigateToPage` validates the target against `userRole`, so a
  // stale role would bounce the new home page back to the old role's default
  // and render nothing. See RoleSwitcher.
  const handleRoleSwitched = useCallback(
    (event: Event) => {
      const detail = (event as CustomEvent<{ role: string; homePage: string | null }>).detail;
      const nextRole = detail?.role ?? localStorage.getItem("admin_role");
      if (!nextRole) return;

      localStorage.setItem("admin_role", nextRole);
      setUserRole(nextRole);

      const targetPage = detail?.homePage
        ? resolvePageFromPath(detail.homePage).page
        : getDefaultPageForRole(nextRole);
      applyRoute({ page: targetPage }, nextRole, "replace");
    },
    [applyRoute],
  );
  useEffect(() => {
    window.addEventListener("auth:role-switched", handleRoleSwitched);
    return () => window.removeEventListener("auth:role-switched", handleRoleSwitched);
  }, [handleRoleSwitched]);

  useEffect(() => {
    let cancelled = false;

    const verifyAuth = async () => {
      const adminToken = localStorage.getItem("access_token");
      const adminRole = localStorage.getItem("admin_role");
      const userToken = sessionStorage.getItem("access_token");
      const currentRouteInfo = resolvePageFromPath(window.location.pathname);

      // Which of the two stored sessions serves this route. The rule is a table
      // rather than a chain of early returns — see `lib/session.ts`.
      const choice = pickSession(
        { adminToken, adminRole, userToken },
        {
          isPublic: isPublicPage(currentRouteInfo.page),
          isUserPage: USER_PAGES.includes(currentRouteInfo.page),
        },
      );

      if (choice.kind === "public") {
        if (!cancelled) {
          setUserRole(choice.role);
          setIsCheckingAuth(false);
          applyRoute(currentRouteInfo, choice.role, "replace");
        }
        return;
      }

      // ── 1. Admin session (localStorage) ──────────────────────────────────
      // Admin tokens are issued by a separate auth system and are NOT accepted
      // by /auth/me. Calling it would always return 401 and log the admin out.
      // Token validity is instead proven on every real API call via
      // X-Admin-Authorization; a 401 there dispatches auth:logout automatically.
      // Restricting by role name here locked out custom roles (e.g. "cashier").
      if (choice.kind === "admin") {
        if (!cancelled) {
          setUserRole(choice.role);
          setIsCheckingAuth(false);
          // On a guest/login page → send to the admin default; otherwise honour URL
          if (isGuestPage(currentRouteInfo.page)) {
            applyRoute(
              { page: getDefaultPageForRole(choice.role) },
              choice.role,
              "replace",
            );
          } else {
            applyRoute(currentRouteInfo, choice.role, "replace");
          }
        }
        return;
      }

      // ── 2. No usable session → guest ─────────────────────────────────────
      if (choice.kind === "guest") {
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
          // Backend signals "session valid, but no region/district on file"
          // by returning requires_address=true. Push the user through the
          // login → address drawer flow without dispatching the global
          // logout (which would force a full SPA reload).
          if (userData.requires_address) {
            sessionStorage.removeItem("access_token");
            setUserRole(null);
            setIsCheckingAuth(false);
            applyRoute({ page: "login" }, null, "replace");
            return;
          }
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

  // How many pushes sit on top of the entry route, read from the history entry
  // itself (written by applyRoute). A page opened from inside the app can hand
  // the user back where they came from; one opened by deep link has nothing
  // behind it but the Telegram host, so `history.back()` there would close the
  // Mini App instead of navigating.
  const routerDepth = (): number =>
    (window.history.state as { depth?: number } | null)?.depth ?? 0;

  useEffect(() => {
    const handlePopState = () => {
      // Read, do not decrement: the browser has already restored the entry (and
      // its depth) that we are landing on. No haptic here either — popstate is
      // the RESULT of a back, and runBack() already buzzed at the press.
      setRouterDepth(routerDepth());
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

  /**
   * Navigation requested from a component too deep to hold a router callback.
   *
   * NotificationCenter used to do this with a raw `history.pushState` followed
   * by a synthetic `popstate`. That reached the right page, but the pushState
   * never incremented `pushDepthRef` while the synthetic pop decremented it —
   * so the app believed it had nothing behind it, and a real back press on the
   * page it had just opened closed the Mini App instead of returning.
   *
   * Same `window` CustomEvent convention as `auth:logout` / `auth:role-switched`.
   */
  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ page?: unknown }>).detail;
      // Validated, not cast: any script on the page can dispatch this event,
      // and an unknown page would route the user to a blank screen.
      const page = detail?.page;
      if (typeof page === "string" && USER_PAGES.includes(page as Page)) {
        navigateToPage(page as Page);
      }
    };
    window.addEventListener("app:navigate", handleNavigate);
    return () => window.removeEventListener("app:navigate", handleNavigate);
  }, [navigateToPage]);

  /**
   * Back that returns to wherever the user actually came from, falling back to
   * a fixed page when there is no in-app history to pop.
   */
  const navigateBack = useCallback(
    (fallback: Page) => {
      if (routerDepth() > 0) {
        window.history.back();
        return;
      }
      applyRoute({ page: fallback }, userRole, "replace");
    },
    [userRole, applyRoute],
  );

  useEffect(() => {
    if (loginBootstrapStatus !== "loading") return undefined;

    const timer = window.setInterval(() => {
      setLoginBootstrapMessageIndex((index) => (index + 1) % 2);
    }, 1500);

    return () => window.clearInterval(timer);
  }, [loginBootstrapStatus]);

  useEffect(() => {
    if (loginBootstrapStatus !== "loading") return;
    if (isTransitioning) return;
    if (!USER_PAGES.includes(currentPage)) return;

    setLoginBootstrapStatus("ready");
  }, [currentPage, isTransitioning, loginBootstrapStatus]);

  // ── Login success ────────────────────────────────────────────────────────

  const handleLoginSuccess = useCallback(
    (role: string) => {
      const shouldShowLoginBootstrap =
        currentPage === "login" &&
        (role === "user" || getDefaultPageForRole(role) === "user-home");

      if (shouldShowLoginBootstrap) {
        setLoginBootstrapMessageIndex(0);
        setLoginBootstrapStatus("loading");
      }

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
    [applyRoute, currentPage],
  );

  // ── Derived flags ────────────────────────────────────────────────────────

  const isUserPages = USER_PAGES.includes(currentPage as Page);

  // The redesigned client surface: the tab bar, the token background and no top
  // NavigationBar. Guest screens belong to it too — they are what a client sees
  // first — but admin-login does not.
  const isClientSurface =
    isUserPages || currentPage === "login" || currentPage === "register";

  const isAdminLoginPage = currentPage === "admin-login";

  const isSuperAdminPages = [
    "admin-dashboard",
    // The Reyslar board moved into the admin shell. Worker roles still reach it
    // without a sidebar — see the `isStandaloneAdminSubpage` branch below.
    "flights",
    // Reached from that board and run by the same worker, so it takes the same
    // standalone route. Leaving it out means the render branch never runs and
    // the router falls through to the customer login.
    "astatka",
    "admin-accounts",
    "admin-roles",
    "admin-audit",
    "admin-profile",
    "admin-carousel",
    "flight-schedule-admin",
    "admin-delivery-request",
    "admin-expenses",
    "system-settings",
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

  // Both cashier consoles. They share the standalone layout (no AdminLayout, no
  // NavigationBar) and the maintenance exemption — a spreadsheet buried under a
  // "Texnik ishlar" screen is as useless as a till buried under one.
  // Both cashier consoles. `/kassa` is rendered by its own branch above, so
  // this flag only grants it what the name implies: the maintenance-takeover
  // exemption a till needs in the middle of taking money.
  const isPOSPage = currentPage === "pos-dashboard" || currentPage === "kassa";
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

  // NBU redirect pages render in an external browser tab (outside Telegram
  // WebApp). They are full-screen by design — no NavigationBar, no top padding.
  const isNbuRedirectPage =
    currentPage === "payment_nbu_success" || currentPage === "payment_nbu_failure";

  const isAdminArea =
    isSuperAdminPages || isAdminLoginPage || isPOSPage ||
    isManagerPage || isStandaloneAdminSubpage || isPasskeyPage ||
    isWarehousePage || isExpectedCargoPage || currentPage === "pickup-tv" ||
    isNbuRedirectPage;

  // ── Render ───────────────────────────────────────────────────────────────

  // Operational staff consoles — POS cashier, warehouse scanner, expected-cargo
  // scanner. Staff work here continuously and must NEVER be interrupted by either
  // maintenance mechanism: the admin-toggled server flag (`isMaintenance`) OR the
  // transient server-down signal (502/503/504/network) that flips the store-driven
  // `isMaintenanceMode`. Resolved from `currentPage` state (reliable) rather than
  // window.pathname, which can lag behind in the custom history router.
  const isOperationalConsole = isPOSPage || isWarehousePage || isExpectedCargoPage;

  const isExemptFromMaintenance =
    isOperationalConsole ||
    window.location.pathname.startsWith('/admin') ||
    isPosPath(window.location.pathname) ||
    window.location.pathname.startsWith('/flights') ||
    window.location.pathname.startsWith('/statistics') ||
    window.location.pathname === '/pickup-tv' ||
    window.location.pathname === '/payment/nbu/success' ||
    window.location.pathname === '/payment/nbu/failure';

  const showMaintenanceOverlay = !isCheckingAuth && isMaintenance && !isMaintenanceAdmin && !isExemptFromMaintenance;
  const showAdminMaintenanceBanner = !isCheckingAuth && isMaintenance && isMaintenanceAdmin && !isExemptFromMaintenance;

  // The store-driven full-screen MaintenancePage ("Texnik ishlar ketmoqda") is
  // likewise suppressed on operational consoles so a brief backend blip never
  // covers a cashier/warehouse operator mid-task. `client.ts` already prevents
  // the store from being flipped on these routes; this is the second layer that
  // also covers the case where the store was flipped on another page first.
  const isServerDownMaintenanceExemptPage = isOperationalConsole;

  if (showMaintenanceOverlay) {
    return (
      <>
        {isMaintenanceMode && !isServerDownMaintenanceExemptPage && <MaintenancePage />}
        {/* `MaintenancePage` above already fills the screen while the overlay
            chunk loads, so a null fallback shows nothing missing. */}
        <Suspense fallback={null}>
          <MaintenanceOverlay />
        </Suspense>
        <Toaster position="top-center" richColors />
      </>
    );
  }

  return (
    <>
    {isMaintenanceMode && !isServerDownMaintenanceExemptPage && <MaintenancePage />}
    {showAdminMaintenanceBanner && (
      <div className="fixed top-0 left-0 right-0 z-[9998] h-9 flex items-center justify-center bg-amber-500/90 text-white text-xs font-bold px-4 shadow-md">
        {t('maintenance.adminBanner')}
      </div>
    )}
    {/* Fixed progress bar: shows during auth check, lazy-page transitions, and Suspense fallback */}
    {(isTransitioning || isCheckingAuth) && <TopProgressBar />}
    {loginBootstrapStatus !== "idle" && (
      <StatusAnimation
        status={loginBootstrapStatus === "ready" ? "success" : "loading"}
        message={
          loginBootstrapStatus === "ready"
            ? t("login.bootstrap.ready")
            : t(loginBootstrapMessageIndex === 0 ? "login.bootstrap.loading" : "login.bootstrap.arranging")
        }
        onComplete={() => setLoginBootstrapStatus("idle")}
      />
    )}
    <div
      className={`min-h-dvh relative overflow-hidden transition-colors duration-300 ${
        showAdminMaintenanceBanner ? 'pt-9' : ''
      } ${
        isAdminArea
          ? "bg-[#f5f5f4] dark:bg-[#09090b]"
          : isClientSurface
            ? "bg-mc-bg"
            : "bg-[#f8fafc] dark:bg-[#06080d]"
      }`}
    >
      {/* Routes Telegram's back button into the app's back stack.
          Gated POSITIVELY on the client surface: `!isAdminArea` would also
          arm the bridge on pages that are neither (a mis-resolved route, the
          auth check), where there is no Telegram host to talk to. */}
      <TelegramBackBridge enabled={isClientSurface} />

      {/* Resolves a payment opened in Telegram's in-app browser. Renders
          nothing until one is pending. */}
      {isClientSurface && <NbuPaymentWatch />}

      {/* One-time admin responsibility agreement (self-gates; shows once after login). */}
      <Suspense fallback={null}>
        <AdminAgreementModal currentPage={currentPage} userRole={userRole} />
      </Suspense>

      {/* The old design's header wash. Staff screens still run on that palette;
          the client surface paints its own --mc-bg, and during the auth check
          there is no page over it at all — which is where it kept showing up. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {!isAdminArea && !isClientSurface && !isCheckingAuth && (
          <>
            <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,rgba(255,138,31,0.18),rgba(249,115,22,0.07)_38%,transparent_72%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,138,31,0.20),rgba(249,115,22,0.08)_38%,transparent_72%)]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-300/70 to-transparent dark:via-orange-200/55" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.55),transparent_24%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent_28%)]" />
          </>
        )}
      </div>

      {/* Client pages navigate from the bottom bar; every other non-admin page
          keeps the top NavigationBar. Rendering both would put two navigation
          systems at the same hierarchy level. */}
      {!isAdminArea && !isClientSurface && (
        <NavigationBar
          onStatisticsClick={() => navigateToPage("statistics")}
          currentPage={currentPage}
        />
      )}
      {!isAdminArea && isUserPages && (
        <BottomNav
          currentPage={currentPage}
          onNavigate={(page: BottomNavPage) => navigateToPage(page as Page)}
        />
      )}

      {isCheckingAuth ? (
        <div className="mx-auto max-w-lg space-y-2.5 px-4 pt-6 animate-in fade-in duration-300">
          <Skeleton className="h-9 w-1/3 rounded-mc-md" />
          <Skeleton className="h-28 w-full rounded-mc-lg" />
          <Skeleton className="h-28 w-full rounded-mc-lg" />
          <Skeleton className="h-28 w-3/4 rounded-mc-lg" />
        </div>
      ) : (
      <Suspense fallback={<TopProgressBar />}>
      {/* Pages rendered here: isSuperAdminPages first branch */}
      {isSuperAdminPages && canAccessAdminPanel ? (
        <AdminLayout
          currentPage={currentPage}
          onNavigate={(page, flightName) => navigateToPage(page as Page, flightName)}
          onLogout={handleSignOut}
        >
          {currentPage === "admin-dashboard" && (
            <AdminDashboardPage onNavigate={(page) => navigateToPage(page as Page)} />
          )}
          {currentPage === "flights" && (
            <FlightsPage
              embedded
              onSelectFlight={(flightName) => navigateToPage("cargo-list", flightName)}
              onNavigate={(page) => navigateToPage(page as Page)}
            />
          )}
          {currentPage === "admin-accounts" && <AdminAccountsPage />}
          {currentPage === "admin-roles" && <AdminRolesPage />}
          {currentPage === "admin-audit" && <AdminAuditLogsPage />}
          {currentPage === "admin-profile" && <AdminProfilePage />}
          {currentPage === "admin-carousel" && <AdminCarouselPage />}
          {currentPage === "flight-schedule-admin" && <FlightScheduleAdminPage />}
          {currentPage === "admin-delivery-request" && <AdminDeliveryRequestPage />}
          {currentPage === "admin-expenses" && <ExpensesPage />}
          {currentPage === "system-settings" && <SystemSettingsPage />}
        </AdminLayout>
      ) : currentPage === "kassa" ? (
        <CashierPage
          onNavigate={(page) => navigateToPage(page as Page)}
          onLogout={handleSignOut}
        />
      ) : isPOSPage ? (
        <POSDashboard
          onNavigate={(page) => navigateToPage(page as Page)}
          onLogout={handleSignOut}
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
          {currentPage === "admin-expenses" && (
            <ExpensesPage />
          )}
          {currentPage === "flights" && (
            <FlightsPage
              onSelectFlight={(flightName) => navigateToPage("cargo-list", flightName)}
              onLogout={handleSignOut}
              onNavigate={(page) => navigateToPage(page as Page)}
            />
          )}
          {currentPage === "astatka" && (
            <AstatkaPage onBack={() => navigateToPage("flights")} />
          )}
        </>
      ) : isManagerPage && canAccessManagerPage ? (
        <ManagerPage
          onNavigate={(page) => navigateToPage(page as Page)}
          onLogout={handleSignOut}
        />
      ) : isPasskeyPage ? (
        <PasskeyPage
          onNavigate={(page) => navigateToPage(page as Page)}
          onLogout={handleSignOut}
        />
      ) : isWarehousePage && canAccessWarehouse ? (
        <WarehousePage
          onNavigate={(page) => navigateToPage(page as Page)}
          onLogout={handleSignOut}
        />
      ) : isExpectedCargoPage && canAccessExpectedCargo ? (
        <ExpectedCargoPage
          onNavigate={(page) => navigateToPage(page as Page)}
          onLogout={handleSignOut}
        />
      ) : currentPage === "pickup-tv" ? (
        <PickupQueueTVPage />
      ) : currentPage === "payment_nbu_success" ? (
        <PaymentNbuSuccess
          onNavigateHome={() => navigateToPage("user-home")}
        />
      ) : currentPage === "payment_nbu_failure" ? (
        <PaymentNbuFailure
          onNavigateHome={() => navigateToPage("user-home")}
          onRetry={() => navigateToPage("user-home")}
        />
      ) : (
        <main
          className={`relative ${
            isUserPages
              ? "pt-0 pb-[calc(var(--mc-nav-h)+env(safe-area-inset-bottom))]"
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

          {currentPage === "cargo-list" && selectedFlightName && (
            <CargoListPage
              flightName={selectedFlightName}
              onBack={() => navigateToPage("flights")}
              onAddCargo={() => navigateToPage("cargo-add", selectedFlightName)}
              onNavigateToNotifications={() =>
                navigateToPage("admin-flight-notifications", selectedFlightName)
              }
              onLogout={handleSignOut}
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
            <UserPage
              onLogout={handleSignOut}
              onNavigateToReferral={() => navigateToPage("user-referral")}
            />
          )}

          {currentPage === "user-home" && (
            <UserHome
              onNavigateToReports={() => navigateToPage("user-reports")}
              onNavigateToHistory={() => navigateToPage("user-history")}
              onNavigateToReferral={() => navigateToPage("user-referral")}
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
            <UserHistoryPage />
          )}

          {currentPage === "saved_cards" && (
            <SavedCardsPage onBack={() => navigateBack("user-home")} />
          )}

          {currentPage === "user-referral" && (
            <ReferralPage onBack={() => navigateBack("user-home")} />
          )}

          {currentPage === "system-settings" && (
            <SystemSettingsPage />
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
