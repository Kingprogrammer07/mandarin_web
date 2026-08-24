import { useProfile, useLogout } from '@/hooks/useProfile';
import { BalanceSplitCard } from '@/components/user/BalanceSplitCard';
import { HomeHeader } from '@/components/user/HomeHeader';
import { MenuList, type MenuItem } from '@/components/user/MenuList';
import { ProfileCard } from '@/components/user/ProfileCard';
import {
   ChevronLeft,
   Clock,
   FileText,
   CreditCard as CreditCardIcon,
   Headphones,
   Phone,
   Smartphone,
   UserPlus,
   UserRound,
   Wallet as WalletIcon,
} from 'lucide-react';
import { PersonalInfo } from '@/components/profile/PersonalInfo';
import { SessionHistory } from '@/components/profile/SessionHistory';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LogOut, RefreshCw, UserCog } from 'lucide-react';
import { useState, useCallback, lazy, Suspense, memo, useTransition, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { DriveStep } from 'driver.js';
import { useGuideTour } from '@/hooks/useGuideTour';
import { pickVisible } from '@/utils/tour';
import { motion, AnimatePresence } from 'framer-motion';
import { WalletModal } from '@/components/wallet/WalletModal';
import { CardsManagerModal } from '@/components/wallet/CardsManagerModal';
import { ExtraPassportsModal } from '@/components/profile/ExtraPassportsModal';
import { clearNbuReturnParams } from '@/utils/nbuReturnContext';
import { SUPPORT_TELEGRAM_URL } from '@/config/contacts';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import LegalDocumentModal from '@/components/legal/LegalDocumentModal';
import type { LegalDocId } from '@/components/legal/legalDocuments';
import { ConsentCard } from '@/components/profile/ConsentCard';

// Lazy load the heavy modal
const EditProfileModal = lazy(() => import('@/components/profile/EditProfileModal').then(module => ({ default: module.EditProfileModal })));
const NotificationCenter = lazy(
   () => import('@/components/notifications/NotificationCenter'),
);


/** Sub-screens the profile rows open in place of the list. */
type ProfileView = 'menu' | 'personal' | 'activity';

/**
 * "+998 90 *** ** 34" — keep the country code and the last two digits.
 *
 * A profile screen is opened in public and screenshotted for support; the
 * number is only there so the client can confirm which one is on file, and the
 * middle digits are what identifies it to someone reading over a shoulder.
 */
function maskPhone(phone?: string): string {
   if (!phone) return '';
   const digits = phone.replace(/\D/g, '');
   if (digits.length < 6) return phone;
   return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} *** ** ${digits.slice(-2)}`;
}

// --- Passport Images Component ---

/** `onNavigateToReferral` opens `/user/referral`. That page existed and was
 *  routed all along, but nothing navigated to it — the invite flow was only
 *  reachable by typing the URL. */
const UserPage = ({
   onLogout,
   onNavigateToReferral,
}: {
   onLogout?: () => void;
   onNavigateToReferral?: () => void;
}) => {
   const { data: user, isLoading, isError, refetch } = useProfile();
   const { mutate: logout } = useLogout(onLogout);
   const { t } = useTranslation();
   const [isEditModalOpen, setIsEditModalOpen] = useState(false);
   const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
   // Returning from the NBU card flow reopens the cards sheet. Read straight
   // into the initial state rather than setting it from an effect, which would
   // paint one frame with the sheet closed and trip the cascading-render rule.
   const [isCardsModalOpen, setIsCardsModalOpen] = useState(
      () => new URLSearchParams(window.location.search).get('nbuReturn') === 'cards',
   );
   const [isPassportsModalOpen, setIsPassportsModalOpen] = useState(false);

   useEffect(() => {
      if (!isCardsModalOpen) return;
      clearNbuReturnParams();
      // Runs once on mount: the param is consumed the moment it is read.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);
   const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
   const [isSensitiveVisible, setIsSensitiveVisible] = useState(false);
   const [view, setView] = useState<ProfileView>('menu');
   // The hook was written for the home dashboard, which is no longer
   // reachable — so the only install entry point in the app was dead code.
   const { canInstall, handleInstall } = useInstallPrompt();
   // Consent is collected at registration; after that the documents were
   // unreachable from inside the app.
   const [isLegalOpen, setIsLegalOpen] = useState(false);
   const [legalDoc, setLegalDoc] = useState<LegalDocId>('offer');
   const openLegalDoc = useCallback((doc: LegalDocId) => {
      setLegalDoc(doc);
      setIsLegalOpen(true);
   }, []);
   const [isModalLoading, startTransition] = useTransition();

   const handleLogout = useCallback(() => {
      setIsLogoutModalOpen(false);
      logout();
   }, [logout]);

   const handleEditOpen = useCallback(() => {
      startTransition(() => {
         setIsEditModalOpen(true);
      });
   }, []);

   const handleEditClose = useCallback(() => {
      setIsEditModalOpen(false);
   }, []);

   // Destinations from the mockup. Wallet and cards reuse the modals the page
   // already owned; personal details and activity move behind rows instead of
   // sitting open on the screen, which is what let the list fit one column.
   const mainMenu: MenuItem[] = [
      {
         id: 'wallet',
         label: t('profile.menu.wallet', 'Hamyonim'),
         Icon: WalletIcon,
         onClick: () => setIsWalletModalOpen(true),
      },
      {
         id: 'cards',
         label: t('profile.menu.cards', 'Mening kartalarim'),
         Icon: CreditCardIcon,
         onClick: () => setIsCardsModalOpen(true),
      },
      {
         id: 'personal',
         label: t('profile.menu.personal', "Shaxsiy ma'lumotlar"),
         Icon: UserRound,
         onClick: () => setView('personal'),
      },
      {
         id: 'activity',
         label: t('profile.menu.activity', 'Faollik tarixi'),
         Icon: Clock,
         onClick: () => setView('activity'),
      },
      ...(onNavigateToReferral
         ? [
              {
                 id: 'referral',
                 label: t('profile.menu.referral', "Do'stlarni taklif qilish"),
                 Icon: UserPlus,
                 onClick: onNavigateToReferral,
              } satisfies MenuItem,
           ]
         : []),
      // Hidden rather than disabled when unavailable: on iOS Safari there is no
      // programmatic install, and a row that does nothing when tapped is worse
      // than no row.
      ...(canInstall
         ? [
              {
                 id: 'install',
                 label: t('profile.menu.install', "Ekranga qo'shish"),
                 Icon: Smartphone,
                 onClick: handleInstall,
              } satisfies MenuItem,
           ]
         : []),
      {
         id: 'support',
         label: t('profile.menu.support', 'Yordam markazi'),
         Icon: Headphones,
         onClick: () => window.open(SUPPORT_TELEGRAM_URL, '_blank', 'noopener,noreferrer'),
      },
   ];

   const contactMenu: MenuItem[] = [
      {
         id: 'phone',
         label: t('profile.menu.phone', 'Telefon raqam'),
         Icon: Phone,
         value: maskPhone(user?.phone),
         onClick: handleEditOpen,
      },
   ];

   const handleRefetch = useCallback(() => {
      refetch();
   }, [refetch]);

   // One-time onboarding tour for the profile page. Quick actions render twice
   // (mobile + desktop) — pickVisible highlights whichever copy is on screen.
   const buildProfileTour = useCallback((): DriveStep[] => [
      {
         element: '[data-tour="profile-hero"]',
         popover: {
            title: t('tour.profile.hero.title'),
            description: t('tour.profile.hero.desc'),
         },
      },
      {
         element: pickVisible('[data-tour="profile-actions"]') ?? '[data-tour="profile-actions"]',
         popover: {
            title: t('tour.profile.actions.title'),
            description: t('tour.profile.actions.desc'),
         },
      },
      {
         element: '[data-tour="profile-personal"]',
         popover: {
            title: t('tour.profile.personal.title'),
            description: t('tour.profile.personal.desc'),
         },
      },
   ], [t]);
   useGuideTour('profile', buildProfileTour, !isLoading && !isError && !!user);

   if (isLoading) {
      return <ProfileSkeleton />;
   }

   if (isError || !user) {
      return (
         <div className="flex w-full flex-col items-center justify-center min-h-[100dvh] p-6 text-center bg-mc-surface-2  pt-20">
            <div className="relative z-10">
               <div className="w-20 h-20 bg-mc-danger-soft rounded-full flex items-center justify-center mb-6 animate-pulse mx-auto">
                  <LogOut className="h-8 w-8 text-mc-danger" />
               </div>
               <h2 className="text-2xl font-bold text-mc-text mb-2">{t('profile.error.title')}</h2>
               <p className="text-mc-text-2 mb-8 max-w-xs mx-auto">
                  {t('profile.error.description')}
               </p>
               <Button
                  onClick={handleRefetch}
                  size="lg"
                  className="rounded-mc-md bg-mc-brand shadow-lg shadow-[var(--mc-shadow-cta)]"
               >
                  <RefreshCw className="mr-2 h-5 w-5" />
                  {t('profile.error.retry')}
               </Button>
            </div>
         </div>
      );
   }

   return (
      <div className="min-h-dvh bg-mc-bg text-mc-text transition-colors duration-500 font-sans">

         <AnimatePresence mode="wait">
            <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="relative z-10"
            >
               {/* Desktop Container Wrapper */}
               {/* One column at every width. The two-column desktop layout that
                   used to live here duplicated QuickActions, PassportImages and
                   the action buttons behind `hidden md:flex` / `md:hidden`
                   pairs — two copies of the same controls that had to be kept
                   in step by hand. pt-[94px] cleared the top NavigationBar,
                   which client pages no longer render. */}
               <div className="mx-auto max-w-lg">
                  <HomeHeader
                     notificationSlot={
                        <Suspense fallback={<span className="block h-10 w-10" aria-hidden="true" />}>
                           <NotificationCenter />
                        </Suspense>
                     }
                  />

                  {view === 'menu' ? (
                     <div className="space-y-2.5 pb-5 pt-3">
                        <ProfileCard
                           fullName={user.full_name}
                           clientCode={user.extra_code || user.client_code}
                           createdAt={user.created_at}
                           avatarUrl={user.avatar_url}
                           onOpen={handleEditOpen}
                        />

                        <BalanceSplitCard />

                        <MenuList items={mainMenu} />

                        {/* Contact rows carry their value inline, so they get the
                            larger icon chips the mockup uses to separate them from
                            the navigation rows above. Email is absent on purpose:
                            `ProfileResponse` has no email field, and a row that
                            can only ever be blank is worse than no row. */}
                        <MenuList items={contactMenu} variant="chip" />

                        <ConsentCard
                           acceptedVersion={user.privacy_policy_version}
                           acceptedAt={user.privacy_policy_accepted_at}
                           onOpenDocument={openLegalDoc}
                        />

                        <div className="space-y-2.5 px-4 pt-1">
                           <button
                              type="button"
                              onClick={handleEditOpen}
                              disabled={isModalLoading}
                              className="flex h-13 w-full items-center justify-center gap-2 rounded-mc-lg
                                         bg-gradient-to-r from-mc-brand to-mc-brand-strong py-3
                                         text-[14px] font-extrabold text-mc-on-brand
                                         shadow-[var(--mc-shadow-cta)] transition-transform
                                         duration-150 active:scale-[0.98] disabled:opacity-60"
                           >
                              {isModalLoading ? (
                                 <RefreshCw className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
                              ) : (
                                 <UserCog className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
                              )}
                              {isModalLoading ? t('profile.edit.loading') : t('profile.editProfile')}
                           </button>

                           <button
                              type="button"
                              onClick={() => setIsLogoutModalOpen(true)}
                              className="flex w-full items-center justify-center gap-2 rounded-mc-lg
                                         border border-mc-danger/25 bg-mc-surface py-3
                                         text-[14px] font-extrabold text-mc-danger
                                         transition-transform duration-150 active:scale-[0.98]"
                           >
                              <LogOut className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
                              {t('profile.logout')}
                           </button>

                           <p className="pt-1 text-center text-[11px] font-medium text-mc-text-3">
                              {t('profile.version')}
                           </p>
                        </div>
                     </div>
                  ) : (
                     <div className="pb-5">
                        <div className="flex items-center gap-2 px-4 pt-2.5 pb-2">
                           <button
                              type="button"
                              onClick={() => setView('menu')}
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-sm
                                         bg-mc-surface-2 text-mc-text transition-transform duration-150
                                         active:scale-95"
                              aria-label={t('profile.back', 'Ortga')}
                           >
                              <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2} />
                           </button>
                           <h1 className="min-w-0 truncate text-[15px] font-extrabold text-mc-text">
                              {view === 'personal' && t('profile.menu.personal', "Shaxsiy ma'lumotlar")}
                              {view === 'activity' && t('profile.menu.activity', 'Faollik tarixi')}
                           </h1>
                        </div>

                        <div className="space-y-2.5">
                           {view === 'personal' && (
                              <>
                                 <div className="px-4">
                                 <PersonalInfo
                                    user={user}
                                    isSensitiveVisible={isSensitiveVisible}
                                    onToggleSensitive={() => setIsSensitiveVisible((visible) => !visible)}
                                 />
                                 </div>
                                 {/* Scans are not shown here. The client login path
                                     needs only a client code and a phone number, so
                                     this screen is reachable by anyone holding both,
                                     and a scanned passport is the one thing on it that
                                     cannot be reissued. Adding one is a different
                                     matter — that uploads, it does not disclose — so
                                     the row below keeps that feature reachable. */}
                                 <MenuList
                                    items={[
                                       {
                                          id: 'extra-passports',
                                          label: t('profile.menu.extraPassports', "Qo'shimcha pasportlar"),
                                          Icon: FileText,
                                          onClick: () => setIsPassportsModalOpen(true),
                                       },
                                    ]}
                                 />
                              </>
                           )}
                           {view === 'activity' && (
                              <div className="px-4">
                                 <SessionHistory />
                              </div>
                           )}
                        </div>
                     </div>
                  )}
               </div>


               <WalletModal
                  isOpen={isWalletModalOpen}
                  onClose={() => setIsWalletModalOpen(false)}
               />
               <CardsManagerModal
                  isOpen={isCardsModalOpen}
                  onClose={() => setIsCardsModalOpen(false)}
               />
               <LegalDocumentModal
               open={isLegalOpen}
               onClose={() => setIsLegalOpen(false)}
               initialDoc={legalDoc}
            />

            <ExtraPassportsModal
                  isOpen={isPassportsModalOpen}
                  onClose={() => setIsPassportsModalOpen(false)}
               />

               <Suspense fallback={null}>
                  {isEditModalOpen && (
                     <EditProfileModal
                        isOpen={isEditModalOpen}
                        onClose={handleEditClose}
                        user={user}
                     />
                  )}
               </Suspense>

               {/* Logout Confirmation Modal */}
               <AnimatePresence>
                  {isLogoutModalOpen && (
                     <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           exit={{ opacity: 0 }}
                           onClick={() => setIsLogoutModalOpen(false)}
                           className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        
                        {/* Modal Content */}
                        <motion.div
                           initial={{ opacity: 0, scale: 0.95, y: 20 }}
                           animate={{ opacity: 1, scale: 1, y: 0 }}
                           exit={{ opacity: 0, scale: 0.95, y: 20 }}
                           className="relative w-full max-w-sm bg-mc-surface border border-mc-border dark:border-white/10 rounded-mc-lg p-6 shadow-2xl overflow-hidden"
                        >
                           <div className="flex flex-col items-center text-center">
                              <div className="w-16 h-16 bg-mc-danger-soft rounded-full flex items-center justify-center mb-4">
                                 <LogOut className="w-8 h-8 text-mc-danger" />
                              </div>
                              <h3 className="text-xl font-bold text-mc-text mb-2">
                                 {t('profile.logoutConfirm.title', 'Tizimdan chiqish')}
                              </h3>
                              <p className="text-sm text-mc-text-2 mb-6">
                                 {t('profile.logoutConfirm.description', 'Haqiqatan ham hisobingizdan chiqmoqchimisiz?')}
                              </p>
                              
                              <div className="flex w-full gap-3">
                                 <Button
                                    variant="outline"
                                    className="flex-1 h-12 rounded-mc-md bg-mc-surface-2 dark:bg-white/5 border-mc-border text-mc-text dark:text-mc-text-3"
                                    onClick={() => setIsLogoutModalOpen(false)}
                                 >
                                    {t('profile.logoutConfirm.cancel', 'Bekor qilish')}
                                 </Button>
                                 <Button
                                    variant="destructive"
                                    className="flex-1 h-12 rounded-mc-md bg-mc-danger shadow-lg shadow-red-500/20"
                                    onClick={handleLogout}
                                 >
                                    {t('profile.logoutConfirm.confirm', 'Chiqish')}
                                 </Button>
                              </div>
                           </div>
                        </motion.div>
                     </div>
                  )}
               </AnimatePresence>
            </motion.div>
         </AnimatePresence>
      </div>
   );
};

const ProfileSkeleton = memo(() => {
   return (
      <div className="min-h-dvh bg-mc-bg">
         <div className="mx-auto max-w-lg space-y-2.5 px-4 pt-6">
            <Skeleton className="h-[88px] w-full rounded-mc-lg" />
            <Skeleton className="h-[76px] w-full rounded-mc-lg" />
            <Skeleton className="h-[290px] w-full rounded-mc-lg" />
            <Skeleton className="h-[52px] w-full rounded-mc-lg" />
         </div>
      </div>
   );
});
ProfileSkeleton.displayName = 'ProfileSkeleton';

export default UserPage;
