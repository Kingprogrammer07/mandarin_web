import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Home, ScanBarcode, ShieldAlert } from 'lucide-react';
import { useDarkMode } from './useDarkMode';

export const HeaderTabs = memo(({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (t: string) => void }) => {
  const isHome = activeTab === 'home';
  const dark = useDarkMode();
  const { t } = useTranslation();

  const indicatorStyle: React.CSSProperties = dark
    ? {
      position: 'absolute',
      top: '4px',
      bottom: '4px',
      left: isHome ? '4px' : 'calc(50% + 2px)',
      right: isHome ? 'calc(50% + 2px)' : '4px',
      borderRadius: '10px',
      background: 'linear-gradient(135deg, rgba(255,138,31,0.95) 0%, rgba(251,191,36,0.86) 100%)',
      boxShadow: '0 8px 20px rgba(249,115,22,0.22), inset 0 1px 0 rgba(255,255,255,0.28)',
      transition: 'all 300ms cubic-bezier(0.34,1.56,0.64,1)',
    }
    : {
      position: 'absolute',
      top: '4px',
      bottom: '4px',
      left: isHome ? '4px' : 'calc(50% + 2px)',
      right: isHome ? 'calc(50% + 2px)' : '4px',
      borderRadius: '10px',
      background: '#ffffff',
      boxShadow: '0 1px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
      transition: 'all 300ms cubic-bezier(0.34,1.56,0.64,1)',
    };

  const wrapperStyle: React.CSSProperties = dark
    ? {
      background: 'rgba(10,14,21,0.78)',
      border: '1px solid rgba(251,146,60,0.16)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 34px rgba(0,0,0,0.26)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }
    : {
      background: 'rgba(255,255,255,0.9)',
      border: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    };

  const activeTextClass = dark ? 'text-orange-950' : 'text-gray-900';
  const inactiveTextClass = dark
    ? 'text-white/35 hover:text-white/55'
    : 'text-gray-400 hover:text-gray-600';

  const iconProps = (isActive: boolean) => ({
    className: 'transition-all duration-300',
    style: {
      width: 16,
      height: 16,
      transform: isActive ? 'scale(1.15)' : 'scale(1)',
      strokeWidth: isActive ? 2.5 : 2,
    },
  });

  const tabLabel = activeTab === 'track' ? t('dashboard.tabs.track')
    : activeTab === 'schedule' ? t('dashboard.tabs.schedule')
    : activeTab === 'request' ? t('dashboard.tabs.request')
    : activeTab === 'delivery_history' ? t('dashboard.tabs.history')
    : t('dashboard.tabs.track');

  return (
    <div className="relative mb-5 z-10">
      <div className="relative flex rounded-2xl p-1 gap-1" style={wrapperStyle}>
        <div style={indicatorStyle} />

        <button
          onClick={() => setActiveTab('home')}
          className={`
            relative z-10 flex-1 flex items-center justify-center gap-2
            py-[11px] px-4 rounded-[10px] text-sm font-semibold
            transition-colors duration-200 select-none outline-none
            ${isHome ? activeTextClass : inactiveTextClass}
          `}
        >
          <Home {...iconProps(isHome)} />
          <span>{t('dashboard.tabs.home')}</span>
        </button>

        <button
          onClick={() => setActiveTab('track')}
          className={`
            relative z-10 flex-1 flex items-center justify-center gap-2
            py-[11px] px-4 rounded-[10px] text-sm font-semibold
            transition-colors duration-200 select-none outline-none
            ${!isHome ? activeTextClass : inactiveTextClass}
          `}
        >
          {activeTab === 'schedule' ? <Calendar {...iconProps(!isHome)} /> : <ScanBarcode {...iconProps(!isHome)} />}
          <span>{tabLabel}</span>
        </button>

        <span
          className="
            pointer-events-none absolute -right-1 -top-2 z-20 inline-flex items-center gap-1
            rounded-full border border-orange-200/70 bg-white px-2 py-0.5
            text-[9px] font-black uppercase tracking-wide text-orange-600
            shadow-[0_8px_18px_rgba(15,23,42,0.08)]
            dark:border-orange-300/18 dark:bg-[#121824] dark:text-amber-300
            dark:shadow-[0_10px_24px_rgba(0,0,0,0.24)]
          "
        >
          <ShieldAlert className="h-3 w-3" />
          Beta
        </span>
      </div>

      {dark && (
        <div
          style={{
            position: 'absolute',
            bottom: '-10px',
            left: isHome ? '15%' : '55%',
            width: isHome ? '25%' : '30%',
            height: '1px',
            background: 'linear-gradient(to right, transparent, rgba(254,215,170,0.7), transparent)',
            transition: 'all 400ms cubic-bezier(0.34,1.56,0.64,1)',
          }}
        />
      )}
    </div>
  );
});
HeaderTabs.displayName = 'HeaderTabs';
