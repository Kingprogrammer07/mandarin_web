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
        <div className="relative mb-24 md:mb-20 bg-transparent">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="
                    bg-gradient-to-br from-[#1e1a45] via-[#2a2356] to-[#0f0c29] 
                    dark:from-[#0f0c29] dark:via-[#1a1638] dark:to-black 
                    pt-25 pb-24 md:pt-12 md:pb-12 px-6 
                    rounded-b-[3rem] md:rounded-[2.5rem] 
                    shadow-xl text-white text-center relative transform-gpu 
                    border-2 border-white/20 dark:border-white/10
                    overflow-hidden
                "
                style={{ willChange: 'transform, opacity' }}
            >
                <div
                    className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-purple-600/20 rounded-full blur-[60px] pointer-events-none"
                    style={{ willChange: 'transform' }}
                />
                <div
                    className="absolute bottom-[-50px] left-[-50px] w-56 h-56 bg-blue-600/20 rounded-full blur-[60px] pointer-events-none"
                    style={{ willChange: 'transform' }}
                />

                <div className="relative z-10 flex flex-col items-center">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, type: "spring" }}
                        className="relative mb-4 group"
                        style={{ willChange: 'transform, opacity' }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-tr from-orange-400 to-amber-600 rounded-full blur-md opacity-70 transition-opacity"></div>
                        <Avatar className="w-28 h-28 md:w-24 md:h-24 border-4 border-[#1e1a45] dark:border-black shadow-2xl relative z-10">
                            <AvatarImage src={user.avatar_url} alt={user.full_name} className="object-cover" />
                            <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-orange-400 to-amber-600 text-white">
                                {user.full_name?.charAt(0) || 'M'}
                            </AvatarFallback>
                        </Avatar>
                    </motion.div>

                    <h1 className="text-3xl md:text-2xl font-bold tracking-tight mb-1 text-white">
                        {user.full_name}
                    </h1>
                    <span className="text-white/80 text-xs font-medium tracking-wide">{t('profile.hero.registeredDate', { date: user.created_at })}</span>
                    <div
                        className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full backdrop-blur-md border border-white/10 cursor-pointer hover:bg-white/20 transition-colors mt-2"
                        onClick={handleCopyId}
                    >
                        <span className="text-white/80 text-sm font-medium tracking-wide">ID: {displayCode}</span>
                        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-white/60" />}
                    </div>
                </div>
            </motion.div>

            {/* Floating Balance Card */}
            <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 100 }}
                className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md z-20 pointer-events-none"
                style={{ willChange: 'transform, opacity' }}
            >
                <div
                    onClick={onBalanceClick}
                    className="bg-white/80 dark:bg-black/80 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] rounded-2xl p-6 relative overflow-hidden pointer-events-auto cursor-pointer hover:scale-[1.03] active:scale-95 transition-transform duration-200"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-orange-400/20 to-amber-300/20 rounded-bl-[4rem] pointer-events-none"></div>

                    <div className="flex items-center justify-between relative z-10">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">
                                {hasDebt ? t('profile.hero.debtLabel') : t('profile.hero.balance')}
                            </p>
                            <h2 className={`text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${
                                hasDebt
                                    ? 'from-rose-500 to-red-500 dark:from-rose-400 dark:to-red-400'
                                    : 'from-emerald-600 to-green-500 dark:from-emerald-400 dark:to-green-300'
                            }`}>
                                {hasDebt && <span>-</span>}
                                <span ref={balanceRef}>{primaryValue.toLocaleString()}</span>{' '}
                                <span className="text-lg text-gray-400 font-normal">{t('profile.hero.currency')}</span>
                            </h2>
                            {hasDebt ? (
                                <div className="inline-flex items-center gap-1.5 mt-2 bg-emerald-500/10 rounded-full px-2.5 py-1">
                                    <Wallet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                        {t('profile.hero.availableLabel')}: {walletBalance.toLocaleString()} {t('profile.hero.currency')}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                        <div className={`
                            h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-colors duration-300
                            ${hasDebt
                                ? 'bg-gradient-to-br from-rose-500 to-red-500 shadow-rose-500/30'
                                : 'bg-gradient-to-br from-emerald-500 to-green-500 shadow-emerald-500/30'
                            }
                        `}>
                            <Wallet className="h-6 w-6 text-white" />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
});
ProfileHero.displayName = 'ProfileHero';
