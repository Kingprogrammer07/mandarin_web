# TASK: Hamkor webhook — bitta yuborishni takrorlash va qayta yuborish

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
