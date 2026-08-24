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
    case 'event-login': return "text-mc-success bg-mc-success/12";
    case 'event-logout': return "text-mc-danger bg-mc-danger-soft";
    case 'event-relink': return "text-mc-brand bg-mc-brand-soft";
    default: return "text-mc-text-2 bg-mc-surface-2";
  }
};

const LogItem = memo(({ log, idx }: { log: SessionLogItem; idx: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: idx * 0.05, duration: 0.2 }}
    className="flex items-center gap-2.5 p-3"
  >
    <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-mc-sm", getEventColor(log.event_type))}>
      {getEventIcon(log.event_type)}
    </div>
    <div className="flex-1 min-w-0">
      <p className="truncate text-[13px] font-extrabold text-mc-text">
        {log.event_type}
      </p>
      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-mc-text-2">
        <CalendarCheck size={12} /> {log.date}
      </p>
    </div>
    <div className="text-right">
      <span className="rounded-mc-sm bg-mc-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-bold text-mc-text-2">
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
    <div className="mb-2">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-mc-text">
            <span className="inline-block h-4 w-1 rounded-full bg-mc-brand" />
            {t('profile.session.title')}
          </h3>
          <p className="mt-0.5 text-[11px] font-medium text-mc-text-2">
            {t('profile.session.secureHint')}
          </p>
        </div>
        {isFetching && <span className="text-[11px] font-medium text-mc-text-3 animate-pulse">{t('profile.session.loading')}</span>}
      </div>

      <div className="overflow-hidden rounded-mc-lg border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]">
        <button
          type="button"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="flex w-full items-center justify-between gap-3 p-3 text-left transition-transform active:scale-[0.99]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-mc-sm bg-mc-brand-soft text-mc-brand">
              <History size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <strong className="block text-[13px] font-extrabold text-mc-text">
                {t('profile.session.recentTitle')}
              </strong>
              <span className="mt-0.5 block truncate text-[11px] font-medium text-mc-text-2">
                {data?.logs?.[0]?.date || t('profile.session.empty')}
              </span>
            </div>
          </div>
          <ChevronDown
            size={18}
            className={cn(
              "shrink-0 text-mc-text-3 transition-transform duration-200",
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
              className="overflow-hidden border-t border-mc-border"
            >
              {data?.logs.length === 0 ? (
                <div className="p-8 text-center text-[12px] font-medium text-mc-text-3">{t('profile.session.empty')}</div>
              ) : (
                <div className="divide-y divide-mc-border md:divide-y-0 md:grid md:grid-cols-1 xl:grid-cols-2 md:gap-1">
                  {data?.logs.map((log, idx) => (
                    <LogItem key={`${log.date}-${idx}`} log={log} idx={idx} />
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 border-t border-mc-border bg-mc-surface-2 p-2.5 md:col-span-full">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  {t('profile.session.prev')}
                </Button>
                <span className="flex items-center text-[11px] font-medium text-mc-text-2">{t('profile.session.page', { page })}</span>
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
  <div className="mb-2">
    <Skeleton className="mb-2 h-5 w-32" />
    <div className="space-y-2 rounded-mc-lg border border-mc-border bg-mc-surface p-3">
      <Skeleton className="h-11 w-full rounded-mc-md" />
      <Skeleton className="h-11 w-full rounded-mc-md" />
      <Skeleton className="h-11 w-full rounded-mc-md" />
    </div>
  </div>
);
