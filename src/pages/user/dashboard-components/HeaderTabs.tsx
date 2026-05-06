import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, ScanBarcode, Calendar } from 'lucide-react';
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
      background: 'linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(234,88,12,0.15) 100%)',
      boxShadow: '0 2px 16px rgba(245,158,11,0.2), inset 0 0 0 1px rgba(245,158,11,0.3)',
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
      background: 'rgba(26,18,8,0.85)',
      border: '1px solid rgba(180,83,9,0.35)',
      boxShadow: '0 0 0 1px rgba(245,158,11,0.08), 0 8px 32px rgba(0,0,0,0.5)',
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

  const activeTextClass = dark ? 'text-amber-300' : 'text-gray-900';
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
    <div className="relative mt-14 mb-6 z-10">
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
      </div>

      {dark && (
        <div
          style={{
            position: 'absolute',
            bottom: '-10px',
            left: isHome ? '15%' : '55%',
            width: isHome ? '25%' : '30%',
            height: '1px',
            background: 'linear-gradient(to right, transparent, rgba(245,158,11,0.7), transparent)',
            transition: 'all 400ms cubic-bezier(0.34,1.56,0.64,1)',
          }}
        />
      )}
    </div>
  );
});
HeaderTabs.displayName = 'HeaderTabs';
