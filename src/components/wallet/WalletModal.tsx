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
    Receipt, Bell, TrendingDown, ExternalLink, Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    walletService,
    type PaymentReminderItem,
    type WalletPaymentLink,
} from '@/api/services/walletService';
import { nbuPaymentService } from '@/api/services/nbuPaymentService';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import MakePaymentModal from '@/components/modals/MakePaymentModal';
import { normalizeNumber } from '@/utils/numberFormat';

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
                    "relative overflow-hidden border-0 shadow-sm bg-mc-surface dark:border-white/5 transition-all cursor-pointer group",
                    isExpanded ? "ring-2 ring-mc-danger/20 shadow-lg" : ""
                )}
            >
                <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-1 transition-colors duration-300",
                    isExpanded ? "bg-mc-danger" : "bg-mc-surface-2 dark:bg-mc-surface-2"
                )} />

                <CardContent className="p-4 pl-5">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-mc-brand-soft dark:bg-mc-brand/10 rounded-mc-md text-mc-brand dark:text-mc-brand">
                                <Plane className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-mc-text text-base leading-tight">
                                    {reminder.flight}
                                </h4>
                                <p className="text-[11px] text-mc-text-2 font-medium mt-0.5">
                                    {t('profile.payments.cargoPayment', "Kargo to'lovi")}
                                </p>
                            </div>
                        </div>
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="text-mc-text-3">
                            <ChevronDown className="w-4 h-4" />
                        </motion.div>
                    </div>

                    <div className="mt-3 flex justify-between items-end">
                        <Badge variant="outline" className="bg-mc-surface-2 text-mc-text-2 border-mc-border dark:bg-white/5 dark:border-white/10 dark:text-mc-text-3 gap-1 py-0.5 px-2 text-[11px]">
                            <Calendar className="w-3 h-3" />
                            {reminder.deadline}
                        </Badge>
                        <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-mc-text-3 block mb-0.5">{t('profile.payments.remaining', "Qoldiq")}</span>
                            <span className="text-base font-black text-mc-danger dark:text-mc-danger">
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
                                <div className="pt-3 mt-3 border-t border-dashed border-mc-border space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-mc-text-2">{t('profile.payments.totalCharged', "Jami")}</span>
                                        <span className="font-semibold text-mc-text">{reminder.total.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-mc-text-2">{t('profile.payments.totalPaid', "To'langan")}</span>
                                        <span className="font-semibold text-mc-success">{reminder.paid.toLocaleString()}</span>
                                    </div>
                                    <div className="pt-2">
                                        <Button
                                            className="w-full rounded-mc-md bg-mc-danger-fill text-mc-on-danger shadow-lg shadow-red-500/20 h-10 font-semibold"
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

// --- Payment link brand badge + button (Click / Payme / Uzum / ...) ---
const LINK_BRANDS: Record<string, { bg: string; label: string }> = {
    click: { bg: 'linear-gradient(135deg,#00B9F1,#0088CC)', label: 'C' },
    payme: { bg: 'linear-gradient(135deg,#1AC47D,#14A868)', label: 'P' },
    uzum: { bg: 'linear-gradient(135deg,#9B27AF,#7B1FA2)', label: 'U' },
    apelsin: { bg: 'linear-gradient(135deg,#FF6B35,#E55A2B)', label: 'A' },
};

const DebtPaymentLinkButton = memo(({ link }: { link: WalletPaymentLink }) => {
    const brand = LINK_BRANDS[link.slug.toLowerCase()] ?? {
        bg: 'linear-gradient(135deg,#F59E0B,#D97706)',
        label: link.name[0]?.toUpperCase() ?? '?',
    };
    return (
        <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3.5 rounded-mc-md border border-mc-border
                bg-mc-surface
                active:scale-[0.97] transition-all"
        >
            <div
                className="w-10 h-10 rounded-mc-md flex-shrink-0 flex items-center justify-center font-black text-base text-white shadow-sm"
                style={{ background: brand.bg }}
            >
                {brand.label}
            </div>
            <span className="flex-1 font-bold text-sm text-mc-text">{link.name}</span>
            <ExternalLink className="w-4 h-4 text-mc-text-3 flex-shrink-0" />
        </a>
    );
});
DebtPaymentLinkButton.displayName = 'DebtPaymentLinkButton';

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
    // Opens the full payment wizard at flight-selection (no preselected flight) —
    // used by the "Qarzni to'lash" CTA so the user pays via the standard flow
    // (NBU / online / cash / wallet) instead of the manual receipt upload.
    const [showPayment, setShowPayment] = useState(false);

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

    // Fetch debt-payment options (active company card + payment links) — only if debt exists
    const { data: paymentOptions, isLoading: isOptionsLoading } = useQuery({
        queryKey: ['walletPaymentOptions'],
        queryFn: walletService.getPaymentOptions,
        enabled: isOpen && hasDebt,
    });
    const activeCard = paymentOptions?.active_card ?? null;
    const paymentLinks = paymentOptions?.payment_links ?? [];

    // NBU availability — drives the "pay online via a flight" bridge to the reminders
    // tab. NBU is flight-scoped, so it cannot settle a generic debt directly here.
    const { data: nbuStatus } = useQuery({
        queryKey: ['nbu-status'],
        queryFn: nbuPaymentService.getStatus,
        enabled: isOpen && hasDebt,
        staleTime: 5 * 60_000,
    });
    const nbuEnabled = nbuStatus?.enabled === true;

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
                            role="dialog"
                            aria-modal="true"
                            className={cn(
                                "relative w-full max-h-[92dvh] flex flex-col",
                                "bg-mc-surface",
                                "rounded-t-mc-xl md:rounded-mc-xl",
                                "md:max-w-lg md:mx-4",
                                "shadow-2xl border border-mc-border",
                                "overflow-hidden"
                            )}
                        >
                            {/* Drag Handle (mobile) */}
                            <div className="md:hidden flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 rounded-full bg-mc-border" />
                            </div>

                            {/* Header with close */}
                            <div className="flex items-center justify-between px-5 pt-3 pb-2 md:pt-5">
                                <h2 className="text-xl font-bold text-mc-text">
                                    {t('wallet.modal.title', "Moliyaviy markaz")}
                                </h2>
                                <button
                                    onClick={handleClose}
                                    className="p-2 rounded-full transition-colors"
                                    aria-label="Close"
                                >
                                    <X className="w-5 h-5 text-mc-text-2" />
                                </button>
                            </div>

                            {/* Scrollable content */}
                            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-8 space-y-5">

                                {/* Loading state */}
                                {isBalanceLoading ? (
                                    <div className="flex flex-col items-center justify-center py-16">
                                        <Loader2 className="h-8 w-8 animate-spin text-mc-brand mb-4" />
                                        <p className="text-mc-text-2 text-sm">{t('wallet.modal.loading', "Ma'lumotlar yuklanmoqda...")}</p>
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
                                                className="relative overflow-hidden rounded-mc-lg bg-mc-surface border border-mc-success/25 dark:border-mc-success/10 p-4 shadow-sm"
                                            >
                                                <div className="absolute top-0 right-0 w-16 h-16 bg-mc-success/10 rounded-bl-[3rem] pointer-events-none" />
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="p-1.5 bg-mc-success/12 dark:bg-mc-success/10 rounded-mc-sm">
                                                        <Wallet className="w-4 h-4 text-mc-success" />
                                                    </div>
                                                    <span className="text-[11px] font-semibold text-mc-text-2 uppercase tracking-wide">
                                                        {t('wallet.modal.availableBalance', "Balans")}
                                                    </span>
                                                </div>
                                                <p className="text-xl font-black text-mc-success tracking-tight">
                                                    {walletBalance.toLocaleString()}
                                                </p>
                                                <p className="text-[10px] text-mc-text-3 font-medium">so'm</p>
                                            </motion.div>

                                            {/* Debt */}
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 0.15 }}
                                                className="relative overflow-hidden rounded-mc-lg bg-mc-surface border border-mc-danger/25 dark:border-mc-danger/10 p-4 shadow-sm"
                                            >
                                                <div className="absolute top-0 right-0 w-16 h-16 bg-mc-danger/10 rounded-bl-[3rem] pointer-events-none" />
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="p-1.5 bg-mc-danger-soft dark:bg-mc-danger/10 rounded-mc-sm">
                                                        <TrendingDown className="w-4 h-4 text-mc-danger" />
                                                    </div>
                                                    <span className="text-[11px] font-semibold text-mc-text-2 uppercase tracking-wide">
                                                        {t('wallet.modal.activeDebt', "Qarz")}
                                                    </span>
                                                </div>
                                                <p className={cn(
                                                    "text-xl font-black tracking-tight",
                                                    hasDebt ? "text-mc-danger" : "text-mc-text-3"
                                                )}>
                                                    {hasDebt ? Math.abs(debt).toLocaleString() : '0'}
                                                </p>
                                                <p className="text-[10px] text-mc-text-3 font-medium">so'm</p>
                                            </motion.div>
                                        </div>

                                        {/* Warning text */}
                                        {walletData?.warning_text && (
                                            <div className="bg-mc-warn-soft dark:bg-mc-warn-soft border border-mc-warn/25 dark:border-mc-warn/25 rounded-mc-md p-3 flex items-start gap-2.5">
                                                <AlertCircle className="w-4 h-4 text-mc-warn mt-0.5 shrink-0" />
                                                <p className="text-xs text-mc-warn">{walletData.warning_text.replace(/<\/?b>/g, ' ').replace(/⚠/g, '').trim()}</p>
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
                                                            "flex items-center gap-1.5 px-3.5 py-2 rounded-mc-md text-[13px] font-bold whitespace-nowrap transition-colors duration-150 active:scale-[0.97]",
                                                            resolvedTab === tab.key
                                                                ? "border border-mc-brand/25 bg-mc-brand-soft text-mc-brand"
                                                                : "border border-mc-border bg-mc-surface-2 text-mc-text-2"
                                                        )}
                                                    >
                                                        {tab.icon}
                                                        {tab.label}
                                                        {tab.count != null && (
                                                            <span className={cn(
                                                                "ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                                                resolvedTab === tab.key
                                                                    ? "bg-mc-danger-fill text-mc-on-danger"
                                                                    : "bg-mc-danger-soft text-mc-danger"
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
                                                    <div className="bg-mc-danger-soft dark:bg-mc-danger-soft border border-mc-danger/25 dark:border-mc-danger/30 rounded-mc-md p-4 flex items-start gap-3">
                                                        <AlertCircle className="h-5 w-5 text-mc-danger mt-0.5 shrink-0" />
                                                        <div>
                                                            <h3 className="text-sm font-semibold text-mc-danger dark:text-mc-danger">
                                                                {t('wallet.modal.debtExists', "Qarzdorlik mavjud")}
                                                            </h3>
                                                            <p className="text-sm text-mc-danger mt-1">
                                                                {t('wallet.modal.debtMessage', "Sizda {{amount}} so'm qarzdorlik mavjud. Iltimos, quyidagi kartaga to'lov qiling va chekni yuklang.", { amount: Math.abs(debt).toLocaleString() })}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Primary CTA — pay through the full wizard (pick a flight →
                                                        NBU / online / cash / wallet) instead of the manual receipt upload. */}
                                                    <button
                                                        onClick={() => setShowPayment(true)}
                                                        className="w-full flex items-center justify-center gap-2 h-12 rounded-mc-md
                                                            bg-gradient-to-r from-mc-danger to-mc-danger
                                                            text-mc-on-danger font-bold text-[15px] shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all"
                                                    >
                                                        <CreditCard className="w-5 h-5" />
                                                        {t('wallet.modal.payDebtCta', "Qarzni to'lash")}
                                                    </button>

                                                    {!isOptionsLoading && (activeCard || paymentLinks.length > 0) && (
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1 h-px bg-mc-surface-2" />
                                                            <span className="text-[11px] font-medium text-mc-text-3">
                                                                {t('wallet.modal.orManually', "yoki qo'lda")}
                                                            </span>
                                                            <div className="flex-1 h-px bg-mc-surface-2" />
                                                        </div>
                                                    )}

                                                    {/* Debt-payment methods: links + card. NBU is flight-scoped → bridge to reminders. */}
                                                    {isOptionsLoading ? (
                                                        <div className="h-40 w-full bg-mc-surface-2 animate-pulse rounded-mc-md" />
                                                    ) : (!activeCard && paymentLinks.length === 0) ? (
                                                        <div className="text-center p-6 border border-dashed rounded-mc-md bg-mc-surface border-mc-border dark:border-mc-border">
                                                            <AlertCircle className="h-10 w-10 text-mc-brand mx-auto mb-3" />
                                                            <h4 className="text-sm font-semibold text-mc-text dark:text-mc-text">{t('wallet.modal.paymentPaused', "To'lov qabul qilish vaqtincha to'xtatilgan")}</h4>
                                                            <p className="text-sm text-mc-text-2 mt-1">
                                                                {t('wallet.modal.noPaymentMethods', "Hozirda faol to'lov usuli mavjud emas.")}
                                                            </p>
                                                            {nbuEnabled && reminders.length > 0 && (
                                                                <button
                                                                    onClick={() => setActiveTab('reminders')}
                                                                    className="mt-3 text-sm font-semibold text-mc-brand"
                                                                >
                                                                    {t('wallet.modal.payViaFlightNbu', "Online karta (NBU) bilan reys to'lovini qiling →")}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {/* NBU bridge — NBU needs a flight, so send the user to the reminders tab */}
                                                            {nbuEnabled && reminders.length > 0 && (
                                                                <button
                                                                    onClick={() => setActiveTab('reminders')}
                                                                    className="w-full flex items-center justify-between p-3.5 rounded-mc-md border border-mc-brand/20 dark:border-mc-brand/20 bg-mc-brand-soft dark:bg-mc-brand/5 transition-colors text-left"
                                                                >
                                                                    <div className="flex items-center gap-2.5">
                                                                        <div className="w-9 h-9 rounded-mc-sm bg-mc-surface flex items-center justify-center shrink-0">
                                                                            <CreditCard className="w-4 h-4 text-mc-brand" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-sm font-bold text-mc-text">{t('wallet.modal.payOnlineCard', "Online karta orqali to'lash")}</p>
                                                                            <p className="text-[11px] text-mc-text-2">{t('wallet.modal.payOnlineCardHint', "Eslatmalardan reysni tanlang")}</p>
                                                                        </div>
                                                                    </div>
                                                                    <ChevronDown className="w-4 h-4 text-mc-brand -rotate-90 shrink-0" />
                                                                </button>
                                                            )}

                                                            {/* Active payment links (Click, Payme, Uzum, ...) */}
                                                            {paymentLinks.length > 0 && (
                                                                <div className="space-y-2">
                                                                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                                                                        <Link2 className="w-4 h-4 text-mc-text-3" />
                                                                        {t('wallet.modal.paymentLinks', "To'lov havolalari")}
                                                                    </Label>
                                                                    {paymentLinks.map((link) => (
                                                                        <DebtPaymentLinkButton key={link.slug} link={link} />
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Manual transfer: active company card + receipt upload */}
                                                            {activeCard && (
                                                                <>
                                                                    <div className="relative overflow-hidden rounded-mc-lg bg-gradient-to-br from-mc-cardface to-mc-cardface-2 p-5 text-white shadow-[var(--mc-shadow-card)]">
                                                                        <div className="absolute top-0 right-0 h-40 w-40 translate-x-12 translate-y-[-2rem] rounded-full bg-white/10 blur-3xl" />
                                                                        <div className="absolute bottom-0 left-0 h-32 w-32 translate-x-[-2rem] translate-y-12 rounded-full bg-mc-brand-soft blur-2xl" />
                                                                        <div className="relative z-10">
                                                                            <div className="flex justify-between items-start mb-5">
                                                                                <div className="h-8 w-12 rounded bg-white/20 backdrop-blur-sm" />
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="text-white"
                                                                                    onClick={() => copyToClipboard(activeCard.card_number)}
                                                                                >
                                                                                    {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                                                                                    {copied ? t('wallet.modal.copySuccess', "Nusxalandi") : t('wallet.modal.copyAction', "Nusxalash")}
                                                                                </Button>
                                                                            </div>
                                                                            <div className="space-y-3">
                                                                                <div>
                                                                                    <p className="text-xs text-mc-brand uppercase mb-1">{t('wallet.cards.cardNumber', "Karta raqami")}</p>
                                                                                    <p className="font-mono text-lg tracking-widest truncate">{activeCard.card_number.replace(/(\d{4})/g, '$1 ').trim()}</p>
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-xs text-mc-brand uppercase mb-1">{t('wallet.cards.cardHolder', "Egasi")}</p>
                                                                                    <p className="font-medium uppercase tracking-wide truncate">{activeCard.holder_name}</p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        <Label className="text-sm font-semibold">{t('wallet.modal.uploadReceipt', "To'lov chekini yuklash")}</Label>
                                                                        <div
                                                                            onClick={() => fileInputRef.current?.click()}
                                                                            className={cn(
                                                                                "border-2 border-dashed rounded-mc-md p-5 flex flex-col items-center justify-center cursor-pointer transition-colors",
                                                                                file
                                                                                    ? "border-mc-success bg-mc-success/12 dark:bg-mc-success/12"
                                                                                    : "border-mc-border dark:border-mc-border"
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
                                                                                    <CheckCircle className="h-8 w-8 text-mc-success mb-2" />
                                                                                    <p className="text-sm font-medium text-mc-success dark:text-mc-success">{file.name}</p>
                                                                                    <p className="text-xs text-mc-success mt-1">{t('wallet.modal.clickToChange', "O'zgartirish uchun bosing")}</p>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <Upload className="h-7 w-7 text-mc-text-3 mb-2" />
                                                                                    <p className="text-sm font-medium text-mc-text-2">{t('wallet.modal.clickToSelect', "Chekni tanlash uchun bosing")}</p>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <Button
                                                                        onClick={handlePayDebt}
                                                                        disabled={!file || payDebtMutation.isPending}
                                                                        className="w-full h-12 text-base rounded-mc-md bg-mc-danger-fill text-mc-on-danger shadow-lg shadow-red-500/20"
                                                                    >
                                                                        {payDebtMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                                                                        {t('wallet.modal.sendReceipt', "Chekni yuborish")}
                                                                    </Button>
                                                                </>
                                                            )}
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
                                                    <div className="bg-mc-brand-soft dark:bg-mc-brand-soft border border-mc-brand/20 dark:border-mc-brand/25 rounded-mc-md p-4 flex items-start gap-3">
                                                        <AlertCircle className="h-5 w-5 text-mc-brand dark:text-mc-brand mt-0.5 shrink-0" />
                                                        <div>
                                                            <h3 className="text-sm font-semibold text-mc-brand dark:text-mc-brand">{t('wallet.modal.comingSoon')}</h3>
                                                        </div>
                                                    </div>

                                                    {canRefund ? (
                                                        <>
                                                            <div className="bg-mc-success/12 dark:bg-mc-success/12 border border-mc-success/25 dark:border-mc-success/30 rounded-mc-md p-4 flex items-start gap-3">
                                                                <CheckCircle className="h-5 w-5 text-mc-success mt-0.5 shrink-0" />
                                                                <div>
                                                                    <h3 className="text-sm font-semibold text-mc-success dark:text-mc-success">{t('wallet.modal.sufficientFunds')}</h3>
                                                                    <p className="text-sm text-mc-success mt-1">
                                                                        {t('wallet.modal.refundAvailable', { amount: walletBalance.toLocaleString() })}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-3 pointer-events-none">
                                                                <div className="space-y-2">
                                                                    <Label className="text-sm font-semibold">{t('wallet.modal.refundAmount')}</Label>
                                                                    <div className="relative">
                                                                        <Input
                                                                            type="text"
                                                                            inputMode="decimal"
                                                                            value={refundAmount}
                                                                            onChange={(e) => {
                                                                                const normalized = normalizeNumber(e.target.value);
                                                                                if (normalized !== null) setRefundAmount(normalized);
                                                                            }}
                                                                            placeholder="0"
                                                                            max={walletBalance}
                                                                            disabled
                                                                            className="pl-4 pr-12 h-12 text-lg rounded-mc-md"
                                                                        />
                                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-mc-text-2 text-sm font-medium">so'm</span>
                                                                    </div>
                                                                    <p className="text-xs text-mc-text-2 text-right">{t('wallet.modal.maxAmount', { amount: walletBalance.toLocaleString() })}</p>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <Label className="text-sm font-semibold">{t('wallet.modal.selectCard')}</Label>
                                                                    <Select value={selectedCardId} onValueChange={setSelectedCardId} disabled>
                                                                        <SelectTrigger className="h-12 w-full rounded-mc-md">
                                                                            <SelectValue placeholder={t('wallet.modal.selectCard')} />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {cardsData?.cards.length === 0 ? (
                                                                                <div className="p-2 text-sm text-center text-mc-text-2">{t('wallet.modal.noCardsAvailable')}</div>
                                                                            ) : (
                                                                                cardsData?.cards.map((card) => (
                                                                                    <SelectItem key={card.id} value={String(card.id)}>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <CreditCard className="h-4 w-4 text-mc-text-2" />
                                                                                            <span>{card.masked_number}</span>
                                                                                            <span className="text-xs text-mc-text-3">({card.holder_name})</span>
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
                                                                className="w-full h-12 text-base rounded-mc-md bg-mc-success text-mc-on-success shadow-lg shadow-emerald-500/20 cursor-not-allowed"
                                                            >
                                                                {t('wallet.modal.sendRequest')} (Coming Soon)
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center py-8 text-center">
                                                            <div className="w-16 h-16 bg-mc-surface-2 rounded-full flex items-center justify-center mb-4">
                                                                <Wallet className="h-8 w-8 text-mc-text-3" />
                                                            </div>
                                                            <h3 className="text-base font-semibold text-mc-text mb-2">{t('wallet.modal.insufficientBalance')}</h3>
                                                            <p className="text-mc-text-2 text-sm max-w-xs mx-auto">
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
                                                <div className="w-16 h-16 bg-mc-surface-2 rounded-full flex items-center justify-center mb-4">
                                                    <CheckCircle className="h-8 w-8 text-mc-success" />
                                                </div>
                                                <h3 className="text-base font-semibold text-mc-text mb-2">
                                                    {t('wallet.modal.allClear', "Hammasi yaxshi!")}
                                                </h3>
                                                <p className="text-mc-text-2 text-sm max-w-xs mx-auto">
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

            {/* Payment Modal — renders on top without closing WalletModal. Opened
                either with a preselected flight (reminders) or at flight-selection
                (the "Qarzni to'lash" CTA → showPayment). */}
            <MakePaymentModal
                isOpen={!!paymentFlight || showPayment}
                onClose={() => {
                    setPaymentFlight(null);
                    setShowPayment(false);
                    queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
                    queryClient.invalidateQueries({ queryKey: ['walletPaymentOptions'] });
                }}
                preselectedFlightName={paymentFlight}
            />
        </>
    );

    return createPortal(modalContent, document.body);
}
