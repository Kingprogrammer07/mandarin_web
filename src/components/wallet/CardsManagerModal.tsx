import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Trash2, Plus, Loader2, ChevronLeft, X, Pencil, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletService } from '@/api/services/walletService';
import { nbuPaymentService } from '@/api/services/nbuPaymentService';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { redirectToNbuUrl } from '@/utils/nbuReturnContext';

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

    // NBU saved-card UX state: optional label entered before binding, and
    // inline rename of an existing card.
    const [bindNickname, setBindNickname] = useState('');
    const [editingCardId, setEditingCardId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');

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
        mutationFn: (nickname?: string) => nbuPaymentService.bindCard(nickname),
        onSuccess: (data) => {
            const paymentUrl = data.payment_url;
            if (!paymentUrl) {
                toast.error(t('makePayment.errorOccurred', "Xatolik yuz berdi"));
                return;
            }
            redirectToNbuUrl({
                orderId: data.order_id,
                kind: 'card_binding',
                paymentUrl,
            });
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

    const nbuRenameMutation = useMutation({
        mutationFn: ({ cardId, nickname }: { cardId: number; nickname: string }) =>
            nbuPaymentService.renameCard(cardId, nickname),
        onSuccess: () => {
            toast.success(t('nbu.cards.renameSuccess', 'Karta nomi yangilandi'));
            queryClient.invalidateQueries({ queryKey: ['nbu-cards'] });
            setEditingCardId(null);
            setEditName('');
        },
        onError: () => {
            toast.error(t('nbu.cards.renameError', "Nomni o'zgartirishda xatolik"));
        },
    });

    const handleNbuBind = () => {
        nbuBindMutation.mutate(bindNickname.trim() || undefined);
    };

    const handleNbuDelete = (cardId: number) => {
        if (confirm(t('nbu.cards.deleteConfirm', "Kartani o'chirasizmi?"))) {
            nbuDeleteMutation.mutate(cardId);
        }
    };

    const startEdit = (cardId: number, current: string | null) => {
        setEditingCardId(cardId);
        setEditName(current ?? '');
    };

    const submitEdit = () => {
        if (editingCardId == null) return;
        nbuRenameMutation.mutate({ cardId: editingCardId, nickname: editName.trim() });
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
                className="top-auto bottom-0 left-0 flex h-[88svh] w-full max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-b-none rounded-t-mc-xl border border-mc-border bg-mc-surface p-0 shadow-[var(--mc-shadow-card)] backdrop-blur-xl data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[88vh] sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-mc-xl sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:slide-in-from-bottom-0"
            >
                <div className="mx-auto mt-3 h-1.5 w-11 rounded-full bg-mc-surface-2 sm:hidden dark:bg-white/14" />
                <DialogHeader className="px-5 pb-2 pt-4 text-left sm:px-6">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                        {isAdding && (
                            <Button
                                variant="ghost"
                                size="icon"
                                    className="-ml-2 h-9 w-9 shrink-0 rounded-full bg-mc-surface-2 text-mc-text"
                                onClick={handleBack}
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                        )}
                            <DialogTitle className="truncate text-[22px] font-black tracking-normal text-mc-text">
                                {isAdding ? t('wallet.cards.newCard', "Yangi karta") : t('wallet.cards.myCards', "Mening Kartalarim")}
                            </DialogTitle>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-10 w-10 shrink-0 rounded-full bg-mc-surface-2 text-mc-text"
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
                                    <div className="mb-6 rounded-mc-xl border border-white/10 bg-gradient-to-br from-mc-cardface to-mc-cardface-2 p-6 text-white shadow-[var(--mc-shadow-card)]">
                                        <div className="flex justify-between items-start mb-8">
                                            <div className="h-8 w-12 rounded bg-white/20" />
                                            <CreditCard className="h-6 w-6 text-white/60" />
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-xs text-mc-text-3 uppercase mb-1">{t('wallet.cards.cardNumber', "Karta raqami")}</p>
                                                <p className="font-mono text-base sm:text-xl tracking-widest truncate">{cardNumber || '0000 0000 0000 0000'}</p>
                                            </div>
                                            <div className="flex justify-between">
                                                <div>
                                                    <p className="text-xs text-mc-text-3 uppercase mb-1">{t('wallet.cards.cardHolder', "Egasi")}</p>
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
                                            className="h-12 w-full rounded-[16px] bg-mc-brand font-black text-mc-on-brand shadow-[0_12px_24px_rgba(249,115,22,0.22)]"
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
                                            <h3 className="text-[15px] font-black text-mc-text">
                                                {t('nbu.cards.title', "Saqlangan kartalar")}
                                            </h3>
                                            <p className="text-xs text-mc-text-2/55">
                                                {t('nbu.cards.sectionHintLong', "Yuk to'lovini shu karta bilan bir bosishda to'laysiz")}
                                            </p>
                                        </div>

                                        {nbuCardsLoading ? (
                                            <div className="flex justify-center py-6">
                                                <Loader2 className="h-5 w-5 animate-spin text-mc-brand" />
                                            </div>
                                        ) : (
                                            <div className="space-y-2.5">
                                                {(nbuCardsData?.items ?? []).map((card) => {
                                                    const primaryLabel =
                                                        card.nickname ||
                                                        card.card_masked ||
                                                        t('nbu.cards.namedCardFallback', "Saqlangan karta");
                                                    const secondaryLabel = card.card_masked
                                                        ? (card.nickname
                                                            ? card.card_masked
                                                            : t('nbu.cards.tokenized', "Tokenlangan — xavfsiz"))
                                                        : t('nbu.cards.pendingMasked', "Raqam birinchi to'lovdan so'ng ko'rinadi");
                                                    const isEditing = editingCardId === card.id;
                                                    return (
                                                        <div
                                                            key={card.id}
                                                            className="flex items-center gap-3 rounded-[18px] border border-mc-brand/20 bg-gradient-to-br from-mc-brand-soft to-mc-brand-soft p-3.5 dark:border-mc-brand/20 dark:from-mc-brand-soft dark:to-mc-brand-soft"
                                                        >
                                                            <div className="h-10 w-10 flex-shrink-0 rounded-mc-md bg-white/80 dark:bg-white/10 flex items-center justify-center">
                                                                <CreditCard className="h-5 w-5 text-mc-brand dark:text-mc-brand" />
                                                            </div>

                                                            {isEditing ? (
                                                                <div className="flex flex-1 items-center gap-2 min-w-0">
                                                                    <Input
                                                                        autoFocus
                                                                        value={editName}
                                                                        onChange={(e) => setEditName(e.target.value.slice(0, 40))}
                                                                        placeholder={t('nbu.cards.nicknamePlaceholder', "Masalan: Asosiy kartam")}
                                                                        className="h-9 flex-1 min-w-0"
                                                                        onKeyDown={(e) => { if (e.key === 'Enter') submitEdit(); }}
                                                                    />
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        disabled={nbuRenameMutation.isPending}
                                                                        onClick={submitEdit}
                                                                        className="h-9 w-9 shrink-0 rounded-full text-mc-success dark:text-mc-success"
                                                                        aria-label={t('nbu.cards.save', "Saqlash")}
                                                                    >
                                                                        {nbuRenameMutation.isPending
                                                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                            : <Check className="h-4 w-4" />}
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => { setEditingCardId(null); setEditName(''); }}
                                                                        className="h-9 w-9 shrink-0 rounded-full text-mc-text-3"
                                                                        aria-label={t('nbu.cards.cancel', "Bekor qilish")}
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-bold text-mc-text truncate">
                                                                            {primaryLabel}
                                                                        </p>
                                                                        <p className={`text-[11px] truncate ${card.nickname && card.card_masked ? 'font-mono text-mc-text-2/70' : 'text-mc-text-2/55'}`}>
                                                                            {secondaryLabel}
                                                                        </p>
                                                                    </div>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => startEdit(card.id, card.nickname)}
                                                                        className="h-9 w-9 rounded-full text-mc-text-3"
                                                                        aria-label={t('nbu.cards.rename', "Nomini o'zgartirish")}
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        disabled={nbuDeleteMutation.isPending}
                                                                        onClick={() => handleNbuDelete(card.id)}
                                                                        className="h-9 w-9 rounded-full text-mc-text-3"
                                                                        aria-label={t('nbu.cards.deleteConfirm', "Kartani o'chirasizmi?")}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {/* Bind block: optional nickname (NBU never returns the PAN
                                                    on bind, so the label is the user's pre-charge anchor). */}
                                                <div className="space-y-2 pt-1">
                                                    <Label className="text-[12px] font-black text-mc-text/76">
                                                        {t('nbu.cards.nicknameLabel', "Karta nomi (ixtiyoriy)")}
                                                    </Label>
                                                    <Input
                                                        value={bindNickname}
                                                        onChange={(e) => setBindNickname(e.target.value.slice(0, 40))}
                                                        placeholder={t('nbu.cards.nicknamePlaceholder', "Masalan: Asosiy kartam")}
                                                        className="h-11"
                                                    />
                                                    <p className="px-1 text-[11px] leading-snug text-mc-text-3/45">
                                                        {t('nbu.cards.nicknameHint', "Kartani keyin tanib olishingiz uchun nom bering. Karta raqami birinchi to'lovdan keyin ko'rinadi.")}
                                                    </p>
                                                    {/* People reported "I can't add a card": tapping this leaves the
                                                        Uzbek app for NBU's Russian-only form with no warning. Say what
                                                        happens and what they will need before they get there. */}
                                                    <p className="rounded-mc-md bg-mc-brand-soft px-3 py-2 text-[11px] font-semibold leading-snug text-mc-brand dark:bg-mc-brand-soft dark:text-mc-brand">
                                                        {t('nbu.cards.bindNotice')}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        disabled={nbuBindMutation.isPending}
                                                        onClick={handleNbuBind}
                                                        className="w-full rounded-[18px] border-2 border-dashed border-mc-brand/30 py-5 text-mc-brand dark:border-mc-brand/30 dark:text-mc-brand"
                                                    >
                                                        {nbuBindMutation.isPending ? (
                                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        ) : (
                                                            <Plus className="h-4 w-4 mr-2" />
                                                        )}
                                                        {t('nbu.cards.bindNew', "Yangi karta saqlash")}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                )}

                                {/* ── Section 2: Refund cards (manual entry, refund payouts) ── */}
                                <section className="space-y-3">
                                    <div className="space-y-0.5">
                                        <h3 className="text-[15px] font-black text-mc-text">
                                            {t('wallet.cards.refundTitle', "Qaytarish kartasi")}
                                        </h3>
                                        <p className="text-xs text-mc-text-2/55">
                                            {t('wallet.cards.refundHint', "Pul qaytarish uchun ishlatiladi")}
                                        </p>
                                    </div>

                                    {isLoading ? (
                                    <div className="flex justify-center p-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-mc-brand" />
                                    </div>
                                ) : cardsData?.cards.length === 0 ? (
                                    <div className="text-center py-8 text-mc-text-2 flex flex-col items-center">
                                        <div className="h-14 w-14 bg-mc-surface-2 dark:bg-mc-surface-2 rounded-full flex items-center justify-center mb-3">
                                            <CreditCard className="h-7 w-7 text-mc-text-3" />
                                        </div>
                                        {/* Refund-card empty state. Must NOT reuse the payment-card
                                            copy: a user with a saved payment card above was reading
                                            "Hozircha kartalar yo'q" and concluded their card binding
                                            had failed. */}
                                        <p className="font-medium mb-1 text-sm">{t('wallet.cards.noRefundCards', "Qaytarish kartasi qo'shilmagan")}</p>
                                        <p className="text-xs text-mc-text-3 mb-5 max-w-xs">{t('wallet.cards.refundAddPrompt', "Bu karta faqat pul qaytarilganda ishlatiladi. To'lov uchun yuqoridagi “To'lov kartalari” bo'limidan foydalaning.")}</p>
                                        <Button
                                            onClick={() => setIsAdding(true)}
                                            className="rounded-full bg-mc-brand px-6 font-black text-mc-on-brand"
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
                                                className="group relative overflow-hidden rounded-mc-xl border border-white/10 bg-gradient-to-br from-mc-cardface to-mc-cardface-2 p-5 text-white shadow-[var(--mc-shadow-card)]"
                                            >
                                                {/* Card Background Patterns */}
                                                <div className="absolute top-0 right-0 h-32 w-32 translate-x-12 translate-y-[-2rem] rounded-full bg-white/5 blur-3xl" />
                                                <div className="absolute bottom-0 left-0 h-24 w-24 translate-x-[-2rem] translate-y-12 rounded-full bg-mc-brand/10 blur-2xl" />

                                                <div className="relative z-10 flex justify-between items-start">
                                                    <div>
                                                        <p className="font-mono text-xl tracking-widest">{card.masked_number}</p>
                                                        <p className="mt-4 text-xs font-medium text-white/60 uppercase tracking-wide">
                                                            {card.holder_name}
                                                        </p>
                                                    </div>
                                                    <div className="h-8 w-12 rounded bg-white/10" />
                                                </div>

                                                <Button
                                                    variant="destructive"
                                                    size="icon"
                                                    className="absolute right-2 top-2 h-9 w-9 backdrop-blur-sm"
                                                    onClick={() => handleDeleteCard(card.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </motion.div>
                                        ))}

                                        <Button
                                            variant="outline"
                                            className="mt-4 w-full rounded-[18px] border-2 border-dashed py-6 text-mc-text-2 transition-colors dark:border-white/10/58"
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
