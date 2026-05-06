import { useState, useRef, useEffect, useCallback } from "react";
import { Shield, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { getAdminJwtClaims } from "../../api/services/adminManagement";
import { switchAdminRole } from "../../api/services/adminAuth";

interface RoleSwitcherProps {
  onNavigate: (page: string) => void;
}

export default function RoleSwitcher({ onNavigate }: RoleSwitcherProps) {
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
        // Also update sessionStorage if that's where the token lives
        if (sessionStorage.getItem("access_token")) {
          sessionStorage.setItem("access_token", res.access_token);
        }
        const newClaims = getAdminJwtClaims();
        setClaims(newClaims);
        setIsOpen(false);
        toast.success(`Rol almashtirildi: ${roleName}`);

        // Navigate to the new role's home page
        if (newClaims.home_page) {
          // Map home_page path to page name
          const path = newClaims.home_page;
          const pageMap: Record<string, string> = {
            "/admin/accounts": "admin-accounts",
            "/admin/roles": "admin-roles",
            "/admin/audit": "admin-audit",
            "/admin/profile": "admin-profile",
            "/admin/carousel": "admin-carousel",
            "/admin/flight-schedule": "flight-schedule-admin",
            "/admin/clients": "manager-page",
            "/admin/warehouse": "warehouse-page",
            "/admin/expected-cargo": "expected-cargo",
            "/admin/delivery-request": "admin-delivery-request",
            "/admin/passkey": "passkey-page",
            "/pos": "pos-dashboard",
            "/flights": "flights",
            "/statistics": "statistics",
            "/import": "import",
            "/pickup-tv": "pickup-tv",
          };
          const target = pageMap[path];
          if (target) {
            onNavigate(target);
          } else {
            // Fallback: try to resolve from path
            window.location.reload();
          }
        } else {
          window.location.reload();
        }
      } catch (err: unknown) {
        const e = err as { message?: string };
        toast.error(e.message ?? "Rol almashtirishda xatolik");
      }
    },
    [currentRole, onNavigate],
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
