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
    <div className="flex items-center gap-2.5 rounded-mc-md border border-mc-border bg-mc-surface-2 p-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-mc-sm bg-mc-brand-soft text-mc-brand">
            <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-mc-text-3">
                {label}
            </p>
            <p
                className={cn(
                    'mt-0.5 truncate text-[13px] font-extrabold text-mc-text',
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

    // Closing resets the transient bits. Adjusted during render rather than in
    // an effect: an effect would repaint the sheet once with the stale state
    // still showing, and cascading setState in an effect body is what the
    // react-hooks rule flags.
    const [wasOpen, setWasOpen] = useState(isOpen);
    if (isOpen !== wasOpen) {
        setWasOpen(isOpen);
        if (!isOpen) {
            setCopied(false);
            setPreviewOpen(false);
        }
    }

    // Clamped rather than corrected through state: if the image list shrinks
    // between renders, a stored index would point past the end for one frame.
    const imageCount = data?.images.length ?? 0;
    const safeTab = imageCount > 0 ? Math.min(activeTab, imageCount - 1) : 0;

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

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            // The viewer sits above the sheet, so Escape closes it first.
            if (previewOpen) setPreviewOpen(false);
            else onClose();
        };
        const previousOverflow = document.body.style.overflow;
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen, previewOpen, onClose]);

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
                        className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 34, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 28, scale: 0.98 }}
                            transition={{ type: 'spring', damping: 27, stiffness: 300 }}
                            onClick={(event) => event.stopPropagation()}
                            className="relative z-[10000] flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-mc-xl border border-mc-border bg-mc-surface shadow-2xl sm:rounded-mc-xl"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="china-address-title"
                        >
                            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-mc-border sm:hidden" />

                            <div className="shrink-0 border-b border-mc-border bg-mc-surface px-4 pb-3 pt-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-mc-sm bg-mc-brand-soft text-mc-brand">
                                            <MapPin className="h-[18px] w-[18px]" strokeWidth={2} />
                                        </span>
                                        <div className="min-w-0">
                                            <h2 id="china-address-title" className="truncate text-[16px] font-extrabold text-mc-text">
                                                {t('chinaAddress.title')}
                                            </h2>
                                            <p className="mt-0.5 truncate text-[11px] font-medium text-mc-text-2">
                                                {t('chinaAddress.fullAddress')}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="grid h-9 w-9 shrink-0 place-items-center rounded-mc-md bg-mc-surface-2 text-mc-text-2 transition-transform active:scale-95"
                                        aria-label={t('chinaAddress.close', 'Yopish')}
                                    >
                                        <X className="h-[18px] w-[18px]" strokeWidth={2} />
                                    </button>
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5">
                                {isLoading && (
                                    <div className="flex flex-col items-center justify-center gap-3 py-16">
                                        <Loader2 className="h-8 w-8 animate-spin text-mc-brand" />
                                        <p className="text-[12px] font-medium text-mc-text-2">{t('chinaAddress.loading')}</p>
                                    </div>
                                )}

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex flex-col items-center justify-center gap-4 py-12 text-center"
                                    >
                                        <div className="grid h-14 w-14 place-items-center rounded-mc-lg bg-mc-danger-soft text-mc-danger">
                                            <AlertTriangle className="h-7 w-7" strokeWidth={2} />
                                        </div>
                                        <p className="max-w-xs text-[12px] font-medium leading-snug text-mc-text-2">
                                            {error}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleRetry}
                                            className="inline-flex h-11 items-center gap-2 rounded-mc-md bg-gradient-to-r from-mc-brand to-mc-brand-strong px-5 text-[13px] font-extrabold text-mc-on-brand shadow-[var(--mc-shadow-cta)] transition-transform active:scale-95"
                                        >
                                            <RefreshCw className="h-[15px] w-[15px]" strokeWidth={2} />
                                            {t('chinaAddress.retry')}
                                        </button>
                                    </motion.div>
                                )}

                                {data && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-3"
                                    >
                                        <div className="grid grid-cols-2 gap-2">
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

                                        <div className="overflow-hidden rounded-mc-lg border border-mc-brand/20 bg-mc-brand-soft">
                                            <div className="flex items-center justify-between gap-2 border-b border-mc-brand/20 px-3.5 py-2.5">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <FileText className="h-3.5 w-3.5 text-mc-brand" strokeWidth={2} />
                                                    <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.09em] text-mc-brand">
                                                        {t('chinaAddress.fullAddress')}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleCopy}
                                                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface px-2.5 text-[11px] font-extrabold text-mc-brand transition-transform active:scale-95"
                                                >
                                                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                                    {copied ? t('chinaAddress.copied') : t('chinaAddress.copyButton')}
                                                </button>
                                            </div>
                                            <div className="space-y-1.5 p-3.5">
                                                {addressLines.map((line, index) => (
                                                    <div
                                                        key={`${line}-${index}`}
                                                        className="rounded-mc-sm border border-mc-border bg-mc-surface px-3 py-2"
                                                    >
                                                        <p className="break-words font-mono text-[13px] font-bold leading-snug text-mc-text">
                                                            {line}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleCopy}
                                            className="flex h-12 w-full items-center justify-center gap-2 rounded-mc-md bg-gradient-to-r from-mc-brand to-mc-brand-strong text-[14px] font-extrabold text-mc-on-brand shadow-[var(--mc-shadow-cta)] transition-transform active:scale-[0.98]"
                                        >
                                            {copied ? <Check className="h-[18px] w-[18px]" strokeWidth={2} /> : <Copy className="h-[18px] w-[18px]" strokeWidth={2} />}
                                            {copied ? t('chinaAddress.copied') : t('chinaAddress.copyButton')}
                                        </button>

                                        {data.images.length > 0 && (
                                            <div className="space-y-3">
                                                {data.images.length > 1 && (
                                                    <div className="flex gap-1 rounded-mc-md border border-mc-border bg-mc-surface-2 p-1">
                                                        {data.images.map((url, index) => (
                                                            <button
                                                                key={url}
                                                                type="button"
                                                                onClick={() => setActiveTab(index)}
                                                                className={cn(
                                                                    'min-w-0 flex-1 rounded-mc-sm px-3 py-1.5 text-[12px] font-extrabold transition-colors',
                                                                    safeTab === index
                                                                        ? 'bg-mc-surface text-mc-brand shadow-[var(--mc-shadow-card)]'
                                                                        : 'text-mc-text-2',
                                                                )}
                                                            >
                                                                {getTabLabel(url, index)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                <button
                                                    type="button"
                                                    className="relative aspect-[4/3] w-full overflow-hidden rounded-mc-lg border border-mc-border bg-mc-surface-2"
                                                    onClick={() => openPreview(safeTab)}
                                                >
                                                    {!imageLoaded[safeTab] && (
                                                        <div className="absolute inset-0 grid place-items-center">
                                                            <Loader2 className="h-6 w-6 animate-spin text-mc-brand" />
                                                        </div>
                                                    )}
                                                    <AnimatePresence mode="wait">
                                                        <motion.img
                                                            key={safeTab}
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: imageLoaded[safeTab] ? 1 : 0 }}
                                                            exit={{ opacity: 0 }}
                                                            transition={{ duration: 0.25 }}
                                                            src={data.images[safeTab]}
                                                            alt={getTabLabel(data.images[safeTab], safeTab)}
                                                            className="h-full w-full object-contain"
                                                            onLoad={() => setImageLoaded((prev) => ({ ...prev, [safeTab]: true }))}
                                                        />
                                                    </AnimatePresence>
                                                    <span className="pointer-events-none absolute bottom-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md">
                                                        <ZoomIn className="h-[18px] w-[18px]" strokeWidth={2} />
                                                    </span>
                                                </button>
                                            </div>
                                        )}

                                        {data.warning_text && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="flex gap-2.5 rounded-mc-lg border border-mc-danger/25 bg-mc-danger-soft p-3.5"
                                            >
                                                <AlertTriangle className="mt-px h-[18px] w-[18px] shrink-0 text-mc-danger" strokeWidth={2} />
                                                <p className="text-[12px] font-medium leading-snug text-mc-danger">
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
                                    className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white transition-transform active:scale-95"
                                    aria-label={t('chinaAddress.close', 'Yopish')}
                                >
                                    <X className="h-6 w-6" strokeWidth={2} />
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
                                                    'rounded-mc-sm px-3 py-1.5 text-[12px] font-extrabold backdrop-blur-lg transition-colors',
                                                    previewIndex === index
                                                        ? 'bg-white/25 text-white'
                                                        : 'bg-white/10 text-white/70',
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
                                    className="absolute bottom-6 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-2 rounded-mc-md bg-gradient-to-r from-mc-brand to-mc-brand-strong px-5 py-3 text-[13px] font-extrabold text-mc-on-brand shadow-[var(--mc-shadow-cta)] transition-transform active:scale-95"
                                >
                                    <Download className="h-[18px] w-[18px]" strokeWidth={2} />
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
                                    className="max-h-[80dvh] max-w-full rounded-mc-sm object-contain shadow-2xl"
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
