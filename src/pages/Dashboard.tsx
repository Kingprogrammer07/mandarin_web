import { useState, memo, useRef, useEffect, lazy, Suspense } from "react";
import {
    MapPin,
    Calendar,
    Rocket,
    Edit3,
    Info,
    ChevronRight,
    IdCard,
    Home,
    ScanBarcode,
    ShieldOff,
    Plane,
    HelpCircle,
    ShieldAlert,
    Newspaper,
    FileText,
    Wallet,
    History,
    MessageSquare
} from "lucide-react";
import TrackCodeTab from "./dashboard/TrackCodeTab";
import { toast } from "sonner";
import NotificationCenter from "@/components/notifications/NotificationCenter";

// --- Types ---
interface ActionItemData {
    id: string;
    icon: React.ReactNode;
    label: string;
    desc: string;
    theme: "amber" | "emerald" | "sky" | "rose" | "violet";
}

interface CarouselItemData {
    id: number;
    type: "feature" | "ad";         // New: distinguish between app features and ads
    title?: string;                 // Optional for ads
    sub?: string;                   // Optional for ads
    gradient?: string;              // Only for features
    bgIcon?: React.ReactNode;       // Only for features
    mainIcon?: React.ReactNode;     // Only for features
    mediaType?: "image" | "video" | "gif";  // Only for ads
    mediaUrl?: string;              // Only for ads
    actionUrl?: string;             // Only for ads (external link)
    textColor?: string;             // Optional custom text color for ads
}



// --- Data ---
const CAROUSEL_ITEMS: CarouselItemData[] = [
    {
        id: 101, // ID to distinguish
        type: "ad",
        mediaType: "gif",
        mediaUrl: "https://assets-v2.lottiefiles.com/a/6a21fb9a-1178-11ee-a809-cbf4c1cb708c/KS4fSTQC7T.gif", // Sample e-commerce/sale image
        actionUrl: "https://google.com",
        title: "Katta Chegirmalar!",
        sub: "Batafsil ma'lumot",
        textColor: "#ffffff"
    },
    {
        id: 102, // ID to distinguish
        type: "ad",
        mediaType: "video",
        mediaUrl: "https://static.vecteezy.com/system/resources/previews/001/616/378/mp4/close-up-of-beautiful-orange-flames-drawing-random-shapes-in-4k-slow-motion-free-video.mp4", // Sample e-commerce/sale image
        actionUrl: "https://google.com",
        title: "Katta Chegirmalar!",
        sub: "Batafsil ma'lumot",
        textColor: "#ffffff"
    },
    {
        id: 5,
        type: "feature",
        title: "Yangiliklar",
        sub: "O'qish",
        gradient: "from-pink-900 to-pink-600",
        bgIcon: <Newspaper className="text-white/10 absolute -right-4 -top-4" style={{ width: 96, height: 96 }} />,
        mainIcon: <Newspaper className="text-white/90" style={{ width: 32, height: 32 }} />,
    },
    {
        id: 1,
        type: "feature",
        title: "Taqiqlanganlar",
        sub: "Ro'yxatni ko'rish",
        gradient: "from-red-900 to-red-600",
        bgIcon: <ShieldAlert className="text-white/10 absolute -right-4 -top-4" style={{ width: 96, height: 96 }} />,
        mainIcon: <ShieldOff className="text-white/90" style={{ width: 32, height: 32 }} />,
    },
    {
        id: 2,
        type: "feature",
        title: "ID olish",
        sub: "Qo'llanma",
        gradient: "from-blue-900 to-blue-600",
        bgIcon: <IdCard className="text-white/10 absolute -right-4 -top-4" style={{ width: 96, height: 96 }} />,
        mainIcon: <IdCard className="text-white/90" style={{ width: 32, height: 32 }} />,
    },
    {
        id: 3,
        type: "feature",
        title: "Yetkazib berish",
        sub: "Qo'llanma",
        gradient: "from-purple-900 to-purple-600",
        bgIcon: <Rocket className="text-white/10 absolute -right-4 -top-4" style={{ width: 96, height: 96 }} />,
        mainIcon: <Plane className="text-white/90" style={{ width: 32, height: 32 }} />,
    },
    {
        id: 4,
        type: "feature",
        title: "Yordam",
        sub: "Savol-javob",
        gradient: "from-cyan-900 to-cyan-600",
        bgIcon: <HelpCircle className="text-white/10 absolute -right-4 -top-4" style={{ width: 96, height: 96 }} />,
        mainIcon: <Info className="text-white/90" style={{ width: 32, height: 32 }} />,
    },
];

const MAIN_ACTIONS: ActionItemData[] = [
    {
        id: "china",
        icon: <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />,
        label: "Xitoy manzili",
        desc: "Guangzhou, Yiwu",
        theme: "amber"
    },
    {
        id: "schedule",
        icon: <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />,
        label: "Reyslar Jadvali",
        desc: "Uchish va kelish vaqtlari",
        theme: "sky"
    },
    {
        id: "request",
        icon: <Edit3 className="w-5 h-5 sm:w-6 sm:h-6" />,
        label: "Zayafka qoldirish",
        desc: "Buyurtma berish",
        theme: "emerald"
    },
    {
        id: "report",
        icon: <FileText className="w-5 h-5 sm:w-6 sm:h-6" />,
        label: "Hisobotni ko'rish",
        desc: "Barcha hisobotlar",
        theme: "sky"
    },
    {
        id: "payment",
        icon: <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />,
        label: "To'lov qilish",
        desc: "Balansni to'ldirish",
        theme: "rose"
    },
    {
        id: "history",
        icon: <History className="w-5 h-5 sm:w-6 sm:h-6" />,
        label: "Mening yuklarim",
        desc: "Sizning barcha yuklaringiz tarixi",
        theme: "violet"
    },
];

const CarouselCard = memo(({ item }: { item: CarouselItemData }) => {
    const isAd = item.type === "ad";

    const handleClick = () => {
        if (isAd && item.actionUrl) {
            window.open(item.actionUrl, "_blank");
        }
    };

    if (isAd) {
        return (
            <div
                onClick={handleClick}
                className="
                    flex-shrink-0 w-[85%] sm:w-[45%] lg:w-full 
                    h-40 rounded-3xl relative overflow-hidden 
                    snap-start cursor-pointer hover:scale-[0.98] transition-all duration-200
                    border border-white/10 shadow-lg group
                "
            >
                {/* Background Media */}
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

                {/* Gradient Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Content */}
                <div className="absolute inset-0 p-5 flex flex-col justify-end">
                    {item.title && (
                        <h3
                            className="font-bold text-xl leading-tight mb-0.5"
                            style={{ color: item.textColor || "white" }}
                        >
                            {item.title}
                        </h3>
                    )}
                    {item.sub && (
                        <p className="text-white/80 text-sm font-medium flex items-center gap-1">
                            {item.sub} <ChevronRight className="w-4 h-4" />
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // Default Feature Card
    return (
        <div
            className={`
                flex-shrink-0 w-[85%] sm:w-[45%] lg:w-full 
                h-40 rounded-3xl p-5 relative overflow-hidden 
                snap-start cursor-pointer hover:scale-[0.98] transition-transform duration-200
                bg-gradient-to-br ${item.gradient}
                border border-white/10 shadow-lg
            `}
        >
            {/* Large decorative background icon */}
            {item.bgIcon}

            <div className="h-full flex flex-col justify-between relative z-10">
                {/* Main icon top-left */}
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
                    {item.mainIcon}
                </div>

                {/* Text bottom */}
                <div>
                    <h3 className="text-white font-bold text-xl leading-tight mb-1">{item.title}</h3>
                    <p className="text-white/70 text-sm font-medium">{item.sub}</p>
                </div>
            </div>
        </div>
    );
});



const ActionButton = memo(({ item, onClick }: { item: ActionItemData; onClick?: () => void }) => {
    // Theme configurations - Refined for "Glass/Clean" look
    // Removed heavy container backgrounds, kept icon colors for identity
    const themes = {
        amber: {
            iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
            title: "text-gray-900 dark:text-gray-100", // Neutral text for clean look
            desc: "text-gray-500 dark:text-gray-400",
            arrow: "text-amber-500"
        },
        emerald: {
            iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
            title: "text-gray-900 dark:text-gray-100",
            desc: "text-gray-500 dark:text-gray-400",
            arrow: "text-emerald-500"
        },
        sky: {
            iconBg: "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400",
            title: "text-gray-900 dark:text-gray-100",
            desc: "text-gray-500 dark:text-gray-400",
            arrow: "text-sky-500"
        },
        rose: {
            iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400",
            title: "text-gray-900 dark:text-gray-100",
            desc: "text-gray-500 dark:text-gray-400",
            arrow: "text-rose-500"
        },
        violet: {
            iconBg: "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400",
            title: "text-gray-900 dark:text-gray-100",
            desc: "text-gray-500 dark:text-gray-400",
            arrow: "text-violet-500"
        }
    };

    const theme = themes[item.theme];

    return (
        <div
            className="
                relative overflow-hidden rounded-2xl p-3 sm:p-4 flex items-center justify-between cursor-pointer
                hover:scale-[0.98] transition-all duration-200 group h-20 sm:h-24
                bg-white dark:bg-white/5 border-2 border-white/20 dark:border-white/10 shadow-sm
                backdrop-blur-md
            "
            onClick={onClick}
        >
            <div className="flex items-center gap-3 sm:gap-4">
                {/* Icon Left */}
                <div
                    className={`
                        w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-colors shrink-0
                        ${theme.iconBg}
                    `}
                >
                    {item.icon}
                </div>

                {/* Text Content */}
                <div>
                    <h3 className={`font-bold text-sm sm:text-base leading-tight mb-0.5 ${theme.title}`}>
                        {item.label}
                    </h3>
                    <p className={`text-[10px] sm:text-xs font-medium ${theme.desc}`}>
                        {item.desc}
                    </p>
                </div>
            </div>

            {/* Arrow Right */}
            <div className={`mr-1 sm:mr-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ${theme.arrow}`}>
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
        </div>
    );
});
// --- Unique Background SVG ---
// Diagonal grid + radial amber/gold orbs + top-left dark ink blot aesthetic
const UniqueBackground = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 dark:block hidden">

        {/* Base dark canvas */}
        <div className="absolute inset-0 bg-[#0d0a04]" />

        {/* Diagonal mesh grid lines — thin, barely visible */}
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

        {/* Noise grain overlay */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <filter id="grain">
                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>

        {/* Primary amber orb — bottom-left */}
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

        {/* Secondary warm orb — top-right, copper tone */}
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

        {/* Thin accent orb — center, very subtle warm white */}
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

        {/* Decorative circle ring — bottom-right */}
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

        {/* Top-left cargo icon watermark */}
        <svg
            className="absolute opacity-[0.03]"
            style={{ top: "8%", left: "-2%", width: "280px", height: "280px" }}
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Stylized box / package shape */}
            <rect x="15" y="35" width="70" height="50" rx="3" fill="none" stroke="#f59e0b" strokeWidth="2" />
            <polyline points="15,35 50,15 85,35" fill="none" stroke="#f59e0b" strokeWidth="2" />
            <line x1="50" y1="15" x2="50" y2="85" stroke="#f59e0b" strokeWidth="1.5" />
            <line x1="15" y1="55" x2="85" y2="55" stroke="#f59e0b" strokeWidth="1" />
        </svg>

        {/* Horizontal scan line — ultra subtle */}
        <div
            className="absolute left-0 right-0 h-px opacity-[0.06]"
            style={{
                top: "38%",
                background: "linear-gradient(to right, transparent 0%, rgba(245,158,11,0.8) 30%, rgba(245,158,11,0.8) 70%, transparent 100%)",
            }}
        />
    </div>
);

// Detect dark mode
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

// --- Premium Tab Component ---
const HeaderTabs = memo(({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (t: string) => void }) => {
    const isHome = activeTab === "home";
    const dark = useDarkMode();

    // Indicator styles via inline to guarantee visibility in both modes
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
            {/* Outer container */}
            <div className="relative flex rounded-2xl p-1 gap-1" style={wrapperStyle}>

                {/* Animated sliding indicator — inline styles, no Tailwind compound classes */}
                <div style={indicatorStyle} />

                {/* Home Tab */}
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
                    <span>Bosh sahifa</span>
                </button>

                {/* Track Tab */}
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
                    <span>{activeTab === 'track' ? 'Trek-kod' : activeTab === 'schedule' ? 'Jadval' : 'Trek-kod'}</span>
                </button>
            </div>

            {/* Bottom glow accent — dark only, shifts with active tab */}
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





// --- Lazy Load Components ---
const ChinaAddressModal = lazy(() => import('../components/modals/ChinaAddressModal'));
const FlightSchedulePage = lazy(() => import('../components/pages/FlightSchedulePage'));

// --- Main Component ---
export default function Dashboard() {
    const [activeTab, setActiveTab] = useState("home");
    const [initialTrackView, setInitialTrackView] = useState<'search' | 'history'>('search');
    const [isChinaModalOpen, setIsChinaModalOpen] = useState(false);

    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isPaused, setIsPaused] = useState(false);

    // --- Auto-scroll Logic ---
    useEffect(() => {
        // If not home or paused by interaction, don't auto-scroll
        if (activeTab !== "home" || isPaused) return;

        const interval = setInterval(() => {
            if (scrollRef.current) {
                const { scrollLeft, clientWidth, scrollWidth } = scrollRef.current;

                // If reasonably close to the end, snap back to start
                const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 50;

                if (isAtEnd) {
                    scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
                } else {
                    // Scroll by ~ one card width (assuming ~85% width on mobile or just partial)
                    // We'll scroll by half the container width to be safe for snapping
                    scrollRef.current.scrollBy({ left: clientWidth * 0.6, behavior: "smooth" });
                }
            }
        }, 4000); // 4 seconds

        return () => clearInterval(interval);
    }, [activeTab, isPaused]);

    const onTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX;
        touchStartY.current = e.targetTouches[0].clientY;
        setIsPaused(true); // Pause auto-scroll on touch
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartX.current || !touchStartY.current) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const distanceX = touchStartX.current - touchEndX;
        const distanceY = touchStartY.current - touchEndY;
        const minSwipeDistance = 50;

        // Check if horizontal swipe dominant (horizontal distance > vertical distance)
        // to prevent accidental tab switch during scroll
        if (Math.abs(distanceX) > Math.abs(distanceY)) {
            // Swipe Left (Home -> Track)
            if (distanceX > minSwipeDistance) {
                setActiveTab("track");
            }
            // Swipe Right (Track -> Home)
            if (distanceX < -minSwipeDistance) {
                setActiveTab("home");
            }
        }

        touchStartX.current = null;
        touchStartY.current = null;

        // Resume auto-scroll after a delay
        setTimeout(() => setIsPaused(false), 3000);
    };

    const handleActionClick = (id: string) => {
        if (id === 'history') {
            setInitialTrackView('history');
            setActiveTab('track');
        } else if (id === 'china') {
            setIsChinaModalOpen(true);
            return;
        } else if (id === 'schedule') {
            setActiveTab('schedule');
            return;
        } else {
            // Assuming `toast` is defined elsewhere or this is a placeholder for a notification system
            // The original code had `console.log("Action clicked:", id);` here.
            // The provided snippet implies a `toast.info` call for other actions.
            // I'm placing it as the final fallback.
            // If `toast` is not defined, this line will cause an error.
            // Please ensure `toast` is imported/defined if this is the intended behavior.
            // For now, I'll assume it's available or a placeholder.
            // If not, it should revert to `console.log`.
            // Given the instruction is only to add the 'schedule' case,
            // and the snippet includes `toast.info` as a general fallback,
            // I'll include it as the new default fallback.
            toast.info(`${id} tanlandi (Tez orada...)`);
        }
    };

    return (
        <div
            className="min-h-screen bg-gray-50 dark:bg-[#0d0a04] text-gray-900 dark:text-white pb-24 transition-colors duration-300 font-sans selection:bg-orange-500/30"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >

            {/* Unique Background — replaces the old blue/purple blobs */}
            <UniqueBackground />

            <div className="relative z-10 max-w-4xl mx-auto px-4 pt-4 sm:pt-8">

                {/* Premium Header Tabs */}
                <HeaderTabs activeTab={activeTab} setActiveTab={setActiveTab} />


                {activeTab === 'schedule' && (
                    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-black/95 animate-pulse" />}>
                        <FlightSchedulePage
                            onBack={() => setActiveTab('home')}
                            onNavigateToTrack={() => setActiveTab('track')}
                        />
                    </Suspense>
                )}

                {activeTab === "home" ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* Hero Carousel */}
                        <section>
                            <h2 className="text-lg font-bold mb-4 ml-1 flex items-center gap-2">
                                <span className="w-1 h-5 bg-blue-500 rounded-full inline-block"></span>
                                Muhim ma'lumotlar
                            </h2>
                            <div
                                ref={scrollRef}
                                className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide lg:grid lg:grid-cols-4 lg:mx-0 lg:px-0 lg:pb-0 lg:gap-5"
                                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                                onTouchStart={(e) => { e.stopPropagation(); setIsPaused(true); }}
                                onTouchEnd={(e) => { e.stopPropagation(); setTimeout(() => setIsPaused(false), 3000); }}
                            >
                                {CAROUSEL_ITEMS.map((item) => (
                                    <CarouselCard key={item.id} item={item} />
                                ))}
                            </div>
                        </section>

                        {/* Main Action Grid */}
                        <section className="mb-6">
                            <div className="flex items-center justify-between mb-4 ml-1 mr-1">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <span className="w-1 h-5 bg-amber-500 rounded-full inline-block"></span>
                                    Xizmatlar
                                </h2>

                                {/* Notification Box */}
                                <NotificationCenter />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {MAIN_ACTIONS.map((action) => (
                                    <ActionButton
                                        key={action.id}
                                        item={action}
                                        onClick={() => handleActionClick(action.id)}
                                    />
                                ))}
                            </div>
                        </section>

                        {/* Feedback Footer */}
                        <section className="pb-8 px-1">
                            <button
                                className="
                                    w-full relative overflow-hidden rounded-2xl p-4 flex items-center justify-between
                                    bg-gradient-to-r from-gray-50 to-gray-100 dark:from-white/5 dark:to-white/10
                                    border border-gray-200 dark:border-white/10
                                    active:scale-[0.98] transition-all duration-200 group shadow-sm hover:shadow-md
                                "
                                onClick={() => window.open("https://t.me/java_strong", "_blank")}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-white dark:bg-white/10 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform text-blue-500 dark:text-blue-400">
                                        <MessageSquare className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Taklif va shikoyatlar</h3>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                            Biz bilan bog'laning
                                        </p>
                                    </div>
                                </div>

                                <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:translate-x-1 transition-transform" />
                            </button>

                            <div className="text-center mt-6">
                                <p className="text-[10px] text-gray-300 dark:text-white/10 font-mono">
                                    v1.0.2
                                </p>
                            </div>
                        </section>

                    </div>
                ) : activeTab === "track" ? (
                    <TrackCodeTab key={initialTrackView} initialView={initialTrackView} />
                ) : null
                }

                {/* --- Modals --- */}
                <Suspense fallback={null}>
                    <ChinaAddressModal
                        isOpen={isChinaModalOpen}
                        onClose={() => setIsChinaModalOpen(false)}
                    />
                </Suspense>

            </div >
        </div >
    );
}
