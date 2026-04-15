import { Bell, X, AlertTriangle, CheckCircle2, Info, AlertCircle, ArrowRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useExpectedCargoStore, type NotificationItem, type NotificationType } from '@/store/expectedCargoStore';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when user clicks a navigate button — caller handles routing */
  onNavigateToClient: (flightName: string, clientCode: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<NotificationType, {
  icon: typeof AlertTriangle;
  iconClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    bgClass: 'bg-amber-50 dark:bg-amber-950/20',
    borderClass: 'border-amber-200 dark:border-amber-800',
  },
  error: {
    icon: AlertCircle,
    iconClass: 'text-red-500',
    bgClass: 'bg-red-50 dark:bg-red-950/20',
    borderClass: 'border-red-200 dark:border-red-800',
  },
  success: {
    icon: CheckCircle2,
    iconClass: 'text-green-500',
    bgClass: 'bg-green-50 dark:bg-green-950/20',
    borderClass: 'border-green-200 dark:border-green-800',
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-500',
    bgClass: 'bg-blue-50 dark:bg-blue-950/20',
    borderClass: 'border-blue-200 dark:border-blue-800',
  },
};

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s oldin`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m oldin`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}s oldin`;
  const days = Math.floor(hours / 24);
  return `${days}k oldin`;
}

// ── Single notification card ───────────────────────────────────────────────────

interface NotificationCardProps {
  item: NotificationItem;
  onDismiss: (id: string) => void;
  onNavigate: (flightName: string, clientCode: string) => void;
}

function NotificationCard({ item, onDismiss, onNavigate }: NotificationCardProps) {
  const config = TYPE_CONFIG[item.type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'relative flex gap-3 p-3 rounded-xl border transition-all',
        config.bgClass,
        config.borderClass,
        !item.isRead && 'ring-1 ring-offset-0',
        item.type === 'warning' && !item.isRead && 'ring-amber-300 dark:ring-amber-700',
      )}
    >
      {/* Unread dot */}
      {!item.isRead && (
        <span className="absolute top-2.5 right-8 size-1.5 rounded-full bg-orange-500 flex-shrink-0" />
      )}

      <Icon className={cn('size-4 flex-shrink-0 mt-0.5', config.iconClass)} />

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-tight">
          {item.title}
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
          {item.description}
        </p>

        <div className="flex items-center justify-between mt-1.5 gap-2">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {formatRelativeTime(item.createdAt)}
          </span>

          {item.navigateTo && (
            <button
              onClick={() => {
                if (item.navigateTo) {
                  onNavigate(item.navigateTo.flightName, item.navigateTo.clientCode);
                }
              }}
              className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
            >
              Ko'rish
              <ArrowRight className="size-3" />
            </button>
          )}
        </div>
      </div>

      <button
        onClick={() => onDismiss(item.id)}
        className="flex-shrink-0 p-0.5 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors mt-0.5"
        title="O'chirish"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

// ── Notification Panel (slide-in from right) ───────────────────────────────────

export function NotificationPanel({ isOpen, onClose, onNavigateToClient }: NotificationPanelProps) {
  const {
    notifications,
    dismissNotification,
    markAllNotificationsRead,
    clearAllNotifications,
  } = useExpectedCargoStore();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Mark all as read when the panel opens.
  if (isOpen && unreadCount > 0) {
    markAllNotificationsRead();
  }

  const handleNavigate = (flightName: string, clientCode: string) => {
    onNavigateToClient(flightName, clientCode);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30 dark:bg-black/50 animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[90vw] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-zinc-500 dark:text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Bildirishnomalar
            </span>
            {notifications.length > 0 && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                ({notifications.length})
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <button
                onClick={clearAllNotifications}
                title="Barchasini o'chirish"
                className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
              <div className="size-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <Bell className="size-5 text-zinc-400 dark:text-zinc-500" />
              </div>
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                Bildirishnomalar yo'q
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <NotificationCard
                key={item.id}
                item={item}
                onDismiss={dismissNotification}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ── Bell button with badge (for use in the header) ────────────────────────────

interface NotificationBellProps {
  onClick: () => void;
}

export function NotificationBell({ onClick }: NotificationBellProps) {
  const unreadCount = useExpectedCargoStore((state) =>
    state.notifications.filter((n) => !n.isRead).length,
  );

  return (
    <button
      onClick={onClick}
      className="relative p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      title="Bildirishnomalar"
    >
      <Bell className="size-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-amber-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
