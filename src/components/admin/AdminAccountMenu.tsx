/**
 * The header account control: who you are signed in as, and the two things you
 * can do about it — switch role, or leave.
 *
 * Merges what used to be two separate header buttons. `RoleSwitcher` rendered
 * nothing at all for a single-role account, so most admins saw a bare logout
 * icon and no indication of who they were signed in as.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Shield } from 'lucide-react';
import { toast } from 'sonner';

import { getAdminJwtClaims } from '@/api/services/adminManagement';
import { switchAdminRole } from '@/api/services/adminAuth';
import { triggerSoftHaptic } from '@/utils/haptics';

/** Two letters from the role name, e.g. "super-admin" → "SA". */
function initialsOf(name: string): string {
  const parts = name.split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function AdminAccountMenu({ onLogout }: { onLogout: () => void }) {
  const [isOpen, setOpen] = useState(false);
  const [claims, setClaims] = useState(() => getAdminJwtClaims());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const handleSwitch = useCallback(
    async (roleName: string) => {
      if (roleName === claims.role_name) {
        setOpen(false);
        return;
      }
      try {
        const res = await switchAdminRole(roleName);
        localStorage.setItem('access_token', res.access_token);
        localStorage.setItem('admin_role', res.role_name);
        if (sessionStorage.getItem('access_token')) {
          sessionStorage.setItem('access_token', res.access_token);
        }
        setClaims(getAdminJwtClaims());
        setOpen(false);
        toast.success(`Rol almashtirildi: ${roleName}`);
        // App owns `userRole`, which gates every route; it listens for this and
        // moves the route and the role together to avoid a stale-role bounce.
        window.dispatchEvent(
          new CustomEvent('auth:role-switched', {
            detail: { role: res.role_name, homePage: res.home_page },
          }),
        );
      } catch (err: unknown) {
        const e = err as { message?: string };
        toast.error(e.message ?? 'Rol almashtirishda xatolik');
      }
    },
    [claims.role_name],
  );

  const roleLabel = claims.role_name || 'Admin';
  const canSwitch = claims.role_names.length > 1;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          triggerSoftHaptic();
          setOpen((open) => !open);
        }}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        // The role label is hidden below `sm`, so without this the only
        // account and logout control on a phone has no accessible name.
        aria-label={`Hisob: ${roleLabel}`}
        className="flex h-11 items-center gap-2 rounded-full border border-mc-border bg-mc-surface-2 pl-1 pr-2.5 transition-colors hover:text-mc-text active:scale-95"
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-mc-brand text-[11px] font-extrabold text-mc-on-brand"
          aria-hidden="true"
        >
          {initialsOf(roleLabel)}
        </span>
        <span className="hidden max-w-[120px] truncate text-[12px] font-bold text-mc-text sm:inline">
          {roleLabel}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-mc-text-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          strokeWidth={2.2}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1.5 w-56 overflow-hidden rounded-mc-md border border-mc-border bg-mc-surface py-1 shadow-[var(--mc-shadow-card)]"
        >
          {canSwitch && (
            <>
              <p className="px-3 pb-1 pt-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-mc-text-3">
                Rolni almashtirish
              </p>
              {claims.role_names.map((role) => (
                <button
                  key={role}
                  type="button"
                  role="menuitem"
                  onClick={() => void handleSwitch(role)}
                  className={`flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-[12px] font-semibold transition-colors ${
                    role === claims.role_name
                      ? 'bg-mc-brand-soft text-mc-brand'
                      : 'text-mc-text-2 hover:bg-mc-surface-2 hover:text-mc-text'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span className="truncate">{role}</span>
                </button>
              ))}
              <div className="my-1 border-t border-mc-border" />
            </>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-[12px] font-bold text-mc-danger transition-colors hover:bg-mc-danger-soft"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            Chiqish
          </button>
        </div>
      )}
    </div>
  );
}
