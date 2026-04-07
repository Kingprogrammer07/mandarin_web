import { useState, memo, useRef, useEffect, useMemo, lazy, Suspense, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    MapPin,
    Calendar,
    Rocket,
    Edit3,
    // Info,
    ChevronLeft,
    ChevronRight,
    IdCard,
    Home,
    ScanBarcode,
    ShieldOff,
    Plane,
    // HelpCircle,
    ShieldAlert,
    // Newspaper,
    FileText,
    Wallet,
    ReceiptText,
    MessageSquare,
    ListOrdered,
    Calculator, // Calculator bu yerda import qilingan
    Search
} from "lucide-react";
import TrackCodeTab from "./dashboard/TrackCodeTab";
import {
    getActiveCarouselItems,
    trackCarouselView,
    trackCarouselClick,
    type CarouselMediaItemResponse,
} from "@/api/services/carousel";
import CarouselMediaModal from "@/components/carousel/CarouselMediaModal";
import { toast } from "sonner";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import { ActionButton, type ActionItemData } from "@/components/user_page/ActionButtons";
import { useTranslation } from 'react-i18next';

interface CarouselItemData {
    id: number;
    type: "feature" | "ad";
    titleKey?: string;
    subKey?: string;
    title?: string;
    sub?: string;
    /** Tailwind gradient classes — used for static (hardcoded) items */
    gradient?: string;
    /** CSS gradient value — used for items fetched from the API */
    gradientStyle?: string;
    bgIcon?: React.ReactNode;
    mainIcon?: React.ReactNode;
    mediaType?: "image" | "video" | "gif";
    mediaUrl?: string;
    actionUrl?: string;
    textColor?: string;
    /** True when this item came from the API and should be tracked */
    fromApi?: boolean;
    /** Gallery slides — drives the media detail modal when length > 1 */
    mediaItems?: CarouselMediaItemResponse[];
}

// --- Data ---
const CAROUSEL_ITEMS: CarouselItemData[] = [
    // {
    //     id: 5,
    //     type: "feature",
    //     titleKey: "dashboard.carousel.news.title",
    //     subKey: "dashboard.carousel.news.sub",
    //     gradient: "from-pink-900 to-pink-600",
    //     bgIcon: <Newspaper className="text-white/10 absolute -right-4 -top-4" style={{ width: 96, height: 96 }} />,
    //     mainIcon: <Newspaper className="text-white/90" style={{ width: 32, height: 32 }} />,
    // },
    {
        id: 1,
        type: "feature",
        titleKey: "dashboard.carousel.prohibited.title",
        subKey: "dashboard.carousel.prohibited.sub",
        gradient: "from-red-900 to-red-600",
        bgIcon: <ShieldAlert className="text-white/10 absolute -right-4 -top-4" style={{ width: 96, height: 96 }} />,
        mainIcon: <ShieldOff className="text-white/90" style={{ width: 32, height: 32 }} />,
    },
    {
        id: 2,
        type: "feature",
        titleKey: "dashboard.carousel.id.title",
        subKey: "dashboard.carousel.id.sub",
        gradient: "from-blue-900 to-blue-600",
        bgIcon: <IdCard className="text-white/10 absolute -right-4 -top-4" style={{ width: 96, height: 96 }} />,
        mainIcon: <IdCard className="text-white/90" style={{ width: 32, height: 32 }} />,
    },
    {
        id: 3,
        type: "feature",
        titleKey: "dashboard.carousel.delivery.title",
        subKey: "dashboard.carousel.delivery.sub",
        gradient: "from-purple-900 to-purple-600",
        bgIcon: <Rocket className="text-white/10 absolute -right-4 -top-4" style={{ width: 96, height: 96 }} />,
        mainIcon: <Plane className="text-white/90" style={{ width: 32, height: 32 }} />,
    },
    // {
    //     id: 4,
    //     type: "feature",
    //     titleKey: "dashboard.carousel.help.title",
    //     subKey: "dashboard.carousel.help.sub",
    //     gradient: "from-cyan-900 to-cyan-600",
    //     bgIcon: <HelpCircle className="text-white/10 absolute -right-4 -top-4" style={{ width: 96, height: 96 }} />,
    //     mainIcon: <Info className="text-white/90" style={{ width: 32, height: 32 }} />,
    // },
];

const MAIN_ACTIONS: (Omit<ActionItemData, 'label' | 'desc' | 'badge' | 'actionLabel'> & { labelKey: string; descKey: string; badgeKey: string; actionLabelKey: string })[] = [
    {
        id: "calculator",
        icon: <Calculator className="w-5 h-5" />,
        bgIcon: <Calculator style={{ width: 80, height: 80 }} />,
        labelKey: "dashboard.actions.calculator.desc",
        descKey: "dashboard.actions.calculator.label",
        badgeKey: "dashboard.actions.calculator.badge",
        actionLabelKey: "dashboard.actions.calculator.action",
        theme: "cyan",
    },
    {
        id: "china",
        icon: <MapPin className="w-5 h-5" />,
        bgIcon: <MapPin style={{ width: 80, height: 80 }} />,
        labelKey: "dashboard.actions.china.label",
        descKey: "dashboard.actions.china.desc",
        badgeKey: "dashboard.actions.china.badge",
        actionLabelKey: "dashboard.actions.china.action",
        theme: "amber",
    },
    // {
    //     id: "schedule",
    //     icon: <Calendar className="w-5 h-5" />,
    //     bgIcon: <Calendar style={{ width: 80, height: 80 }} />,
    //     labelKey: "dashboard.actions.schedule.label",
    //     descKey: "dashboard.actions.schedule.desc",
    //     badgeKey: "dashboard.actions.schedule.badge",
    //     actionLabelKey: "dashboard.actions.schedule.action",
    //     theme: "sky",
    // },
    {
        id: "request",
        icon: <Edit3 className="w-5 h-5" />,
        bgIcon: <Edit3 style={{ width: 80, height: 80 }} />,
        labelKey: "dashboard.actions.request.label",
        descKey: "dashboard.actions.request.desc",
        badgeKey: "dashboard.actions.request.badge",
        actionLabelKey: "dashboard.actions.request.action",
        theme: "emerald",
    },
    {
        id: "delivery_history",
        icon: <ListOrdered className="w-5 h-5" />,
        bgIcon: <ListOrdered style={{ width: 80, height: 80 }} />,
        labelKey: "dashboard.actions.history.label",
        descKey: "dashboard.actions.history.desc",
        badgeKey: "dashboard.actions.history.badge",
        actionLabelKey: "dashboard.actions.history.action",
        theme: "violet",
    },
    {
        id: "payment",
        icon: <Wallet className="w-5 h-5" />,
        bgIcon: <Wallet style={{ width: 80, height: 80 }} />,
        labelKey: "dashboard.actions.payment.label",
        descKey: "dashboard.actions.payment.desc",
        badgeKey: "dashboard.actions.payment.badge",
        actionLabelKey: "dashboard.actions.payment.action",
        theme: "rose",
    },
];

const CarouselCard = memo(({ item, onView }: { item: CarouselItemData; onView?: () => void }) => {
    const { t } = useTranslation();
    const cardRef = useRef<HTMLDivElement>(null);
    const isAd = item.type === "ad";
    const title = item.titleKey ? t(item.titleKey) : item.title;
    const sub = item.subKey ? t(item.subKey) : item.sub;

    // Fire onView once when the card is ≥50% visible (IntersectionObserver)
    useEffect(() => {
        if (!onView || !cardRef.current) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    onView();
                    observer.disconnect();
                }
            },
            { threshold: 0.5 },
        );
        observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, [onView]);

    if (isAd) {
        return (
            <div
                ref={cardRef}
                className="
                    flex-shrink-0 w-[85%] sm:w-[45%] lg:w-full
                    h-40 rounded-3xl relative overflow-hidden
                    snap-start cursor-pointer hover:scale-[0.98] transition-all duration-200
                    border border-white/10 shadow-lg group
                "
            >
                {item.mediaType === "video" ? (
                    <video
                        src={item.mediaUrl}
                        className="absolute inset-0 w-full h-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                    />
                ) : (
                    <img
                        src={item.mediaUrl}
                        alt={item.title || "Ad"}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                <div className="absolute inset-0 p-5 flex flex-col justify-end">
                    {title && (
                        <h3
                            className="font-bold text-xl leading-tight mb-0.5"
                            style={{ color: item.textColor || "white" }}
                        >
                            {title}
                        </h3>
                    )}
                    {sub && (
                        <p className="text-white/80 text-sm font-medium flex items-center gap-1">
                            {sub} <ChevronRight className="w-4 h-4" />
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // Feature card — supports both Tailwind gradient classes (static) and CSS gradient value (API)
return (
    <div
        ref={cardRef}
        className={`
            flex-shrink-0 w-[85%] sm:w-[45%] md:w-[280px] lg:w-[300px]
            h-40 rounded-3xl relative overflow-hidden
            snap-start cursor-pointer hover:scale-[0.98] transition-transform duration-200
            border border-white/10 shadow-lg
            ${item.gradientStyle ? '' : `bg-gradient-to-br ${item.gradient}`}
        `}
        style={item.gradientStyle ? { background: item.gradientStyle } : undefined}
    >
        {item?.bgIcon}
        {/* Background media — faqat mediaUrl bo'lib, mainIcon bo'lmaganda */}
        {item.mediaUrl && !item.mainIcon && (
            <>
                <img
                    src={item.mediaUrl}
                    alt={item.title || "Feature"}
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            </>
        )}

        {/* Content */}
        <div className="h-full flex flex-col justify-between relative z-10 p-5">
            {/* Top: icon yoki thumbnail */}
            {item.mainIcon ? (
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
                    {item.mainIcon}
                </div>
            ) : item.mediaUrl ? (
                // mediaUrl bor, mainIcon yo'q — top-left badge
                <div className="self-start px-2 py-0.5 rounded-md bg-white/15 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wide">
                    Yangilik
                </div>
            ) : (
                <div /> // spacer — text pastda qolsin
            )}

            {/* Bottom: title + sub */}
            <div>
                <h3
                    className="font-bold text-xl leading-tight mb-1 drop-shadow-sm"
                    style={{ color: item.textColor || "white" }}
                >
                    {title}
                </h3>
                {sub && (
                    <p
                        className="text-sm font-medium drop-shadow-sm"
                        style={{ color: item.textColor ? `${item.textColor}b3` : "rgba(255,255,255,0.7)" }}
                    >
                        {sub}
                    </p>
                )}
            </div>
        </div>
    </div>
);
});

const UniqueBackground = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 dark:block hidden">
        <div className="absolute inset-0 bg-[#0d0a04]" />
        <svg
            className="absolute inset-0 w-full h-full opacity-[0.035]"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <pattern id="diag-grid" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
                    <line x1="0" y1="0" x2="0" y2="60" stroke="#f59e0b" strokeWidth="0.5" />
                    <line x1="0" y1="0" x2="60" y2="0" stroke="#f59e0b" strokeWidth="0.5" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#diag-grid)" />
        </svg>

        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <filter id="grain">
                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>

        <div
            className="absolute"
            style={{
                bottom: "-8%",
                left: "-5%",
                width: "480px",
                height: "480px",
                background: "radial-gradient(circle, rgba(245,158,11,0.18) 0%, rgba(180,83,9,0.10) 45%, transparent 70%)",
                filter: "blur(60px)",
                borderRadius: "50%",
            }}
        />

        <div
            className="absolute"
            style={{
                top: "-5%",
                right: "-8%",
                width: "420px",
                height: "420px",
                background: "radial-gradient(circle, rgba(194,120,40,0.14) 0%, rgba(120,53,15,0.08) 50%, transparent 70%)",
                filter: "blur(80px)",
                borderRadius: "50%",
            }}
        />

        <div
            className="absolute"
            style={{
                top: "40%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "600px",
                height: "300px",
                background: "radial-gradient(ellipse, rgba(251,191,36,0.04) 0%, transparent 65%)",
                filter: "blur(40px)",
            }}
        />

        <svg
            className="absolute opacity-[0.06]"
            style={{ bottom: "5%", right: "3%", width: "320px", height: "320px" }}
            viewBox="0 0 320 320"
            xmlns="http://www.w3.org/2000/svg"
        >
            <circle cx="160" cy="160" r="140" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="6 10" />
            <circle cx="160" cy="160" r="100" fill="none" stroke="#f59e0b" strokeWidth="0.5" />
            <circle cx="160" cy="160" r="60" fill="none" stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="3 8" />
        </svg>

        <svg
            className="absolute opacity-[0.03]"
            style={{ top: "8%", left: "-2%", width: "280px", height: "280px" }}
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
        >
            <rect x="15" y="35" width="70" height="50" rx="3" fill="none" stroke="#f59e0b" strokeWidth="2" />
            <polyline points="15,35 50,15 85,35" fill="none" stroke="#f59e0b" strokeWidth="2" />
            <line x1="50" y1="15" x2="50" y2="85" stroke="#f59e0b" strokeWidth="1.5" />
            <line x1="15" y1="55" x2="85" y2="55" stroke="#f59e0b" strokeWidth="1" />
        </svg>

        <div
            className="absolute left-0 right-0 h-px opacity-[0.06]"
            style={{
                top: "38%",
                background: "linear-gradient(to right, transparent 0%, rgba(245,158,11,0.8) 30%, rgba(245,158,11,0.8) 70%, transparent 100%)",
            }}
        />
    </div>
);

function useDarkMode() {
    const [dark, setDark] = useState(
        () => document.documentElement.classList.contains("dark")
    );
    useState(() => {
        const obs = new MutationObserver(() =>
            setDark(document.documentElement.classList.contains("dark"))
        );
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => obs.disconnect();
    });
    return dark;
}

// --- Beta Badge Component ---
const BetaBadge = memo(() => {
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useTranslation();

    return (
        <div className="absolute top-4 right-4 sm:top-8 sm:right-4 z-50 mt-12">
            {/* The Badge Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:border-amber-500/40 backdrop-blur-md transition-all shadow-sm active:scale-95"
            >
                {/* Ping Animation Dot */}
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border-2 border-white dark:border-[#0d0a04]"></span>
                </span>
                
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="text-[10px] sm:text-xs font-bold tracking-widest uppercase">
                    {t('beta.badge', 'Beta')}
                </span>
            </button>

            {/* The Popup Content */}
            {isOpen && (
                <>
                    {/* Backdrop for closing when clicked outside */}
                    <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
                    
                    <div className="absolute right-0 top-12 w-72 sm:w-80 p-5 bg-white/95 dark:bg-[#1a1814]/95 backdrop-blur-xl border border-amber-100 dark:border-amber-900/30 rounded-2xl shadow-2xl z-[70] animate-in fade-in slide-in-from-top-2 zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-3">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-amber-500" />
                                {t('beta.title', 'Beta Versiya')}
                            </h3>
                            <button 
                                onClick={() => setIsOpen(false)} 
                                className="p-1 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                            {t('beta.desc', 'Platforma hozirda sinov (beta) rejimida ishlamoqda. Ayrim xatoliklar yoki kamchiliklar kuzatilishi mumkin. Agar biron muammoga duch kelsangiz, iltimos bizga xabar bering.')}
                        </p>
                        <button 
                            onClick={() => window.open("https://t.me/mandarin_admin", "_blank")}
                            className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-amber-500/25 transition-all active:scale-[0.98]"
                        >
                            <MessageSquare className="w-4 h-4" />
                            {t('beta.action', 'Adminga yozish')}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
});

// --- Premium Tab Component ---
const HeaderTabs = memo(({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (t: string) => void }) => {
    const isHome = activeTab === "home";
    const dark = useDarkMode();
    const { t } = useTranslation();

    const indicatorStyle: React.CSSProperties = dark
        ? {
            position: "absolute",
            top: "4px",
            bottom: "4px",
            left: isHome ? "4px" : "calc(50% + 2px)",
            right: isHome ? "calc(50% + 2px)" : "4px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(234,88,12,0.15) 100%)",
            boxShadow: "0 2px 16px rgba(245,158,11,0.2), inset 0 0 0 1px rgba(245,158,11,0.3)",
            transition: "all 300ms cubic-bezier(0.34,1.56,0.64,1)",
        }
        : {
            position: "absolute",
            top: "4px",
            bottom: "4px",
            left: isHome ? "4px" : "calc(50% + 2px)",
            right: isHome ? "calc(50% + 2px)" : "4px",
            borderRadius: "10px",
            background: "#ffffff",
            boxShadow: "0 1px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
            transition: "all 300ms cubic-bezier(0.34,1.56,0.64,1)",
        };

    const wrapperStyle: React.CSSProperties = dark
        ? {
            background: "rgba(26,18,8,0.85)",
            border: "1px solid rgba(180,83,9,0.35)",
            boxShadow: "0 0 0 1px rgba(245,158,11,0.08), 0 8px 32px rgba(0,0,0,0.5)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
        }
        : {
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
        };

    const activeTextClass = dark ? "text-amber-300" : "text-gray-900";
    const inactiveTextClass = dark
        ? "text-white/35 hover:text-white/55"
        : "text-gray-400 hover:text-gray-600";

    return (
        <div className="relative mt-14 mb-6 z-10">
            <div className="relative flex rounded-2xl p-1 gap-1" style={wrapperStyle}>

                <div style={indicatorStyle} />

                <button
                    onClick={() => setActiveTab("home")}
                    className={`
                        relative z-10 flex-1 flex items-center justify-center gap-2
                        py-[11px] px-4 rounded-[10px] text-sm font-semibold
                        transition-colors duration-200 select-none outline-none
                        ${isHome ? activeTextClass : inactiveTextClass}
                    `}
                >
                    <Home
                        className="transition-all duration-300"
                        style={{
                            width: 16,
                            height: 16,
                            transform: isHome ? "scale(1.15)" : "scale(1)",
                            strokeWidth: isHome ? 2.5 : 2,
                        }}
                    />
                    <span>{t('dashboard.tabs.home')}</span>
                </button>

                <button
                    onClick={() => setActiveTab("track")}
                    className={`
                        relative z-10 flex-1 flex items-center justify-center gap-2
                        py-[11px] px-4 rounded-[10px] text-sm font-semibold
                        transition-colors duration-200 select-none outline-none
                        ${!isHome ? activeTextClass : inactiveTextClass}
                    `}
                >
                    {activeTab === 'track' ? <ScanBarcode
                        className="transition-all duration-300"
                        style={{
                            width: 16,
                            height: 16,
                            transform: !isHome ? "scale(1.15)" : "scale(1)",
                            strokeWidth: !isHome ? 2.5 : 2,
                        }}
                    /> : activeTab === 'schedule' ? <Calendar
                        className="transition-all duration-300"
                        style={{
                            width: 16,
                            height: 16,
                            transform: !isHome ? "scale(1.15)" : "scale(1)",
                            strokeWidth: !isHome ? 2.5 : 2,
                        }}
                    /> : <ScanBarcode
                        className="transition-all duration-300"
                        style={{
                            width: 16,
                            height: 16,
                            transform: !isHome ? "scale(1.15)" : "scale(1)",
                            strokeWidth: !isHome ? 2.5 : 2,
                        }}
                    />}
                    <span>{activeTab === 'track' ? t('dashboard.tabs.track') : activeTab === 'schedule' ? t('dashboard.tabs.schedule') : activeTab === 'request' ? t('dashboard.tabs.request') : activeTab === 'delivery_history' ? t('dashboard.tabs.history') : t('dashboard.tabs.track')}</span>
                </button>
            </div>

            {dark && (
                <div
                    style={{
                        position: "absolute",
                        bottom: "-10px",
                        left: isHome ? "15%" : "55%",
                        width: isHome ? "25%" : "30%",
                        height: "1px",
                        background: "linear-gradient(to right, transparent, rgba(245,158,11,0.7), transparent)",
                        transition: "all 400ms cubic-bezier(0.34,1.56,0.64,1)",
                    }}
                />
            )}
        </div>
    );
});

const PageLoadingFallback = memo(() => {
    const { t } = useTranslation();
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center w-full animate-in fade-in duration-300">
            <div className="w-16 h-16 relative flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-gray-100 dark:border-white/5"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-blue-500 dark:border-t-amber-500 dark:border-r-amber-500 animate-spin"></div>
                <Plane className="w-6 h-6 text-blue-500 dark:text-amber-500 animate-pulse absolute" />
            </div>
            <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">
                {t('dashboard.loading')}
            </p>
        </div>
    );
});

const QuickSearchBar = memo(({ onClick }: { onClick: () => void }) => {
    const { t } = useTranslation();
    return (
        <div
            onClick={onClick}
            className="
                relative flex items-center gap-3 w-full
                px-4 py-3 rounded-2xl cursor-text
                bg-white dark:bg-white/8
                border border-gray-200/80 dark:border-white/10
                shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-500/40
                transition-all duration-200 group mb-5
            "
        >
            <Search className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0 group-hover:text-purple-500 transition-colors duration-200" />
            <span className="text-xs text-gray-400 dark:text-gray-500 font-sans select-none flex-1">
                {t('tracking.placeholder', 'Kargo kodini kiriting...')}
            </span>
            <div className="
                flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold
                bg-purple-50 dark:bg-purple-500/15
                text-purple-600 dark:text-purple-400
                border border-purple-100 dark:border-purple-500/20
                group-hover:bg-purple-100 dark:group-hover:bg-purple-500/25 transition-colors
            ">
                <ScanBarcode className="w-3.5 h-3.5" />
                {t('dashboard.tabs.track', 'Track')}
            </div>
        </div>
    );
});

const ChinaAddressModal = lazy(() => import('../components/modals/ChinaAddressModal'));
const MakePaymentModal = lazy(() => import('../components/modals/MakePaymentModal'));
const FlightSchedulePage = lazy(() => import('../components/pages/FlightSchedulePage'));
const DeliveryRequestPage = lazy(() => import('../components/pages/DeliveryRequestPage'));
const DeliveryHistoryPage = lazy(() => import('../components/pages/DeliveryHistoryPage'));
const CalculatorModal = lazy(() => import('../components/modals/CalculatorModal'));
const ProhibitedItemsModal = lazy(() => import('../components/modals/ProhibitedItemsModal'));

interface DashboardProps {
    onNavigateToReports?: () => void;
    onNavigateToHistory?: () => void;
}

export default function Dashboard({ onNavigateToReports, onNavigateToHistory }: DashboardProps) {
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get("tab");
        const valid = ["home", "track", "schedule", "request", "delivery_history"];
        return valid.includes(tab ?? "") ? (tab as string) : "home";
    });
    const [initialTrackView] = useState<'search' | 'history'>('search');
    const [isChinaModalOpen, setIsChinaModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
    const [isProhibitedModalOpen, setIsProhibitedModalOpen] = useState(false);
    const [trackAutoFocus, setTrackAutoFocus] = useState(false);
    const [mediaModalItem, setMediaModalItem] = useState<CarouselItemData | null>(null);

    const { t } = useTranslation();

    const { data: apiCarouselItems } = useQuery({
        queryKey: ['carousel-items'],
        queryFn: getActiveCarouselItems,
        staleTime: 5 * 60 * 1000,
        // Don't show error toasts — silently fall back to static items
        retry: 1,
    });

    const sortedCarouselItems = useMemo((): CarouselItemData[] => {
        // API items (ads + admin features) come first, sorted by their `order` field
        const fromApi: CarouselItemData[] = apiCarouselItems
            ? [...apiCarouselItems]
                .sort((a, b) => a.order - b.order)
                .map((item) => ({
                    id: item.id,
                    type: item.type as "ad" | "feature",
                    title: item.title ?? undefined,
                    sub: item.sub_title ?? undefined,
                    gradientStyle: item.gradient ?? 'linear-gradient(135deg, #1a1a2e, #16213e)',
                    mediaType: item.media_type,
                    mediaUrl: item.media_url,
                    actionUrl: item.action_url ?? undefined,
                    textColor: item.text_color,
                    fromApi: true,
                    mediaItems: item.media_items ?? [],
                }))
            : [];

        // Static feature cards (prohibited items, ID card, delivery info) always appended
        const staticFeatures = CAROUSEL_ITEMS
            .filter(i => i.type === "feature")
            .sort((a, b) => a.id - b.id);

        return [...fromApi, ...staticFeatures];
    }, [apiCarouselItems]);
    
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (activeTab !== "home" || isPaused) return;

        const interval = setInterval(() => {
            if (scrollRef.current) {
                const { scrollLeft, clientWidth, scrollWidth } = scrollRef.current;

                const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 50;

                if (isAtEnd) {
                    scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
                } else {
                    scrollRef.current.scrollBy({ left: clientWidth * 0.6, behavior: "smooth" });
                }
            }
        }, 4000); 

        return () => clearInterval(interval);
    }, [activeTab, isPaused]);

    const handleSetActiveTab = useCallback((tab: string) => {
        setActiveTab(tab);
        const url = new URL(window.location.href);
        if (tab === "home") {
            url.searchParams.delete("tab");
        } else {
            url.searchParams.set("tab", tab);
        }
        window.history.replaceState(null, "", url.toString());
    }, []);

    const handleQuickSearch = () => {
        setTrackAutoFocus(true);
        handleSetActiveTab("track");
    };

    const handleCarouselItemClick = useCallback((item: CarouselItemData) => {
        if (item.fromApi) {
            const hasGallery = (item.mediaItems?.length ?? 0) > 1;
            if (hasGallery) {
                // CASE B — open fullscreen media gallery modal;
                // click is tracked only when the CTA inside the modal is tapped
                setMediaModalItem(item);
            } else if (item.actionUrl) {
                // CASE A — single/no gallery: open action URL directly
                trackCarouselClick(item.id);
                window.open(item.actionUrl, "_blank");
            }
        } else {
            // Static item special actions
            if (item.id === 1) setIsProhibitedModalOpen(true);
        }
    }, []);

    const onTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX;
        touchStartY.current = e.targetTouches[0].clientY;
        setIsPaused(true); 
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartX.current || !touchStartY.current) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const distanceX = touchStartX.current - touchEndX;
        const distanceY = touchStartY.current - touchEndY;
        const minSwipeDistance = 50;

        if (Math.abs(distanceX) > Math.abs(distanceY)) {
            if (distanceX > minSwipeDistance) {
                handleSetActiveTab("track");
            }
            if (distanceX < -minSwipeDistance) {
                handleSetActiveTab("home");
            }
        }

        touchStartX.current = null;
        touchStartY.current = null;

        setTimeout(() => setIsPaused(false), 3000);
    };

    const handleActionClick = (id: string) => {
        if (id === 'calculator') {
        setIsCalculatorOpen(true);
        return;
        } else if (id === 'history') {
            onNavigateToHistory?.();
            return;
        } else if (id === 'china') {
            setIsChinaModalOpen(true);
            return;
        } else if (id === 'schedule') {
            handleSetActiveTab('schedule');
            return;
        } else if (id === 'request') {
            handleSetActiveTab('request');
            return;
        } else if (id === 'delivery_history') {
            handleSetActiveTab('delivery_history');
            return;
        } else if (id === 'payment') {
            setIsPaymentModalOpen(true);
            return;
        } else if (id === 'report') {
            onNavigateToReports?.();
            return;
        } else {
            toast.info(t('dashboard.toast.comingSoon', { id }));
        }
    };

    return (
        <div
            className="min-h-screen bg-gray-50 dark:bg-[#0d0a04] text-gray-900 dark:text-white pb-24 transition-colors duration-300 font-sans selection:bg-orange-500/30"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            <UniqueBackground />

            <div className="relative z-10 max-w-4xl mx-auto px-4 pt-12 sm:pt-16">
                
                {/* Yopiladigan Beta Badge Shu Yerga Qo'yildi */}
                
                <BetaBadge />

                <HeaderTabs activeTab={activeTab} setActiveTab={handleSetActiveTab} />

                {activeTab === "home" && (
                    <QuickSearchBar onClick={handleQuickSearch} />
                )}

                {activeTab === 'schedule' && (
                    <Suspense fallback={<PageLoadingFallback />}>
                        <FlightSchedulePage
                            onBack={() => handleSetActiveTab('home')}
                            onNavigateToTrack={() => handleSetActiveTab('track')}
                        />
                    </Suspense>
                )}

                {activeTab === 'request' && (
                    <Suspense fallback={<PageLoadingFallback />}>
                        <DeliveryRequestPage
                            onBack={() => handleSetActiveTab('home')}
                            onNavigateToProfile={() => {/* Handle profile navigation if needed */}}
                            onNavigateToHistory={() => handleSetActiveTab('delivery_history')}
                        />
                    </Suspense>
                )}

                {activeTab === 'delivery_history' && (
                    <Suspense fallback={<PageLoadingFallback />}>
                        <DeliveryHistoryPage onBack={() => handleSetActiveTab('home')} />
                    </Suspense>
                )}

                {activeTab === "home" ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        <section>
                            <div className="flex items-center justify-between mb-4 ml-1">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <span className="w-1 h-5 bg-blue-500 rounded-full inline-block"></span>
                                    {t('dashboard.sections.important')}
                                </h2>

                                <div className="hidden md:flex items-center gap-2">
                                    <button
                                        onClick={() => scrollRef.current?.scrollBy({ left: -320, behavior: "smooth" })}
                                        className="p-1.5 rounded-full bg-gray-200 dark:bg-white/10 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500 transition-colors active:scale-95"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => scrollRef.current?.scrollBy({ left: 320, behavior: "smooth" })}
                                        className="p-1.5 rounded-full bg-gray-200 dark:bg-white/10 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500 transition-colors active:scale-95"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div
                                ref={scrollRef}
                                className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide lg:mx-0 lg:px-0 lg:pb-4"
                                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                                onTouchStart={(e) => { e.stopPropagation(); setIsPaused(true); }}
                                onTouchEnd={(e) => { e.stopPropagation(); setTimeout(() => setIsPaused(false), 3000); }}
                                onMouseEnter={() => setIsPaused(true)}
                                onMouseLeave={() => setIsPaused(false)}
                            >
                                {sortedCarouselItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className="group contents cursor-pointer"
                                        onClick={() => handleCarouselItemClick(item)}
                                    >
                                        <CarouselCard
                                            item={item}
                                            onView={item.fromApi
                                                ? () => { trackCarouselView(item.id); }
                                                : undefined
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="mb-4">
                            <div className="flex items-center justify-between mb-3 ml-1 mr-1">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <span className="w-1 h-5 bg-emerald-500 rounded-full inline-block"></span>
                                    {t('dashboard.sections.reportsAndPayments')}
                                </h2>
                            </div>

                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                <button
                                    onClick={onNavigateToReports}
                                    className="relative overflow-hidden rounded-3xl p-3 sm:p-4 text-left border border-white/15 bg-white/80 dark:bg-white/5 backdrop-blur-xl shadow-lg transition hover:-translate-y-[2px] active:scale-[0.99]"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-400/30 via-orange-400/10 to-transparent dark:from-amber-500/30 dark:via-orange-500/10" />
                                    <div className="absolute inset-0 pointer-events-none opacity-25 blur-3xl bg-amber-200/60 dark:bg-amber-500/30" />

                                    <div className="relative flex flex-col items-center text-center gap-2 sm:gap-3">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center bg-white/70 dark:bg-white/10 text-amber-600 dark:text-amber-300 shadow-inner shrink-0">
                                            <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                                        </div>
                                        <div className="space-y-0.5 min-w-0 w-full">
                                            <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">{t('dashboard.sections.myCargo')}</h3>
                                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-300/70 leading-snug line-clamp-2">{t('dashboard.sections.cargoReport')}</p>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={onNavigateToHistory}
                                    className="relative overflow-hidden rounded-3xl p-3 sm:p-4 text-left border border-white/15 bg-white/80 dark:bg-white/5 backdrop-blur-xl shadow-lg transition hover:-translate-y-[2px] active:scale-[0.99]"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-sky-500/25 via-indigo-500/15 to-transparent dark:from-sky-500/25 dark:via-indigo-500/20" />
                                    <div className="absolute inset-0 pointer-events-none opacity-25 blur-3xl bg-sky-200/50 dark:bg-indigo-600/25" />

                                    <div className="relative flex flex-col items-center text-center gap-2 sm:gap-3">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center bg-white/70 dark:bg-white/10 text-sky-600 dark:text-indigo-200 shadow-inner shrink-0">
                                            <ReceiptText className="w-5 h-5 sm:w-6 sm:h-6" />
                                        </div>
                                        <div className="space-y-0.5 min-w-0 w-full">
                                            <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">{t('dashboard.sections.paymentHistory')}</h3>
                                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-300/70 leading-snug line-clamp-2">{t('dashboard.sections.receipts')}</p>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </section>

                        <section className="mb-6">
                            <div className="flex items-center justify-between mb-4 ml-1 mr-1">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <span className="w-1 h-5 bg-amber-500 rounded-full inline-block"></span>
                                    {t('dashboard.sections.services')}
                                </h2>
                                <NotificationCenter />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {MAIN_ACTIONS.map((action) => (
                                    <ActionButton
                                        key={action.id}
                                        item={{
                                            ...action,
                                            label: t(action.labelKey),
                                            desc: t(action.descKey),
                                            badge: t(action.badgeKey),
                                            actionLabel: t(action.actionLabelKey),
                                        }}
                                        onClick={() => handleActionClick(action.id)}
                                    />
                                ))}
                            </div>
                        </section>

                        <section className="pb-8 px-1">
                            <button
                                className="
                                    w-full relative overflow-hidden rounded-2xl p-4 flex items-center justify-between
                                    bg-gradient-to-r from-gray-50 to-gray-100 dark:from-white/5 dark:to-white/10
                                    border border-gray-200 dark:border-white/10
                                    active:scale-[0.98] transition-all duration-200 group shadow-sm hover:shadow-md
                                "
                                onClick={() => window.open("https://t.me/mandarin_admin", "_blank")}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-white dark:bg-white/10 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform text-blue-500 dark:text-blue-400">
                                        <MessageSquare className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t('dashboard.sections.feedback')}</h3>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                            {t('dashboard.sections.contactUs')}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:translate-x-1 transition-transform" />
                            </button>

                            <div className="text-center mt-6">
                                <p className="text-[10px] text-gray-300 dark:text-white/10 font-mono">
                                    v2.0
                                </p>
                            </div>
                        </section>

                    </div>
                ) : activeTab === "track" ? (
                        <TrackCodeTab 
                            key={initialTrackView} 
                            initialView={initialTrackView}
                            autoFocus={trackAutoFocus}
                            onFocusConsumed={() => setTrackAutoFocus(false)}
                        />
                ) : null
                }

                <Suspense fallback={null}>
                    <ChinaAddressModal
                        isOpen={isChinaModalOpen}
                        onClose={() => setIsChinaModalOpen(false)}
                    />
                    <MakePaymentModal
                        isOpen={isPaymentModalOpen}
                        onClose={() => setIsPaymentModalOpen(false)}
                    />
                    <CalculatorModal
                        isOpen={isCalculatorOpen}
                        onClose={() => setIsCalculatorOpen(false)}
                    />
                    <ProhibitedItemsModal
                        isOpen={isProhibitedModalOpen}
                        onClose={() => setIsProhibitedModalOpen(false)}
                    />
                </Suspense>

                <CarouselMediaModal
                    isOpen={mediaModalItem !== null}
                    onClose={() => setMediaModalItem(null)}
                    itemId={mediaModalItem?.id ?? 0}
                    title={mediaModalItem?.title}
                    subTitle={mediaModalItem?.sub}
                    actionUrl={mediaModalItem?.actionUrl}
                    mediaItems={mediaModalItem?.mediaItems ?? []}
                />

            </div >
        </div >
    );
}