/**
 * Mandarin Cargo — huquqiy hujjatlar (ommaviy oferta, maxfiylik siyosati,
 * foydalanish shartlari).
 *
 * ⚠️ MUHIM — LITSENZIYALI YURIST KO'RIGIDAN O'TKAZILSIN.
 * Bu matnlar quyidagi amaldagi normativ hujjatlar asosida tayyorlangan
 * loyihadir, lekin yuridik xulosa emas. Nashr qilishdan oldin advokat yoki
 * kompaniyaning yuridik maslahatchisi tasdiqlashi shart:
 *
 *  • O'zbekiston Respublikasi Fuqarolik kodeksi — 367-modda (oferta),
 *    369-modda (ommaviy oferta), transport ekspeditsiyasi bo'yicha boblar.
 *  • «Elektron tijorat to'g'risida»gi Qonun, 29.09.2022, O'RQ-792 —
 *    9-modda (sotuvchining ma'lumot oshkor qilish majburiyati),
 *    10-modda (xaridor majburiyatlari), 16-modda (oferta talablari).
 *  • «Shaxsga doir ma'lumotlar to'g'risida»gi Qonun, 02.07.2019, O'RQ-547 —
 *    18-modda (rozilik), 20-modda (bazani davlat reyestrida ro'yxatdan
 *    o'tkazish), 21-modda (rozilikasiz ishlov berish asoslari),
 *    27-1-modda (ma'lumotlarni O'zbekiston hududida saqlash),
 *    30-modda (subyekt huquqlari), 31-modda (operator majburiyatlari).
 *    2026-yil 26-martdagi o'zgartirishlar bilan.
 *  • «Iste'molchilarning huquqlarini himoya qilish to'g'risida»gi Qonun.
 *
 * Egasining qarori bilan hujjatga kiritilmagan: STIR (INN), yuridik manzil,
 * bank rekvizitlari va shaxsga doir ma'lumotlar bazasining Davlat reyestri
 * raqami. Reyestrda ro'yxatdan o'tish majburiyati (O'RQ-547, 20-modda) bundan
 * bekor bo'lmaydi — hujjatda raqam ko'rsatilmayapti, xolos.
 */

export type LegalDocId = 'offer' | 'privacy' | 'terms';
export type LegalLang = 'uz' | 'ru';

export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalDocument {
  title: string;
  subtitle: string;
  updatedLabel: string;
  sections: LegalSection[];
}

/** Hujjatlar oxirgi marta tahrirlangan sana. O'zgartirilsa — yangilansin. */
export const LEGAL_VERSION = '2026-08-25';

/** Foydalanuvchi rozilik bergan hujjatlar to'plamining versiyasi. */
export const LEGAL_CONSENT_VERSION = LEGAL_VERSION;

export const LEGAL_COMPANY = {
  brand: 'Mandarin Cargo',
  operator: 'Triton Supply Chain',
  supportPhoneDisplay: '+998 55 500 34 44',
  supportPhoneTel: '+998555003444',
  telegramHandle: '@mandarin_admin',
  websiteDisplay: 'mandarincargo.uz',
  websiteUrl: 'https://mandarincargo.uz',
} as const;

export const LEGAL_DOC_ORDER: LegalDocId[] = ['offer', 'privacy', 'terms'];

export const LEGAL_DOC_LABELS: Record<LegalDocId, Record<LegalLang, string>> = {
  offer: { uz: 'Ommaviy oferta', ru: 'Публичная оферта' },
  privacy: { uz: 'Maxfiylik siyosati', ru: 'Политика конфиденциальности' },
  terms: { uz: 'Foydalanish shartlari', ru: 'Условия использования' },
};

export const LEGAL_LANG_LABELS: Record<LegalLang, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
};

/**
 * Ma’lumotlar qayerda qayta ishlanadi.
 *
 * ⚠️ Bu YURIDIK BAYONOT — u infratuzilma bilan mos bo‘lishi SHART.
 * Hozirgi holat (2026-08-25): backend va Postgres — Hetzner (Germaniya),
 * pasport skanlari — AWS S3 `eu-north-1` (Shvetsiya). Server joyi
 * o‘zgartirilsa, bu qator ham o‘zgartiriladi.
 *
 * OCHIQ SAVOL (advokat hal qiladi): pasport skani «biometrik ma’lumot»
 * toifasiga kiradimi? Agar kirsa — u 27-1-moddaga ko‘ra O‘zbekiston hududida
 * saqlanishi shart va infratuzilma o‘zgartirilishi kerak.
 */
const DATA_LOCATION_UZ =
  'Yevropa Ittifoqi va Yevropa Iqtisodiy Hududi mamlakatlaridagi (Germaniya, Shvetsiya) ma’lumotlar markazlari serverlari.';
const DATA_LOCATION_RU =
  'Серверы дата-центров в странах Европейского союза и Европейской экономической зоны (Германия, Швеция).';

const UPDATED_UZ = "Oxirgi yangilanish: 2026-yil 25-avgust";
const UPDATED_RU = 'Последнее обновление: 25 августа 2026 г.';

// ─────────────────────────────────────────────────────────── OMMAVIY OFERTA

const OFFER_UZ: LegalDocument = {
  title: 'Ommaviy oferta',
  subtitle: 'Xitoydan O‘zbekistonga yuk yetkazish xizmatlari to‘g‘risida shartnoma',
  updatedLabel: UPDATED_UZ,
  sections: [
    {
      heading: '1. Umumiy qoidalar va atamalar',
      body: [
        `Ushbu hujjat ${LEGAL_COMPANY.operator} (keyingi o‘rinlarda — «Ijrochi») nomidan e’lon qilingan ommaviy oferta bo‘lib, O‘zbekiston Respublikasi Fuqarolik kodeksining 369-moddasiga muvofiq cheklanmagan doiradagi shaxslarga qaratilgan taklifdir.`,
        '«Buyurtmachi» — Mandarin Cargo Telegram Mini App ilovasida ro‘yxatdan o‘tgan va ushbu ofertani aksept qilgan jismoniy yoki yuridik shaxs.',
        '«Xizmat» — Buyurtmachiga tegishli yuklarni Xitoy Xalq Respublikasidagi ombordan qabul qilish, konsolidatsiya qilish, O‘zbekiston Respublikasiga tashishni tashkil etish, bojxona rasmiylashtiruvida ko‘maklashish va Toshkent shahridagi omborda topshirishdan iborat transport-ekspeditsiya xizmatlari majmui.',
        '«Mijoz kodi» — Buyurtmachiga ro‘yxatdan o‘tishda beriladigan noyob identifikator. Xitoydagi ombor manzilida aynan shu kod yuk egasini aniqlaydi.',
        '«Trek-kod» — yukni kuzatish uchun sotuvchi yoki tashuvchi tomonidan beriladigan raqam.',
        '«Ilova» — Telegram platformasidagi Mandarin Cargo Mini App va uning veb-versiyasi.',
      ],
    },
    {
      heading: '2. Oferta predmeti',
      body: [
        'Ijrochi Buyurtmachining topshirig‘iga binoan yuklarni tashishni tashkil etish bo‘yicha transport-ekspeditsiya xizmatlarini ko‘rsatish, Buyurtmachi esa ko‘rsatilgan xizmatlarni qabul qilib, ularning haqini to‘lash majburiyatini oladi.',
        'Ijrochi tashuvchi sifatida emas, ekspeditor sifatida ish ko‘radi: u tashishni tashkil etadi va shu maqsadda uchinchi shaxslarni (aviakompaniya, avtotashuvchi, bojxona brokeri, pochta operatori) jalb qilishga haqli.',
        'Xizmatning aniq hajmi, tarifi va muddati Ilovada e’lon qilinadi hamda har bir reys uchun alohida shakllantiriladigan hisobotda aks etadi.',
      ],
    },
    {
      heading: '3. Ofertani aksept qilish',
      body: [
        'Oferta Fuqarolik kodeksining 367-moddasiga muvofiq quyidagi harakatlar orqali to‘liq va so‘zsiz qabul qilingan (aksept qilingan) hisoblanadi:',
        'a) Ilovada ro‘yxatdan o‘tish va ushbu oferta bilan tanishganlik haqidagi katakchani belgilash;',
        'b) Xitoydagi ombor manziliga o‘z Mijoz kodi bilan yuk jo‘natish;',
        'v) ko‘rsatilgan xizmat uchun to‘lovni amalga oshirish.',
        'Aksept qilingan paytdan boshlab tomonlar o‘rtasida ushbu oferta shartlaridagi shartnoma tuzilgan hisoblanadi. Alohida yozma shartnoma imzolash talab etilmaydi.',
        'Buyurtmachi oferta shartlariga rozi bo‘lmasa, xizmatdan foydalanmasligi lozim.',
      ],
    },
    {
      heading: '4. Xizmat narxi va to‘lov tartibi',
      body: [
        'Xizmat narxi Ilovada e’lon qilingan amaldagi tariflar asosida hisoblanadi. Tarif yukning haqiqiy vazni yoki hajmiy (gabarit) vazni — qaysi biri katta bo‘lsa — shuning asosida belgilanadi.',
        'Hajmiy vazn Ilovadagi kalkulyatorda ko‘rsatilgan formula bo‘yicha hisoblanadi. Kalkulyator natijasi taxminiy bo‘lib, yakuniy summa yuk O‘zbekistondagi omborda o‘lchangandan keyin aniqlanadi.',
        'To‘lov Ilova orqali onlayn (bank kartasi, NBU to‘lov shlyuzi), ichki hamyon balansi orqali yoki Ijrochining ofisida naqd pulda amalga oshiriladi.',
        'Ijrochi tariflarni bir tomonlama o‘zgartirishga haqli. Yangi tarif Ilovada e’lon qilingan paytdan kuchga kiradi va e’lon qilingunga qadar Xitoy omboriga qabul qilingan yuklarga nisbatan qo‘llanilmaydi.',
        'Yuk to‘liq to‘lanmaguncha Ijrochi uni topshirishni ushlab turishga haqli.',
      ],
    },
    {
      heading: '5. Ijrochining huquq va majburiyatlari',
      body: [
        'Ijrochi yukni Xitoydagi ombordan qabul qilish, uning holatini tashqi ko‘rikdan o‘tkazish va Ilovada qayd etish majburiyatini oladi.',
        'Ijrochi yuk harakati to‘g‘risidagi ma’lumotni Ilovada yangilab boradi. Ma’lumot uchinchi shaxslardan (tashuvchi, bojxona) kelib tushadi va real vaqtdan kechikishi mumkin.',
        'Ijrochi tashish yo‘nalishini, tashuvchini va transport turini mustaqil tanlashga haqli, agar bu yetkazib berish muddatini asossiz uzaytirmasa.',
        'Ijrochi taqiqlangan yuklarni qabul qilishdan bosh tortishga, shuningdek allaqachon qabul qilingan bunday yukni saqlab turish yoki tegishli organlarga topshirishga haqli.',
        'Ijrochi Buyurtmachining shaxsga doir ma’lumotlarini Maxfiylik siyosatida belgilangan tartibda qayta ishlaydi.',
      ],
    },
    {
      heading: '6. Buyurtmachining huquq va majburiyatlari',
      body: [
        'Buyurtmachi ro‘yxatdan o‘tishda to‘g‘ri va to‘liq ma’lumot berishi, ular o‘zgarganda Ilovada yangilashi shart.',
        'Buyurtmachi Xitoydagi ombor manziliga yuk jo‘natishda o‘z Mijoz kodini to‘g‘ri ko‘rsatishi shart. Kod ko‘rsatilmagan yoki noto‘g‘ri ko‘rsatilgan yukning egasini aniqlash imkoni bo‘lmaydi va bunday yuk uchun Ijrochi javobgar bo‘lmaydi.',
        'Buyurtmachi yuk tarkibi to‘g‘risida haqqoniy ma’lumot berishi va uning O‘zbekiston Respublikasi qonunchiligiga hamda Ilovadagi «Taqiqlangan yuklar» ro‘yxatiga muvofiqligini ta’minlashi shart.',
        'Buyurtmachi yuk O‘zbekistonga yetib kelgani haqidagi xabar olingandan so‘ng 30 (o‘ttiz) kalendar kun ichida uni olib ketishi lozim.',
        'Buyurtmachi ko‘rsatilgan xizmat haqini o‘z vaqtida to‘lashi shart.',
      ],
    },
    {
      heading: '7. Yukni topshirish va olish',
      body: [
        'Yuk O‘zbekistondagi omborga kelib tushgach, Buyurtmachiga Ilova va Telegram bot orqali xabar yuboriladi.',
        'Yuk shaxsni tasdiqlovchi hujjat va Mijoz kodi asosida topshiriladi. Uchinchi shaxsga topshirish faqat Buyurtmachining Ilova orqali berilgan tasdig‘i asosida amalga oshiriladi.',
        'Yukni qabul qilishda Buyurtmachi uning tashqi holatini va o‘ramning butunligini tekshirishi shart. Yukni e’tirozsiz qabul qilish uning tashqi ko‘rinishi bo‘yicha da’vo yo‘qligini anglatadi.',
        'Yetkazib berish xizmati (kuryer yoki pochta) alohida buyurtma asosida ko‘rsatiladi va alohida to‘lanadi.',
        `Belgilangan muddatda olib ketilmagan yuk uchun Ijrochi saqlash haqini undirishga haqli. Saqlash tarifi Ilovada e’lon qilinadi.`,
      ],
    },
    {
      heading: '8. Taqiqlangan yuklar',
      body: [
        'Tashishga qabul qilinmaydigan yuklarning to‘liq ro‘yxati Ilovaning «Taqiqlangan yuklar» bo‘limida keltirilgan va u ushbu ofertaning ajralmas qismi hisoblanadi.',
        'Buyurtmachi taqiqlangan yukni jo‘natgan taqdirda, undan kelib chiqadigan barcha oqibatlar — jarimalar, bojxona sanksiyalari, yukning musodara qilinishi va uchinchi shaxslar oldidagi javobgarlik — Buyurtmachi zimmasida bo‘ladi.',
        'Ijrochi bunday yukni aniqlagan taqdirda tashishni to‘xtatishga va tegishli davlat organlarini xabardor qilishga haqli.',
      ],
    },
    {
      heading: '9. Tomonlarning javobgarligi',
      body: [
        'Ijrochi o‘z majburiyatlarini bajarmaganligi yoki lozim darajada bajarmaganligi uchun O‘zbekiston Respublikasi qonunchiligida belgilangan asoslarda javobgar bo‘ladi.',
        'Agar majburiyat buzilishi Ijrochi jalb qilgan tashuvchining tashish shartnomasini lozim darajada bajarmaganligi natijasida yuz bergan bo‘lsa, Ijrochining Buyurtmachi oldidagi javobgarligi tegishli tashuvchining ekspeditor oldidagi javobgarligi qoidalari bo‘yicha belgilanadi.',
        'Ijrochi quyidagilar uchun javobgar bo‘lmaydi: yukning ichki nuqsonlari va yashirin kamchiliklari; Buyurtmachi tomonidan noto‘g‘ri ko‘rsatilgan ma’lumotlar oqibatlari; sotuvchi tomonidan noto‘g‘ri yoki nuqsonli tovar jo‘natilishi; bojxona va boshqa vakolatli organlarning qarorlari; e’lon qilinmagan qimmatbaho buyumlarning yo‘qolishi.',
        'Yuk yo‘qolgan yoki shikastlangan taqdirda tovon miqdori qonunchilikda belgilangan tartibda aniqlanadi va Buyurtmachi hujjat bilan tasdiqlagan haqiqiy zarardan oshmaydi.',
        'Tomonlar bilvosita zarar, boy berilgan foyda va obro‘ga yetkazilgan zarar uchun javobgar bo‘lmaydi.',
      ],
    },
    {
      heading: '10. Yengib bo‘lmas kuch holatlari',
      body: [
        'Tomonlar yengib bo‘lmas kuch holatlari (tabiiy ofatlar, harbiy harakatlar, epidemiyalar, davlat organlarining aktlari, chegaralarning yopilishi, transport kommunikatsiyalarining ishdan chiqishi) sababli majburiyatlarni bajara olmaganligi uchun javobgarlikdan ozod qilinadi.',
        'Bunday holat yuz bergan tomon ikkinchi tomonni imkon qadar tezroq xabardor qilishi lozim.',
      ],
    },
    {
      heading: '11. Nizolarni hal qilish',
      body: [
        'Nizolar muzokaralar yo‘li bilan hal qilinadi. Da’vo yozma shaklda yoki Ilovadagi qo‘llab-quvvatlash kanali orqali yuboriladi va 15 (o‘n besh) ish kuni ichida ko‘rib chiqiladi.',
        'Kelishuvga erishilmagan taqdirda nizo O‘zbekiston Respublikasi qonunchiligiga muvofiq sud tartibida hal etiladi.',
        'Ushbu ofertaga O‘zbekiston Respublikasining moddiy huquqi qo‘llaniladi.',
      ],
    },
    {
      heading: '12. Yakuniy qoidalar',
      body: [
        'Ijrochi ofertaga bir tomonlama o‘zgartirish kiritishga haqli. Yangi tahrir Ilovada e’lon qilingan paytdan kuchga kiradi.',
        'Xizmatdan foydalanishni davom ettirish yangi tahrirga rozilik deb hisoblanadi. Rozi bo‘lmagan Buyurtmachi xizmatdan foydalanishni to‘xtatishi lozim.',
        'Ofertaning ayrim qoidasi haqiqiy emas deb topilsa, bu qolgan qoidalarning haqiqiyligiga ta’sir qilmaydi.',
      ],
    },
    {
      heading: '13. Ijrochining rekvizitlari',
      body: [
        `Tashkilot: ${LEGAL_COMPANY.operator}`,
        `Brend: ${LEGAL_COMPANY.brand}`,
        `Telefon: ${LEGAL_COMPANY.supportPhoneDisplay}`,
        `Telegram: ${LEGAL_COMPANY.telegramHandle}`,
        `Veb-sayt: ${LEGAL_COMPANY.websiteDisplay}`,
      ],
    },
  ],
};

const OFFER_RU: LegalDocument = {
  title: 'Публичная оферта',
  subtitle: 'Договор оказания услуг доставки грузов из Китая в Узбекистан',
  updatedLabel: UPDATED_RU,
  sections: [
    {
      heading: '1. Общие положения и термины',
      body: [
        `Настоящий документ является публичной офертой ${LEGAL_COMPANY.operator} (далее — «Исполнитель») и в соответствии со статьёй 369 Гражданского кодекса Республики Узбекистан адресован неограниченному кругу лиц.`,
        '«Заказчик» — физическое или юридическое лицо, зарегистрированное в Telegram Mini App Mandarin Cargo и акцептовавшее настоящую оферту.',
        '«Услуга» — комплекс транспортно-экспедиторских услуг: приём груза на складе в КНР, консолидация, организация перевозки в Республику Узбекистан, содействие в таможенном оформлении и выдача груза на складе в Ташкенте.',
        '«Код клиента» — уникальный идентификатор, присваиваемый Заказчику при регистрации. Именно он определяет владельца груза на складе в Китае.',
        '«Трек-код» — номер отслеживания, присваиваемый продавцом или перевозчиком.',
        '«Приложение» — Mandarin Cargo Mini App на платформе Telegram и его веб-версия.',
      ],
    },
    {
      heading: '2. Предмет оферты',
      body: [
        'Исполнитель обязуется по поручению Заказчика оказать транспортно-экспедиторские услуги по организации перевозки грузов, а Заказчик — принять и оплатить оказанные услуги.',
        'Исполнитель действует как экспедитор, а не как перевозчик: он организует перевозку и вправе привлекать третьих лиц (авиакомпанию, автоперевозчика, таможенного брокера, почтового оператора).',
        'Конкретный объём, тариф и сроки публикуются в Приложении и отражаются в отчёте, формируемом по каждому рейсу.',
      ],
    },
    {
      heading: '3. Акцепт оферты',
      body: [
        'В соответствии со статьёй 367 Гражданского кодекса оферта считается полностью и безоговорочно акцептованной при совершении любого из следующих действий:',
        'а) регистрация в Приложении и проставление отметки об ознакомлении с настоящей офертой;',
        'б) отправка груза на адрес склада в Китае с указанием своего Кода клиента;',
        'в) оплата оказанной услуги.',
        'С момента акцепта между сторонами считается заключённым договор на условиях настоящей оферты. Подписание отдельного письменного договора не требуется.',
        'Если Заказчик не согласен с условиями оферты, он не должен пользоваться услугой.',
      ],
    },
    {
      heading: '4. Стоимость услуг и порядок оплаты',
      body: [
        'Стоимость рассчитывается по действующим тарифам, опубликованным в Приложении. Тариф определяется по фактическому либо объёмному (габаритному) весу — по большему из них.',
        'Объёмный вес рассчитывается по формуле, указанной в калькуляторе Приложения. Результат калькулятора является предварительным; окончательная сумма определяется после взвешивания груза на складе в Узбекистане.',
        'Оплата производится онлайн через Приложение (банковская карта, платёжный шлюз НБУ), с баланса внутреннего кошелька либо наличными в офисе Исполнителя.',
        'Исполнитель вправе изменять тарифы в одностороннем порядке. Новый тариф вступает в силу с момента публикации и не применяется к грузам, принятым на склад в Китае до публикации.',
        'До полной оплаты Исполнитель вправе удерживать груз.',
      ],
    },
    {
      heading: '5. Права и обязанности Исполнителя',
      body: [
        'Исполнитель обязуется принять груз на складе в Китае, произвести его внешний осмотр и зафиксировать данные в Приложении.',
        'Исполнитель обновляет информацию о движении груза в Приложении. Данные поступают от третьих лиц (перевозчик, таможня) и могут отставать от реального времени.',
        'Исполнитель вправе самостоятельно выбирать маршрут, перевозчика и вид транспорта, если это не приводит к необоснованному увеличению срока доставки.',
        'Исполнитель вправе отказать в приёме запрещённых грузов, а также удерживать либо передать уполномоченным органам уже принятый такой груз.',
        'Исполнитель обрабатывает персональные данные Заказчика в порядке, определённом Политикой конфиденциальности.',
      ],
    },
    {
      heading: '6. Права и обязанности Заказчика',
      body: [
        'Заказчик обязан предоставить при регистрации достоверные и полные сведения и своевременно обновлять их в Приложении.',
        'Заказчик обязан корректно указывать свой Код клиента при отправке груза на адрес склада в Китае. Груз без кода или с неверным кодом не может быть идентифицирован, и ответственность за него Исполнитель не несёт.',
        'Заказчик обязан предоставлять достоверные сведения о содержимом груза и обеспечивать его соответствие законодательству Республики Узбекистан и разделу «Запрещённые грузы» Приложения.',
        'Заказчик обязан забрать груз в течение 30 (тридцати) календарных дней с момента уведомления о его прибытии в Узбекистан.',
        'Заказчик обязан своевременно оплачивать оказанные услуги.',
      ],
    },
    {
      heading: '7. Выдача и получение груза',
      body: [
        'После поступления груза на склад в Узбекистане Заказчику направляется уведомление через Приложение и Telegram-бот.',
        'Груз выдаётся на основании документа, удостоверяющего личность, и Кода клиента. Выдача третьему лицу производится только по подтверждению Заказчика, переданному через Приложение.',
        'При получении Заказчик обязан проверить внешнее состояние груза и целостность упаковки. Приём груза без замечаний означает отсутствие претензий по внешнему виду.',
        'Услуга доставки (курьер или почта) оказывается по отдельной заявке и оплачивается отдельно.',
        'За груз, не полученный в установленный срок, Исполнитель вправе взимать плату за хранение по тарифу, опубликованному в Приложении.',
      ],
    },
    {
      heading: '8. Запрещённые грузы',
      body: [
        'Полный перечень грузов, не принимаемых к перевозке, приведён в разделе «Запрещённые грузы» Приложения и является неотъемлемой частью настоящей оферты.',
        'В случае отправки запрещённого груза все вытекающие последствия — штрафы, таможенные санкции, конфискация груза и ответственность перед третьими лицами — несёт Заказчик.',
        'При выявлении такого груза Исполнитель вправе приостановить перевозку и уведомить уполномоченные государственные органы.',
      ],
    },
    {
      heading: '9. Ответственность сторон',
      body: [
        'Исполнитель несёт ответственность за неисполнение или ненадлежащее исполнение обязательств по основаниям, установленным законодательством Республики Узбекистан.',
        'Если нарушение обязательства вызвано ненадлежащим исполнением договора перевозки привлечённым перевозчиком, ответственность Исполнителя перед Заказчиком определяется по правилам ответственности соответствующего перевозчика перед экспедитором.',
        'Исполнитель не несёт ответственности за: внутренние дефекты и скрытые недостатки груза; последствия неверных данных, указанных Заказчиком; отправку продавцом неверного или бракованного товара; решения таможенных и иных уполномоченных органов; утрату незаявленных ценных вложений.',
        'При утрате или повреждении груза размер возмещения определяется в порядке, установленном законодательством, и не превышает документально подтверждённого реального ущерба.',
        'Стороны не несут ответственности за косвенные убытки, упущенную выгоду и репутационный вред.',
      ],
    },
    {
      heading: '10. Обстоятельства непреодолимой силы',
      body: [
        'Стороны освобождаются от ответственности за неисполнение обязательств вследствие обстоятельств непреодолимой силы (стихийные бедствия, военные действия, эпидемии, акты государственных органов, закрытие границ, сбои транспортных коммуникаций).',
        'Сторона, у которой возникли такие обстоятельства, обязана уведомить другую сторону в кратчайший срок.',
      ],
    },
    {
      heading: '11. Разрешение споров',
      body: [
        'Споры разрешаются путём переговоров. Претензия направляется в письменной форме либо через канал поддержки в Приложении и рассматривается в течение 15 (пятнадцати) рабочих дней.',
        'При недостижении согласия спор разрешается в судебном порядке в соответствии с законодательством Республики Узбекистан.',
        'К настоящей оферте применяется материальное право Республики Узбекистан.',
      ],
    },
    {
      heading: '12. Заключительные положения',
      body: [
        'Исполнитель вправе в одностороннем порядке вносить изменения в оферту. Новая редакция вступает в силу с момента публикации в Приложении.',
        'Продолжение пользования услугой считается согласием с новой редакцией. Несогласный Заказчик должен прекратить пользование услугой.',
        'Признание отдельного положения оферты недействительным не влияет на действительность остальных положений.',
      ],
    },
    {
      heading: '13. Реквизиты Исполнителя',
      body: [
        `Организация: ${LEGAL_COMPANY.operator}`,
        `Бренд: ${LEGAL_COMPANY.brand}`,
        `Телефон: ${LEGAL_COMPANY.supportPhoneDisplay}`,
        `Telegram: ${LEGAL_COMPANY.telegramHandle}`,
        `Сайт: ${LEGAL_COMPANY.websiteDisplay}`,
      ],
    },
  ],
};

// ───────────────────────────────────────────────────── MAXFIYLIK SIYOSATI

const PRIVACY_UZ: LegalDocument = {
  title: 'Maxfiylik siyosati',
  subtitle: 'Shaxsga doir ma’lumotlarni qayta ishlash tartibi',
  updatedLabel: UPDATED_UZ,
  sections: [
    {
      heading: '1. Umumiy qoidalar',
      body: [
        `Ushbu siyosat ${LEGAL_COMPANY.operator} (keyingi o‘rinlarda — «Operator») Mandarin Cargo ilovasi foydalanuvchilarining shaxsga doir ma’lumotlarini qanday yig‘ishi, qayta ishlashi va himoya qilishini tushuntiradi.`,
        'Siyosat O‘zbekiston Respublikasining «Shaxsga doir ma’lumotlar to‘g‘risida»gi 2019-yil 2-iyuldagi O‘RQ-547-son Qonuni asosida ishlab chiqilgan.',
      ],
    },
    {
      heading: '2. Qanday ma’lumotlarni yig‘amiz',
      body: [
        'Shaxsni tasdiqlovchi ma’lumotlar: familiya, ism, otasining ismi, tug‘ilgan sana, pasport seriyasi va raqami, JSHSHIR (PINFL), pasport nusxasi.',
        'Aloqa ma’lumotlari: telefon raqami, yashash manzili, viloyat va tuman.',
        'Telegram identifikatorlari: Telegram ID, foydalanuvchi nomi va ism.',
        'Xizmatga oid ma’lumotlar: mijoz kodi, trek-kodlar, yuklar ro‘yxati, vazn va o‘lchamlar, reys ma’lumotlari.',
        'Moliyaviy ma’lumotlar: tranzaksiyalar tarixi, to‘lovlar, hamyon balansi va qarzdorlik.',
        'To‘lov kartasi ma’lumotlari NBU to‘lov shlyuzi orqali faqat xavfsiz token ko‘rinishida saqlanadi. Kartaning to‘liq raqami, amal qilish muddati va CVV kodi Operator tizimida saqlanmaydi.',
        'Texnik ma’lumotlar: qurilma turi, sessiya, IP-manzil va kirish vaqtlari — faqat xavfsizlik va suiiste’molning oldini olish maqsadida.',
      ],
    },
    {
      heading: '3. Qayta ishlash maqsadlari va huquqiy asoslari',
      body: [
        'Xizmat ko‘rsatish: yukni identifikatsiya qilish, tashishni tashkil etish, hisob-kitob qilish va topshirish. Huquqiy asos — siz aksept qilgan shartnomani (ommaviy oferta) bajarish.',
        'Bojxona va boshqa majburiy rasmiylashtiruv: qonun hujjatlarida nazarda tutilgan hollarda vakolatli organlarga ma’lumot taqdim etish. Huquqiy asos — qonun talabi.',
        'Aloqa: yuk holati, to‘lov va xizmatdagi o‘zgarishlar to‘g‘risida xabar berish.',
        'Xavfsizlik: firibgarlik va ruxsatsiz kirishning oldini olish.',
        'Marketing xabarlari faqat alohida rozilik asosida yuboriladi va istalgan vaqtda bekor qilinishi mumkin.',
      ],
    },
    {
      heading: '4. Rozilik va uni qaytarib olish',
      body: [
        'Ro‘yxatdan o‘tishda tegishli katakchani belgilash orqali siz shaxsga doir ma’lumotlaringizni ushbu siyosatda ko‘rsatilgan maqsadlarda qayta ishlashga rozilik bildirasiz (O‘RQ-547, 18-modda).',
        'Roziligingizni istalgan vaqtda qaytarib olishingiz mumkin — buning uchun qo‘llab-quvvatlash xizmatiga murojaat qiling.',
        'Rozilikni qaytarib olish qonun talabi bilan saqlanishi shart bo‘lgan ma’lumotlarga (masalan, buxgalteriya va bojxona hujjatlari) taalluqli emas.',
        'Rozilik qaytarib olingandan so‘ng xizmat ko‘rsatish to‘xtatilishi mumkin, chunki yukni identifikatsiya qilishning boshqa usuli yo‘q.',
      ],
    },
    {
      heading: '5. Ma’lumotlarni uchinchi shaxslarga berish',
      body: [
        'Ma’lumotlaringiz faqat xizmatni ko‘rsatish uchun zarur bo‘lgan hajmda quyidagilarga uzatiladi: tashuvchilar va bojxona brokerlari; pochta va kuryerlik operatorlari (yetkazib berish buyurtma qilinganda); to‘lov tashkilotlari va banklar; qonunda nazarda tutilgan hollarda vakolatli davlat organlari.',
        'Operator shaxsga doir ma’lumotlarni sotmaydi va reklama maqsadida uchinchi shaxslarga bermaydi.',
        'Ma’lumotlarni chegaradan tashqariga uzatish qonunchilikda belgilangan tartibda va faqat zarur hollarda amalga oshiriladi.',
      ],
    },
    {
      heading: '6. Saqlash joyi va muddati',
      body: [
        `Ma’lumotlar qayta ishlanadigan joy: ${DATA_LOCATION_UZ}`,
        'Chegaradan tashqariga uzatish «Shaxsga doir ma’lumotlar to‘g‘risida»gi Qonunning 27-1-moddasi (2026-yil 26-mart tahriri) shartlari asosida amalga oshiriladi: qabul qiluvchi davlatda ma’lumotlar himoyasining teng darajasi, vakolatli organ tasdiqlagan shartnoma bandlari va xalqaro standartlarga rioya qilish.',
        'Qonunchilikka ko‘ra faqat mamlakat ichida saqlanishi shart bo‘lgan toifadagi ma’lumotlar (biometrik va genetik ma’lumotlar) O‘zbekiston Respublikasi hududida saqlanadi.',
        'Ma’lumotlar xizmat ko‘rsatish davomida va undan keyin qonunchilikda belgilangan saqlash muddati davomida saqlanadi.',
        'Muddat tugagach ma’lumotlar o‘chiriladi yoki shaxsni aniqlash imkonini bermaydigan holatga keltiriladi.',
      ],
    },
    {
      heading: '7. Xavfsizlik choralari',
      body: [
        'Ma’lumotlar uzatishda va saqlashda shifrlanadi, tizimga kirish rollar va huquqlar tizimi orqali cheklanadi.',
        'Xodimlarning ma’lumotlarga kirishi ish majburiyatlari doirasida cheklanadi va jurnalga yozib boriladi.',
        'Ma’lumotlar xavfsizligi buzilgan taqdirda Operator qonunchilikda belgilangan tartibda vakolatli organni va ta’sirlangan foydalanuvchilarni xabardor qiladi.',
      ],
    },
    {
      heading: '8. Sizning huquqlaringiz',
      body: [
        'O‘RQ-547 Qonunining 30-moddasiga muvofiq siz quyidagi huquqlarga egasiz:',
        'o‘zingizga doir ma’lumotlar qayta ishlanayotgani to‘g‘risida ma’lumot olish;',
        'ma’lumotlaringiz bilan tanishish va ularning nusxasini olish;',
        'noto‘g‘ri yoki to‘liq bo‘lmagan ma’lumotlarni aniqlashtirishni talab qilish;',
        'ma’lumotlarni bloklash yoki o‘chirishni talab qilish;',
        'roziligingizni qaytarib olish;',
        'huquqlaringiz buzilgan deb hisoblasangiz, vakolatli davlat organiga yoki sudga murojaat qilish.',
        'Murojaatlar 30 kun ichida ko‘rib chiqiladi (O‘RQ-547, 31-modda).',
      ],
    },
    {
      heading: '9. Voyaga yetmaganlar',
      body: [
        'Xizmat 18 yoshga to‘lgan shaxslar uchun mo‘ljallangan.',
        'Voyaga yetmagan shaxsning ma’lumotlari uning qonuniy vakili roziligisiz ataylab yig‘ilmaydi. Bunday holat aniqlansa, ma’lumotlar o‘chiriladi.',
      ],
    },
    {
      heading: '10. Texnik ma’lumotlar va analitika',
      body: [
        'Ilova ishlashi uchun brauzer xotirasida sessiya va sozlamalar (til, mavzu) saqlanadi. Bu ma’lumotlar sizning qurilmangizda qoladi.',
        'Foydalanish statistikasi shaxsni aniqlamaydigan, umumlashtirilgan ko‘rinishda yig‘ilishi mumkin.',
      ],
    },
    {
      heading: '11. Siyosatga o‘zgartirishlar',
      body: [
        'Operator ushbu siyosatga o‘zgartirish kiritishga haqli. Yangi tahrir Ilovada e’lon qilingan paytdan kuchga kiradi.',
        'Muhim o‘zgarishlar to‘g‘risida foydalanuvchilar Ilova orqali xabardor qilinadi.',
      ],
    },
    {
      heading: '12. Aloqa',
      body: [
        `Shaxsga doir ma’lumotlar bo‘yicha savollar: ${LEGAL_COMPANY.telegramHandle}`,
        `Telefon: ${LEGAL_COMPANY.supportPhoneDisplay}`,
        `Tashkilot: ${LEGAL_COMPANY.operator}`,
      ],
    },
  ],
};

const PRIVACY_RU: LegalDocument = {
  title: 'Политика конфиденциальности',
  subtitle: 'Порядок обработки персональных данных',
  updatedLabel: UPDATED_RU,
  sections: [
    {
      heading: '1. Общие положения',
      body: [
        `Настоящая политика описывает, как ${LEGAL_COMPANY.operator} (далее — «Оператор») собирает, обрабатывает и защищает персональные данные пользователей приложения Mandarin Cargo.`,
        'Политика разработана на основании Закона Республики Узбекистан «О персональных данных» от 2 июля 2019 года № ЗРУ-547.',
      ],
    },
    {
      heading: '2. Какие данные мы собираем',
      body: [
        'Идентификационные данные: фамилия, имя, отчество, дата рождения, серия и номер паспорта, ПИНФЛ, копия паспорта.',
        'Контактные данные: номер телефона, адрес проживания, область и район.',
        'Идентификаторы Telegram: Telegram ID, имя пользователя и имя.',
        'Сервисные данные: код клиента, трек-коды, перечень грузов, вес и габариты, сведения о рейсе.',
        'Финансовые данные: история транзакций, платежи, баланс кошелька и задолженность.',
        'Данные платёжной карты хранятся только в виде защищённого токена через платёжный шлюз НБУ. Полный номер карты, срок действия и CVV в системе Оператора не хранятся.',
        'Технические данные: тип устройства, сессия, IP-адрес и время входа — исключительно в целях безопасности и предотвращения злоупотреблений.',
      ],
    },
    {
      heading: '3. Цели и правовые основания обработки',
      body: [
        'Оказание услуги: идентификация груза, организация перевозки, расчёты и выдача. Правовое основание — исполнение акцептованного вами договора (публичной оферты).',
        'Таможенное и иное обязательное оформление: предоставление сведений уполномоченным органам в случаях, предусмотренных законодательством. Правовое основание — требование закона.',
        'Связь: уведомления о статусе груза, платежах и изменениях в сервисе.',
        'Безопасность: предотвращение мошенничества и несанкционированного доступа.',
        'Маркетинговые сообщения направляются только при отдельном согласии и могут быть отключены в любой момент.',
      ],
    },
    {
      heading: '4. Согласие и его отзыв',
      body: [
        'Проставляя соответствующую отметку при регистрации, вы даёте согласие на обработку персональных данных в указанных целях (ЗРУ-547, статья 18).',
        'Вы вправе отозвать согласие в любой момент, обратившись в службу поддержки.',
        'Отзыв согласия не распространяется на данные, которые Оператор обязан хранить по закону (например, бухгалтерские и таможенные документы).',
        'После отзыва согласия оказание услуги может быть прекращено, поскольку иного способа идентификации груза не существует.',
      ],
    },
    {
      heading: '5. Передача третьим лицам',
      body: [
        'Данные передаются только в объёме, необходимом для оказания услуги: перевозчикам и таможенным брокерам; почтовым и курьерским операторам (при заказе доставки); платёжным организациям и банкам; уполномоченным государственным органам в предусмотренных законом случаях.',
        'Оператор не продаёт персональные данные и не передаёт их третьим лицам в рекламных целях.',
        'Трансграничная передача осуществляется в порядке, установленном законодательством, и только при необходимости.',
      ],
    },
    {
      heading: '6. Место и срок хранения',
      body: [
        `Место обработки данных: ${DATA_LOCATION_RU}`,
        'Трансграничная передача осуществляется на условиях статьи 27-1 Закона «О персональных данных» (в редакции от 26 марта 2026 года): равный уровень защиты данных в принимающем государстве, договорные положения, одобренные уполномоченным органом, и соблюдение международных стандартов.',
        'Категории данных, подлежащие обязательному хранению внутри страны (биометрические и генетические данные), хранятся на территории Республики Узбекистан.',
        'Данные хранятся в течение срока оказания услуги и далее в течение срока, установленного законодательством.',
        'По истечении срока данные удаляются либо обезличиваются.',
      ],
    },
    {
      heading: '7. Меры безопасности',
      body: [
        'Данные шифруются при передаче и хранении, доступ к системе ограничен ролевой моделью прав.',
        'Доступ сотрудников ограничен служебной необходимостью и журналируется.',
        'При нарушении безопасности данных Оператор уведомляет уполномоченный орган и затронутых пользователей в установленном законом порядке.',
      ],
    },
    {
      heading: '8. Ваши права',
      body: [
        'В соответствии со статьёй 30 Закона ЗРУ-547 вы имеете право:',
        'получать сведения о факте обработки ваших данных;',
        'знакомиться со своими данными и получать их копию;',
        'требовать уточнения неточных или неполных данных;',
        'требовать блокирования или удаления данных;',
        'отозвать своё согласие;',
        'обратиться в уполномоченный государственный орган или в суд, если считаете свои права нарушенными.',
        'Обращения рассматриваются в течение 30 дней (ЗРУ-547, статья 31).',
      ],
    },
    {
      heading: '9. Несовершеннолетние',
      body: [
        'Сервис предназначен для лиц, достигших 18 лет.',
        'Данные несовершеннолетних не собираются намеренно без согласия законного представителя. При выявлении такого случая данные удаляются.',
      ],
    },
    {
      heading: '10. Технические данные и аналитика',
      body: [
        'Для работы приложения в памяти браузера сохраняются сессия и настройки (язык, тема). Эти данные остаются на вашем устройстве.',
        'Статистика использования может собираться в обезличенном, агрегированном виде.',
      ],
    },
    {
      heading: '11. Изменения политики',
      body: [
        'Оператор вправе вносить изменения в настоящую политику. Новая редакция вступает в силу с момента публикации в Приложении.',
        'О существенных изменениях пользователи уведомляются через Приложение.',
      ],
    },
    {
      heading: '12. Контакты',
      body: [
        `Вопросы по персональным данным: ${LEGAL_COMPANY.telegramHandle}`,
        `Телефон: ${LEGAL_COMPANY.supportPhoneDisplay}`,
        `Организация: ${LEGAL_COMPANY.operator}`,
      ],
    },
  ],
};

// ─────────────────────────────────────────────────── FOYDALANISH SHARTLARI

const TERMS_UZ: LegalDocument = {
  title: 'Foydalanish shartlari',
  subtitle: 'Mandarin Cargo ilovasidan foydalanish qoidalari',
  updatedLabel: UPDATED_UZ,
  sections: [
    {
      heading: '1. Umumiy qoidalar',
      body: [
        'Ushbu shartlar Mandarin Cargo Telegram Mini App ilovasidan va uning veb-versiyasidan foydalanish tartibini belgilaydi.',
        'Ilovadan foydalanish orqali siz ushbu shartlarga, Ommaviy ofertaga va Maxfiylik siyosatiga rozilik bildirasiz.',
        'Ilova Telegram platformasi orqali ishlaydi. Telegram xizmatidan foydalanish uning o‘z qoidalari bilan tartibga solinadi.',
      ],
    },
    {
      heading: '2. Akkaunt va ro‘yxatdan o‘tish',
      body: [
        'Ro‘yxatdan o‘tish uchun haqiqiy shaxsiy ma’lumotlar va amaldagi telefon raqami talab qilinadi.',
        'Bitta shaxs uchun bitta akkaunt ochiladi. Bir necha akkaunt ochish yoki boshqa shaxs nomidan ro‘yxatdan o‘tish taqiqlanadi.',
        'Ariza Operator tomonidan ko‘rib chiqiladi va tasdiqlangandan so‘ng sizga noyob Mijoz kodi beriladi.',
        'Akkauntingizga kirish imkoniyatining xavfsizligi uchun siz javobgarsiz. Akkauntdan ruxsatsiz foydalanilgani aniqlansa, darhol qo‘llab-quvvatlash xizmatiga xabar bering.',
      ],
    },
    {
      heading: '3. Mijoz kodi va trek-kodlar',
      body: [
        'Mijoz kodi — Xitoydagi omborda yukingizni aniqlashning yagona usuli. Uni to‘g‘ri va faqat o‘z yuklaringiz uchun ishlating.',
        'O‘z Mijoz kodini uchinchi shaxslarga berish oqibatlari uchun siz javobgarsiz.',
        'Trek-kod bo‘yicha ma’lumot uchinchi shaxslardan kelib tushadi va kechikishi yoki to‘liq bo‘lmasligi mumkin.',
      ],
    },
    {
      heading: '4. To‘lovlar va hamyon',
      body: [
        'Ilova orqali onlayn to‘lov NBU to‘lov shlyuzi orqali amalga oshiriladi. To‘lov ma’lumotlari shlyuz tomonidan qayta ishlanadi.',
        'Ichki hamyon balansi xizmat haqini to‘lash uchun ishlatiladi. Balans ortiqcha to‘langan summalar va qaytarilgan mablag‘lardan shakllanadi.',
        'To‘lov bajarilgach, tegishli summa Ilovadagi hisobotda aks etadi. Nomuvofiqlik aniqlansa, 15 kun ichida qo‘llab-quvvatlash xizmatiga murojaat qiling.',
      ],
    },
    {
      heading: '5. Taqiqlangan xatti-harakatlar',
      body: [
        'Ilovaning ishlashiga xalaqit berish, avtomatlashtirilgan so‘rovlar yuborish, zaifliklardan foydalanishga urinish taqiqlanadi.',
        'Boshqa foydalanuvchilarning ma’lumotlariga ruxsatsiz kirishga urinish taqiqlanadi.',
        'Yolg‘on ma’lumot berish, soxta hujjat yuklash yoki boshqa shaxs nomidan ish ko‘rish taqiqlanadi.',
        'Ilovadan qonunga xilof maqsadlarda, jumladan taqiqlangan mahsulotlarni tashish uchun foydalanish taqiqlanadi.',
      ],
    },
    {
      heading: '6. Bildirishnomalar',
      body: [
        'Operator xizmatga oid xabarlarni (yuk holati, to‘lov, muhim o‘zgarishlar) Ilova va Telegram bot orqali yuboradi.',
        'Xizmatga oid xabarlar shartnomani bajarishning bir qismi bo‘lib, ulardan voz kechish mumkin emas.',
        'Reklama xabarlari alohida rozilik asosida yuboriladi va o‘chirilishi mumkin.',
      ],
    },
    {
      heading: '7. Intellektual mulk',
      body: [
        'Ilova, uning dizayni, dasturiy kodi, matnlari, logotipi va boshqa materiallari Operatorga tegishli va qonun bilan himoyalangan.',
        'Ularni Operatorning yozma ruxsatisiz nusxalash, tarqatish yoki hosila asar yaratish taqiqlanadi.',
      ],
    },
    {
      heading: '8. Xizmatdagi uzilishlar',
      body: [
        'Operator Ilovaning uzluksiz ishlashiga harakat qiladi, lekin texnik ishlar, yangilanishlar yoki uchinchi shaxs xizmatlaridagi nosozliklar sababli uzilishlar bo‘lishi mumkin.',
        'Rejalashtirilgan texnik ishlar to‘g‘risida imkon qadar oldindan xabar beriladi.',
        'Ilovadagi uzilish yukning jismoniy holatiga ta’sir qilmaydi va shartnoma bo‘yicha majburiyatlarni bekor qilmaydi.',
      ],
    },
    {
      heading: '9. Akkauntni bloklash va o‘chirish',
      body: [
        'Operator ushbu shartlar buzilgan taqdirda akkauntni vaqtincha bloklash yoki bekor qilishga haqli.',
        'Akkaunt bloklangan taqdirda ham allaqachon qabul qilingan yuklar bo‘yicha majburiyatlar bajariladi.',
        'Siz akkauntingizni o‘chirishni so‘rashingiz mumkin. Qonun bo‘yicha saqlanishi shart bo‘lgan ma’lumotlar belgilangan muddat davomida saqlanib qoladi.',
      ],
    },
    {
      heading: '10. Javobgarlik cheklovlari',
      body: [
        'Ilova «bor holicha» taqdim etiladi. Operator Ilovaning uzluksiz va xatosiz ishlashini kafolatlamaydi.',
        'Operator uchinchi shaxs xizmatlaridagi (Telegram, to‘lov shlyuzi, pochta operatori) nosozliklar uchun javobgar emas.',
        'Yuk tashish bo‘yicha javobgarlik Ommaviy oferta shartlari bilan tartibga solinadi.',
      ],
    },
    {
      heading: '11. Shartlarning o‘zgarishi va qo‘llaniladigan huquq',
      body: [
        'Operator ushbu shartlarni o‘zgartirishga haqli. Yangi tahrir Ilovada e’lon qilingan paytdan kuchga kiradi.',
        'Ilovadan foydalanishni davom ettirish yangi tahrirga rozilik hisoblanadi.',
        'Ushbu shartlarga O‘zbekiston Respublikasining qonunchiligi qo‘llaniladi.',
      ],
    },
    {
      heading: '12. Aloqa',
      body: [
        `Telegram: ${LEGAL_COMPANY.telegramHandle}`,
        `Telefon: ${LEGAL_COMPANY.supportPhoneDisplay}`,
        `Veb-sayt: ${LEGAL_COMPANY.websiteDisplay}`,
      ],
    },
  ],
};

const TERMS_RU: LegalDocument = {
  title: 'Условия использования',
  subtitle: 'Правила пользования приложением Mandarin Cargo',
  updatedLabel: UPDATED_RU,
  sections: [
    {
      heading: '1. Общие положения',
      body: [
        'Настоящие условия определяют порядок использования Telegram Mini App Mandarin Cargo и его веб-версии.',
        'Пользуясь Приложением, вы соглашаетесь с настоящими условиями, Публичной офертой и Политикой конфиденциальности.',
        'Приложение работает на платформе Telegram. Использование самого Telegram регулируется его собственными правилами.',
      ],
    },
    {
      heading: '2. Аккаунт и регистрация',
      body: [
        'Для регистрации требуются достоверные персональные данные и действующий номер телефона.',
        'На одно лицо открывается один аккаунт. Создание нескольких аккаунтов или регистрация от имени другого лица запрещены.',
        'Заявка рассматривается Оператором; после подтверждения вам присваивается уникальный Код клиента.',
        'Вы отвечаете за безопасность доступа к своему аккаунту. При обнаружении несанкционированного использования немедленно сообщите в службу поддержки.',
      ],
    },
    {
      heading: '3. Код клиента и трек-коды',
      body: [
        'Код клиента — единственный способ идентификации вашего груза на складе в Китае. Указывайте его корректно и только для собственных грузов.',
        'Вы несёте ответственность за последствия передачи своего Кода клиента третьим лицам.',
        'Информация по трек-коду поступает от третьих лиц и может запаздывать или быть неполной.',
      ],
    },
    {
      heading: '4. Платежи и кошелёк',
      body: [
        'Онлайн-оплата через Приложение производится посредством платёжного шлюза НБУ. Платёжные данные обрабатываются шлюзом.',
        'Баланс внутреннего кошелька используется для оплаты услуг и формируется из переплат и возвращённых средств.',
        'После проведения платежа соответствующая сумма отражается в отчёте в Приложении. При обнаружении расхождения обратитесь в поддержку в течение 15 дней.',
      ],
    },
    {
      heading: '5. Запрещённые действия',
      body: [
        'Запрещается вмешиваться в работу Приложения, направлять автоматизированные запросы, пытаться использовать уязвимости.',
        'Запрещаются попытки несанкционированного доступа к данным других пользователей.',
        'Запрещается предоставлять ложные сведения, загружать поддельные документы или действовать от имени другого лица.',
        'Запрещается использовать Приложение в противоправных целях, в том числе для перевозки запрещённых товаров.',
      ],
    },
    {
      heading: '6. Уведомления',
      body: [
        'Оператор направляет сервисные сообщения (статус груза, платежи, важные изменения) через Приложение и Telegram-бот.',
        'Сервисные сообщения являются частью исполнения договора, и отказ от них невозможен.',
        'Рекламные сообщения направляются при отдельном согласии и могут быть отключены.',
      ],
    },
    {
      heading: '7. Интеллектуальная собственность',
      body: [
        'Приложение, его дизайн, программный код, тексты, логотип и иные материалы принадлежат Оператору и охраняются законом.',
        'Копирование, распространение и создание производных произведений без письменного разрешения Оператора запрещены.',
      ],
    },
    {
      heading: '8. Перерывы в работе сервиса',
      body: [
        'Оператор стремится обеспечить непрерывную работу Приложения, однако возможны перерывы из-за технических работ, обновлений или сбоев сторонних сервисов.',
        'О плановых работах сообщается заблаговременно, насколько это возможно.',
        'Перерыв в работе Приложения не влияет на физическое состояние груза и не отменяет обязательств по договору.',
      ],
    },
    {
      heading: '9. Блокировка и удаление аккаунта',
      body: [
        'Оператор вправе временно заблокировать или аннулировать аккаунт при нарушении настоящих условий.',
        'Даже при блокировке аккаунта обязательства по уже принятым грузам исполняются.',
        'Вы можете запросить удаление аккаунта. Данные, подлежащие хранению по закону, сохраняются в течение установленного срока.',
      ],
    },
    {
      heading: '10. Ограничение ответственности',
      body: [
        'Приложение предоставляется «как есть». Оператор не гарантирует бесперебойной и безошибочной работы.',
        'Оператор не отвечает за сбои сторонних сервисов (Telegram, платёжный шлюз, почтовый оператор).',
        'Ответственность за перевозку груза регулируется условиями Публичной оферты.',
      ],
    },
    {
      heading: '11. Изменение условий и применимое право',
      body: [
        'Оператор вправе изменять настоящие условия. Новая редакция вступает в силу с момента публикации в Приложении.',
        'Продолжение использования Приложения считается согласием с новой редакцией.',
        'К настоящим условиям применяется законодательство Республики Узбекистан.',
      ],
    },
    {
      heading: '12. Контакты',
      body: [
        `Telegram: ${LEGAL_COMPANY.telegramHandle}`,
        `Телефон: ${LEGAL_COMPANY.supportPhoneDisplay}`,
        `Сайт: ${LEGAL_COMPANY.websiteDisplay}`,
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: Record<LegalDocId, Record<LegalLang, LegalDocument>> = {
  offer: { uz: OFFER_UZ, ru: OFFER_RU },
  privacy: { uz: PRIVACY_UZ, ru: PRIVACY_RU },
  terms: { uz: TERMS_UZ, ru: TERMS_RU },
};
