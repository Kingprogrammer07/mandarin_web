import { motion } from 'framer-motion';
import { Calendar, CreditCard, Eye, EyeOff, FileText, MapPin, Users } from 'lucide-react';
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
        { label: t('profile.personalInfo.passport'), value: user.passport_series, icon: FileText, iconText: 'ID', sensitive: true, mask: 'AB *******' },
        { label: t('profile.personalInfo.pinfl'), value: user.pinfl, icon: CreditCard, iconText: 'PIN', sensitive: true, mask: '**** **** *****' },
        { label: t('profile.personalInfo.address'), value: user.address, icon: MapPin, iconText: 'LOC', sensitive: true, mask: '**************' },
        { label: t('profile.personalInfo.dateOfBirth'), value: user.date_of_birth, icon: Calendar, sensitive: true, mask: '**.**.****' },
        { label: t('profile.personalInfo.region'), value: user.region, icon: MapPin, sensitive: true, mask: '********' },
        { label: t('profile.personalInfo.district'), value: user.district ? user.district : t('profile.personalInfo.notAvailable'), icon: MapPin, sensitive: true, mask: '********' },
        { label: t('profile.personalInfo.referrals'), value: t('profile.personalInfo.referralCount', { count: user.referral_count }), icon: Users, sensitive: false },
    ];

    const visibleItems = isSensitiveVisible ? items : items.slice(0, 3);

    return (
        <div className="mx-auto mb-8 max-w-md md:max-w-none md:mx-0 md:px-0">
            <div className="mb-2.5 ml-0.5 flex items-end justify-between gap-3">
                <div>
                    <h3 className="flex items-center gap-2 text-[16px] font-black text-gray-950 dark:text-[#fff8ed]">
                        <span className="inline-block h-[19px] w-1 rounded-full bg-orange-500" />
                        {t('profile.personalInfo.title')}
                    </h3>
                    <p className="mt-1 text-[11px] font-bold text-gray-500 dark:text-[#fff8ed]/52">
                        {t('profile.personalInfo.secureHint')}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onToggleSensitive}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-gray-900/[0.07] bg-white/80 px-3 text-[11px] font-black text-orange-600 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition-colors hover:bg-white dark:border-white/[0.085] dark:bg-white/[0.055] dark:text-amber-300 dark:shadow-none dark:hover:bg-white/[0.085]"
                >
                    {isSensitiveVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                    {isSensitiveVisible ? t('profile.personalInfo.hide') : t('profile.personalInfo.show')}
                </button>
            </div>

            <div className="overflow-hidden rounded-[22px] border border-gray-900/[0.07] bg-white/92 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/[0.085] dark:bg-[#0a0e15]/86 dark:shadow-none">
                <div className="md:grid md:grid-cols-2">
                    {visibleItems.map((item, idx) => (
                        <motion.button
                            key={item.label}
                            type="button"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.04 + 0.15 }}
                            className="flex min-h-[74px] w-full items-center gap-3 border-b border-gray-100 p-[13px] text-left transition-colors last:border-b-0 hover:bg-gray-50 dark:border-white/[0.055] dark:hover:bg-white/[0.045] md:[&:nth-child(odd)]:border-r md:[&:nth-last-child(-n+2)]:border-b-0"
                            onClick={() => {
                                if (isSensitiveVisible && item.label !== t('profile.personalInfo.referrals')) {
                                    navigator.clipboard.writeText(item.value || '');
                                }
                            }}
                        >
                            <div className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[14px] bg-white/[0.055] text-orange-500 dark:bg-white/[0.055] dark:text-amber-300">
                                {item.iconText ? (
                                    <span className="text-[14px] font-black">{item.iconText}</span>
                                ) : (
                                    <item.icon size={18} />
                                )}
                            </div>
                            <div className="min-w-0">
                                <span className="block text-[13px] font-black text-gray-950 dark:text-[#fff8ed]">
                                    {item.label}
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] font-bold text-gray-500 dark:text-[#fff8ed]/52">
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
