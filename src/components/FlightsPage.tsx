import { useState, useEffect, useCallback } from 'react';
import { getFlights, type Flight } from '@/api/services/flight';
import { useTranslation } from 'react-i18next';
import { offlineStorage } from '@/utils/offlineStorage';
import { Plane, ChevronDown, ChevronRight, RefreshCw, WifiOff, ArrowRight, Lock, LogOut } from 'lucide-react';
import { getAdminJwtClaims } from '@/api/services/adminManagement';

interface FlightsPageProps {
  onSelectFlight: (flightName: string) => void;
  onLogout?: () => void;
}

/** Split "M123-2025" → { code: "M123", year: "2025" } */
function parseFlightName(name: string): { code: string; year: string | null } {
  const idx = name.lastIndexOf('-');
  if (idx !== -1) {
    const suffix = name.slice(idx + 1);
    if (/^\d{4}$/.test(suffix)) return { code: name.slice(0, idx), year: suffix };
  }
  return { code: name, year: null };
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
        <Lock className="w-8 h-8 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[16px] font-bold text-gray-700 dark:text-gray-300">Ruxsat yo'q</p>
        <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
          Sizda ushbu sahifani ko'rish yoki tahrirlash uchun huquq yo'q.
        </p>
      </div>
    </div>
  );
}

export default function FlightsPage({ onSelectFlight, onLogout }: FlightsPageProps) {
  const { t } = useTranslation();
  const jwtClaims = getAdminJwtClaims();
  const canView = jwtClaims.isSuperAdmin || jwtClaims.permissions.has('flights:read');
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [offlineCounts, setOfflineCounts] = useState<Record<string, number>>({});

  const loadFlights = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true); else setIsLoading(true);
    try {
      const data = await getFlights(5);
      const ordered = data.flights.reverse();
      setFlights(ordered);
      const counts: Record<string, number> = {};
      await Promise.all(
        ordered.map(async (f) => {
          try {
            const items = await offlineStorage.getAllItems(f.name);
            if (items.length > 0) counts[f.name] = items.length;
          } catch { /* silent */ }
        }),
      );
      setOfflineCounts(counts);
    } catch { /* keep existing */ } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { loadFlights(); }, [loadFlights]);

  if (!canView) return <AccessDenied />;

  const recent = flights.slice(0, 3);
  const old = flights.slice(3);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-4">
        <PageHeader t={t} count={0} isRefreshing={false} onRefresh={() => {}} onLogout={onLogout} loading />
        <div className="space-y-3">
          <div className="h-4 w-28 bg-gray-100 dark:bg-white/[0.05] rounded-lg mb-2" />
          <div className="bg-white dark:bg-[#0d0a04] rounded-2xl border border-gray-100 dark:border-white/[0.06] overflow-hidden">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-gray-50 dark:border-white/[0.03] last:border-0">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-24 bg-gray-100 dark:bg-white/5 rounded-md" />
                  <div className="h-2.5 w-16 bg-gray-50 dark:bg-white/[0.03] rounded-md" />
                </div>
                <div className="w-4 h-4 rounded-full bg-gray-100 dark:bg-white/5 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <PageHeader t={t} count={flights.length} isRefreshing={isRefreshing} onRefresh={() => loadFlights(true)} onLogout={onLogout} />

      {flights.length === 0 ? (
        <div className="bg-white dark:bg-[#0d0a04] rounded-2xl border border-gray-100 dark:border-white/[0.06] flex flex-col items-center justify-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/15 flex items-center justify-center mb-4">
            <Plane className="w-7 h-7 text-orange-300 dark:text-orange-500/50" />
          </div>
          <p className="text-sm font-black text-gray-500 dark:text-gray-400">{t('flights.noFlights')}</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Recent flights */}
          <section>
            <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-1">
              So'nggi reyslar
            </p>
            <div className="bg-white dark:bg-[#0d0a04] rounded-2xl border border-orange-100/60 dark:border-orange-500/10 shadow-sm overflow-hidden">
              <div className="h-[2px] bg-gradient-to-r from-transparent via-orange-400/40 dark:via-orange-500/25 to-transparent" />
              <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                {recent.map(f => (
                  <FlightRow
                    key={f.name}
                    flight={f}
                    offlineCount={offlineCounts[f.name] ?? 0}
                    isRecent
                    onSelect={() => onSelectFlight(f.name)}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Older flights */}
          {old.length > 0 && (
            <section>
              <button
                onClick={() => setShowOld(v => !v)}
                className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showOld ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                {t('flights.oldFlights')} ({old.length})
              </button>
              {showOld && (
                <div className="bg-white dark:bg-[#0d0a04] rounded-2xl border border-gray-100 dark:border-white/[0.06] shadow-sm overflow-hidden">
                  <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                    {old.map(f => (
                      <FlightRow
                        key={f.name}
                        flight={f}
                        offlineCount={offlineCounts[f.name] ?? 0}
                        isRecent={false}
                        onSelect={() => onSelectFlight(f.name)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function PageHeader({ t, count, isRefreshing, onRefresh, onLogout, loading = false }: {
  t: (k: string) => string;
  count: number;
  isRefreshing: boolean;
  onRefresh: () => void;
  onLogout?: () => void;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">{t('flights.title')}</h1>
        {!loading && (
          <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
            {count} ta reys mavjud
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={isRefreshing || loading}
          className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-gray-500 dark:text-gray-400 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl hover:border-orange-300 dark:hover:border-orange-500/30 hover:text-orange-600 dark:hover:text-orange-400 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          Yangilash
        </button>
        {onLogout && (
          <button
            onClick={onLogout}
            title="Chiqish"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function FlightRow({ flight, offlineCount, isRecent, onSelect }: {
  flight: Flight;
  offlineCount: number;
  isRecent: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const { code, year } = parseFlightName(flight.name);

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-orange-50/40 dark:hover:bg-orange-500/[0.05] text-left transition-colors active:scale-[0.99]"
    >
      {/* Flight icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        isRecent
          ? 'bg-orange-100 dark:bg-orange-500/10 border border-orange-200/60 dark:border-orange-500/20'
          : 'bg-gray-100 dark:bg-white/5 border border-gray-200/60 dark:border-white/[0.06]'
      }`}>
        <Plane className={`w-5 h-5 ${isRecent ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'}`} />
      </div>

      {/* Name + source */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-black text-gray-900 dark:text-white">{code}</span>
          {year && <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500">{year}</span>}
        </div>
        <span className="text-[11px] text-gray-400 dark:text-gray-500 hidden sm:block">
          {t('flights.fromGoogleSheets')}
        </span>
      </div>

      {/* Badges + arrow */}
      <div className="flex items-center gap-2 shrink-0">
        {isRecent && (
          <span className="text-[10px] font-bold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border border-orange-200/60 dark:border-orange-500/20 px-2 py-0.5 rounded-full hidden sm:inline-flex">
            Yangi
          </span>
        )}
        {offlineCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 px-1.5 py-0.5 rounded-full">
            <WifiOff className="w-2.5 h-2.5" />{offlineCount}
          </span>
        )}
        <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-500" />
      </div>
    </button>
  );
}
