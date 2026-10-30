# TASK: Kartaga o'tkazma, 3-qism — bot o'zi qabul qiladi

## Objective
CardXabar'da so'rovning aniq summasi 30 daqiqa ichida kelib, hujjatdagi 14 shartning hammasi
bajarilsa, bot pulni admin «✅ Tasdiqlash» bosgandagidek o'zi yozadi va guruhga
«🤖 Bot qabul qildi» xabarini «↩️ Bekor qilish» tugmasi bilan yuboradi. Tugma o'chiq
turganda bot hech narsa yozmaydi, faqat «yoqilganda nima qilardi» deb belgilaydi.
Reja: https://claude.ai/artifact/NHr6RXC2kjVYXnLEqxu2ew («3-qism rejasi»).

## Implementation Plan
Backend (bot repo):
- [x] Migratsiya: `card_transfer_settings` (bitta qator, o'chiq), `card_notices.auto_result`,
      `card_notices.booking_snapshot`
- [x] Bot qarori (shartlar 1–14), kuzatuv qatori «topildi» xabarida
- [x] O'zi yozish: savepoint, yozilgandan keyin tekshiruv, guruhga xabar commit'dan oldin
- [x] «↩️ Bekor qilish»: teskari yozuv, qator va POS kartasi oldingi holatga, so'rov yana
      «admin kutilmoqda», xabarda «✅ Tasdiqlash» qaytadi; rad holatlari (yuk olingan,
      kassa yozgan, hamyondagi ortiqcha ishlatilgan, bot yozmagan / bekor qilingan)
- [x] API `GET/PUT /api/v1/system/card-transfer` (super-admin) + 7 kunlik hisob
- [x] Serverda o'qish uchun hisobot: `scripts/card_transfer_report.sh`
- [x] Testlar: 9–13-holatlar, har bir shart, bekor qilish va uning rad holatlari
      (28 ta yangi test; butun backend: 2197 o'tdi)
- [x] Topilgan xato: bekor qilingandan keyin admin qayta tasdiqlay olmasdi —
      `card_intents.flight_debt` to'lovi qaytarilgan (sof nol) qatorni yana to'liq qarz deb oladi

Frontend (shu repo):
- [x] `cardTransferService`: GET/PUT `/api/v1/system/card-transfer`
- [x] `CardTransferAutoApproveSection`: tugma, o'quvchi holati, 7 kunlik hisob, sabablar
- [x] Sozlamalar → To'lovlar: Payme/Click bo'limi yonida
- [x] Testlar, lint, tsc, build (320/360/390px tekshirildi)
- [ ] Foydalanuvchi «ha» degach: ikkala repo main'ga push, lokal sinov (9–13-holatlar)

## Walkthrough / Architecture
Matcher (`card_matcher.place_and_post`) har kirimni joylaydi. «Topildi» (yoki kech) bo'lsa
`CardAutoApprover.judge` shartlarni tekshiradi va `card_notices.auto_result` ga yozadi:
`would` (tugma o'chiq, yozardi), sabab kodi yoki `booked`. Tugma yoqiq va hammasi to'g'ri
bo'lsa `book`: reys qatorini qulflab `book_online_payment` (adminniki bilan bir xil kod,
`approver_id=None`), keyin `_verify`, keyin guruhga xabar; xabar ketmasa savepoint bekor.
Commit'dan keyin `finish_online_payment` (mijoz, kanal, POS «🤖 Bot»). Bekor qilish
`booking_snapshot` bo'yicha hammasini qaytaradi. Admin panel faqat tugma va hisobni
ko'rsatadi; shartlar backendda.
