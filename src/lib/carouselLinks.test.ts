import { describe, expect, it } from 'vitest';
import { carouselSlides, carouselTapAction, isSafeCarouselLink } from './carouselLinks';
import type { CarouselItemData } from '@/pages/user/dashboard-components/types';

const base: CarouselItemData = { id: 5, type: 'ad', fromApi: true };

describe('carouselTapAction', () => {
  it('opens a video promo full screen even when it has a link', () => {
    expect(carouselTapAction({ ...base, mediaType: 'video', mediaUrl: 'https://s3/v.mp4', actionUrl: 'https://x.uz' })).toBe('media');
  });
  it('opens a video promo with no link (it did nothing before)', () => {
    expect(carouselTapAction({ ...base, mediaType: 'video', mediaUrl: 'https://s3/v.mp4' })).toBe('media');
  });
  it('follows the link of an image advert', () => {
    expect(carouselTapAction({ ...base, mediaType: 'image', mediaUrl: 'https://s3/a.webp', actionUrl: 'https://x.uz' })).toBe('link');
  });
  it('shows an image advert without a link full size', () => {
    expect(carouselTapAction({ ...base, mediaType: 'image', mediaUrl: 'https://s3/a.webp' })).toBe('media');
  });
  it('opens a one-slide gallery', () => {
    expect(carouselTapAction({
      ...base,
      mediaItems: [{ id: 1, media_type: 'image', media_url: 'u', media_s3_key: null, order: 0 }],
    })).toBe('media');
  });
  it('ignores a javascript: link', () => {
    expect(carouselTapAction({ ...base, actionUrl: 'javascript:alert(1)' })).toBe('none');
  });
});

describe('carouselSlides', () => {
  it('falls back to the promo media as one slide', () => {
    const slides = carouselSlides({ ...base, mediaType: 'video', mediaUrl: 'https://s3/v.mp4' });
    expect(slides).toHaveLength(1);
    expect(slides[0]).toMatchObject({ media_type: 'video', media_url: 'https://s3/v.mp4' });
  });
  it('sorts the gallery by order', () => {
    const slides = carouselSlides({
      ...base,
      mediaItems: [
        { id: 2, media_type: 'image', media_url: 'b', media_s3_key: null, order: 1 },
        { id: 1, media_type: 'image', media_url: 'a', media_s3_key: null, order: 0 },
      ],
    });
    expect(slides.map((s) => s.media_url)).toEqual(['a', 'b']);
  });
});

describe('isSafeCarouselLink', () => {
  it.each([
    ['https://mandarin.uz', true],
    ['tg://resolve?domain=x', true],
    ['javascript:alert(1)', false],
    ['data:text/html,x', false],
    ['', false],
  ])('%s → %s', (url, ok) => {
    expect(isSafeCarouselLink(url)).toBe(ok);
  });
});
