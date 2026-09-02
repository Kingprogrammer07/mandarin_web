import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus, PackageSearch } from "lucide-react";

import {
  createAstatka,
  listAstatka,
  listAstatkaFlights,
  type Astatka,
} from "@/api/services/astatka";
import { AstatkaCreateSheet } from "@/components/astatka/AstatkaCreateSheet";
import { AstatkaItemSheet } from "@/components/astatka/AstatkaItemSheet";
import { AstatkaScanner } from "@/components/astatka/AstatkaScanner";
import { astatkaStore, type QueuedItem } from "@/utils/astatkaStore";

/**
 * Astatka — the warehouse stock-take of leftover cargo.
 *
 * Two views in one page rather than two routes: the worker moves between the
 * list and the scanner constantly, and a route change on a phone means a
 * remount, a refetch and a lost scan field.
 */

interface Props {
  onBack: () => void;
}

export function AstatkaPage({ onBack }: Props) {
  const [list, setList] = useState<Astatka[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [active, setActive] = useState<Astatka | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [flights, setFlights] = useState<string[]>([]);
  const [isLoadingFlights, setIsLoadingFlights] = useState(false);
  const [flightsError, setFlightsError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editItem, setEditItem] = useState<QueuedItem | null>(null);
  const [editIsNew, setEditIsNew] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setList(await listAstatka());
    } catch {
      // Offline is not an error state here: a worker who already has a
      // stock-take open should be able to keep scanning into it.
      setLoadError("Ro‘yxatni olib bo‘lmadi. Internetni tekshiring.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadFlights = useCallback(async () => {
    setIsLoadingFlights(true);
    setFlightsError(null);
    try {
      setFlights(await listAstatkaFlights());
    } catch {
      setFlightsError("failed");
    } finally {
      setIsLoadingFlights(false);
    }
  }, []);

  const openCreate = () => {
    setCreateOpen(true);
    setCreateError(null);
    void loadFlights();
  };

  const submitCreate = async (payload: {
    name: string;
    flight_names: string[];
  }) => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await createAstatka(payload);
      setCreateOpen(false);
      setList((current) => [created, ...current]);
      // Straight into scanning: creating one is never the goal, counting is.
      setActive(created);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      setCreateError(
        status === 409
          ? "Bu nomli astatka allaqachon bor. Boshqa nom bering."
          : "Yaratib bo‘lmadi. Yana urinib ko‘ring.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditItem = useCallback((item: QueuedItem) => {
    setEditItem(item);
    setEditIsNew(false);
  }, []);

  const handleManualEntry = useCallback(
    async (seed: Partial<QueuedItem> & { trackCode: string }) => {
      // The scanner has already persisted the row; re-read it so the sheet
      // edits the stored object rather than a copy that could drift from it.
      const rows = await astatkaStore.listForAstatka(seed.astatkaId ?? 0);
      const stored = rows.find((row) => row.id === seed.id) ?? null;
      if (stored) {
        setEditItem(stored);
        setEditIsNew(true);
      }
    },
    [],
  );

  if (active) {
    return (
      <>
        <AstatkaScanner
          key={active.id}
          astatka={active}
          onBack={() => {
            setActive(null);
            void load();
          }}
          onEditItem={handleEditItem}
          onManualEntry={handleManualEntry}
        />
        <AstatkaItemSheet
          open={editItem !== null}
          item={editItem}
          isNew={editIsNew}
          onClose={() => setEditItem(null)}
          onSaved={() => setRefreshToken((value) => value + 1)}
          key={`sheet-${editItem?.id ?? "none"}-${refreshToken}`}
        />
      </>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-mc-bg">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-mc-border bg-mc-surface px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Orqaga"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-2"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[16px] font-extrabold text-mc-text">
          Astatka
        </h1>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {isLoading && (
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-[76px] animate-pulse rounded-mc-lg bg-mc-surface-2"
              />
            ))}
          </div>
        )}

        {loadError && !isLoading && (
          <div className="mt-3 rounded-mc-md border border-mc-danger/30 bg-mc-danger-soft p-3">
            <p className="text-[12px] font-semibold text-mc-danger">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-2 h-11 w-full rounded-mc-sm border border-mc-border bg-mc-surface text-[13px] font-bold text-mc-text"
            >
              Qayta urinish
            </button>
          </div>
        )}

        {!isLoading && !loadError && list.length === 0 && (
          <div className="mt-12 text-center">
            <PackageSearch
              className="mx-auto h-9 w-9 text-mc-text-3"
              strokeWidth={1.7}
            />
            <p className="mt-3 text-[14px] font-bold text-mc-text-2">
              Hali astatka yo‘q
            </p>
            <p className="mx-auto mt-1 max-w-[260px] text-[12px] font-medium text-mc-text-3">
              Yangi astatka oching va omborda qolgan yuklarni skanerlab yig‘ing
            </p>
          </div>
        )}

        <ul className="mt-3 space-y-2">
          {list.map((astatka) => {
            const total = Object.values(astatka.counts).reduce(
              (sum, value) => sum + (value ?? 0),
              0,
            );
            return (
              <li key={astatka.id}>
                <button
                  type="button"
                  onClick={() => setActive(astatka)}
                  className="w-full rounded-mc-lg border border-mc-border bg-mc-surface p-3 text-left active:scale-[0.99]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-mc-text">
                      {astatka.name}
                    </span>
                    <span className="shrink-0 text-[13px] font-bold text-mc-text-2">
                      {total} ta
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[12px] font-medium text-mc-text-3">
                    {astatka.flight_names.length > 0
                      ? astatka.flight_names.join(", ")
                      : "Barcha reyslar"}
                  </p>
                  {(astatka.counts.needs_data ?? 0) +
                    (astatka.counts.unknown ?? 0) >
                    0 && (
                    <p className="mt-1 text-[11px] font-bold text-mc-warn">
                      {(astatka.counts.needs_data ?? 0) +
                        (astatka.counts.unknown ?? 0)}{" "}
                      ta yuk to‘ldirilishi kerak
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </main>

      {/* Reachable by thumb, clear of the home indicator. */}
      <button
        type="button"
        onClick={openCreate}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-12 items-center gap-1.5 rounded-full bg-mc-brand px-4 text-[13px] font-extrabold text-mc-on-brand shadow-[var(--mc-shadow-cta)] active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.6} />
        Yangi astatka
      </button>

      <AstatkaCreateSheet
        open={createOpen}
        flights={flights}
        isLoadingFlights={isLoadingFlights}
        flightsError={flightsError}
        isCreating={isCreating}
        error={createError}
        onRetryFlights={() => void loadFlights()}
        onClose={() => setCreateOpen(false)}
        onCreate={(payload) => void submitCreate(payload)}
      />
    </div>
  );
}
