import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ScrollText, X } from 'lucide-react';
import {
  LEGAL_COMPANY,
  LEGAL_DOCUMENTS,
  LEGAL_DOC_LABELS,
  LEGAL_DOC_ORDER,
  LEGAL_LANG_LABELS,
  type LegalDocId,
  type LegalLang,
} from './legalDocuments';

interface LegalDocumentModalProps {
  open: boolean;
  onClose: () => void;
  /** Which document opens first. The others stay one tap away. */
  initialDoc?: LegalDocId;
}

/**
 * Ommaviy oferta · Maxfiylik siyosati · Foydalanish shartlari.
 *
 * All three live in one sheet rather than three separate modals: they are
 * cross-referencing parts of one agreement, and a client who wants to check a
 * liability clause should not have to close one document to find another.
 *
 * Copy lives in `legalDocuments.ts` — this file is presentation only. Consent
 * state belongs to the caller (the registration checkbox).
 */
export default function LegalDocumentModal({
  open,
  onClose,
  initialDoc = 'offer',
}: LegalDocumentModalProps) {
  const { i18n, t } = useTranslation();
  const [doc, setDoc] = useState<LegalDocId>(initialDoc);
  const [lang, setLang] = useState<LegalLang>(i18n.language === 'ru' ? 'ru' : 'uz');

  // Reopening from a different entry point should land on that document.
  // Adjusted during render rather than in an effect: an effect would paint one
  // frame of the previous document before switching.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDoc(initialDoc);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  const copy = LEGAL_DOCUMENTS[doc][lang];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[10040] flex items-end justify-center bg-black/60
                     backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: '4%', opacity: 0, scale: 0.99 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: '4%', opacity: 0, scale: 0.99 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-doc-title"
            className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-mc-xl
                       border border-mc-border bg-mc-surface shadow-2xl
                       sm:max-w-lg sm:rounded-mc-xl"
          >
            {/* Header */}
            <div className="shrink-0 border-b border-mc-border px-4 pb-3 pt-3">
              <div className="flex items-start gap-2.5">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-md
                             bg-gradient-to-br from-mc-brand to-mc-brand-strong
                             text-mc-on-brand shadow-[var(--mc-shadow-cta)]"
                  aria-hidden="true"
                >
                  <ScrollText className="h-[18px] w-[18px]" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="legal-doc-title" className="text-[15px] font-extrabold leading-tight text-mc-text">
                    {copy.title}
                  </h2>
                  <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-mc-text-2">
                    {copy.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('common.close', 'Yopish')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-mc-md
                             bg-mc-surface-2 text-mc-text-2 transition-transform active:scale-95"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>
              </div>

              {/* Document switcher — scrolls sideways rather than shrinking the
                  labels to an unreadable size on a narrow phone. */}
              <div className="mc-no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4">
                {LEGAL_DOC_ORDER.map((id) => {
                  const isActive = id === doc;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDoc(id)}
                      aria-pressed={isActive}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px]
                                  font-extrabold transition-colors duration-150 ${
                                    isActive
                                      ? 'border-mc-brand/25 bg-mc-brand-soft text-mc-brand'
                                      : 'border-mc-border bg-mc-surface-2 text-mc-text-2'
                                  }`}
                    >
                      {LEGAL_DOC_LABELS[id][lang]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-mc-text-3">{copy.updatedLabel}</p>
                <div className="flex shrink-0 gap-1">
                  {(Object.keys(LEGAL_LANG_LABELS) as LegalLang[]).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLang(l)}
                      aria-pressed={l === lang}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold
                                  transition-colors duration-150 ${
                                    l === lang
                                      ? 'bg-mc-brand text-mc-on-brand'
                                      : 'bg-mc-surface-2 text-mc-text-2'
                                  }`}
                    >
                      {LEGAL_LANG_LABELS[l]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {copy.sections.map((section) => (
                  <section key={section.heading}>
                    <h3 className="mb-1.5 text-[13px] font-extrabold text-mc-text">
                      {section.heading}
                    </h3>
                    <ul className="space-y-1.5">
                      {section.body.map((line, index) => (
                        <li
                          key={index}
                          className="flex gap-2 text-[12px] leading-relaxed text-mc-text-2"
                        >
                          <span
                            className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-mc-brand"
                            aria-hidden="true"
                          />
                          <span className="min-w-0">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>

              <p className="mt-5 text-[11px] leading-snug text-mc-text-3">
                {LEGAL_COMPANY.brand} · {LEGAL_COMPANY.operator}
              </p>
            </div>

            {/* Footer */}
            <div
              className="shrink-0 border-t border-mc-border px-4 py-3
                         pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              <button
                type="button"
                onClick={onClose}
                className="flex h-12 w-full items-center justify-center rounded-mc-md
                           bg-gradient-to-r from-mc-brand to-mc-brand-strong
                           text-[14px] font-extrabold text-mc-on-brand
                           shadow-[var(--mc-shadow-cta)] transition-transform active:scale-[0.98]"
              >
                {t('common.close', 'Yopish')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
