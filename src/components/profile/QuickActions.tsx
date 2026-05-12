import { CreditCard, FilePlus, UserCog } from 'lucide-react';
import type { ReactNode } from 'react';
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
        <div className="mx-auto mb-6 grid w-full max-w-md gap-2.5 md:mb-0 md:max-w-none">
            <ActionButton
                icon={<CreditCard className="h-[18px] w-[18px]" />}
                label={t('profile.quickActions.payments')}
                description={t('profile.quickActions.paymentsDesc')}
                onClick={onWalletClick}
            />
            <ActionButton
                icon={<FilePlus className="h-[18px] w-[18px]" />}
                label={t('profile.quickActions.addPassport')}
                description={t('profile.quickActions.addPassportDesc')}
                onClick={onPassportsClick}
            />
            <ActionButton
                icon={<UserCog className="h-[18px] w-[18px]" />}
                label={t('profile.quickActions.myCards')}
                description={t('profile.quickActions.myCardsDesc')}
                onClick={onCardsClick}
            />
        </div>
    );
});
QuickActions.displayName = 'QuickActions';

interface ActionButtonProps {
    icon: ReactNode;
    label: string;
    description: string;
    onClick: () => void;
}

const ActionButton = memo(({ icon, label, description, onClick }: ActionButtonProps) => {
    return (
        <button
            className="group flex min-h-[64px] w-full items-center gap-3 rounded-[18px] border border-gray-900/[0.07] bg-white/92 px-3.5 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:bg-white active:scale-[0.98] dark:border-white/[0.085] dark:bg-[#0a0e15]/86 dark:shadow-none dark:hover:bg-white/[0.045]"
            onClick={onClick}
        >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-orange-500/10 text-orange-500 transition-transform duration-200 group-hover:scale-[1.03] dark:bg-white/[0.055] dark:text-amber-300">
                {icon}
            </div>

            <div className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-black leading-tight text-gray-950 dark:text-[#fff8ed]">
                    {label}
                </span>
                <span className="mt-1 block truncate text-[10px] font-bold text-gray-500 dark:text-[#fff8ed]/52">
                    {description}
                </span>
            </div>
        </button>
    );
});
ActionButton.displayName = 'ActionButton';
