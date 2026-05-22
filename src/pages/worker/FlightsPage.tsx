import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  ChevronDown,
  Clock,
  Database,
  FileImage,
  LogOut,
  Package,
  Plane,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  Weight,
  X,
} from 'lucide-react';
import { getAdminJwtClaims } from '@/api/services/adminManagement';
import { refreshAdminToken } from '@/api/services/adminAuth';
import { createEmptyFlight } from '@/api/services/expectedCargo';
import type { FlightDashboardItem } from '@/api/services/flightSchedule';
import RoleSwitcher from '@/components/admin/RoleSwitcher';
import { useFlightsPageStore } from '@/store/useFlightsPageStore';

interface FlightsPageProps {
  onSelectFlight: (flightName: string) => void;
  onLogout?: () => void;
  onNavigate?: (page: string) => void;
}

type SectionTone = 'blue' | 'green' | 'violet';

function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/[0.06]">
        <ShieldAlert className="h-8 w-8 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[16px] font-bold text-gray-700 dark:text-gray-300">Ruxsat yo'q</p>
        <p className="mt-1 max-w-xs text-[13px] text-gray-400 dark:text-gray-500">
          Sizda ushbu sahifani ko'rish yoki tahrirlash uchun huquq yo'q.
        </p>
      </div>
    </div>
  );
}

function getApiError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const detail = (error as { data?: { detail?: unknown } }).data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
  }
  return 'Xatolik yuz berdi';
}

function parseFlightName(name: string): { code: string; year: string | null } {
  const idx = name.lastIndexOf('-');
  if (idx !== -1) {
    const suffix = name.slice(idx + 1);
    if (/^\d{4}$/.test(suffix)) return { code: name.slice(0, idx), year: suffix };
  }
  return { code: name, year: null };
}

function formatKg(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}t`;
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}kg`;
}

function getFlightLabel(flight: FlightDashboardItem): string {
  if (flight.source === 'expected_cargo') return 'Expected cargo';
  if (flight.type === 'ostatka') return 'Ostatka';
  if (flight.type === 'avia') return 'Google Sheet';
  return 'Expected cargo';
}

function DashboardSection({
  icon,
  title,
  subtitle,
  count,
  tone,
  isOpen,
  onToggle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  count?: number;
  tone: SectionTone;
  isOpen: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  const toneClasses: Record<SectionTone, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-black text-gray-900 dark:text-white">
            {title}{typeof count === 'number' ? ` (${count} ta)` : ''}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-gray-500 dark:text-gray-400">
            {subtitle}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && <div className="border-t border-gray-100 dark:border-white/[0.06]">{children}</div>}
    </section>
  );
}

function FlightRow({
  flight,
  onClick,
  compact = false,
}: {
  flight: FlightDashboardItem;
  onClick: () => void;
  compact?: boolean;
}) {
  const { code, year } = parseFlightName(flight.name);
  const remainingCargo = flight.stats.remaining_cargos;
  const remainingClients = flight.stats.remaining_clients;
  const remainingWeight = flight.stats.remaining_weight_kg;
  const hasRemaining = remainingCargo > 0;
  const isNew = flight.is_new || flight.status === 'new';

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 border-b border-gray-100 px-3 py-3 text-left last:border-b-0 hover:bg-orange-50/60 dark:border-white/[0.06] dark:hover:bg-orange-500/[0.05]"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          isNew
            ? 'bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400'
            : 'bg-orange-50 text-orange-500 dark:bg-orange-500/10 dark:text-orange-400'
        }`}
      >
        {isNew ? <Clock className="h-5 w-5" /> : <Plane className="h-5 w-5" />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-black text-gray-900 dark:text-white">
            {code}
          </span>
          {year && <span className="text-[12px] font-semibold text-gray-400">{year}</span>}
          {isNew && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
              Yangi
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[11px] text-gray-400 dark:text-gray-500">
          {getFlightLabel(flight)} reysi
        </span>

        <span className={`mt-1.5 flex flex-wrap items-center gap-2 ${compact ? 'text-[11px]' : 'text-[12px]'}`}>
          <Metric icon={<Package className="h-3.5 w-3.5" />} value={hasRemaining ? `${remainingCargo} qoldi` : `${flight.stats.cargo_count} yuk`} />
          <Metric icon={<Users className="h-3.5 w-3.5" />} value={hasRemaining ? `${remainingClients} odam` : `${flight.stats.client_count} mijoz`} />
          <Metric icon={<Weight className="h-3.5 w-3.5" />} value={formatKg(hasRemaining ? remainingWeight : flight.stats.total_weight_kg)} />
          {isNew && flight.stats.expected_track_codes > 0 && (
            <Metric icon={<Boxes className="h-3.5 w-3.5" />} value={`${flight.stats.expected_track_codes} trek`} />
          )}
        </span>
      </span>

      <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-orange-500 dark:text-gray-600" />
    </button>
  );
}

function Metric({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 font-bold text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
      {icon}
      {value}
    </span>
  );
}

function FlightListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-gray-100 dark:bg-white/[0.06]" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-28 animate-pulse rounded bg-gray-100 dark:bg-white/[0.06]" />
            <div className="h-2.5 w-40 animate-pulse rounded bg-gray-100 dark:bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <Plane className="h-10 w-10 text-gray-200 dark:text-white/[0.08]" />
      <p className="text-[13px] font-medium text-gray-400 dark:text-gray-500">{message}</p>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  const visiblePages = totalPages <= 5
    ? pages
    : page <= 3
      ? [1, 2, 3, 4, totalPages]
      : page >= totalPages - 2
        ? [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
        : [1, page - 1, page, page + 1, totalPages];

  return (
    <div className="flex items-center justify-center gap-1.5 px-3 py-4">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 disabled:opacity-40 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-400"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>
      {visiblePages.map((item, index) => {
        const showGap = index > 0 && item - visiblePages[index - 1] > 1;
        return (
          <span key={item} className="flex items-center gap-1.5">
            {showGap && <span className="text-xs font-bold text-gray-300">...</span>}
            <button
              type="button"
              onClick={() => onPageChange(item)}
              className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[12px] font-black ${
                item === page
                  ? 'bg-orange-500 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300'
              }`}
            >
              {item}
            </button>
          </span>
        );
      })}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 disabled:opacity-40 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-400"
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function FlightsPage({ onSelectFlight, onLogout, onNavigate }: FlightsPageProps) {
  const [jwtClaims, setJwtClaims] = useState(() => getAdminJwtClaims());
  const canView = jwtClaims.isSuperAdmin || jwtClaims.permissions.has('flights:read');
  const canManage = jwtClaims.isSuperAdmin || jwtClaims.permissions.has('expected_cargo:manage');

  const {
    flights,
    featuredFlights,
    total,
    totalPages,
    page,
    perPage,
    searchQuery,
    typeFilter,
    showCompleted,
    sort,
    isLoading,
    isRefreshing,
    isFeaturedLoading,
    error,
    fetchFlights,
    fetchFeaturedFlights,
    setPage,
    setPerPage,
    setSearchQuery,
    setTypeFilter,
    setShowCompleted,
    setSort,
    refresh,
  } = useFlightsPageStore();

  const [photoOpen, setPhotoOpen] = useState(true);
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newFlightName, setNewFlightName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const flightNameInputRef = useRef<HTMLInputElement>(null);
  const visibleFeaturedFlights = [...featuredFlights].reverse();

  useEffect(() => {
    let cancelled = false;
    refreshAdminToken()
      .then((data) => {
        if (cancelled) return;
        localStorage.setItem('access_token', data.access_token);
        setJwtClaims(getAdminJwtClaims());
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    void fetchFeaturedFlights();
    void fetchFlights();
  }, [fetchFeaturedFlights, fetchFlights]);

  useEffect(() => {
    if (addModalOpen) {
      setTimeout(() => flightNameInputRef.current?.focus(), 50);
    } else {
      setNewFlightName('');
      setCreateError(null);
    }
  }, [addModalOpen]);

  if (!canView) return <AccessDenied />;

  async function handleRefresh() {
    await refresh();
  }

  async function handleCreateFlight(e: FormEvent) {
    e.preventDefault();
    const name = newFlightName.trim();
    if (!name) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      await createEmptyFlight({ flight_name: name });
      await refresh();
      setAddModalOpen(false);
    } catch (err) {
      setCreateError(getApiError(err));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] dark:bg-[#090909]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4 pb-8">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-black tracking-tight text-gray-950 dark:text-white">
              Reys tanlang
            </h1>
            <p className="mt-0.5 text-[13px] font-medium text-gray-500 dark:text-gray-400">
              {total} ta reys mavjud
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onNavigate && <RoleSwitcher onNavigate={onNavigate} />}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:text-orange-500 disabled:opacity-50 dark:border-white/[0.08] dark:bg-[#111] dark:text-gray-400"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-orange-200 bg-white px-3 text-[12px] font-black text-orange-600 shadow-sm transition-colors hover:bg-orange-50 dark:border-orange-500/20 dark:bg-[#111] dark:text-orange-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Reys qo'shish
              </button>
            )}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Chiqish"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:border-white/[0.08] dark:bg-[#111] dark:hover:bg-red-500/[0.08]"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}

        <DashboardSection
          icon={<FileImage className="h-5 w-5" />}
          title="Foto hisobot yuklash"
          subtitle="Reysni tanlang va foto hisobot sahifasiga o'ting"
          count={visibleFeaturedFlights.length}
          tone="blue"
          isOpen={photoOpen}
          onToggle={() => setPhotoOpen((value) => !value)}
        >
          {isFeaturedLoading && visibleFeaturedFlights.length === 0 ? (
            <FlightListSkeleton />
          ) : visibleFeaturedFlights.length === 0 ? (
            <EmptyState message="Faol yoki yangi reys topilmadi" />
          ) : (
            <div>
              {visibleFeaturedFlights.map((flight) => (
                <FlightRow
                  key={flight.name}
                  flight={flight}
                  compact
                  onClick={() => onSelectFlight(flight.name)}
                />
              ))}
            </div>
          )}
        </DashboardSection>

        {canManage && (
          <button
            type="button"
            onClick={() => onNavigate?.('expected-cargo')}
            className="flex w-full items-center gap-3 rounded-2xl border border-gray-200/80 bg-white px-4 py-4 text-left shadow-sm transition-colors hover:bg-green-50 dark:border-white/[0.08] dark:bg-[#111] dark:hover:bg-green-500/[0.05]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400">
              <Boxes className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-black text-gray-900 dark:text-white">
                Trek kod yuklash
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-gray-500 dark:text-gray-400">
                Trek kodlarni yuklang va tizimga import qiling
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" />
          </button>
        )}

        <DashboardSection
          icon={<Database className="h-5 w-5" />}
          title="Reyslar bazasi"
          subtitle="Qidiruv, filter va sahifalash orqali barcha reyslarni ko'ring"
          count={total}
          tone="violet"
          isOpen={databaseOpen}
          onToggle={() => setDatabaseOpen((value) => !value)}
        >
          <div className="space-y-3 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Reys nomi bo'yicha qidiruv..."
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-[13px] font-semibold text-gray-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
                className="h-10 rounded-xl border border-gray-200 bg-white px-2 text-[12px] font-bold text-gray-700 outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200"
              >
                <option value="all">Barcha</option>
                <option value="avia">Google Sheet</option>
                <option value="ostatka">Ostatka</option>
                <option value="custom">Expected</option>
              </select>
              <label
                className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 text-[12px] font-bold text-gray-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200"
              >
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(event) => setShowCompleted(event.target.checked)}
                  className="h-4 w-4 shrink-0 accent-orange-500"
                />
                <span className="truncate">Tugaganlarni ko'rsatish</span>
              </label>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
                className="h-10 rounded-xl border border-gray-200 bg-white px-2 text-[12px] font-bold text-gray-700 outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200"
              >
                <option value="newest">Yangi birinchi</option>
                <option value="remaining_desc">Qolgan yuk</option>
                <option value="name_asc">Nomi A-Z</option>
              </select>
              <select
                value={perPage}
                onChange={(event) => setPerPage(Number(event.target.value))}
                className="h-10 rounded-xl border border-gray-200 bg-white px-2 text-[12px] font-bold text-gray-700 outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200"
              >
                <option value={5}>5 ta</option>
                <option value={10}>10 ta</option>
                <option value={20}>20 ta</option>
                <option value={50}>50 ta</option>
              </select>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-white/[0.06]">
            {isLoading && flights.length === 0 ? (
              <FlightListSkeleton count={perPage} />
            ) : flights.length === 0 ? (
              <EmptyState message="Filter bo'yicha reys topilmadi" />
            ) : (
              <div>
                {flights.map((flight) => (
                  <FlightRow
                    key={flight.name}
                    flight={flight}
                    onClick={() => onSelectFlight(flight.name)}
                  />
                ))}
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </DashboardSection>
      </div>

      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setAddModalOpen(false);
          }}
        >
          <div className="w-full max-w-sm overflow-hidden rounded-t-3xl border border-gray-200 bg-white shadow-xl dark:border-white/[0.08] dark:bg-[#151515] sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-500/10">
                  <Plane className="h-4 w-4" />
                </div>
                <span className="text-[15px] font-black text-gray-900 dark:text-white">
                  Kutilayotgan reys qo'shish
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFlight} className="px-5 py-4">
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                Reys nomi
              </label>
              <input
                ref={flightNameInputRef}
                value={newFlightName}
                onChange={(event) => setNewFlightName(event.target.value)}
                placeholder="Masalan: M213 yoki A-2026-05"
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-[14px] font-semibold text-gray-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
              />
              {createError && <p className="mt-2 text-[12px] font-semibold text-red-500">{createError}</p>}
              <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                Reys foto yuklanmaguncha yangi reys sifatida tepada ko'rinadi.
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="h-10 flex-1 rounded-xl bg-gray-100 text-[13px] font-black text-gray-600 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.10]"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newFlightName.trim()}
                  className="h-10 flex-1 rounded-xl bg-orange-500 text-[13px] font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreating ? 'Saqlanmoqda...' : "Qo'shish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
