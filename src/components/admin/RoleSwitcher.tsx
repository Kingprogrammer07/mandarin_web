import { useState, useRef, useEffect, useCallback } from "react";
import { Shield, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { getAdminJwtClaims } from "../../api/services/adminManagement";
import { switchAdminRole } from "../../api/services/adminAuth";

interface RoleSwitcherProps {
  // Kept for call-site compatibility; navigation is now driven by App via the
  // "auth:role-switched" event so the role swap and the route change stay in sync.
  onNavigate?: (page: string) => void;
}

export default function RoleSwitcher(_props: RoleSwitcherProps) {
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
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
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
        onClick={() => setIsOpen((p) => !p)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/[0.1] rounded-lg border border-gray-200 dark:border-white/[0.08] transition-colors"
      >
        <Shield className="w-3.5 h-3.5" />
        <span className="max-w-[80px] truncate">{currentRole}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/[0.08] shadow-lg z-50 py-1">
          {roleNames.map((role) => (
            <button
              key={role}
              onClick={() => handleSwitch(role)}
              className={`w-full text-left px-3 py-2 text-[12px] font-medium transition-colors ${
                role === currentRole
                  ? "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04]"
              }`}
            >
              <span className="flex items-center gap-2">
                {role === currentRole && (
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
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
