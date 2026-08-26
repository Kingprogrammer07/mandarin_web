/**
 * The one place the admin navigation is described.
 *
 * It used to be written three times inside `AdminLayout` — the desktop sidebar,
 * the mobile bottom bar and the quick-access sheet each carried their own
 * literal array, so a new screen had to be added in three places and
 * `pickup-tv` ended up missing from two of them.
 *
 * `shell` is the load-bearing field. `App.tsx` mounts `AdminLayout` for a fixed
 * set of pages (`isSuperAdminPages`); every other destination replaces the whole
 * screen with its own console. A "standalone" entry therefore navigates *out* of
 * this shell and can never be the active item while the sidebar is on screen —
 * which is why only shell entries take an active state.
 */

import {
  BarChart3,
  CalendarDays,
  Clock,
  Layers,
  LayoutDashboard,
  Monitor,
  PackageSearch,
  Plane,
  Settings,
  Shield,
  Truck,
  TrendingDown,
  Tv,
  Upload,
  User,
  UserCheck,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

/** Where the page renders once opened. */
export type AdminNavShell =
  /** Renders inside `AdminLayout` — the sidebar stays. */
  | 'shell'
  /** Replaces the entire screen with its own layout. */
  | 'standalone';

export interface AdminNavItem {
  /** Page id understood by `navigateToPage` in `App.tsx`. */
  id: string;
  label: string;
  /** One line for the sheet and the desktop header subtitle. */
  description: string;
  icon: LucideIcon;
  shell: AdminNavShell;
  /**
   * Shown in the mobile bottom bar. Capped at four — the fifth slot is "Barchasi".
   *
   * The bar is the super-admin's surface, so it carries the account-level
   * screens (Adminlar, Rollar, Sozlamalar) rather than the operational ones.
   * Zayavka and Xarajatlar used to sit here and were demoted on the owner's
   * call: day-to-day work happens in the standalone consoles, and both are
   * still one tap away inside "Barchasi".
   *
   * Slot order is the order of `ADMIN_NAV`, not the order the flags were
   * added — moving an entry in the list moves its tab.
   */
  primary?: boolean;
  /**
   * Label for the mobile bottom bar only.
   *
   * Five equal columns leave 64px per item on a 320px screen and 60px inside
   * the label padding — the tightest case the bar has to survive. "Boshqaruv
   * paneli" measures ~118px at 10px bold Manrope, so it was clipped on the very
   * tab a user lands on first, and a tooltip is no help on a phone. Set this
   * only where the full label does not fit; "Sozlamalar" (54px) still does.
   */
  short?: string;
}

export interface AdminNavGroup {
  id: string;
  /**
   * Omitted for the working list. Section headings were tried and made a
   * sixteen-item sidebar look longer than it is: four labels added four rows of
   * chrome to a list that reads perfectly well in one run. The only break kept
   * is the rule above the account-level entries.
   */
  label?: string;
  /** Draw a hairline above this group. */
  divider?: boolean;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: 'main',
    items: [
      {
        id: 'admin-dashboard',
        label: 'Boshqaruv paneli',
        short: 'Panel',
        description: 'Asosiy ko‘rsatkichlar va operatsion nazorat',
        icon: LayoutDashboard,
        shell: 'shell',
        primary: true,
      },
      {
        id: 'flights',
        label: 'Reyslar',
        description: 'Reys va yuklar',
        icon: Plane,
        shell: 'shell',
      },
      {
        // The rebuilt console at /kassa. The old `/pos` screen is still there
        // and still reachable — from the "Eski versiya" button inside /kassa,
        // and from the receipt QR codes already printed and in customers'
        // hands, which point at {BASE}/pos?receipt=<id>.
        id: 'kassa',
        label: 'Kassa',
        description: 'Kassir oynasi',
        icon: Monitor,
        shell: 'standalone',
      },
      {
        id: 'manager-page',
        label: 'Mijozlar',
        description: 'Menejer paneli',
        icon: UserCheck,
        shell: 'standalone',
      },
      {
        id: 'warehouse-page',
        label: 'Ombor',
        description: 'Qabul va topshirish',
        icon: Warehouse,
        shell: 'standalone',
      },
      {
        id: 'expected-cargo',
        label: 'Kutilayotgan yuklar',
        description: 'Kelishi kutilayotgan yuklar',
        icon: PackageSearch,
        shell: 'standalone',
      },
      {
        id: 'import',
        label: 'Import',
        description: 'Excel yuklash',
        icon: Upload,
        shell: 'standalone',
      },
      {
        id: 'admin-delivery-request',
        label: 'Zayavka',
        description: 'Yetkazib berish so‘rovlari',
        icon: Truck,
        shell: 'shell',
      },
      {
        id: 'pickup-tv',
        label: 'TV e’lon',
        description: 'Navbat televizor ekrani',
        icon: Tv,
        shell: 'standalone',
      },
      {
        id: 'statistics',
        label: 'Statistika',
        description: 'Ko‘rsatkichlar tahlili',
        icon: BarChart3,
        shell: 'standalone',
      },
      {
        id: 'admin-accounts',
        label: 'Adminlar',
        description: 'Hisoblar boshqaruvi',
        icon: Users,
        shell: 'shell',
        primary: true,
      },
      {
        id: 'admin-roles',
        label: 'Rollar',
        description: 'Huquqlar tizimi',
        icon: Shield,
        shell: 'shell',
        primary: true,
      },
      {
        id: 'admin-audit',
        label: 'Audit',
        description: 'Xodimlar faoliyati',
        icon: Clock,
        shell: 'shell',
      },
      {
        id: 'admin-expenses',
        label: 'Xarajatlar',
        description: 'Chiqimlar hisoboti',
        icon: TrendingDown,
        shell: 'shell',
      },
      {
        id: 'admin-carousel',
        label: 'Karusel',
        description: 'Banner va reklama',
        icon: Layers,
        shell: 'shell',
      },
      {
        id: 'flight-schedule-admin',
        label: 'Reys jadvali',
        description: 'Mijozlarga ko‘rinadigan jadval',
        icon: CalendarDays,
        shell: 'shell',
      },
    ],
  },
  {
    id: 'account',
    divider: true,
    items: [
      {
        id: 'system-settings',
        label: 'Sozlamalar',
        description: 'Tizim va Redis',
        icon: Settings,
        shell: 'shell',
        primary: true,
      },
      {
        id: 'admin-profile',
        label: 'Profil',
        description: 'Shaxsiy sozlamalar',
        icon: User,
        shell: 'shell',
      },
    ],
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap((group) => group.items);

/**
 * Bottom-bar slots: Boshqaruv paneli · Adminlar · Rollar · Sozlamalar.
 *
 * Sliced rather than trusted: a fifth `primary` flag would push the bar to six
 * columns and squeeze every label past its 64px, so the documented cap is
 * enforced here. An overflowing entry is still reachable through "Barchasi",
 * which renders `ADMIN_NAV` whole.
 */
export const ADMIN_NAV_PRIMARY: AdminNavItem[] = ADMIN_NAV_ITEMS.filter(
  (item) => item.primary,
).slice(0, 4);

/** Lookup for the header title. `App.tsx` only mounts this shell for pages listed above. */
export function findAdminNavItem(pageId: string): AdminNavItem | null {
  return ADMIN_NAV_ITEMS.find((item) => item.id === pageId) ?? null;
}
