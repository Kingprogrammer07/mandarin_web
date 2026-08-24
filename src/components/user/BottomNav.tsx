import type { SVGProps } from 'react';
import { CreditCard, Home, Package, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { triggerSoftHaptic } from '@/utils/haptics';

/**
 * Filled counterparts of the four tab glyphs.
 *
 * lucide ships outline icons only, and setting `fill` on an outline glyph
 * collapses it into a blob — a filled `Home` stops reading as a house. Rather
 * than pull in a second icon package for four shapes, the solid variants are
 * drawn here. `fillRule="evenodd"` is what punches the parcel seam and the card
 * stripe out of the solid body.
 */
type SolidIconProps = SVGProps<SVGSVGElement>;

const solidBase = {
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  fillRule: 'evenodd' as const,
  'aria-hidden': true,
};

function HomeSolid(props: SolidIconProps) {
  return (
    <svg {...solidBase} {...props}>
      <path d="M12 2.2 2.4 10.6V19.8A2.2 2.2 0 0 0 4.6 22H9.1V16.6a2.9 2.9 0 0 1 5.8 0V22h4.5a2.2 2.2 0 0 0 2.2-2.2V10.6Z" />
    </svg>
  );
}

function PackageSolid(props: SolidIconProps) {
  // The outer contour is lucide `package`'s own hexagonal box, so the shape
  // does not change when the tab activates — a flat square here read as a
  // different icon altogether. The second subpath traces the two top-face
  // seams and the front edge, punched out by `evenodd`.
  return (
    <svg {...solidBase} {...props}>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z M11.4 11.65 3.33 7.02l.6-1.04L12 10.61l8.07-4.63.6 1.04-8.07 4.63V21.9h-1.2Z" />
    </svg>
  );
}

function CreditCardSolid(props: SolidIconProps) {
  return (
    <svg {...solidBase} {...props}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5V8.2H3Z" />
      <path d="M3 10.7v5.8A2.5 2.5 0 0 0 5.5 19h13a2.5 2.5 0 0 0 2.5-2.5v-5.8Zm3 4.05h3.5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1 0-1.5Z" />
    </svg>
  );
}

function UserSolid(props: SolidIconProps) {
  return (
    <svg {...solidBase} {...props}>
      <path d="M12 12.2a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2Z" />
      <path d="M12 14.1c-4.3 0-7.8 2.6-8.6 6.1a1.4 1.4 0 0 0 1.4 1.7h14.4a1.4 1.4 0 0 0 1.4-1.7c-.8-3.5-4.3-6.1-8.6-6.1Z" />
    </svg>
  );
}

/** The four top-level client destinations, in the order the design shows them. */
const TABS = [
  {
    page: 'user-home',
    labelKey: 'bottomNav.home',
    fallback: 'Bosh sahifa',
    Icon: Home,
    IconSolid: HomeSolid,
  },
  {
    page: 'user-reports',
    labelKey: 'bottomNav.cargo',
    fallback: 'Yuklarim',
    Icon: Package,
    IconSolid: PackageSolid,
  },
  {
    page: 'user-history',
    labelKey: 'bottomNav.payments',
    fallback: "To'lovlar",
    Icon: CreditCard,
    IconSolid: CreditCardSolid,
  },
  {
    page: 'user-profile',
    labelKey: 'bottomNav.profile',
    fallback: 'Profil',
    Icon: User,
    IconSolid: UserSolid,
  },
] as const;

export type BottomNavPage = (typeof TABS)[number]['page'];

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: BottomNavPage) => void;
}

/**
 * Fixed bottom tab bar for the client app.
 *
 * Replaces the top `NavigationBar` + `UserNav` pair on user pages. A thumb
 * reaches the bottom of a phone; the top of a Telegram Mini App is already
 * crowded by Telegram's own chrome, which is why the previous top tabs were
 * easy to miss.
 *
 * Pages that render underneath must reserve room for it — App.tsx pads user
 * content by the bar's height plus the safe-area inset.
 */
export function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  const { t } = useTranslation();

  return (
    <nav
      // The bar owns the gesture-bar inset itself so pages only ever need to
      // clear its declared height, not guess at the device.
      className="fixed inset-x-0 bottom-0 z-40 border-t border-mc-border bg-mc-nav
                 pb-[env(safe-area-inset-bottom)]"
      aria-label={t('bottomNav.ariaLabel', 'Asosiy navigatsiya')}
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map(({ page, labelKey, fallback, Icon, IconSolid }) => {
          const isActive = currentPage === page;
          return (
            <li key={page} className="flex-1">
              <button
                type="button"
                onClick={() => {
                  if (isActive) return;
                  triggerSoftHaptic();
                  onNavigate(page);
                }}
                // --mc-nav-h (52px) still clears the 44pt minimum once the
                // label is counted.
                className="relative flex h-[var(--mc-nav-h)] w-full flex-col items-center justify-center gap-[3px]
                           transition-colors duration-150"
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Solid glyph plus this bar, not colour alone: a colour-blind
                    reader still gets the shape change and the indicator. */}
                <span
                  className={`absolute inset-x-0 top-0 mx-auto h-[3px] w-9 rounded-b-full
                              transition-opacity duration-150
                              ${isActive ? 'bg-mc-brand opacity-100' : 'opacity-0'}`}
                  aria-hidden="true"
                />
                {isActive ? (
                  <IconSolid className="h-5 w-5 text-mc-brand" />
                ) : (
                  <Icon
                    className="h-5 w-5 text-mc-text-2 transition-colors duration-150"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`text-[10px] leading-none ${
                    isActive ? 'font-bold text-mc-brand' : 'font-medium text-mc-text-2'
                  }`}
                >
                  {t(labelKey, fallback)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
