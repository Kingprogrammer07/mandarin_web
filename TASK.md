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

Uzpost «Kartaga o'tkazma» (bot repo + shu repo):
- [ ] Reja hujjatga yozilgan (bo'lim «Uzpost zayavka»); batafsil qadamlar backendni
      boshlaganda shu yerga qo'shiladi

## Walkthrough / Architecture
`MakePaymentModal` 2-qadamda usullarni bitta massivdan (`payOptions`) chizadi: har bir
element o'z kaliti, belgisi, sarlavhasi, izohi, o'chiq bo'lish sababi (`blockedBy`), asosiy
tugma matni va `run()` ga ega. Tanlov holati faqat kalit (`methodKey`); tanlangan usul o'chib
qolsa (masalan balans yoqilsa), birinchi ishlaydigan usul tanlanadi, balans o'chirilsa
oldingi tanlov qaytadi. Pastki tugma `selectedOption.run()` ni chaqiradi — bu oldingi
tugmalar chaqirgan funksiyalarning o'zi (`setConfirmChargeCard`, `handleNbuPayment`,
`handleChooseMethod`), shuning uchun 3-qadam va server so'rovlari o'zgarmaydi.
