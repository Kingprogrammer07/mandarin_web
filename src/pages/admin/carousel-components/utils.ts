import { useState, useEffect } from 'react';
import type { CarouselMediaType } from '../../../api/services/adminCarousel';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_024).toFixed(0)} KB`;
}

export function detectMediaTypeFromMime(mime: string): CarouselMediaType | null {
  if (mime === 'image/gif')       return 'gif';
  if (mime.startsWith('image/'))  return 'image';
  if (mime.startsWith('video/'))  return 'video';
  return null;
}

export const inputClass =
  'w-full p-3 bg-gray-50/80 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] rounded-xl text-[14px] focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600';

export const labelClass =
  'block text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5';
