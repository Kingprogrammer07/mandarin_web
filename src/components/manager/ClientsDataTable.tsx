import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '../ui/skeleton';
import { regions, DISTRICTS } from '@/lib/validation';

interface ClientRecord {
  id: number;
  primary_code: string;
  full_name: string;
  phone?: string | null;
  region?: string | null;
  district?: string | null;
  is_logged_in: boolean;
  created_at: string;
}

interface ClientsDataTableProps {
  clients: ClientRecord[];
  isLoading: boolean;
  isQueryEmpty: boolean;
  selectedClientId: number | null;
  setSelectedClientId: (id: number) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** Returns the i18n translation key for a region value, or the raw value as fallback. */
function getRegionI18nKey(regionValue: string): string {
  return regions.find((r) => r.value === regionValue)?.label ?? regionValue;
}

/** Returns the i18n translation key for a district value within a region, or raw value. */
function getDistrictI18nKey(regionValue: string, districtValue: string): string {
  return (
    DISTRICTS[regionValue]?.find((d) => d.value === districtValue)?.label ?? districtValue
  );
}

const LoginBadge = memo(({ isLoggedIn }: { isLoggedIn: boolean }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
      isLoggedIn
        ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
        : 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400'
    }`}
  >
    <span
      className={`w-1.5 h-1.5 rounded-full ${isLoggedIn ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-500'}`}
    />
    {isLoggedIn ? 'Faol' : 'Kirмagan'}
  </span>
));
LoginBadge.displayName = 'LoginBadge';

const MobileClientCard = memo(
  ({
    client,
    isSelected,
    onClick,
  }: {
    client: ClientRecord;
    isSelected: boolean;
    onClick: () => void;
  }) => {
    const { t } = useTranslation();

    const regionLabel = client.region ? t(getRegionI18nKey(client.region)) : null;
    const districtLabel =
      client.region && client.district
        ? t(getDistrictI18nKey(client.region, client.district))
        : null;
    const locationText = [regionLabel, districtLabel].filter(Boolean).join(', ') || null;

    return (
    <div
      onClick={onClick}
      className={`relative bg-white dark:bg-[#111] p-4 rounded-[18px] border cursor-pointer transition-all active:opacity-80 ${
        isSelected
          ? 'border-orange-500/40 dark:border-orange-500/30 shadow-sm'
          : 'border-black/[0.05] dark:border-white/[0.06]'
      }`}
    >
      {/* Left accent on selected */}
      {isSelected && (
        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-orange-500" />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-bold text-gray-900 dark:text-white">
              {client.primary_code}
            </span>
            <LoginBadge isLoggedIn={client.is_logged_in} />
          </div>
          <p className="text-[13px] text-gray-600 dark:text-gray-300 mt-0.5 truncate">
            {client.full_name}
          </p>
          {client.phone && (
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
              {client.phone}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {formatDate(client.created_at)}
          </p>
          {locationText && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 max-w-[110px] text-right truncate">
              {locationText}
            </p>
          )}
        </div>
      </div>
    </div>
    );
  },
);
MobileClientCard.displayName = 'MobileClientCard';

export default memo(function ClientsDataTable({
  clients,
  isLoading,
  isQueryEmpty,
  selectedClientId,
  setSelectedClientId,
  page,
  totalPages,
  onPageChange,
}: ClientsDataTableProps) {
  const { t } = useTranslation();

  if (isQueryEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
          </svg>
        </div>
        <p className="text-[14px] text-gray-400 dark:text-gray-500">
          Qidirish uchun ism yoki mijoz kodi kiriting
        </p>
      </div>
    );
  }

  const showPagination = (totalPages ?? 0) > 1;

  return (
    <div className="space-y-3">
      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-[#111] p-4 rounded-[18px] border border-black/[0.05] dark:border-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24 rounded-lg" />
                    <Skeleton className="h-3.5 w-40 rounded-lg" />
                    <Skeleton className="h-3 w-28 rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-16 rounded-lg" />
                    <Skeleton className="h-3 w-12 rounded-lg" />
                  </div>
                </div>
              </div>
            ))
          : clients.map((client) => (
              <MobileClientCard
                key={client.id}
                client={client}
                isSelected={selectedClientId === client.id}
                onClick={() => setSelectedClientId(client.id)}
              />
            ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-[#111] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/[0.06] dark:border-white/[0.06]">
              {['Mijoz kodi', "To'liq ism", 'Telefon', 'Hudud', 'Holat', 'Yaratilgan'].map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr
                    key={i}
                    className="border-b border-black/[0.04] dark:border-white/[0.04]"
                  >
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full rounded-lg" />
                      </td>
                    ))}
                  </tr>
                ))
              : clients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={`border-b border-black/[0.04] dark:border-white/[0.04] cursor-pointer transition-colors ${
                      selectedClientId === client.id
                        ? 'bg-orange-50 dark:bg-orange-500/[0.04]'
                        : 'hover:bg-gray-50 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-semibold text-gray-900 dark:text-white">
                        {client.primary_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-700 dark:text-gray-300">
                      {client.full_name}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-500 dark:text-gray-400">
                      {client.phone ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-500 dark:text-gray-400">
                      {client.region
                        ? [
                            t(getRegionI18nKey(client.region)),
                            client.district
                              ? t(getDistrictI18nKey(client.region, client.district))
                              : null,
                          ]
                            .filter(Boolean)
                            .join(', ')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <LoginBadge isLoggedIn={client.is_logged_in} />
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-400 dark:text-gray-500">
                      {formatDate(client.created_at)}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-[13px] text-gray-500 dark:text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
});