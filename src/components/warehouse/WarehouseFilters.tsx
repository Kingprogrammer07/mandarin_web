import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Plane, Filter, RotateCcw, ChevronDown } from "lucide-react";
import { useWarehouseStore } from "../../store/useWarehouseStore";
import { useWarehouseFlights } from "../../api/hooks/useWarehouse";

const PAYMENT_OPTIONS = [
  { value: "all", label: "Barchasi" },
  { value: "paid", label: "To'langan" },
  { value: "unpaid", label: "To'lanmagan" },
  { value: "partial", label: "Qisman" },
] as const;

const TAKEN_OPTIONS = [
  { value: "all", label: "Barchasi" },
  { value: "taken", label: "Olib ketilgan" },
  { value: "not_taken", label: "Olib ketilmagan" },
] as const;

export default function WarehouseFilters() {
  const {
    flightName,
    searchQuery,
    paymentStatus,
    takenStatus,
    setFlightName,
    setSearchQuery,
    setPaymentStatus,
    setTakenStatus,
    resetFilters,
  } = useWarehouseStore();

  // Local controlled state for the search input so external resets are reflected
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [showFlightDropdown, setShowFlightDropdown] = useState(false);

  const { data: flightsData } = useWarehouseFlights();

  // Sync local input when store resets searchQuery to ""
  useEffect(() => {
    if (searchQuery === "") setLocalSearch("");
  }, [searchQuery]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearchQuery(value);
      }, 400);
    },
    [setSearchQuery],
  );

  const handleSelectFlight = useCallback(
    (name: string) => {
      setFlightName(name);
      setShowFlightDropdown(false);
    },
    [setFlightName],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const recentFlights = flightsData?.items ?? [];

  return (
    <div className="space-y-3">
      {/* Flight name input + recent flights dropdown + client search */}
      <div className="flex flex-col sm:flex-row gap-2.5">

        {/* Flight Name — with recent flights dropdown */}
        <div className="relative flex-1 min-w-0">
          <Plane
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400 z-10"
            strokeWidth={1.8}
          />
          <input
            id="warehouse-flight-input"
            type="text"
            value={flightName}
            onChange={(e) => setFlightName(e.target.value.toUpperCase())}
            onFocus={() => recentFlights.length > 0 && setShowFlightDropdown(true)}
            placeholder="Reys nomini kiriting (masalan: CH123)"
            className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] font-bold text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
          />
          {recentFlights.length > 0 && (
            <button
              type="button"
              onClick={() => setShowFlightDropdown((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors"
              tabIndex={-1}
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showFlightDropdown ? "rotate-180" : ""}`}
              />
            </button>
          )}

          {/* Recent flights dropdown */}
          {showFlightDropdown && recentFlights.length > 0 && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowFlightDropdown(false)}
              />
              <div className="absolute top-full left-0 right-0 mt-1.5 z-20 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/[0.1] rounded-xl shadow-lg overflow-hidden">
                <div className="px-3 py-1.5 border-b border-gray-100 dark:border-white/[0.06]">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    So'nggi reyslar
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {recentFlights.map((flight) => (
                    <button
                      key={flight.flight_name}
                      type="button"
                      onClick={() => handleSelectFlight(flight.flight_name)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-orange-50 dark:hover:bg-orange-500/[0.08] transition-colors ${
                        flightName === flight.flight_name
                          ? "bg-orange-50 dark:bg-orange-500/[0.06]"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          flightName === flight.flight_name
                            ? "bg-orange-100 dark:bg-orange-500/15"
                            : "bg-gray-100 dark:bg-white/[0.06]"
                        }`}>
                          <Plane className={`w-3.5 h-3.5 ${
                            flightName === flight.flight_name
                              ? "text-orange-500"
                              : "text-gray-400 dark:text-gray-500"
                          }`} strokeWidth={1.8} />
                        </div>
                        <span className={`text-[13px] font-bold ${
                          flightName === flight.flight_name
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-gray-800 dark:text-white"
                        }`}>
                          {flight.flight_name}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                        {flight.tx_count} yuk · {flight.user_count} mijoz
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Client code search within flight */}
        <div className="relative flex-1 min-w-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            strokeWidth={1.8}
          />
          <input
            id="warehouse-client-search"
            type="text"
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Mijoz kodi bo'yicha qidirish"
            className="w-full pl-9 pr-3.5 py-2.5 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
          />
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
          <Filter className="w-3.5 h-3.5" strokeWidth={1.8} />
          <span className="text-[11px] font-bold uppercase tracking-wider">
            Filtrlar
          </span>
        </div>

        {/* Payment status */}
        <select
          id="warehouse-payment-filter"
          value={paymentStatus}
          onChange={(e) =>
            setPaymentStatus(
              e.target.value as "all" | "paid" | "unpaid" | "partial",
            )
          }
          className="px-3 py-1.5 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-[12px] font-semibold text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all cursor-pointer"
        >
          {PAYMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="dark:bg-[#1a1a1a]">
              {opt.label}
            </option>
          ))}
        </select>

        {/* Taken status */}
        <select
          id="warehouse-taken-filter"
          value={takenStatus}
          onChange={(e) =>
            setTakenStatus(e.target.value as "all" | "taken" | "not_taken")
          }
          className="px-3 py-1.5 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-[12px] font-semibold text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all cursor-pointer"
        >
          {TAKEN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="dark:bg-[#1a1a1a]">
              {opt.label}
            </option>
          ))}
        </select>

        {/* Reset filters */}
        <button
          onClick={resetFilters}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-gray-500 dark:text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/[0.08] rounded-lg transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Tozalash
        </button>
      </div>
    </div>
  );
}
