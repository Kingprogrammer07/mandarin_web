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
    0% { transform: translateY(14px) scale(.97); opacity: 0; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }

  /* Indeterminate: the bar travels the full track instead of sitting at a
     fixed width. A static half-filled bar reads as a stalled upload. */
  @keyframes status-bar-travel {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(300%); }
  }

  .status-card-in { animation: status-card-in .3s cubic-bezier(.2,.8,.2,1) both; }
  .status-bar-travel { animation: status-bar-travel 1.15s cubic-bezier(.4,0,.2,1) infinite; }

  @media (prefers-reduced-motion: reduce) {
    .status-card-in { animation: none; }
    .status-bar-travel { animation: none; transform: translateX(0); width: 100%; }
  }
`;

const STATUS_CONFIG = {
  loading: {
    icon: <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />,
    iconClass: 'bg-mc-brand-soft text-mc-brand',
    textClass: 'text-mc-text',
    accentClass: 'bg-mc-brand',
  },
  success: {
    icon: <CheckCircle2 className="h-5 w-5" strokeWidth={2} />,
    iconClass: 'bg-mc-success/12 text-mc-success',
    textClass: 'text-mc-success',
    accentClass: 'bg-mc-success',
  },
  error: {
    icon: <XCircle className="h-5 w-5" strokeWidth={2} />,
    iconClass: 'bg-mc-danger-soft text-mc-danger',
    textClass: 'text-mc-danger',
    accentClass: 'bg-mc-danger',
  },
} satisfies Record<
  StatusAnimationProps['status'],
  { icon: ReactNode; iconClass: string; textClass: string; accentClass: string }
>;

/**
 * Blocking status card — login bootstrap, form submit result.
 *
 * Sits above every other layer on purpose: it covers the screen while the
 * session is being set up, and a toast or a sheet appearing over it would let
 * the user act on a screen that is not ready yet.
 */
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

  // The page behind must not scroll under a blocking overlay.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <>
      <style>{STYLES}</style>

      <div
        role="status"
        aria-live="polite"
        className={[
          'fixed inset-0 z-[10050] flex items-center justify-center px-4',
          'transition-opacity duration-200',
          show ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

        <div
          className="status-card-in relative flex w-full max-w-[340px] items-center gap-3
                     overflow-hidden rounded-mc-xl border border-mc-border bg-mc-surface
                     p-3.5 shadow-2xl"
        >
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-mc-md ${config.iconClass}`}
            aria-hidden="true"
          >
            {config.icon}
          </span>

          <div className="min-w-0 flex-1">
            {message && (
              <p className={`line-clamp-3 text-[13px] font-bold leading-snug ${config.textClass}`}>
                {message}
              </p>
            )}
            {status === 'loading' && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-mc-surface-2">
                <div className={`status-bar-travel h-full w-1/3 rounded-full ${config.accentClass}`} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
