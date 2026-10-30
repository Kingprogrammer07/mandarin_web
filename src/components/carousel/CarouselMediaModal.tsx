import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import type { CarouselMediaItemResponse } from '@/api/services/carousel';
import { trackCarouselClick } from '@/api/services/carousel';
import { isSafeCarouselLink, openCarouselLink } from '@/lib/carouselLinks';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CarouselMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: number;
  title?: string | null;
  subTitle?: string | null;
  actionUrl?: string | null;
  /** Slides, already sorted by `order`. One slide is fine: a video promo opens
   *  here with just itself. */
  mediaItems: CarouselMediaItemResponse[];
}

// ─── Media slide ──────────────────────────────────────────────────────────────

interface MediaSlideProps {
  media: CarouselMediaItemResponse;
  active: boolean;
}

const MediaSlide = memo(({ media, active }: MediaSlideProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Only the slide on screen plays. Starting with sound works because the
  // client just tapped the promo; if the WebView still refuses, the native
  // controls are there and one more tap plays it.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [active]);

  if (media.media_type === 'video') {
    return (
      <video
        ref={videoRef}
        src={media.media_url}
        className="h-full max-h-full w-full max-w-full bg-black object-contain"
        controls
        playsInline
        preload="auto"
        controlsList="nodownload"
      />
    );
  }
  return (
    <img
      src={media.media_url}
      alt=""
      className="max-h-full max-w-full select-none object-contain"
      draggable={false}
    />
  );
});
MediaSlide.displayName = 'MediaSlide';

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function CarouselMediaModal({
  isOpen,
  onClose,
  itemId,
  title,
  subTitle,
  actionUrl,
  mediaItems,
}: CarouselMediaModalProps) {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const count = mediaItems.length;
  const hasLink = isSafeCarouselLink(actionUrl);

  const scrollToSlide = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(count - 1, index));
    el.scrollTo({ left: el.clientWidth * clamped, behavior: 'smooth' });
    setActiveIndex(clamped);
  }, [count]);

  // Follow the swipe so the active slide (and the one video allowed to play)
  // is always the one on screen.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.clientWidth === 0) return;
      setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [isOpen]);

  // Keyboard on desktop Telegram / browser; the page behind must not scroll.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') scrollToSlide(activeIndex + 1);
      else if (e.key === 'ArrowLeft') scrollToSlide(activeIndex - 1);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose, scrollToSlide, activeIndex]);

  const handleCta = () => {
    if (!hasLink) return;
    void trackCarouselClick(itemId).catch(() => {});
    openCarouselLink(actionUrl);
  };

  if (!isOpen || count === 0) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[11000] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={title || t('dashboard.carousel.media.label', 'Media')}
    >
      {/* Top bar: position on the left, close on the right. Clear of the
          status bar and of Telegram's own header in full-screen mode. */}
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="min-w-[44px] text-[13px] font-semibold tabular-nums text-white/70">
          {count > 1 ? `${activeIndex + 1} / ${count}` : ''}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white transition-colors active:bg-white/20"
          aria-label={t('dashboard.carousel.media.close', 'Yopish')}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Slides */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="mc-no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto"
        >
          {mediaItems.map((media, i) => (
            <div
              key={media.id}
              className="flex h-full w-full shrink-0 snap-center items-center justify-center"
            >
              <MediaSlide media={media} active={i === activeIndex} />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => scrollToSlide(activeIndex - 1)}
              disabled={activeIndex === 0}
              className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-opacity disabled:opacity-0 sm:flex"
              aria-label={t('dashboard.carousel.media.prev', 'Oldingi')}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollToSlide(activeIndex + 1)}
              disabled={activeIndex === count - 1}
              className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-opacity disabled:opacity-0 sm:flex"
              aria-label={t('dashboard.carousel.media.next', 'Keyingi')}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Caption and link */}
      {(title || subTitle || hasLink || count > 1) && (
        <div className="shrink-0 space-y-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {count > 1 && (
            <div className="flex justify-center gap-1.5" aria-hidden="true">
              {mediaItems.map((m, i) => (
                <span
                  key={m.id}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/30'
                  }`}
                />
              ))}
            </div>
          )}
          {(title || subTitle) && (
            <div>
              {title && (
                <h2 className="text-[17px] font-bold leading-snug text-white">{title}</h2>
              )}
              {subTitle && (
                <p className="mt-1 text-[14px] leading-snug text-white/60">{subTitle}</p>
              )}
            </div>
          )}
          {hasLink && (
            <button
              type="button"
              onClick={handleCta}
              className="flex w-full items-center justify-center gap-2 rounded-mc-lg bg-white py-3.5 text-[15px] font-semibold text-black transition-transform active:scale-[0.98]"
            >
              {t('dashboard.carousel.media.more', "Batafsil")}
              <ArrowUpRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </motion.div>,
    document.body,
  );
}
