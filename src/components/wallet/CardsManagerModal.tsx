import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Trash2, Plus, Loader2, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletService } from '@/api/services/walletService';
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

    // Fetch cards
    const { data: cardsData, isLoading } = useQuery({
        queryKey: ['walletCards'],
        queryFn: walletService.getWalletCards,
        enabled: isOpen,
    });

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
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-white/20 overflow-hidden h-[90vh] sm:h-auto flex flex-col">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        {isAdding && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 -ml-2 rounded-full"
                                onClick={handleBack}
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                        )}
                        <DialogTitle>{isAdding ? t('wallet.cards.newCard', "Yangi karta") : t('wallet.cards.myCards', "Mening Kartalarim")}</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="py-4 relative flex-1 grid overflow-hidden">
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
                                className="space-y-4 col-start-1 row-start-1 w-full h-full bg-transparent px-1 overflow-y-auto"
                            >
                                <div className="space-y-4 pb-6">
                                    <div className="p-6 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-xl mb-6">
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
                                        className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20"
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
                                className="space-y-4 col-start-1 row-start-1 w-full h-full bg-transparent px-1 overflow-y-auto"
                            >
                                {isLoading ? (
                                    <div className="flex justify-center p-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                    </div>
                                ) : cardsData?.cards.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500 flex flex-col items-center">
                                        <div className="h-16 w-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                            <CreditCard className="h-8 w-8 text-gray-400" />
                                        </div>
                                        <p className="font-medium mb-1">{t('wallet.cards.noCards', "Hozircha kartalar yo'q")}</p>
                                        <p className="text-sm text-gray-400 mb-6 max-w-xs">{t('wallet.cards.addPrompt', "To'lovlarni tezroq amalga oshirish uchun karta qo'shing")}</p>
                                        <Button
                                            onClick={() => setIsAdding(true)}
                                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            {t('wallet.cards.addCard', "Karta qo'shish")}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3 pb-20">
                                        {cardsData?.cards.map((card, index) => (
                                            <motion.div
                                                key={card.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 p-5 text-white shadow-lg border border-white/5"
                                            >
                                                {/* Card Background Patterns */}
                                                <div className="absolute top-0 right-0 h-32 w-32 translate-x-12 translate-y-[-2rem] rounded-full bg-white/5 blur-3xl" />
                                                <div className="absolute bottom-0 left-0 h-24 w-24 translate-x-[-2rem] translate-y-12 rounded-full bg-blue-500/10 blur-2xl" />

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
                                                    className="absolute top-2 right-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-red-900/50 dark:hover:bg-red-900 backdrop-blur-sm"
                                                    onClick={() => handleDeleteCard(card.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </motion.div>
                                        ))}

                                        <Button
                                            variant="outline"
                                            className="w-full border-dashed border-2 py-6 text-gray-500 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors mt-4"
                                            onClick={() => setIsAdding(true)}
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            {t('wallet.cards.addNewCard', "Yangi karta qo'shish")}
                                        </Button>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog >
    );
}
