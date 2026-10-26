# TASK: Kuryerlarga «Skladda yangi zayavka» Telegram xabari — o'chirgich

## Objective
Foydalanuvchi (2026-10-26): Telegram'da «Skladda yangi zayavka» xabarlari kela boshladi;
kuryer moduli hali tayyor emas, xabar odamlarga bormasligi kerak. Xabar faqat «Kuryer»
roli bor akkauntlarga boradi (mijozlarga emas). Endi super-admin o'chirgichi, sukut
bo'yicha o'chiq; go-live'da Sozlamalar → Yetkazish'da yoqiladi.

## Implementation Plan
- [x] Backend: `courier_settings.order_alerts` (migratsiya c2e4a6b8d0f1, server_default false);
      o'chiq bo'lsa sikl manzillarni belgilaydi, lekin yubormaydi (yoqilganda eskilari ketmaydi)
- [x] Backend: PUT /api/v1/system/courier — eski panel maydonni yubormasa o'zgarmaydi
- [x] Web: «Kuryerlarga xabar» o'chirgichi, `order_alerts?` (eski serverda yo'q → o'chiq)
- [x] Testlar (backend kuryer testlari, web CourierSettingsSection.test.tsx)
- [x] Commit + push main (bot va web)

## Walkthrough / Architecture
Alert sikli har 30 s da yangi manzillarni `couriers_alerted_at` orqali bir marta "egallaydi".
O'chirgich o'chiq bo'lsa egallangan manzillar xabarsiz qoladi, shuning uchun keyin yoqilganda
eski manzillar haqida xabar ketmaydi. Web sozlama formasi mavjud `Toggle` ni qayta ishlatadi.
