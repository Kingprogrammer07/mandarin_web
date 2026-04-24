import { useState } from "react";
import {
  Package,
  CheckCheck,
  ChevronDown,
  Plane,
  Wallet,
  AlertCircle,
  Truck,
  CheckSquare,
  BellRing,
  X
} from "lucide-react";
import type { ClientGroup } from "../../api/services/warehouse";
import { formatCurrencySum } from "../../lib/format";

// ── Status Styling ────────────────────────────────────────────────────────────

const PAYMENT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  paid: { bg: "bg-green-500/10 dark:bg-green-500/20", text: "text-green-600 dark:text-green-400", label: "To'landi" },
  partial: { bg: "bg-amber-500/10 dark:bg-amber-500/20", text: "text-amber-600 dark:text-amber-400", label: "Qisman" },
  pending: { bg: "bg-red-500/10 dark:bg-red-500/20", text: "text-red-500 dark:text-red-400", label: "Qarzdor" },
  unpaid: { bg: "bg-red-500/10 dark:bg-red-500/20", text: "text-red-500 dark:text-red-400", label: "To'lanmagan" },
};

function getPaymentStyle(status: string) {
  return PAYMENT_STYLES[status] ?? { bg: "bg-gray-500/10 dark:bg-white/[0.08]", text: "text-gray-600 dark:text-gray-300", label: status };
}

interface GroupedTransactionsListProps {
  items: ClientGroup[];
  isLoading: boolean;
  onMarkTaken: (transactionIds: number[], clientCode: string, flightName: string, isTakenAway: boolean) => void;
  canMarkTaken: boolean;
  onNotifyCashier?: (clientCode: string, flightName: string, amount: number) => void;
}

export default function GroupedTransactionsList({
  items,
  isLoading,
  onMarkTaken,
  canMarkTaken,
  onNotifyCashier,
}: GroupedTransactionsListProps) {
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [expandedFlights, setExpandedFlights] = useState<Record<string, boolean>>({});
  const [deselectedFlights, setDeselectedFlights] = useState<Record<string, boolean>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const toggleClient = (clientCode: string) => {
    setExpandedClients(prev => ({ ...prev, [clientCode]: prev[clientCode] !== undefined ? !prev[clientCode] : false }));
  };

  const toggleFlight = (flightKey: string) => {
    setExpandedFlights(prev => ({ ...prev, [flightKey]: prev[flightKey] !== undefined ? !prev[flightKey] : false }));
  };

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-white/50 dark:bg-white/[0.02] rounded-3xl animate-pulse border border-white/20 dark:border-white/[0.05]" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-20 text-center animate-in fade-in zoom-in duration-300">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 bg-gray-200 dark:bg-white/[0.05] rounded-full animate-ping opacity-20" />
          <div className="relative w-full h-full bg-white dark:bg-white/[0.05] border border-gray-100 dark:border-white/[0.1] rounded-2xl flex items-center justify-center shadow-xl shadow-gray-200/50 dark:shadow-none backdrop-blur-xl">
            <Package className="w-8 h-8 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
          </div>
        </div>
        <p className="text-[15px] font-bold text-gray-700 dark:text-gray-300">Mijozlar topilmadi</p>
        <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1">Filtrlarni o'zgartirib ko'ring</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {items.map((client) => {
        const isClientExpanded = expandedClients[client.client_code] ?? true;

        // Barcha reyslardagi "topshirilmagan" yuklari bor reyslarni ajratamiz
        const pendingFlights = client.flights.filter(f => f.transactions.some(tx => !tx.has_proof));
        
        // Ulardan faqat CHECKED bo'lganlarini (deselectedFlights da yo'qlarini) olamiz
        const selectedPendingFlights = pendingFlights.filter(f => {
          const key = `${client.client_code}-${f.flight_name}`;
          return !deselectedFlights[key];
        });

        const allPendingTxIds = selectedPendingFlights.flatMap(f => 
          f.transactions.filter(tx => !tx.has_proof).map(tx => tx.id)
        );
        
        const canBulkMarkClient = canMarkTaken && allPendingTxIds.length > 0;
        const isAnyTakenAwayClient = selectedPendingFlights.some(f => 
          f.transactions.some(tx => tx.is_taken_away && !tx.has_proof)
        );

        let flightNamesStr = "Tanlanmagan";
        if (selectedPendingFlights.length > 0) {
          if (selectedPendingFlights.length === pendingFlights.length) {
            flightNamesStr = "Barcha reyslar";
          } else {
            flightNamesStr = selectedPendingFlights.map(f => f.flight_name).join(", ");
          }
        }

        return (
          <div 
            key={client.client_code} 
            className="relative bg-white/70 dark:bg-[#111]/70 backdrop-blur-2xl rounded-3xl border border-white/50 dark:border-white/[0.08] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none group animate-in fade-in slide-in-from-bottom-4 duration-300"
          >
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            {/* Client Header */}
            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 hover:bg-white/40 dark:hover:bg-white/[0.02] transition-colors z-10 gap-4 sm:gap-0">
              {/* Left Info */}
              <div 
                onClick={() => toggleClient(client.client_code)}
                className="flex-1 flex flex-col gap-1.5 cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[18px] font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 font-mono leading-none tracking-tight">
                    {client.client_code}
                  </span>
                  {client.full_name && (
                    <span className="px-2.5 py-0.5 rounded-full bg-gray-100/80 dark:bg-white/[0.08] border border-gray-200/50 dark:border-white/[0.05] text-[12px] text-gray-600 dark:text-gray-300 font-medium backdrop-blur-sm">
                      {client.full_name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-[13px] mt-1">
                  <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                      <Wallet className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrencySum(client.wallet_balance)}</span>
                  </span>
                  {client.debt > 0 && (
                    <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                      <div className="w-5 h-5 rounded-md bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      </div>
                      <span className="font-semibold">{formatCurrencySum(client.debt)}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block mr-2">
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-wider mb-0.5">Jami to'lanmagan</p>
                  <p className="text-[15px] font-black text-gray-800 dark:text-gray-200 tracking-tight">{formatCurrencySum(client.total_unpaid_amount)}</p>
                </div>

                {canBulkMarkClient && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkTaken(allPendingTxIds, client.client_code, flightNamesStr, isAnyTakenAwayClient);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-[13px] font-bold shadow-[0_4px_15px_rgba(249,115,22,0.3)] active:scale-95 transition-all"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span className="text-xs">
                      {selectedPendingFlights.length === pendingFlights.length 
                        ? "Barcha yuklarni berish" 
                        : "Tanlanganlarni berish"
                      } ({allPendingTxIds.length})
                    </span>
                  </button>
                )}
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleClient(client.client_code);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.08] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.1] transition-colors border border-gray-200/50 dark:border-white/[0.05]"
                >
                  <ChevronDown className={`w-5 h-5 transition-transform ${isClientExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {isClientExpanded && (
              <div className="relative z-10 border-t border-gray-200/50 dark:border-white/[0.05] bg-gray-50/50 dark:bg-black/20 backdrop-blur-sm transition-all">
                <div className="p-3 sm:p-4 space-y-4">
                  {client.flights.map((flight) => {
                    const flightKey = `${client.client_code}-${flight.flight_name}`;
                    const isFlightExpanded = expandedFlights[flightKey] ?? true;

                    const pendingTx = flight.transactions.filter(tx => !tx.has_proof);
                    const hasPending = pendingTx.length > 0;
                    const isChecked = !deselectedFlights[flightKey];

                    return (
                      <div key={flight.flight_name} className="bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 dark:border-white/[0.08] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        {/* Flight Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 gap-4 border-b border-gray-100 dark:border-white/[0.05]">
                          <div className="flex items-center gap-3.5 flex-1 group/flight">
                            {/* Checkbox */}
                            {hasPending && canMarkTaken && (
                              <div 
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center justify-center cursor-pointer p-1"
                              >
                                <input 
                                  type="checkbox" 
                                  checked={isChecked} 
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setDeselectedFlights(prev => ({ ...prev, [flightKey]: !checked }));
                                  }}
                                  className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 dark:border-gray-600 dark:bg-[#222]"
                                />
                              </div>
                            )}

                            <div 
                              onClick={() => toggleFlight(flightKey)}
                              className="flex items-center gap-3.5 flex-1 cursor-pointer select-none"
                            >
                              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-500/20 dark:to-amber-500/5 flex items-center justify-center shrink-0 border border-orange-200/50 dark:border-orange-500/20 group-hover/flight:scale-105 transition-transform">
                                <Plane className="w-6 h-6 text-orange-500 dark:text-orange-400" strokeWidth={1.5} />
                              </div>
                              <div>
                                <h4 className="text-[15px] font-bold text-gray-900 dark:text-white tracking-tight">{flight.flight_name}</h4>
                                <div className="flex items-center gap-2 text-[12px] font-medium text-gray-500 dark:text-gray-400 mt-1">
                                  <span className="bg-gray-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-md">{flight.transactions.length} ta yuk</span>
                                  <span className="text-gray-300 dark:text-gray-700">•</span>
                                  <span>{flight.total_weight_kg} kg</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 sm:shrink-0 justify-between sm:justify-end w-full sm:w-auto">
                            <div className="flex -space-x-2.5 hover:space-x-0 transition-all duration-300">
                              {flight.flight_cargo_photos?.slice(0, 3).map((photoUrl, idx) => (
                                <div 
                                  key={idx} 
                                  onClick={() => setSelectedImage(photoUrl)}
                                  className="w-9 h-9 rounded-full border-2 border-white dark:border-[#1a1a1a] overflow-hidden bg-gray-200 dark:bg-gray-800 shadow-sm relative z-[1] cursor-pointer hover:scale-110 transition-transform"
                                >
                                  <img src={photoUrl} alt="Cargo photo" className="w-full h-full object-cover" loading="lazy" />
                                </div>
                              ))}
                              {flight.flight_cargo_photos?.length > 3 && (
                                <div className="w-9 h-9 rounded-full border-2 border-white dark:border-[#1a1a1a] bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[11px] font-bold text-gray-600 dark:text-gray-300 shadow-sm relative z-0">
                                  +{flight.flight_cargo_photos.length - 3}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2.5">
                              {flight.total_remaining_amount > 0 && onNotifyCashier && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNotifyCashier(client.client_code, flight.flight_name, flight.total_remaining_amount);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-400 dark:hover:bg-violet-500/20 rounded-xl text-[12px] font-bold transition-all border border-violet-100 dark:border-violet-500/20 active:scale-95"
                                >
                                  <BellRing className="w-4 h-4" />
                                  <span className="hidden sm:inline">Kassir</span>
                                </button>
                              )}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFlight(flightKey);
                                }}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.06] text-gray-500 hover:bg-gray-200 dark:hover:bg-white/[0.1] transition-colors border border-gray-200/50 dark:border-white/[0.05]"
                              >
                                <ChevronDown className={`w-4 h-4 transition-transform ${isFlightExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {isFlightExpanded && (
                          <div className="overflow-hidden transition-all">
                            <div className="divide-y divide-gray-100/50 dark:divide-white/[0.02] bg-white/30 dark:bg-black/10">
                              {flight.transactions.map((tx) => {
                                const paymentStyle = getPaymentStyle(tx.payment_status);

                                return (
                                  <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 gap-3 hover:bg-white/50 dark:hover:bg-white/[0.02] transition-colors group/tx">
                                    <div className="flex items-start gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-gray-100/80 dark:bg-white/[0.06] border border-gray-200/50 dark:border-white/[0.05] flex items-center justify-center text-[13px] font-black text-gray-700 dark:text-gray-300 shrink-0 font-mono shadow-sm group-hover/tx:scale-105 transition-transform">
                                        {tx.qator_raqami}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2.5">
                                          <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{tx.vazn} kg</span>
                                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border border-current/10 ${paymentStyle.bg} ${paymentStyle.text}`}>
                                            {paymentStyle.label}
                                          </span>
                                        </div>
                                        <div className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                          Summa: <span className="font-bold text-gray-700 dark:text-gray-300">{formatCurrencySum(tx.summa)}</span>
                                          {tx.remaining_amount > 0 && tx.payment_status !== "paid" && (
                                            <span className="ml-1.5 text-red-500 font-bold bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded-md">(−{formatCurrencySum(tx.remaining_amount)})</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-end sm:shrink-0 ml-14 sm:ml-0">
                                      {tx.has_proof ? (
                                        <span className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-blue-50/80 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 shadow-sm backdrop-blur-sm">
                                          <CheckCheck className="w-4 h-4" /> Isbot yuklangan
                                        </span>
                                      ) : tx.is_taken_away ? (
                                        <div className="flex items-center gap-2">
                                          <span className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 shadow-sm backdrop-blur-sm">
                                            <CheckCheck className="w-4 h-4" /> Berilgan
                                          </span>
                                          {canMarkTaken && (
                                            <button
                                              onClick={() => onMarkTaken([tx.id], client.client_code, flight.flight_name, tx.is_taken_away)}
                                              className="flex items-center gap-1 text-[11px] font-bold px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10 transition-colors shadow-sm active:scale-95"
                                            >
                                              Isbot
                                            </button>
                                          )}
                                        </div>
                                      ) : canMarkTaken ? (
                                        <button
                                          onClick={() => onMarkTaken([tx.id], client.client_code, flight.flight_name, false)}
                                          className="flex items-center gap-1.5 text-[11px] font-bold px-4 py-2 rounded-xl bg-orange-100/80 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-500/30 transition-colors border border-orange-200/50 dark:border-orange-500/30 active:scale-95"
                                        >
                                          <Truck className="w-4 h-4" />
                                          Berish
                                        </button>
                                      ) : (
                                        <span className="text-[11px] font-bold px-3 py-2 rounded-xl bg-gray-100/80 dark:bg-white/[0.04] text-gray-400 dark:text-gray-500 border border-gray-200/50 dark:border-white/[0.05] shadow-sm backdrop-blur-sm">
                                          Kutilmoqda
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Rasm modali - Animatsiyalarsiz oddiy holatda */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-[101]"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={selectedImage}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in-90 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
