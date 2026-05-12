import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

interface StatusAnimationProps {
  status: 'loading' | 'success' | 'error';
  message?: string;
  onComplete?: () => void;
}

const STYLES = `
  @keyframes status-card-in {
    0% { transform: translateY(18px) scale(.96); opacity: 0; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }

  @keyframes status-sheen {
    0% { transform: translateX(-120%) rotate(18deg); }
    100% { transform: translateX(150%) rotate(18deg); }
  }

  .status-card-in { animation: status-card-in .32s cubic-bezier(.2,.8,.2,1) both; }
  .status-sheen { animation: status-sheen 1.65s ease-in-out infinite; }
`;

const STATUS_CONFIG = {
  loading: {
    icon: <Loader2 className="h-5 w-5 animate-spin" />,
    iconClass: 'bg-orange-500/14 text-orange-500 dark:bg-amber-300/10 dark:text-amber-300',
    textClass: 'text-gray-950 dark:text-[#fff8ed]',
    accentClass: 'bg-orange-500',
  },
  success: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    iconClass: 'bg-emerald-500/12 text-emerald-600 dark:bg-emerald-300/10 dark:text-emerald-300',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    accentClass: 'bg-emerald-500',
  },
  error: {
    icon: <XCircle className="h-5 w-5" />,
    iconClass: 'bg-red-500/12 text-red-600 dark:bg-red-300/10 dark:text-red-300',
    textClass: 'text-red-700 dark:text-red-300',
    accentClass: 'bg-red-500',
  },
} satisfies Record<
  StatusAnimationProps['status'],
  { icon: ReactNode; iconClass: string; textClass: string; accentClass: string }
>;

export default function StatusAnimation({ status, message, onComplete }: StatusAnimationProps) {
  const [show, setShow] = useState(false);
  const config = STATUS_CONFIG[status];

  useEffect(() => {
    queueMicrotask(() => setShow(true));
    if (status !== 'loading' && onComplete) {
      const timer = setTimeout(() => onComplete(), 1800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, onComplete]);

  return (
    <>
      <style>{STYLES}</style>

      <div
        className={[
          'fixed inset-0 z-50 flex items-center justify-center px-4 transition-opacity duration-200',
          show ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        <div className="absolute inset-0 bg-black/48 backdrop-blur-[6px]" />

        <div
          className="status-card-in relative flex w-full max-w-[350px] items-center gap-3 overflow-hidden rounded-[24px] border border-white/18 bg-white/76 p-3.5 shadow-[0_24px_70px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-[18px] dark:border-white/[0.105] dark:bg-[#10151f]/82 dark:shadow-[0_24px_70px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          {status === 'loading' && (
            <span className="status-sheen pointer-events-none absolute inset-y-[-30%] left-0 w-20 bg-white/18 blur-md dark:bg-amber-200/8" />
          )}

          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-[18px] ${config.iconClass}`}>
            {config.icon}
          </span>

          <div className="min-w-0 flex-1">
            {message && (
              <p className={`line-clamp-3 text-[13px] font-bold leading-snug ${config.textClass}`}>
                {message}
              </p>
            )}
            {status === 'loading' && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-950/7 dark:bg-white/8">
                <div className={`h-full w-1/2 rounded-full ${config.accentClass} opacity-90`} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
