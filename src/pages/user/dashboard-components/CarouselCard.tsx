import { memo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import type { CarouselItemData } from './types';

export const CarouselCard = memo(({ item, onView }: { item: CarouselItemData; onView?: () => void }) => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const isAd = item.type === 'ad';
  const title = item.titleKey ? t(item.titleKey) : item.title;
  const sub = item.subKey ? t(item.subKey) : item.sub;

  // Fire onView once when the card is ≥50% visible (IntersectionObserver)
  useEffect(() => {
    if (!onView || !cardRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onView();
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [onView]);

  if (isAd) {
    return (
      <div
        ref={cardRef}
        className="
          flex-shrink-0 w-[85%] sm:w-[45%] lg:w-full
          h-40 rounded-3xl relative overflow-hidden
          snap-start cursor-pointer hover:scale-[0.98] transition-all duration-200
          border border-white/10 shadow-lg group
        "
      >
        {item.mediaType === 'video' ? (
          <video
            src={item.mediaUrl}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img
            src={item.mediaUrl}
            alt={item.title || 'Ad'}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <div className="absolute inset-0 p-5 flex flex-col justify-end">
          {title && (
            <h3
              className="font-bold text-xl leading-tight mb-0.5"
              style={{ color: item.textColor || 'white' }}
            >
              {title}
            </h3>
          )}
          {sub && (
            <p className="text-white/80 text-sm font-medium flex items-center gap-1">
              {sub} <ChevronRight className="w-4 h-4" />
            </p>
          )}
        </div>
      </div>
    );
  }

  // Feature card — supports both Tailwind gradient classes (static) and CSS gradient value (API)
  return (
    <div
      ref={cardRef}
      className={`
        flex-shrink-0 w-[85%] sm:w-[45%] md:w-[280px] lg:w-[300px]
        h-40 rounded-3xl relative overflow-hidden
        snap-start cursor-pointer hover:scale-[0.98] transition-transform duration-200
        border border-white/10 shadow-lg
        ${item.gradientStyle ? '' : `bg-gradient-to-br ${item.gradient}`}
      `}
      style={item.gradientStyle ? { background: item.gradientStyle } : undefined}
    >
      {item?.bgIcon}
      {/* Background media — faqat mediaUrl bo'lib, mainIcon bo'lmaganda */}
      {item.mediaUrl && !item.mainIcon && (
        <>
          <img
            src={item.mediaUrl}
            alt={item.title || 'Feature'}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        </>
      )}

      {/* Content */}
      <div className="h-full flex flex-col justify-between relative z-10 p-5">
        {/* Top: icon yoki thumbnail */}
        {item.mainIcon ? (
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
            {item.mainIcon}
          </div>
        ) : item.mediaUrl ? (
          // mediaUrl bor, mainIcon yo'q — top-left badge
          <div className="self-start px-2 py-0.5 rounded-md bg-white/15 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wide">
            Yangilik
          </div>
        ) : (
          <div /> // spacer — text pastda qolsin
        )}

        {/* Bottom: title + sub */}
        <div>
          <h3
            className="font-bold text-xl leading-tight mb-1 drop-shadow-sm"
            style={{ color: item.textColor || 'white' }}
          >
            {title}
          </h3>
          {sub && (
            <p
              className="text-sm font-medium drop-shadow-sm"
              style={{ color: item.textColor ? `${item.textColor}b3` : 'rgba(255,255,255,0.7)' }}
            >
              {sub}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
CarouselCard.displayName = 'CarouselCard';
