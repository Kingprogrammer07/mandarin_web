# TASK: Admin «Kuryerlar» — jonli xarita, kunlik yo'l va kilometrlar

## Objective
Foydalanuvchi (2026-10-24): superadmin kuryer qayerdaligini xohlagan vaqtda ko'rsin; telefon qayerga
borgani, qayerda turgani va kunlik km aniq ko'rinsin (mashina xarajatlari uchun). Backend tayyor
(bot 5db0ae7: `/api/v1/admin/couriers/live|{id}/track|mileage`, `courier:monitor` huquqi, superadmin
sukut bo'yicha). Panelda shu ma'lumotni ko'rsatadigan sahifa kerak.

## Implementation Plan
- [x] API servisi `src/api/services/courierMonitor.ts` (turlar backend sxemasi bilan bir xil)
- [x] Sof yordamchilar `src/lib/courierMonitor.ts`: km, vaqt, smena oralig'i, oy oralig'i, kun voqealari, CSV
- [x] `CourierMonitorMap`: OSM + Leaflet; yo'l chizig'i, uzilishlar (punktir), to'xtashlar, manzillar,
      ofis, kuryerlarning hozirgi joyi; kun/kuryer almashganda ramkaga oladi (ranglar CSS sinfi orqali,
      sinf Leaflet'ga yaratilishda beriladi: `pathOptions.className` keyin qo'llanmaydi)
- [x] «Xarita» bo'limi: kuryerlar ro'yxati (15 s da yangilanadi), sana tanlash, kun tafsiloti
      (smena, km, yetkazilgan, to'xtashlar va uzilishlar vaqt bo'yicha, bosilsa xaritada ko'rsatadi)
- [x] «Kilometrlar» bo'limi: oy bo'yicha har kun km, 1 km narxi (shu brauzerda saqlanadi), CSV
- [x] Yo'nalish: `/admin/couriers`, admin/super-admin, menyuda «Kuryerlar»; huquq yo'q bo'lsa tushuntirish
- [x] Testlar (yordamchilar va sahifa), tsc, eslint, vitest
- [x] 320/390/1024/1440 px va tungi rejimda ko'rib chiqish (Playwright, soxta API), commit + push main

## Walkthrough / Architecture
Sahifa AdminLayout ichida. Huquq JWT dan o'qiladi (`isSuperAdmin` yoki `courier:monitor`), so'rov
yuborib 403 kutilmaydi. «Xarita»: `live` har 15 s da (ochiq oynada), tanlangan kuryerning `track`i
bugun va kuryer ishda bo'lsa har 30 s da qayta o'qiladi. Xarita ramkasi faqat kuryer yoki sana
almashganda o'rnatiladi, yangilanishlar admin surib qo'ygan xaritani qaytarmaydi. Kilometrlar
backend hisoblaganidek ko'rsatiladi (GPS sakrashlari va turgan joydagi tebranish chiqarilgan,
uzilishlar to'g'ri chiziq). 1 km narxi faqat shu brauzerdagi qulaylik (localStorage), summa
`km × narx` sifatida hisoblanadi.
Ikki ustunli joylashuv `xl` dan (1024 px da sidebar bilan xarita juda tor bo'lardi). So'm summalari bo'sh
joy bilan guruhlanadi (`formatSom`): Chrome'da `formatUzs` vergul qo'yadi va «84,2 km» yonida «1,017»
o'nlik kasr bo'lib o'qilardi.
