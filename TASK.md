# TASK: NBU zayavka to'lovidagi pul kamchiliklarini tuzatish

Oldingi vazifa (to'lov oynasi dizayni, Uzpost zayavkada «Kartaga o'tkazma» va Payme) GitHub'da:
bot 1c9ca6b, web 2692a84 + ba059d7. Serverga chiqmagan: backend va frontend birga, migratsiya
e2a4c6e8f0b1.

## Objective
Foydalanuvchi 30.10 20:03Z: «xa nbu kamchiliklari ham fix qilinsin». Rejadagi uchta kamchilik
(hujjat «Eski zayavka to'lovlarida topilgan kamchiliklar»):

1. **Qoldiq 1 000 so'mdan kam.** NBU o'z minimumini (1 000) yechadi, ortig'i hamyonga qaytmaydi va
   POS'da yetkazish to'lovi sifatida yoziladi.
2. **Hamyon yechilmaydi.** NBU zayavkasida hamyon qismi zayavkadagi asosiy kod bo'yicha birinchi
   reys yozuvidan ayiriladi. Yozuv qo'shimcha kodda tursa topilmaydi va hamyon yechilmaydi.
   Ish davomida aniqlandi: yozuv topilsa ham hamyon kamaymaydi, agar pul boshqa reysda tursa —
   hamyon reysma-reys hisoblanadi (`get_wallet_balances`), shuning uchun ayirma o'sha reysda
   «qarz» bo'lib chiqadi, hamyon o'zgarmaydi (Postgres'da tekshirildi).
3. **Tasdiqlangan zayavkali reyslar.** NBU bir soatdan keyin shu reyslarga yana zayavka to'lashga
   ruxsat beradi. Kartaga o'tkazma va Payme (be52744) buni rad etadi.

Pul qoidasi: foydalanuvchi «ha» demaguncha GitHub'ga yuborilmaydi.

## Implementation Plan
- [x] 1. Server qoldiq NBU minimumidan kam bo'lgan zayavka to'lovini qabul qilmaydi (422,
      `below_minimum`, «hamyonni o'chirib to'lang»). Zayavka uchun 1 000 gacha to'ldirish olib
      tashlanadi: NBU'dan aynan qoldiq so'raladi. Mini App bu holatni allaqachon to'sadi.
- [x] 2. NBU zayavka tasdiqlanganda hamyon qismi `WALLET_ADJ:uzpost_wallet` (manfiy) yozuvi bilan
      yechiladi: mijozning qaysi kodida va qaysi reysda pul tursa ham hamyon aniq shuncha
      kamayadi, reysda soxta qarz paydo bo'lmaydi, keyingi qayta hisob uni bekor qilmaydi.
      Zayavka yozuviga `wallet_used` ham yoziladi.
- [x] 3a. NBU (havola va saqlangan karta) shu reyslarga kutilayotgan yoki tasdiqlangan zayavka
      bo'lsa rad etadi (409 `request_pending` / `request_approved`), kartaga o'tkazma va Payme
      bilan bitta tekshiruv (`card_intents.delivery_conflict`).
- [x] 3b. NBU puli kelganda zayavkani tasdiqlab bo'lmasa (mijoz bekor qilgan, kassir rad etgan
      yoki shu reyslarga boshqa zayavka bor), pul yo'qolmaydi: yechilgan summa hamyonga
      (`WALLET_ADJ:nbu_unbooked`), zayavka bekor qilinadi, kutilayotgan POS kartasi yashiriladi,
      mijozga xabar boradi. Hozir bu holatda pul hech qayerga yozilmaydi.
- [x] Kassa jurnalida bunday NBU to'lovi hamyon qismisiz ko'rinadi (hamyon ishlatilmagan).
- [x] Testlar (Postgres): har bir holat; eski manba testlari (test_nbu_minimum_topup) yangi
      qoidaga moslanadi; to'liq to'plam, ruff
- [x] Bir martalik puxta tekshiruv (to'liq to'plam 2308 o'tdi, ruff toza)
- [x] Foydalanuvchiga ko'rsatildi; 30.10 21:22Z «Ha, yubor» → bot 0359e8b (Click SHOP API 030e3b2 ustiga). Serverga chiqmagan, migratsiya yo'q, frontend o'zgarmagan.

Tegilmaydi (alohida ish sifatida aytiladi): kassir va bot tasdiqlaydigan zayavkalar, reys
to'lovlarida hamyondan foydalanish — ular ham hamyonni reys yozuvidan ayiradi (2-banddagi muammo).

## Walkthrough / Architecture
`payments_nbu._prepare_uzpost_delivery_fee` narx va tekshiruvlarni beradi (kartaga o'tkazma va
Payme ham uni hamyonsiz chaqiradi, shuning uchun NBU'ga xos rad etishlar NBU endpointlarida:
`init_nbu_delivery_payment`, `charge_nbu_delivery_payment`). Ular zayavka (`pending`) va
`NbuPayment` (summa = aynan qoldiq, `wallet_used`) yaratadi.

NBU SUCCESS (callback, sinxron karta, reconciler) → `nbu_payment.apply_nbu_delivery_payment_success`:
to'lov qatori qulflanadi (`applied_at` — bir martalik), zayavka qulflanadi. Zayavka `approved`
bo'lsa (kassir tasdiqlagan) hech narsa qilinmaydi. Zayavka boshqa holatda yoki shu reyslarga
boshqa kutilayotgan/tasdiqlangan zayavka bo'lsa → «tasdiqlanmadi» yo'li (3b). Aks holda:
tasdiqlash, hamyon `WALLET_ADJ` bilan, navbat, chek, POS, kanal, mijoz (avvalgidek).

Hamyon balansi = reyslar bo'yicha musbat qoldiqlar + `WALLET_ADJ` hovuzi. Manfiy `WALLET_ADJ`
hovuzni kamaytiradi, reys qatorlariga tegmaydi va foydalanuvchi ro'yxatlarida, statistikada
ko'rinmaydi (`apply_public_transaction_filter`). Kartaga o'tkazma ham ortiqchasini shu yo'l bilan
yozadi (`card_overpay`).
