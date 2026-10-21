# TASK: Astatkani butunlay o'chirish tugmasi

## Objective
Foydalanuvchi (2026-10-21): ochilgan astatkani butunlay o'chiradigan tugma kerak, `/astatka` oynasidagi astatka kartasida.

Hozir bo'sh astatkani "Kutilayotgan yuklar" sahifasidan o'chirish mumkin, lekin saqlangan yuki bor astatkani o'chirib bo'lmaydi: tasdiqlangan yukni avval bekor qilish kerak, mijozga yuborilganini esa bekor qilib bo'lmaydi.

## Implementation Plan
- [x] Backend: `DELETE /api/v1/astatka-flights/{name}?confirm=<name>` (`flights:delete` huquqi; super-admin har doim)
  - [x] `confirm` astatka nomiga teng bo'lmasa 400 (eskirgan yoki adashgan so'rov o'chirib yubormasin)
  - [x] Eski usulda ko'chirilgan yozuvlar bor bo'lsa 409: astatka nomidagi foto hisobot qatorlari, to'lovlar, trek kodlar, hali qaytarilmagan eski yuklar. Ular boshqa reyslarning ma'lumoti — o'chirilmaydi
  - [x] Bitta tranzaksiyada: astatka yuklari (`astatka_packages`), astatkaning bo'sh (placeholder) qatori, reyslar taxtasidagi sozlamasi
  - [x] Audit log `DELETED_ASTATKA`: kim, qachon, nechta yuk, har bir yukning qisqa nusxasi (qo'lda tiklash uchun)
  - [x] Commitdan keyin fon vazifada S3 rasmlari (astatkada qayta olingan va AKB nusxalari) o'chiriladi
- [x] Backend testlari (Postgres): to'liq o'chirish, boshqa reyslarga tegilmagani, nom tasdig'i, eski yozuvlar bilan 409
- [x] Frontend: kartada "O'chirish" tugmasi (faqat `flights:delete` yoki super-admin), nom yozib tasdiqlanadigan oyna
- [x] Frontend: audit sahifasida "Astatkani o'chirdi" yorlig'i
- [x] Testlar (pytest + vitest), lint, build
- [x] Commit + push main (backend, frontend)

## Walkthrough / Architecture
Astatka — nomi «O» bilan boshlanadigan reys. U ro'yxatda uch manbadan ko'rinadi: kutilayotgan yuklardagi placeholder qatori, tasdiqlangan `astatka_packages` va (eski usulda) astatka nomiga ko'chirilgan `flight_cargos`. 2026-10-16 dan beri tasdiqlash faqat `astatka_packages`ga yozadi, shuning uchun astatkaning o'z ma'lumoti = shu jadval + placeholder + taxta sozlamasi. O'chirish faqat shularni o'chiradi.

Eski usulda tasdiqlangan va hali `astatka_unmove` bilan qaytarilmagan yuklarning foto hisobot qatorlari, trek kodlari va to'lovlari astatka nomida turadi. Ular aslida eski reyslarniki, shuning uchun bunday astatka o'chirilmaydi (409) — avval qaytarish kerak.

Mijozga yuborilgan yuklar ham o'chadi: mijoz xabarni olgan, to'lov eski reysda qoladi (astatka qarz yozmaydi). Oyna buni oldindan aytadi va astatka nomini yozib tasdiqlashni so'raydi.
