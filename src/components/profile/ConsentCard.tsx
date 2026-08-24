import { AlertTriangle, ChevronRight, FileCheck2, ScrollText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { triggerSoftHaptic } from '@/utils/haptics';
import {
  LEGAL_CONSENT_VERSION,
  LEGAL_DOC_LABELS,
  LEGAL_DOC_ORDER,
  type LegalDocId,
  type LegalLang,
} from '@/components/legal/legalDocuments';

interface ConsentCardProps {
  /** Version string the client accepted at registration, if it was recorded. */
  acceptedVersion?: string | null;
  /** dd.mm.yyyy — when consent was recorded. */
  acceptedAt?: string | null;
  onOpenDocument: (doc: LegalDocId) => void;
}

/**
 * "Documents you agreed to" — the three legal documents, reachable after
 * registration.
 *
 * The heading is only claimed when consent was actually recorded. Clients who
 * registered before the consent gate existed carry a null version, and telling
 * them they agreed to something the database has no record of would be a lie
 * printed on a legal screen.
 *
 * When the published documents are newer than the accepted version, the card
 * says so rather than quietly showing the new text under the old consent.
 */
export function ConsentCard({ acceptedVersion, acceptedAt, onOpenDocument }: ConsentCardProps) {
  const { t, i18n } = useTranslation();
  const lang: LegalLang = i18n.language === 'ru' ? 'ru' : 'uz';

  const hasConsent = Boolean(acceptedVersion);
  const isOutdated = hasConsent && acceptedVersion !== LEGAL_CONSENT_VERSION;

  return (
    <div className="px-4">
      <div className="overflow-hidden rounded-mc-lg border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]">
        <div className="flex items-start gap-2.5 p-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-mc-sm bg-mc-brand-soft text-mc-brand"
            aria-hidden="true"
          >
            {hasConsent ? (
              <FileCheck2 className="h-[18px] w-[18px]" strokeWidth={2} />
            ) : (
              <ScrollText className="h-[18px] w-[18px]" strokeWidth={2} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-extrabold leading-tight text-mc-text">
              {hasConsent
                ? t('profile.consent.title', 'Siz rozilik bergan hujjatlar')
                : t('profile.consent.titleNeutral', 'Huquqiy hujjatlar')}
            </h2>
            <p className="mt-0.5 text-[11px] font-medium leading-snug text-mc-text-2">
              {hasConsent && acceptedAt
                ? t('profile.consent.acceptedOn', {
                    date: acceptedAt,
                    defaultValue: '{{date}} da tasdiqlangan',
                  })
                : t('profile.consent.subtitle', 'Xizmatdan foydalanish shartlari')}
            </p>
          </div>
        </div>

        {isOutdated && (
          <div className="mx-3 mb-2 flex items-start gap-2 rounded-mc-sm border border-mc-warn/25 bg-mc-warn-soft px-2.5 py-2">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-mc-warn" strokeWidth={2} aria-hidden="true" />
            <p className="text-[11px] font-bold leading-snug text-mc-warn">
              {t(
                'profile.consent.updated',
                "Hujjatlar siz rozilik berganingizdan keyin yangilangan. Yangi tahrir bilan tanishing.",
              )}
            </p>
          </div>
        )}

        <div className="border-t border-mc-border">
          {LEGAL_DOC_ORDER.map((id, index) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                triggerSoftHaptic();
                onOpenDocument(id);
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left
                          transition-transform duration-150 active:scale-[0.99]
                          ${index > 0 ? 'border-t border-mc-border' : ''}`}
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-mc-text">
                {LEGAL_DOC_LABELS[id][lang]}
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-mc-text-3"
                strokeWidth={2}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
