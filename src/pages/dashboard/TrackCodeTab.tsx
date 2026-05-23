import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, History, History as HistoryIcon, Loader2, Search, X } from "lucide-react";
import { trackCargo } from "@/api/services/cargo";
import { TrackResultCard } from "./components/TrackResultCard";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import ClientCargoHistory from "../../components/history/ClientCargoHistory";
import { useTranslation } from 'react-i18next';

const HISTORY_KEY = "track_code_history_v2"; // Changed key to avoid conflict with old string-only history

interface HistoryItem {
    code: string;
    flightName?: string;
    date: number;
}

interface TrackCodeTabProps {
    initialView?: 'search' | 'history';
    autoFocus?: boolean;
    onFocusConsumed?: () => void;
}

export default function TrackCodeTab({ initialView = 'search', autoFocus=false, onFocusConsumed }: TrackCodeTabProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [activeSearch, setActiveSearch] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(initialView === 'history');
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
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">

            {/* Title & History Toggle */}
            <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="flex min-w-0 items-center gap-2 text-xl font-black tracking-normal text-slate-950 dark:text-white">
                    <span className="inline-block h-6 w-1 rounded-full bg-orange-500" />
                    {showHistory ? t('tracking.historyTitle') : t('tracking.title')}
                </h2>

                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="
                        flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold
                        border-slate-200 bg-white text-slate-700 shadow-sm
                        active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200
                    "
                >
                    {showHistory ? (
                        <>
                            <ArrowLeft className="w-4 h-4" />
                            <span>{t('tracking.back')}</span>
                        </>
                    ) : (
                        <>
                            <HistoryIcon className="w-4 h-4" />
                            <span>{t('tracking.myCargo')}</span>
                        </>
                    )}
                </button>
            </div>

            {showHistory ? (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <ClientCargoHistory />
                </div>
            ) : (
                <>

                    {/* Search Input */}
{/* Search Input */}
<form onSubmit={handleSearch} className="space-y-3">
    {/* Input */}
    <div className="relative">
        <input
            type="text"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder={t('tracking.placeholder')}
            className="
                w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4
                font-mono text-lg font-black tracking-normal text-slate-950 shadow-sm
                placeholder:font-sans placeholder:text-sm placeholder:font-medium placeholder:text-slate-400
                focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15
                dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:placeholder:text-slate-500
                transition-all duration-200
            "
        />
        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
    </div>

    {/* Search Button */}
    <button
        type="submit"
        disabled={isLoading}
        className="
            flex w-full items-center justify-center gap-2.5 rounded-2xl
            bg-gradient-to-r from-orange-500 to-amber-500 py-3.5
            text-sm font-black tracking-normal text-white
            shadow-lg shadow-orange-500/20 active:scale-[0.98]
            transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60
        "
    >
        {isLoading ? (
            <>
                <Loader2 className="size-4 animate-spin" />
                <span>{t('tracking.searching')}</span>
            </>
        ) : (
            <>
                <Search className="w-4 h-4" />
                <span>{t('tracking.search', 'Qidirish')}</span>
            </>
        )}
    </button>
</form>

                    {/* History Chips */}
                    {history.length > 0 && !data && (
                        <div className="space-y-2">
                            <div className="ml-1 flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                                <History className="w-4 h-4" />
                                <span>{t('tracking.recentSearches')}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {history.map(item => (
                                    <button
                                        key={item.code}
                                        onClick={() => handleChipClick(item)}
                                        className="
                   group flex items-center gap-2 rounded-full border border-slate-200
                   bg-white px-3 py-1.5 text-sm font-mono font-bold text-slate-700 shadow-sm
                   transition-all active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300
                 "
                                    >
                                        <span className="font-bold">{item.code}</span>
                                        {item.flightName && (
                                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/10 dark:text-slate-400">
                                                {item.flightName}
                                            </span>
                                        )}
                                        <X
                                            onClick={(e) => removeFromHistory(e, item.code)}
                                            className="size-3 text-slate-400 opacity-100 transition-colors active:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Results Region */}
                    <div className="min-h-[200px]">
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center py-10 opacity-70">
                                <Loader2 className="mb-2 size-10 animate-spin text-orange-500" />
                                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('tracking.searching')}</p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400">
                                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                                <p className="text-sm font-medium">{t('tracking.error')}</p>
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
                                        <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                            <Search className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('tracking.notFoundTitle')}</h3>
                                        <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                                            {t('tracking.notFoundDesc', { code: activeSearch })}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        )}
                    </div>
                </>
            )}

        </div>
    );
}
