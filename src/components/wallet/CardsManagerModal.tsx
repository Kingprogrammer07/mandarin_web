import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Trash2, Plus, Loader2, ChevronLeft, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletService } from '@/api/services/walletService';
import { nbuPaymentService } from '@/api/services/nbuPaymentService';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface CardsManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const slideVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 300 : -300,
        opacity: 0
    }),
    center: {
        zIndex: 1,
        x: 0,
        opacity: 1
    },
    exit: (direction: number) => ({
        zIndex: 0,
        x: direction < 0 ? 300 : -300,
        opacity: 0
    })
};

export function CardsManagerModal({ isOpen, onClose }: CardsManagerModalProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [cardNumber, setCardNumber] = useState('');
    const [cardHolder, setCardHolder] = useState('');

    // Fetch refund cards (manual entry — used for refund payouts only)
    const { data: cardsData, isLoading } = useQuery({
        queryKey: ['walletCards'],
        queryFn: walletService.getWalletCards,
        enabled: isOpen,
    });

    // NBU integration probe — only render the saved-payment-cards section
    // when the gateway is actually enabled server-side.
    const { data: nbuStatus } = useQuery({
        queryKey: ['nbu-status'],
        queryFn: nbuPaymentService.getStatus,
        staleTime: 5 * 60_000,
        enabled: isOpen,
    });
    const nbuEnabled = nbuStatus?.enabled === true;

    // NBU saved cards (tokenised — for one-tap payments)
    const { data: nbuCardsData, isLoading: nbuCardsLoading } = useQuery({
        queryKey: ['nbu-cards'],
        queryFn: nbuPaymentService.listCards,
        staleTime: 60_000,
        enabled: isOpen && nbuEnabled,
    });

    const nbuBindMutation = useMutation({
        mutationFn: nbuPaymentService.bindCard,
        onSuccess: (data) => {
            const paymentUrl = data.payment_url;
            if (!paymentUrl) {
                toast.error(t('makePayment.errorOccurred', "Xatolik yuz berdi"));
                return;
            }
            if (window.Telegram?.WebApp?.openLink) {
                window.Telegram.WebApp.openLink(paymentUrl);
            } else {
                window.location.href = paymentUrl;
            }
        },
        onError: () => {
            toast.error(t('makePayment.errorOccurred', "Xatolik yuz berdi"));
        },
    });

    const nbuDeleteMutation = useMutation({
        mutationFn: nbuPaymentService.deleteCard,
        onSuccess: () => {
            toast.success(t('nbu.cards.deleteSuccess', "Karta o'chirildi"));
            queryClient.invalidateQueries({ queryKey: ['nbu-cards'] });
        },
        onError: () => {
            toast.error(t('wallet.cards.errorDelete', "Karta o'chirishda xatolik"));
        },
    });

    const handleNbuBind = () => {
        nbuBindMutation.mutate();
    };

    const handleNbuDelete = (cardId: number) => {
        if (confirm(t('nbu.cards.deleteConfirm', "Kartani o'chirasizmi?"))) {
            nbuDeleteMutation.mutate(cardId);
        }
    };

    // Mutations
    const addCardMutation = useMutation({
        mutationFn: walletService.addWalletCard,
        onSuccess: () => {
            toast.success(t('wallet.cards.successAdd', "Karta qo'shildi"));
            queryClient.invalidateQueries({ queryKey: ['walletCards'] });
            handleBack();
        },
        onError: () => {
            toast.error(t('wallet.cards.errorAdd', "Karta qo'shishda xatolik"));
        }
    });

    const deleteCardMutation = useMutation({
        mutationFn: walletService.deleteWalletCard,
        onSuccess: () => {
            toast.success(t('wallet.cards.successDelete', "Karta o'chirildi"));
            queryClient.invalidateQueries({ queryKey: ['walletCards'] });
        },
        onError: () => {
            toast.error(t('wallet.cards.errorDelete', "Karta o'chirishda xatolik"));
        }
    });

    const resetForm = () => {
        setCardNumber('');
        setCardHolder('');
    };

    const formatCardNumber = (value: string) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = (matches && matches[0]) || '';
        const parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        if (parts.length) {
            return parts.join(' ');
        } else {
            return value;
        }
    };

    const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^0-9\s]/g, '');
        if (val.length <= 19) {
            setCardNumber(formatCardNumber(val));
        }
    };

    const handleAddCard = () => {
        const rawCardNumber = cardNumber.replace(/\s/g, '');

        // Basic validation before sending
        if (!rawCardNumber || !cardHolder) {
            toast.error(t('wallet.cards.errorIncomplete', "Ma'lumotlarni to'liq kiriting"));
            return;
        }
        if (rawCardNumber.length !== 16) {
            toast.error(t('wallet.cards.errorLength', "Karta raqami 16 ta raqamdan iborat bo'lishi kerak"));
            return;
        }

        addCardMutation.mutate({
            card_number: rawCardNumber,
            holder_name: cardHolder
        });
    };

    const handleDeleteCard = (id: number) => {
        if (confirm(t('wallet.cards.confirmDelete', "Kartani o'chirishni tasdiqlaysizmi?"))) {
            deleteCardMutation.mutate(id);
        }
    };

    const handleBack = () => {
        setIsAdding(false);
        resetForm();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="top-auto bottom-0 left-0 flex h-[88svh] w-full max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-b-none rounded-t-[30px] border border-gray-900/[0.07] bg-white/96 p-0 shadow-[0_-24px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[88vh] sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[30px] sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:slide-in-from-bottom-0 dark:border-white/[0.09] dark:bg-[#0a0e15]/96 dark:shadow-[0_-24px_70px_rgba(0,0,0,0.42)]"
            >
                <div className="mx-auto mt-3 h-1.5 w-11 rounded-full bg-gray-950/10 sm:hidden dark:bg-white/14" />
                <DialogHeader className="px-5 pb-2 pt-4 text-left sm:px-6">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                        {isAdding && (
                            <Button
                                variant="ghost"
                                size="icon"
                                    className="-ml-2 h-9 w-9 shrink-0 rounded-full bg-gray-950/[0.04] text-gray-700 hover:bg-gray-950/[0.07] dark:bg-white/[0.06] dark:text-[#fff8ed]/72 dark:hover:bg-white/[0.1]"
                                onClick={handleBack}
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                        )}
                            <DialogTitle className="truncate text-[22px] font-black tracking-normal text-gray-950 dark:text-[#fff8ed]">
                                {isAdding ? t('wallet.cards.newCard', "Yangi karta") : t('wallet.cards.myCards', "Mening Kartalarim")}
                            </DialogTitle>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-10 w-10 shrink-0 rounded-full bg-gray-950/[0.04] text-gray-700 hover:bg-gray-950/[0.07] dark:bg-white/[0.06] dark:text-[#fff8ed]/72 dark:hover:bg-white/[0.1]"
                            aria-label={t('wallet.cards.cancel', "Bekor qilish")}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="relative grid flex-1 overflow-hidden px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-3 sm:px-6">
                    <AnimatePresence mode="wait" initial={false} custom={isAdding ? 1 : -1}>
                        {isAdding ? (
                            <motion.div
                                key="add-form"
                                custom={1}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="col-start-1 row-start-1 h-full w-full space-y-4 overflow-y-auto bg-transparent px-1"
                            >
                                <div className="space-y-4 pb-6">
                                    <div className="mb-6 rounded-[22px] border border-white/8 bg-gradient-to-br from-gray-950 to-gray-800 p-6 text-white shadow-xl">
                                        <div className="flex justify-between items-start mb-8">
                                            <div className="h-8 w-12 rounded bg-white/20" />
                                            <CreditCard className="h-6 w-6 text-gray-400" />
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase mb-1">{t('wallet.cards.cardNumber', "Karta raqami")}</p>
                                                <p className="font-mono text-base sm:text-xl tracking-widest truncate">{cardNumber || '0000 0000 0000 0000'}</p>
                                            </div>
                                            <div className="flex justify-between">
                                                <div>
                                                    <p className="text-xs text-gray-400 uppercase mb-1">{t('wallet.cards.cardHolder', "Egasi")}</p>
                                                    <p className="font-medium uppercase tracking-wide truncate max-w-[200px]">{cardHolder || 'ISMI FAMILIYASI'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>{t('wallet.cards.cardNumber', "Karta raqami")}</Label>
                                        <Input
                                            placeholder="0000 0000 0000 0000"
                                            value={cardNumber}
                                            onChange={handleCardNumberChange}
                                            maxLength={19}
                                            className="h-12 font-mono"
                                            inputMode="numeric"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>{t('wallet.cards.cardHolderName', "Egasi ismi")}</Label>
                                        <Input
                                            placeholder="ISMI FAMILIYASI"
                                            value={cardHolder}
                                            onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                                            className="h-12"
                                        />
                                    </div>

                                    <Button
                                        onClick={handleAddCard}
                                        disabled={addCardMutation.isPending}
                                            className="h-12 w-full rounded-[16px] bg-orange-500 font-black text-white shadow-[0_12px_24px_rgba(249,115,22,0.22)] hover:bg-orange-600"
                                    >
                                        {addCardMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                        {addCardMutation.isPending ? t('wallet.cards.saving', "Saqlanmoqda...") : t('wallet.cards.save', "Saqlash")}
                                    </Button>

                                    <Button variant="ghost" className="w-full" onClick={handleBack}>
                                        {t('wallet.cards.cancel', "Bekor qilish")}
                                    </Button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="cards-list"
                                custom={-1}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="col-start-1 row-start-1 h-full w-full space-y-6 overflow-y-auto bg-transparent px-1 pb-20"
                            >
                                {/* ── Section 1: NBU saved cards (one-tap payment) ── */}
                                {nbuEnabled && (
                                    <section className="space-y-3">
                                        <div className="space-y-0.5">
                                            <h3 className="text-[15px] font-black text-gray-950 dark:text-[#fff8ed]">
                                                {t('nbu.cards.title', "Saqlangan kartalar")}
                                            </h3>
                                            <p className="text-xs text-gray-500 dark:text-[#fff8ed]/55">
                                                {t('nbu.cards.sectionHint', "Tezkor to'lov uchun")}
                                            </p>
                                        </div>

                                        {nbuCardsLoading ? (
                                            <div className="flex justify-center py-6">
                                                <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
                                            </div>
                                        ) : (nbuCardsData?.items ?? []).length === 0 ? (
                                            <Button
                                                variant="outline"
                                                disabled={nbuBindMutation.isPending}
                                                onClick={handleNbuBind}
                                                className="w-full rounded-[18px] border-2 border-dashed border-sky-300 py-6 text-sky-700 hover:border-sky-500 hover:bg-sky-50 dark:border-sky-500/30 dark:text-sky-300 dark:hover:bg-sky-500/10"
                                            >
                                                {nbuBindMutation.isPending ? (
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Plus className="h-4 w-4 mr-2" />
                                                )}
                                                {t('nbu.cards.bindNew', "Yangi karta saqlash")}
                                            </Button>
                                        ) : (
                                            <div className="space-y-2.5">
                                                {(nbuCardsData?.items ?? []).map((card) => (
                                                    <div
                                                        key={card.id}
                                                        className="flex items-center gap-3 rounded-[18px] border border-sky-200/60 bg-gradient-to-br from-sky-50 to-cyan-50 p-3.5 dark:border-sky-500/20 dark:from-sky-500/10 dark:to-cyan-500/5"
                                                    >
                                                        <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-white/80 dark:bg-white/10 flex items-center justify-center">
                                                            <CreditCard className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-mono text-sm font-bold text-gray-950 truncate dark:text-[#fff8ed]">
                                                                {card.card_masked ?? t('nbu.cards.unknown', "Saqlangan karta")}
                                                            </p>
                                                            <p className="text-[11px] text-gray-500 dark:text-[#fff8ed]/55">
                                                                {t('nbu.cards.tokenized', "Tokenlangan — xavfsiz")}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={nbuDeleteMutation.isPending}
                                                            onClick={() => handleNbuDelete(card.id)}
                                                            className="h-9 w-9 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                                                            aria-label={t('nbu.cards.deleteConfirm', "Kartani o'chirasizmi?")}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                                <Button
                                                    variant="outline"
                                                    disabled={nbuBindMutation.isPending}
                                                    onClick={handleNbuBind}
                                                    className="w-full rounded-[18px] border-2 border-dashed border-sky-300 py-4 text-sky-700 hover:border-sky-500 hover:bg-sky-50 dark:border-sky-500/30 dark:text-sky-300 dark:hover:bg-sky-500/10"
                                                >
                                                    {nbuBindMutation.isPending ? (
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    ) : (
                                                        <Plus className="h-4 w-4 mr-2" />
                                                    )}
                                                    {t('nbu.cards.bindNew', "Yangi karta saqlash")}
                                                </Button>
                                            </div>
                                        )}
                                    </section>
                                )}

                                {/* ── Section 2: Refund cards (manual entry, refund payouts) ── */}
                                <section className="space-y-3">
                                    <div className="space-y-0.5">
                                        <h3 className="text-[15px] font-black text-gray-950 dark:text-[#fff8ed]">
                                            {t('wallet.cards.refundTitle', "Qaytarish kartasi")}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-[#fff8ed]/55">
                                            {t('wallet.cards.refundHint', "Pul qaytarish uchun ishlatiladi")}
                                        </p>
                                    </div>

                                    {isLoading ? (
                                    <div className="flex justify-center p-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                                    </div>
                                ) : cardsData?.cards.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                                        <div className="h-14 w-14 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                                            <CreditCard className="h-7 w-7 text-gray-400" />
                                        </div>
                                        <p className="font-medium mb-1 text-sm">{t('wallet.cards.noCards', "Hozircha kartalar yo'q")}</p>
                                        <p className="text-xs text-gray-400 mb-5 max-w-xs">{t('wallet.cards.addPrompt', "To'lovlarni tezroq amalga oshirish uchun karta qo'shing")}</p>
                                        <Button
                                            onClick={() => setIsAdding(true)}
                                            className="rounded-full bg-orange-500 px-6 font-black text-white hover:bg-orange-600"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            {t('wallet.cards.addCard', "Karta qo'shish")}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {cardsData?.cards.map((card, index) => (
                                            <motion.div
                                                key={card.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                className="group relative overflow-hidden rounded-[22px] border border-white/8 bg-gradient-to-br from-gray-950 to-gray-800 p-5 text-white shadow-lg"
                                            >
                                                {/* Card Background Patterns */}
                                                <div className="absolute top-0 right-0 h-32 w-32 translate-x-12 translate-y-[-2rem] rounded-full bg-white/5 blur-3xl" />
                                                <div className="absolute bottom-0 left-0 h-24 w-24 translate-x-[-2rem] translate-y-12 rounded-full bg-orange-500/10 blur-2xl" />

                                                <div className="relative z-10 flex justify-between items-start">
                                                    <div>
                                                        <p className="font-mono text-xl tracking-widest">{card.masked_number}</p>
                                                        <p className="mt-4 text-xs font-medium text-gray-400 uppercase tracking-wide">
                                                            {card.holder_name}
                                                        </p>
                                                    </div>
                                                    <div className="h-8 w-12 rounded bg-white/10" />
                                                </div>

                                                <Button
                                                    variant="destructive"
                                                    size="icon"
                                                    className="absolute right-2 top-2 h-8 w-8 opacity-100 backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 dark:bg-red-900/50 dark:hover:bg-red-900"
                                                    onClick={() => handleDeleteCard(card.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </motion.div>
                                        ))}

                                        <Button
                                            variant="outline"
                                            className="mt-4 w-full rounded-[18px] border-2 border-dashed py-6 text-gray-500 transition-colors hover:border-orange-500 hover:bg-orange-50 hover:text-orange-600 dark:border-white/10 dark:text-[#fff8ed]/58 dark:hover:bg-orange-500/10 dark:hover:text-amber-300"
                                            onClick={() => setIsAdding(true)}
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            {t('wallet.cards.addNewCard', "Yangi karta qo'shish")}
                                        </Button>
                                    </div>
                                )}
                                </section>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog >
    );
}
