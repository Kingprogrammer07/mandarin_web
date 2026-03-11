import { motion } from 'framer-motion';
import { History, Smartphone, LogOut, ShieldCheck, CalendarCheck } from 'lucide-react';
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
  const { data, isLoading, isFetching } = useSessionHistory(page);
  const { t } = useTranslation();

  if (isLoading) return <SessionHistorySkeleton />;

  return (
    <div className="pb-10 max-w-md mx-auto md:max-w-none md:mx-0 md:px-0 md:pb-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <History className="text-orange-500" size={20} />
          {t('profile.session.title')}
        </h3>
        {isFetching && <span className="text-xs text-muted-foreground animate-pulse">{t('profile.session.loading')}</span>}
      </div>

      <div className="bg-white dark:bg-[#1e1a45] rounded-3xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
        {data?.logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">{t('profile.session.empty')}</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5 md:divide-y-0 md:grid md:grid-cols-1 xl:grid-cols-2 md:gap-1">
            {data?.logs.map((log, idx) => (
              <LogItem key={`${log.date}-${idx}`} log={log} idx={idx} />
            ))}
          </div>
        )}

        <div className="p-3 bg-gray-50 dark:bg-black/20 flex justify-between md:col-span-full">
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
      </div>
    </div>
  );
});
SessionHistory.displayName = 'SessionHistory';

const SessionHistorySkeleton = () => (
  <div className="px-6 pb-24 max-w-md mx-auto">
    <Skeleton className="h-6 w-32 mb-4" />
    <div className="bg-white dark:bg-[#1e1a45] rounded-3xl p-4 space-y-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  </div>
);
