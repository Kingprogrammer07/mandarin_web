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

## Bosqich 3: yetkazish to'lovi (foydalanuvchi 2026-10-22 17:30Z)
Kuryer «Yetib keldim»ni bosganda mijozga to'lov usuli so'raladi (sozlamada yoqilgan bo'lsa);
mijoz naqd/karta tanlaydi yoki Mini App'da NBU orqali onlayn to'laydi. Kuryer «Yetkazdim»da
naqd yoki karta deb tasdiqlaydi. Usullar va narx faqat superadmin panelida sozlanadi.

- [x] `courierService`: yangi maydonlar (mashina, telefon, `arrived_at`, `fee_uzs`, tanlov, to'lov,
      `can_pay_online`, `online_pending`), `payCourierOnline`, `getCourierFee`, `courierSettingsService`
- [x] `CourierTrackView`: «Kuryer sizni kutyapti», mashina qatori, qo'ng'iroq tugmasi (44 px),
      to'lov kartasi (to'landi / tekshirilmoqda / onlayn to'lash / kuryerga to'lang / keyin);
      onlayn to'lash `openNbuUrl` bilan, qaytish `/user/home?courier=<id>`; eshik oldida 8 s so'rov
- [x] Zayavka formasi: «Yetkazib berish narxi» endi `GET /api/v1/user/courier/settings` dan (0 = bepul)
- [x] Admin: Tizim sozlamalari → Yetkazish → «Kuryer xizmati» (narx, naqd, karta, onlayn NBU,
      mijozdan so'rash); backend qoidalari formada ham (kamida bitta usul, onlayn uchun ≥ 1000 so'm)
- [x] Test: `CourierTrackView.test.tsx`; 320 px yorug'/qorong'i skrinshot bilan tekshirildi

## Tekshirilmagan
- OSM plitkalari va qorong'i rejim filtri haqiqiy qurilmada (sandbox `tile.openstreetmap.org` ga chiqa olmaydi).
- Haqiqiy NBU sahifasi orqali to'lov (sandbox NBU'ga chiqa olmaydi); backend testlari soxta NBU bilan.

---

# TASK (shu kuni, boshqa ish): Hamkor webhook — bitta yuborishni takrorlash va qayta yuborish

## Objective
Foydalanuvchi (2026-10-22, "Boshqa kargolar uchun import API"): Integratsiyalar → Tarix
ro'yxatida har bir yuborishga tugma kerak. Navbatdagi yoki xato yuborishni keyingi
urinishni kutmasdan hozir yuborish («Takrorlash»), yetkazilganini esa yana yuborish
(«Yana yuborish»). Qo'llanma oynasida Telegraph havolasi ham ko'rinsin.

## Implementation Plan
- [x] Backend (bot): `POST /api/v1/admin/partner-webhooks/{id}/deliveries/{pk}/retry` —
      navbatdagi/xato yuborishni hozir, o'sha `delivery_id` bilan yuboradi
- [x] Backend: `.../deliveries/{pk}/resend` — yetkazilgan yuborishni yangi `delivery_id` bilan
      yangi yuborish qilib yuboradi; ikkalasi audit logga yoziladi, to'xtatilgan hamkorga 409
- [x] Backend testlari (`tests/test_partner_webhooks.py`)
- [x] `partnerWebhookService.retryDelivery` / `resendDelivery`
- [x] Tarix qatorida tugmalar va natija qatori; 320 px da reys nomi kesilmasdan o'raladi, URL ham
- [x] Qo'llanma oynasida Telegraph havolasi (ochish + nusxalash); qo'llanmada «Yana yuborish» eslatmasi
- [x] Testlar, 320 px tekshiruvi, commit + push main (bot va web)

## Walkthrough / Architecture
Tugma bosilganda backend yuborishni so'rov ichida darhol yuboradi (Test tugmasi kabi) va
natija bilan yuborishning yangi holatini qaytaradi. Takrorlash fon yuboruvchisi bilan bir xil
"lease" oladi va muddatni yana 24 soatga uzaytiradi; xato bo'lsa yuborish navbatda qoladi va
odatiy oraliqda qayta uriniladi. Yana yuborish asl yuborishning nusxasini yangi
`delivery_id` bilan yaratadi, chunki hamkor ko'rgan `delivery_id` ni tashlab yuboradi;
hamkor qatorlarni `(flight_name, client_code, track_code)` bo'yicha upsert qilgani uchun
takror yozuv bo'lmaydi. Panel javobdan keyin tarix va hisoblagichlarni yangilaydi.
