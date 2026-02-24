import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useClientSearch } from '@/hooks/useClientSearch';
import type { ClientSearchResult } from '@/api/verification';
import { cn } from '@/lib/utils';
import { Search, Loader2, User, Phone, AlertCircle, ArrowRight, Clock, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getRecentSearches, addRecentSearch, clearRecentSearches, type RecentSearchItem } from '@/lib/recentSearches';

interface ClientSearchPageProps {
  onSelectClient: (clientId: number, clientCode: string) => void;
}

// Helper for relative time
function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Hozirgina';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} daqiqa oldin`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    if (hours === 0) return `${minutes} daqiqa oldin`;
    return `${hours} soat oldin`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Kecha';
  if (days < 7) return `${days} kun oldin`;

  return date.toLocaleDateString('ru-RU'); // Fallback to date
}

export default function ClientSearchPage({ onSelectClient }: ClientSearchPageProps) {
  const [query, setQuery] = useState('');
  const { results, isLoading, error, search } = useClientSearch();
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);

  // Load recent searches on mount
  useEffect(() => {
    queueMicrotask(() => setRecentSearches(getRecentSearches()));
  }, []);

  // Sort: Newest first (Primary constraint)
  // Logic: 
  // 1. If query is empty -> Show all recent history (max 10)
  // 2. If query exists -> Filter recent history by match -> Show matches -> API results below
  const filteredRecent = useMemo(() => {
    const sorted = [...recentSearches].sort((a, b) =>
      new Date(b.searched_at).getTime() - new Date(a.searched_at).getTime()
    );

    if (!query.trim()) {
      return sorted.slice(0, 10);
    }

    const lowerQuery = query.toLowerCase().trim();
    return sorted.filter(item =>
      item.client_code.toLowerCase().includes(lowerQuery) ||
      item.full_name.toLowerCase().includes(lowerQuery) ||
      (item.phone && item.phone.includes(lowerQuery))
    );
  }, [recentSearches, query]);

  const handleSearch = () => {
    if (query.trim()) {
      search(query.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectClient = (client: ClientSearchResult) => {
    // Save to recent searches
    addRecentSearch({
      id: client.id,
      client_code: client.client_code,
      full_name: client.full_name,
      phone: client.phone,
    });
    // Immediately update local state to reflect change (optional but good for syncing)
    setRecentSearches(getRecentSearches());

    onSelectClient(client.id, client.client_code);
  };

  const handleSelectRecent = (recent: RecentSearchItem) => {
    // Move to top of recent searches
    addRecentSearch({
      id: recent.id,
      client_code: recent.client_code,
      full_name: recent.full_name,
      phone: recent.phone,
    });
    setRecentSearches(getRecentSearches());
    onSelectClient(recent.id, recent.client_code);
  };

  const handleClearHistory = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  // Condition to show "Recent Section" header
  // Show if:
  // 1. Query is empty AND we have history
  // 2. Query matches something in history
  const showRecentSection = filteredRecent.length > 0;

  return (
    <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-4 py-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center md:text-left"
      >
        <h1 className="text-xl md:text-2xl font-semibold text-gray-900 mb-1">Mijozni qidirish</h1>
        <p className="text-sm text-muted-foreground">
          Mijoz kodini yoki telefon raqamini kiriting
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4 md:space-y-6"
      >
        {/* Search Input - Mobile: Stacked, Desktop: Row */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Mijoz kodi yoki telefon..."
              className="pl-10 h-12 text-base w-full bg-gray-50 border-gray-200 focus:bg-white transition-colors"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={isLoading || !query.trim()}
            className="h-12 w-full md:w-auto md:px-8 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-base font-medium shadow-sm transition-all active:scale-95"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Search className="h-5 w-5 md:mr-2" />
                <span className="md:inline">Qidirish</span>
              </>
            )}
          </Button>
        </div>

        {/* Error or Info Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {error === 'Mijoz topilmadi' ? (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700 font-medium">{error}</p>
                </div>
              ) : (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-medium">{typeof error === 'string' ? error : 'Xatolik yuz berdi'}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Searches Section */}
        <AnimatePresence mode="wait">
          {showRecentSection && (
            <motion.div
              key="recent-section"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn("space-y-3", query.trim() && "pb-2 border-b border-gray-100")}
            >
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-gray-700">
                    {query.trim() ? "Tarixdan topilganlar" : "So'nggi qidiruvlar"}
                  </p>
                </div>
                {!query.trim() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearHistory}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Tozalash
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredRecent.map((recent) => (
                  <motion.button
                    key={recent.id}
                    layout // Animate layout changes for smooth reordering
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => handleSelectRecent(recent)}
                    className={cn(
                      'w-full p-3 bg-gray-50 rounded-xl border border-transparent',
                      'hover:bg-white hover:border-gray-200 hover:shadow-sm',
                      'active:scale-[0.98] transition-all',
                      'flex items-center justify-between text-left group'
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center flex-shrink-0 text-orange-600 font-bold text-sm group-hover:bg-orange-50 group-hover:border-orange-100 transition-colors">
                        <User className="h-6 w-6 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline pr-2">
                          <p className="font-semibold text-sm text-gray-900 truncate">{recent.full_name}</p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                            {timeAgo(recent.searched_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-100 group-hover:border-orange-100 transition-colors">
                            {recent.client_code}
                          </span>
                          {recent.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {recent.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Search Results (API) */}
        {results.length > 0 && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="pt-2 space-y-3"
          >
            <div className="px-1 flex items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Qidiruv natijalari
              </p>
              <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {results.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {results.map((client) => (
                <motion.button
                  key={client.id}
                  variants={itemVariants}
                  onClick={() => handleSelectClient(client)}
                  className={cn(
                    'w-full p-4 bg-white rounded-xl border border-gray-200',
                    'hover:border-orange-300 hover:shadow-md',
                    'active:scale-[0.98] transition-all',
                    'flex items-center justify-between text-left group'
                  )}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <User className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base text-gray-900 truncate group-hover:text-orange-700 transition-colors">{client.full_name}</p>
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 font-mono group-hover:bg-orange-50 transition-colors">
                            {client.client_code}
                          </span>
                          {client.phone && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {client.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-300 flex-shrink-0 ml-2 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

      </motion.div>
    </div>
  );
}
