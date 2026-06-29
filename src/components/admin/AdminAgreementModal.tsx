import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Check } from "lucide-react";

/**
 * One-time admin agreement.
 *
 * Shown ONCE (persisted in localStorage, versioned) after an admin authenticates,
 * over any admin page. The admin must read the responsibility terms — including
 * that they are personally liable for any financial or other mistake they make by
 * their own hand — tick the checkbox, and continue. Available in Uzbek / Russian /
 * English (the app itself only ships uz+ru i18n, so the agreement carries its own
 * three-language copy with a language switcher).
 *
 * Bump `AGREEMENT_VERSION` whenever the terms change to re-prompt every admin.
 */

const AGREEMENT_VERSION = "v1";
const STORAGE_KEY = `admin_agreement_accepted_${AGREEMENT_VERSION}`;

type Lang = "uz" | "ru" | "en";

interface AgreementCopy {
  langLabel: string;
  title: string;
  subtitle: string;
  intro: string;
  points: string[];
  consent: string;
  accept: string;
}

const COPY: Record<Lang, AgreementCopy> = {
  uz: {
    langLabel: "O'zbekcha",
    title: "Admin kelishuvi",
    subtitle: "Davom etishdan oldin shartlarni o'qing va qabul qiling",
    intro:
      "Admin panelidan foydalanish orqali siz quyidagi shartlarga rozilik bildirasiz:",
    points: [
      "Men admin sifatida mijozlar va moliyaviy ma'lumotlarga kirish huquqiga ega ekanligimni tushunaman.",
      "O'z qo'lim bilan kiritgan, tahrirlagan, tasdiqlagan yoki o'chirgan har qanday moliyaviy yoki boshqa xatolik (noto'g'ri summa, noto'g'ri tahrir, noto'g'ri zayafka, noto'g'ri o'chirish va h.k.) uchun shaxsan javobgar bo'laman.",
      "Har bir amalim — kim, qachon, qaysi qurilmadan va qanday ma'lumot bilan bajargani — audit jurnaliga yozilishini tushunaman va roziman.",
      "Login ma'lumotlarimni (PIN, passkey) hech kimga bermayman va maxfiy saqlayman.",
      "Saqlash yoki tasdiqlashdan oldin ma'lumotlarning to'g'riligini tekshiraman.",
      "Qoidalarni buzish yoki suiiste'mol qilish hisob bloklanishiga va qonuniy javobgarlikka olib kelishi mumkin.",
    ],
    consent: "Yuqoridagilarni o'qib chiqdim va barcha shartlarga roziman.",
    accept: "Roziman va davom etaman",
  },
  ru: {
    langLabel: "Русский",
    title: "Соглашение администратора",
    subtitle: "Перед продолжением прочитайте и примите условия",
    intro:
      "Используя админ-панель, вы соглашаетесь со следующими условиями:",
    points: [
      "Я понимаю, что как администратор имею доступ к данным клиентов и финансовой информации.",
      "Я несу личную ответственность за любую финансовую или иную ошибку (неверная сумма, неверное редактирование, неверная заявка, неверное удаление и т. д.), допущенную мной собственноручно.",
      "Я понимаю и согласен(на), что каждое моё действие — кто, когда, с какого устройства и с какими данными — записывается в журнал аудита.",
      "Я не передаю свои данные для входа (PIN, passkey) третьим лицам и храню их в тайне.",
      "Перед сохранением или подтверждением я проверяю правильность данных.",
      "Нарушение правил или злоупотребление может привести к блокировке аккаунта и юридической ответственности.",
    ],
    consent: "Я прочитал(а) вышеизложенное и согласен(на) со всеми условиями.",
    accept: "Согласен и продолжить",
  },
  en: {
    langLabel: "English",
    title: "Administrator Agreement",
    subtitle: "Please read and accept the terms before continuing",
    intro: "By using the admin panel, you agree to the following terms:",
    points: [
      "I understand that, as an administrator, I have access to client data and financial information.",
      "I take personal responsibility for any financial or other error (wrong amount, wrong edit, wrong delivery request, wrong deletion, etc.) that I make by my own hand.",
      "I understand and agree that each of my actions — who, when, from which device and with what data — is written to the audit log.",
      "I will not share my login credentials (PIN, passkey) with anyone and will keep them confidential.",
      "I will verify that the data is correct before saving or confirming.",
      "Breaking the rules or misuse may lead to account suspension and legal liability.",
    ],
    consent: "I have read the above and agree to all terms.",
    accept: "Agree and continue",
  },
};

interface AdminAgreementModalProps {
  /** Re-evaluated when these change (login / navigation) — values themselves unused. */
  currentPage: string;
  userRole: string | null;
}

export default function AdminAgreementModal({
  currentPage,
}: AdminAgreementModalProps) {
  const { i18n } = useTranslation();
  const [accepted, setAccepted] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) === "1",
  );
  const [checked, setChecked] = useState(false);
  const [lang, setLang] = useState<Lang>(() =>
    i18n.language === "ru" ? "ru" : i18n.language === "en" ? "en" : "uz",
  );

  // Show only for an authenticated admin, never on the login screen itself.
  const adminToken = localStorage.getItem("access_token");
  const adminRole = localStorage.getItem("admin_role");
  const shouldShow =
    !accepted &&
    !!adminToken &&
    !!adminRole &&
    currentPage !== "admin-login";

  const copy = useMemo(() => COPY[lang], [lang]);

  if (!shouldShow) return null;

  const handleAccept = () => {
    if (!checked) return;
    localStorage.setItem(STORAGE_KEY, "1");
    setAccepted(true);
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      >
        <motion.div
          initial={{ y: "100%", opacity: 0.6 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="w-full sm:max-w-lg max-h-[94vh] flex flex-col bg-white dark:bg-[#111] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-100 dark:border-white/[0.06]">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/25">
                <ShieldCheck className="w-6 h-6 text-white" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <h2 className="text-[17px] font-bold text-gray-900 dark:text-white leading-tight">
                  {copy.title}
                </h2>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {copy.subtitle}
                </p>
              </div>
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

          {/* Scrollable terms */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-3">
              {copy.intro}
            </p>
            <ul className="space-y-2.5">
              {copy.points.map((point, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[11px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Consent + accept */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 dark:border-white/[0.06] space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setChecked((v) => !v)}
              className="w-full flex items-start gap-3 text-left"
            >
              <span
                className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                  checked
                    ? "bg-orange-500 border-orange-500"
                    : "border-gray-300 dark:border-white/20"
                }`}
              >
                {checked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              </span>
              <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300 leading-snug">
                {copy.consent}
              </span>
            </button>

            <button
              type="button"
              onClick={handleAccept}
              disabled={!checked}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-[15px] font-bold shadow-lg shadow-orange-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copy.accept}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
