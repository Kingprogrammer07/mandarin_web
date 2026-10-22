# TASK: Mijoz ilovasida astatkadagi yuk uchun "Ostatkada" belgisi

## Objective
Foydalanuvchi (2026-10-22) astatkadagi yukning asl reys qarzini mijozdan yashirishni taklif qildi. Muhokamadan keyin "Belgi qo'yish" tanlandi: qarz asl reysda qoladi (mijoz uni ko'radi va to'laydi), yonida "Ostatkada: OSTATKA-…" yoziladi.

Sabab: 16.10 dan beri astatka yuborilganda qarz yozilmaydi, qarz faqat asl reysda turadi. Yashirsak mijoz qarzni ko'rmaydi va ilovadan to'lay olmaydi; qarz reys bo'yicha bitta qator bo'lgani uchun reysdagi boshqa yuklar qarzi ham yashirinib qolardi.

## Implementation Plan
- [x] Backend: `astatka_warehouse.client_astatka_shelves(codes, flights)` — mijozning qaysi reysdagi yuki qaysi astatkada (faqat bizning tasdiqlangan yuklar, aliaslar bilan)
- [x] Backend: `GET /payments/available-flights` (to'lov uchun reys tanlash) har bir reysga `astatka_flight_name`
- [x] Backend: `GET /shipments` ("Yuklarim" kartalari) har bir reysga `astatka_flight_name`; olib ketilgan yukda yo'q
- [x] Frontend: `AstatkaShelfNote` — "📦 Ostatkada: OSTATKA-…" qatori (uz/ru), to'lov ro'yxatida va `ShipmentCard` da; nom kesilmaydi, butunligicha keyingi qatorga o'tadi
- [x] Yo'lda: to'lov ro'yxatida 320px da katta summa reys nomini "M286-M..." qilib kesardi; endi summa kerak bo'lsa pastki qatorga tushadi
- [x] /pos va /kassa (2026-10-22, foydalanuvchi so'radi): `GET /verification/{kod}/cargo/unpaid` har bir yukka `astatka_flight_name`; /pos ning ikkala reys ro'yxatida reys nomi ostida "Ostatkada: …" (nom endi kesilmaydi), /kassa da reys tanlovida "· Ostatkada" va tanlangan reys uchun "M286-M287 yuki ostatkada: OSTATKA-…" qatori
- [x] Testlar: backend Postgres (ikkala endpoint, boshqa mijozga chiqmasligi), `ShipmentCard` komponent testi; 320/360/390 light/dark skrinshot, overflow 0
- [x] Commit + push main (backend, frontend)

## Walkthrough / Architecture
Astatka yuki `astatka_packages` da (status confirmed, source_company = own) asl reys nomi bilan turadi. `client_astatka_shelves` mijozning barcha kodlari va sahifadagi reys nomlari bo'yicha bitta so'rov qiladi va `{reys: astatka}` qaytaradi. Endpointlar bu nomni javobga qo'shadi; eski frontend yangi maydonni e'tiborsiz qoldiradi, yangi frontend eski backendda maydon bo'lmasa hech narsa ko'rsatmaydi, shuning uchun deploy tartibi muhim emas.

Oldingi vazifa (warehouse astatka qidiruvi, checkboxlar, strict switch): web 771244e, 1210b1c; bot 381f519.
