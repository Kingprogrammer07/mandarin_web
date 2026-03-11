import { useState, useEffect, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Copy, Check, MapPin, Loader2, Download,
    ZoomIn, 
    // Phone, 
    AlertTriangle, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';

// --- Types ---
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

// --- Image tab labels (keyed by filename substring) ---
const IMAGE_TAB_LABELS: Record<string, string> = {
    pindoudou: 'Pinduoduo',
    taobao: 'Taobao',
};

function getTabLabel(url: string, index: number): string {
    const lower = url.toLowerCase();
    for (const [key, label] of Object.entries(IMAGE_TAB_LABELS)) {
        if (lower.includes(key)) return label;
    }
    return `${index + 1}`;
}

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

    // Fetch from real API
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

        return () => { cancelled = true; };
    }, [isOpen, data, error, t]);

    const handleRetry = useCallback(() => {
        setError(null);
        setData(null);
    }, []);

    const handleCopy = useCallback(() => {
        if (!data) return;
        navigator.clipboard.writeText(data.full_address_string);
        setCopied(true);
        toast.success(t('chinaAddress.toast.copied'));
        setTimeout(() => setCopied(false), 2000);
    }, [data, t]);

    const handleDownloadImage = useCallback(async (e: React.MouseEvent, imageUrl: string) => {
        e.stopPropagation();
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
            setTimeout(() => window.URL.revokeObjectURL(url), 5000);
            toast.success(t('chinaAddress.toast.downloading'));
        } catch {
            window.open(imageUrl, '_blank');
            toast.error(t('chinaAddress.toast.downloadFailed'));
        }
    }, [t]);

    const openPreview = useCallback((index: number) => {
        setPreviewIndex(index);
        setPreviewOpen(true);
    }, []);

    // --- Portal content ---
    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                    >
                        {/* Modal Card */}
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-[#1a1b1e] w-full max-w-md max-h-[90vh] rounded-3xl overflow-y-auto shadow-2xl border border-white/10 relative z-[10000]"
                        >
                            {/* Header */}
                            <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/5 bg-white/80 dark:bg-[#1a1b1e]/80 backdrop-blur-md">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                                    <MapPin className="w-5 h-5 text-orange-500 fill-orange-500/20" />
                                    {t('chinaAddress.title')}
                                </h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-500"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-5 space-y-4">
                                {/* --- Loading State --- */}
                                {isLoading && (
                                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                                        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                                        <p className="text-sm text-gray-400">{t('chinaAddress.loading')}</p>
                                    </div>
                                )}

                                {/* --- Error State --- */}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex flex-col items-center justify-center py-12 gap-4"
                                    >
                                        <div className="p-4 rounded-full bg-red-50 dark:bg-red-500/10">
                                            <AlertTriangle className="w-8 h-8 text-red-500" />
                                        </div>
                                        <p className="text-center text-gray-600 dark:text-gray-300 text-sm max-w-xs">
                                            {error}
                                        </p>
                                        <button
                                            onClick={handleRetry}
                                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors active:scale-95"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            {t('chinaAddress.retry')}
                                        </button>
                                    </motion.div>
                                )}

                                {/* --- Data Loaded --- */}
                                {data && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.1 }}
                                        className="space-y-4"
                                    >
                                        {/* Client Code Badge */}
                                        {/* <motion.div
                                            initial={{ scale: 0.9, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ type: 'spring', damping: 20, stiffness: 260 }}
                                            className="text-center"
                                        >
                                            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-500/25">
                                                <span className="text-white/80 text-sm font-medium">{t('chinaAddress.clientCode')}</span>
                                                <span className="text-white text-2xl font-extrabold tracking-wider">{data.client_code}</span>
                                            </div>
                                        </motion.div> */}

                                        {/* Phone */}
                                        {/* <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                            <Phone className="w-4 h-4 text-orange-500 shrink-0" />
                                            <span className="text-base font-mono font-semibold text-gray-800 dark:text-gray-200">{data.phone}</span>
                                        </div> */}

                                        {/* Address Card */}
                                        <div className="bg-orange-50 dark:bg-orange-500/10 rounded-2xl p-4 border border-orange-100 dark:border-orange-500/20 space-y-1">
                                            <p className="text-sm text-gray-500 dark:text-orange-200/70 font-medium">
                                                {t('chinaAddress.fullAddress')}
                                            </p>
                                            <div className="text-base font-mono font-bold text-gray-900 dark:text-orange-100 leading-relaxed whitespace-pre-wrap break-words">
                                                {data.full_address_string.split('\n').filter(Boolean).map((line, i) => (
                                                    <div key={i} className="mb-1 last:mb-0">{line}</div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Copy Button — large & obvious */}
                                        <button
                                            onClick={handleCopy}
                                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-lg shadow-lg shadow-orange-500/25 active:scale-[0.97] transition-all flex items-center justify-center gap-3 group"
                                        >
                                            {copied ? (
                                                <>
                                                    <Check className="w-7 h-7" />
                                                    <span className="text-xl">{t('chinaAddress.copied')}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-7 h-7 group-hover:rotate-12 transition-transform" />
                                                    <span className="text-xl">{t('chinaAddress.copyButton')}</span>
                                                </>
                                            )}
                                        </button>

                                        {/* Image Tabs */}
                                        {data.images.length > 0 && (
                                            <div className="space-y-3">
                                                {/* Tab selector */}
                                                {data.images.length > 1 && (
                                                    <div className="flex gap-2 p-1 rounded-xl bg-gray-100 dark:bg-white/5">
                                                        {data.images.map((url, i) => (
                                                            <button
                                                                key={i}
                                                                onClick={() => setActiveTab(i)}
                                                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                                                                    activeTab === i
                                                                        ? 'bg-white dark:bg-white/10 text-orange-600 dark:text-orange-400 shadow-sm'
                                                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                                                }`}
                                                            >
                                                                {getTabLabel(url, i)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Active image */}
                                                <div
                                                    className="relative w-full aspect-[4/3] bg-gray-100 dark:bg-white/5 rounded-2xl overflow-hidden group cursor-pointer"
                                                    onClick={() => openPreview(activeTab)}
                                                >
                                                    {!imageLoaded[activeTab] && (
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <Loader2 className="w-7 h-7 text-orange-500 animate-spin" />
                                                        </div>
                                                    )}
                                                    <AnimatePresence mode="wait">
                                                        <motion.img
                                                            key={activeTab}
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: imageLoaded[activeTab] ? 1 : 0 }}
                                                            exit={{ opacity: 0 }}
                                                            transition={{ duration: 0.3 }}
                                                            src={data.images[activeTab]}
                                                            alt={getTabLabel(data.images[activeTab], activeTab)}
                                                            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                                                            onLoad={() => setImageLoaded((prev) => ({ ...prev, [activeTab]: true }))}
                                                        />
                                                    </AnimatePresence>
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                        <div className="bg-black/50 p-2 rounded-full text-white backdrop-blur-sm">
                                                            <ZoomIn className="w-6 h-6" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Warning Banner */}
                                        {data.warning_text && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.25 }}
                                                className="flex gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20"
                                            >
                                                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                                <p className="text-sm font-medium text-red-700 dark:text-red-300 leading-relaxed">
                                                    {data.warning_text.replace(/<\/?b>/g, ' ').replace(/⚠/g, '').trim()}
                                                </p>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Fullscreen Image Preview */}
                    <AnimatePresence>
                        {previewOpen && data && data.images[previewIndex] && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setPreviewOpen(false)}
                                className="fixed inset-0 bg-black/90 z-[11000] flex items-center justify-center p-4 backdrop-blur-md"
                                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                            >
                                <button
                                    onClick={() => setPreviewOpen(false)}
                                    className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
                                >
                                    <X className="w-6 h-6" />
                                </button>

                                {/* Preview tab switcher */}
                                {data.images.length > 1 && (
                                    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                                        {data.images.map((url, i) => (
                                            <button
                                                key={i}
                                                onClick={(e) => { e.stopPropagation(); setPreviewIndex(i); }}
                                                className={`px-4 py-2 rounded-lg text-sm font-semibold backdrop-blur-lg transition-all ${
                                                    previewIndex === i
                                                        ? 'bg-white/20 text-white'
                                                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                                }`}
                                            >
                                                {getTabLabel(url, i)}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="absolute bottom-6 left-0 right-0 px-4 flex items-center justify-center gap-3 z-20">
                                    <button
                                        onClick={(e) => handleDownloadImage(e, data.images[previewIndex])}
                                        className="px-6 py-3.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 backdrop-blur-lg rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-orange-500/20"
                                    >
                                        <Download className="w-5 h-5" />
                                        {t('chinaAddress.downloadButton')}
                                    </button>
                                </div>

                                <motion.img
                                    key={previewIndex}
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    onClick={(e) => e.stopPropagation()}
                                    src={data.images[previewIndex]}
                                    alt="Full Preview"
                                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
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
