import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useNavLoadingStore } from '@/store/navLoadingStore';

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
    // Mount ring: plays once on first render, then stops.
    const [mountRingActive, setMountRingActive] = useState(true);
    useEffect(() => {
        const t = setTimeout(() => setMountRingActive(false), RING_DURATION_MS);
        return () => clearTimeout(t);
    }, []);

    // Loading ring: loops while any TopProgressBar is mounted.
    const isNavLoading = useNavLoadingStore((s) => s.isLoading);

    const showRing = mountRingActive || isNavLoading;
    const ringAnimation = isNavLoading
        ? `nav-ring-spin ${RING_DURATION_MS}ms linear infinite`
        : `nav-ring-spin ${RING_DURATION_MS}ms linear 1 forwards`;

    const handleNavClick = (item: FloatingNavItem<T>) => {
        if (item.disabled) return;
        onNavigate(item.page);
    };

    const isItemActive = (item: FloatingNavItem<T>) => activePage === item.page;

    const containerClasses = cn(
        "flex items-center gap-3 p-1.5 rounded-full pointer-events-auto",
        "backdrop-blur-xl shadow-[0_8px_32px_rgba(249,115,22,0.08)]",
        "bg-white/80 border border-orange-100 ring-1 ring-orange-50",
        "dark:bg-[#0a0e15]/80 dark:border-orange-200/10 dark:ring-orange-200/5 dark:shadow-[0_12px_34px_rgba(0,0,0,0.26)]"
    );

    const desktopWrapperClasses = cn(
        "hidden md:flex fixed left-0 right-0 z-40 justify-center pointer-events-none",
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
            <div
                className={cn("md:hidden fixed left-0 right-0 bottom-4 z-50 flex justify-center pointer-events-none px-4", className)}
            >
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
                                        "relative flex flex-col items-center justify-center gap-0.5 px-4.5 py-2 rounded-full transition-all duration-300",
                                        disabled ? "opacity-50 cursor-not-allowed grayscale" : "cursor-pointer"
                                    )}
                                >
                                    {active && (
                                        <motion.div
                                            layoutId="mobile-nav-pill"
                                            className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-amber-500 shadow-[0_4px_12px_rgba(249,115,22,0.3)] rounded-full"
                                            initial={false}
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                    <span className="relative z-10 flex flex-col items-center gap-0.5">
                                        <item.icon className={cn(
                                            "w-5 h-5 transition-all duration-200",
                                            active ? "stroke-[2.5px] text-white" : "text-gray-400 dark:text-gray-500"
                                        )} />
                                        <span className={cn(
                                            "text-[10px] font-semibold leading-none transition-all duration-200",
                                            active ? "text-white" : "text-gray-400 dark:text-gray-500"
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
                                            : "px-5 py-2.5 text-gray-500 dark:text-gray-400 hover:bg-orange-50/50 dark:hover:bg-white/5 hover:text-orange-600 dark:hover:text-white",
                                        disabled ? "opacity-40 cursor-not-allowed grayscale" : "cursor-pointer"
                                    )}
                                >
                                    {active && (
                                        <motion.div
                                            layoutId="desktop-nav-pill"
                                            className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-amber-500 shadow-[0_4px_12px_rgba(249,115,22,0.3)] rounded-full"
                                            initial={false}
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                    <span className={cn(
                                        "relative z-10 flex items-center gap-2 transition-colors duration-200",
                                        active ? "text-white" : "text-gray-500 dark:text-gray-400"
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
