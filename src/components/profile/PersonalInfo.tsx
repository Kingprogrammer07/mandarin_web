import { motion } from 'framer-motion';
import { FileText, CreditCard, MapPin, Calendar, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type ProfileResponse } from '@/types/profile';

interface PersonalInfoProps {
    user: ProfileResponse;
}

export const PersonalInfo = ({ user }: PersonalInfoProps) => {
    const { t } = useTranslation();

    const items = [
        { label: t('profile.personalInfo.passport'), value: user.passport_series, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        { label: t('profile.personalInfo.pinfl'), value: user.pinfl, icon: CreditCard, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
        { label: t('profile.personalInfo.dateOfBirth'), value: user.date_of_birth, icon: Calendar, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
        { label: t('profile.personalInfo.region'), value: user.region, icon: MapPin, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
        { label: t('profile.personalInfo.district'), value: user.district ? user.district : t('profile.personalInfo.notAvailable'), icon: MapPin, color: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-900/20' },
        { label: t('profile.personalInfo.address'), value: user.address, icon: MapPin, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
        { label: t('profile.personalInfo.referrals'), value: t('profile.personalInfo.referralCount', { count: user.referral_count }), icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    ];



    return (
        <div className="mb-8 max-w-md mx-auto md:max-w-none md:mx-0 md:px-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 pl-1">
                <span className="w-1 h-4 bg-gray-500 rounded-full inline-block mr-2"></span>
                {t('profile.personalInfo.title')}
            </h3>
            <div className="bg-white dark:bg-[#1e1a45] rounded-3xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
                <div className="divide-y divide-gray-100 dark:divide-white/5 md:divide-y-0 md:grid md:grid-cols-2 md:gap-x-4 md:gap-y-0">
                    {items.map((item, idx) => (
                        <motion.div
                            key={item.label}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 + 0.2 }}
                            className="p-4 flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors md:rounded-xl"
                            onClick={() => {
                                if (item.label !== t('profile.personalInfo.referrals')) {
                                    navigator.clipboard.writeText(item.value || '');
                                }
                            }}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2.5 rounded-xl ${item.bg} ${item.color}`}>
                                    <item.icon size={18} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs md:text-sm text-gray-400 font-medium">{item.label}</span>
                                    <span className="text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100">{item.value || t('profile.personalInfo.notAvailable')}</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};
