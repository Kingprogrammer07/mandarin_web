import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Loader2, ChevronLeft, FileText, Calendar as CalendarIcon, X, Copy } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { passportService, type ExtraPassport } from '@/api/services/passportService';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { formSchema } from '@/lib/validation';
import { z } from 'zod';
import { format, parse, isValid } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import ImageUpload from '@/components/ImageUpload';
import TranslatedFormMessage from '@/components/TranslatedFormMessage';

const addPassportSchema = formSchema.pick({
    passportSeries: true,
    pinfl: true,
    dateOfBirth: true,
    passportImages: true
});

type AddPassportFormValues = z.infer<typeof addPassportSchema>;

interface ExtraPassportsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Drawer animation variants
const drawerVariants: Variants = {
    hidden: {
        y: "100%",
        x: 0,
        opacity: 0.5
    },
    visible: {
        y: 0,
        x: 0,
        opacity: 1,
        transition: { type: "spring", damping: 25, stiffness: 200 }
    },
    exit: {
        y: "100%",
        x: 0,
        opacity: 0,
        transition: { ease: "easeInOut", duration: 0.2 }
    }
};

const desktopDrawerVariants: Variants = {
    hidden: {
        x: "100%",
        y: 0,
        opacity: 0.5
    },
    visible: {
        x: 0,
        y: 0,
        opacity: 1,
        transition: { type: "spring", damping: 30, stiffness: 300 }
    },
    exit: {
        x: "100%",
        y: 0,
        opacity: 0,
        transition: { ease: "easeInOut", duration: 0.2 }
    }
};

// Inner content slide variants
const slideVariants: Variants = {
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

export function ExtraPassportsModal({ isOpen, onClose }: ExtraPassportsModalProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [selectedPassport, setSelectedPassport] = useState<ExtraPassport | null>(null);
    const [isDesktop, setIsDesktop] = useState(false);

    // Form States
    const [frontImage, setFrontImage] = useState<File | null>(null);
    const [backImage, setBackImage] = useState<File | null>(null);
    const [dateInputValue, setDateInputValue] = useState('');
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    // Check for desktop size
    useEffect(() => {
        const checkDesktop = () => setIsDesktop(window.innerWidth >= 640);
        checkDesktop();
        window.addEventListener('resize', checkDesktop);
        return () => window.removeEventListener('resize', checkDesktop);
    }, []);

    const form = useForm<AddPassportFormValues>({
        resolver: zodResolver(addPassportSchema),
        defaultValues: {
            passportSeries: '',
            pinfl: '',
            passportImages: []
        }
    });

    // Fetch passports
    const { data: passportsData, isLoading } = useQuery({
        queryKey: ['extra-passports'],
        queryFn: () => passportService.getPassports(1, 100),
        enabled: isOpen,
    });

    // Mutations
    const createPassportMutation = useMutation({
        mutationFn: passportService.createPassport,
        onSuccess: () => {
            toast.success(t('form.messages.success') || "Pasport muvaffaqiyatli qo'shildi");
            queryClient.invalidateQueries({ queryKey: ['extra-passports'] });
            handleBack();
        },
        onError: (error: unknown) => {
            const msg = (() => {
                if (typeof error === 'object' && error !== null) {
                    const e = error as { message?: string; data?: { detail?: string } };
                    return e.data?.detail ?? e.message ?? null;
                }
                return null;
            })() || t('form.messages.generalError') || "Pasport qo'shishda xatolik";

            toast.error(msg);
        }
    });

    const deletePassportMutation = useMutation({
        mutationFn: passportService.deletePassport,
        onSuccess: () => {
            toast.success(t('common.deleted') || "Pasport o'chirildi");
            queryClient.invalidateQueries({ queryKey: ['extra-passports'] });
        },
        onError: () => {
            toast.error(t('common.error') || "Xatolik yuz berdi");
        }
    });

    const onSubmit = (data: AddPassportFormValues) => {
        const formattedDate = format(data.dateOfBirth, 'yyyy-MM-dd');
        createPassportMutation.mutate({
            passport_series: data.passportSeries.toUpperCase(),
            pinfl: data.pinfl,
            date_of_birth: formattedDate,
            images: data.passportImages
        });
    };

    const handleDelete = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(t('common.confirmDelete') || "O'chirishni tasdiqlaysizmi?")) {
            deletePassportMutation.mutate(id);
        }
    };

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} ${t('common.copied') || 'nusxalandi'}`);
    };

    const handleBack = () => {
        setIsAdding(false);
        form.reset();
        setFrontImage(null);
        setBackImage(null);
        setDateInputValue('');
    };

    const handlePassportInput = (v: string) => {
        const c = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return c.substring(0, 2) + (c.length > 2 ? c.substring(2, 9) : '');
    };

    const handleDateInput = (v: string, onChange: (d?: Date) => void) => {
        // Only allow numbers and slashes
        let c = v.replace(/[^\d/]/g, '');

        // If the user is deleting (new value is shorter than old state), just update state
        if (c.length < dateInputValue.length) {
            setDateInputValue(c);
            // Clear the actual form value if it's no longer a complete valid date
            if (c.length < 10) onChange(undefined);
            return;
        }

        // Auto-insert slashes
        if (c.length === 2 && !c.includes('/')) c += '/';
        if (c.length === 5 && c.split('/').length === 2) c += '/';

        // Max length 10 (DD/MM/YYYY)
        if (c.length > 10) c = c.substring(0, 10);

        setDateInputValue(c);

        // If complete, try to parse
        if (c.length === 10) {
            const d = parse(c, 'dd/MM/yyyy', new Date());
            if (isValid(d)) onChange(d);
        }
    };

    const inp = [
        'h-12 rounded-xl',
        'border border-gray-200 dark:border-white/10',
        'bg-gray-50 dark:bg-white/5',
        'text-gray-900 dark:text-white',
        'placeholder:text-gray-400 dark:placeholder:text-gray-500',
        'transition-colors duration-150',
        'focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:ring-offset-0 focus:outline-none',
    ].join(' ');

    return (
        <>
            {/* Drawer Portal */}
            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/60 z-[999] backdrop-blur-sm"
                                onClick={onClose}
                            />

                            {/* Drawer Content */}
                            <motion.div
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                variants={isDesktop ? desktopDrawerVariants : drawerVariants}
                                className="fixed bottom-0 left-0 right-0 sm:left-auto sm:top-0 sm:bottom-0 sm:w-[450px] h-[92vh] sm:h-screen bg-white dark:bg-zinc-950 z-[999] rounded-t-3xl sm:rounded-none sm:rounded-l-3xl flex flex-col shadow-2xl border-t border-gray-200 dark:border-gray-800 sm:border-t-0 sm:border-l"
                            >
                                {/* Header */}
                                <div className="p-4 border-b dark:border-zinc-800 flex items-center justify-between flex-shrink-0 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm rounded-t-3xl sm:rounded-t-none">
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
                                        <h2 className="text-lg font-semibold">{isAdding ? t('passport.addNew', "Yangi pasport") : t('passport.extraPassports', "Qo'shimcha pasportlar")}</h2>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
                                        <X className="h-5 w-5" />
                                    </Button>
                                </div>

                                {/* Scrollable Body */}
                                <div className="flex-1 relative overflow-hidden bg-gray-50/50 dark:bg-zinc-950">
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
                                                className="absolute inset-0 overflow-y-auto p-4 pb-24"
                                            >
                                                <Form {...form}>
                                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                                        {/* Pasport Seriyasi */}
                                                        <FormField control={form.control} name="passportSeries" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="font-semibold text-sm text-gray-700 dark:text-gray-200 tracking-wide">
                                                                    {t('form.passportSeries')}
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <div className="relative">
                                                                        <Input
                                                                            placeholder={t('form.passportSeriesPlaceholder') || "AA1234567"}
                                                                            {...field}
                                                                            onChange={(e) => field.onChange(handlePassportInput(e.target.value))}
                                                                            maxLength={9}
                                                                            className={`${inp} uppercase font-mono tracking-widest placeholder:tracking-normal placeholder:font-normal`}
                                                                        />
                                                                    </div>
                                                                </FormControl>
                                                                <TranslatedFormMessage />
                                                            </FormItem>
                                                        )} />

                                                        {/* PINFL */}
                                                        <FormField control={form.control} name="pinfl" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="font-semibold text-sm text-gray-700 dark:text-gray-200 tracking-wide">
                                                                    {t('form.pinfl')}
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        placeholder={t('form.pinflPlaceholder') || "14 ta raqam"}
                                                                        {...field}
                                                                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                                                                        maxLength={14}
                                                                        className={`${inp} font-mono tracking-wider placeholder:tracking-normal placeholder:font-normal`}
                                                                    />
                                                                </FormControl>
                                                                <TranslatedFormMessage />
                                                            </FormItem>
                                                        )} />

                                                        {/* Tug'ilgan sana */}
                                                        <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                                                            <FormItem className="flex flex-col">
                                                                <FormLabel className="font-semibold text-sm text-gray-700 dark:text-gray-200 tracking-wide">
                                                                    {t('form.dateOfBirth')}
                                                                </FormLabel>
                                                                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                                                    <div className="relative">
                                                                        <Input
                                                                            placeholder="DD/MM/YYYY"
                                                                            value={field.value ? format(field.value, 'dd/MM/yyyy') : dateInputValue}
                                                                            onChange={(e) => handleDateInput(e.target.value, field.onChange)}
                                                                            onFocus={() => { if (!dateInputValue && !field.value) setDateInputValue(''); }}
                                                                            className={`${inp} pr-12 font-mono tracking-widest placeholder:tracking-normal placeholder:font-normal`}
                                                                        />
                                                                        <PopoverTrigger asChild>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10"
                                                                            >
                                                                                <CalendarIcon className="h-4 w-4 text-orange-400" />
                                                                            </Button>
                                                                        </PopoverTrigger>
                                                                    </div>
                                                                    <PopoverContent
                                                                        align="start"
                                                                        className="w-auto p-0 z-[1050] dark:bg-[#1a1209] dark:border-orange-500/20 rounded-2xl overflow-hidden shadow-xl"
                                                                    >
                                                                        <Calendar
                                                                            mode="single"
                                                                            selected={field.value}
                                                                            onSelect={(date) => {
                                                                                field.onChange(date);
                                                                                if (date) {
                                                                                    setDateInputValue(format(date, 'dd/MM/yyyy'));
                                                                                    setIsCalendarOpen(false);
                                                                                }
                                                                            }}
                                                                            disabled={(d) => d > new Date() || d < new Date('1900-01-01')}
                                                                            captionLayout="dropdown"
                                                                            fromYear={1900}
                                                                            toYear={new Date().getFullYear()}
                                                                        />
                                                                    </PopoverContent>
                                                                </Popover>
                                                                <TranslatedFormMessage />
                                                            </FormItem>
                                                        )} />

                                                        {/* Rasmlar */}
                                                        <FormField control={form.control} name="passportImages" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="font-semibold text-base text-gray-700 dark:text-gray-200">
                                                                    {t('form.passportImages')}
                                                                </FormLabel>
                                                                <div className="grid grid-cols-1 gap-4 mt-2">
                                                                    <ImageUpload
                                                                        label={t('form.passportImagesFront', "Old tomon")}
                                                                        value={frontImage}
                                                                        onChange={(file) => {
                                                                            setFrontImage(file);
                                                                            const currentBack = backImage;
                                                                            const newImages = [file, currentBack].filter((f): f is File => f !== null);
                                                                            field.onChange(newImages);
                                                                        }}
                                                                        error={
                                                                            form.formState.errors.passportImages?.message
                                                                                ? t(form.formState.errors.passportImages.message)
                                                                                : undefined
                                                                        }
                                                                    />
                                                                    <ImageUpload
                                                                        label={t('form.passportImagesBack', "Orqa tomon")}
                                                                        value={backImage}
                                                                        onChange={(file) => {
                                                                            setBackImage(file);
                                                                            const currentFront = frontImage;
                                                                            const newImages = [currentFront, file].filter((f): f is File => f !== null);
                                                                            field.onChange(newImages);
                                                                        }}
                                                                    />
                                                                </div>
                                                                <TranslatedFormMessage />
                                                            </FormItem>
                                                        )} />

                                                        <Button
                                                            type="submit"
                                                            disabled={createPassportMutation.isPending}
                                                            className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 sticky bottom-0 z-10"
                                                        >
                                                            {createPassportMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                                            {createPassportMutation.isPending ? t('common.saving', "Saqlanmoqda...") : t('common.save', "Saqlash")}
                                                        </Button>
                                                    </form>
                                                </Form>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="passports-list"
                                                custom={-1}
                                                variants={slideVariants}
                                                initial="enter"
                                                animate="center"
                                                exit="exit"
                                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                className="absolute inset-0 overflow-y-auto p-4 pb-24"
                                            >
                                                {isLoading ? (
                                                    <div className="flex justify-center p-8">
                                                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                                    </div>
                                                ) : passportsData?.items.length === 0 ? (
                                                    <div className="text-center py-12 text-gray-500 flex flex-col items-center">
                                                        <div className="h-16 w-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                                            <FileText className="h-8 w-8 text-gray-400" />
                                                        </div>
                                                        <p className="font-medium mb-1">{t('passport.noPassports', "Hozircha pasportlar yo'q")}</p>
                                                        <p className="text-sm text-gray-400 mb-6 max-w-xs">{t('passport.addPrompt', "Yangi pasport qo'shish uchun pastdagi tugmani bosing")}</p>
                                                        <Button
                                                            onClick={() => setIsAdding(true)}
                                                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6"
                                                        >
                                                            <Plus className="h-4 w-4 mr-2" />
                                                            {t('passport.add', "Pasport qo'shish")}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {passportsData?.items.map((passport, index) => (
                                                            <motion.div
                                                                key={passport.id}
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: index * 0.1 }}
                                                                className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-900 p-4 border border-gray-200 dark:border-gray-800 shadow-sm cursor-pointer hover:bg-white dark:hover:bg-zinc-900 hover:border-gray-300 dark:hover:border-gray-700 transition-all"
                                                                onClick={() => setSelectedPassport(passport)}
                                                            >
                                                                <div className="flex gap-4 items-center">
                                                                    {/* Image Thumbnail */}
                                                                    <div className="h-16 w-16 rounded-md bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700">
                                                                        {passport.image_urls && passport.image_urls[0] ? (
                                                                            <img
                                                                                src={passport.image_urls[0]}
                                                                                alt="Passport"
                                                                                className="h-full w-full object-cover"
                                                                            />
                                                                        ) : (
                                                                            <div className="h-full w-full flex items-center justify-center text-gray-400">
                                                                                <FileText className="h-6 w-6" />
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex-1 min-w-0">
                                                                        <h3 className="font-semibold text-lg truncate">{passport.passport_series}</h3>
                                                                        <p className="text-sm text-gray-500 truncate">{t('form.pinfl', 'JSHSHIR (PINFL)')}: {passport.pinfl}</p>
                                                                        <p className="text-xs text-gray-400 mt-1">{passport.date_of_birth}</p>
                                                                    </div>

                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-10 w-10 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                        onClick={(e) => handleDelete(passport.id, e)}
                                                                    >
                                                                        <Trash2 className="h-5 w-5" />
                                                                    </Button>
                                                                </div>
                                                            </motion.div>
                                                        ))}

                                                        <Button
                                                            variant="outline"
                                                            className="w-full border-dashed border-2 py-6 text-gray-500 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors mt-6"
                                                            onClick={() => setIsAdding(true)}
                                                        >
                                                            <Plus className="h-4 w-4 mr-2" />
                                                            {t('passport.addNewFull', "Yangi pasport qo'shish")}
                                                        </Button>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* Passport Preview Overlay */}
            {createPortal(
                <AnimatePresence>
                    {selectedPassport && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-md overflow-y-auto"
                            onClick={() => setSelectedPassport(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="relative w-full max-w-4xl mx-auto min-h-full flex flex-col justify-center p-4 py-16 sm:p-8"
                            >
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-4 right-4 sm:fixed sm:top-6 sm:right-6 z-[1010] text-white/70 hover:text-white hover:bg-white/10 rounded-full bg-black/20"
                                    onClick={() => setSelectedPassport(null)}
                                >
                                    <X className="h-8 w-8" />
                                </Button>

                                <div className="w-full grid md:grid-cols-2 gap-6 items-start">
                                    {/* Images */}
                                    <div className="space-y-4">
                                        {selectedPassport.image_urls?.map((url, idx) => (
                                            <div key={idx} className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-gray-900">
                                                <img
                                                    src={url}
                                                    alt={`Passport ${idx + 1}`}
                                                    className="w-full h-auto object-cover"
                                                />
                                            </div>
                                        ))}
                                        {(!selectedPassport.image_urls || selectedPassport.image_urls.length === 0) && (
                                            <div className="h-64 rounded-2xl bg-gray-800 flex items-center justify-center text-gray-500">
                                                <FileText className="h-12 w-12 opacity-50" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Details Panel */}
                                    <div className="glass-panel p-6 rounded-3xl bg-white/10 backdrop-blur-md border border-white/10 text-white shadow-xl md:sticky md:top-8">
                                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                            <FileText className="h-6 w-6 text-emerald-400" />
                                            {t('passport.details', "Pasport ma'lumotlari")}
                                        </h3>

                                        <div className="space-y-6">
                                            <div className="relative group">
                                                <p className="text-sm text-gray-300 mb-1">{t('form.passportSeries', "Pasport seriyasi va raqami")}</p>
                                                <div className="flex items-center gap-3">
                                                    <p className="text-2xl font-mono font-semibold tracking-wider">{selectedPassport.passport_series}</p>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10 rounded-lg opacity-100 md:opacity-0 group-hover:opacity-100 transition-all"
                                                        onClick={() => handleCopy(selectedPassport.passport_series, t('form.passportSeries'))}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="my-4 h-px bg-white/10" />

                                            <div className="relative group">
                                                <p className="text-sm text-gray-300 mb-1">{t('form.pinfl', "JSHSHIR (PINFL)")}</p>
                                                <div className="flex items-center gap-3">
                                                    <p className="text-xl font-mono font-medium tracking-widest">{selectedPassport.pinfl}</p>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10 rounded-lg opacity-100 md:opacity-0 group-hover:opacity-100 transition-all"
                                                        onClick={() => handleCopy(selectedPassport.pinfl, t('form.pinfl'))}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="my-4 h-px bg-white/10" />

                                            <div>
                                                <p className="text-sm text-gray-300 mb-1">{t('form.dateOfBirth', "Tug'ilgan sana")}</p>
                                                <p className="text-lg font-medium flex items-center gap-2">
                                                    <CalendarIcon className="h-4 w-4 text-emerald-400" />
                                                    {selectedPassport.date_of_birth}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}
