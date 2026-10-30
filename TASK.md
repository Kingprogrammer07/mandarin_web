# TASK: To'lov oynasi dizayni va Uzpost zayavkada «Kartaga o'tkazma»

Oldingi vazifa (kartaga o'tkazma, 3-qism) GitHub'da: bot f2ef345, web 0c4cefd, serverga
chiqmagan; foydalanuvchi 9–13-holatlarni lokalda sinayapti.

## Objective
1. Reys to'lov oynasining 2-qadami (`MakePaymentModal`): bellashayotgan beshta tugma o'rniga
   bitta «To'lov usuli» ro'yxati va pastda bitta asosiy tugma. Har bir usulning ishlashi
   (NBU, saqlangan karta, kartaga o'tkazma, online + chek, naqd, balans) o'zgarmaydi.
2. Uzpost zayavka to'lovida «Kartaga o'tkazma» (aniq summa, bot o'zi tekshiradi): backend,
   keyin shu ro'yxat Uzpost qadamida. Pul qismi foydalanuvchi «ha» demaguncha push qilinmaydi.
3. Payme/Click — «Payme va Click to'lov tekshiruvi» oynasidagi yangi to'lov tayyor bo'lgach.

## Implementation Plan
Dizayn (shu repo):
- [x] Summa: chapda katta raqam, ostida vazn / narx / trek kodlar bitta bo'lingan qatorda
- [x] «Boshqa summa» va «Balansdan foydalanish» bitta guruhda; balans 0 bo'lsa qator yo'q,
      balans hammasini yopsa u ro'yxatda «Balansdan to'lash» usuli bo'ladi
- [x] «To'lov usuli» radio ro'yxati (haqiqiy `input type=radio`): saqlangan karta(lar),
      bank kartasi (NBU), kartaga o'tkazma, online to'lov, naqd — har biri o'z belgisi va
      bir qatorli izohi bilan
- [x] Mos kelmaydigan usul o'chiq va sababi yozilgan: NBU balans yoki boshqa summa bilan
      ishlamaydi (server doim to'liq qarzni yechadi), kartaga o'tkazma balans bilan, naqd
      boshqa summa bilan
- [x] Pastda bitta asosiy tugma (tanlangan usulga qarab: «1 210 so'm to'lash» / «Davom
      etish» / «Balansdan to'lash»), safe-area bilan; boshqa summa noto'g'ri bo'lsa o'chiq
- [x] NBU 1 000 so'm minimumi: tugma va tasdiqlash oynasi haqiqiy yechiladigan summani
      ko'rsatadi; tushuntirish ro'yxat ustidagi qutida emas, NBU qatorlarining o'zida
- [x] Gradient va rangli soyalar olib tashlanadi (2-qadam tugmalari, tasdiqlash oynasi),
      faqat `--mc-*` tokenlar
- [x] `data-tour` (pay-amount, pay-methods, pay-wallet, pay-saved-card) saqlanadi; ekranda
      yo'q element uchun tur qadami tashlanadi
- [x] Reys almashtirilganda balans / boshqa summa / tanlangan usul tozalanadi
- [x] i18n: uz/ru yangi kalitlar (`makePayment.methods.*`); eski `belowNbuMinimum*` olib tashlandi
- [x] Test (vitest: 6 ta yangi, jami 931 o'tdi), tsc, eslint, build; 320/360/390, och va
      qorong'i skrinshotlar, kesilish tekshiruvi toza
- [x] Skrinshotlarni foydalanuvchiga ko'rsatish; foydalanuvchi «Ha, yubor» dedi — main'ga push

Uzpost «Kartaga o'tkazma» (bot repo + shu repo). Pul qismi: foydalanuvchi «ha» demaguncha push yo'q.
Qaror: zayavka (DeliveryRequest) so'rov ochilganda emas, pul tasdiqlanganda yaratiladi. So'rov
zayavka qoralamasini saqlaydi. Sabab: to'lanmay qolgan so'rov ortida bo'sh «kutilmoqda» zayavka,
POS'da shovqin va 1 soatlik qayta yuborish bloki (`_check_rate_limit`) qolmaydi.
Qaror (o'zgardi): kartaga o'tkazma va Payme butun yetkazish narxini oladi, hamyon bilan birga
bo'lmaydi (reys oynasidagi kabi). Hamyonni ishlatmoqchi bo'lgan mijoz NBU yoki chek bilan to'laydi.
- [x] Model + migratsiya e2a4c6e8f0b1: `card_payment_intents.purpose` ('flight' | 'uzpost'),
      `delivery` (JSONB qoralama: reyslar, filial, telefon, oluvchi), `delivery_request_id` (FK, unique)
- [x] Servis: `open_delivery_intent`; reys so'rovlari qidiruvi faqat purpose='flight';
      `owed_between` kutilayotgan zayafka to'lovlarini ham chetlab o'tadi; shu reyslarga kutilayotgan
      yoki tasdiqlangan zayavka bo'lsa yangi so'rov ochilmaydi
- [x] API: `POST /payments/card-intent/delivery` (NBU delivery tekshiruvlari bilan, hamyonsiz);
      `calculate-uzpost` da `card_intent_available` va u bo'lsa eski karta raqami yashiriladi
- [x] Matcher: uzpost so'rovi Uzpost guruhiga, o'z matni bilan; chek so'rovi va javobi o'sha guruhga
- [x] Admin «✅ Tasdiqlash»: zayavka yaratiladi va tasdiqlanadi, ortig'i hamyonga (WALLET_ADJ
      card_overpay), olib ketish navbati, POS, kanal, mijoz
- [x] Bot o'zi (tugma yoqiq): mavjud shartlar + zayavka shartlari (boshqa zayavka yo'q, so'rov
      o'zgarmagan, yuk olib ketilmagan); «🤖 Bot qabul qildi» + «↩️ Bekor qilish»
- [x] «↩️ Bekor qilish»: Uzpost buyurtma yo'q, navbat tegilmagan, ortiqcha ishlatilmagan, zayavka
      rad etilmagan bo'lsagina; zayavka «kutilmoqda», navbat bekor, POS yashiriladi, ortiqcha qaytadi
- [x] Backend testlari: tests/test_card_delivery_pg.py (15 ta), butun suite, ruff
- [x] Frontend: Uzpost qadamida yagona «To'lov usuli» ro'yxati (`PayMethodList`, reys oynasi
      bilan umumiy): balans hammasini yopsa «Balansdan to'lash», saqlangan karta, bank kartasi,
      Payme (yoqilgan bo'lsa), kartaga o'tkazma; chek bilan faqat kartaga o'tkazma bo'lmasa;
      bitta asosiy tugma; `CardTransferPanel` va `PaymePanel` ro'yxat o'rnida ochiladi
- [x] NBU qoldig'i 1 000 so'mdan kam bo'lsa NBU qatorlari o'chiq (zayavkada ortig'i hamyonga
      qaytmaydi, mavjud backend xatosi), sababi qatorda yozilgan
- [x] Kartaga o'tkazma oynasida «Boshqa usulni tanlash» tugmasi (Payme oynasidagi kabi)
- [x] Frontend testlari (DeliveryRequestPage.test.tsx, 9 ta), tsc, eslint, build;
      320/360/390, och va qorong'i skrinshotlar, kesilish tekshiruvi toza
- [x] Foydalanuvchiga ko'rsatildi, «Ha, yubor» (30.10 17:41Z): bot 1c9ca6b, web 2692a84 main'da
- [ ] Serverga deploy (foydalanuvchi): backend va frontend birga, migratsiya e2a4c6e8f0b1

## Walkthrough / Architecture
Uzpost kartaga o'tkazma: Mini App `POST /payments/card-intent/delivery` → backend NBU delivery
tekshiruvlarini (`_prepare_uzpost_delivery_fee`, hamyon 0) qiladi, so'rov `card_payment_intents`
ga purpose='uzpost' va zayavka qoralamasi bilan yoziladi (summalar reys so'rovlari bilan bitta
hovuzda, `place_notice` ikkalasini bir xil topadi). Kirim topilganda matcher so'rov turiga qarab:
reys → `book_online_payment`, uzpost → `card_delivery.book` (zayavka yaratish + tasdiqlash +
navbat + POS + ortiqcha hamyonga). Post Uzpost guruhiga ketadi. Bekor qilish zayavkani
«kutilmoqda» ga qaytaradi. Mini App so'rovni `GET /payments/card-intent/{id}` bilan kuzatadi.

`StepUzpostPayment` ham `payOptions` massivini `PayMethodList` bilan chizadi. Kartaga o'tkazma
yoki Payme tanlansa ro'yxat o'rnida panel ochiladi (`view`); tizim «orqaga» tugmasi va panel
ichidagi «Boshqa usulni tanlash» ro'yxatga qaytaradi. To'lov o'tgach `onPaid` filialni eslab
qoladi, «Tayyor» zayavkalar tarixiga olib boradi.

`MakePaymentModal` 2-qadamda usullarni bitta massivdan (`payOptions`) chizadi: har bir
element o'z kaliti, belgisi, sarlavhasi, izohi, o'chiq bo'lish sababi (`blockedBy`), asosiy
tugma matni va `run()` ga ega. Tanlov holati faqat kalit (`methodKey`); tanlangan usul o'chib
qolsa (masalan balans yoqilsa), birinchi ishlaydigan usul tanlanadi, balans o'chirilsa
oldingi tanlov qaytadi. Pastki tugma `selectedOption.run()` ni chaqiradi — bu oldingi
tugmalar chaqirgan funksiyalarning o'zi (`setConfirmChargeCard`, `handleNbuPayment`,
`handleChooseMethod`), shuning uchun 3-qadam va server so'rovlari o'zgarmaydi.
