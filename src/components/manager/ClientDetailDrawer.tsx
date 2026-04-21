import { useState, useEffect, useMemo } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, User, Wallet, Save, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useManagerStore } from "../../store/useManagerStore";
import { getAdminJwtClaims } from "../../api/services/adminManagement";
import {
  useClientDetail,
  useClientFinances,
  useClientFlights,
  useTransactionPaymentDetail,
  useUpdateClientPersonal,
} from "../../api/hooks/useAdminClients";
import {
  updateClientPersonalSchema,
} from "../../schemas/clientSchemas";
import type { UpdateClientPersonalFormValues } from "../../schemas/clientSchemas";
import type { ClientTransactionItem, FinancesFilterType } from "../../api/services/adminClients";
import { Skeleton } from "../ui/skeleton";
import { regions, DISTRICTS } from "@/lib/validation";

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { value: FinancesFilterType; label: string }[] = [
  { value: "all", label: "Barchasi" },
  { value: "paid", label: "To'langan" },
  { value: "unpaid", label: "To'lanmagan" },
  { value: "partial", label: "Qisman" },
  { value: "taken", label: "Olib ketilgan" },
  { value: "not_taken", label: "Olib ketilmagan" },
];

const BASE_INPUT =
  "w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-white/[0.08] " +
  "bg-white dark:bg-white/[0.04] text-gray-900 dark:text-white " +
  "placeholder-gray-400 dark:placeholder-gray-600 " +
  "focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 " +
  "text-[13px] transition-all disabled:opacity-50 disabled:cursor-not-allowed";

const BASE_SELECT =
  BASE_INPUT + " appearance-none cursor-pointer";

// ─── Payment Detail Sub-panel ─────────────────────────────────────────────────

function PaymentDetailPanel({
  clientId,
  transaction,
}: {
  clientId: number;
  transaction: ClientTransactionItem;
}) {
  const { data: detail, isLoading } = useTransactionPaymentDetail(clientId, transaction.id);
  if (isLoading) {
    return (
      <div className="mt-3 p-3 bg-gray-50 dark:bg-white/[0.04] rounded-xl space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    );
  }

  if (!detail) return null;

  const providerLabels: Record<string, string> = {
    cash: "Naqd",
    click: "Click",
    payme: "Payme",
    card: "Karta",
    wallet: "Hamyon",
  };

  return (
    <div className="mt-3 p-3 bg-gray-50 dark:bg-white/[0.04] rounded-xl border border-gray-100 dark:border-white/[0.06] space-y-2">
      <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
        To&apos;lov tafsiloti
      </p>
      {detail.payment_events.length > 0 ? (
        <div className="space-y-1.5">
          {detail.payment_events.map((event) => (
            <div key={event.id} className="flex justify-between text-[12px]">
              <span className="text-gray-500 dark:text-gray-400">
                {providerLabels[event.payment_provider] ?? event.payment_provider}
                {" · "}
                {format(new Date(event.created_at), "dd.MM.yy HH:mm")}
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {event.amount.toLocaleString("ru-RU")} so&apos;m
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-gray-400 dark:text-gray-500">
          To&apos;lov amalga oshirilmagan
        </p>
      )}
      {detail.remaining_amount > 0 && (
        <div className="pt-2 border-t border-gray-200 dark:border-white/[0.06] flex justify-between text-[12px]">
          <span className="text-orange-600 dark:text-orange-400 font-medium">Qoldiq qarz</span>
          <span className="text-orange-600 dark:text-orange-400 font-semibold">
            {detail.remaining_amount.toLocaleString("ru-RU")} so&apos;m
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Transaction Card ─────────────────────────────────────────────────────────

function TransactionCard({
  tx,
  clientId,
}: {
  tx: ClientTransactionItem;
  clientId: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    tx.payment_status === "paid"
      ? "text-emerald-600 dark:text-emerald-400"
      : tx.payment_status === "partial"
        ? "text-amber-500 dark:text-amber-400"
        : "text-orange-500 dark:text-orange-400";

  const statusLabel =
    tx.payment_status === "paid"
      ? "To'langan"
      : tx.payment_status === "partial"
        ? "Qisman"
        : "Qarzdorlik";

  return (
    <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/[0.06] overflow-hidden">
      <button
        className="w-full p-4 flex justify-between items-start text-left hover:bg-gray-50/70 dark:hover:bg-white/[0.04] transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div>
          <p className="text-[13px] font-medium text-gray-900 dark:text-white">
            {tx.reys}{" "}
            <span className="text-gray-400 dark:text-gray-500 font-normal">
              ({tx.vazn} kg)
            </span>
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
            {format(new Date(tx.created_at), "dd.MM.yyyy HH:mm")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <div className="text-right">
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white">
              {(tx.summa || 0).toLocaleString("ru-RU")} so&apos;m
            </p>
            <p className={`text-[11px] mt-0.5 ${statusColor}`}>{statusLabel}</p>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <PaymentDetailPanel clientId={clientId} transaction={tx} />
        </div>
      )}
    </div>
  );
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

export function ClientDetailDrawer() {
  const { t } = useTranslation();
  const { selectedClientId, setSelectedClientId } = useManagerStore();

  const { isSuperAdmin, permissions } = getAdminJwtClaims();
  const canReadFinances = isSuperAdmin || permissions.has('finance_read') || permissions.has('finance_update');

  const [activeTab, setActiveTab] = useState<"profile" | "finances">("profile");

  // Finances filter state
  const [filterTypeState, setFilterTypeState] = useState<{
    clientId: number | null;
    value: FinancesFilterType;
  }>({
    clientId: selectedClientId,
    value: "all",
  });
  const [selectedFlightState, setSelectedFlightState] = useState<{
    clientId: number | null;
    value: string;
  }>({
    clientId: selectedClientId,
    value: "",
  });
  const [financesPageState, setFinancesPageState] = useState<{
    clientId: number | null;
    value: number;
  }>({
    clientId: selectedClientId,
    value: 1,
  });

  const filterType = filterTypeState.clientId === selectedClientId ? filterTypeState.value : "all";
  const selectedFlight = selectedFlightState.clientId === selectedClientId ? selectedFlightState.value : "";
  const financesPage = financesPageState.clientId === selectedClientId ? financesPageState.value : 1;

  const { data: client, isLoading: isClientLoading } = useClientDetail(selectedClientId);
  const { data: flightsData } = useClientFlights(selectedClientId);
  const { data: finances, isLoading: isFinancesLoading } = useClientFinances(
    selectedClientId,
    {
      page: financesPage,
      size: 20,
      filter_type: filterType,
      flight_name: selectedFlight || undefined,
    },
  );
  const { mutate: updateClient, isPending: isUpdating } = useUpdateClientPersonal();

  // Merge /flights API result with unique flights extracted from loaded transactions.
  // Fallback is needed when the backend /flights endpoint returns empty due to
  // primary_code vs active_codes mismatch — transactions already have the real data.
  const availableFlights = useMemo(() => {
    const fromApi: string[] = flightsData?.flights ?? [];
    const fromTransactions: string[] = (finances?.transactions ?? [])
      .map((tx) => tx.reys)
      .filter(Boolean);
    const merged = [...new Set([...fromApi, ...fromTransactions])];
    return merged.sort();
  }, [flightsData?.flights, finances?.transactions]);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<UpdateClientPersonalFormValues>({
    resolver: zodResolver(updateClientPersonalSchema),
  });

  const selectedRegion = useWatch({
    control,
    name: "region",
  });

  // Sync form with client data when client loads or changes
  useEffect(() => {
    if (client) {
      reset({
        full_name: client.full_name || "",
        phone: client.phone || "",
        date_of_birth: client.date_of_birth ? String(client.date_of_birth) : "",
        region: client.region || "",
        district: client.district || "",
        address: client.address || "",
      });
    }
  }, [client, reset]);

  if (!selectedClientId) return null;

  const availableDistricts = selectedRegion ? (DISTRICTS[selectedRegion] ?? []) : [];

  const onSubmit = (data: UpdateClientPersonalFormValues) => {
    if (!selectedClientId) return;
    updateClient(
      { clientId: selectedClientId, data },
      {
        onSuccess: () => toast.success("Mijoz ma'lumotlari yangilandi"),
        onError: () => toast.error("Ma'lumotlarni yangilashda xatolik"),
      },
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 z-[100] transition-opacity"
        onClick={() => setSelectedClientId(null)}
      />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-[#111] shadow-2xl flex flex-col z-[101]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06] bg-white dark:bg-[#111] flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white truncate">
              {client
                ? client.primary_code
                : <span className="inline-block w-24 h-5 bg-gray-200 dark:bg-white/[0.08] rounded-lg animate-pulse" />
              }
            </h2>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
              {client?.full_name ?? ""}
            </p>
          </div>
          <button
            onClick={() => setSelectedClientId(null)}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ml-3 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-white/[0.06] flex-shrink-0 bg-white dark:bg-[#111]">
          {([
            { key: "profile" as const, Icon: User, label: "Shaxsiy ma'lumotlar", visible: true },
            { key: "finances" as const, Icon: Wallet, label: "Moliya holati", visible: canReadFinances },
          ] as const).filter(tab => tab.visible).map(({ key, Icon, label }) => (
            <button
              key={key}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[13px] font-medium transition-colors relative ${
                activeTab === key
                  ? "text-orange-500 dark:text-orange-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
              onClick={() => setActiveTab(key)}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              {activeTab === key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange-500 dark:bg-orange-400 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto bg-[#f7f7f6] dark:bg-[#0d0d0d]">

          {/* ── Profile tab ── */}
          {activeTab === "profile" && (
            <div className="p-5 space-y-4">
              {isClientLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-xl" />
                  ))}
                </div>
              ) : (
                <form id="profile-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Full name */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400">
                      F.I.SH
                    </label>
                    <input {...register("full_name")} className={BASE_INPUT} />
                    {errors.full_name && (
                      <p className="text-[11px] text-red-500">{errors.full_name.message}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400">
                      Telefon raqam
                    </label>
                    <input {...register("phone")} className={BASE_INPUT} />
                    {errors.phone && (
                      <p className="text-[11px] text-red-500">{errors.phone.message}</p>
                    )}
                  </div>

                  {/* Date of birth */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400">
                      Tug&apos;ilgan sana
                    </label>
                    <input
                      {...register("date_of_birth")}
                      placeholder="YYYY-MM-DD"
                      className={BASE_INPUT}
                    />
                    {errors.date_of_birth && (
                      <p className="text-[11px] text-red-500">{errors.date_of_birth.message}</p>
                    )}
                  </div>

                  {/* Region */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400">
                      Viloyat
                    </label>
                    <Controller
                      name="region"
                      control={control}
                      render={({ field }) => (
                        <select
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            // Reset district when region changes
                            setValue("district", "");
                          }}
                          className={BASE_SELECT}
                        >
                          <option value="">Viloyatni tanlang</option>
                          {regions.map((r) => (
                            <option key={r.value} value={r.value}>
                              {t(r.label)}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                  </div>

                  {/* District */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400">
                      Tuman
                    </label>
                    <Controller
                      name="district"
                      control={control}
                      render={({ field }) => (
                        <select
                          {...field}
                          value={field.value ?? ""}
                          disabled={!selectedRegion}
                          className={BASE_SELECT}
                        >
                          <option value="">Tumanni tanlang</option>
                          {availableDistricts.map((d) => (
                            <option key={d.value} value={d.value}>
                              {t(d.label)}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                  </div>

                  {/* Address */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400">
                      Manzil
                    </label>
                    <input {...register("address")} className={BASE_INPUT} />
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ── Finances tab ── */}
          {activeTab === "finances" && (
            <div className="p-5 space-y-4">
              {/* Balance cards */}
              {isFinancesLoading && !finances ? (
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                  ))}
                </div>
              ) : finances && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white dark:bg-white/[0.04] p-3 rounded-2xl border border-gray-100 dark:border-white/[0.06]">
                    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Hamyon
                    </p>
                    <p className="text-[15px] font-bold text-gray-900 dark:text-white mt-1">
                      {finances.wallet_balance.toLocaleString("ru-RU")}
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal"> so&apos;m</span>
                    </p>
                  </div>
                  <div className="bg-white dark:bg-white/[0.04] p-3 rounded-2xl border border-red-50 dark:border-red-500/[0.12]">
                    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Qarz
                    </p>
                    <p className="text-[15px] font-bold text-red-600 dark:text-red-400 mt-1">
                      {Math.abs(finances.debt).toLocaleString("ru-RU")}
                      <span className="text-[10px] font-normal opacity-70"> so&apos;m</span>
                    </p>
                  </div>
                  <div className={`bg-white dark:bg-white/[0.04] p-3 rounded-2xl border ${
                    finances.net_balance >= 0
                      ? "border-emerald-50 dark:border-emerald-500/[0.12]"
                      : "border-orange-50 dark:border-orange-500/[0.12]"
                  }`}>
                    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Balans
                    </p>
                    <p className={`text-[15px] font-bold mt-1 ${
                      finances.net_balance >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-orange-500 dark:text-orange-400"
                    }`}>
                      {finances.net_balance.toLocaleString("ru-RU")}
                      <span className="text-[10px] font-normal opacity-70"> so&apos;m</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Filter row */}
              <div className="flex gap-2">
                <select
                  value={filterType}
                  onChange={(e) => {
                    setFilterTypeState({
                      clientId: selectedClientId,
                      value: e.target.value as FinancesFilterType,
                    });
                    setFinancesPageState({
                      clientId: selectedClientId,
                      value: 1,
                    });
                  }}
                  className="flex-1 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 text-[13px] text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all appearance-none"
                >
                  {FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedFlight}
                  onChange={(e) => {
                    setSelectedFlightState({
                      clientId: selectedClientId,
                      value: e.target.value,
                    });
                    setFinancesPageState({
                      clientId: selectedClientId,
                      value: 1,
                    });
                  }}
                  className="flex-1 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 text-[13px] text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all appearance-none"
                >
                  <option value="">Barcha reyslar</option>
                  {availableFlights.map((flight) => (
                    <option key={flight} value={flight}>
                      {flight}
                    </option>
                  ))}
                </select>
              </div>

              {/* Transactions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">
                    Tranzaksiyalar
                  </h3>
                  {finances && (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      Jami {finances.total_count} ta
                    </span>
                  )}
                </div>

                {isFinancesLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-xl" />
                    ))}
                  </div>
                ) : finances?.transactions?.length ? (
                  <div className="space-y-2">
                    {finances.transactions.map((tx: ClientTransactionItem) => (
                      <TransactionCard key={tx.id} tx={tx} clientId={selectedClientId} />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 dark:text-gray-600 py-10 text-[13px]">
                    Tranzaksiyalar mavjud emas
                  </p>
                )}
              </div>

              {/* Pagination */}
              {(finances?.total_pages ?? 0) > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    disabled={financesPage === 1}
                    onClick={() => setFinancesPageState({
                      clientId: selectedClientId,
                      value: Math.max(1, financesPage - 1),
                    })}
                    className="w-9 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[12px] text-gray-500 dark:text-gray-400">
                    {financesPage} / {finances?.total_pages}
                  </span>
                  <button
                    disabled={financesPage >= (finances?.total_pages ?? 1)}
                    onClick={() => setFinancesPageState({
                      clientId: selectedClientId,
                      value: financesPage + 1,
                    })}
                    className="w-9 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky save footer — profile tab only */}
        {activeTab === "profile" && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-white/[0.06] bg-white dark:bg-[#111] flex-shrink-0">
            <button
              type="submit"
              form="profile-form"
              disabled={isUpdating}
              className="w-full h-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isUpdating ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
