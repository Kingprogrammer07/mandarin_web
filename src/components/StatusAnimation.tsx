import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface StatusAnimationProps {
  status: 'loading' | 'success' | 'error';
  message?: string;
  onComplete?: () => void;
}

const STYLES = `
  @keyframes modal-in {
    0%   { transform: scale(.8) translateY(24px); opacity: 0; }
    100% { transform: scale(1) translateY(0);     opacity: 1; }
  }
  @keyframes bounce-in {
    0%   { transform: scale(0);   opacity: 0; }
    60%  { transform: scale(1.25); }
    100% { transform: scale(1);   opacity: 1; }
  }
  @keyframes shake-x {
    0%,100% { transform: translateX(0);  }
    20%,60% { transform: translateX(-9px); }
    40%,80% { transform: translateX(9px);  }
  }
  @keyframes ring-expand {
    0%   { transform: scale(1);   opacity: .55; }
    100% { transform: scale(1.9); opacity: 0;   }
  }
  @keyframes glow-pulse {
    0%,100% { opacity: .35; }
    50%     { opacity: .75; }
  }
  @keyframes bounce-dot {
    0%,100% { transform: translateY(0);    }
    50%     { transform: translateY(-12px); }
  }
  @keyframes backdrop-in {
    0%   { opacity: 0; }
    100% { opacity: 1; }
  }

  .anim-modal    { animation: modal-in  .45s cubic-bezier(.34,1.56,.64,1) forwards; }
  .anim-bounce   { animation: bounce-in .65s cubic-bezier(.68,-.55,.265,1.55) forwards; }
  .anim-shake    { animation: shake-x   .65s cubic-bezier(.36,.07,.19,.97); }
  .ring-expand   { animation: ring-expand 1.6s ease-out infinite; }
  .glow-pulse    { animation: glow-pulse  2.2s ease-in-out infinite; }
  .backdrop-in   { animation: backdrop-in .3s ease forwards; }
  .dot-0 { animation: bounce-dot 1s ease-in-out infinite; animation-delay:  0s; }
  .dot-1 { animation: bounce-dot 1s ease-in-out infinite; animation-delay: .2s; }
  .dot-2 { animation: bounce-dot 1s ease-in-out infinite; animation-delay: .4s; }
`;

const GLOW: Record<string, string> = {
  loading: 'rgba(249,115,22,0.28)',
  success: 'rgba(34,197,94,0.28)',
  error:   'rgba(239,68,68,0.28)',
};

const BAR_GRADIENT: Record<string, string> = {
  loading: 'linear-gradient(90deg, transparent, rgb(249,115,22), transparent)',
  success: 'linear-gradient(90deg, transparent, rgb(34,197,94),  transparent)',
  error:   'linear-gradient(90deg, transparent, rgb(239,68,68),  transparent)',
};

const RING_COLOR: Record<string, string> = {
  loading: 'border-orange-300',
  success: 'border-green-300',
  error:   'border-red-300',
};

export default function StatusAnimation({ status, message, onComplete }: StatusAnimationProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setShow(true));
    if (status !== 'loading' && onComplete) {
      const t = setTimeout(() => onComplete(), 2000);
      return () => clearTimeout(t);
    }
  }, [status, onComplete]);

  return (
    <>
      <style>{STYLES}</style>

      <div className={`backdrop-in fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}>

        {/* backdrop */}
        <div className="absolute inset-0 bg-black/65 backdrop-blur-md" />

        {/* card */}
        <div
          className="anim-modal relative bg-white dark:bg-[#0d0a04] rounded-3xl p-10 border border-gray-100 dark:border-white/10 flex flex-col items-center gap-6 min-w-[300px] max-w-sm mx-4"
          style={{ boxShadow: `0 0 70px ${GLOW[status]}, 0 30px 60px rgba(0,0,0,.35)` }}
        >
          {/* top accent bar */}
          <div className="absolute top-0 inset-x-0 h-[3px] rounded-t-3xl" style={{ background: BAR_GRADIENT[status] }} />

          {/* dot-grid */}
          <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-[0.025]"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />

          {/* ── Icon section ── */}
          <div className="relative flex items-center justify-center w-28 h-28">
            {/* ping ring */}
            <div className={`ring-expand absolute w-24 h-24 rounded-full border-2 ${RING_COLOR[status]}`} />

            {status === 'loading' && (
              <>
                <Loader2 className="w-20 h-20 text-orange-500 animate-spin relative z-10 drop-shadow-lg" />
                <div className="glow-pulse absolute w-20 h-20 rounded-full bg-orange-500/20 blur-xl" />
              </>
            )}

            {status === 'success' && (
              <div className="anim-bounce relative z-10">
                <CheckCircle2 className="w-20 h-20 text-green-500 drop-shadow-lg" />
                <div className="glow-pulse absolute inset-0 w-20 h-20 rounded-full bg-green-500/25 blur-xl" />
              </div>
            )}

            {status === 'error' && (
              <div className="anim-shake relative z-10">
                <XCircle className="w-20 h-20 text-red-500 drop-shadow-lg" />
                <div className="glow-pulse absolute inset-0 w-20 h-20 rounded-full bg-red-500/25 blur-xl" />
              </div>
            )}
          </div>

          {/* message */}
          {message && (
            <p className={`text-base font-semibold text-center max-w-xs leading-relaxed ${
              status === 'loading' ? 'text-gray-700 dark:text-gray-200'
              : status === 'success' ? 'text-green-700 dark:text-green-400'
              : 'text-red-700 dark:text-red-400'
            }`}>
              {message}
            </p>
          )}

          {/* loading dots */}
          {status === 'loading' && (
            <div className="flex gap-2.5">
              <div className="dot-0 w-3 h-3 rounded-full bg-orange-500 shadow-md shadow-orange-500/50" />
              <div className="dot-1 w-3 h-3 rounded-full bg-orange-500 shadow-md shadow-orange-500/50" />
              <div className="dot-2 w-3 h-3 rounded-full bg-orange-500 shadow-md shadow-orange-500/50" />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
