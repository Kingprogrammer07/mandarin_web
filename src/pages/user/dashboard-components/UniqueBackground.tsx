export const UniqueBackground = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 hidden dark:block">
    <div className="absolute inset-0 bg-[#06080d]" />
    <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(255,138,31,0.22),rgba(249,115,22,0.08)_38%,transparent_72%)]" />
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-200/60 to-transparent" />
    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent_28%),radial-gradient(ellipse_at_bottom,rgba(15,23,42,0.82),transparent_54%)] opacity-85" />
    <div className="absolute inset-x-8 top-20 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
  </div>
);
