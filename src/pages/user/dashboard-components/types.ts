import type { ReactNode } from 'react';
import type { CarouselMediaItemResponse } from '@/api/services/carousel';

export interface CarouselItemData {
  id: number;
  type: 'feature' | 'ad';
  titleKey?: string;
  subKey?: string;
  title?: string;
  sub?: string;
  /** CSS gradient value — used for items fetched from the API */
  gradientStyle?: string;
  bgIcon?: ReactNode;
  mainIcon?: ReactNode;
  mediaType?: 'image' | 'video' | 'gif';
  mediaUrl?: string;
  actionUrl?: string;
  textColor?: string;
  /**
   * Accent for the built-in feature cards on the redesigned home screen.
   * Both draw on a plain surface — only the icon chip carries the tone, so the
   * strip stays inside the two-accent budget the palette allows. Ignored by the
   * legacy dashboard card, which paints `gradient` instead.
   */
  tone?: 'brand' | 'warn';
  /** True when this item came from the API and should be tracked */
  fromApi?: boolean;
  /** Gallery slides — drives the media detail modal when length > 1 */
  mediaItems?: CarouselMediaItemResponse[];
}
