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
  const hasMedia = Boolean(item.mediaUrl);
  const textColor = item.textColor || '#fff7ed';
  const mutedTextColor = item.textColor ? `${item.textColor}cc` : 'rgba(255,247,237,0.72)';

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
          group relative h-[166px] w-[86%] flex-shrink-0 cursor-pointer overflow-hidden
          rounded-[1.65rem] border border-white/[0.10]
          bg-[#111827] shadow-[0_18px_40px_rgba(0,0,0,0.26)]
          snap-start transition-[transform,border-color,box-shadow] duration-200
          active:scale-[0.985] sm:w-[45%] sm:hover:-translate-y-0.5 sm:hover:border-orange-300/25
          lg:w-full
        "
      >
        {item.mediaType === 'video' ? (
          <video
            src={item.mediaUrl}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img
            src={item.mediaUrl}
            alt={item.title || 'Ad'}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,7,12,0.12),rgba(4,7,12,0.84)),radial-gradient(circle_at_18%_12%,rgba(245,158,11,0.18),transparent_36%)]" />
        <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-between p-4.5">
          <div className="inline-flex w-fit items-center rounded-full border border-white/12 bg-white/[0.08] px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white/72">
            Mandarin
          </div>
          <div>
            {title && (
              <h3
                className="mb-1 max-w-[240px] text-[20px] font-black leading-[1.08] drop-shadow-sm"
                style={{ color: textColor }}
              >
                {title}
              </h3>
            )}
            {sub && (
              <p
                className="flex max-w-[250px] items-center gap-1 text-[12px] font-bold leading-snug drop-shadow-sm"
                style={{ color: mutedTextColor }}
              >
                {sub} <ChevronRight className="h-4 w-4" />
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={`
        group relative h-[166px] w-[86%] flex-shrink-0 cursor-pointer overflow-hidden
        rounded-[1.65rem] border border-white/[0.10]
        shadow-[0_18px_40px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.08)]
        snap-start transition-[transform,border-color,box-shadow] duration-200
        active:scale-[0.985] sm:w-[45%] sm:hover:-translate-y-0.5 sm:hover:border-orange-300/25
        md:w-[292px] lg:w-[316px]
        ${item.gradientStyle || hasMedia ? 'bg-[#151d2a]' : `bg-gradient-to-br ${item.gradient}`}
      `}
      style={item.gradientStyle ? { background: item.gradientStyle } : undefined}
    >
      {hasMedia && (
        <>
          <img
            src={item.mediaUrl}
            alt={item.title || 'Feature'}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,7,12,0.14),rgba(4,7,12,0.86)),radial-gradient(circle_at_16%_12%,rgba(245,158,11,0.16),transparent_36%)]" />
        </>
      )}
      {!hasMedia && item.gradientStyle && (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.025)),radial-gradient(circle_at_14%_12%,rgba(245,158,11,0.10),transparent_38%)]" />
      )}
      {!hasMedia && !item.gradientStyle && (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.09),rgba(255,255,255,0.025))]" />
      )}
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      {item.bgIcon && (
        <div className="pointer-events-none absolute inset-0 text-white opacity-[0.06]" aria-hidden="true">
          {item.bgIcon}
        </div>
      )}

      <div className="relative z-10 flex h-full flex-col justify-between p-4.5">
        {item.mainIcon ? (
          <div className="flex h-[58px] w-[58px] items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.105] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
            {item.mainIcon}
          </div>
        ) : hasMedia ? (
          <div className="self-start rounded-full border border-white/12 bg-white/[0.08] px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white/72">
            Yangilik
          </div>
        ) : (
          <div />
        )}

        <div>
          <h3
            className="mb-1 max-w-[245px] text-[20px] font-black leading-[1.08] drop-shadow-sm"
            style={{ color: textColor }}
          >
            {title}
          </h3>
          {sub && (
            <p
              className="max-w-[250px] text-[12px] font-bold leading-snug drop-shadow-sm"
              style={{ color: mutedTextColor }}
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
