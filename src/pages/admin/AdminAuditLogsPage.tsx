import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  AlertCircle,
  Globe,
  User,
  Tag,
  FileJson,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { getAuditLogs } from '../../api/services/adminManagement';
import type { AuditLogResponse, AuditLogListResponse } from '../../api/services/adminManagement';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Skeleton } from '../../components/ui/skeleton';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  const date = d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return { date, time };
}

/**
 * Maps a log action string to a Tailwind badge class.
 * Covers common CRUD verb patterns without exhaustive enumeration.
 */
function getActionBadgeClass(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('login') || lower.includes('auth') || lower.includes('token')) {
    return 'bg-blue-50 dark:bg-blue-500/[0.1] text-blue-600 dark:text-blue-400 border-blue-200/70 dark:border-blue-500/20';
  }
  if (lower.includes('create') || lower.includes('add') || lower.includes('register')) {
    return 'bg-green-50 dark:bg-green-500/[0.1] text-green-600 dark:text-green-400 border-green-200/70 dark:border-green-500/20';
  }
  if (lower.includes('delete') || lower.includes('remove') || lower.includes('ban')) {
    return 'bg-red-50 dark:bg-red-500/[0.1] text-red-600 dark:text-red-400 border-red-200/70 dark:border-red-500/20';
  }
  if (
    lower.includes('update') ||
    lower.includes('edit') ||
    lower.includes('patch') ||
    lower.includes('change') ||
    lower.includes('assign') ||
    lower.includes('reset')
  ) {
    return 'bg-orange-50 dark:bg-orange-500/[0.1] text-orange-600 dark:text-orange-400 border-orange-200/70 dark:border-orange-500/20';
  }
  if (lower.includes('logout') || lower.includes('revoke') || lower.includes('disable')) {
    return 'bg-yellow-50 dark:bg-yellow-500/[0.1] text-yellow-600 dark:text-yellow-400 border-yellow-200/70 dark:border-yellow-500/20';
  }
  return 'bg-gray-50 dark:bg-white/[0.05] text-gray-600 dark:text-gray-400 border-gray-200/70 dark:border-white/[0.05]';
}

// ─── Action label translations ────────────────────────────────────────────────

const ACTION_TRANSLATIONS: Record<string, string> = {
  'POS_BULK_PAYMENT':         "Kassa: Yuk to'lovi",
  'POS_ADJUST_BALANCE':       'Kassa: Balans tahriri',
  'POS_UPDATE_TAKEN_STATUS':  'Kassa: Olib ketish holati yangilandi',
  'POS_UPDATE_DELIVERY_REQUEST_TYPE': 'Kassa: Delivery request type yangilandi',
  'POS_UPDATE_DELIVERY_PROOF_METHOD': 'Kassa: Delivery proof method yangilandi',
  'LOGIN_SUCCESS':             'Tizimga muvaffaqiyatli kirildi',
  'PASSKEY_LOGIN_SUCCESS':    'Tizimga kirildi (Passkey)',
  'LOGIN_FAILED':             'Tizimga kirish xatosi',
  'LOGOUT':                   'Tizimdan chiqildi',
  'CHANGED_OWN_PIN':          "O'z PIN ini o'zgartirdi",
  'PASSKEY_REGISTERED':       'Yangi passkey qo\'shildi',
  'CREATED_ADMIN':            'Yangi admin yaratildi',
  'UPDATED_ADMIN':            "Admin ma'lumotlari o'zgardi",
  'UPDATED_ADMIN_STATUS':     "Admin holati o'zgardi",
  'DELETED_ADMIN':            "Admin o'chirildi",
  'RESET_ADMIN_PIN':          'PIN reset qilindi (super-admin)',
  'CREATED_ROLE':             'Yangi rol yaratildi',
  'UPDATED_ROLE':             "Rol ma'lumotlari tahrirlandi",
  'UPDATED_ROLE_PERMISSIONS': 'Rol huquqlari tahrirlandi',
  'DELETED_ROLE':             "Rol o'chirildi",
  'MARK_CARGO_TAKEN':         'Yuk olib ketildi deb belgilandi',
  'WAREHOUSE_MARKED_TAKEN':  'Ombor uchun yuk olib ketildi deb belgilandi',
  'CREATED_CAROUSEL_ITEM':   'Karousel elementi yaratildi',
  'UPDATED_CAROUSEL_ITEM':   'Karousel elementi tahrirlandi',
  'DELETED_CAROUSEL_ITEM':   'Karousel elementi o\'chirildi',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const label = ACTION_TRANSLATIONS[action] ?? action;
  return (
    <span
      title={action}
      className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${getActionBadgeClass(action)}`}
    >
      {label}
    </span>
  );
}

function DetailsExpander({
  details,
  isExpanded,
  onToggle,
}: {
  details: Record<string, unknown> | null;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  if (!details || Object.keys(details).length === 0) {
    return <span className="text-[12px] text-gray-400 dark:text-gray-600 italic">—</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 text-[11px] font-medium text-orange-500 hover:text-orange-600 transition-colors"
      >
        <FileJson className="w-3.5 h-3.5" />
        <span>{isExpanded ? 'Yopish' : 'Ko\'rish'}</span>
        {isExpanded ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <pre className="mt-2 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06] text-[11px] leading-relaxed text-gray-700 dark:text-gray-300 font-mono overflow-x-auto max-w-xs md:max-w-sm whitespace-pre-wrap break-all">
              {JSON.stringify(details, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function TableSkeletons() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i} className="border-b border-gray-50 dark:border-white/[0.03]">
          {Array.from({ length: 5 }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-5 w-full rounded-lg dark:bg-white/[0.05]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function CardSkeletons() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-[18px] dark:bg-white/5" />
      ))}
    </>
  );
}

// ─── Desktop Row ──────────────────────────────────────────────────────────────

function AuditDesktopRow({
  log,
  index,
  isExpanded,
  onToggleExpand,
}: {
  log: AuditLogResponse;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const { date, time } = formatDateTime(log.created_at);

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50/50 dark:hover:bg-white/[0.015] transition-colors align-top"
    >
      {/* Date / Time */}
      <TableCell className="text-[12px] text-gray-500 dark:text-gray-500 whitespace-nowrap">
        <div className="font-medium text-gray-700 dark:text-gray-300">{date}</div>
        <div className="text-gray-400 dark:text-gray-600 font-mono">{time}</div>
      </TableCell>

      {/* Action */}
      <TableCell>
        <ActionBadge action={log.action} />
      </TableCell>

      {/* Admin / Role */}
      <TableCell>
        <div className="space-y-1">
          {log.admin_account_id !== null ? (
            <div className="flex items-center gap-1.5 text-[12px] text-gray-700 dark:text-gray-300">
              <User className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="font-mono">#{log.admin_account_id}</span>
            </div>
          ) : (
            <div className="text-[12px] text-gray-400 dark:text-gray-600 italic">Tizim</div>
          )}
          {log.role_snapshot && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-600">
              <Tag className="w-3 h-3 shrink-0" />
              <span>{log.role_snapshot}</span>
            </div>
          )}
        </div>
      </TableCell>

      {/* IP Address */}
      <TableCell>
        {log.ip_address ? (
          <div className="flex items-center gap-1.5 text-[12px] text-gray-600 dark:text-gray-400 font-mono">
            <Globe className="w-3 h-3 text-gray-400 shrink-0" />
            {log.ip_address}
          </div>
        ) : (
          <span className="text-[12px] text-gray-400 dark:text-gray-600 italic">—</span>
        )}
      </TableCell>

      {/* Details */}
      <TableCell>
        <DetailsExpander
          details={log.details}
          isExpanded={isExpanded}
          onToggle={onToggleExpand}
        />
      </TableCell>
    </motion.tr>
  );
}

// ─── Mobile Card ──────────────────────────────────────────────────────────────

function AuditMobileCard({
  log,
  index,
  isExpanded,
  onToggleExpand,
}: {
  log: AuditLogResponse;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const { date, time } = formatDateTime(log.created_at);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="bg-white dark:bg-[#111] p-4 rounded-[18px] shadow-sm border border-black/[0.05] dark:border-white/[0.06]"
    >
      {/* Top row: action badge + date */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <ActionBadge action={log.action} />
        <div className="text-right shrink-0">
          <div className="text-[11px] font-medium text-gray-600 dark:text-gray-400">{date}</div>
          <div className="text-[10px] text-gray-400 dark:text-gray-600 font-mono">{time}</div>
        </div>
      </div>

      {/* Admin / Role / IP row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
        <div className="flex items-center gap-1.5 text-[12px] text-gray-600 dark:text-gray-400">
          <User className="w-3 h-3 text-gray-400 shrink-0" />
          <span>
            {log.admin_account_id !== null ? (
              <span className="font-mono">#{log.admin_account_id}</span>
            ) : (
              <span className="italic text-gray-400 dark:text-gray-600">Tizim</span>
            )}
          </span>
        </div>

        {log.role_snapshot && (
          <div className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-500">
            <Tag className="w-3 h-3 text-gray-400 shrink-0" />
            <span>{log.role_snapshot}</span>
          </div>
        )}

        {log.ip_address && (
          <div className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-500 font-mono">
            <Globe className="w-3 h-3 text-gray-400 shrink-0" />
            {log.ip_address}
          </div>
        )}
      </div>

      {/* Expandable details */}
      <div className="pt-2 border-t border-gray-50 dark:border-white/[0.04]">
        <DetailsExpander
          details={log.details}
          isExpanded={isExpanded}
          onToggle={onToggleExpand}
        />
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);

  // Separate input state (draft) from applied state (sent to API) to avoid
  // triggering a new request on every keystroke.
  const [inputAction, setInputAction] = useState('');
  const [inputRoleSnapshot, setInputRoleSnapshot] = useState('');
  const [inputAdminId, setInputAdminId] = useState('');
  const [appliedAction, setAppliedAction] = useState('');
  const [appliedRoleSnapshot, setAppliedRoleSnapshot] = useState('');
  const [appliedAdminId, setAppliedAdminId] = useState<number | undefined>(undefined);

  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  const { data, isLoading, isFetching, isError, refetch } = useQuery<AuditLogListResponse>({
    queryKey: ['audit-logs', page, PAGE_SIZE, appliedAction, appliedRoleSnapshot, appliedAdminId],
    queryFn: () =>
      getAuditLogs({
        page,
        size: PAGE_SIZE,
        action: appliedAction || undefined,
        role_snapshot: appliedRoleSnapshot || undefined,
        admin_account_id: appliedAdminId,
      }),
  });

  const logs = data?.items;
  const totalPages = data?.total_pages ?? 1;
  const totalCount = data?.total_count ?? 0;

  const applyFilters = useCallback(() => {
    // Reset to first page whenever filter criteria change.
    setPage(1);
    setExpandedRowId(null);
    setAppliedAction(inputAction.trim());
    setAppliedRoleSnapshot(inputRoleSnapshot.trim());
    const parsedId = parseInt(inputAdminId.trim(), 10);
    setAppliedAdminId(!isNaN(parsedId) && parsedId > 0 ? parsedId : undefined);
  }, [inputAction, inputRoleSnapshot, inputAdminId]);

  const clearFilters = useCallback(() => {
    setInputAction('');
    setInputRoleSnapshot('');
    setInputAdminId('');
    setAppliedAction('');
    setAppliedRoleSnapshot('');
    setAppliedAdminId(undefined);
    setPage(1);
    setExpandedRowId(null);
  }, []);

  const handleFilterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') applyFilters();
  };

  const toggleRow = useCallback((id: number) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  }, []);

  const hasActiveFilters = Boolean(appliedAction || appliedRoleSnapshot || appliedAdminId);
  const isLastPage = page >= totalPages;

  const goToPreviousPage = () => {
    setPage((prev) => Math.max(1, prev - 1));
    setExpandedRowId(null);
  };
  const goToNextPage = () => {
    setPage((prev) => prev + 1);
    setExpandedRowId(null);
  };

  const inputClass =
    'w-full px-3 py-2.5 bg-white dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] rounded-xl text-[13px] focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600';

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">
            Tizim Jurnali
          </h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-500 mt-1">
            Audit Logs — barcha admin harakatlari tarixi
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="self-start sm:self-center flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] hover:border-orange-300 dark:hover:border-orange-500/30 hover:text-orange-600 dark:hover:text-orange-400 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Yangilash
        </button>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white dark:bg-[#111] rounded-[18px] border border-black/[0.05] dark:border-white/[0.06] p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Filtr
          </span>
          {hasActiveFilters && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-orange-500">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
              Faol filtr
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={inputAction}
              onChange={(e) => setInputAction(e.target.value)}
              onKeyDown={handleFilterKeyDown}
              placeholder="Harakat (masalan: LOGIN, DELETE...)"
              className={inputClass + ' pl-9'}
            />
          </div>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={inputRoleSnapshot}
              onChange={(e) => setInputRoleSnapshot(e.target.value)}
              onKeyDown={handleFilterKeyDown}
              placeholder="Rol nomi (masalan: worker...)"
              className={inputClass + ' pl-9'}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="number"
              min={1}
              value={inputAdminId}
              onChange={(e) => setInputAdminId(e.target.value)}
              onKeyDown={handleFilterKeyDown}
              placeholder="Admin ID raqami"
              className={inputClass + ' pl-9'}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={applyFilters}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-[12px] font-semibold rounded-xl transition-all shadow-sm shadow-orange-500/20"
          >
            <Search className="w-3.5 h-3.5" />
            Izlash
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/[0.1] text-gray-600 dark:text-gray-400 text-[12px] font-medium rounded-xl transition-all"
            >
              <X className="w-3.5 h-3.5" />
              Tozalash
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      {isError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white dark:bg-[#111] rounded-[20px] border border-black/[0.05] dark:border-white/[0.06]">
          <AlertCircle className="w-10 h-10 text-red-400" strokeWidth={1.5} />
          <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400">
            Ma'lumotlarni yuklashda xatolik yuz berdi
          </p>
          <button
            onClick={() => refetch()}
            className="text-[12px] text-orange-500 hover:text-orange-600 font-medium"
          >
            Qayta urinish
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-[#111] rounded-[20px] shadow-sm border border-black/[0.05] dark:border-white/[0.06] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b-gray-100 dark:border-b-white/[0.06] hover:bg-transparent">
                  <TableHead className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-36">
                    Sana / Vaqt
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Harakat
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Admin / Rol
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    IP Manzil
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Tafsilotlar
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeletons />
                ) : logs && logs.length > 0 ? (
                  logs.map((log, index) => (
                    <AuditDesktopRow
                      key={log.id}
                      log={log}
                      index={index}
                      isExpanded={expandedRowId === log.id}
                      onToggleExpand={() => toggleRow(log.id)}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Clock className="w-8 h-8 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
                        <p className="text-[13px] text-gray-400">
                          {hasActiveFilters ? 'Filtr bo\'yicha natija topilmadi' : 'Audit yozuvlari mavjud emas'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3 pb-4">
            {isLoading ? (
              <CardSkeletons />
            ) : logs && logs.length > 0 ? (
              logs.map((log, index) => (
                <AuditMobileCard
                  key={log.id}
                  log={log}
                  index={index}
                  isExpanded={expandedRowId === log.id}
                  onToggleExpand={() => toggleRow(log.id)}
                />
              ))
            ) : (
              <div className="text-center py-12 bg-white/50 dark:bg-white/[0.02] rounded-[20px] border-2 border-dashed border-gray-200 dark:border-white/[0.08]">
                <Clock className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
                <p className="text-[14px] font-medium text-gray-400">
                  {hasActiveFilters ? 'Filtr bo\'yicha natija topilmadi' : 'Audit yozuvlari mavjud emas'}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Pagination ── */}
      {!isLoading && !isError && (
        <div className="flex items-center justify-between pb-8">
          <div className="text-[12px] text-gray-400 dark:text-gray-600">
            {totalCount > 0 ? (
              <>
                Jami{' '}
                <span className="font-medium text-gray-600 dark:text-gray-400">{totalCount}</span>
                {' '}ta yozuv
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousPage}
              disabled={page === 1 || isFetching}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium bg-white dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 hover:border-orange-300 dark:hover:border-orange-500/30 hover:text-orange-600 dark:hover:text-orange-400 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Oldingi
            </button>

            <span className="px-3 py-2 rounded-xl text-[12px] font-semibold text-gray-700 dark:text-gray-300 bg-orange-50 dark:bg-orange-500/[0.08] border border-orange-100 dark:border-orange-500/20">
              {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `${page} / ${totalPages}`}
            </span>

            <button
              onClick={goToNextPage}
              disabled={isLastPage || isFetching}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium bg-white dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 hover:border-orange-300 dark:hover:border-orange-500/30 hover:text-orange-600 dark:hover:text-orange-400 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              Keyingi
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
