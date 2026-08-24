import { memo, useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CarouselItemData } from '@/pages/user/dashboard-components/types';

interface HomeCarouselCardProps {
  item: CarouselItemData;
  /** Fired once when at least half the card has been on screen. Takes the item
   *  so the parent can pass a stable callback and keep `memo` meaningful. */
  onView?: (item: CarouselItemData) => void;
}

/** One height for every card. A strip whose tiles disagree on height reads as
 *  broken long before anyone notices why.
 *
 *  150px at the full content width is roughly 2.4:1 — enough vertical room for
 *  an uploaded advert to read as artwork rather than a letterbox strip. */
const CARD_HEIGHT = 'h-[150px]';

/**
 * Home-screen carousel card.
 *
 * Written against the `--mc-*` palette instead of the legacy
 * `dashboard-components/CarouselCard`, which hardcodes `#111827`, `#151d2a`
 * and an amber (`#f59e0b`) glow — a different hue from the brand orange — and
 * paints every tile as a dark slab in the middle of a light page. That card is
 * left in place for the legacy dashboard and disappears with it.
 *
 * Only one variant is dark: a promo carrying a photo, where a scrim is the
 * only reliable way to keep text legible over an image the client uploads.
 */
export const HomeCarouselCard = memo(({ item, onView }: HomeCarouselCardProps) => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);

  const title = item.titleKey ? t(item.titleKey) : item.title;
  const sub = item.subKey ? t(item.subKey) : item.sub;
  const hasMedia = Boolean(item.mediaUrl);
  // A looping video in a strip that also auto-scrolls is exactly the pairing
  // reduced-motion exists to stop. Checked at render rather than in an effect
  // so the first frame is already correct.
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const hasAdminGradient = !hasMedia && Boolean(item.gradientStyle);

  useEffect(() => {
    if (!onView || !cardRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onView(item);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [onView, item]);

  // ── Promo with a photo or video: image fills, scrim carries the text ──────
  if (hasMedia) {
    return (
      <div
        ref={cardRef}
        className={`relative w-full ${CARD_HEIGHT} overflow-hidden rounded-mc-lg
                    border border-mc-border bg-mc-cardface
                    shadow-[var(--mc-shadow-card)]`}
      >
        {item.mediaType === 'video' ? (
          <video
            src={item.mediaUrl}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay={!prefersReducedMotion}
            // Without autoplay the element would paint nothing at all; metadata
            // is enough to show a first frame.
            preload="metadata"
            muted
            loop
            playsInline
            // Decorative: the headline below carries the meaning.
            aria-hidden="true"
          />
        ) : (
          <img
            src={item.mediaUrl}
            // Empty on purpose. The title and subtitle sit in the DOM as text,
            // so describing the backdrop again would just repeat them.
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* Softens the photo into the caption plate below. Decorative only —
            the plate, not this, is what guarantees the text is readable. */}
        <div
          className="absolute inset-x-0 bottom-0 h-2/3
                     bg-[linear-gradient(180deg,rgba(8,8,10,0)_0%,rgba(8,8,10,0.45)_72%,rgba(8,8,10,0.86)_100%)]"
          aria-hidden="true"
        />

        {/* A plate rather than a gradient under the text.
            `media_url` is staff-uploaded and nothing constrains its brightness,
            so a gradient's contrast depends on the photo: a white product shot
            left the headline at 2.13:1. It also depends on where the text sits,
            which moves as soon as a title wraps to a second line. 0.86 over the
            worst case (pure white) is 14.2:1 for the title and 9.6:1 for the
            subtitle, whatever the image and however many lines. */}
        <div className="absolute inset-x-0 bottom-0 bg-[rgba(8,8,10,0.86)] px-3 pt-2 pb-6">
          {title && (
            <h3
              className="line-clamp-2 text-[14px] font-extrabold leading-tight"
              // Staff pick this alongside the artwork; the picker was inert
              // before, so every promo rendered white whatever they chose.
              style={{ color: item.textColor || '#ffffff' }}
            >
              {title}
            </h3>
          )}
          {sub && (
            <p
              className="mt-0.5 line-clamp-1 text-[11px] font-medium opacity-80"
              style={{ color: item.textColor || '#ffffff' }}
            >
              {sub}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Promo with an admin-picked gradient: their colour, our geometry ───────
  if (hasAdminGradient) {
    return (
      <div
        ref={cardRef}
        className={`relative flex w-full ${CARD_HEIGHT} flex-col justify-end overflow-hidden
                    rounded-mc-lg border border-mc-border p-3 pb-6
                    shadow-[var(--mc-shadow-card)]`}
        style={{ background: item.gradientStyle }}
      >
        {title && (
          <h3
            className="truncate text-[14px] font-extrabold leading-tight"
            // Staff choose the text colour alongside the gradient; falling back
            // to white keeps a legacy row without one readable.
            style={{ color: item.textColor || '#ffffff' }}
          >
            {title}
          </h3>
        )}
        {sub && (
          <p
            className="mt-0.5 line-clamp-1 text-[11px] font-medium opacity-75"
            style={{ color: item.textColor || '#ffffff' }}
          >
            {sub}
          </p>
        )}
      </div>
    );
  }

  // ── Everything else: a surface card, same family as the office tile ───────
  const isWarn = item.tone === 'warn';

  return (
    <div
      ref={cardRef}
      className={`relative flex w-full ${CARD_HEIGHT} items-center gap-3 overflow-hidden
                  rounded-mc-lg border border-mc-border bg-mc-surface p-3
                  shadow-[var(--mc-shadow-card)]`}
    >
      {/* Oversized watermark of the same glyph, barely there. It inherits the
          tone through `currentColor`, which is why the icons in
          `constants.tsx` no longer carry a colour class of their own. */}
      {item.bgIcon && (
        <div
          className={`pointer-events-none absolute inset-0 opacity-[0.055]
                      ${isWarn ? 'text-mc-warn' : 'text-mc-brand'}`}
          aria-hidden="true"
        >
          {item.bgIcon}
        </div>
      )}

      {item.mainIcon && (
        // Frosted rather than flat: a tinted gradient for depth, a light inner
        // highlight along the top edge, and a blur so the watermark behind it
        // shows through softly instead of being masked out.
        <span
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center
                      rounded-mc-md border backdrop-blur-md
                      shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_2px_6px_rgba(16,16,20,0.06)]
                      ${
                        isWarn
                          ? 'border-mc-warn/25 bg-gradient-to-br from-mc-warn/22 to-mc-warn/8 text-mc-warn'
                          : 'border-mc-brand/25 bg-gradient-to-br from-mc-brand/22 to-mc-brand/8 text-mc-brand'
                      }`}
          aria-hidden="true"
        >
          {item.mainIcon}
        </span>
      )}

      <span className="relative min-w-0 flex-1">
        {title && (
          <span className="block text-[14px] font-extrabold leading-tight text-mc-text">
            {title}
          </span>
        )}
        {sub && (
          <span className="mt-1 line-clamp-2 block text-[11px] font-medium leading-snug text-mc-text-2">
            {sub}
          </span>
        )}
      </span>

      <ChevronRight className="relative h-4 w-4 shrink-0 text-mc-text-3" aria-hidden="true" />
    </div>
  );
});

HomeCarouselCard.displayName = 'HomeCarouselCard';
