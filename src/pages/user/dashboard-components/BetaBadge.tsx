import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, MessageSquare } from 'lucide-react';

export const BetaBadge = memo(() => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="absolute top-4 right-4 sm:top-8 sm:right-4 z-50 mt-12">
      {/* The Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:border-amber-500/40 backdrop-blur-md transition-all shadow-sm active:scale-95"
      >
        {/* Ping Animation Dot */}
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border-2 border-white dark:border-[#0d0a04]"></span>
        </span>

        <ShieldAlert className="w-3.5 h-3.5" />
        <span className="text-[10px] sm:text-xs font-bold tracking-widest uppercase">
          {t('beta.badge', 'Beta')}
        </span>
      </button>

      {/* The Popup Content */}
      {isOpen && (
        <>
          {/* Backdrop for closing when clicked outside */}
          <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 top-12 w-72 sm:w-80 p-5 bg-white/95 dark:bg-[#1a1814]/95 backdrop-blur-xl border border-amber-100 dark:border-amber-900/30 rounded-2xl shadow-2xl z-[70] animate-in fade-in slide-in-from-top-2 zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                {t('beta.title', 'Beta Versiya')}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
              {t('beta.desc', 'Platforma hozirda sinov (beta) rejimida ishlamoqda. Ayrim xatoliklar yoki kamchiliklar kuzatilishi mumkin. Agar biron muammoga duch kelsangiz, iltimos bizga xabar bering.')}
            </p>
            <button
              onClick={() => window.open('https://t.me/mandarin_admin', '_blank')}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-amber-500/25 transition-all active:scale-[0.98]"
            >
              <MessageSquare className="w-4 h-4" />
              {t('beta.action', 'Adminga yozish')}
            </button>
          </div>
        </>
      )}
    </div>
  );
});
BetaBadge.displayName = 'BetaBadge';
