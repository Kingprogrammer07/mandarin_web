import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useNavLoadingStore } from '@/store/navLoadingStore';
import { triggerSoftHaptic } from '@/utils/haptics';

export interface FloatingNavItem<T> {
    id: string;
    label: string;
    icon: React.ElementType;
    page: T;
    disabled?: boolean;
}

export interface FloatingNavbarProps<T> {
    items: FloatingNavItem<T>[];
    activePage: T;
    onNavigate: (page: T) => void;
    className?: string;
    desktopPosition?: 'top' | 'bottom';
}

// Conic-gradient "comet tail" — uses @property --nav-ring-angle so the browser
// interpolates the angle directly, creating a real rotating sweep (not element rotation).
const RING_GRADIENT =
    'conic-gradient(from var(--nav-ring-angle), transparent 0%, transparent 40%, #fdba74 52%, #f97316 62%, #fbbf24 68%, #f97316 74%, #fdba74 82%, transparent 88%, transparent 100%)';

const RING_DURATION_MS = 1800;

export const FloatingNavbar = <T,>({
    items,
    activePage,
    onNavigate,
    className,
    desktopPosition = 'top',
}: FloatingNavbarProps<T>) => {
    const isNavLoading = useNavLoadingStore((s) => s.isLoading);
    const showRing = isNavLoading;
    const ringAnimation = `nav-ring-spin ${RING_DURATION_MS}ms linear infinite`;

    const handleNavClick = (item: FloatingNavItem<T>) => {
        if (item.disabled) return;
        triggerSoftHaptic();
        onNavigate(item.page);
    };

    const isItemActive = (item: FloatingNavItem<T>) => activePage === item.page;

    const containerClasses = cn(
        "flex items-center gap-1.5 rounded-full p-1.5 pointer-events-auto",
        "border backdrop-blur-2xl shadow-[0_20px_42px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.40)]",
        "bg-white/88 border-orange-100/80",
        "dark:bg-[#0a0e15]/86 dark:border-orange-200/14 dark:shadow-[0_20px_42px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)]"
    );

    const desktopWrapperClasses = cn(
        "hidden md:flex fixed left-0 right-0 z-40 justify-center pointer-events-none px-4",
        desktopPosition === 'top' ? "top-24" : "bottom-8",
        className
    );

    const ringOverlay = showRing ? (
        <div
            className="absolute -inset-[2px] rounded-full pointer-events-none"
            style={{
                background: RING_GRADIENT,
                animation: ringAnimation,
            }}
        />
    ) : null;

    return (
        <>
            {/* Mobile Bottom */}
            <div className={cn("md:hidden fixed left-0 right-0 bottom-4 z-50 flex justify-center pointer-events-none px-4", className)}>
                <div className="relative">
                    {ringOverlay}
                    <div className={containerClasses}>
                        {items.map((item) => {
                            const active = isItemActive(item);
                            const disabled = item.disabled;

                            return (
                                <button
                                    key={`mobile-${item.id}`}
                                    onClick={() => !disabled && handleNavClick(item)}
                                    disabled={disabled}
                                    className={cn(
                                        "relative flex h-[52px] min-w-[70px] flex-col items-center justify-center gap-0.5 rounded-full px-3 transition-all duration-300",
                                        disabled ? "opacity-50 cursor-not-allowed grayscale" : "cursor-pointer"
                                    )}
                                >
                                    {active && (
                                        <motion.div
                                            layoutId="mobile-nav-pill"
                                            className="absolute inset-0 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 shadow-[0_4px_12px_rgba(249,115,22,0.30)]"
                                            initial={false}
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                    <span className="relative z-10 flex flex-col items-center gap-0.5">
                                        <item.icon className={cn(
                                            "w-5 h-5 transition-all duration-200",
                                            active ? "stroke-[2.5px] text-white" : "text-gray-400 dark:text-white/38"
                                        )} />
                                        <span className={cn(
                                            "text-[10px] font-extrabold leading-none transition-all duration-200",
                                            active ? "text-white" : "text-gray-400 dark:text-white/38"
                                        )}>
                                            {item.label}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Desktop */}
            <div className={desktopWrapperClasses}>
                <div className="relative">
                    {ringOverlay}
                    <div className={cn(containerClasses, "gap-2 p-2")}>
                        {items.map((item) => {
                            const active = isItemActive(item);
                            const disabled = item.disabled;

                            return (
                                <button
                                    key={`desktop-${item.id}`}
                                    onClick={() => !disabled && handleNavClick(item)}
                                    disabled={disabled}
                                    className={cn(
                                        "relative flex items-center justify-center rounded-full transition-all duration-300",
                                        active
                                            ? "px-6 py-2.5 text-white"
                                            : "px-5 py-2.5 text-gray-500 hover:bg-orange-50/70 hover:text-orange-600 dark:text-white/38 dark:hover:bg-white/[0.055] dark:hover:text-white/72",
                                        disabled ? "opacity-40 cursor-not-allowed grayscale" : "cursor-pointer"
                                    )}
                                >
                                    {active && (
                                        <motion.div
                                            layoutId="desktop-nav-pill"
                                            className="absolute inset-0 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 shadow-[0_4px_12px_rgba(249,115,22,0.30)]"
                                            initial={false}
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                    <span className={cn(
                                        "relative z-10 flex items-center gap-2 transition-colors duration-200",
                                        active ? "text-white" : "text-gray-500 dark:text-white/38"
                                    )}>
                                        <item.icon className={cn("w-4 h-4", active && "stroke-[2.5px]")} />
                                        <span className="font-semibold text-sm">{item.label}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );
};
