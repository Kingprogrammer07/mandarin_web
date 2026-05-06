import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { ProgressRing } from './ProgressRing';
import type { UploadState } from './types';

interface GlobalUploadBadgeProps {
  uploadState: UploadState;
}

export const GlobalUploadBadge = memo(({ uploadState }: GlobalUploadBadgeProps) => {
  if (uploadState.status === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed bottom-6 right-4 z-[200] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border max-w-xs bg-white dark:bg-[#1c1c1e] border-black/[0.08] dark:border-white/[0.1]"
      >
        {uploadState.status === 'uploading' && (
          <>
            <div className="relative" style={{ width: 36, height: 36 }}>
              <ProgressRing progress={uploadState.progress} size={36} />
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-blue-600 dark:text-blue-400 rotate-90">
                {uploadState.progress}%
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100">
                Media yuklanmoqda…
              </p>
              <p className="text-[10px] text-gray-400 truncate max-w-[160px]">
                {uploadState.file?.name}
              </p>
            </div>
          </>
        )}
        {uploadState.status === 'success' && (
          <>
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100">
              Yuklash tugadi
            </p>
          </>
        )}
        {uploadState.status === 'error' && (
          <>
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100">
              Yuklashda xatolik
            </p>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
});
GlobalUploadBadge.displayName = 'GlobalUploadBadge';
