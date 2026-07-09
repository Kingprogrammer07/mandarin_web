import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ShieldCheck, X } from "lucide-react";

/**
 * Privacy Policy + User Agreement for END USERS (Telegram Mini App).
 *
 * Shown/linked from registration (required consent) and login. Self-contained
 * three-language copy (Uzbek / Russian / English) with a switcher, so it renders
 * correctly regardless of the app's active i18n language. Purely presentational —
 * consent state is owned by the caller (registration checkbox).
 *
 * The company should keep the "contact" line accurate and bump LAST_UPDATED when
 * the terms change.
 */

export const PRIVACY_POLICY_VERSION = "2026-07-09";

// Operator / support contact — language-independent, shown as clickable links.
const OPERATOR = "Triton Supply Chain";
const SUPPORT_TG_URL = "https://t.me/mandarin_admin";
const SUPPORT_TG_HANDLE = "@mandarin_admin";
const SUPPORT_PHONE_DISPLAY = "+998 55 500 34 44";
const SUPPORT_PHONE_TEL = "+998555003444";
const WEBSITE_DISPLAY = "mandarincargo.uz";
const WEBSITE_URL = "https://mandarincargo.uz";

type Lang = "uz" | "ru" | "en";

interface Section {
  heading: string;
  body: string[];
}

interface PolicyCopy {
  langLabel: string;
  title: string;
  subtitle: string;
  updatedLabel: string;
  sections: Section[];
  contactHeading: string;
  operatorLabel: string;
  close: string;
}

const COPY: Record<Lang, PolicyCopy> = {
  uz: {
    langLabel: "O'zbekcha",
    title: "Maxfiylik siyosati va Foydalanuvchi kelishuvi",
    subtitle: "Mandarin Cargo — Xitoydan O'zbekistonga yuk yetkazish xizmati",
    updatedLabel: "Oxirgi yangilanish: 2026-yil 9-iyul",
    sections: [
      {
        heading: "1. Umumiy ma'lumot",
        body: [
          "Mandarin Cargo — «Triton Supply Chain» kompaniyasi tomonidan taqdim etiladigan, Xitoydan O'zbekistonga yuk yetkazish bo'yicha Telegram Mini App xizmati (keyingi o'rinlarda «biz»). Ushbu hujjat qanday shaxsiy ma'lumotlarni yig'ishimizni, ulardan qanday foydalanishimizni va sizning huquqlaringizni tushuntiradi.",
          "Ro'yxatdan o'tish yoki tizimga kirish orqali siz ushbu Maxfiylik siyosati va Foydalanuvchi kelishuviga rozilik bildirasiz.",
        ],
      },
      {
        heading: "2. Biz yig'adigan ma'lumotlar",
        body: [
          "Shaxsni tasdiqlash: F.I.Sh, tug'ilgan sana, pasport seriyasi, JSHSHIR (PINFL) va pasport rasmlari.",
          "Aloqa: telefon raqami, manzil, viloyat va tuman.",
          "Telegram identifikatori: Telegram ID, username va ism (Telegram orqali).",
          "Yuk va moliyaviy ma'lumotlar: yuklaringiz, tranzaksiyalar tarixi, to'lovlar, hamyon balansi va mijoz kodi.",
          "To'lov kartasi: NBU to'lov shlyuzi orqali faqat xavfsiz TOKEN ko'rinishida. Karta raqamining to'liq ma'lumotini biz saqlamaymiz.",
          "Texnik ma'lumotlar: qurilma, sessiya va IP manzil (faqat xavfsizlik va suiiste'molni oldini olish uchun).",
        ],
      },
      {
        heading: "3. Ma'lumotlardan foydalanish maqsadi",
        body: [
          "Shaxsingizni tasdiqlash — yuk qabul qilish va bojxona rasmiylashtiruvi uchun qonuniy talab.",
          "Yuklarni qabul qilish, kuzatish va yetkazib berish.",
          "To'lovlarni amalga oshirish va moliyaviy hisob-kitob.",
          "Sizga xabarnomalar yuborish va qo'llab-quvvatlash.",
          "Qonun hujjatlari talablariga (bojxona, soliq) rioya qilish.",
        ],
      },
      {
        heading: "4. Ma'lumotlarni uchinchi tomonlarga berish",
        body: [
          "To'lov shlyuzi (NBU) — to'lovlarni amalga oshirish uchun.",
          "Yetkazib berish hamkorlari (UzPost va boshqalar) — yukni manzilga yetkazish uchun.",
          "Telegram — ilova ishlaydigan platforma sifatida.",
          "Davlat organlari — faqat qonun talab qilgan hollarda (bojxona, soliq, sud).",
          "Biz sizning shaxsiy ma'lumotlaringizni hech kimga SOTMAYMIZ va reklama uchun uchinchi tomonlarga bermaymiz.",
        ],
      },
      {
        heading: "5. Saqlash va xavfsizlik",
        body: [
          "Ma'lumotlar shifrlangan holda xavfsiz serverlarda saqlanadi.",
          "Karta ma'lumotlari to'g'ridan-to'g'ri NBU tomonidan tokenlashtiriladi — biz to'liq karta raqamiga ega bo'lmaymiz.",
          "Ruxsatsiz kirishning oldini olish uchun texnik va tashkiliy choralar qo'llaymiz.",
        ],
      },
      {
        heading: "6. Saqlash muddati",
        body: [
          "Ma'lumotlaringiz hisobingiz faol bo'lgan davrda, shuningdek qonun bilan belgilangan muddat (moliyaviy va bojxona hujjatlari) davomida saqlanadi.",
        ],
      },
      {
        heading: "7. Sizning huquqlaringiz",
        body: [
          "Ma'lumotlaringizni ko'rish va ular nusxasini so'rash.",
          "Noto'g'ri ma'lumotlarni tuzatish.",
          "Hisobingiz va ma'lumotlaringizni o'chirishni so'rash (qonuniy saqlash muddati bundan mustasno).",
          "Rozilikni qaytarib olish — bu holda xizmatdan foydalanish to'xtatilishi mumkin.",
          "Huquqlaringizdan foydalanish uchun qo'llab-quvvatlash bo'limiga murojaat qiling.",
        ],
      },
      {
        heading: "8. Foydalanuvchi kelishuvi (rozilik)",
        body: [
          "Men kiritgan barcha ma'lumotlar to'g'ri va menga tegishli ekanligini tasdiqlayman.",
          "Men yuk yetkazish va to'lov qoidalariga roziman.",
          "Men xizmatdan faqat qonuniy maqsadlarda foydalanaman.",
          "Men 18 yoshdan katta yoki qonuniy vakilim ruxsati bilan foydalanaman.",
        ],
      },
      {
        heading: "9. O'zgartirishlar",
        body: [
          "Ushbu siyosat vaqti-vaqti bilan yangilanishi mumkin. Muhim o'zgarishlar haqida ilova orqali xabar beramiz. Yangilanishdan keyin xizmatdan foydalanishni davom ettirish yangi shartlarga rozilik hisoblanadi.",
        ],
      },
    ],
    contactHeading: "Bog'lanish",
    operatorLabel: "Operator",
    close: "Yopish",
  },
  ru: {
    langLabel: "Русский",
    title: "Политика конфиденциальности и Пользовательское соглашение",
    subtitle: "Mandarin Cargo — доставка грузов из Китая в Узбекистан",
    updatedLabel: "Последнее обновление: 9 июля 2026 г.",
    sections: [
      {
        heading: "1. Общие сведения",
        body: [
          "Mandarin Cargo — сервис доставки грузов из Китая в Узбекистан, работающий через Telegram Mini App, предоставляемый компанией «Triton Supply Chain» (далее «мы»). Этот документ объясняет, какие персональные данные мы собираем, как их используем и какие у вас есть права.",
          "Регистрируясь или входя в систему, вы соглашаетесь с настоящей Политикой конфиденциальности и Пользовательским соглашением.",
        ],
      },
      {
        heading: "2. Какие данные мы собираем",
        body: [
          "Идентификация: Ф.И.О., дата рождения, серия паспорта, ПИНФЛ и фото паспорта.",
          "Контакты: номер телефона, адрес, область и район.",
          "Идентификатор Telegram: Telegram ID, username и имя (через Telegram).",
          "Грузовые и финансовые данные: ваши грузы, история транзакций, платежи, баланс кошелька и код клиента.",
          "Платёжная карта: только в виде безопасного ТОКЕНА через платёжный шлюз NBU. Полный номер карты мы не храним.",
          "Технические данные: устройство, сессия и IP-адрес (только для безопасности и предотвращения злоупотреблений).",
        ],
      },
      {
        heading: "3. Цели использования данных",
        body: [
          "Подтверждение личности — требование закона для приёма груза и таможенного оформления.",
          "Приём, отслеживание и доставка грузов.",
          "Проведение платежей и финансовый учёт.",
          "Отправка уведомлений и поддержка.",
          "Соблюдение требований законодательства (таможня, налоги).",
        ],
      },
      {
        heading: "4. Передача данных третьим лицам",
        body: [
          "Платёжный шлюз (NBU) — для проведения платежей.",
          "Партнёры по доставке (UzPost и др.) — для доставки груза по адресу.",
          "Telegram — как платформа, на которой работает приложение.",
          "Государственные органы — только когда этого требует закон (таможня, налоги, суд).",
          "Мы НЕ продаём ваши персональные данные и не передаём их третьим лицам для рекламы.",
        ],
      },
      {
        heading: "5. Хранение и безопасность",
        body: [
          "Данные хранятся в зашифрованном виде на защищённых серверах.",
          "Данные карты токенизируются непосредственно на стороне NBU — мы не получаем полный номер карты.",
          "Мы применяем технические и организационные меры для защиты от несанкционированного доступа.",
        ],
      },
      {
        heading: "6. Срок хранения",
        body: [
          "Ваши данные хранятся в течение срока действия учётной записи, а также в течение срока, установленного законом (финансовые и таможенные документы).",
        ],
      },
      {
        heading: "7. Ваши права",
        body: [
          "Просматривать свои данные и запрашивать их копию.",
          "Исправлять неверные данные.",
          "Запросить удаление учётной записи и данных (кроме сроков обязательного хранения).",
          "Отозвать согласие — в этом случае использование сервиса может быть прекращено.",
          "Для реализации прав обратитесь в службу поддержки.",
        ],
      },
      {
        heading: "8. Пользовательское соглашение (согласие)",
        body: [
          "Я подтверждаю, что все введённые данные верны и принадлежат мне.",
          "Я согласен(на) с правилами доставки и оплаты.",
          "Я использую сервис только в законных целях.",
          "Мне больше 18 лет или я использую сервис с разрешения законного представителя.",
        ],
      },
      {
        heading: "9. Изменения",
        body: [
          "Эта политика может периодически обновляться. О существенных изменениях мы сообщим через приложение. Продолжение использования сервиса после обновления означает согласие с новыми условиями.",
        ],
      },
    ],
    contactHeading: "Контакты",
    operatorLabel: "Оператор",
    close: "Закрыть",
  },
  en: {
    langLabel: "English",
    title: "Privacy Policy & User Agreement",
    subtitle: "Mandarin Cargo — cargo delivery from China to Uzbekistan",
    updatedLabel: "Last updated: July 9, 2026",
    sections: [
      {
        heading: "1. Overview",
        body: [
          "Mandarin Cargo (\"we\") is a China-to-Uzbekistan cargo delivery service operating through a Telegram Mini App, provided by Triton Supply Chain. This document explains what personal data we collect, how we use it, and your rights.",
          "By registering or logging in, you agree to this Privacy Policy and User Agreement.",
        ],
      },
      {
        heading: "2. Data we collect",
        body: [
          "Identity: full name, date of birth, passport series, PINFL, and passport photos.",
          "Contact: phone number, address, region, and district.",
          "Telegram identity: Telegram ID, username, and name (via Telegram).",
          "Cargo & financial data: your shipments, transaction history, payments, wallet balance, and client code.",
          "Payment card: only as a secure TOKEN via the NBU payment gateway. We do not store the full card number.",
          "Technical data: device, session, and IP address (solely for security and abuse prevention).",
        ],
      },
      {
        heading: "3. Why we use your data",
        body: [
          "To verify your identity — a legal requirement for accepting cargo and customs clearance.",
          "To accept, track, and deliver your cargo.",
          "To process payments and financial accounting.",
          "To send you notifications and provide support.",
          "To comply with legal requirements (customs, taxation).",
        ],
      },
      {
        heading: "4. Sharing with third parties",
        body: [
          "Payment gateway (NBU) — to process payments.",
          "Delivery partners (UzPost and others) — to deliver cargo to your address.",
          "Telegram — as the platform the app runs on.",
          "Government authorities — only when required by law (customs, tax, court).",
          "We do NOT sell your personal data or share it with third parties for advertising.",
        ],
      },
      {
        heading: "5. Storage & security",
        body: [
          "Data is stored encrypted on secure servers.",
          "Card data is tokenized directly by NBU — we never receive the full card number.",
          "We apply technical and organizational measures to prevent unauthorized access.",
        ],
      },
      {
        heading: "6. Retention",
        body: [
          "Your data is kept while your account is active and for the period required by law (financial and customs records).",
        ],
      },
      {
        heading: "7. Your rights",
        body: [
          "Access your data and request a copy.",
          "Correct inaccurate data.",
          "Request deletion of your account and data (subject to mandatory retention periods).",
          "Withdraw consent — after which service use may be discontinued.",
          "Contact support to exercise your rights.",
        ],
      },
      {
        heading: "8. User Agreement (consent)",
        body: [
          "I confirm that all data I provide is accurate and belongs to me.",
          "I agree to the delivery and payment rules.",
          "I will use the service only for lawful purposes.",
          "I am over 18 or use the service with a legal guardian's permission.",
        ],
      },
      {
        heading: "9. Changes",
        body: [
          "This policy may be updated from time to time. We will notify you of material changes through the app. Continued use after an update means acceptance of the new terms.",
        ],
      },
    ],
    contactHeading: "Contact",
    operatorLabel: "Operator",
    close: "Close",
  },
};

interface PrivacyPolicyModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PrivacyPolicyModal({ open, onClose }: PrivacyPolicyModalProps) {
  const { i18n } = useTranslation();
  const [lang, setLang] = useState<Lang>(() =>
    i18n.language === "ru" ? "ru" : i18n.language === "en" ? "en" : "uz",
  );
  const copy = useMemo(() => COPY[lang], [lang]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[10050] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-[#0a0e15] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-100 dark:border-white/[0.06]">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/25">
                  <ShieldCheck className="w-6 h-6 text-white" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[16px] font-bold text-gray-900 dark:text-white leading-tight">
                    {copy.title}
                  </h2>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {copy.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={copy.close}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Language switcher */}
              <div className="flex gap-1.5 mt-4">
                {(Object.keys(COPY) as Lang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className={`flex-1 h-9 rounded-xl text-[13px] font-semibold transition-colors ${
                      lang === l
                        ? "bg-orange-500 text-white shadow-sm"
                        : "bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/[0.1]"
                    }`}
                  >
                    {COPY[l].langLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-4">
                {copy.updatedLabel}
              </p>
              <div className="space-y-5">
                {copy.sections.map((section) => (
                  <div key={section.heading}>
                    <h3 className="text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">
                      {section.heading}
                    </h3>
                    <ul className="space-y-1.5">
                      {section.body.map((line, i) => (
                        <li
                          key={i}
                          className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed flex gap-2"
                        >
                          <span className="mt-2 w-1 h-1 rounded-full bg-orange-400 shrink-0" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-100 dark:border-white/[0.06]">
                  <h3 className="text-[13px] font-bold text-gray-900 dark:text-white mb-2">
                    {copy.contactHeading}
                  </h3>
                  <div className="space-y-1.5 text-[13px]">
                    <p className="text-gray-600 dark:text-gray-300">
                      {copy.operatorLabel}:{" "}
                      <span className="font-semibold text-gray-900 dark:text-white">{OPERATOR}</span>
                    </p>
                    <p>
                      Telegram:{" "}
                      <a
                        href={SUPPORT_TG_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-orange-600 dark:text-amber-300 hover:underline"
                      >
                        {SUPPORT_TG_HANDLE}
                      </a>
                    </p>
                    <p>
                      Tel:{" "}
                      <a
                        href={`tel:${SUPPORT_PHONE_TEL}`}
                        className="font-semibold text-orange-600 dark:text-amber-300 hover:underline"
                      >
                        {SUPPORT_PHONE_DISPLAY}
                      </a>
                    </p>
                    <p>
                      Web:{" "}
                      <a
                        href={WEBSITE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-orange-600 dark:text-amber-300 hover:underline"
                      >
                        {WEBSITE_DISPLAY}
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 dark:border-white/[0.06] pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={onClose}
                className="w-full h-11 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[14px] font-bold active:scale-[0.98] transition-transform"
              >
                {copy.close}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
