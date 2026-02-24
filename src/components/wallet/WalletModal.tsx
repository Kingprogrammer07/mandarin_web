import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2, CreditCard, CheckCircle, AlertCircle, Wallet, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletService } from '@/api/services/walletService';
import { toast } from 'sonner';

interface WalletModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [refundAmount, setRefundAmount] = useState('');
    const [selectedCardId, setSelectedCardId] = useState<string>('');
    const [copied, setCopied] = useState(false);

    // Fetch balance
    const { data: walletData, isLoading: isBalanceLoading } = useQuery({
        queryKey: ['walletBalance'],
        queryFn: walletService.getWalletBalance,
        enabled: isOpen,
    });

    const balance = walletData?.balance || 0;
    const isDebt = balance < 0;

    // Fetch active company card ONLY if debt exists
    const { data: activeCard, isLoading: isActiveCardLoading } = useQuery({
        queryKey: ['activeCompanyCard'],
        queryFn: walletService.getActiveCompanyCard,
        enabled: isOpen && isDebt,
    });

    const { data: cardsData } = useQuery({
        queryKey: ['walletCards'],
        queryFn: walletService.getWalletCards,
        enabled: isOpen,
    });

    // Mutations
<<<<<<< HEAD
    const getErrorMessage = (error: unknown, fallback: string) => {
        if (typeof error === 'object' && error !== null) {
            const e = error as { message?: string; data?: { detail?: string } };
            return e.data?.detail ?? e.message ?? fallback;
        }
        return fallback;
    };

=======
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
    const payDebtMutation = useMutation({
        mutationFn: walletService.payDebt,
        onSuccess: () => {
            toast.success("To'lov cheki yuborildi");
            queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
            handleClose();
        },
<<<<<<< HEAD
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, "Xatolik yuz berdi"));
=======
        onError: (error: any) => {
            toast.error(error.message || "Xatolik yuz berdi");
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
        }
    });

    const refundMutation = useMutation({
        mutationFn: walletService.requestRefund,
        onSuccess: () => {
            toast.success("Pul qaytarish so'rovi yuborildi");
            queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
            handleClose();
        },
<<<<<<< HEAD
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, "Xatolik yuz berdi"));
=======
        onError: (error: any) => {
            toast.error(error.message || "Xatolik yuz berdi");
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
        }
    });

    const canRefund = balance >= 5000;

    const handleClose = () => {
        setFile(null);
        setRefundAmount('');
        setSelectedCardId('');
        onClose();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            // 1. Validate File Type
            const allowedTypes = [
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp",
                "image/heic",
                "image/heif",
                "application/pdf",
            ];

            // Check if type is allowed OR if it's a HEIC file (sometimes type is empty or specific)
            const isHeic = selectedFile.name.toLowerCase().endsWith('.heic') || selectedFile.name.toLowerCase().endsWith('.heif');

            if (!allowedTypes.includes(selectedFile.type) && !isHeic) {
                toast.error("Faqat rasm (JPG, PNG, HEIC) yoki PDF formatidagi fayllarni yuklang.");
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            // 2. Validate File Size (10MB)
            const maxSize = 10 * 1024 * 1024; // 10MB in bytes
            if (selectedFile.size > maxSize) {
                toast.error("Fayl hajmi 10MB dan oshmasligi kerak.");
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            setFile(selectedFile);
        }
    };

    const handlePayDebt = () => {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        payDebtMutation.mutate(formData);
    };

    const handleRefund = () => {
        if (!refundAmount || !selectedCardId) return;
        refundMutation.mutate({
            amount: Number(refundAmount),
            card_id: Number(selectedCardId)
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Karta raqami nusxalandi");
        setTimeout(() => setCopied(false), 2000);
    };

    const renderContent = () => {
        if (isBalanceLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-4" />
                    <p className="text-gray-500">Ma'lumotlar yuklanmoqda...</p>
                </div>
            );
        }

        if (isDebt) {
            return (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">Qarzdorlik mavjud</h3>
                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                Sizda {Math.abs(balance).toLocaleString()} UZS qarzdorlik mavjud. Iltimos, quyidagi kartaga to'lov qiling va chekni yuklang.
                            </p>
                        </div>
                    </div>

                    {/* Active Company Card Display */}
                    {isActiveCardLoading ? (
                        <div className="h-40 w-full bg-gray-100 dark:bg-white/5 animate-pulse rounded-xl" />
                    ) : activeCard ? (
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-900 via-blue-900 to-blue-800 p-6 text-white shadow-xl">
                            {/* Card Background Patterns */}
                            <div className="absolute top-0 right-0 h-40 w-40 translate-x-12 translate-y-[-2rem] rounded-full bg-white/10 blur-3xl" />
                            <div className="absolute bottom-0 left-0 h-32 w-32 translate-x-[-2rem] translate-y-12 rounded-full bg-blue-400/20 blur-2xl" />

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="h-8 w-12 rounded bg-white/20 backdrop-blur-sm" />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-white hover:bg-white/20 hover:text-white"
                                        onClick={() => copyToClipboard(activeCard.card_number)}
                                    >
                                        {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                                        {copied ? "Nusxalandi" : "Nusxalash"}
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs text-blue-200 uppercase mb-1">Karta raqami</p>
                                        <p className="font-mono text-lg sm:text-2xl tracking-widest truncate">{activeCard.card_number.replace(/(\d{4})/g, '$1 ').trim()}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-200 uppercase mb-1">Egasi</p>
                                        <p className="font-medium uppercase tracking-wide truncate max-w-[200px] sm:max-w-full">{activeCard.holder_name}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-6 border border-dashed rounded-xl bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                            <AlertCircle className="h-10 w-10 text-orange-500 mx-auto mb-3" />
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">To'lov qabul qilish vaqtincha to'xtatilgan</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Hozirda faol karta mavjud emas. Iltimos keyinroq urinib ko'ring yoki administratorga bog'laning.
                            </p>
                        </div>
                    )}

                    {activeCard && (
                        <>
                            <div className="space-y-4">
                                <Label className="text-base">To'lov chekini yuklash</Label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`
                                        border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors
                                        ${file ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-gray-200 hover:border-orange-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'}
                                    `}
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
                                            <CheckCircle className="h-10 w-10 text-emerald-500 mb-2" />
                                            <p className="text-sm font-medium text-emerald-700">{file.name}</p>
                                            <p className="text-xs text-emerald-500 mt-1">O'zgartirish uchun bosing</p>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Chekni tanlash uchun bosing</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            <Button
                                onClick={handlePayDebt}
                                disabled={!file || payDebtMutation.isPending}
                                className="w-full h-12 text-base bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg shadow-red-500/20"
                            >
                                {payDebtMutation.isPending ? <Loader2 className="animate-spin" /> : "Chekni yuborish"}
                            </Button>
                        </>
                    )}
                </motion.div>
            );
        }

        if (canRefund) {
            return (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl p-4 flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Mablag' yetarli</h3>
                            <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                                Balans: {balance.toLocaleString()} UZS. Siz pulni kartangizga qaytarib olishingiz mumkin.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Qaytariladigan summa</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={refundAmount}
                                    onChange={(e) => setRefundAmount(e.target.value)}
                                    placeholder="0"
                                    max={balance}
                                    className="pl-4 pr-12 h-12 text-lg"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">UZS</span>
                            </div>
                            <p className="text-xs text-gray-500 text-right">Maksimal: {balance.toLocaleString()} UZS</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Karta tanlang</Label>
                            <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                                <SelectTrigger className="h-12 w-full">
                                    <SelectValue placeholder="Karta tanlang" />
                                </SelectTrigger>
                                <SelectContent>
                                    {cardsData?.cards.length === 0 ? (
                                        <div className="p-2 text-sm text-center text-gray-500">Karta mavjud emas</div>
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
                        onClick={handleRefund}
                        disabled={!refundAmount || !selectedCardId || refundMutation.isPending || Number(refundAmount) > balance}
                        className="w-full h-12 text-base bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20"
                    >
                        {refundMutation.isPending ? <Loader2 className="animate-spin" /> : "So'rov yuborish"}
                    </Button>
                </motion.div>
            );
        }

        // Insufficient funds case
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-8 text-center"
            >
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <Wallet className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Balans yetarli emas</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                    Pul qaytarish uchun minimal balans 5,000 UZS bo'lishi kerak. Hozirgi balans: {balance.toLocaleString()} UZS.
                </p>
            </motion.div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px] w-full max-h-[90vh] flex flex-col p-0 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl border-white/20">
                <DialogHeader className="p-6 pb-2 flex-shrink-0">
                    <DialogTitle className="text-xl">To'lovlar</DialogTitle>
                    <DialogDescription>
                        Balans va to'lovlar holati
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 pt-2 overflow-y-auto flex-1">
                    {renderContent()}
                </div>
            </DialogContent>
        </Dialog>
    );
}
