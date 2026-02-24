import { motion, useTransform, useMotionValue, animate } from 'framer-motion';
import { Wallet, Copy, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { type ProfileResponse } from '@/types/profile';
import { useState, memo, useEffect } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { walletService } from '@/api/services/walletService';

interface ProfileHeroProps {
    user: ProfileResponse;
}

export const ProfileHero = memo(({ user }: ProfileHeroProps) => {
    const [copied, setCopied] = useState(false);

    // Fetch wallet balance
    const { data: walletData } = useQuery({
        queryKey: ['walletBalance'],
        queryFn: walletService.getWalletBalance,
        refetchInterval: 30000, // Refresh every 30s
    });

    const balance = walletData?.balance || 0;
    const isNegative = balance < 0;

    // Animation for balance
    const count = useMotionValue(0);
    const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString());

    useEffect(() => {
        const controls = animate(count, balance, { duration: 1.5, ease: "easeOut" });
        return controls.stop;
    }, [balance, count]);

    const handleCopyId = () => {
        navigator.clipboard.writeText(user.client_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("ID nusxalandi");
    };

    return (
        // Parent wrapper - transparent bg, relative positioning only
        <div className="relative mb-24 md:mb-20 bg-transparent">
            {/* Inner Hero Card - Content wrapper with gradient & rounded corners */}
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
            >
                {/* Background Blobs - Clipped by overflow-hidden */}
                <div
                    className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-purple-600/20 rounded-full blur-[60px] pointer-events-none"
                    style={{ willChange: 'transform' }}
                />
                <div
                    className="absolute bottom-[-50px] left-[-50px] w-56 h-56 bg-blue-600/20 rounded-full blur-[60px] pointer-events-none"
                    style={{ willChange: 'transform' }}
                />

                <div className="relative z-10 flex flex-col items-center">
                    {/* Avatar with Ring */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, type: "spring" }}
                        className="relative mb-4 group"
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
                    <span className="text-white/80 text-xs font-medium tracking-wide">Ro'yhatdan o'tgan sana: {user.created_at}</span>
                    <div
                        className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full backdrop-blur-md border border-white/10 cursor-pointer hover:bg-white/20 transition-colors mt-2"
                        onClick={handleCopyId}
                    >
                        <span className="text-white/80 text-sm font-medium tracking-wide">ID: {user.client_code}</span>
                        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-white/60" />}
                    </div>
                </div>
            </motion.div>

            {/* Floating Balance Card - Absolutely positioned relative to parent */}
            <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 100 }}
                className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md z-20 pointer-events-none"
            >
                <div className="bg-white/80 dark:bg-black/80 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] rounded-2xl p-6 relative overflow-hidden pointer-events-auto">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-orange-400/20 to-amber-300/20 rounded-bl-[4rem] pointer-events-none"></div>

                    <div className="flex items-center justify-between relative z-10">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Qoldiq Balans</p>
                            <h2 className={`
                                text-3xl font-bold tracking-tight bg-clip-text text-transparent
                                ${isNegative
                                    ? 'bg-gradient-to-r from-red-600 to-rose-500 dark:from-red-500 dark:to-rose-400'
                                    : 'bg-gradient-to-r from-emerald-600 to-green-500 dark:from-emerald-400 dark:to-green-300'
                                }
                            `}>
                                <motion.span>{rounded}</motion.span> <span className="text-lg text-gray-400 font-normal">so'm</span>
                            </h2>
                        </div>
                        <div className={`
                            h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-colors duration-300
                            ${isNegative
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

