import { motion, animate } from 'framer-motion';
import { Wallet, Copy, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { type ProfileResponse } from '@/types/profile';
import { useState, memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { walletService } from '@/api/services/walletService';

interface ProfileHeroProps {
    user: ProfileResponse;
    onBalanceClick?: () => void;
}

export const ProfileHero = memo(({ user, onBalanceClick }: ProfileHeroProps) => {
    const [copied, setCopied] = useState(false);
    const { t } = useTranslation();

    // Fetch wallet balance
    const { data: walletData } = useQuery({
        queryKey: ['walletBalance'],
        queryFn: walletService.getWalletBalance,
        refetchInterval: 30000,
    });

    const walletBalance = walletData?.wallet_balance ?? 0;
    const debt = walletData?.debt ?? 0;
    const hasDebt = debt < 0;
    const displayCode = user.extra_code || user.client_code;

    // The primary display value: debt (absolute) if in debt, otherwise wallet balance
    const primaryValue = hasDebt ? Math.abs(debt) : walletBalance;

    // Animation for primary number — direct DOM update to avoid re-renders
    const balanceRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!balanceRef.current) return;
        
        const controls = animate(0, primaryValue, {
            duration: 1.5,
            ease: "easeOut",
            onUpdate(value) {
                if (balanceRef.current) {
                    balanceRef.current.textContent = Math.round(value).toLocaleString();
                }
            }
        });
        
        return controls.stop;
    }, [primaryValue]);

    const handleCopyId = () => {
        navigator.clipboard.writeText(displayCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success(t('profile.hero.idCopied'));
    };

    return (
        <div className="mx-auto w-full max-w-md px-4 md:max-w-none md:px-0">
            <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="relative overflow-hidden rounded-[28px] border border-gray-100 bg-white p-[18px] shadow-[0_20px_46px_rgba(15,23,42,0.13),inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-1px_0_rgba(15,23,42,0.045)] dark:border-orange-200/16 dark:bg-[#0a0e15] dark:shadow-[0_28px_62px_rgba(0,0,0,0.48),0_0_0_1px_rgba(245,158,11,0.05),inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-1px_0_rgba(0,0,0,0.32)]"
                style={{ willChange: 'transform, opacity' }}
            >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#ffffff,#f9fafb)] dark:hidden" />
                <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(145deg,rgba(255,255,255,0.105),rgba(255,255,255,0.018)_38%,rgba(245,158,11,0.045)),#0a0e15] dark:block" />
                <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/18" />
                <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-black/45" />
                <div className="pointer-events-none absolute -right-px top-6 h-24 w-px bg-gradient-to-b from-transparent via-orange-300/22 to-transparent" />

                <div className="relative flex items-center gap-3.5">
                    <Avatar className="h-[76px] w-[76px] shrink-0 rounded-[25px] border border-black/5 shadow-none dark:border-white/[0.075]">
                        <AvatarImage src={user.avatar_url} alt={user.full_name} className="object-cover" />
                        <AvatarFallback className="rounded-[25px] bg-gradient-to-br from-orange-500 to-amber-300 text-[30px] font-black text-[#2a1704]">
                            {user.full_name?.charAt(0) || 'M'}
                        </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-[22px] font-black leading-[1.05] tracking-normal text-gray-950 dark:text-[#fff8ed]">
                            {user.full_name}
                        </h1>
                        <p className="mt-1.5 line-clamp-2 text-xs font-bold text-gray-500 dark:text-[#fff8ed]/52 max-[360px]:hidden">
                            {t('profile.hero.registeredDate', { date: user.created_at })}
                        </p>
                        <button
                            type="button"
                            className="mt-3 inline-flex h-[30px] items-center gap-1.5 rounded-full border border-orange-200/80 bg-orange-50/80 px-2.5 text-xs font-black text-orange-800 transition-colors hover:bg-orange-100 dark:border-orange-200/15 dark:bg-white/[0.055] dark:text-[#fff8ed]/78 dark:hover:bg-orange-300/[0.10]"
                            onClick={handleCopyId}
                        >
                            <span>ID: {displayCode}</span>
                            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-orange-600 dark:text-white/46" />}
                        </button>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onBalanceClick}
                    className="relative mt-[18px] w-full rounded-[22px] border border-gray-900/[0.07] bg-white/75 p-[15px] text-left transition-transform duration-200 active:scale-[0.98] dark:border-white/[0.075] dark:bg-white/[0.045]"
                >
                    <p className="mb-1.5 text-[11px] font-black uppercase text-gray-500 dark:text-[#fff8ed]/52">
                        {hasDebt ? t('profile.hero.debtLabel') : t('profile.hero.balance')}
                    </p>
                    <div className="flex items-end justify-between gap-3">
                        <h2 className={`text-[27px] font-black leading-none tracking-normal ${hasDebt ? 'text-red-500' : 'text-emerald-500'}`}>
                            {hasDebt && <span>-</span>}
                            <span ref={balanceRef}>{primaryValue.toLocaleString()}</span>{' '}
                            <span className="text-[17px] font-black">{t('profile.hero.currency')}</span>
                        </h2>
                        <div className={`grid h-[45px] w-[45px] shrink-0 place-items-center rounded-2xl text-white shadow-lg ${
                            hasDebt
                                ? 'bg-gradient-to-br from-red-500 to-orange-500 shadow-red-500/24'
                                : 'bg-gradient-to-br from-emerald-500 to-green-400 shadow-emerald-500/24'
                        }`}>
                            {hasDebt ? <span className="text-xl font-black">!</span> : <Wallet className="h-5 w-5" />}
                        </div>
                    </div>
                    {hasDebt ? (
                        <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                            {t('profile.hero.availableLabel')}: {walletBalance.toLocaleString()} {t('profile.hero.currency')}
                        </p>
                    ) : null}
                </button>
            </motion.section>
        </div>
    );
});
ProfileHero.displayName = 'ProfileHero';
