import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, LayoutGrid, Moon, Search, Shield, Sun, X } from 'lucide-react';

import { AdminAccountMenu } from './AdminAccountMenu';
import { useManagerStore } from '@/store/useManagerStore';

import { CommandPalette } from './CommandPalette';
import {
  ADMIN_NAV,
  ADMIN_NAV_PRIMARY,
  findAdminNavItem,
  type AdminNavItem,
} from './navigation';
import { TopProgressBar } from '@/components/ui/TopProgressBar';
import { useAppTheme } from '@/hooks/useAppTheme';
import { formatTashkentDate } from '@/lib/format';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  /** `flightName` is passed through for rows that open one flight's cargo. */
  onNavigate: (page: string, flightName?: string) => void;
  onLogout: () => void;
}

/**
 * Every destination is authorised twice already — `checkAccess` in `App.tsx`
 * bounces a forbidden route and the backend rejects the request behind it — so
 * the sidebar lists what the role can reach rather than hiding entries by
 * permission. Hiding here would only make a reachable screen undiscoverable.
 */
export default function AdminLayout({ children, currentPage, onNavigate, onLogout }: AdminLayoutProps) {
  // `next-themes` owns the `dark` class app-wide. Writing it here as well
  // meant the provider reasserted its own value on the next state change and
  // the toggle silently reverted.
  const { theme, toggle: toggleTheme } = useAppTheme();
  const isDark = theme === 'dark';
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const sheetCloseRef = useRef<HTMLButtonElement>(null);

  const handleNav = useCallback(
    (id: string) => {
      onNavigate(id);
      setSheetOpen(false);
    },
    [onNavigate],
  );

  // Escape closes the sheet and the body stays put behind it — a sheet that
  // scrolls the page underneath reads as a broken overlay on a phone.
  useEffect(() => {
    if (!isSheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheetOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    sheetCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isSheetOpen]);

  // Ctrl+K / Cmd+K anywhere in the shell. Registered here rather than inside the
  // palette so the shortcut works while the palette is closed.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const active = findAdminNavItem(currentPage);
  const today = formatTashkentDate(new Date(), undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="fixed inset-0 z-50 flex bg-mc-bg text-mc-text">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-mc-border bg-mc-surface md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-mc-md bg-mc-brand">
            <Shield className="h-[18px] w-[18px] text-mc-on-brand" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-extrabold leading-tight tracking-tight text-mc-text">
              Mandarin Cargo
            </p>
            <p className="truncate text-[11px] font-medium text-mc-text-3">Boshqaruv paneli</p>
          </div>
        </div>

        <nav aria-label="Admin navigatsiya" className="flex-1 overflow-y-auto overscroll-contain px-3 pb-5">
          {ADMIN_NAV.map((group) => (
            <div
              key={group.id}
              className={group.divider ? 'mt-3 border-t border-mc-border pt-3' : ''}
            >
              {group.label && (
                <p className="px-2.5 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-mc-text-3">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <SidebarItem
                    key={item.id}
                    item={item}
                    isActive={item.shell === 'shell' && currentPage === item.id}
                    onSelect={handleNav}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main column ── */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Desktop header */}
        {/* No page title here: every page inside this shell already renders its
            own <h1>, so a header title printed it twice. */}
        <header className="hidden shrink-0 items-center justify-between gap-4 border-b border-mc-border bg-mc-surface px-6 py-3 md:flex">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-11 min-w-0 max-w-[420px] flex-1 items-center gap-2.5 rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 text-left transition-colors hover:border-mc-brand/30"
          >
            <Search className="h-4 w-4 shrink-0 text-mc-text-3" strokeWidth={2.2} />
            <span
              className="min-w-0 flex-1 truncate text-[13px] font-medium text-mc-text-3"
              title="Qidirish (mijoz, reys, trek kod)"
            >
              Qidirish (mijoz, reys, trek kod)
            </span>
            <kbd className="shrink-0 rounded border border-mc-border bg-mc-surface px-1.5 py-0.5 text-[10px] font-bold text-mc-text-3">
              Ctrl K
            </kbd>
          </button>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-mc-sm bg-mc-surface-2 px-2.5 py-1.5 text-[12px] font-semibold text-mc-text-2 lg:inline">
              {today}
            </span>
            <HeaderAction label={isDark ? 'Kunduzgi rejim' : 'Tungi rejim'} onClick={toggleTheme}>
              {isDark ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
            </HeaderAction>
            <AdminAccountMenu onLogout={onLogout} />
          </div>
        </header>

        {/* Mobile header */}
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-mc-border bg-mc-surface px-4 py-2.5 md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-mc-sm bg-mc-brand">
              <Shield className="h-4 w-4 text-mc-on-brand" strokeWidth={2.2} />
            </div>
            <p
              className="truncate text-[14px] font-extrabold text-mc-text"
              title={active?.label ?? 'Admin'}
            >
              {active?.label ?? 'Admin'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <HeaderAction label="Qidirish" onClick={() => setSearchOpen(true)}>
              <Search className="h-[18px] w-[18px]" />
            </HeaderAction>
            <HeaderAction label={isDark ? 'Kunduzgi rejim' : 'Tungi rejim'} onClick={toggleTheme}>
              {isDark ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
            </HeaderAction>
            <AdminAccountMenu onLogout={onLogout} />
          </div>
        </header>

        {/* Page content. The Suspense boundary sits inside the shell so a lazy
            page chunk no longer unmounts the sidebar while it loads. */}
        <div className="relative flex-1 overflow-y-auto overscroll-contain pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <div className="mx-auto w-full max-w-[1500px] p-4 md:p-6 lg:p-8">
            <Suspense fallback={<TopProgressBar />}>
              {/* Keyed on the page so a route change fades in. No `AnimatePresence`:
                  an exit animation would hold the outgoing page on screen while the
                  incoming chunk is still loading.

                  OPACITY ONLY — never `y`, `x`, `scale` or any other transform.
                  A transformed ancestor becomes the containing block for every
                  `position: fixed` descendant, so a 6px entrance rise silently
                  re-anchored every full-screen overlay in the admin panel to
                  this scrolling box instead of the viewport. Eight pages use
                  `fixed` inside this shell — WarehousePage's `fixed inset-0`
                  panel among them — and they rendered over the wrong area,
                  swallowing clicks meant for the controls beneath.

                  `will-change` follows the animated property, so opacity alone
                  does not reintroduce the containing block either. */}
              <motion.div
                key={currentPage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {children}
              </motion.div>
            </Suspense>
          </div>
        </div>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <nav
        aria-label="Admin navigatsiya"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-mc-border bg-mc-nav pt-1 pb-[calc(0.35rem+env(safe-area-inset-bottom))] md:hidden"
      >
        {ADMIN_NAV_PRIMARY.map((item) => {
          const isActive = currentPage === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-transform active:scale-90"
            >
              {isActive && (
                <motion.span
                  layoutId="admin-mobile-active"
                  className="absolute -top-1 h-[3px] w-6 rounded-full bg-mc-brand"
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                />
              )}
              <Icon
                className={`h-[21px] w-[21px] ${isActive ? 'text-mc-brand' : 'text-mc-text-3'}`}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              {/* `short` where the full label does not fit 64px. A tooltip
                  would be the usual answer and is useless on a touch screen. */}
              <span
                className={`w-full truncate px-1 text-center text-[10px] font-bold ${
                  isActive ? 'text-mc-brand' : 'text-mc-text-3'
                }`}
              >
                {item.short ?? item.label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isSheetOpen}
          className="relative flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-transform active:scale-90"
        >
          <LayoutGrid
            className={`h-[21px] w-[21px] ${isSheetOpen ? 'text-mc-brand' : 'text-mc-text-3'}`}
            strokeWidth={isSheetOpen ? 2.2 : 1.8}
          />
          <span
            className={`w-full truncate px-1 text-center text-[10px] font-bold ${
              isSheetOpen ? 'text-mc-brand' : 'text-mc-text-3'
            }`}
          >
            Barchasi
          </span>
        </button>
      </nav>

      <CommandPalette
        open={isSearchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={(target) => {
          // A client result opens that client. The drawer reads its id from
          // the manager store rather than from the route, which only carries a
          // client id for the `client-edit` page.
          if (target.clientId !== undefined) {
            useManagerStore.getState().setSelectedClientId(target.clientId);
          }
          onNavigate(target.page, target.flightName);
          setSearchOpen(false);
        }}
      />

      {/* ── Mobile sheet: the full destination list ── */}
      <AnimatePresence>
        {isSheetOpen && (
          <>
            <motion.div
              key="admin-sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSheetOpen(false)}
              className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm md:hidden"
            />
            <motion.div
              key="admin-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-sheet-title"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-mc-xl border-t border-mc-border bg-mc-surface md:hidden"
            >
              <div className="shrink-0 px-4 pt-3">
                <div className="mx-auto h-1 w-10 rounded-full bg-mc-border" />
                <div className="flex items-center justify-between py-3">
                  <h2 id="admin-sheet-title" className="text-[15px] font-extrabold text-mc-text">
                    Barcha bo‘limlar
                  </h2>
                  <button
                    ref={sheetCloseRef}
                    type="button"
                    onClick={() => setSheetOpen(false)}
                    aria-label="Yopish"
                    className="flex h-11 w-11 items-center justify-center rounded-mc-sm bg-mc-surface-2 text-mc-text-2 transition-transform active:scale-90"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                {ADMIN_NAV.map((group) => (
                  <div
                    key={group.id}
                    className={group.divider ? 'mt-3 border-t border-mc-border pt-3' : ''}
                  >
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.shell === 'shell' && currentPage === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleNav(item.id)}
                            aria-current={isActive ? 'page' : undefined}
                            className={`flex w-full items-center gap-3 rounded-mc-md border px-3 py-2.5 text-left transition-transform active:scale-[0.98] ${
                              isActive
                                ? 'border-mc-brand/25 bg-mc-brand-soft'
                                : 'border-mc-border bg-mc-surface-2'
                            }`}
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-mc-sm ${
                                isActive ? 'bg-mc-brand text-mc-on-brand' : 'bg-mc-surface text-mc-text-2'
                              }`}
                            >
                              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={`block truncate text-[13px] font-bold ${
                                  isActive ? 'text-mc-brand' : 'text-mc-text'
                                }`}
                              >
                                {item.label}
                              </span>
                              <span
                                className="block truncate text-[11px] font-medium text-mc-text-3"
                                title={item.description}
                              >
                                {item.description}
                              </span>
                            </span>
                            {item.shell === 'standalone' && (
                              <ArrowUpRight className="h-4 w-4 shrink-0 text-mc-text-3" strokeWidth={2} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarItem({
  item,
  isActive,
  onSelect,
}: {
  item: AdminNavItem;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-current={isActive ? 'page' : undefined}
      className={`group relative flex w-full items-center gap-2.5 rounded-mc-sm px-2.5 py-2 text-[13px] font-semibold transition-colors ${
        isActive
          ? 'bg-mc-brand-soft text-mc-brand'
          : 'text-mc-text-2 hover:bg-mc-surface-2 hover:text-mc-text'
      }`}
    >
      {isActive && (
        <motion.span
          layoutId="admin-sidebar-active"
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-mc-brand"
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        />
      )}
      <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={isActive ? 2.2 : 1.9} />
      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
      {/* A standalone entry swaps the whole screen for another console; the
          arrow is the only warning the sidebar is about to disappear. */}
      {item.shell === 'standalone' && (
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-mc-text-3" strokeWidth={2} />
      )}
    </button>
  );
}

function HeaderAction({
  label,
  onClick,
  children,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-11 w-11 items-center justify-center rounded-mc-sm transition-colors active:scale-95 ${
        tone === 'danger'
          ? 'text-mc-danger hover:bg-mc-danger-soft'
          : 'text-mc-text-2 hover:bg-mc-surface-2 hover:text-mc-text'
      }`}
    >
      {children}
    </button>
  );
}
