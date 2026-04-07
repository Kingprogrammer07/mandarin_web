import { useState, useRef, useEffect, useLayoutEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import type { CarouselMediaItemResponse } from '@/api/services/carousel';
import { trackCarouselClick } from '@/api/services/carousel';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CarouselMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: number;
  title?: string | null;
  subTitle?: string | null;
  actionUrl?: string | null;
  /** Gallery slides — must already be sorted by `order` before passing in */
  mediaItems: CarouselMediaItemResponse[];
}

// ─── Media slide ──────────────────────────────────────────────────────────────

const MediaSlide = memo(({ media }: { media: CarouselMediaItemResponse }) => {
  if (media.media_type === 'video') {
    return (
      <video
        src={media.media_url}
        className="max-w-full max-h-full object-contain rounded-xl"
        controls
        playsInline
      />
    );
  }
  return (
    <img
      src={media.media_url}
      alt=""
      className="max-w-full max-h-full object-contain rounded-xl"
      draggable={false}
    />
  );
});
MediaSlide.displayName = 'MediaSlide';

// ─── Carousel content (remounted via key on every open → state resets naturally) ──

interface CarouselContentProps {
  sorted: CarouselMediaItemResponse[];
  itemId: number;
  actionUrl: string | null | undefined;
}

function CarouselContent({ sorted, itemId, actionUrl }: CarouselContentProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // On mount (fresh instance after key change), reset scroll to start
  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, []);

  // Scroll the inner carousel to a specific slide
  const scrollToSlide = (index: number) => {
    if (!scrollRef.current) return;
    const clamped = Math.max(0, Math.min(sorted.length - 1, index));
    scrollRef.current.scrollTo({ left: scrollRef.current.clientWidth * clamped, behavior: 'smooth' });
    setActiveIndex(clamped);
  };

  // Keep activeIndex in sync while the user swipes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.clientWidth === 0) return;
      setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const handleCtaClick = () => {
    if (!actionUrl) return;
    trackCarouselClick(itemId);
    window.open(actionUrl, '_blank');
  };

  return (
    <>
      {/* ── Inner carousel ─────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={scrollRef}
          className="flex h-full overflow-x-auto snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {sorted.map((media) => (
            <div
              key={media.id}
              className="flex-shrink-0 w-full h-full snap-start flex items-center justify-center px-4 py-2"
            >
              <MediaSlide media={media} />
            </div>
          ))}
        </div>

        {/* Prev / Next arrows — only shown when >1 slide */}
        {sorted.length > 1 && (
          <>
            <button
              onClick={() => scrollToSlide(activeIndex - 1)}
              disabled={activeIndex === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white disabled:opacity-20 transition-all"
              aria-label="Oldingi"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scrollToSlide(activeIndex + 1)}
              disabled={activeIndex === sorted.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white disabled:opacity-20 transition-all"
              aria-label="Keyingi"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* ── Dot indicators ─────────────────────────────────── */}
      {sorted.length > 1 && (
        <div className="flex justify-center items-center gap-1.5 py-3 shrink-0">
          {sorted.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToSlide(i)}
              className={`rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? 'w-5 h-1.5 bg-white'
                  : 'w-1.5 h-1.5 bg-white/35 hover:bg-white/55'
              }`}
              aria-label={`Slayd ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* ── CTA button ─────────────────────────────────────── */}
      {actionUrl && (
        <div className="shrink-0 px-4 pb-6 pt-2">
          <button
            onClick={handleCtaClick}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-white hover:bg-gray-100 active:scale-[0.98] text-gray-900 rounded-2xl font-semibold text-[15px] transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Batafsil ko'rish
          </button>
        </div>
      )}
    </>
  );
}

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
  const sorted = [...mediaItems].sort((a, b) => a.order - b.order);

  if (!isOpen) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[11000] bg-black/90 flex flex-col"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="flex flex-col w-full h-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end px-4 pt-4 pb-2 shrink-0">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Yopish"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <CarouselContent
          sorted={sorted}
          itemId={itemId}
          actionUrl={actionUrl}
        />

        {(title || subTitle) && (
          <div className="shrink-0 px-4 pb-4 pt-2">
            {title && (
              <h2 className="text-white font-bold text-lg leading-tight">{title}</h2>
            )}
            {subTitle && (
              <p className="text-white/55 text-sm mt-0.5">{subTitle}</p>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
