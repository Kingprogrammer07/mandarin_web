import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckSquare, Loader2, Search, Square } from "lucide-react";
import { toast } from "sonner";

import {
  extractAstatkaLeftovers,
  getAstatkaSourceFlights,
  type AstatkaExtractResponse,
  type AstatkaPackage,
} from "@/api/services/astatkaFlights";
import { WorkspaceDialog } from "@/components/astatka/workspace/WorkspaceDialog";
import { formatKg, formatScanTime } from "@/lib/astatkaFormat";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/utils/apiError";

interface Props {
  flightName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (created: number) => void;
}

const bagKey = (pkg: AstatkaPackage) => `${pkg.source_flight_name}|${pkg.client_code}`;

/**
 * "Astatka ajratish": pick old flights, see which bags nobody took, save them
 * to the astatka's list as "kutilmoqda". Nothing moves until a worker scans
 * and confirms each bag on the shelf.
 */
export function AstatkaExtractDialog({ flightName, open, onOpenChange, onSaved }: Props) {
  const [step, setStep] = useState<"pick" | "review">("pick");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [preview, setPreview] = useState<AstatkaExtractResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Reset on the way out, so the next opening starts at the flight list.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStep("pick");
      setChosen([]);
      setPreview(null);
      setSearch("");
    }
    onOpenChange(next);
  };

  const flights = useQuery({
    queryKey: ["astatka-source-flights", flightName, debounced],
    queryFn: () => getAstatkaSourceFlights(flightName, debounced || undefined),
    enabled: open,
    staleTime: 30_000,
  });

  const review = useMutation({
    mutationFn: () =>
      extractAstatkaLeftovers(flightName, { source_flights: chosen, dry_run: true }),
    onSuccess: (result) => {
      setPreview(result);
      setSelected(
        new Set(result.packages.filter((pkg) => !pkg.already_in_astatka).map(bagKey)),
      );
      setStep("review");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Yuklarni topib bo'lmadi.")),
  });

  const fresh = useMemo(
    () => preview?.packages.filter((pkg) => !pkg.already_in_astatka) ?? [],
    [preview],
  );
  const placed = useMemo(
    () => preview?.packages.filter((pkg) => pkg.already_in_astatka) ?? [],
    [preview],
  );
  const selectedBags = fresh.filter((pkg) => selected.has(bagKey(pkg)));
  const selectedWeight = selectedBags.reduce((sum, pkg) => sum + (pkg.weight_kg ?? 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      // One call per flight with exactly the clients ticked under it, so
      // unticking a client in one flight cannot drag in their bag from another.
      const bySource = new Map<string, string[]>();
      for (const pkg of selectedBags) {
        const list = bySource.get(pkg.source_flight_name) ?? [];
        list.push(pkg.client_code);
        bySource.set(pkg.source_flight_name, list);
      }
      let created = 0;
      for (const [source, clients] of bySource) {
        const result = await extractAstatkaLeftovers(flightName, {
          source_flights: [source],
          client_codes: clients,
          dry_run: false,
        });
        created += result.created;
      }
      return created;
    },
    onSuccess: (created) => {
      toast.success(
        created > 0
          ? `${created} ta yuk ro'yxatga qo'shildi. Endi ularni skanerlab tasdiqlang.`
          : "Yangi yuk qo'shilmadi — hammasi allaqachon ro'yxatda.",
      );
      onSaved(created);
      handleOpenChange(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Saqlab bo'lmadi.")),
  });

  const toggleFlight = (name: string) =>
    setChosen((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );

  const toggleBag = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allSelected = fresh.length > 0 && selectedBags.length === fresh.length;

  return (
    <WorkspaceDialog
      open={open}
      onOpenChange={handleOpenChange}
      wide
      title={step === "pick" ? "Astatka ajratish" : "Topilgan yuklar"}
      description={
        step === "pick"
          ? `Qaysi reyslardan olib ketilmagan yuklar ${flightName} ga olinsin? Bir nechtasini tanlash mumkin.`
          : "Belgilanganlar «Kutilmoqda» bo'lib ro'yxatga tushadi. Yuk joyida ekanini skanerlab tasdiqlaysiz."
      }
      footer={
        step === "pick" ? (
          <button
            type="button"
            onClick={() => review.mutate()}
            disabled={chosen.length === 0 || review.isPending}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-mc-md bg-mc-brand text-[14px] font-extrabold text-mc-on-brand active:scale-[0.98] disabled:opacity-50"
          >
            {review.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {chosen.length === 0
              ? "Reys tanlang"
              : `Olib ketilmaganlarni ko'rish (${chosen.length} ta reys)`}
          </button>
        ) : (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <button
              type="button"
              onClick={() => setStep("pick")}
              className="h-12 rounded-mc-md border border-mc-border bg-mc-surface px-4 text-[14px] font-bold text-mc-text active:scale-[0.98]"
            >
              Orqaga
            </button>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={selectedBags.length === 0 || save.isPending}
              className="flex h-12 items-center justify-center gap-2 rounded-mc-md bg-mc-brand px-3 text-[14px] font-extrabold text-mc-on-brand active:scale-[0.98] disabled:opacity-50"
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Saqlash ({selectedBags.length} ta)
            </button>
          </div>
        )
      }
    >
      {step === "pick" ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mc-text-3" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Reys nomi, masalan M210"
              aria-label="Reys qidirish"
              autoCapitalize="characters"
              className="h-11 w-full rounded-mc-sm border border-mc-border bg-mc-surface-2 pl-9 pr-3 text-[16px] font-semibold text-mc-text outline-none focus:border-mc-brand"
            />
          </div>
          {flights.isLoading && (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="h-[60px] animate-pulse rounded-mc-md bg-mc-surface-2" />
              ))}
            </div>
          )}
          {flights.isError && (
            <p className="rounded-mc-sm bg-mc-danger-soft px-3 py-2 text-[13px] font-semibold text-mc-danger">
              {apiErrorMessage(flights.error, "Reyslarni olib bo'lmadi.")}
            </p>
          )}
          {flights.isSuccess && flights.data.length === 0 && (
            <p className="py-6 text-center text-[13px] font-semibold text-mc-text-3">Reys topilmadi</p>
          )}
          <ul className="space-y-1.5">
            {(flights.data ?? []).map((flight) => {
              const active = chosen.includes(flight.flight_name);
              const free = flight.leftover_clients - flight.in_astatka_clients;
              return (
                <li key={flight.flight_name}>
                  <button
                    type="button"
                    onClick={() => toggleFlight(flight.flight_name)}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-mc-md border p-3 text-left active:scale-[0.99]",
                      active ? "border-mc-brand bg-mc-brand-soft" : "border-mc-border bg-mc-surface",
                    )}
                  >
                    {active ? (
                      <CheckSquare className="h-5 w-5 shrink-0 text-mc-brand" />
                    ) : (
                      <Square className="h-5 w-5 shrink-0 text-mc-text-3" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[15px] font-extrabold text-mc-text">
                        {flight.flight_name}
                      </p>
                      <p className="text-[12px] font-semibold text-mc-text-2">
                        {flight.clients} mijozdan{" "}
                        <span className={free > 0 ? "text-mc-brand" : undefined}>
                          {flight.leftover_clients} tasi olib ketmagan
                        </span>
                        {flight.leftover_weight_kg > 0 && ` · ${formatKg(flight.leftover_weight_kg)}`}
                      </p>
                      {(flight.in_astatka_clients > 0 || flight.last_activity_at) && (
                        <p className="text-[11px] font-medium text-mc-text-3">
                          {flight.in_astatka_clients > 0 &&
                            `${flight.in_astatka_clients} tasi allaqachon astatkada · `}
                          {flight.last_activity_at &&
                            `oxirgi foto: ${formatScanTime(flight.last_activity_at)}`}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-mc-md bg-mc-surface-2 p-3">
            <p className="text-[15px] font-extrabold text-mc-text">
              {fresh.length} ta yuk topildi · {formatKg(preview?.total_weight_kg ?? 0)}
            </p>
            {placed.length > 0 && (
              <p className="text-[12px] font-semibold text-mc-text-3">
                Yana {placed.length} tasi allaqachon astatkada — qayta qo'shilmaydi.
              </p>
            )}
          </div>
          {fresh.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setSelected(allSelected ? new Set() : new Set(fresh.map(bagKey)))
              }
              className="inline-flex h-11 items-center gap-2 text-[13px] font-bold text-mc-brand"
            >
              {allSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
              {allSelected ? "Hammasini olib tashlash" : "Hammasini belgilash"} ·{" "}
              {selectedBags.length} ta · {formatKg(selectedWeight)}
            </button>
          )}
          {fresh.length === 0 && (
            <p className="py-6 text-center text-[13px] font-semibold text-mc-text-3">
              Bu reyslarda olib ketilmagan yangi yuk topilmadi.
            </p>
          )}
          <ul className="space-y-1.5">
            {fresh.map((pkg) => {
              const key = bagKey(pkg);
              const active = selected.has(key);
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => toggleBag(key)}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-mc-md border p-2.5 text-left active:scale-[0.99]",
                      active ? "border-mc-brand/60 bg-mc-surface" : "border-mc-border bg-mc-surface-2 opacity-70",
                    )}
                  >
                    {active ? (
                      <CheckSquare className="h-5 w-5 shrink-0 text-mc-brand" />
                    ) : (
                      <Square className="h-5 w-5 shrink-0 text-mc-text-3" />
                    )}
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_4.5rem_minmax(0,1fr)]">
                      <span className="min-w-0 break-all text-[14px] font-extrabold text-mc-text">
                        {pkg.client_code}
                      </span>
                      <span className="min-w-0 break-words text-[13px] font-semibold text-mc-text-2">
                        {pkg.source_flight_name}
                      </span>
                      <span className="text-[13px] font-semibold tabular-nums text-mc-text-2">
                        {pkg.track_count} trek
                      </span>
                      <span className="break-words text-[13px] font-bold tabular-nums text-mc-text">
                        {formatKg(pkg.weight_kg)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </WorkspaceDialog>
  );
}
