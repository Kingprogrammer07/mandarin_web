import { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { createPortal } from "react-dom";
import { X, Scale, Box, Calculator, DollarSign, Info, Gift, MessageCircle } from "lucide-react";
import { apiClient } from "@/api/client";
import { API_BASE_URL } from "@/config/config";
import { normalizeNumber } from "@/utils/numberFormat";
import { SUPPORT_TELEGRAM_URL } from "@/config/contacts";

interface CalculatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** When true, hides user-facing promotional content (Telegram CTA, discount info, footer note). */
    isAdminMode?: boolean;
}

interface CalcResult {
    chargeable_weight: number;
    price_per_kg_usd: number;
    price_per_kg_uzs: number;
    estimated_price_usd: number;
    estimated_price_uzs: number;
}

interface CalculatorPayload {
    is_gabarit: boolean;
    m: number;
    x?: number;
    y?: number;
    z?: number;
}

export default function CalculatorModal({ isOpen, onClose, isAdminMode = false }: CalculatorModalProps) {
    const { t } = useTranslation();
    const [mounted, setMounted] = useState(false);
    const [isGabarit, setIsGabarit] = useState(false);

    // Asosiy qiymatlar
    const [weight, setWeight] = useState("");
    const [length, setLength] = useState(""); // x
    const [width, setWidth] = useState("");   // y
    const [height, setHeight] = useState(""); // z

    const [result, setResult] = useState<CalcResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // API ni ketma-ket chaqirmaslik uchun (Debounce timer)
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // SSR/hydration xavfsizligi uchun mounted state
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Scroll-lock: modal ochiq bo'lganda body scroll'ini bloklash
    useEffect(() => {
        if (!isOpen) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = original;
        };
    }, [isOpen]);

    // Escape: the modal had a scroll lock but no key handler, so on desktop the
    // only way out was the X in the corner.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [isOpen, onClose]);

    // Modal yopilganda state'larni tozalash
    useEffect(() => {
        if (!isOpen) {
            setWeight("");
            setLength("");
            setWidth("");
            setHeight("");
            setResult(null);
            setIsGabarit(false);
        }
    }, [isOpen]);

    // Live hisoblash logikasi (500ms debounce)
    useEffect(() => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        const fetchCalculation = async () => {
            const m = parseFloat(weight);
            if (isNaN(m) || m <= 0) {
                setResult(null);
                return;
            }

            let payload: CalculatorPayload = {
                is_gabarit: isGabarit,
                m: m,
            };

            // Agar gabarit bo'lsa, x,y,z (metrda) majburiy
            if (isGabarit) {
                const x = parseFloat(length) / 100;
                const y = parseFloat(width) / 100;
                const z = parseFloat(height) / 100;

                if (isNaN(x) || isNaN(y) || isNaN(z) || x <= 0 || y <= 0 || z <= 0) {
                    setResult(null);
                    return;
                }
                payload = { ...payload, x, y, z };
            }

            setIsLoading(true);
            try {
                let data: CalcResult;

                if (isAdminMode) {
                    // Admin context: use native fetch with the admin JWT so the axios
                    // 401 interceptor (which clears the session and fires auth:logout)
                    // is never triggered, even if the endpoint rejects the request.
                    const adminToken = localStorage.getItem('access_token');
                    const res = await fetch(
                        `${API_BASE_URL}/api/v1/admin/calculator`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(adminToken ? { 'X-Admin-Authorization': `Bearer ${adminToken}` } : {}),
                            },
                            body: JSON.stringify(payload),
                        },
                    );
                    if (!res.ok) {
                        setResult(null);
                        return;
                    }
                    data = await res.json() as CalcResult;
                } else {
                    const response = await apiClient.post<CalcResult>(
                        "/api/v1/client/calculator",
                        payload,
                    );
                    data = response.data;
                }

                setResult(data);
            } catch (error) {
                console.error("Calculator API Error:", error);
                setResult(null);
            } finally {
                setIsLoading(false);
            }
        };

        typingTimeoutRef.current = setTimeout(() => {
            fetchCalculation();
        }, 500);

        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [weight, length, width, height, isGabarit, isAdminMode]);

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Dark Overlay */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Container — bottom sheet on mobile, centered on sm+ */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="calculator-title"
                className="
                relative w-full sm:max-w-md md:max-w-lg bg-mc-surface
                rounded-t-mc-xl sm:rounded-mc-xl shadow-2xl overflow-hidden
                animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300
                border border-mc-border
                max-h-[90dvh] flex flex-col
            ">
                {/* Header */}
                <div className="px-4 py-3 border-b border-mc-border flex items-center justify-between gap-3 bg-mc-surface">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <div className="w-9 h-9 shrink-0 rounded-mc-sm bg-mc-brand-soft flex items-center justify-center text-mc-brand">
                            <Calculator className="w-[18px] h-[18px]" strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                            <h2 id="calculator-title" className="truncate text-[16px] font-extrabold text-mc-text">{t('calculator.title')}</h2>
                            <p className="truncate text-[11px] font-medium text-mc-text-2">{t('calculator.subtitle')}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 shrink-0 rounded-mc-md bg-mc-surface-2 flex items-center justify-center text-mc-text-2 active:scale-95 transition-transform"
                        aria-label={t('calculator.close', 'Yopish')}
                    >
                        <X className="w-[18px] h-[18px]" strokeWidth={2} />
                    </button>
                </div>

                <div className="p-4 space-y-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom,24px)]">
                    {/* Segmented Control (Tabs) */}
                    <div className="flex bg-mc-surface-2 border border-mc-border p-1 rounded-mc-md relative">
                        <button
                            onClick={() => setIsGabarit(false)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-mc-sm text-[13px] font-extrabold transition-colors duration-200 z-10 ${
                                !isGabarit ? "text-mc-text" : "text-mc-text-2"
                            }`}
                            aria-pressed={!isGabarit}
                        >
                            <Scale className="w-4 h-4" strokeWidth={2} /> {t('calculator.tabs.normal')}
                        </button>
                        <button
                            onClick={() => setIsGabarit(true)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-mc-sm text-[13px] font-extrabold transition-colors duration-200 z-10 ${
                                isGabarit ? "text-mc-text" : "text-mc-text-2"
                            }`}
                            aria-pressed={isGabarit}
                        >
                            <Box className="w-4 h-4" strokeWidth={2} /> {t('calculator.tabs.dimensional')}
                        </button>

                        {/* Animated sliding background */}
                        <div
                            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-mc-surface rounded-mc-sm shadow-[var(--mc-shadow-card)] transition-transform duration-300 ease-out"
                            style={{ transform: isGabarit ? "translateX(100%)" : "translateX(0)" }}
                        />
                    </div>

                    {/* Inputs */}
                    <div className="space-y-3">
                        {/* Asosiy vazn */}
                        <div>
                            <label className="block text-[12px] font-bold text-mc-text-2 mb-1.5">
                                {t('calculator.inputs.weightLabel')}
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={weight}
                                    onChange={(e) => {
                                        const normalized = normalizeNumber(e.target.value);
                                        if (normalized !== null) setWeight(normalized);
                                    }}
                                    placeholder="0.00"
                                    className="w-full bg-mc-surface-2 border border-mc-border rounded-mc-md px-4 py-3.5 text-[20px] font-extrabold text-mc-text placeholder:text-mc-text-3 focus:outline-none focus:ring-2 focus:ring-mc-brand/45 transition-all"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-bold text-mc-text-3">{t('calculator.inputs.kg')}</span>
                            </div>
                        </div>

                        {/* Gabarit o'lchamlari */}
                        {isGabarit && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                                <label className="block text-[12px] font-bold text-mc-text-2 mb-1.5">
                                    {t('calculator.inputs.dimensionsLabel')}
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="relative">
                                        <input
                                            type="text" inputMode="decimal" value={length} onChange={(e) => {
                                                const normalized = normalizeNumber(e.target.value);
                                                if (normalized !== null) setLength(normalized);
                                            }} placeholder={t('calculator.inputs.length')}
                                            className="w-full bg-mc-surface-2 border border-mc-border rounded-mc-md px-3 py-2.5 text-center text-[16px] font-extrabold text-mc-text placeholder:text-mc-text-3 focus:outline-none focus:ring-2 focus:ring-mc-brand/45"
                                        />
                                        <span className="block text-center text-[10px] font-medium text-mc-text-2 mt-1">{t('calculator.inputs.lengthUnit')}</span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text" inputMode="decimal" value={width} onChange={(e) => {
                                                const normalized = normalizeNumber(e.target.value);
                                                if (normalized !== null) setWidth(normalized);
                                            }} placeholder={t('calculator.inputs.width')}
                                            className="w-full bg-mc-surface-2 border border-mc-border rounded-mc-md px-3 py-2.5 text-center text-[16px] font-extrabold text-mc-text placeholder:text-mc-text-3 focus:outline-none focus:ring-2 focus:ring-mc-brand/45"
                                        />
                                        <span className="block text-center text-[10px] font-medium text-mc-text-2 mt-1">{t('calculator.inputs.widthUnit')}</span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text" inputMode="decimal" value={height} onChange={(e) => {
                                                const normalized = normalizeNumber(e.target.value);
                                                if (normalized !== null) setHeight(normalized);
                                            }} placeholder={t('calculator.inputs.height')}
                                            className="w-full bg-mc-surface-2 border border-mc-border rounded-mc-md px-3 py-2.5 text-center text-[16px] font-extrabold text-mc-text placeholder:text-mc-text-3 focus:outline-none focus:ring-2 focus:ring-mc-brand/45"
                                        />
                                        <span className="block text-center text-[10px] font-medium text-mc-text-2 mt-1">{t('calculator.inputs.heightUnit')}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Live Natija Qismi (Optimized UI) */}
                    <div className="space-y-2.5">
                        {isLoading ? (
                            <div className="bg-mc-surface-2 rounded-mc-lg h-24 flex flex-col items-center justify-center gap-2.5 border border-mc-border">
                                <div className="w-6 h-6 border-2 border-mc-brand/30 border-t-mc-brand rounded-full animate-spin" />
                                <p className="text-[12px] font-medium text-mc-text-2">{t('calculator.results.calculating')}</p>
                            </div>
                        ) : result ? (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-3">
                                
                                {/* 1. Hisoblangan Vazn (Main Focus) */}
                                <div className="bg-gradient-to-br from-mc-brand to-mc-brand-strong rounded-mc-lg p-4 text-mc-on-brand flex justify-between items-center gap-3 shadow-[var(--mc-shadow-cta)]">
                                    <div className="min-w-0">
                                        <p className="text-mc-on-brand/75 font-bold text-[12px]">{t('calculator.results.chargeableWeight')}</p>
                                        <p className="text-[26px] font-extrabold leading-tight mt-0.5 tabular-nums">{result.chargeable_weight} <span className="text-[15px] font-bold opacity-80">kg</span></p>
                                    </div>
                                    <div className="w-11 h-11 shrink-0 bg-mc-on-brand/12 rounded-full flex items-center justify-center">
                                        <Scale className="w-5 h-5" strokeWidth={2} />
                                    </div>
                                </div>

                                {/* 2. Joriy Tarif (Flat & Minimal) */}
                                <div className="bg-mc-surface-2 border border-mc-border rounded-mc-lg p-3.5 flex justify-between items-center gap-3">
                                    <p className="text-mc-text-2 font-medium text-[12px] flex items-center gap-1.5">
                                        <Info className="w-4 h-4 text-mc-text-3" strokeWidth={2} />
                                        {t('calculator.results.pricePerKg')}
                                    </p>
                                    <div className="text-right">
                                        <p className="text-[14px] font-extrabold text-mc-text tabular-nums">
                                            ${result.price_per_kg_usd.toLocaleString("uz-UZ", { minimumFractionDigits: 2 })}
                                        </p>
                                        <p className="text-[11px] font-medium text-mc-text-2 mt-0.5 tabular-nums">
                                            ~{result.price_per_kg_uzs.toLocaleString("uz-UZ")} {t('calculator.results.currencyUzs')}
                                        </p>
                                    </div>
                                </div>

                                {/* 3. Taxminiy To'lov (Distinct Color for Interaction) */}
                                <div className="bg-mc-success/12 border border-mc-success/25 rounded-mc-lg p-3.5 flex justify-between items-center gap-3 relative overflow-hidden">
                                    {/* Subtle highlight effect for low-end devices without using blur */}
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-mc-success/20 to-transparent rounded-bl-full pointer-events-none" />

                                    <p className="text-mc-success font-bold text-[12px] flex items-center gap-1.5 relative z-10">
                                        <DollarSign className="w-4 h-4" strokeWidth={2} />
                                        {t('calculator.results.estimatedPayment')}
                                    </p>
                                    <div className="text-right relative z-10">
                                        <p className="text-[18px] font-extrabold text-mc-success tabular-nums">
                                            {result.estimated_price_uzs.toLocaleString("uz-UZ")} <span className="text-[12px]">{t('calculator.results.currencyUzs')}</span>
                                        </p>
                                        <p className="text-[11px] font-bold text-mc-success mt-0.5 tabular-nums">
                                            ${result.estimated_price_usd.toLocaleString("uz-UZ", { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>

                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-28 text-center bg-mc-surface-2 border border-dashed border-mc-border rounded-mc-lg">
                                <Calculator className="w-6 h-6 mb-2 text-mc-text-3" strokeWidth={1.8} />
                                <p className="text-[12px] font-medium text-mc-text-2 max-w-[200px]">
                                    {t('calculator.results.emptyState')}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Gabarit info & CTA — faqat gabarit natijasi bo'lganda va user rejimida */}
                    {isGabarit && result && !isAdminMode && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
                            {/* Explanation container */}
                            <div className="bg-mc-surface-2 border border-mc-border rounded-mc-lg p-3.5">
                                <div className="flex items-start gap-2.5">
                                    <div className="mt-0.5 w-9 h-9 shrink-0 rounded-mc-sm bg-mc-brand-soft flex items-center justify-center text-mc-brand">
                                        <Info className="w-[18px] h-[18px]" strokeWidth={2} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-[13px] font-extrabold text-mc-text mb-1">
                                            {t('calculator.dimensionalInfo.title')}
                                        </h4>
                                        <p className="text-[12px] leading-snug text-mc-text-2">
                                            {t('calculator.dimensionalInfo.desc')}
                                        </p>
                                    </div>
                                </div>

                                {/* Discount highlight */}
                                <div className="mt-3 bg-mc-warn-soft border border-mc-warn/25 rounded-mc-sm p-3 flex items-start gap-2.5">
                                    <Gift className="mt-px w-4 h-4 shrink-0 text-mc-warn" strokeWidth={2} />
                                    <p className="text-[12px] leading-snug font-bold text-mc-warn">
                                        {t('calculator.dimensionalInfo.discount')}
                                    </p>
                                </div>
                            </div>

                            {/* CTA Button */}
                            <button
                                onClick={() => window.open(SUPPORT_TELEGRAM_URL, "_blank", "noopener,noreferrer")}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-mc-brand to-mc-brand-strong active:scale-[0.98] text-mc-on-brand font-extrabold text-[13px] py-3.5 rounded-mc-md shadow-[var(--mc-shadow-cta)] transition-transform duration-200"
                            >
                                <MessageCircle className="w-[18px] h-[18px]" strokeWidth={2} />
                                {t('calculator.dimensionalInfo.contactAdmin')}
                            </button>
                        </div>
                    )}

                    {!isAdminMode && (
                        <p className="text-center text-[10px] font-medium text-mc-text-3 leading-snug pb-6">
                            {t('calculator.footerNote')}
                        </p>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
