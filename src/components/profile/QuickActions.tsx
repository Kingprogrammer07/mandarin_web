import { CreditCard, FilePlus, UserCog } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface QuickActionsProps {
    onWalletClick: () => void;
    onCardsClick: () => void;
    onPassportsClick: () => void;
}

export const QuickActions = memo(({ onWalletClick, onCardsClick, onPassportsClick }: QuickActionsProps) => {
    const { t } = useTranslation();

    return (
        <div className="grid grid-cols-3 gap-3 px-4 mb-6 md:mb-0 md:px-0 md:max-w-none md:gap-4 max-w-lg mx-auto md:mx-0">
            <ActionButton
                icon={<CreditCard className="h-6 w-6 text-orange-600 dark:text-orange-400" />}
                label={t('profile.quickActions.payments')}
                onClick={onWalletClick}
                delay={0.1}
                bgColor="bg-orange-100 dark:bg-orange-500/20"
            />
            <ActionButton
                icon={<FilePlus className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />}
                label={t('profile.quickActions.addPassport')}
                onClick={onPassportsClick}
                delay={0.2}
                bgColor="bg-emerald-100 dark:bg-emerald-500/20"
            />
            <ActionButton
                icon={<UserCog className="h-6 w-6 text-gray-600 dark:text-gray-400" />}
                label={t('profile.quickActions.myCards')}
                onClick={onCardsClick}
                delay={0.3}
                bgColor="bg-gray-100 dark:bg-gray-500/20"
            />
        </div>
    );
});
QuickActions.displayName = 'QuickActions';

interface ActionButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    delay: number;
    bgColor: string;
}

const ActionButton = memo(({ icon, label, onClick, delay, bgColor }: ActionButtonProps) => {
    return (
        <button
            className="
                group relative flex flex-col items-center justify-center p-3 h-28 md:h-32 w-full 
                rounded-3xl transition-all duration-300
                bg-white dark:bg-white/5 
                border-2 border-transparent dark:border-white/10
                shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none
                hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:bg-white/10
                active:scale-95 active:shadow-inner
            "
            onClick={onClick}
            style={{ animationDelay: `${delay}s` }}
        >
            <div className={`
                w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center mb-3 
                transition-transform duration-300 group-hover:scale-110 group-active:scale-90
                ${bgColor}
            `}>
                {icon}
            </div>

            <span className="text-xs md:text-sm font-bold text-gray-800 dark:text-gray-200 tracking-wide">
                {label}
            </span>
        </button>
    );
});
ActionButton.displayName = 'ActionButton';
