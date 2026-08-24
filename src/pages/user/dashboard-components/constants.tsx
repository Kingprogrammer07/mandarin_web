import { ShieldAlert, ShieldOff, Rocket, Plane } from 'lucide-react';
import type { CarouselItemData } from './types';

export const CAROUSEL_ITEMS: CarouselItemData[] = [
  {
    id: 1,
    type: 'feature',
    titleKey: 'dashboard.carousel.prohibited.title',
    subKey: 'dashboard.carousel.prohibited.sub',
    tone: 'warn',
    bgIcon: <ShieldAlert className="absolute -right-5 -top-5" style={{ width: 96, height: 96 }} />,
    mainIcon: <ShieldOff style={{ width: 20, height: 20 }} />,
  },
  // Temporarily hidden: "ID olish" feature.
  // {
  //   id: 2,
  //   type: 'feature',
  //   titleKey: 'dashboard.carousel.id.title',
  //   subKey: 'dashboard.carousel.id.sub',
  //   gradient: 'from-blue-900 to-blue-600',
  //   bgIcon: <IdCard className="text-white/10 absolute -right-4 -top-4" style={{ width: 96, height: 96 }} />,
  //   mainIcon: <IdCard className="text-white/90" style={{ width: 32, height: 32 }} />,
  // },
  {
    id: 3,
    type: 'feature',
    titleKey: 'dashboard.carousel.delivery.title',
    subKey: 'dashboard.carousel.delivery.sub',
    tone: 'brand',
    bgIcon: <Rocket className="absolute -right-5 -top-5" style={{ width: 96, height: 96 }} />,
    mainIcon: <Plane style={{ width: 20, height: 20 }} />,
  },
];
