import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

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

export const FloatingNavbar = <T,>({
    items,
    activePage,
    onNavigate,
    className,
    desktopPosition = 'top',
}: FloatingNavbarProps<T>) => {

    const handleNavClick = (item: FloatingNavItem<T>) => {
        if (item.disabled) {
            return;
        }
        onNavigate(item.page);
    };

    const isItemActive = (item: FloatingNavItem<T>) => {
        return activePage === item.page;
    };

    // Glassmorphism container style (Dark Mode Supported)
    const containerClasses = cn(
        "flex items-center gap-1 p-1.5 rounded-full pointer-events-auto",
        "backdrop-blur-xl shadow-[0_8px_32px_rgba(249,115,22,0.08)]",
        "bg-white/50 border border-orange-100 ring-1 ring-orange-50", // Light Mode
        "dark:bg-[#1a1638]/50 dark:border-white/10 dark:ring-white/5 dark:shadow-none" // Dark Mode
    );

    const buttonBaseClasses = "relative flex items-center justify-center rounded-full transition-all duration-300";

    // Light: px-4 py-3 hover:bg-orange-50/50 hover:text-orange-600
    // Dark:  hover:bg-white/5 hover:text-white
    const buttonInactiveClasses = "px-4 py-3 text-gray-500 dark:text-gray-400 hover:bg-orange-50/50 dark:hover:bg-white/5 hover:text-orange-600 dark:hover:text-white";

    const buttonActiveClasses = "px-5 py-3 text-white";

    const desktopWrapperClasses = cn(
        "hidden md:flex fixed left-0 right-0 z-40 justify-center pointer-events-none",
        desktopPosition === 'top' ? "top-24" : "bottom-8",
        className
    );

    return (
        <>
            {/* Mobile Bottom Wrapper */}
            <div className={cn("md:hidden fixed bottom-3 left-0 right-0 z-50 flex justify-center pointer-events-none px-4", className)}>
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
                                    buttonBaseClasses,
                                    active ? buttonActiveClasses : buttonInactiveClasses,
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
                                <span className={cn(
                                    "relative z-10 flex items-center gap-2 transition-colors duration-200",
                                    active ? "text-white" : "text-gray-500 dark:text-gray-400"
                                )}>
                                    <item.icon className={cn("w-5 h-5", active && "stroke-[2.5px]")} />
                                    {active && (
                                        <motion.span
                                            initial={{ opacity: 0, width: 0 }}
                                            animate={{ opacity: 1, width: 'auto' }}
                                            exit={{ opacity: 0, width: 0 }}
                                            className="text-sm font-semibold whitespace-nowrap overflow-hidden"
                                        >
                                            {item.label}
                                        </motion.span>
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Desktop Wrapper */}
            <div className={desktopWrapperClasses}>
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
                                    buttonBaseClasses,
                                    active ? "px-6 py-2.5 text-white" : "px-5 py-2.5 text-gray-500 dark:text-gray-400 hover:bg-orange-50/50 dark:hover:bg-white/5 hover:text-orange-600 dark:hover:text-white",
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
        </>
    );
};
