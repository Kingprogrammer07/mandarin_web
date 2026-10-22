# TASK: Kuryer yetkazish — mijoz tomoni (Mini App)

## Objective
Foydalanuvchi (2026-10-22, "Kuryer yetkazish xizmati"): Mandarin kuryeri bilan yetkazishda
mijoz (1) zayavkada xaritada nuqtani albatta belgilaydi (faqat Toshkent shahri ichida),
(2) kuryer unga yo'lga chiqqanda botdagi «Xaritada kuzatish» tugmasi orqali kuryerni
xaritada jonli ko'radi. Baho jihatlari (Nima yoqdi / Nima yoqmadi) botning o'zida
so'raladi (backend), Mini App'da baholash sahifasi yo'q.

## Implementation Plan
- [x] Backend (bot): `mandarin` zayavkada nuqta majburiy va Toshkent ichida (422), tahrirda ham;
      «Kuryer yo'lga chiqdi» xabarida WebApp tugmasi `/user/home?courier=<public_id>`;
      yulduzdan keyin jihat tugmalari, guruh xabari tahrirlanadi
- [x] Zayavka formasi: `mandarin` uchun nuqta majburiy, shahar tashqarisida xato, nega yuborilmasligi yoziladi
- [x] `courierService`: `GET /api/v1/user/courier/deliveries/{public_id}` turlari bilan
- [x] Kuzatish sahifasi (`CourierTrackView`): xarita (Leaflet + OSM, mavjud stek), uy va kuryer belgilari,
      ETA, bosqichlar, holatlar (kutilmoqda / yo'lda / yetkazildi / ko'chirildi / bekor / topilmadi)
- [x] SSE: `courier.location` keshni yangilaydi, `courier.stop` qayta so'raydi; SSE uzilsa 30 s so'rov
- [x] `UserHome`: `?courier=` bo'lsa kuzatish ochiladi, yopilganda parametr olib tashlanadi
- [x] i18n uz/ru, 320/360/390 px, yorug' va qorong'i, testlar (`courierArea.test.ts`, `courierService.test.ts`)
- [x] Commit + push main (bot va web)

## Walkthrough / Architecture
Bot xabaridagi WebApp tugmasi Mini App'ni `/user/home?courier=<id>` bilan ochadi. `App.tsx`
yo'lni `user-home` ga yechadi va query'ni saqlaydi; `UserHome` boshida `courier` parametrini
o'qib `CourierTrackView` ni to'liq ekran ko'rinishida ochadi. Sahifa
`['courier-delivery', id]` so'rovini ishlatadi. Ilova bo'ylab yagona SSE ulanishi
(`useGlobalEvents`) `courier.location` kelganda shu so'rov keshidagi `courier` ni
o'zgartiradi (tarmoqqa so'rovsiz), `courier.stop` kelganda qayta yuklaydi. Kuryer
joylashuvi faqat u aynan shu mijozga yo'lda bo'lganda keladi (backend shuni ta'minlaydi);
yetkazilgach xarita ko'rsatilmaydi.

Xarita mavjud zayavka formasi bilan bir xil: Leaflet + OpenStreetMap plitkalari (yangi
kutubxona qo'shilmadi). Qorong'i rejimda plitkalarga CSS filtr.

## Tekshirilmagan
- OSM plitkalari va qorong'i rejim filtri haqiqiy qurilmada (sandbox `tile.openstreetmap.org` ga chiqa olmaydi).
- Qo'ng'iroq tugmasi va to'lov qatori yo'q: raqam va pul savollari ochiq.
