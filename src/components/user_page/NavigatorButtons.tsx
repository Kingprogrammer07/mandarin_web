// src/components/ui/NavigatorButton.tsx
import React from "react";
import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface NavigatorButtonProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  href?: string;       // Agar bor bo'lsa, tashqi saytga o'tadi
  onClick?: () => void; // Agar href yo'q bo'lsa, funksiya bajaradi
  variant?: "primary" | "secondary" | "glass";
  className?: string;
}

export const NavigatorButton: React.FC<NavigatorButtonProps> = ({
  icon: Icon,
  title,
  subtitle,
  href,
  onClick,
  variant = "glass",
  className,
}) => {
  // Dizayn variantlari
  const variants = {
    primary: "bg-gradient-to-br from-blue-500/80 to-indigo-600/80 text-white shadow-lg shadow-blue-500/30 border-blue-400/50",
    secondary: "bg-white/5 border-white/10 text-white hover:bg-white/10",
    glass: "bg-white/10 border-white/20 text-white backdrop-blur-md hover:bg-white/20 shadow-sm",
  };

  const content = (
    <>
      <div className={cn("p-3 rounded-xl transition-colors", 
        variant === 'primary' ? "bg-white/20" : "bg-white/5 group-hover:bg-white/10"
      )}>
        <Icon size={24} strokeWidth={1.5} />
      </div>
      <div className="flex flex-col text-left">
        <span className="font-semibold text-sm tracking-wide">{title}</span>
        {subtitle && <span className="text-xs text-white/50">{subtitle}</span>}
      </div>
      
      {/* O'ng tomondagi strelka yoki indikator (dekoratsiya) */}
      <div className="ml-auto opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </>
  );

  // Common animation props
  const motionProps = {
    whileHover: { scale: 1.02, y: -2 },
    whileTap: { scale: 0.98 },
    className: cn(
      "group relative flex items-center gap-4 w-full p-4 rounded-2xl border transition-all duration-300 overflow-hidden",
      variants[variant],
      className
    )
  };

  // Agar href bo'lsa <a>, bo'lmasa <button> qaytaramiz
  if (href) {
    return (
      <motion.a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer" 
        {...motionProps}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button onClick={onClick} {...motionProps}>
      {content}
    </motion.button>
  );
};