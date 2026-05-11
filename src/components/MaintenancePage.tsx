import { useEffect, useState } from "react";
import { Loader2, ServerCrash } from "lucide-react";

export default function MaintenancePage() {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const id = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#f8fafc] dark:bg-[#06080d] px-6">
      {/* Decorative gradient — matches app brand */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,rgba(255,138,31,0.18),rgba(249,115,22,0.07)_38%,transparent_72%)]" />

      <div className="relative flex flex-col items-center text-center max-w-xs">
        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mb-6 shadow-lg shadow-orange-500/10">
          <ServerCrash
            className="w-10 h-10 text-orange-500 dark:text-orange-400"
            strokeWidth={1.5}
          />
        </div>

        {/* Title */}
        <h1 className="text-[20px] font-black text-gray-900 dark:text-white mb-2 leading-tight">
          Texnik ishlar ketmoqda
        </h1>

        {/* Subtitle */}
        <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed mb-8">
          Server yangilanmoqda. Tez orada qaytamiz.
        </p>

        {/* Reconnecting indicator */}
        <div className="flex items-center gap-2 text-[13px] font-semibold text-orange-500 dark:text-orange-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Ulanish tekshirilmoqda{dots}</span>
        </div>

        {/* Mandarin brand */}
        <p className="mt-10 text-[11px] font-bold text-gray-300 dark:text-gray-600 tracking-wider uppercase">
          Mandarin Cargo
        </p>
      </div>
    </div>
  );
}
