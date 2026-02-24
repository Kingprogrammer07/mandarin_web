import { useState, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, MapPin, Loader2, Download, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';

// --- Mock Data & API ---
const MOCK_DATA = {
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop", // Warehouse-like image
    addressText: `收货人：SS4457\n
电话:18161955318\n
西安市 雁塔区 丈八沟街道\n
高新区丈八六路49号103室中京仓库 SS4457`,
};

const fetchChinaAddress = async () => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return MOCK_DATA;
};

interface ChinaAddressModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ChinaAddressModal = ({ isOpen, onClose }: ChinaAddressModalProps) => {
    const [data, setData] = useState<{ imageUrl: string; addressText: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [copied, setCopied] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);

    // Fetch data when opened
    useEffect(() => {
        if (isOpen && !data) {
            // Avoid setState here; loading state is managed by fetchChinaAddress's promise chain

            fetchChinaAddress()
                .then(setData)
                .finally(() => setLoading(false));
        }
    }, [isOpen, data]);

    const handleCopy = useCallback(() => {
        if (!data?.addressText) return;
        navigator.clipboard.writeText(data.addressText.replace(/\n/g, ' '));
        setCopied(true);
        toast.success("Manzil nusxalandi!");
        setTimeout(() => setCopied(false), 2000);
    }, [data]);

    const handleDownload = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!data?.imageUrl) return;

        try {
            const response = await fetch(data.imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `china-warehouse-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => window.URL.revokeObjectURL(url), 5000);
            toast.success("Rasm yuklab olinmoqda...");
        } catch (error) {
            console.error('Download error:', error);
            window.open(data.imageUrl, '_blank');
            toast.error("Yuklab bo'lmadi. Rasm yangi oynada ochildi.");
        }
    }, [data]);

    // Portal content
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
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 bg-opacity-ensure"
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                    >
                        {/* Modal Content */}
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-[#1a1b1e] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative z-[10000]"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/5">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                                    <MapPin className="text-orange-500 fill-orange-500/20" />
                                    Xitoy Ombor Manzili
                                </h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-500"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-0">
                                {/* Media Area */}
                                <div
                                    className="relative w-full h-48 bg-gray-100 dark:bg-white/5 group cursor-pointer overflow-hidden"
                                    onClick={() => data && setPreviewOpen(true)}
                                >
                                    {(loading || !data) && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                                        </div>
                                    )}

                                    {data && (
                                        <>
                                            <motion.img
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: imageLoaded ? 1 : 0 }}
                                                transition={{ duration: 0.5 }}
                                                src={data.imageUrl}
                                                alt="China Warehouse"
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                onLoad={() => setImageLoaded(true)}
                                            />
                                            {/* Hover Overlay */}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <div className="bg-black/50 p-2 rounded-full text-white backdrop-blur-sm">
                                                    <ZoomIn className="w-6 h-6" />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Address Area */}
                                <div className="p-5 space-y-4">
                                    <div className="bg-orange-50 dark:bg-orange-500/10 rounded-2xl p-4 border border-orange-100 dark:border-orange-500/20">
                                        <p className="text-sm text-gray-500 dark:text-orange-200/70 mb-1 font-medium">
                                            To'liq manzil:
                                        </p>
                                        <div className="text-lg font-mono font-bold text-gray-900 dark:text-orange-100 break-all leading-relaxed whitespace-pre-wrap">
                                            {loading ? (
                                                <div className="h-16 bg-gray-200 dark:bg-white/10 rounded-lg animate-pulse" />
                                            ) : (
                                                data?.addressText.split('\n').filter(Boolean).map((line, index) => (
                                                    <div key={index} className="mb-1 last:mb-0">{line}</div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <button
                                        onClick={handleCopy}
                                        disabled={loading || !data}
                                        className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-lg shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {copied ? (
                                            <>
                                                <Check className="w-6 h-6" />
                                                Nusxalandi
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                                                Manzilni Nusxalash
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Fullscreen Image Preview */}
                    <AnimatePresence>
                        {previewOpen && data && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setPreviewOpen(false)}
                                className="fixed inset-0 bg-black/90 z-[11000] flex items-center justify-center p-4 backdrop-blur-md"
                                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                            >
                                {/* Close Button */}
                                <button
                                    onClick={() => setPreviewOpen(false)}
                                    className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
                                >
                                    <X className="w-6 h-6" />
                                </button>

                                {/* Action Buttons */}
                                <div className="absolute bottom-6 left-0 right-0 px-4 flex flex-col sm:flex-row items-center justify-center gap-3 z-20">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!data?.imageUrl) return;
                                            window.open(data.imageUrl, '_blank');
                                        }}
                                        className="w-full sm:w-auto px-6 py-3.5 bg-white/10 hover:bg-white/20 backdrop-blur-lg rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-all active:scale-95 border border-white/10"
                                    >
                                        <ZoomIn className="w-5 h-5" />
                                        Ochish
                                    </button>
                                    <button
                                        onClick={handleDownload}
                                        className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 backdrop-blur-lg rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-orange-500/20"
                                    >
                                        <Download className="w-5 h-5" />
                                        Yuklab Olish
                                    </button>
                                </div>

                                <motion.img
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    onClick={(e) => e.stopPropagation()}
                                    src={data.imageUrl}
                                    alt="Full Preview"
                                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
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
