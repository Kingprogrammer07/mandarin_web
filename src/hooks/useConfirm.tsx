import { useState, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  message: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' renders the confirm button in red; 'warning' in amber (default) */
  variant?: 'danger' | 'warning';
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    message: '',
  });

  // resolveRef holds the resolve function of the pending Promise
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
      setState({ isOpen: true, ...options });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  function ConfirmDialog() {
    if (!state.isOpen) return null;

    const isDanger = state.variant === 'danger' || !state.variant;
    const confirmCls = isDanger
      ? 'flex-1 h-10 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-red-500 to-rose-500 hover:opacity-90 active:scale-[0.98] transition-all border-0 shadow-md shadow-red-500/25'
      : 'flex-1 h-10 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 active:scale-[0.98] transition-all border-0 shadow-md shadow-amber-500/25';

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] animate-in fade-in duration-150"
          onClick={handleCancel}
        />

        {/* Dialog */}
        <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
          <div
            className="pointer-events-auto w-full max-w-sm bg-white dark:bg-[#0d0a04] rounded-2xl border border-gray-100 dark:border-white/[0.08] shadow-2xl shadow-black/30 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Accent bar */}
            <div className={`h-[3px] ${isDanger ? 'bg-gradient-to-r from-transparent via-red-500 to-transparent' : 'bg-gradient-to-r from-transparent via-amber-500 to-transparent'}`} />

            <div className="p-5">
              {/* Icon + message */}
              <div className="flex items-start gap-3 mb-5">
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isDanger ? 'bg-red-50 dark:bg-red-500/10' : 'bg-amber-50 dark:bg-amber-500/10'}`}>
                  <AlertTriangle className={`w-5 h-5 ${isDanger ? 'text-red-500' : 'text-amber-500'}`} />
                </div>
                <div className="pt-0.5 min-w-0">
                  <p className="text-[14px] font-black text-gray-800 dark:text-gray-100 leading-snug">
                    {state.message}
                  </p>
                  {state.description && (
                    <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1 leading-relaxed">
                      {state.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  className="flex-1 h-10 rounded-xl text-[13px] font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/[0.1] active:scale-[0.98] transition-all border-0"
                >
                  {state.cancelLabel ?? 'Bekor qilish'}
                </button>
                <button onClick={handleConfirm} className={confirmCls}>
                  {state.confirmLabel ?? 'Tasdiqlash'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return { confirm, ConfirmDialog };
}
