import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, History, Loader2, Search, X } from "lucide-react";
import { trackCargo } from "@/api/services/cargo";
import { TrackResultCard } from "./components/TrackResultCard";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from 'react-i18next';

const HISTORY_KEY = "track_code_history_v2"; // Changed key to avoid conflict with old string-only history

interface HistoryItem {
    code: string;
    flightName?: string;
    date: number;
}

interface TrackCodeTabProps {
    autoFocus?: boolean;
    onFocusConsumed?: () => void;
    /**
     * Track code to look up on mount, handed over by the home screen's search
     * bar. Without it the home search could only open this screen, leaving the
     * client to retype the code they had already entered.
     */
    initialCode?: string;
}

export default function TrackCodeTab({ autoFocus=false, onFocusConsumed, initialCode }: TrackCodeTabProps) {
    const { t } = useTranslation();
    // Seeded from the initial state rather than an effect: the query below is
    // enabled by `activeSearch`, so setting it after mount would render one
    // empty frame before the request starts.
    const seeded = initialCode?.trim().toUpperCase() ?? "";
    const [query, setQuery] = useState(seeded);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [activeSearch, setActiveSearch] = useState<string | null>(
        seeded.length >= 3 ? seeded : null,
    );
    const inputRef = useRef<HTMLInputElement>(null);
    // Load history
    useEffect(() => {
        const saved = localStorage.getItem(HISTORY_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved) as HistoryItem[];
                queueMicrotask(() => setHistory(parsed));
            } catch (e) {
                console.error("Failed to parse history", e);
            }
        }
    }, []);

    // autoFocus effect
    useEffect(() => {
        if (autoFocus && inputRef.current) {
            // Kichik delay - tab animation tugashini kutamiz
            const timer = setTimeout(() => {
                inputRef.current?.focus();
                onFocusConsumed?.();
            }, 350);
            return () => clearTimeout(timer);
        }
    }, [autoFocus, onFocusConsumed]);

    const addToHistory = (code: string, flightName?: string) => {
        const cleanCode = code.trim().toUpperCase();
        if (!cleanCode) return;

        setHistory(prev => {
            // Remove existing entry for this code
            const filtered = prev.filter(h => h.code !== cleanCode);
            // Add new entry to top
            const newItem: HistoryItem = {
                code: cleanCode,
                flightName: flightName || prev.find(h => h.code === cleanCode)?.flightName, // Preserve existing flight name if not provided
                date: Date.now()
            };
            const newHistory = [newItem, ...filtered].slice(0, 10);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
            return newHistory;
        });
    };

    const removeFromHistory = (e: React.MouseEvent, code: string) => {
        e.stopPropagation();
        setHistory(prev => {
            const newHistory = prev.filter(h => h.code !== code);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
            return newHistory;
        });
    }

    // API Query
    const { data, isLoading, error, isSuccess } = useQuery({
        queryKey: ["trackCargo", activeSearch],
        queryFn: () => trackCargo(activeSearch!),
        enabled: !!activeSearch && activeSearch.length >= 3,
        retry: false,
    });

    // Update history with flight name when data is found
    useEffect(() => {
        if (data && data.found) {
            // Find flight name from items
            const flightName = data.items?.[0]?.flight_name;
            if (activeSearch) {
                queueMicrotask(() => addToHistory(activeSearch, flightName || undefined));
            }
        }
    }, [data, activeSearch]);

    const handleSearch = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!query || query.length < 3) {
            toast.error(t('tracking.validation'));
            return;
        }
        const clean = query.trim().toUpperCase();
        setActiveSearch(clean);
        addToHistory(clean); // Add immediately, will update with flight name later
    };

    const handleChipClick = (item: HistoryItem) => {
        setQuery(item.code);
        setActiveSearch(item.code);
        addToHistory(item.code, item.flightName);
    };

    return (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-5">

            {/* Title. The cargo history used to hang off a toggle here; it now
                lives in "Mening yuklarim", joined with the billing rather than
                standing beside it as a second list under a different flight
                name for the same parcel. */}
            <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-extrabold text-mc-text">
                <span className="inline-block h-4 w-1 shrink-0 rounded-full bg-mc-brand" />
                <span className="truncate">{t('tracking.title')}</span>
            </h2>

            {/* Search Input */}
<form onSubmit={handleSearch} className="space-y-2">
    {/* Input — 18px is above the 16px floor, so focusing it does not make iOS
        Safari zoom the page. */}
    <div className="relative">
        <input
            type="text"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder={t('tracking.placeholder')}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="
                w-full rounded-mc-md border border-mc-border bg-mc-surface py-3 pl-11 pr-3
                font-mono text-[18px] font-extrabold text-mc-text
                placeholder:font-sans placeholder:text-[13px] placeholder:font-medium placeholder:text-mc-text-3
                focus:border-mc-brand focus:outline-none focus:ring-2 focus:ring-mc-brand/25
                transition-colors duration-200
            "
        />
        <Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-mc-text-3" strokeWidth={2} />
    </div>

    {/* Search Button */}
    <button
        type="submit"
        disabled={isLoading}
        className="
            flex h-12 w-full items-center justify-center gap-2 rounded-mc-md
            bg-gradient-to-r from-mc-brand to-mc-brand-strong
            text-[14px] font-extrabold text-mc-on-brand
            shadow-[var(--mc-shadow-cta)] active:scale-[0.98]
            transition-transform duration-200 disabled:cursor-not-allowed disabled:opacity-60
        "
    >
        {isLoading ? (
            <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('tracking.searching')}</span>
            </>
        ) : (
            <>
                <Search className="h-4 w-4" strokeWidth={2} />
                <span>{t('tracking.search', 'Qidirish')}</span>
            </>
        )}
    </button>
</form>

                    {/* History Chips */}
                    {history.length > 0 && !data && (
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.09em] text-mc-text-3">
                                <History className="h-3.5 w-3.5" strokeWidth={2} />
                                <span>{t('tracking.recentSearches')}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {history.map(item => (
                                    <button
                                        key={item.code}
                                        onClick={() => handleChipClick(item)}
                                        className="
                   flex items-center gap-1.5 rounded-full border border-mc-border
                   bg-mc-surface-2 px-2.5 py-1 font-mono text-[12px] font-bold text-mc-text
                   transition-transform active:scale-95
                 "
                                    >
                                        <span className="font-bold">{item.code}</span>
                                        {item.flightName && (
                                            <span className="rounded-full bg-mc-brand-soft px-1.5 py-0.5 font-sans text-[10px] font-bold text-mc-brand">
                                                {item.flightName}
                                            </span>
                                        )}
                                        <X
                                            onClick={(e) => removeFromHistory(e, item.code)}
                                            className="h-3.5 w-3.5 shrink-0 text-mc-text-3 transition-colors active:text-mc-danger"
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Results Region */}
                    <div className="min-h-[200px]">
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center py-10">
                                <Loader2 className="mb-2 h-8 w-8 animate-spin text-mc-brand" />
                                <p className="text-[12px] font-medium text-mc-text-2">{t('tracking.searching')}</p>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-2.5 rounded-mc-lg border border-mc-danger/25 bg-mc-danger-soft p-3.5 text-mc-danger">
                                <AlertCircle className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                                <p className="text-[12px] font-medium">{t('tracking.error')}</p>
                            </div>
                        )}

                        {isSuccess && data && (
                            <AnimatePresence mode="wait">
                                {data.found ? (
                                    <motion.div
                                        key="result"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                    >
                                        <TrackResultCard data={data} />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="not-found"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-center justify-center py-10 text-center"
                                    >
                                        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-mc-surface-2">
                                            <Search className="h-7 w-7 text-mc-text-3" strokeWidth={1.8} />
                                        </div>
                                        <h3 className="text-[15px] font-extrabold text-mc-text">{t('tracking.notFoundTitle')}</h3>
                                        <p className="mx-auto mt-1 max-w-xs text-[12px] font-medium leading-snug text-mc-text-2">
                                            {t('tracking.notFoundDesc', { code: activeSearch })}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        )}
                    </div>

        </div>
    );
}
