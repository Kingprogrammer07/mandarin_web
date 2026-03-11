import { useState, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    Upload, Loader2, CreditCard, CheckCircle, AlertCircle, Wallet,
    Copy, Check, X, Plane, Calendar, ChevronDown, ArrowDownToLine,
    Receipt, Bell, TrendingDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletService, type PaymentReminderItem } from '@/api/services/walletService';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import MakePaymentModal from '@/components/modals/MakePaymentModal';

interface WalletModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabKey = 'reminders' | 'pay-debt' | 'refund';

// --- Reminder Card (reused from old PaymentReminders) ---
const ReminderCard = memo(({ reminder, idx, onPay }: { reminder: PaymentReminderItem; idx: number; onPay: (flightName: string) => void }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { t } = useTranslation();

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07, duration: 0.35 }}
        >
            <Card
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                    "relative overflow-hidden border-0 shadow-sm bg-white dark:bg-white/5 dark:border-white/5 transition-all cursor-pointer group",
                    isExpanded ? "ring-2 ring-red-500/20 shadow-lg" : "hover:shadow-md"
                )}
            >
                <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-1 transition-colors duration-300",
                    isExpanded ? "bg-red-500" : "bg-gray-300 dark:bg-gray-700 group-hover:bg-red-400"
                )} />

                <CardContent className="p-4 pl-5">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                                <Plane className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                                    {reminder.flight}
                                </h4>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                                    {t('profile.payments.cargoPayment', "Kargo to'lovi")}
                                </p>
                            </div>
                        </div>
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="text-gray-400">
                            <ChevronDown className="w-4 h-4" />
                        </motion.div>
                    </div>

                    <div className="mt-3 flex justify-between items-end">
                        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:border-white/10 dark:text-gray-400 gap-1 py-0.5 px-2 text-[11px]">
                            <Calendar className="w-3 h-3" />
                            {reminder.deadline}
                        </Badge>
                        <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">{t('profile.payments.remaining', "Qoldiq")}</span>
                            <span className="text-base font-black text-red-600 dark:text-red-500">
                                {reminder.remaining.toLocaleString()} so'm
                            </span>
                        </div>
                    </div>

                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.25, ease: "easeInOut" }}
                                className="overflow-hidden"
                            >
                                <div className="pt-3 mt-3 border-t border-dashed border-gray-100 dark:border-white/10 space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">{t('profile.payments.totalCharged', "Jami")}</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">{reminder.total.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">{t('profile.payments.totalPaid', "To'langan")}</span>
                                        <span className="font-semibold text-green-600 dark:text-green-400">{reminder.paid.toLocaleString()}</span>
                                    </div>
                                    <div className="pt-2">
                                        <Button
                                            className="w-full rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 h-10 font-semibold"
                                            onClick={(e) => { e.stopPropagation(); onPay(reminder.flight); }}
                                        >
                                            <CreditCard className="w-4 h-4 mr-2" />
                                            {t('profile.payments.payNow', "Hozir to'lash")}
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>
        </motion.div>
    );
});
ReminderCard.displayName = 'ReminderCard';

// --- Main WalletModal ---
export function WalletModal({ isOpen, onClose }: WalletModalProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [refundAmount, setRefundAmount] = useState('');
    const [selectedCardId, setSelectedCardId] = useState<string>('');
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<TabKey>('reminders');
    const [paymentFlight, setPaymentFlight] = useState<string | null>(null);

    // Fetch balance (new schema)
    const { data: walletData, isLoading: isBalanceLoading } = useQuery({
        queryKey: ['walletBalance'],
        queryFn: walletService.getWalletBalance,
        enabled: isOpen,
    });

    const walletBalance = walletData?.wallet_balance ?? 0;
    const debt = walletData?.debt ?? 0;
    const hasDebt = debt < 0;
    const reminders = walletData?.reminders ?? [];

    // Fetch active company card ONLY if debt exists
    const { data: activeCard, isLoading: isActiveCardLoading } = useQuery({
        queryKey: ['activeCompanyCard'],
        queryFn: walletService.getActiveCompanyCard,
        enabled: isOpen && hasDebt,
    });

    const { data: cardsData } = useQuery({
        queryKey: ['walletCards'],
        queryFn: walletService.getWalletCards,
        enabled: isOpen,
    });

    // Mutations
    const getErrorMessage = (error: unknown, fallback: string) => {
        if (typeof error === 'object' && error !== null) {
            const e = error as { message?: string; data?: { detail?: string } };
            return e.data?.detail ?? e.message ?? fallback;
        }
        return fallback;
    };

    const payDebtMutation = useMutation({
        mutationFn: walletService.payDebt,
        onSuccess: () => {
            toast.success(t('wallet.modal.receiptSent', "To'lov cheki yuborildi"));
            queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
            handleClose();
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, t('wallet.modal.errorOccurred', "Xatolik yuz berdi")));
        }
    });

    // Temporarily disabled — will be re-enabled when refund feature goes live
    // const refundMutation = useMutation({
    //     mutationFn: walletService.requestRefund,
    //     onSuccess: () => {
    //         toast.success(t('wallet.modal.refundSent'));
    //         queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
    //         handleClose();
    //     },
    //     onError: (error: unknown) => {
    //         toast.error(getErrorMessage(error, t('wallet.modal.errorOccurred')));
    //     }
    // });

    const canRefund = walletBalance >= 5000;

    const handleClose = () => {
        setFile(null);
        setRefundAmount('');
        setSelectedCardId('');
        setPaymentFlight(null);
        onClose();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            const allowedTypes = [
                "image/jpeg", "image/jpg", "image/png", "image/webp",
                "image/heic", "image/heif", "application/pdf",
            ];
            const isHeic = selectedFile.name.toLowerCase().endsWith('.heic') || selectedFile.name.toLowerCase().endsWith('.heif');
            if (!allowedTypes.includes(selectedFile.type) && !isHeic) {
                toast.error(t('wallet.modal.formatError', "Faqat rasm (JPG, PNG, HEIC) yoki PDF formatidagi fayllarni yuklang."));
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
            const maxSize = 10 * 1024 * 1024;
            if (selectedFile.size > maxSize) {
                toast.error(t('wallet.modal.sizeError', "Fayl hajmi 10MB dan oshmasligi kerak."));
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
            setFile(selectedFile);
        }
    };

    const handlePayDebt = () => {
        if (!file) return;
        const formData = new FormData();
        formData.append('receipt', file);
        payDebtMutation.mutate(formData);
    };

    // Temporarily disabled — will be re-enabled when refund feature goes live
    // const handleRefund = () => {
    //     if (!refundAmount || !selectedCardId) return;
    //     refundMutation.mutate({
    //         amount: Number(refundAmount),
    //         card_id: Number(selectedCardId)
    //     });
    // };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success(t('wallet.modal.copiedState', "Karta raqami nusxalandi"));
        setTimeout(() => setCopied(false), 2000);
    };

    // Build available tabs
    const tabs: { key: TabKey; label: string; icon: React.ReactNode; count?: number }[] = [];
    if (reminders.length > 0) {
        tabs.push({ key: 'reminders', label: t('wallet.tabs.reminders'), icon: <Bell className="w-4 h-4" />, count: reminders.length });
    }
    if (hasDebt) {
        tabs.push({ key: 'pay-debt', label: t('wallet.tabs.payDebt'), icon: <Receipt className="w-4 h-4" /> });
    }
    if (walletBalance > 0) {
        tabs.push({ key: 'refund', label: t('wallet.tabs.refund'), icon: <ArrowDownToLine className="w-4 h-4" /> });
    }

    // Default to first available tab
    const resolvedTab = tabs.find(tab => tab.key === activeTab) ? activeTab : (tabs[0]?.key ?? 'reminders');

    if (typeof document === 'undefined') return null;

    const modalContent = (
        <>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={handleClose}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        {/* Modal / Bottom Sheet */}
                        <motion.div
                            initial={{ y: '100%', opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className={cn(
                                "relative w-full max-h-[92vh] flex flex-col",
                                "bg-gray-50 dark:bg-[#0d0a04]",
                                "rounded-t-3xl md:rounded-3xl",
                                "md:max-w-lg md:mx-4",
                                "shadow-2xl border border-white/10",
                                "overflow-hidden"
                            )}
                        >
                            {/* Drag Handle (mobile) */}
                            <div className="md:hidden flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
                            </div>

                            {/* Header with close */}
                            <div className="flex items-center justify-between px-5 pt-3 pb-2 md:pt-5">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {t('wallet.modal.title', "Moliyaviy markaz")}
                                </h2>
                                <button
                                    onClick={handleClose}
                                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                    aria-label="Close"
                                >
                                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                </button>
                            </div>

                            {/* Scrollable content */}
                            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-8 space-y-5">

                                {/* Loading state */}
                                {isBalanceLoading ? (
                                    <div className="flex flex-col items-center justify-center py-16">
                                        <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-4" />
                                        <p className="text-gray-500 dark:text-gray-400 text-sm">{t('wallet.modal.loading', "Ma'lumotlar yuklanmoqda...")}</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Metric Cards */}
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Available Balance */}
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 0.1 }}
                                                className="relative overflow-hidden rounded-2xl bg-white dark:bg-white/5 border border-emerald-100 dark:border-emerald-500/10 p-4 shadow-sm"
                                            >
                                                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-[3rem] pointer-events-none" />
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-500/10 rounded-lg">
                                                        <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                    </div>
                                                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                        {t('wallet.modal.availableBalance', "Balans")}
                                                    </span>
                                                </div>
                                                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                                                    {walletBalance.toLocaleString()}
                                                </p>
                                                <p className="text-[10px] text-gray-400 font-medium">so'm</p>
                                            </motion.div>

                                            {/* Debt */}
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 0.15 }}
                                                className="relative overflow-hidden rounded-2xl bg-white dark:bg-white/5 border border-red-100 dark:border-red-500/10 p-4 shadow-sm"
                                            >
                                                <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-[3rem] pointer-events-none" />
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="p-1.5 bg-red-100 dark:bg-red-500/10 rounded-lg">
                                                        <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                                                    </div>
                                                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                        {t('wallet.modal.activeDebt', "Qarz")}
                                                    </span>
                                                </div>
                                                <p className={cn(
                                                    "text-xl font-black tracking-tight",
                                                    hasDebt ? "text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-500"
                                                )}>
                                                    {hasDebt ? Math.abs(debt).toLocaleString() : '0'}
                                                </p>
                                                <p className="text-[10px] text-gray-400 font-medium">so'm</p>
                                            </motion.div>
                                        </div>

                                        {/* Warning text */}
                                        {walletData?.warning_text && (
                                            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-xl p-3 flex items-start gap-2.5">
                                                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                                <p className="text-xs text-amber-700 dark:text-amber-300">{walletData.warning_text.replace(/<\/?b>/g, ' ').replace(/⚠/g, '').trim()}</p>
                                            </div>
                                        )}

                                        {/* Tabs */}
                                        {tabs.length > 0 && (
                                            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                                {tabs.map((tab) => (
                                                    <button
                                                        key={tab.key}
                                                        onClick={() => setActiveTab(tab.key)}
                                                        className={cn(
                                                            "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all",
                                                            resolvedTab === tab.key
                                                                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md"
                                                                : "bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10"
                                                        )}
                                                    >
                                                        {tab.icon}
                                                        {tab.label}
                                                        {tab.count != null && (
                                                            <span className={cn(
                                                                "ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                                                resolvedTab === tab.key
                                                                    ? "bg-white/20 text-white dark:bg-gray-900/20 dark:text-gray-900"
                                                                    : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                                                            )}>
                                                                {tab.count}
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Tab Content */}
                                        <AnimatePresence mode="wait">
                                            {/* --- REMINDERS TAB --- */}
                                            {resolvedTab === 'reminders' && reminders.length > 0 && (
                                                <motion.div
                                                    key="reminders"
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 10 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="space-y-3"
                                                >
                                                    {reminders.map((reminder, idx) => (
                                                        <ReminderCard
                                                            key={`${reminder.flight}-${idx}`}
                                                            reminder={reminder}
                                                            idx={idx}
                                                            onPay={setPaymentFlight}
                                                        />
                                                    ))}
                                                </motion.div>
                                            )}

                                            {/* --- PAY DEBT TAB --- */}
                                            {resolvedTab === 'pay-debt' && hasDebt && (
                                                <motion.div
                                                    key="pay-debt"
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 10 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="space-y-4"
                                                >
                                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                                                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                                                        <div>
                                                            <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
                                                                {t('wallet.modal.debtExists', "Qarzdorlik mavjud")}
                                                            </h3>
                                                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                                                {t('wallet.modal.debtMessage', "Sizda {{amount}} so'm qarzdorlik mavjud. Iltimos, quyidagi kartaga to'lov qiling va chekni yuklang.", { amount: Math.abs(debt).toLocaleString() })}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Active Company Card */}
                                                    {isActiveCardLoading ? (
                                                        <div className="h-40 w-full bg-gray-100 dark:bg-white/5 animate-pulse rounded-xl" />
                                                    ) : activeCard ? (
                                                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-900 via-blue-900 to-blue-800 p-5 text-white shadow-xl">
                                                            <div className="absolute top-0 right-0 h-40 w-40 translate-x-12 translate-y-[-2rem] rounded-full bg-white/10 blur-3xl" />
                                                            <div className="absolute bottom-0 left-0 h-32 w-32 translate-x-[-2rem] translate-y-12 rounded-full bg-blue-400/20 blur-2xl" />
                                                            <div className="relative z-10">
                                                                <div className="flex justify-between items-start mb-5">
                                                                    <div className="h-8 w-12 rounded bg-white/20 backdrop-blur-sm" />
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="text-white hover:bg-white/20 hover:text-white"
                                                                        onClick={() => copyToClipboard(activeCard.card_number)}
                                                                    >
                                                                        {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                                                                        {copied ? t('wallet.modal.copySuccess', "Nusxalandi") : t('wallet.modal.copyAction', "Nusxalash")}
                                                                    </Button>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <p className="text-xs text-blue-200 uppercase mb-1">{t('wallet.cards.cardNumber', "Karta raqami")}</p>
                                                                        <p className="font-mono text-lg tracking-widest truncate">{activeCard.card_number.replace(/(\d{4})/g, '$1 ').trim()}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-blue-200 uppercase mb-1">{t('wallet.cards.cardHolder', "Egasi")}</p>
                                                                        <p className="font-medium uppercase tracking-wide truncate">{activeCard.holder_name}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center p-6 border border-dashed rounded-xl bg-white dark:bg-white/5 border-gray-200 dark:border-gray-800">
                                                            <AlertCircle className="h-10 w-10 text-orange-500 mx-auto mb-3" />
                                                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('wallet.modal.paymentPaused', "To'lov qabul qilish vaqtincha to'xtatilgan")}</h4>
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                                {t('wallet.modal.noActiveCard', "Hozirda faol karta mavjud emas.")}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {activeCard && (
                                                        <>
                                                            <div className="space-y-3">
                                                                <Label className="text-sm font-semibold">{t('wallet.modal.uploadReceipt', "To'lov chekini yuklash")}</Label>
                                                                <div
                                                                    onClick={() => fileInputRef.current?.click()}
                                                                    className={cn(
                                                                        "border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors",
                                                                        file
                                                                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10"
                                                                            : "border-gray-200 hover:border-orange-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5"
                                                                    )}
                                                                >
                                                                    <input
                                                                        type="file"
                                                                        ref={fileInputRef}
                                                                        onChange={handleFileChange}
                                                                        accept="image/*,application/pdf"
                                                                        className="hidden"
                                                                    />
                                                                    {file ? (
                                                                        <>
                                                                            <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                                                                            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{file.name}</p>
                                                                            <p className="text-xs text-emerald-500 mt-1">{t('wallet.modal.clickToChange', "O'zgartirish uchun bosing")}</p>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Upload className="h-7 w-7 text-gray-400 mb-2" />
                                                                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('wallet.modal.clickToSelect', "Chekni tanlash uchun bosing")}</p>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <Button
                                                                onClick={handlePayDebt}
                                                                disabled={!file || payDebtMutation.isPending}
                                                                className="w-full h-12 text-base rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg shadow-red-500/20"
                                                            >
                                                                {payDebtMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                                                                {t('wallet.modal.sendReceipt', "Chekni yuborish")}
                                                            </Button>
                                                        </>
                                                    )}
                                                </motion.div>
                                            )}

                                            {/* --- REFUND TAB (Coming Soon) --- */}
                                            {resolvedTab === 'refund' && (
                                                <motion.div
                                                    key="refund"
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 0.8, x: 0 }}
                                                    exit={{ opacity: 0, x: 10 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="space-y-4"
                                                >
                                                    {/* Coming Soon notice */}
                                                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700/30 rounded-xl p-4 flex items-start gap-3">
                                                        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                                                        <div>
                                                            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">{t('wallet.modal.comingSoon')}</h3>
                                                        </div>
                                                    </div>

                                                    {canRefund ? (
                                                        <>
                                                            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-xl p-4 flex items-start gap-3">
                                                                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                                                                <div>
                                                                    <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{t('wallet.modal.sufficientFunds')}</h3>
                                                                    <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                                                                        {t('wallet.modal.refundAvailable', { amount: walletBalance.toLocaleString() })}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-3 pointer-events-none">
                                                                <div className="space-y-2">
                                                                    <Label className="text-sm font-semibold">{t('wallet.modal.refundAmount')}</Label>
                                                                    <div className="relative">
                                                                        <Input
                                                                            type="number"
                                                                            value={refundAmount}
                                                                            onChange={(e) => setRefundAmount(e.target.value)}
                                                                            placeholder="0"
                                                                            max={walletBalance}
                                                                            disabled
                                                                            className="pl-4 pr-12 h-12 text-lg rounded-xl"
                                                                        />
                                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">so'm</span>
                                                                    </div>
                                                                    <p className="text-xs text-gray-500 text-right">{t('wallet.modal.maxAmount', { amount: walletBalance.toLocaleString() })}</p>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <Label className="text-sm font-semibold">{t('wallet.modal.selectCard')}</Label>
                                                                    <Select value={selectedCardId} onValueChange={setSelectedCardId} disabled>
                                                                        <SelectTrigger className="h-12 w-full rounded-xl">
                                                                            <SelectValue placeholder={t('wallet.modal.selectCard')} />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {cardsData?.cards.length === 0 ? (
                                                                                <div className="p-2 text-sm text-center text-gray-500">{t('wallet.modal.noCardsAvailable')}</div>
                                                                            ) : (
                                                                                cardsData?.cards.map((card) => (
                                                                                    <SelectItem key={card.id} value={String(card.id)}>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <CreditCard className="h-4 w-4 text-gray-500" />
                                                                                            <span>{card.masked_number}</span>
                                                                                            <span className="text-xs text-gray-400">({card.holder_name})</span>
                                                                                        </div>
                                                                                    </SelectItem>
                                                                                ))
                                                                            )}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>

                                                            <Button
                                                                disabled
                                                                className="w-full h-12 text-base rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 cursor-not-allowed"
                                                            >
                                                                {t('wallet.modal.sendRequest')} (Coming Soon)
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center py-8 text-center">
                                                            <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                                                <Wallet className="h-8 w-8 text-gray-400" />
                                                            </div>
                                                            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{t('wallet.modal.insufficientBalance')}</h3>
                                                            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto">
                                                                {t('wallet.modal.minBalanceRequired', { amount: walletBalance.toLocaleString() })}
                                                            </p>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Fallback: No tabs available (no debt, no balance, no reminders) */}
                                        {tabs.length === 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="flex flex-col items-center justify-center py-8 text-center"
                                            >
                                                <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                                                </div>
                                                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                                                    {t('wallet.modal.allClear', "Hammasi yaxshi!")}
                                                </h3>
                                                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto">
                                                    {t('wallet.modal.noActions', "Hozircha hech qanday amal talab qilinmaydi.")}
                                                </p>
                                            </motion.div>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Payment Modal for reminders — renders on top without closing WalletModal */}
            <MakePaymentModal
                isOpen={!!paymentFlight}
                onClose={() => {
                    setPaymentFlight(null);
                    queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
                }}
                preselectedFlightName={paymentFlight}
            />
        </>
    );

    return createPortal(modalContent, document.body);
}
