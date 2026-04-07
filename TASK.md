# TASK.md — Dashboard Carousel: API ulash + Anti-spam tracking

## Objective
1. User-facing Dashboard carouselini real backendga (`GET /api/v1/carousel/`) ulash.
2. Ko'rish/bosish trackingini (`POST /api/v1/carousel/{id}/view|click`) session-level anti-spam bilan qo'shish — bir foydalanuvchi qayta-qayta ko'rgan/bosganda statistika oshmasligi kerak.

## Implementation Plan

- [x] `src/api/services/carousel.ts` yaratish — typed API funksiyalar + sessionStorage anti-spam
- [x] `CarouselItemData` interfeysi yangilash — `gradientStyle` (CSS inline) va `fromApi` flag qo'shish
- [x] `CarouselCard` komponenti yangilash — IntersectionObserver (view tracking), CSS gradient support
- [x] `Dashboard`da `useQuery` ulash — API itemlarni olish, bo'sh/xato bo'lsa static fallback
- [x] Carousel click handler yangilash — API items uchun `action_url` ochish + click tracking

## Walkthrough

### Service layer (`src/api/services/carousel.ts`)
- `getActiveCarouselItems()` → `GET /api/v1/carousel/`
- `trackCarouselView(id)` — `sessionStorage.getItem('cv:{id}')` ni tekshiradi, yo'q bo'lsa POST yuboradi va keyni o'rnatadi. Foydalanuvchi qayta shu kartochkaga qaytsa +1 bo'lmaydi.
- `trackCarouselClick(id)` — xuddi shu mantiq `cc:{id}` bilan. Network xatosida key o'chiriladi — keyingi click retry qila oladi.

### Dashboard integratsiyasi
- `useQuery(['carousel-items'])` — 5 daqiqa staleTime bilan API itemlarni fetch qiladi.
- `sortedCarouselItems` — API qaytarsa `order`ga sort qiladi va `CarouselItemData`ga map qiladi (`fromApi: true`, `gradientStyle` CSS qiymati). API bo'sh/xato bo'lsa static `CAROUSEL_ITEMS` ko'rsatiladi.
- `CarouselCard` — `onView` callback qabul qiladi; IntersectionObserver karta ≥50% ko'ringanda bir marta `onView` ni chaqiradi.
- Click handler — API items uchun `actionUrl` ochadi + `trackCarouselClick` chaqiradi; static items uchun avvalgi modal xatti-harakat saqlanadi.
