import { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { Loader2, Video, Upload, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { ProgressRing } from './ProgressRing';
import type { UploadState } from './types';
import { formatBytes } from './utils';
import { ACCEPTED_MIME_TYPES } from './types';

interface UploadZoneProps {
  uploadState:     UploadState;
  onFileSelected:  (file: File) => void;
  onClear:         () => void;
}

export function UploadZone({ uploadState, onFileSelected, onClear }: UploadZoneProps) {
  const inputRef   = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelected(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    // Reset input so the same file can be re-selected after clear
    e.target.value = '';
  };

  // ── Uploading state ──
  if (uploadState.status === 'uploading') {
    return (
      <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-200 dark:border-blue-500/20">
        <div className="relative" style={{ width: 48, height: 48 }}>
          <ProgressRing progress={uploadState.progress} size={48} />
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-blue-600 dark:text-blue-400 rotate-90">
            {uploadState.progress}%
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-blue-700 dark:text-blue-300">
            Yuklanmoqda…
          </p>
          <p className="text-[11px] text-blue-500 dark:text-blue-400/70 truncate mt-0.5">
            {uploadState.file?.name}
          </p>
        </div>
        <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
      </div>
    );
  }

  // ── Success state ──
  if (uploadState.status === 'success' && uploadState.result) {
    const { result, file } = uploadState;
    return (
      <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-200 dark:border-emerald-500/20">
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
          {result.media_type === 'image' || result.media_type === 'gif' ? (
            <img
              src={result.media_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <Video className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
              Muvaffaqiyatli yuklandi
            </p>
          </div>
          <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/60 truncate mt-0.5">
            {file?.name} • {formatBytes(result.size_bytes)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="p-1 rounded-lg text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors shrink-0"
          title="Boshqasini tanlash"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // ── Error state ──
  if (uploadState.status === 'error') {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-200 dark:border-red-500/20">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-red-600 dark:text-red-400">
            {uploadState.errorMsg ?? "Yuklashda xatolik"}
          </p>
          <p className="text-[11px] text-red-500/70 truncate mt-0.5">
            {uploadState.file?.name}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-[12px] font-medium text-red-500 hover:text-red-600 transition-colors shrink-0"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  // ── Idle / drop zone ──
  return (
    <div
      role="button"
      tabIndex={0}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all select-none ${
        dragging
          ? 'border-orange-400 bg-orange-50 dark:bg-orange-500/10 scale-[1.01]'
          : 'border-gray-200 dark:border-white/[0.1] hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-gray-50 dark:hover:bg-white/[0.02]'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
        dragging
          ? 'bg-orange-100 dark:bg-orange-500/20'
          : 'bg-gray-100 dark:bg-white/[0.06]'
      }`}>
        <Upload className={`w-5 h-5 transition-colors ${dragging ? 'text-orange-500' : 'text-gray-400'}`} />
      </div>
      <div className="text-center">
        <p className="text-[13px] font-semibold text-gray-600 dark:text-gray-300">
          Faylni bu yerga tashlang
        </p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
          yoki bosib tanlang
        </p>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-600">
        JPEG · PNG · WebP · GIF · MP4 · MOV · WebM &nbsp;•&nbsp; Rasm ≤50 MB · Video ≤200 MB
      </p>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={ACCEPTED_MIME_TYPES}
        onChange={handleChange}
      />
    </div>
  );
}
