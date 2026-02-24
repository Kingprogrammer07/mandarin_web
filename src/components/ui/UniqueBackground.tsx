import { memo } from 'react';

// --- Unique Background SVG ---
// Diagonal grid + radial amber/gold orbs + top-left dark ink blot aesthetic
export const UniqueBackground = memo(() => (
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
));

UniqueBackground.displayName = 'UniqueBackground';
