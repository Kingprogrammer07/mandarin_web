import type { ReactNode } from 'react';
import type { CarouselMediaItemResponse } from '@/api/services/carousel';

export interface CarouselItemData {
  id: number;
  type: 'feature' | 'ad';
  titleKey?: string;
  subKey?: string;
  title?: string;
  sub?: string;
  /** Tailwind gradient classes — used for static (hardcoded) items */
  gradient?: string;
  /** CSS gradient value — used for items fetched from the API */
  gradientStyle?: string;
  bgIcon?: ReactNode;
  mainIcon?: ReactNode;
  mediaType?: 'image' | 'video' | 'gif';
  mediaUrl?: string;
  actionUrl?: string;
  textColor?: string;
  /** True when this item came from the API and should be tracked */
  fromApi?: boolean;
  /** Gallery slides — drives the media detail modal when length > 1 */
  mediaItems?: CarouselMediaItemResponse[];
}

export interface MainActionItem {
  id: string;
  icon: ReactNode;
  bgIcon: ReactNode;
  labelKey: string;
  descKey: string;
  badgeKey: string;
  actionLabelKey: string;
  theme: 'amber' | 'emerald' | 'sky' | 'rose' | 'violet' | 'cyan';
}
