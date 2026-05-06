import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Eye, MousePointerClick, TrendingUp, Pencil, Trash2, ToggleLeft, ToggleRight, Check, X, ExternalLink } from 'lucide-react';
import type { CarouselItemStatsResponse } from '../../../api/services/adminCarousel';
import { MEDIA_TYPE_ICON } from './types';
import { formatNumber } from './utils';

interface CarouselCardProps {
  item:            CarouselItemStatsResponse;
  onEdit:          (item: CarouselItemStatsResponse) => void;
  onDelete:        (id: number) => void;
  onToggleActive:  (item: CarouselItemStatsResponse) => void;
  isTogglingId:    number | null;
  isDeletingId:    number | null;
  confirmDeleteId: number | null;
  onConfirmDelete: (id: number) => void;
  onCancelDelete:  () => void;
}

export const CarouselCard = memo(({
  item, onEdit, onDelete, onToggleActive,
  isTogglingId, isDeletingId, confirmDeleteId,
  onConfirmDelete, onCancelDelete,
}: CarouselCardProps) => {
  const isToggling   = isTogglingId === item.id;
  const isDeleting   = isDeletingId === item.id;
  const isConfirming = confirmDeleteId === item.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-[#111] rounded-[20px] border overflow-hidden transition-all ${
        item.is_active
          ? 'border-black/[0.05] dark:border-white/[0.06]'
          : 'border-gray-200/60 dark:border-white/[0.04] opacity-60'
      }`}
    >
      {/* Media preview */}
      <div
        className="relative h-36 overflow-hidden flex items-center justify-center"
        style={{ background: item.gradient ?? 'linear-gradient(135deg, #1a1a2e, #16213e)' }}
      >
        {(item.media_type === 'image' || item.media_type === 'gif') ? (
          <img
            src={item.media_url}
            alt={item.title ?? ''}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : item.media_type === 'video' ? (
          <video
            src={item.media_url}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
          />
        ) : null}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {(item.title || item.sub_title) && (
          <div className="absolute bottom-0 left-0 right-0 p-3">
            {item.title && (
              <p
                className="text-[13px] font-bold truncate leading-tight"
                style={{ color: item.text_color }}
              >
                {item.title}
              </p>
            )}
            {item.sub_title && (
              <p className="text-[11px] text-white/70 truncate mt-0.5">{item.sub_title}</p>
            )}
          </div>
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-sm ${
            item.type === 'ad' ? 'bg-blue-500/80 text-white' : 'bg-purple-500/80 text-white'
          }`}>
            {item.type === 'ad' ? 'AD' : 'FEATURE'}
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-black/40 text-white/90 backdrop-blur-sm">
            {MEDIA_TYPE_ICON[item.media_type]}
          </span>
        </div>

        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/40 text-white/90 text-[11px] font-bold backdrop-blur-sm">
            {item.order}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {formatNumber(item.total_views)}
            </span>
            <span className="text-[11px]">ko'rish</span>
          </div>
          <div className="w-px h-3.5 bg-gray-200 dark:bg-white/[0.08]" />
          <div className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
            <MousePointerClick className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {formatNumber(item.total_clicks)}
            </span>
            <span className="text-[11px]">bosish</span>
          </div>
          {item.total_views > 0 && (
            <>
              <div className="w-px h-3.5 bg-gray-200 dark:bg-white/[0.08]" />
              <div className="flex items-center gap-1 text-[11px] text-orange-500 font-medium">
                <TrendingUp className="w-3 h-3" />
                {((item.total_clicks / item.total_views) * 100).toFixed(1)}%
              </div>
            </>
          )}
        </div>

        {item.action_url && (
          <a
            href={item.action_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-blue-500 hover:text-blue-600 truncate"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{item.action_url}</span>
          </a>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onToggleActive(item)}
            disabled={isToggling}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              item.is_active
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                : 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
            } disabled:opacity-50`}
          >
            {isToggling
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : item.is_active
                ? <ToggleRight className="w-3.5 h-3.5" />
                : <ToggleLeft  className="w-3.5 h-3.5" />
            }
            {item.is_active ? 'Faol' : 'Nofaol'}
          </button>

          <div className="flex-1" />

          <button
            onClick={() => onEdit(item)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
            title="Tahrirlash"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {!isConfirming ? (
            <button
              onClick={() => onConfirmDelete(item.id)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="O'chirish"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <AnimatePresence>
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1"
              >
                <button
                  onClick={() => onDelete(item.id)}
                  disabled={isDeleting}
                  className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                  title="Ha, o'chir"
                >
                  {isDeleting
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Check   className="w-3.5 h-3.5" />
                  }
                </button>
                <button
                  onClick={onCancelDelete}
                  disabled={isDeleting}
                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/[0.06] text-gray-500 hover:bg-gray-200 dark:hover:bg-white/[0.1] transition-colors"
                  title="Bekor qilish"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  );
});
CarouselCard.displayName = 'CarouselCard';
