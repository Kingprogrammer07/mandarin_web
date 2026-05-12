import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertTriangle,
    Check,
    Copy,
    Download,
    FileText,
    Loader2,
    MapPin,
    PackageCheck,
    Phone,
    RefreshCw,
    type LucideIcon,
    X,
    ZoomIn,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { cn } from '@/lib/utils';

interface ChinaAddressData {
    client_code: string;
    phone: string;
    region: string;
    address_line: string;
    full_address_string: string;
    warning_text: string;
    images: string[];
}

interface ChinaAddressModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const IMAGE_TAB_LABELS: Record<string, string> = {
    pindoudou: 'Pinduoduo',
    pinduoduo: 'Pinduoduo',
    taobao: 'Taobao',
};

function getTabLabel(url: string, index: number): string {
    const lower = url.toLowerCase();
    for (const [key, label] of Object.entries(IMAGE_TAB_LABELS)) {
        if (lower.includes(key)) return label;
    }
    return `${index + 1}`;
}

function cleanWarningText(value: string): string {
    return value.replace(/<\/?b>/g, ' ').replace(/⚠/g, '').replace(/\s+/g, ' ').trim();
}

const InfoRow = ({
    icon: Icon,
    label,
    value,
    monospace = false,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    monospace?: boolean;
}) => (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white/80 p-3.5 dark:border-white/[0.075] dark:bg-white/[0.035]">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[15px] border border-orange-200/70 bg-orange-50 text-orange-600 dark:border-orange-300/15 dark:bg-orange-300/[0.10] dark:text-amber-300">
            <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-400 dark:text-white/34">
                {label}
            </p>
            <p
                className={cn(
                    'mt-0.5 truncate text-sm font-bold text-gray-950 dark:text-[#fff8ed]',
                    monospace && 'font-mono tracking-wide',
                )}
            >
                {value}
            </p>
        </div>
    </div>
);

const ChinaAddressModal = ({ isOpen, onClose }: ChinaAddressModalProps) => {
    const { t } = useTranslation();
    const [data, setData] = useState<ChinaAddressData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [imageLoaded, setImageLoaded] = useState<Record<number, boolean>>({});
    const [copied, setCopied] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [previewIndex, setPreviewIndex] = useState(0);

    const isLoading = isOpen && !data && !error;
    const addressLines = useMemo(
        () => data?.full_address_string.split('\n').map((line) => line.trim()).filter(Boolean) ?? [],
        [data],
    );

    useEffect(() => {
        if (!isOpen || data || error) return;
        let cancelled = false;

        apiClient
            .get<ChinaAddressData>('/api/v1/clients/me/china-address')
            .then((res) => {
                if (!cancelled) setData(res.data);
            })
            .catch((err) => {
                if (!cancelled) setError(err?.message ?? t('chinaAddress.error.generic'));
            });

        return () => {
            cancelled = true;
        };
    }, [isOpen, data, error, t]);

    useEffect(() => {
        if (!isOpen) {
            setCopied(false);
            setPreviewOpen(false);
            return;
        }

        if (data?.images.length && activeTab > data.images.length - 1) {
            setActiveTab(0);
        }
    }, [activeTab, data?.images.length, isOpen]);

    const handleRetry = useCallback(() => {
        setError(null);
        setData(null);
        setImageLoaded({});
        setActiveTab(0);
    }, []);

    const handleCopy = useCallback(() => {
        if (!data) return;
        void navigator.clipboard.writeText(data.full_address_string);
        setCopied(true);
        toast.success(t('chinaAddress.toast.copied'));
        window.setTimeout(() => setCopied(false), 2000);
    }, [data, t]);

    const handleDownloadImage = useCallback(async (event: React.MouseEvent, imageUrl: string) => {
        event.stopPropagation();
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `china-warehouse-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.setTimeout(() => window.URL.revokeObjectURL(url), 5000);
            toast.success(t('chinaAddress.toast.downloading'));
        } catch {
            window.open(imageUrl, '_blank', 'noopener,noreferrer');
            toast.error(t('chinaAddress.toast.downloadFailed'));
        }
    }, [t]);

    const openPreview = useCallback((index: number) => {
        setPreviewIndex(index);
        setPreviewOpen(true);
    }, []);

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-4"
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 34, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 28, scale: 0.98 }}
                            transition={{ type: 'spring', damping: 27, stiffness: 300 }}
                            onClick={(event) => event.stopPropagation()}
                            className="relative z-[10000] flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] border border-gray-100 bg-white shadow-[0_-18px_48px_rgba(0,0,0,0.18)] dark:border-white/[0.075] dark:bg-[#080b11] dark:shadow-[0_-24px_70px_rgba(0,0,0,0.58)] sm:rounded-[1.8rem]"
                        >
                            <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-gray-200 dark:bg-white/14 sm:hidden" />

                            <div className="sticky top-0 z-10 shrink-0 border-b border-gray-100 bg-white/88 px-5 pb-4 pt-4 backdrop-blur-xl dark:border-white/[0.075] dark:bg-[#080b11]/92">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[17px] border border-orange-200/70 bg-orange-50 text-orange-600 dark:border-orange-300/15 dark:bg-orange-300/[0.10] dark:text-amber-300">
                                            <MapPin className="h-5 w-5" />
                                        </span>
                                        <div className="min-w-0">
                                            <h2 className="truncate text-lg font-black tracking-tight text-gray-950 dark:text-[#fff8ed]">
                                                {t('chinaAddress.title')}
                                            </h2>
                                            <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-white/42">
                                                {t('chinaAddress.fullAddress')}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-white/42 dark:hover:bg-white/[0.07] dark:hover:text-white"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto px-5 py-4">
                                {isLoading && (
                                    <div className="flex flex-col items-center justify-center gap-3 py-16">
                                        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
                                        <p className="text-sm font-semibold text-gray-400">{t('chinaAddress.loading')}</p>
                                    </div>
                                )}

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex flex-col items-center justify-center gap-4 py-12 text-center"
                                    >
                                        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-500/10">
                                            <AlertTriangle className="h-8 w-8" />
                                        </div>
                                        <p className="max-w-xs text-sm font-semibold leading-relaxed text-gray-600 dark:text-white/58">
                                            {error}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleRetry}
                                            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(245,158,11,0.24)] active:scale-95"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            {t('chinaAddress.retry')}
                                        </button>
                                    </motion.div>
                                )}

                                {data && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-4"
                                    >
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <InfoRow
                                                icon={PackageCheck}
                                                label={t('chinaAddress.clientCode')}
                                                value={data.client_code}
                                                monospace
                                            />
                                            <InfoRow
                                                icon={Phone}
                                                label="Telefon"
                                                value={data.phone}
                                                monospace
                                            />
                                        </div>

                                        <div className="overflow-hidden rounded-[1.35rem] border border-orange-200/70 bg-orange-50/80 dark:border-orange-300/15 dark:bg-orange-300/[0.075]">
                                            <div className="flex items-center justify-between border-b border-orange-200/70 px-4 py-3 dark:border-orange-300/12">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <FileText className="h-4 w-4 text-orange-600 dark:text-amber-300" />
                                                    <p className="text-xs font-black uppercase tracking-wide text-orange-700 dark:text-amber-300">
                                                        {t('chinaAddress.fullAddress')}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleCopy}
                                                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-white px-2.5 text-[11px] font-black text-orange-700 shadow-sm transition-transform active:scale-95 dark:bg-orange-300/[0.12] dark:text-amber-200"
                                                >
                                                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                                    {copied ? t('chinaAddress.copied') : t('chinaAddress.copyButton')}
                                                </button>
                                            </div>
                                            <div className="space-y-2 p-4">
                                                {addressLines.map((line, index) => (
                                                    <div
                                                        key={`${line}-${index}`}
                                                        className="rounded-2xl border border-white/70 bg-white/76 px-3 py-2.5 dark:border-white/[0.065] dark:bg-[#0a0e15]/72"
                                                    >
                                                        <p className="break-words font-mono text-sm font-bold leading-relaxed text-gray-900 dark:text-[#fff8ed]">
                                                            {line}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleCopy}
                                            className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[1.15rem] bg-gradient-to-r from-orange-500 to-amber-400 text-base font-black text-white shadow-[0_14px_30px_rgba(245,158,11,0.24)] transition-transform active:scale-[0.98]"
                                        >
                                            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                                            {copied ? t('chinaAddress.copied') : t('chinaAddress.copyButton')}
                                        </button>

                                        {data.images.length > 0 && (
                                            <div className="space-y-3">
                                                {data.images.length > 1 && (
                                                    <div className="flex gap-1.5 rounded-2xl border border-gray-100 bg-gray-50 p-1 dark:border-white/[0.075] dark:bg-white/[0.035]">
                                                        {data.images.map((url, index) => (
                                                            <button
                                                                key={url}
                                                                type="button"
                                                                onClick={() => setActiveTab(index)}
                                                                className={cn(
                                                                    'min-w-0 flex-1 rounded-xl px-3 py-2 text-xs font-black transition-all',
                                                                    activeTab === index
                                                                        ? 'bg-white text-orange-700 shadow-sm dark:bg-orange-300/[0.12] dark:text-amber-300'
                                                                        : 'text-gray-500 hover:text-gray-800 dark:text-white/38 dark:hover:text-white/70',
                                                                )}
                                                            >
                                                                {getTabLabel(url, index)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                <button
                                                    type="button"
                                                    className="group relative aspect-[4/3] w-full overflow-hidden rounded-[1.35rem] border border-gray-100 bg-gray-50 dark:border-white/[0.075] dark:bg-white/[0.035]"
                                                    onClick={() => openPreview(activeTab)}
                                                >
                                                    {!imageLoaded[activeTab] && (
                                                        <div className="absolute inset-0 grid place-items-center">
                                                            <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
                                                        </div>
                                                    )}
                                                    <AnimatePresence mode="wait">
                                                        <motion.img
                                                            key={activeTab}
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: imageLoaded[activeTab] ? 1 : 0 }}
                                                            exit={{ opacity: 0 }}
                                                            transition={{ duration: 0.25 }}
                                                            src={data.images[activeTab]}
                                                            alt={getTabLabel(data.images[activeTab], activeTab)}
                                                            className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                                                            onLoad={() => setImageLoaded((prev) => ({ ...prev, [activeTab]: true }))}
                                                        />
                                                    </AnimatePresence>
                                                    <span className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-black/42 text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
                                                        <ZoomIn className="h-5 w-5" />
                                                    </span>
                                                </button>
                                            </div>
                                        )}

                                        {data.warning_text && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="flex gap-3 rounded-[1.2rem] border border-red-200 bg-red-50 p-4 dark:border-red-400/18 dark:bg-red-500/[0.08]"
                                            >
                                                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                                                <p className="text-sm font-semibold leading-relaxed text-red-700 dark:text-red-200">
                                                    {cleanWarningText(data.warning_text)}
                                                </p>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>

                    <AnimatePresence>
                        {previewOpen && data?.images[previewIndex] && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setPreviewOpen(false)}
                                className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/92 p-4 backdrop-blur-md"
                            >
                                <button
                                    type="button"
                                    onClick={() => setPreviewOpen(false)}
                                    className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                                >
                                    <X className="h-6 w-6" />
                                </button>

                                {data.images.length > 1 && (
                                    <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 gap-2">
                                        {data.images.map((url, index) => (
                                            <button
                                                key={url}
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setPreviewIndex(index);
                                                }}
                                                className={cn(
                                                    'rounded-xl px-3 py-2 text-xs font-black backdrop-blur-lg transition-all',
                                                    previewIndex === index
                                                        ? 'bg-white/20 text-white'
                                                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white',
                                                )}
                                            >
                                                {getTabLabel(url, index)}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={(event) => handleDownloadImage(event, data.images[previewIndex])}
                                    className="absolute bottom-6 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(245,158,11,0.24)] active:scale-95"
                                >
                                    <Download className="h-5 w-5" />
                                    {t('chinaAddress.downloadButton')}
                                </button>

                                <motion.img
                                    key={previewIndex}
                                    initial={{ scale: 0.92, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.92, opacity: 0 }}
                                    onClick={(event) => event.stopPropagation()}
                                    src={data.images[previewIndex]}
                                    alt="Full preview"
                                    className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </AnimatePresence>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
};

export default memo(ChinaAddressModal);
