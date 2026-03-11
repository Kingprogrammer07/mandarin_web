import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import type { FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle, PackageOpen, Upload, MapPin, Phone, User, Globe, X, Package, Car, Truck, Store } from 'lucide-react';

import { regions, DISTRICTS } from '@/lib/validation';
import { submitAdminDeliveryRequest } from '@/api/delivery';
import type { Transaction } from '@/api/transactions';
import { formatCurrencySum } from '@/lib/format';

// Reusing general rules for client info
const deliverySchema = z.object({
    full_name: z.string().min(1, 'Ism kiritilishi shart'),
    phone: z.string().min(9, 'Telefon raqam noto\'g\'ri'),
    region: z.string().min(1, 'Viloyat tanlanishi shart'),
    district: z.string().min(1, 'Tuman tanlanishi shart'),
    address: z.string().optional(),
});

type DeliveryFormData = z.infer<typeof deliverySchema>;

interface ClientProfile {
    id?: string | number;
    client_code: string;
    full_name: string;
    phone?: string | null;
    region: string | null;
    district: string | null;
    address?: string | null;
    client_balance: number;
}

interface DeliveryRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: Transaction | null;
    clientProfile: ClientProfile | null;
    onSuccess: () => void;
}

export function DeliveryRequestModal({
    isOpen,
    onClose,
    transaction,
    clientProfile,
    onSuccess,
}: DeliveryRequestModalProps) {
    const { t } = useTranslation();
    const [deliveryType, setDeliveryType] = useState<string>('uzpost');
    const [isEditingClient, setIsEditingClient] = useState(false);
    const [useWallet, setUseWallet] = useState(false);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorStatus, setErrorStatus] = useState<string | null>(null);

    const form = useForm<DeliveryFormData>({
        resolver: zodResolver(deliverySchema),
        defaultValues: {
            full_name: '',
            phone: '',
            region: '',
            district: '',
            address: '',
        },
    });

    const selectedRegion = form.watch('region');

    // Reset / Load form when modal opens or profile changes
    useEffect(() => {
        if (isOpen && clientProfile) {
            form.reset({
                full_name: clientProfile.full_name || '',
                phone: clientProfile.phone ? clientProfile.phone.replace('+998', '').replace(/\D/g, '') : '',
                region: clientProfile.region || '',
                district: clientProfile.district || '',
                address: clientProfile.address || '',
            });
            setDeliveryType('uzpost');
            setIsEditingClient(false);
            setUseWallet(false);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
            setIsDragging(false);
            setReceiptFile(null);
            setErrorStatus(null);
        }
    }, [isOpen, clientProfile, form, previewUrl]);

    useEffect(() => {
        if (selectedRegion && clientProfile?.region !== selectedRegion) {
            // Clear district if region naturally changes during edit
            // but only if it's different from the initial profile region to prevent immediate clearing on open
        }
    }, [selectedRegion, clientProfile]);

    // Identify special regions (example array based on backend or standard logic)
    // Note: Assuming "xorazm", "qoraqalpogiston" equivalents in existing region map
    const specialRegions = ['khorezm', 'karakalpakstan'];
    const isSpecialRegion = selectedRegion ? specialRegions.includes(selectedRegion) : false;
    const basePricePerKg = isSpecialRegion ? 18000 : 15000;

    // Uzpost Mock Calculation
    const weightVal = transaction?.vazn ? parseFloat(transaction.vazn) : 1;
    const uzpostMockPrice = weightVal * basePricePerKg;

    const walletBalance = clientProfile?.client_balance || 0;

    // Calculate remaining
    let applicableWallet = 0;
    if (useWallet) {
        applicableWallet = Math.min(walletBalance, uzpostMockPrice);
    }
    const remainingAmount = uzpostMockPrice - applicableWallet;

    const handleFileSelect = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) {
            setErrorStatus('Faqat rasm fayllari (JPG, PNG) qabul qilinadi.');
            return;
        }
        setReceiptFile(file);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(file));
        setErrorStatus(null);
    }, [previewUrl]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    };

    // Global Paste Event Listener
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            // Only capture if modal is open, we're on uzpost, and amount demands receipt
            if (!isOpen || deliveryType !== 'uzpost') return;

            const items = e.clipboardData?.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        const file = items[i].getAsFile();
                        if (file) handleFileSelect(file);
                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [isOpen, deliveryType, handleFileSelect]);

    // Cleanup object URL on unmount
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const onSubmit = async (data: DeliveryFormData) => {
        if (!transaction || !clientProfile) return;

        if (deliveryType === 'uzpost' && remainingAmount > 0 && !receiptFile) {
            setErrorStatus('Uzpost yetkazib berish uchun to\'lov cheki yuklanishi shart (agar hamyon yetmasa).');
            return;
        }

        setIsSubmitting(true);
        setErrorStatus(null);

        try {
            const formData = new FormData();
            formData.append('client_id', String(clientProfile.id || transaction.id)); // Adjusting fallback ID
            // Telegram ID of admin. Assuming WebApp is present, else 0 fallback.
            const adminId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 0;
            formData.append('admin_telegram_id', String(adminId));
            formData.append('delivery_type', deliveryType);

            // We pass the current transaction's flight name as an array
            const flightArray = [transaction.reys];
            formData.append('flight_names_json', JSON.stringify(flightArray));

            formData.append('full_name', data.full_name);
            formData.append('phone', `+998${data.phone}`);
            formData.append('region', data.region);
            formData.append('district', data.district);
            formData.append('address', data.address || '');

            formData.append('wallet_used', String(applicableWallet));

            if (deliveryType === 'uzpost' && receiptFile) {
                formData.append('receipt_file', receiptFile);
            }

            await submitAdminDeliveryRequest(formData);

            onSuccess();
            onClose();
        } catch (err: unknown) {
            console.error('Failed to submit delivery request', err);
            const errorMessage = err instanceof Error ? err.message : 'Xatolik yuz berdi. Iltimos qayta urinib ko\'ring.';
            setErrorStatus(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const onFormError = (errors: FieldValues) => {
        console.error("Validation errors:", errors);
        setIsEditingClient(true); // Open edit mode automatically to reveal errors
        setErrorStatus("Iltimos, mijozning barcha kerakli ma'lumotlarini to'g'ri kiriting.");
    };

    if (!transaction || !clientProfile) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col overflow-y-auto w-full rounded-t-3xl sm:rounded-2xl p-0 gap-0 bottom-0 top-auto translate-y-[0%] data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 mb-1 shrink-0" />
                <div className="p-4 sm:p-6 pt-2">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl text-orange-600">
                            <PackageOpen className="w-5 h-5" />
                            Yetkazib berish (Zayavka)
                        </DialogTitle>
                        <DialogDescription>
                            {transaction.reys} (Qator: {transaction.qator_raqami}) pochta yetkazmasi.
                        </DialogDescription>
                    </DialogHeader>

                    {errorStatus && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-md flex items-start gap-2 text-sm border border-red-200">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span>{errorStatus}</span>
                        </div>
                    )}

                    <div className="space-y-6 pt-2">
                        {/* Step 1: Delivery Service */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wider">1. Xizmat turi</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { id: 'uzpost', label: 'Uzpost', icon: <Package className="w-5 h-5 text-blue-500" /> },
                                    { id: 'yandex', label: 'Yandex Dostavka', icon: <Car className="w-5 h-5 text-yellow-500" /> },
                                    { id: 'mandarin', label: 'Mandarin Dastavka', icon: <Store className="w-5 h-5 text-orange-500" /> },
                                    { id: 'bts', label: 'BTS', icon: <Truck className="w-5 h-5 text-indigo-500" /> },
                                ].map((svc) => (
                                    <div
                                        key={svc.id}
                                        onClick={() => setDeliveryType(svc.id)}
                                        className={`border rounded-xl p-3 cursor-pointer flex items-center gap-3 transition-all ${deliveryType === svc.id
                                            ? 'border-orange-500 bg-orange-50/60 shadow-sm'
                                            : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${deliveryType === svc.id ? 'border-orange-500' : 'border-gray-300'
                                            }`}>
                                            {deliveryType === svc.id && <div className="w-2 h-2 rounded-full bg-orange-500" />}
                                        </div>
                                        <div className="flex items-center justify-center bg-white p-1.5 rounded-lg border shadow-sm shrink-0">
                                            {svc.icon}
                                        </div>
                                        <span className="font-medium text-sm text-gray-800">{svc.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Form {...form}>
                            <form id="delivery-form" onSubmit={form.handleSubmit(onSubmit, onFormError)} className="space-y-6">
                                {/* Step 2: Client Info */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wider">2. Mijoz ma'lumotlari</h3>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsEditingClient(!isEditingClient)}
                                            className="text-orange-600 h-8"
                                        >
                                            {isEditingClient ? 'Tasdiqlash' : 'Tahrirlash'}
                                        </Button>
                                    </div>

                                    {!isEditingClient ? (
                                        <div className="bg-gray-50 p-4 rounded-lg border text-sm space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Mijoz kodi:</span>
                                                <span className="font-medium">{clientProfile.client_code}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Ism:</span>
                                                <span className="font-medium">{form.getValues('full_name')}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Tel:</span>
                                                <span className="font-medium">+998 {form.getValues('phone')}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Manzil:</span>
                                                <span className="font-medium text-right max-w-[200px] truncate">
                                                    {form.getValues('region')}, {form.getValues('district')} {form.getValues('address') ? `, ${form.getValues('address')}` : ''}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 border p-4 rounded-lg bg-orange-50/30">
                                            <FormField
                                                control={form.control}
                                                name="full_name"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Ism</FormLabel>
                                                        <FormControl><Input {...field} /></FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="phone"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Telefon (998...)</FormLabel>
                                                        <FormControl><Input {...field} /></FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <div className="grid grid-cols-2 gap-3">
                                                <FormField
                                                    control={form.control}
                                                    name="region"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="flex items-center gap-1.5 text-gray-700 font-medium">
                                                                <Globe className="w-4 h-4 text-orange-500" />
                                                                {t('client.region')}
                                                            </FormLabel>
                                                            <Select onValueChange={(v) => { field.onChange(v); form.setValue('district', ''); }} value={field.value || ''}>
                                                                <FormControl>
                                                                    <SelectTrigger className="w-full bg-orange-50/50 border-orange-200 focus:border-orange-500 focus:ring-orange-500">
                                                                        <SelectValue placeholder={t('client.regionPlaceholder')} />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {regions.map((r) => (
                                                                        <SelectItem key={r.value} value={r.value} className="cursor-pointer hover:bg-orange-50">
                                                                            {t(r.label)}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="district"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="flex items-center gap-1.5 text-gray-700 font-medium">
                                                                <MapPin className="w-4 h-4 text-orange-500" />
                                                                {t('client.district')}
                                                            </FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedRegion}>
                                                                <FormControl>
                                                                    <SelectTrigger className="w-full bg-orange-50/50 border-orange-200 focus:border-orange-500 focus:ring-orange-500">
                                                                        <SelectValue placeholder={t('client.districtPlaceholder')} />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {selectedRegion && DISTRICTS[selectedRegion as keyof typeof DISTRICTS]?.map(d => (
                                                                        <SelectItem key={d.value} value={d.value} className="cursor-pointer hover:bg-orange-50">
                                                                            {t(d.label)}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name="address"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Uy manzili <span className="text-gray-400 font-normal text-xs">(Ixtiyoriy)</span></FormLabel>
                                                        <FormControl><Input {...field} placeholder="Ko'cha, uy raqami" /></FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Step 3: Uzpost Specifics */}
                                {deliveryType === 'uzpost' && (
                                    <div className="space-y-4 border-t pt-4">
                                        <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wider">3. Uzpost To'lovi</h3>

                                        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-lg space-y-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Pochta vazni (taxminiy):</span>
                                                <span className="font-medium">{weightVal} kg</span>
                                            </div>
                                            <div className="flex justify-between text-base font-medium">
                                                <span>Yetkazish narxi:</span>
                                                <span>{formatCurrencySum(uzpostMockPrice)} / so'm</span>
                                            </div>

                                            <div className="border-t border-blue-200 my-3"></div>

                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id="use-wallet"
                                                    className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                                                    checked={useWallet}
                                                    onChange={(e) => setUseWallet(e.target.checked)}
                                                    disabled={walletBalance <= 0}
                                                />
                                                <label htmlFor="use-wallet" className="text-sm font-medium leading-none cursor-pointer">
                                                    Hamyondan to'lash (<span className="text-blue-700">{formatCurrencySum(walletBalance)}</span> mavjud)
                                                </label>
                                            </div>

                                            {useWallet && applicableWallet > 0 && (
                                                <div className="flex justify-between text-sm text-green-700 font-medium">
                                                    <span>Hamyondan ushlanadi:</span>
                                                    <span>-{formatCurrencySum(applicableWallet)}</span>
                                                </div>
                                            )}

                                            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-blue-200 pt-2 mt-2">
                                                <span>Qolgan to'lov summasi:</span>
                                                <span className={remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}>
                                                    {formatCurrencySum(remainingAmount)}
                                                </span>
                                            </div>
                                        </div>

                                        {remainingAmount > 0 && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">To'lov chekini yuklash <span className="text-red-500">*</span></label>
                                                <div
                                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                                    onDragLeave={() => setIsDragging(false)}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        setIsDragging(false);
                                                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                                            handleFileSelect(e.dataTransfer.files[0]);
                                                        }
                                                    }}
                                                    className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors relative overflow-hidden ${isDragging ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                                >
                                                    {!previewUrl ? (
                                                        <>
                                                            <input
                                                                type="file"
                                                                id="receipt-upload"
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                accept="image/*"
                                                                onChange={handleFileChange}
                                                            />
                                                            <Upload className="h-8 w-8 text-gray-400 mb-2 pointer-events-none" />
                                                            <span className="text-sm font-medium text-gray-700 pointer-events-none text-center">Chek rasmini yuklang yoki tashlang</span>
                                                            <span className="text-xs text-gray-500 mt-1 pointer-events-none text-center">yoki Ctrl+V (Paste) orqali kiritish</span>
                                                        </>
                                                    ) : (
                                                        <div className="relative border rounded-lg overflow-hidden flex flex-col items-center justify-center p-2 bg-gray-50 w-full">
                                                            <img src={previewUrl} alt="Receipt preview" className="max-h-40 w-auto object-contain rounded-md shadow-sm" />
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="sm"
                                                                className="absolute top-2 right-2 h-7 w-7 p-0 rounded-full shadow-sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setReceiptFile(null);
                                                                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                                                                    setPreviewUrl(null);
                                                                }}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                            <span className="text-xs text-gray-500 mt-2 truncate w-full text-center px-2">{receiptFile?.name}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Verification Actions MUST BE INSIDE <form> */}
                                <div className="flex gap-3 pt-4 border-t mt-4 pb-4">
                                    <Button
                                        variant="outline"
                                        type="button"
                                        className="flex-1"
                                        onClick={onClose}
                                        disabled={isSubmitting}
                                    >
                                        Bekor qilish
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Yuborilmoqda...
                                            </>
                                        ) : (
                                            'Tasdiqlash'
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
