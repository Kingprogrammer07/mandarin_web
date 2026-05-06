import { useState } from "react";
import { Search, User, Phone, Wallet, Package, History, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGroupedWarehouseSearch } from "@/api/hooks/useWarehouse";
import type { ClientGroup } from "@/api/services/warehouse";

interface ClientLookupPanelProps {
  onSelectClient: (client: ClientGroup) => void;
  selectedClient: ClientGroup | null;
  recentClients?: ClientGroup[];
  onClearHistory?: () => void;
}

export default function ClientLookupPanel({
  onSelectClient,
  selectedClient,
  recentClients = [],
  onClearHistory,
}: ClientLookupPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading } = useGroupedWarehouseSearch(
    {
      code: searchTerm.trim().toUpperCase() || undefined,
      payment_status: "paid",
      taken_status: "not_taken",
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
          className="h-12 rounded-xl text-base uppercase"
        />
        <Button
          onClick={handleSearch}
          disabled={isLoading || query.trim().length === 0}
          className="h-12 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white shrink-0"
        >
          <Search className="w-4 h-4 mr-2" />
          {t("adminDeliveryRequest.clientSearch.button", "Qidirish")}
        </Button>
      </div>

      {/* Recent clients */}
      {recentClients.length > 0 && !searchTerm && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <History className="w-3.5 h-3.5" />
              {t("adminDeliveryRequest.clientSearch.recent", "Oxirgi qidiruvlar")}
            </div>
            {onClearHistory && (
              <button
                onClick={onClearHistory}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {recentClients.map((client) => (
              <button
                key={client.client_code}
                onClick={() => onSelectClient(client)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  selectedClient?.client_code === client.client_code
                    ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400"
                    : "border-gray-200 bg-white text-gray-700 hover:border-orange-200 hover:bg-orange-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:border-orange-500/30"
                }`}
              >
                <User className="w-3 h-3" />
                <span>{client.full_name || client.client_code}</span>
                <span className="text-gray-400 font-mono">{client.client_code}</span>
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
              const isSelected = selectedClient?.client_code === client.client_code;
              const totalFlights = client.flights.length;
              const totalCargo = client.flights.reduce(
                (sum, f) => sum + f.transactions.length,
                0,
              );

              return (
                <button
                  key={client.client_code}
                  onClick={() => onSelectClient(client)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 ${
                    isSelected
                      ? "border-orange-400 bg-orange-50/60 dark:bg-orange-500/10 ring-1 ring-orange-400"
                      : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] hover:border-orange-200 dark:hover:border-orange-500/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-orange-100 text-orange-600"
                            : "bg-gray-100 dark:bg-white/[0.06] text-gray-500"
                        }`}
                      >
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">
                          {client.full_name || client.client_code}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                          {client.client_code}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`rounded-lg text-xs ${
                        isSelected
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {totalFlights} {t("adminDeliveryRequest.flights.flightLabel", "reys")}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    {client.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {client.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5" />
                      {client.wallet_balance.toLocaleString()} so&apos;m
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      {totalCargo} {t("adminDeliveryRequest.cargoPreview.cargoLabel", "yuk")}
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
