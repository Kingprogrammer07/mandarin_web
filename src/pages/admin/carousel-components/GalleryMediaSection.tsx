import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Plus, Upload, Trash2 } from 'lucide-react';
import { UploadZone } from './UploadZone';
import type { GalleryItemState } from './types';
import { ACCEPTED_MIME_TYPES } from './types';
import { labelClass } from './utils';

interface GalleryMediaSectionProps {
  items:          GalleryItemState[];
  onAddItem:      () => void;
  onBatchAdd:     (files: File[]) => void;
  onRemoveItem:   (localId: string) => void;
  onFileSelected: (localId: string, file: File) => void;
  onClearItem:    (localId: string) => void;
}

export function GalleryMediaSection({
  items, onAddItem, onBatchAdd, onRemoveItem, onFileSelected, onClearItem,
}: GalleryMediaSectionProps) {
  const batchInputRef = useRef<HTMLInputElement>(null);

  const handleBatchClick = () => {
    batchInputRef.current?.click();
  };

  const handleBatchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      onBatchAdd(files);
    }
    e.target.value = '';
  };

  const LIMITS = { image: 20, gif: 20, video: 5 };
  const imageCount = items.filter(i => {
    const t = i.uploadState.result?.media_type;
    return t === 'image' || t === 'gif';
  }).length;
  const videoCount = items.filter(i => i.uploadState.result?.media_type === 'video').length;
  const canAddMore = imageCount < LIMITS.image && videoCount < LIMITS.video;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className={labelClass}>Media galleryasi</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBatchClick}
            disabled={!canAddMore}
            className="flex items-center gap-1 text-[12px] font-semibold text-blue-500 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Ko'p fayl yuklash
          </button>
          <button
            type="button"
            onClick={onAddItem}
            disabled={!canAddMore}
            className="flex items-center gap-1 text-[12px] font-semibold text-orange-500 hover:text-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Qo'shish
          </button>
        </div>
      </div>
      <input
        ref={batchInputRef}
        type="file"
        multiple
        hidden
        accept={ACCEPTED_MIME_TYPES}
        onChange={handleBatchChange}
      />

      {items.length === 0 ? (
        <button
          type="button"
          onClick={onAddItem}
          className="w-full py-5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/[0.08] text-[12px] text-gray-400 dark:text-gray-600 hover:border-orange-300 dark:hover:border-orange-500/40 hover:text-orange-500 transition-all"
        >
          + Birinchi slideni qo'shing
        </button>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={item.localId} className="flex items-start gap-2">
              <span className="w-5 h-5 mt-[18px] rounded-full bg-gray-100 dark:bg-white/[0.06] text-[10px] font-bold flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <UploadZone
                  uploadState={item.uploadState}
                  onFileSelected={(file) => onFileSelected(item.localId, file)}
                  onClear={() => onClearItem(item.localId)}
                />
              </div>
              <button
                type="button"
                onClick={() => onRemoveItem(item.localId)}
                className="p-1.5 mt-[14px] rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
                title="O'chirish"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-gray-400 dark:text-gray-600">
        Rasm/GIF: {imageCount}/{LIMITS.image} · Video: {videoCount}/{LIMITS.video}
      </p>
    </div>
  );
}
