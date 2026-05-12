import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, History, Smartphone, LogOut, ShieldCheck, CalendarCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSessionHistory } from '@/hooks/useProfile';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useState, memo } from 'react';
import { cn } from '@/lib/utils';
import { type SessionLogItem } from '@/types/profile';

const getEventIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'event-login': return <Smartphone size={16} />;
    case 'event-logout': return <LogOut size={16} />;
    case 'event-relink': return <ShieldCheck size={16} />;
    default: return <History size={16} />;
  }
};

const getEventColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'event-login': return "text-green-500 bg-green-50 dark:bg-green-900/20";
    case 'event-logout': return "text-red-500 bg-red-50 dark:bg-red-900/20";
    case 'event-relink': return "text-blue-500 bg-blue-50 dark:bg-blue-900/20";
    default: return "text-gray-500 bg-gray-50 dark:bg-gray-800";
  }
};

const LogItem = memo(({ log, idx }: { log: SessionLogItem; idx: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: idx * 0.05, duration: 0.2 }}
    className="p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-4"
  >
    <div className={cn("p-2.5 rounded-xl shrink-0", getEventColor(log.event_type))}>
      {getEventIcon(log.event_type)}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
        {log.event_type}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
        <CalendarCheck size={12} /> {log.date}
      </p>
    </div>
    <div className="text-right">
      <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-black/20 px-1.5 py-0.5 rounded">
        {log.client_code}
      </span>
    </div>
  </motion.div>
));
LogItem.displayName = 'LogItem';

export const SessionHistory = memo(() => {
  const [page, setPage] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const { data, isLoading, isFetching } = useSessionHistory(page);
  const { t } = useTranslation();

  if (isLoading) return <SessionHistorySkeleton />;

  return (
    <div className="pb-5 max-w-md mx-auto md:max-w-none md:mx-0 md:px-0 md:pb-0">
      <div className="mb-2.5 ml-0.5 flex items-end justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[16px] font-black text-gray-950 dark:text-[#fff8ed]">
            <span className="inline-block h-[19px] w-1 rounded-full bg-orange-500"></span>
            {t('profile.session.title')}
          </h3>
          <p className="mt-1 text-[11px] font-bold text-gray-500 dark:text-[#fff8ed]/52">
            {t('profile.session.secureHint')}
          </p>
        </div>
        {isFetching && <span className="text-xs text-muted-foreground animate-pulse">{t('profile.session.loading')}</span>}
      </div>

      <div className="overflow-hidden rounded-[22px] border border-gray-900/[0.07] bg-white/92 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/[0.085] dark:bg-[#0a0e15]/86 dark:shadow-none">
        <button
          type="button"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="flex w-full items-center justify-between gap-4 p-[13px] text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.045]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[14px] bg-white/[0.055] text-orange-500 dark:bg-white/[0.055] dark:text-amber-300">
              <History size={18} />
            </div>
            <div className="min-w-0">
              <strong className="block text-[13px] font-black text-gray-950 dark:text-[#fff8ed]">
                {t('profile.session.recentTitle')}
              </strong>
              <span className="mt-0.5 block truncate text-[11px] font-bold text-gray-500 dark:text-[#fff8ed]/52">
                {data?.logs?.[0]?.date || t('profile.session.empty')}
              </span>
            </div>
          </div>
          <ChevronDown
            size={18}
            className={cn(
              "shrink-0 text-gray-400 transition-transform duration-200 dark:text-white/42",
              isExpanded && "rotate-180"
            )}
          />
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="overflow-hidden border-t border-gray-100 dark:border-white/[0.075]"
            >
              {data?.logs.length === 0 ? (
                <div className="p-8 text-center text-gray-400">{t('profile.session.empty')}</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-white/5 md:divide-y-0 md:grid md:grid-cols-1 xl:grid-cols-2 md:gap-1">
                  {data?.logs.map((log, idx) => (
                    <LogItem key={`${log.date}-${idx}`} log={log} idx={idx} />
                  ))}
                </div>
              )}

              <div className="flex justify-between bg-gray-50 p-3 dark:bg-white/[0.035] md:col-span-full">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  {t('profile.session.prev')}
                </Button>
                <span className="text-sm text-gray-500 flex items-center">{t('profile.session.page', { page })}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!data?.logs || data.logs.length < 10}
                  onClick={() => setPage(p => p + 1)}
                >
                  {t('profile.session.next')}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
SessionHistory.displayName = 'SessionHistory';

const SessionHistorySkeleton = () => (
  <div className="px-6 pb-24 max-w-md mx-auto">
    <Skeleton className="h-6 w-32 mb-4" />
    <div className="space-y-4 rounded-3xl bg-white p-4 dark:bg-[#0a0e15]">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  </div>
);
