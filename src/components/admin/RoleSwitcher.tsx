import { useState, useRef, useEffect, useCallback } from "react";
import { Shield, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { getAdminJwtClaims } from "../../api/services/adminManagement";
import { switchAdminRole } from "../../api/services/adminAuth";

interface RoleSwitcherProps {
  // Kept for call-site compatibility; navigation is now driven by App via the
  // "auth:role-switched" event so the role swap and the route change stay in sync.
  onNavigate?: (page: string) => void;
  /** Open the menu upward — needed in the fixed mobile bottom bar where a
   *  downward menu would render off-screen. */
  dropUp?: boolean;
  /** Horizontal anchor of the menu. Left for a left-aligned (bottom-bar) trigger,
   *  right for the desktop header. Defaults to right. */
  menuAlign?: "left" | "right";
}

export default function RoleSwitcher({ dropUp = false, menuAlign = "right" }: RoleSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [claims, setClaims] = useState(() => getAdminJwtClaims());
  const ref = useRef<HTMLDivElement>(null);

  const roleNames = claims.role_names;
  const currentRole = claims.role_name;

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const handleSwitch = useCallback(
    async (roleName: string) => {
      if (roleName === currentRole) {
        setIsOpen(false);
        return;
      }
      try {
        const res = await switchAdminRole(roleName);
        localStorage.setItem("access_token", res.access_token);
        // Persist the new active role so a later reload re-bootstraps with it.
        localStorage.setItem("admin_role", res.role_name);
        // Also update sessionStorage if that's where the token lives
        if (sessionStorage.getItem("access_token")) {
          sessionStorage.setItem("access_token", res.access_token);
        }
        setClaims(getAdminJwtClaims());
        setIsOpen(false);
        toast.success(`Rol almashtirildi: ${roleName}`);

        // Hand navigation to App: it owns `userRole`, which gates every route.
        // Updating the role and the page together there avoids the stale-role
        // bounce that previously left the new home page blank.
        window.dispatchEvent(
          new CustomEvent("auth:role-switched", {
            detail: { role: res.role_name, homePage: res.home_page },
          }),
        );
      } catch (err: unknown) {
        const e = err as { message?: string };
        toast.error(e.message ?? "Rol almashtirishda xatolik");
      }
    },
    [currentRole],
  );

  if (roleNames.length <= 1) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex h-11 items-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface-2 px-2.5 text-[12px] font-bold text-mc-text-2 transition-colors hover:text-mc-text active:scale-95"
      >
        <Shield className="h-3.5 w-3.5" />
        <span className="max-w-[80px] truncate">{currentRole}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className={`absolute z-50 w-44 rounded-mc-md border border-mc-border bg-mc-surface py-1 shadow-[var(--mc-shadow-card)] ${
            menuAlign === "left" ? "left-0" : "right-0"
          } ${dropUp ? "bottom-full mb-1.5" : "mt-1.5"}`}
        >
          {roleNames.map((role) => (
            <button
              key={role}
              type="button"
              role="menuitem"
              onClick={() => handleSwitch(role)}
              className={`w-full px-3 py-2.5 text-left text-[12px] font-semibold transition-colors ${
                role === currentRole
                  ? "bg-mc-brand-soft text-mc-brand"
                  : "text-mc-text-2 hover:bg-mc-surface-2 hover:text-mc-text"
              }`}
            >
              <span className="flex items-center gap-2">
                {role === currentRole && (
                  <span className="h-1.5 w-1.5 rounded-full bg-mc-brand" />
                )}
                {role}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
