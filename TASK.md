# TASK: Foto hisobotlar hamkorga — webhook, pull API va 6 oylik rasm havolalari

## Objective
Foydalanuvchi (2026-10-24, "Boshqa kargolar uchun import API"): hamkor kargo o'z prefiksidagi
mijozlarning foto hisobotlarini (`flight_cargos`) va mijozning trek kodlarini webhook orqali
olsin; rasm havolalari 6 oy amal qilsin. Tasdiqlangan: narx yuborilmaydi; ombor formasi hamkor
prefiksidagi kodni «Ro'yxatdan o'tmagan mijoz» belgisisiz qabul qiladi.

## Implementation Plan
- [x] Backend: 6 oylik imzolangan rasm havolasi `/api/v1/partner/cargo/photos/{report}/{index}`
      (hamkor ID + muddat + HMAC; S3 → qisqa presigned, Telegram → mavjud `/files` havolasi)
- [x] Backend: `photo_report.created/updated/deleted` webhooklari (outbox, o'sha tranzaksiyada):
      qo'shish, unutilgan yuk, tahrirlash (mijoz kodi boshqa hamkorga o'tsa ham), o'chirish, reysni tozalash
- [x] Backend: pull API — `POST /api/v1/partner/cargo/photo-reports`; `/flights` ga `photo_report_count`
- [x] Backend: `client-code-suggestions` hamkor prefiksidagi kodni "bor" deb javob beradi
- [x] Backend testlari: havola imzosi, voqealar, egasi almashishi, pull, rasm endpointi
- [x] Panel: Tarix qatorida foto hisobot voqeasi; Qo'llanmaga foto hisobot bo'limlari va Python misoli
- [x] 320/360/390 px tekshiruv (Tarix va Qo'llanma bo'limlari, overflow probe toza)
- [x] `/mnt/project-files/partner-api/` ga .md hujjat, Telegraph skripti
- [x] Commit + push main (bot va web)

## Walkthrough / Architecture
Foto hisobot yozilgan joyning o'zida (o'sha tranzaksiyada) `partner_webhook_deliveries` ga
voqea qo'shiladi, mavjud yuboruvchi uni imzolab yuboradi va qayta urinadi. Voqeada hisobotning
to'liq holati (`reports: [...]`) va `occurred_at` bor: hamkor eskisini e'tiborsiz qoldiradi,
o'chirishda qatorni belgilab qo'yadi. Rasm havolasini AWS S3 6 oy bera olmaydi (presigned
ko'pi bilan 7 kun), shuning uchun havola bizning serverga keladi: server imzo, muddat,
hamkor faolligi va hisobot hali shu hamkorniki ekanini tekshirib, rasmga qisqa muddatli
havola bilan yo'naltiradi. Hamkor to'xtatilsa, barcha havolalari yopiladi.
