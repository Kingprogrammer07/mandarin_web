import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  X,
  Phone,
  MapPin,
  Package,
  CreditCard,
  Clock,
  User,
} from "lucide-react";
import type { FilterType } from "@/api/transactions";
import { getClientProfile, normalizeClientProfile } from "@/api/verification";
import { getPOSClientTransactions } from "@/api/pos";
import { formatCurrencySum } from "@/lib/format";
import { FILTER_TABS } from "./utils";
import { AdjustForm } from "./AdjustForm";
import { TransactionItem } from "./TransactionItem";
import { FullInfoModal } from "./FullInfoModal";
import { PickupQueueModal } from "./PickupQueueModal";

// ─── ClientProfileDrawer ──────────────────────────────────────────────────────

interface ClientProfileDrawerProps {
  clientCode: string;
  clientName: string;
  currentBalance: number;
  onClose: () => void;
  onBalanceUpdate: (newBalance: number) => void;
  onRefreshClient?: () => void;
  canAdjust: boolean;
  canUpdateStatus: boolean;
}

export function ClientProfileDrawer({
  clientCode,
  clientName,
  currentBalance,
  onClose,
  onBalanceUpdate,
  onRefreshClient,
  canAdjust,
  canUpdateStatus,
}: ClientProfileDrawerProps) {
  const [txFilter, setTxFilter] = useState<FilterType>("all");
  const [showFullInfo, setShowFullInfo] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<number>>(new Set());
  const [showPickupQueueModal, setShowPickupQueueModal] = useState(false);

  const toggleTxSelection = useCallback((id: number) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handlePickupSuccess = useCallback(() => {
    setSelectedTxIds(new Set());
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["pos-profile", clientCode],
    queryFn: async () => {
      const res = await getClientProfile(clientCode);
      return normalizeClientProfile(res.client);
    },
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ["pos-txn", clientCode, txFilter],
    queryFn: () => getPOSClientTransactions(clientCode, txFilter, 20, 0),
  });

  const transactions = useMemo(() => txData?.transactions ?? [], [txData?.transactions]);
  const txCount = txData?.total_count ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg md:max-w-4xl flex flex-col bg-white dark:bg-[#111] rounded-t-3xl border-t border-gray-100 dark:border-white/[0.08] shadow-2xl"
        style={{ maxHeight: "88vh" }}
      >
        {/* Drag handle */}
        <div className="shrink-0 pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-white/10" />
        </div>

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 pb-3 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/[0.1] flex items-center justify-center">
              <User className="w-5 h-5 text-orange-500" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight">
                {clientName}
              </p>
              <p className="text-[11px] font-mono text-gray-400">{clientCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-gray-400 dark:text-gray-500">Hamyon</p>
              <p className={`text-[14px] font-black ${currentBalance > 0 ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                {formatCurrencySum(currentBalance)}
              </p>
            </div>
            <button
              onClick={() => setShowFullInfo(true)}
              className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg font-bold text-[12px] hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 transition-colors"
            >
              Batafsil
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body — 2-column on desktop, stacked on mobile */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row">
          {/* DESKTOP LEFT: Profile details + adjust form */}
          <div className="hidden md:flex md:w-80 shrink-0 flex-col border-r border-gray-100 dark:border-white/[0.06]">
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 min-h-0">
              <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Mijoz ma&apos;lumotlari
              </p>

              <ProfileField icon={<Phone className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" strokeWidth={1.8} />} label="Telefon" value={profile?.phone ?? "—"} />
              <ProfileField icon={<CreditCard className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" strokeWidth={1.8} />} label="Pasport seriyasi" value={profile?.passport_series ?? "—"} mono />
              <ProfileField icon={<MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" strokeWidth={1.8} />} label="Viloyat" value={profile?.region ?? "—"} />

              {profile && (
                <div className="grid grid-cols-2 gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                  <StatCard label="Jami tranzaksiya" value={profile.transaction_count} />
                  <StatCard label="Referallar" value={profile.referral_count} />
                </div>
              )}
            </div>

            {canAdjust && (
              <div className="shrink-0 px-5 pb-6 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
                <AdjustForm
                  clientCode={clientCode}
                  onBalanceUpdate={onBalanceUpdate}
                  onRefreshClient={onRefreshClient}
                />
              </div>
            )}
          </div>

          {/* TRANSACTIONS: full on mobile, right column on desktop */}
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
            {/* Filter tabs */}
            <div className="shrink-0 px-5 pt-3">
              <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl">
                {FILTER_TABS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setTxFilter(id)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      txFilter === id
                        ? "bg-white dark:bg-[#222] text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-2.5 mb-0.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Operatsiyalar
                </span>
                {txData && (
                  <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md">
                    {txCount} ta
                  </span>
                )}
              </div>
            </div>

            {/* Transaction list */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 min-h-0 space-y-2">
              {txLoading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-14 bg-gray-50 dark:bg-white/[0.04] rounded-xl animate-pulse" />
                  ))}
                </>
              ) : transactions.length > 0 ? (
                transactions.map((tx) => (
                  <TransactionItem
                    key={tx.id}
                    tx={tx}
                    isSelected={selectedTxIds.has(tx.id)}
                    canUpdateStatus={canUpdateStatus}
                    onToggleSelect={toggleTxSelection}
                    clientCode={clientCode}
                  />
                ))
              ) : (
                <div className="py-8 text-center">
                  <Package className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
                  <p className="text-[12px] text-gray-400">Operatsiyalar yo&apos;q</p>
                </div>
              )}

              {selectedTxIds.size > 0 && (
                <div className="sticky bottom-2 z-10">
                  <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-orange-200 dark:border-orange-500/20 shadow-lg p-3 flex items-center justify-between">
                    <span className="text-[12px] font-bold text-gray-700 dark:text-gray-200">
                      {selectedTxIds.size} ta tanlandi
                    </span>
                    <button
                      onClick={() => setShowPickupQueueModal(true)}
                      className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[12px] font-bold rounded-lg shadow-sm"
                    >
                      Warehousega yuborish
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MOBILE ONLY: Adjust form pinned at bottom */}
          {canAdjust && (
            <div className="md:hidden shrink-0 px-5 pb-6 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
              <AdjustForm
                clientCode={clientCode}
                onBalanceUpdate={onBalanceUpdate}
                onRefreshClient={onRefreshClient}
              />
            </div>
          )}
        </div>
      </motion.div>

      <FullInfoModal
        isOpen={showFullInfo}
        onClose={() => setShowFullInfo(false)}
        profile={profile ?? null}
      />

      <PickupQueueModal
        isOpen={showPickupQueueModal}
        onClose={() => setShowPickupQueueModal(false)}
        selectedTxIds={selectedTxIds}
        onSuccess={handlePickupSuccess}
      />
    </motion.div>
  );
}

// ─── Local helpers ────────────────────────────────────────────────────────────

function ProfileField({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      {icon}
      <div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">{label}</p>
        <p className={`text-[12px] font-semibold text-gray-800 dark:text-white ${mono ? "font-mono" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-2.5">
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{label}</p>
      <p className="text-[18px] font-black text-gray-800 dark:text-white">{value}</p>
    </div>
  );
}
