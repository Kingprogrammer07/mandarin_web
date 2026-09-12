import { useState } from "react";
import { Search, User, Phone, Wallet, History, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useGroupedWarehouseSearch } from "@/api/hooks/useWarehouse";
import type { RecentDeliveryClient } from "@/lib/adminDeliveryRecentClients";

interface ClientLookupPanelProps {
  onSelectClient: (client: RecentDeliveryClient) => void;
  selectedClientCode: string | null;
  recentClients?: RecentDeliveryClient[];
  onClearHistory?: () => void;
}

/**
 * Finds the client to file for. Nothing about their flights is taken from here:
 * the search returns at most 20 ledger rows across every client whose code
 * matches, so flight and cargo counts built from it were often short. The
 * flights step reads the client's complete, current state instead.
 */
export default function ClientLookupPanel({
  onSelectClient,
  selectedClientCode,
  recentClients = [],
  onClearHistory,
}: ClientLookupPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading } = useGroupedWarehouseSearch(
    {
      code: searchTerm.trim().toUpperCase() || undefined,
      // "all", not "not_taken". The old value filtered server-side BEFORE
      // grouping, so a client whose cargo had all been collected came back with
      // no flights at all — the manager saw "nothing here" and only learned the
      // truth from a rejected submission. The collected flights are now
      // returned and labelled, which is the state the manager was asking about.
      //
      // Note for anyone extending this call: warehouse_router ignores
      // payment_status whenever taken_status !== "all". Switching to "all"
      // re-activates that branch, so do not add a payment filter here without
      // reading those lines first.
      taken_status: "all",
      page: 1,
      size: 20,
    },
    searchTerm.trim().length > 0,
  );

  const handleSearch = () => {
    setSearchTerm(query.trim().toUpperCase());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const clients = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder={t("adminDeliveryRequest.clientSearch.placeholder", "Mijoz kodini kiriting (masalan: M123)")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-12 min-w-0 rounded-xl text-base uppercase"
        />
        <Button
          onClick={handleSearch}
          disabled={isLoading || query.trim().length === 0}
          className="h-12 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white shrink-0"
        >
          <Search className="w-4 h-4 sm:mr-2" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">
            {t("adminDeliveryRequest.clientSearch.button", "Qidirish")}
          </span>
        </Button>
      </div>

      {/* Recent clients */}
      {recentClients.length > 0 && !searchTerm && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <History className="w-3.5 h-3.5" aria-hidden="true" />
              {t("adminDeliveryRequest.clientSearch.recent", "Oxirgi qidiruvlar")}
            </div>
            {onClearHistory && (
              <button
                type="button"
                onClick={onClearHistory}
                aria-label={t("adminDeliveryRequest.clientSearch.clearRecent", "Oxirgi qidiruvlarni tozalash")}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {recentClients.map((client) => (
              <button
                key={client.client_code}
                type="button"
                onClick={() => onSelectClient(client)}
                className={`inline-flex min-h-11 max-w-full items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  selectedClientCode === client.client_code
                    ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400"
                    : "border-gray-200 bg-white text-gray-700 hover:border-orange-200 hover:bg-orange-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:border-orange-500/30"
                }`}
              >
                <User className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words text-left">{client.full_name || client.client_code}</span>
                <span className="shrink-0 text-gray-400 font-mono">{client.client_code}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 text-center text-gray-400"
          >
            {t("adminDeliveryRequest.clientSearch.loading", "Qidirilmoqda...")}
          </motion.div>
        )}

        {!isLoading && searchTerm && clients.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-6 text-center text-gray-400 rounded-2xl border border-dashed border-gray-200 dark:border-white/10"
          >
            {t("adminDeliveryRequest.clientSearch.noResults", "Mijoz topilmadi")}
          </motion.div>
        )}

        {!isLoading && clients.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {clients.map((client) => {
              const isSelected = selectedClientCode === client.client_code;

              return (
                <button
                  key={client.client_code}
                  type="button"
                  onClick={() =>
                    onSelectClient({
                      client_code: client.client_code,
                      full_name: client.full_name,
                    })
                  }
                  className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 ${
                    isSelected
                      ? "border-orange-400 bg-orange-50/60 dark:bg-orange-500/10 ring-1 ring-orange-400"
                      : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] hover:border-orange-200 dark:hover:border-orange-500/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-orange-100 text-orange-600"
                          : "bg-gray-100 dark:bg-white/[0.06] text-gray-500"
                      }`}
                    >
                      <User className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm break-words">
                        {client.full_name || client.client_code}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                        {client.client_code}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    {client.phone && (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                        {client.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
                      {client.wallet_balance.toLocaleString()} so&apos;m
                    </span>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
