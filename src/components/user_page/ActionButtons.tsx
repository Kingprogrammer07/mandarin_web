import { memo } from "react";
import { ChevronRight } from "lucide-react";

// ─────────────────────────────────────────────────────────
//  WHY NO FREEZE:
//  • Zero inline style objects for colors — only CSS variables
//  • dark: class switch = pure CSS recalc, no React re-render
//  • backdrop-blur stays on its own GPU layer untouched
//  • willChange: transform set once via className, never changes
//  • No JS runs on theme toggle — browser handles everything
// ─────────────────────────────────────────────────────────

interface ActionItemData {
    id: string;
    icon: React.ReactNode;
    bgIcon?: React.ReactNode;
    label: string;
    desc: string;
    badge: string;
    actionLabel: string;
    theme: "amber" | "emerald" | "sky" | "rose" | "violet" | "cyan";
}

// ─── CSS variable class sets per theme ───────────────────
// Each theme injects --ab-* variables onto the card element.
// dark: variants flip the same variables — no JS needed.
const THEME_VARS: Record<ActionItemData["theme"], string> = {
    amber: `
        [--ab-bg:rgba(255,251,235,0.58)]           dark:[--ab-bg:rgba(28,20,5,0.52)]
        [--ab-border:rgba(245,158,11,0.28)]         dark:[--ab-border:rgba(245,158,11,0.22)]
        [--ab-shine:rgba(255,255,255,0.75)]         dark:[--ab-shine:rgba(255,255,255,0.07)]
        [--ab-shadow:rgba(0,0,0,0.05)]              dark:[--ab-shadow:rgba(0,0,0,0.35)]
        [--ab-icon-bg:rgba(245,158,11,0.15)]        dark:[--ab-icon-bg:rgba(245,158,11,0.18)]
        [--ab-icon-ring:rgba(255,255,255,0.55)]     dark:[--ab-icon-ring:rgba(255,255,255,0.07)]
        [--ab-icon-color:#d97706]                   dark:[--ab-icon-color:#fbbf24]
        [--ab-wm-color:rgba(245,158,11,0.06)]       dark:[--ab-wm-color:rgba(245,158,11,0.06)]
        [--ab-badge-text:#b45309]                   dark:[--ab-badge-text:#fbbf24]
        [--ab-badge-bg:rgba(245,158,11,0.12)]       dark:[--ab-badge-bg:rgba(245,158,11,0.15)]
        [--ab-badge-border:rgba(245,158,11,0.35)]   dark:[--ab-badge-border:rgba(245,158,11,0.28)]
        [--ab-title:#111827]                        dark:[--ab-title:#f0ece5]
        [--ab-desc:rgba(120,80,10,0.6)]             dark:[--ab-desc:rgba(255,255,255,0.35)]
        [--ab-bar-border:rgba(245,158,11,0.22)]     dark:[--ab-bar-border:rgba(245,158,11,0.18)]
        [--ab-bar-text:#d97706]                     dark:[--ab-bar-text:#fbbf24]
        [--ab-glow:rgba(245,158,11,0.13)]           dark:[--ab-glow:rgba(245,158,11,0.2)]
    `,
    emerald: `
        [--ab-bg:rgba(236,253,245,0.58)]            dark:[--ab-bg:rgba(5,28,18,0.52)]
        [--ab-border:rgba(16,185,129,0.28)]          dark:[--ab-border:rgba(16,185,129,0.22)]
        [--ab-shine:rgba(255,255,255,0.75)]          dark:[--ab-shine:rgba(255,255,255,0.07)]
        [--ab-shadow:rgba(0,0,0,0.05)]               dark:[--ab-shadow:rgba(0,0,0,0.35)]
        [--ab-icon-bg:rgba(16,185,129,0.15)]         dark:[--ab-icon-bg:rgba(16,185,129,0.18)]
        [--ab-icon-ring:rgba(255,255,255,0.55)]      dark:[--ab-icon-ring:rgba(255,255,255,0.07)]
        [--ab-icon-color:#059669]                    dark:[--ab-icon-color:#34d399]
        [--ab-wm-color:rgba(16,185,129,0.06)]        dark:[--ab-wm-color:rgba(16,185,129,0.06)]
        [--ab-badge-text:#047857]                    dark:[--ab-badge-text:#34d399]
        [--ab-badge-bg:rgba(16,185,129,0.12)]        dark:[--ab-badge-bg:rgba(16,185,129,0.15)]
        [--ab-badge-border:rgba(16,185,129,0.35)]    dark:[--ab-badge-border:rgba(16,185,129,0.28)]
        [--ab-title:#111827]                         dark:[--ab-title:#f0ece5]
        [--ab-desc:rgba(6,78,59,0.6)]                dark:[--ab-desc:rgba(255,255,255,0.35)]
        [--ab-bar-border:rgba(16,185,129,0.22)]      dark:[--ab-bar-border:rgba(16,185,129,0.18)]
        [--ab-bar-text:#059669]                      dark:[--ab-bar-text:#34d399]
        [--ab-glow:rgba(16,185,129,0.13)]            dark:[--ab-glow:rgba(16,185,129,0.2)]
    `,
    sky: `
        [--ab-bg:rgba(240,249,255,0.58)]            dark:[--ab-bg:rgba(5,18,28,0.52)]
        [--ab-border:rgba(14,165,233,0.28)]          dark:[--ab-border:rgba(14,165,233,0.22)]
        [--ab-shine:rgba(255,255,255,0.75)]          dark:[--ab-shine:rgba(255,255,255,0.07)]
        [--ab-shadow:rgba(0,0,0,0.05)]               dark:[--ab-shadow:rgba(0,0,0,0.35)]
        [--ab-icon-bg:rgba(14,165,233,0.15)]         dark:[--ab-icon-bg:rgba(14,165,233,0.18)]
        [--ab-icon-ring:rgba(255,255,255,0.55)]      dark:[--ab-icon-ring:rgba(255,255,255,0.07)]
        [--ab-icon-color:#0284c7]                    dark:[--ab-icon-color:#38bdf8]
        [--ab-wm-color:rgba(14,165,233,0.06)]        dark:[--ab-wm-color:rgba(14,165,233,0.06)]
        [--ab-badge-text:#0369a1]                    dark:[--ab-badge-text:#38bdf8]
        [--ab-badge-bg:rgba(14,165,233,0.12)]        dark:[--ab-badge-bg:rgba(14,165,233,0.15)]
        [--ab-badge-border:rgba(14,165,233,0.35)]    dark:[--ab-badge-border:rgba(14,165,233,0.28)]
        [--ab-title:#111827]                         dark:[--ab-title:#f0ece5]
        [--ab-desc:rgba(7,89,133,0.6)]               dark:[--ab-desc:rgba(255,255,255,0.35)]
        [--ab-bar-border:rgba(14,165,233,0.22)]      dark:[--ab-bar-border:rgba(14,165,233,0.18)]
        [--ab-bar-text:#0284c7]                      dark:[--ab-bar-text:#38bdf8]
        [--ab-glow:rgba(14,165,233,0.13)]            dark:[--ab-glow:rgba(14,165,233,0.2)]
    `,
    rose: `
        [--ab-bg:rgba(255,241,242,0.58)]            dark:[--ab-bg:rgba(28,5,10,0.52)]
        [--ab-border:rgba(244,63,94,0.28)]           dark:[--ab-border:rgba(244,63,94,0.22)]
        [--ab-shine:rgba(255,255,255,0.75)]          dark:[--ab-shine:rgba(255,255,255,0.07)]
        [--ab-shadow:rgba(0,0,0,0.05)]               dark:[--ab-shadow:rgba(0,0,0,0.35)]
        [--ab-icon-bg:rgba(244,63,94,0.15)]          dark:[--ab-icon-bg:rgba(244,63,94,0.18)]
        [--ab-icon-ring:rgba(255,255,255,0.55)]      dark:[--ab-icon-ring:rgba(255,255,255,0.07)]
        [--ab-icon-color:#e11d48]                    dark:[--ab-icon-color:#fb7185]
        [--ab-wm-color:rgba(244,63,94,0.06)]         dark:[--ab-wm-color:rgba(244,63,94,0.06)]
        [--ab-badge-text:#be123c]                    dark:[--ab-badge-text:#fb7185]
        [--ab-badge-bg:rgba(244,63,94,0.12)]         dark:[--ab-badge-bg:rgba(244,63,94,0.15)]
        [--ab-badge-border:rgba(244,63,94,0.35)]     dark:[--ab-badge-border:rgba(244,63,94,0.28)]
        [--ab-title:#111827]                         dark:[--ab-title:#f0ece5]
        [--ab-desc:rgba(136,19,55,0.6)]              dark:[--ab-desc:rgba(255,255,255,0.35)]
        [--ab-bar-border:rgba(244,63,94,0.22)]       dark:[--ab-bar-border:rgba(244,63,94,0.18)]
        [--ab-bar-text:#e11d48]                      dark:[--ab-bar-text:#fb7185]
        [--ab-glow:rgba(244,63,94,0.13)]             dark:[--ab-glow:rgba(244,63,94,0.2)]
    `,
    violet: `
        [--ab-bg:rgba(245,243,255,0.58)]            dark:[--ab-bg:rgba(15,8,28,0.52)]
        [--ab-border:rgba(139,92,246,0.28)]          dark:[--ab-border:rgba(139,92,246,0.22)]
        [--ab-shine:rgba(255,255,255,0.75)]          dark:[--ab-shine:rgba(255,255,255,0.07)]
        [--ab-shadow:rgba(0,0,0,0.05)]               dark:[--ab-shadow:rgba(0,0,0,0.35)]
        [--ab-icon-bg:rgba(139,92,246,0.15)]         dark:[--ab-icon-bg:rgba(139,92,246,0.18)]
        [--ab-icon-ring:rgba(255,255,255,0.55)]      dark:[--ab-icon-ring:rgba(255,255,255,0.07)]
        [--ab-icon-color:#7c3aed]                    dark:[--ab-icon-color:#a78bfa]
        [--ab-wm-color:rgba(139,92,246,0.06)]        dark:[--ab-wm-color:rgba(139,92,246,0.06)]
        [--ab-badge-text:#6d28d9]                    dark:[--ab-badge-text:#a78bfa]
        [--ab-badge-bg:rgba(139,92,246,0.12)]        dark:[--ab-badge-bg:rgba(139,92,246,0.15)]
        [--ab-badge-border:rgba(139,92,246,0.35)]    dark:[--ab-badge-border:rgba(139,92,246,0.28)]
        [--ab-title:#111827]                         dark:[--ab-title:#f0ece5]
        [--ab-desc:rgba(76,29,149,0.6)]              dark:[--ab-desc:rgba(255,255,255,0.35)]
        [--ab-bar-border:rgba(139,92,246,0.22)]      dark:[--ab-bar-border:rgba(139,92,246,0.18)]
        [--ab-bar-text:#7c3aed]                      dark:[--ab-bar-text:#a78bfa]
        [--ab-glow:rgba(139,92,246,0.13)]            dark:[--ab-glow:rgba(139,92,246,0.2)]
    `,
    cyan: `
        [--ab-bg:rgba(236,254,255,0.58)]            dark:[--ab-bg:rgba(4,18,22,0.52)]
        [--ab-border:rgba(6,182,212,0.28)]           dark:[--ab-border:rgba(6,182,212,0.22)]
        [--ab-shine:rgba(255,255,255,0.75)]          dark:[--ab-shine:rgba(255,255,255,0.07)]
        [--ab-shadow:rgba(0,0,0,0.05)]               dark:[--ab-shadow:rgba(0,0,0,0.35)]
        [--ab-icon-bg:rgba(6,182,212,0.15)]          dark:[--ab-icon-bg:rgba(6,182,212,0.18)]
        [--ab-icon-ring:rgba(255,255,255,0.55)]      dark:[--ab-icon-ring:rgba(255,255,255,0.07)]
        [--ab-icon-color:#0891b2]                    dark:[--ab-icon-color:#22d3ee]
        [--ab-wm-color:rgba(6,182,212,0.06)]         dark:[--ab-wm-color:rgba(6,182,212,0.06)]
        [--ab-badge-text:#0e7490]                    dark:[--ab-badge-text:#22d3ee]
        [--ab-badge-bg:rgba(6,182,212,0.12)]         dark:[--ab-badge-bg:rgba(6,182,212,0.15)]
        [--ab-badge-border:rgba(6,182,212,0.35)]     dark:[--ab-badge-border:rgba(6,182,212,0.28)]
        [--ab-title:#111827]                         dark:[--ab-title:#f0ece5]
        [--ab-desc:rgba(14,116,144,0.6)]             dark:[--ab-desc:rgba(255,255,255,0.35)]
        [--ab-bar-border:rgba(6,182,212,0.22)]       dark:[--ab-bar-border:rgba(6,182,212,0.18)]
        [--ab-bar-text:#0891b2]                      dark:[--ab-bar-text:#22d3ee]
        [--ab-glow:rgba(6,182,212,0.13)]             dark:[--ab-glow:rgba(6,182,212,0.2)]
    `,
};

// ─── ActionButton ─────────────────────────────────────────
export const ActionButton = memo(({ item, onClick }: {
    item: ActionItemData;
    onClick?: () => void;
}) => {
    return (
        <div
            onClick={onClick}
            className={`
                relative overflow-hidden rounded-3xl p-4
                flex flex-col justify-between min-h-[130px]
                cursor-pointer select-none
                transition-transform duration-200 transform-gpu
                hover:-translate-y-[3px] active:scale-[0.97]
                ${THEME_VARS[item.theme]}
            `}
            style={{
                // Only non-color, structural styles here — never changes on theme toggle
                background:          "var(--ab-bg)",
                backdropFilter:      "blur(20px) saturate(180%)",
                WebkitBackdropFilter:"blur(20px) saturate(180%)",
                border:              "1px solid var(--ab-border)",
                boxShadow:           "inset 0 1px 0 var(--ab-shine), 0 1px 3px var(--ab-shadow)",
            }}
        >
            {/* Glow blob — radial-gradient, no blur filter */}
            <div
                className="pointer-events-none absolute -bottom-6 -left-6 w-32 h-32 rounded-full"
                style={{ background: "radial-gradient(circle, var(--ab-glow) 0%, transparent 70%)" }}
            />

            {/* Watermark icon — color has opacity baked into rgba, no separate opacity needed */}
            {item.bgIcon && (
                <div
                    className="pointer-events-none absolute -bottom-2 -right-2"
                    style={{ color: "var(--ab-wm-color)" }}
                >
                    {item.bgIcon}
                </div>
            )}

            {/* ── Top: icon + badge ── */}
            <div className="relative z-10 flex items-center justify-between">
                <div
                    className="w-11 h-11 rounded-[13px] flex items-center justify-center"
                    style={{
                        background: "var(--ab-icon-bg)",
                        color:      "var(--ab-icon-color)",
                        boxShadow:  "inset 0 0 0 1px var(--ab-icon-ring)",
                    }}
                >
                    {item.icon}
                </div>

                <span
                    className="text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full"
                    style={{
                        color:      "var(--ab-badge-text)",
                        background: "var(--ab-badge-bg)",
                        border:     "1px solid var(--ab-badge-border)",
                    }}
                >
                    {item.badge}
                </span>
            </div>

            {/* ── Bottom: text + action bar ── */}
            <div className="relative z-10 mt-3">
                <h3
                    className="font-extrabold text-sm leading-snug"
                    style={{ color: "var(--ab-title)" }}
                >
                    {item.label}
                </h3>
                <p
                    className="text-[11px] font-medium mt-0.5"
                    style={{ color: "var(--ab-desc)" }}
                >
                    {item.desc}
                </p>

                <div
                    className="flex items-center justify-between mt-3 pt-2.5"
                    style={{
                        borderTop: "1px solid var(--ab-bar-border)",
                        color:     "var(--ab-bar-text)",
                    }}
                >
                    <span className="text-[11px] font-bold tracking-wide">
                        {item.actionLabel}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                </div>
            </div>
        </div>
    );
});

ActionButton.displayName = "ActionButton";
export type { ActionItemData };

