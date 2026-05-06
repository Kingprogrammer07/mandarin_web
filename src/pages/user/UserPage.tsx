import { useProfile, useLogout } from '@/hooks/useProfile';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { QuickActions } from '@/components/profile/QuickActions';
import { PersonalInfo } from '@/components/profile/PersonalInfo';
import { SessionHistory } from '@/components/profile/SessionHistory';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LogOut, RefreshCw, UserCog, FileImage, ShieldCheck, X } from 'lucide-react';
import { useState, useCallback, lazy, Suspense, memo, useTransition, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { UniqueBackground } from '@/components/ui/UniqueBackground';
import { WalletModal } from '@/components/wallet/WalletModal';
import { CardsManagerModal } from '@/components/wallet/CardsManagerModal';
import { ExtraPassportsModal } from '@/components/profile/ExtraPassportsModal';

// Lazy load the heavy modal
const EditProfileModal = lazy(() => import('@/components/profile/EditProfileModal').then(module => ({ default: module.EditProfileModal })));

// --- Passport Images Component ---
const PassportImages = memo(({ images }: { images: string[] }) => {
   const { t } = useTranslation();
   const [selectedImage, setSelectedImage] = useState<string | null>(null);
   const [mounted, setMounted] = useState(false);

   useEffect(() => {
      queueMicrotask(() => setMounted(true));
   }, []);

   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === 'Escape') {
            setSelectedImage(null);
         }
      };

      if (selectedImage) {
         window.addEventListener('keydown', handleKeyDown);
      }
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [selectedImage]);

   if (!images || images.length === 0) {
      return (
         <div className="
            relative overflow-hidden rounded-3xl p-6 text-center
            bg-white/80 dark:bg-white/5 border border-white/20 dark:border-white/10
            backdrop-blur-md shadow-sm
         ">
            <div className="w-12 h-12 bg-gray-100 dark:bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400 dark:text-gray-500">
               <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('profile.documents.noDocuments')}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
               {t('profile.documents.noDocumentsDesc')}
            </p>
         </div>
      );
   }

   return (
      <>
         <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-200 ml-1 flex items-center gap-2">
               <span className="w-1 h-4 bg-emerald-500 rounded-full inline-block"></span>
               {t('profile.documents.title')}
            </h3>

            <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1 snap-x scrollbar-hide">
               {images.map((src, idx) => (
                  <div
                     key={idx}
                     className="
                        flex-shrink-0 relative overflow-hidden rounded-2xl
                        w-40 sm:w-48 aspect-[3/2] snap-start
                        bg-gray-100 dark:bg-white/5 border border-white/20 dark:border-white/10
                        shadow-sm group cursor-pointer
                     "
                     onClick={() => setSelectedImage(src)}
                  >
                     <img
                        src={src}
                        alt={`Passport ${idx + 1}`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                     />
                     <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                     <div className="absolute bottom-2 right-2 p-1.5 bg-black/40 backdrop-blur-md rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <FileImage className="w-4 h-4" />
                     </div>
                  </div>
               ))}
            </div>
         </div>

         {/* Lightbox Modal via Portal */}
         {mounted && createPortal(
            <AnimatePresence>
               {selectedImage && (
                  <motion.div
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     onClick={() => setSelectedImage(null)}
                     className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
                  >
                     <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative w-full max-w-5xl flex flex-col items-center justify-center outline-none"
                        onClick={(e) => e.stopPropagation()}
                     >
                        <button
                           onClick={() => setSelectedImage(null)}
                           className="
                              absolute -top-16 right-0 md:right-auto md:-top-16 md:relative md:self-end md:mb-4
                              p-3 text-white/80 hover:text-white 
                              bg-white/10 hover:bg-white/20 
                              rounded-full backdrop-blur-md 
                              transition-colors
                              z-50
                           "
                           aria-label="Close"
                        >
                           <X className="w-8 h-8" />
                        </button>
                        <img
                           src={selectedImage}
                           alt="Passport Preview"
                           className="
                              max-h-[80vh] md:max-h-[85vh] 
                              max-w-full md:max-w-[90vw] 
                              object-contain 
                              rounded-2xl shadow-2xl 
                              border border-white/10
                           "
                        />
                     </motion.div>
                  </motion.div>
               )}
            </AnimatePresence>,
            document.body
         )}
      </>
   );
});
PassportImages.displayName = 'PassportImages';

const UserPage = ({ onLogout }: { onLogout?: () => void }) => {
   const { data: user, isLoading, isError, refetch } = useProfile();
   const { mutate: logout } = useLogout(onLogout);
   const { t } = useTranslation();
   const [isEditModalOpen, setIsEditModalOpen] = useState(false);
   const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
   const [isCardsModalOpen, setIsCardsModalOpen] = useState(false);
   const [isPassportsModalOpen, setIsPassportsModalOpen] = useState(false);
   const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
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

   const handleRefetch = useCallback(() => {
      refetch();
   }, [refetch]);

   if (isLoading) {
      return <ProfileSkeleton />;
   }

   if (isError || !user) {
      return (
         <div className="flex w-full flex-col items-center justify-center min-h-[100vh] p-6 text-center bg-gray-50 dark:bg-[#0d0a04] pt-20">
            <UniqueBackground />
            <div className="relative z-10">
               <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6 animate-pulse mx-auto">
                  <LogOut className="h-8 w-8 text-red-500" />
               </div>
               <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('profile.error.title')}</h2>
               <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs mx-auto">
                  {t('profile.error.description')}
               </p>
               <Button
                  onClick={handleRefetch}
                  size="lg"
                  className="rounded-xl bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20"
               >
                  <RefreshCw className="mr-2 h-5 w-5" />
                  {t('profile.error.retry')}
               </Button>
            </div>
         </div>
      );
   }

   return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0d0a04] text-gray-900 dark:text-white transition-colors duration-500 font-sans">
         <UniqueBackground />

         <AnimatePresence mode="wait">
            <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="relative z-10"
            >
               {/* Desktop Container Wrapper */}
               <div className="md:container md:mx-auto md:max-w-7xl md:p-6 lg:p-8">
                  <div className="flex flex-col md:grid md:grid-cols-12 md:gap-8 md:items-start md:mt-12 pb-10">

                     {/* LEFT COLUMN (Desktop): Profile Hero & Quick Actions */}
                     <aside className="w-full md:col-span-5 lg:col-span-4 md:sticky md:top-8 self-start z-30">
                        {/* Hero Section - Glass Effect */}
                        <div className="relative overflow-hidden rounded-b-[2.5rem] md:rounded-[2.5rem] shadow-2xl border-b border-white/10 md:border md:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-xl">
                           <ProfileHero user={user} onBalanceClick={() => setIsWalletModalOpen(true)} />
                        </div>

                        {/* Desktop Only: Quick Actions & Buttons moved here */}
                        <div className="hidden md:flex flex-col gap-6 mt-6">
                           <QuickActions
                              onWalletClick={() => setIsWalletModalOpen(true)}
                              onCardsClick={() => setIsCardsModalOpen(true)}
                              onPassportsClick={() => setIsPassportsModalOpen(true)}
                           />

                           {/* Passport Images (Desktop) */}
                           <PassportImages images={user.passport_images} />

                           <div className="space-y-3">
                              <Button
                                 variant="outline"
                                 className="w-full h-14 rounded-2xl text-lg font-medium shadow-sm border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 active:scale-95 transition-all text-gray-700 dark:text-gray-200"
                                 onClick={handleEditOpen}
                              >
                                 {isModalLoading ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <UserCog className="mr-2 h-5 w-5" />}
                                 {isModalLoading ? t('profile.edit.loading') : t('profile.editProfile')}
                              </Button>
                              <Button
                                 variant="destructive"
                                 className="w-full h-14 rounded-2xl text-lg font-medium shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all active:scale-95"
                                 onClick={() => setIsLogoutModalOpen(true)}
                              >
                                 <LogOut className="mr-2 h-5 w-5" />
                                 {t('profile.logout')}
                              </Button>
                              <p className="text-center text-xs text-gray-400 mt-2">
                                 {t('profile.version')}
                              </p>
                           </div>
                        </div>
                     </aside>

                     {/* RIGHT COLUMN (Desktop): Main Content */}
                     <main className="w-full md:col-span-7 lg:col-span-8 relative z-20 md:mt-0 px-4 md:px-0">
                        {/* Mobile Negative Margin Wrapper */}
                        <div className="mt-6 md:mt-0 pb-10 md:pb-0 space-y-5 md:space-y-6">

                           {/* Mobile Only: Quick Actions */}
                           <div className="md:hidden max-w-md mx-auto w-full">
                              <QuickActions
                                 onWalletClick={() => setIsWalletModalOpen(true)}
                                 onCardsClick={() => setIsCardsModalOpen(true)}
                                 onPassportsClick={() => setIsPassportsModalOpen(true)}
                              />
                           </div>

                           {/* Mobile Only: Passport Images */}
                           <div className="md:hidden max-w-md mx-auto w-full">
                              <PassportImages images={user.passport_images} />
                           </div>

                           <PersonalInfo user={user} />

                           <SessionHistory />

                           {/* Mobile Only: Buttons */}
                           <div className="md:hidden max-w-md mx-auto space-y-3 pt-4 px-4">
                              <Button
                                 variant="outline"
                                 className="w-full h-14 rounded-2xl text-lg font-medium shadow-sm border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 active:scale-95 transition-all text-gray-700 dark:text-gray-200"
                                 onClick={handleEditOpen}
                              >
                                 {isModalLoading ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <UserCog className="mr-2 h-5 w-5" />}
                                 {isModalLoading ? t('profile.edit.loading') : t('profile.editProfile')}
                              </Button>
                              <Button
                                 variant="destructive"
                                 className="w-full h-14 rounded-2xl text-lg font-medium shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all active:scale-95"
                                 onClick={() => setIsLogoutModalOpen(true)}
                              >
                                 <LogOut className="mr-2 h-5 w-5" />
                                 {t('profile.logout')}
                              </Button>
                              <p className="text-center text-xs text-gray-400 mt-4 pb-8">
                                 {t('profile.version')}
                              </p>
                           </div>
                        </div>
                     </main>

                  </div>
               </div>

               <WalletModal
                  isOpen={isWalletModalOpen}
                  onClose={() => setIsWalletModalOpen(false)}
               />
               <CardsManagerModal
                  isOpen={isCardsModalOpen}
                  onClose={() => setIsCardsModalOpen(false)}
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
                           className="relative w-full max-w-sm bg-white dark:bg-[#120e09] border border-gray-100 dark:border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden"
                        >
                           <div className="flex flex-col items-center text-center">
                              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                                 <LogOut className="w-8 h-8 text-red-500" />
                              </div>
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                 {t('profile.logoutConfirm.title', 'Tizimdan chiqish')}
                              </h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                 {t('profile.logoutConfirm.description', 'Haqiqatan ham hisobingizdan chiqmoqchimisiz?')}
                              </p>
                              
                              <div className="flex w-full gap-3">
                                 <Button
                                    variant="outline"
                                    className="flex-1 h-12 rounded-xl bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10"
                                    onClick={() => setIsLogoutModalOpen(false)}
                                 >
                                    {t('profile.logoutConfirm.cancel', 'Bekor qilish')}
                                 </Button>
                                 <Button
                                    variant="destructive"
                                    className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20"
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
      <div className="min-h-screen bg-gray-50 dark:bg-[#0d0a04]">
         <div className="bg-[#1e1a45]/50 pt-25 pb-24 px-6 rounded-b-[3rem] h-80 relative mb-24 overflow-hidden">
            <div className="flex flex-col items-center relative z-10">
               <Skeleton className="w-28 h-28 rounded-full mb-4 bg-white/10" />
               <Skeleton className="h-8 w-48 bg-white/10 mb-2 rounded-lg" />
               <Skeleton className="h-6 w-32 bg-white/10 rounded-full" />
            </div>
         </div>

         <div className="container max-w-md mx-auto px-6 -mt-16 relative z-10 space-y-8">
            <div className="grid grid-cols-3 gap-4">
               <Skeleton className="h-24 w-full rounded-2xl bg-gray-200 dark:bg-white/5" />
               <Skeleton className="h-24 w-full rounded-2xl bg-gray-200 dark:bg-white/5" />
               <Skeleton className="h-24 w-full rounded-2xl bg-gray-200 dark:bg-white/5" />
            </div>

            <div className="space-y-4">
               <Skeleton className="h-6 w-40 bg-gray-200 dark:bg-white/5 rounded-lg" />
               <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                     <Skeleton key={i} className="h-20 w-full rounded-2xl bg-gray-200 dark:bg-white/5" />
                  ))}
               </div>
            </div>
         </div>
      </div>
   );
});
ProfileSkeleton.displayName = 'ProfileSkeleton';

export default UserPage;
