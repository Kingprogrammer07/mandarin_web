import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Shield, Clock, LogOut, Sun, Moon, User, Layers } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

const navItems = [
  { id: 'admin-accounts', label: 'Adminlar',  icon: Users,   description: 'Hisoblar boshqaruvi' },
  { id: 'admin-roles',    label: 'Rollar',    icon: Shield,  description: 'Huquqlar tizimi' },
  { id: 'admin-carousel', label: 'Karusel',   icon: Layers,  description: 'Banner & reklama' },
  { id: 'admin-audit',    label: 'Audit',     icon: Clock,   description: 'Faoliyat tarixi' },
  { id: 'admin-profile',  label: 'Profil',    icon: User,    description: 'Shaxsiy sozlamalar' },
];

function getInitialTheme() {
  return localStorage.getItem('adminTheme') === 'dark' ||
    (!('adminTheme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

export default function AdminLayout({ children, currentPage, onNavigate, onLogout }: AdminLayoutProps) {
  const [isDark, setIsDark] = useState(getInitialTheme);

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('adminTheme', newTheme ? 'dark' : 'light');
    if (newTheme) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const handleNav = (id: string) => {
    onNavigate(id);
  };

  return (
    <div className="fixed inset-0 flex bg-[#f5f5f4] dark:bg-[#09090b] text-gray-900 dark:text-gray-100 transition-colors z-50">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-[260px] border-r border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-[#0f0f0f] shrink-0 z-20">

        {/* Brand */}
        <div className="p-6 pb-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Shield className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-gray-900 dark:text-white tracking-tight">
                Super Admin
              </h1>
              <p className="text-[11px] text-gray-400 dark:text-gray-600">
                Boshqaruv paneli
              </p>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="mx-5 h-px bg-gray-100 dark:bg-white/[0.05]" />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-1">
          <p className="px-3 mb-3 text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-[0.12em]">
            Asosiy
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => handleNav(item.id)}
                whileTap={{ scale: 0.97 }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all relative ${
                  isActive
                    ? 'bg-orange-500/[0.08] dark:bg-orange-500/[0.12] text-orange-600 dark:text-orange-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/70 dark:hover:bg-white/[0.04]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-orange-500 rounded-full"
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  />
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  isActive 
                    ? 'bg-orange-500/[0.12] dark:bg-orange-500/[0.15]'
                    : 'bg-gray-100/80 dark:bg-white/[0.05]'
                }`}>
                  <Icon className={`w-[16px] h-[16px] ${isActive ? 'text-orange-500' : ''}`} strokeWidth={2} />
                </div>
                <div className="text-left">
                  <div className="leading-tight">{item.label}</div>
                  <div className={`text-[10px] font-normal mt-px ${isActive ? 'text-orange-500/60' : 'text-gray-400 dark:text-gray-600'}`}>
                    {item.description}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-gray-100 dark:border-white/[0.05] shrink-0 space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100/70 dark:hover:bg-white/[0.04] transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100/80 dark:bg-white/[0.05] flex items-center justify-center">
              {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </div>
            {isDark ? 'Tungi rejim' : 'Kunduzgi rejim'}
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-red-500/80 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/[0.08] flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
            Chiqish
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col relative overflow-hidden">

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-[#0f0f0f]/80 backdrop-blur-2xl border-b border-black/[0.05] dark:border-white/[0.06] z-20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[15px] text-gray-900 dark:text-white">Admin</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 active:bg-gray-100 dark:active:bg-white/10 rounded-lg transition-colors"
            >
              {isDark ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
            </button>
            <button
              onClick={onLogout}
              className="p-2 text-red-500/80 active:bg-red-50 dark:active:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto pb-24 md:pb-0 relative scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="min-h-full p-4 md:p-8 lg:p-10"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── Mobile Bottom Navigation ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0f0f0f]/95 backdrop-blur-2xl border-t border-black/[0.05] dark:border-white/[0.06] z-30 px-1 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))]">
        <div className="flex justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className="flex flex-col items-center py-1.5 px-3 min-w-[60px] transition-transform active:scale-90 touch-manipulation relative"
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-active"
                    className="absolute -top-1 w-6 h-[3px] bg-orange-500 rounded-full"
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  />
                )}
                <div className={`p-1.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-orange-500'
                    : 'text-gray-400 dark:text-gray-500'
                }`}>
                  <Icon
                    className="w-[22px] h-[22px]"
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                </div>
                <span className={`text-[10px] mt-0.5 font-semibold transition-colors duration-200 ${
                  isActive ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-gray-600'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}