import type { CarouselMediaItemResponse } from '@/api/services/carousel';
import type { CarouselItemData } from '@/pages/user/dashboard-components/types';

/** Only these may be opened from a promo. The backend refuses anything else
 *  since 2026-10-30; this guards rows saved before that. */
const SAFE_LINK = /^(https?:\/\/|tg:\/\/)/i;

export function isSafeCarouselLink(url: string | null | undefined): url is string {
  return Boolean(url && SAFE_LINK.test(url.trim()));
}

/**
 * Open a promo link the way Telegram expects. `window.open` inside the Mini
 * App either does nothing or loads the page inside the WebView with no way
 * back; `openTelegramLink` keeps t.me links in the app and `openLink` sends
 * the rest to the system browser.
 */
export function openCarouselLink(url: string | null | undefined): void {
  if (!isSafeCarouselLink(url)) return;
  const href = url.trim();
  const tg = window.Telegram?.WebApp;
  if (tg && /^https?:\/\/t\.me\//i.test(href) && tg.openTelegramLink) {
    tg.openTelegramLink(href);
  } else if (tg?.openLink && /^https?:\/\//i.test(href)) {
    tg.openLink(href, { try_instant_view: false });
  } else {
    window.open(href, '_blank', 'noopener,noreferrer');
  }
}

/**
 * The slides a promo opens to: its gallery when it has one, otherwise its own
 * media as a single slide, so tapping a video promo plays it full screen.
 */
export function carouselSlides(item: CarouselItemData): CarouselMediaItemResponse[] {
  const gallery = item.mediaItems ?? [];
  if (gallery.length > 0) return [...gallery].sort((a, b) => a.order - b.order);
  if (!item.mediaUrl) return [];
  return [{
    id: -item.id,
    media_type: item.mediaType ?? 'image',
    media_url: item.mediaUrl,
    media_s3_key: null,
    order: 0,
  }];
}

/** What a tap on an API promo does. */
export function carouselTapAction(item: CarouselItemData): 'media' | 'link' | 'none' {
  const hasGallery = (item.mediaItems?.length ?? 0) > 0;
  // A video is the content itself, so it plays first; a link, if any, sits
  // under it as a button. A banner image with a link is an advert: the link
  // is the point.
  if (hasGallery || (item.mediaUrl && item.mediaType === 'video')) return 'media';
  if (isSafeCarouselLink(item.actionUrl)) return 'link';
  if (item.mediaUrl) return 'media';
  return 'none';
}
