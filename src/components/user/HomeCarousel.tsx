import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  getActiveCarouselItems,
  trackCarouselClick,
  trackCarouselView,
} from '@/api/services/carousel';
import { HomeCarouselCard } from '@/components/user/HomeCarouselCard';
import { CAROUSEL_ITEMS } from '@/pages/user/dashboard-components/constants';
import type { CarouselItemData } from '@/pages/user/dashboard-components/types';

const AUTO_ADVANCE_MS = 4000;
/** Gap between slides, in px. Mirrored by the scroll-position arithmetic. */
const SLIDE_GAP = 12;
const RESUME_AFTER_TOUCH_MS = 3000;

interface HomeCarouselProps {
  onItemClick: (item: CarouselItemData) => void;
}

/**
 * The promo strip, sitting between the summary tiles and the shortcuts.
 *
 * Carried over from the old dashboard with three gaps closed: it had no
 * loading state (a blank band on a slow connection), no error state (a silent
 * disappearance), and its auto-advance ignored `prefers-reduced-motion`.
 */
export function HomeCarousel({ onItemClick }: HomeCarouselProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isScrollable, setIsScrollable] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewed = useRef(new Set<string>());

  /** Static ids 1 and 3 are hand-assigned and collide with the serial ids the
   *  API issues, so anything keyed on the raw id has to be namespaced. */
  const itemKey = (item: CarouselItemData) =>
    `${item.fromApi ? 'api' : 'static'}-${item.id}`;

  const { data, isLoading } = useQuery({
    queryKey: ['carousel-items'],
    queryFn: getActiveCarouselItems,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // The two built-in feature cards ("taqiqlangan buyumlar", "yetkazib berish")
  // always trail the promos. `carousel_items` is empty on a fresh database, and
  // without these the whole strip vanished — which is what happened here.
  const staticFeatures = useMemo<CarouselItemData[]>(
    () => CAROUSEL_ITEMS.filter((i) => i.type === 'feature').sort((a, b) => a.id - b.id),
    [],
  );

  const items = useMemo<CarouselItemData[]>(() => {
    const fromApi: CarouselItemData[] = !data
      ? []
      : [...data]
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        id: item.id,
        type: item.type as 'ad' | 'feature',
        title: item.title ?? undefined,
        sub: item.sub_title ?? undefined,
        gradientStyle: item.gradient ?? 'linear-gradient(135deg, #1a1a2e, #16213e)',
        mediaType: item.media_type,
        mediaUrl: item.media_url,
        actionUrl: item.action_url ?? undefined,
        textColor: item.text_color,
        fromApi: true,
        mediaItems: item.media_items ?? [],
      }));

    return [...fromApi, ...staticFeatures];
  }, [data, staticFeatures]);

  // Auto-advance, unless the user is touching it or has asked the system for
  // less motion. A strip that keeps sliding under a reader's finger is the
  // exact complaint reduced-motion exists to answer.
  useEffect(() => {
    if (isPaused || items.length < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      // Nothing worth advancing to: on a wide viewport the whole strip is
      // already visible, and scrolling it would just twitch in place.
      if (el.scrollWidth <= el.clientWidth + 24) return;
      const step = el.clientWidth + SLIDE_GAP;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      el.scrollTo({
        left: atEnd ? 0 : el.scrollLeft + step,
        behavior: 'smooth',
      });
    }, AUTO_ADVANCE_MS);

    return () => clearInterval(interval);
  }, [isPaused, items.length]);

  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);

  // Dots describe a position within something longer than the viewport. On a
  // wide desktop window the whole strip already fits, so there is no position
  // to report and a permanently-first dot would be misinformation.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setIsScrollable(el.scrollWidth > el.clientWidth + 24);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    if (!first) return;
    // Slide width plus the flex gap. `offsetLeft` of the second child would be
    // exact but is undefined for a single-slide strip.
    const step = first.offsetWidth + SLIDE_GAP;
    setActiveIndex(Math.round(el.scrollLeft / step));
  }, []);

  const pauseBriefly = useCallback(() => {
    setIsPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setIsPaused(false), RESUME_AFTER_TOUCH_MS);
  }, []);

  // One view per item per mount. Analytics must never be able to break the
  // screen it measures, hence the swallowed rejection.
  const markViewed = useCallback((item: CarouselItemData) => {
    // Only API rows exist in `carousel_stats`. The built-in cards reuse ids 1
    // and 3, so tracking them would credit views to whichever real promos hold
    // those ids.
    if (!item.fromApi) return;
    const key = itemKey(item);
    if (viewed.current.has(key)) return;
    viewed.current.add(key);
    void trackCarouselView(item.id).catch(() => {});
  }, []);

  const handleClick = useCallback(
    (item: CarouselItemData) => {
      if (item.fromApi) void trackCarouselClick(item.id).catch(() => {});
      onItemClick(item);
    },
    [onItemClick],
  );

  if (isLoading && items.length === 0) {
    return (
      <div className="px-4" aria-hidden="true">
        <div className="h-[150px] w-full animate-pulse rounded-mc-lg border border-mc-border bg-mc-surface-2" />
      </div>
    );
  }

  // No promos is a normal state, not a failure — render nothing rather than an
  // empty-state card telling the client something is missing. `isError` no
  // longer hides the strip on its own: the built-in cards do not come from the
  // request that failed.
  if (items.length === 0) return null;

  return (
    <div className="relative px-4">
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      onTouchStart={pauseBriefly}
      onTouchEnd={pauseBriefly}
      // Also pause for a mouse or a keyboard: auto-advance moving a card out
      // from under a pointer, or away from the item someone just tabbed to, is
      // the same problem touch already guarded against.
      onPointerDown={pauseBriefly}
      onMouseEnter={pauseBriefly}
      onFocusCapture={pauseBriefly}
      // py-1 leaves room for the 2px focus outline (index.css) plus its offset;
      // an overflow container clips it on both axes, not just the scrolling one.
      className="mc-no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto py-1"
      role="region"
      aria-label={t('home.carousel.label', "E'lonlar")}
    >
      {items.map((item) => {
        const label = item.titleKey ? t(item.titleKey) : item.title;
        // An API promo with media opens it full screen, and one with a link
        // follows it (see UserHome.handleCarouselItem). Only a text-only promo
        // with no link has nowhere to go; rendering that as a button would
        // announce a control, take a tab stop and log a click, all for nothing.
        const isInteractive =
          !item.fromApi ||
          Boolean(item.actionUrl) ||
          Boolean(item.mediaUrl) ||
          (item.mediaItems?.length ?? 0) > 0;
        const shared = {
          className:
            'w-full shrink-0 snap-start text-left transition-transform duration-150 rounded-mc-lg',
          children: <HomeCarouselCard item={item} onView={markViewed} />,
        };

        if (!isInteractive) {
          return <div key={itemKey(item)} {...shared} />;
        }

        // A button, not the div the old dashboard used: these open modals and
        // external links, so they have to be reachable by keyboard and
        // announced as controls.
        return (
          <button
            key={itemKey(item)}
            type="button"
            onClick={() => handleClick(item)}
            // Image-only promos are legal in the admin schema, and every visual
            // in the card is hidden from assistive tech — without this the
            // button would have no accessible name at all.
            aria-label={label || t('home.carousel.itemFallback', "E'lonni ochish")}
            {...shared}
            className={`${shared.className} active:scale-[0.985]`}
          />
        );
      })}
      </div>

      {/* Position indicator instead of a scrollbar. On a phone the bar is
          invisible anyway; on desktop it rendered as a grey strip under the
          cards. Dots also say how many promos exist, which a scrollbar only
          implies. Hidden for a single card, where there is nothing to indicate.

          Below the strip, not overlaid on it: over a slide the pill sat on top
          of any headline that wrapped to a second line. */}
      {isScrollable && items.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden="true">
          {items.map((item, index) => (
            <span
              key={itemKey(item)}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                index === activeIndex ? 'w-4 bg-mc-brand' : 'w-1.5 bg-mc-text-3/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
