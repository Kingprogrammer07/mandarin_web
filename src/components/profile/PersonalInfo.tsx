import { motion } from 'framer-motion';
import { Eye, EyeOff, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type ProfileResponse } from '@/types/profile';

interface PersonalInfoProps {
    user: ProfileResponse;
    isSensitiveVisible: boolean;
    onToggleSensitive: () => void;
}

export const PersonalInfo = ({ user, isSensitiveVisible, onToggleSensitive }: PersonalInfoProps) => {
    const { t } = useTranslation();

    const items = [
        // Passport series, PINFL and date of birth are deliberately absent.
        // `POST /auth/login` (backend auth.py:332) authenticates a client on
        // client_code + phone_number alone — no password, no OTP, and no rate
        // limit on that route — so anyone holding those two values sees this
        // screen. Identity-document fields are the ones that cannot be reissued
        // if they leak, so they are not rendered at all rather than masked
        // behind a toggle the same attacker could press.
        { label: t('profile.personalInfo.address'), value: user.address, icon: MapPin, iconText: 'LOC', sensitive: true, mask: '**************' },
        { label: t('profile.personalInfo.region'), value: user.region, icon: MapPin, sensitive: true, mask: '********' },
        { label: t('profile.personalInfo.district'), value: user.district ? user.district : t('profile.personalInfo.notAvailable'), icon: MapPin, sensitive: true, mask: '********' },
    ];

    return (
        <div className="mb-2">
            <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                    <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-mc-text">
                        <span className="inline-block h-[19px] w-1 rounded-full bg-mc-brand" />
                        {t('profile.personalInfo.title')}
                    </h3>
                    <p className="mt-0.5 text-[11px] font-medium text-mc-text-2">
                        {t('profile.personalInfo.secureHint')}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onToggleSensitive}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-mc-border bg-mc-surface-2 px-3 text-[11px] font-extrabold text-mc-brand transition-transform active:scale-95"
                >
                    {isSensitiveVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                    {isSensitiveVisible ? t('profile.personalInfo.hide') : t('profile.personalInfo.show')}
                </button>
            </div>

            <div className="overflow-hidden rounded-mc-xl border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]">
                <div className="md:grid md:grid-cols-2">
                    {items.map((item, idx) => (
                        <motion.button
                            key={item.label}
                            type="button"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.04 + 0.15 }}
                            className="flex w-full items-center gap-2.5 border-b border-mc-border p-3 text-left transition-colors last:border-b-0 md:[&:nth-child(odd)]:border-r md:[&:nth-last-child(-n+2)]:border-b-0"
                            onClick={() => {
                                if (isSensitiveVisible) {
                                    navigator.clipboard.writeText(item.value || '');
                                }
                            }}
                        >
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-mc-sm bg-mc-brand-soft text-mc-brand">
                                {item.iconText ? (
                                    <span className="text-[12px] font-extrabold">{item.iconText}</span>
                                ) : (
                                    <item.icon size={16} strokeWidth={2} />
                                )}
                            </div>
                            <div className="min-w-0">
                                <span className="block text-[13px] font-extrabold text-mc-text">
                                    {item.label}
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] font-medium text-mc-text-2">
                                    {item.sensitive && !isSensitiveVisible
                                        ? item.mask
                                        : item.value || t('profile.personalInfo.notAvailable')}
                                </span>
                            </div>
                        </motion.button>
                    ))}
                </div>
            </div>
        </div>
    );
};
